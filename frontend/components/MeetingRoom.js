"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
    ArrowLeft,
    Copy,
    MoreVertical,
    ShieldCheck,
    Video,
} from "lucide-react";

import {
    getMeeting,
    joinMeeting,
    getParticipants,
    leaveMeeting,
    updateParticipant,
    muteAll,
    removeParticipant,
} from "../lib/api";

import MeetingToolbar from "./MeetingToolbar";
import ParticipantsPanel from "./ParticipantsPanel";
import ChatPanel from "./ChatPanel";

const API_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const WS_URL = API_URL.replace(/^http/, "ws");

const ICE_SERVERS = {
    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302",
        },
    ],
};

export default function MeetingRoom({ meetingId }) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const hostMode = searchParams.get("host") === "true";
    const queryName = searchParams.get("name");

    const localVideoRef = useRef(null);
    const localStreamRef = useRef(null);

    const socketRef = useRef(null);

    /*
     * participantId -> RTCPeerConnection
     */
    const peerConnectionsRef = useRef({});

    /*
     * participantId -> queued ICE candidates
     *
     * ICE candidates can arrive before remoteDescription exists.
     * We keep them here and flush them after the description is set.
     */
    const pendingIceCandidatesRef = useRef({});

    /*
     * participantId -> <video> element
     */
    const remoteVideoRefs = useRef({});

    const participantRef = useRef(null);

    const joinInProgressRef = useRef(false);

    const leavingRef = useRef(false);

    const [meeting, setMeeting] = useState(null);
    const [currentParticipant, setCurrentParticipant] = useState(null);
    const [participants, setParticipants] = useState([]);

    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);
    const [error, setError] = useState("");
    const [cameraWarning, setCameraWarning] = useState("");

    const [audioMuted, setAudioMuted] = useState(false);
    const [videoEnabled, setVideoEnabled] = useState(true);

    const [activePanel, setActivePanel] = useState(null);
    const [messages, setMessages] = useState([]);

    /*
     * participantId -> MediaStream
     */
    const [remoteStreams, setRemoteStreams] = useState({});

    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const [copied, setCopied] = useState(false);

    const isHost = hostMode;

    useEffect(() => {
        participantRef.current = currentParticipant;
    }, [currentParticipant]);

    /*
     * ------------------------------------------------------------
     * SOCKET HELPERS
     * ------------------------------------------------------------
     */

    const sendSocketMessage = useCallback((message) => {
        const socket = socketRef.current;

        if (!socket || socket.readyState !== WebSocket.OPEN) {
            console.warn("WebSocket is not ready:", message.type);
            return false;
        }

        try {
            socket.send(JSON.stringify(message));
            return true;
        } catch (err) {
            console.error("WebSocket send failed:", err);
            return false;
        }
    }, []);

    /*
     * ------------------------------------------------------------
     * MEETING
     * ------------------------------------------------------------
     */

    const loadMeeting = useCallback(async () => {
        try {
            setLoading(true);
            setError("");

            const data = await getMeeting(meetingId);

            setMeeting(data);
        } catch (err) {
            setError(err.message || "Meeting not found.");
        } finally {
            setLoading(false);
        }
    }, [meetingId]);

    useEffect(() => {
        loadMeeting();
    }, [loadMeeting]);

    /*
     * ------------------------------------------------------------
     * PARTICIPANTS
     * ------------------------------------------------------------
     */

    const refreshParticipants = useCallback(async () => {
        try {
            const data = await getParticipants(meetingId);

            setParticipants(data);

            return data;
        } catch {
            return [];
        }
    }, [meetingId]);

    /*
     * ------------------------------------------------------------
     * ICE
     * ------------------------------------------------------------
     */

    const queueIceCandidate = useCallback(
        (participantId, candidate) => {
            if (!pendingIceCandidatesRef.current[participantId]) {
                pendingIceCandidatesRef.current[participantId] = [];
            }

            pendingIceCandidatesRef.current[participantId].push(candidate);
        },
        []
    );

    const flushIceCandidates = useCallback(async (participantId, peer) => {
        const queued =
            pendingIceCandidatesRef.current[participantId] || [];

        if (!queued.length) {
            return;
        }

        delete pendingIceCandidatesRef.current[participantId];

        for (const candidate of queued) {
            try {
                await peer.addIceCandidate(
                    new RTCIceCandidate(candidate)
                );
            } catch (err) {
                console.error(
                    "Queued ICE candidate failed:",
                    err
                );
            }
        }
    }, []);

    /*
     * ------------------------------------------------------------
     * PEER CLEANUP
     * ------------------------------------------------------------
     */

    const closePeerConnection = useCallback((participantId) => {
        const peer =
            peerConnectionsRef.current[participantId];

        if (peer) {
            try {
                peer.onicecandidate = null;
                peer.ontrack = null;
                peer.onconnectionstatechange = null;
                peer.close();
            } catch {
                // Already closed.
            }

            delete peerConnectionsRef.current[participantId];
        }

        delete pendingIceCandidatesRef.current[participantId];

        setRemoteStreams((current) => {
            const next = { ...current };
            delete next[participantId];
            return next;
        });

        delete remoteVideoRefs.current[participantId];
    }, []);

    const closeAllPeerConnections = useCallback(() => {
        Object.values(peerConnectionsRef.current).forEach(
            (peer) => {
                try {
                    peer.close();
                } catch {
                    // Ignore.
                }
            }
        );

        peerConnectionsRef.current = {};
        pendingIceCandidatesRef.current = {};
        remoteVideoRefs.current = {};

        setRemoteStreams({});
    }, []);

    /*
     * ------------------------------------------------------------
     * CREATE PEER CONNECTION
     * ------------------------------------------------------------
     */

    const createPeerConnection = useCallback(
        (participantId) => {
            const existing =
                peerConnectionsRef.current[participantId];

            if (existing) {
                return existing;
            }

            console.log(
                "[WebRTC] Creating peer connection:",
                participantId
            );

            const peer = new RTCPeerConnection(
                ICE_SERVERS
            );

            peerConnectionsRef.current[participantId] = peer;

            /*
             * Add our local audio/video tracks.
             */
            const localStream =
                localStreamRef.current;

            if (localStream) {
                localStream.getTracks().forEach((track) => {
                    try {
                        peer.addTrack(track, localStream);
                    } catch (err) {
                        console.error(
                            "Failed to add local track:",
                            err
                        );
                    }
                });
            }

            /*
             * ICE candidates generated locally.
             */
            peer.onicecandidate = (event) => {
                if (!event.candidate) {
                    return;
                }

                const current =
                    participantRef.current;

                if (!current) {
                    return;
                }

                sendSocketMessage({
                    type: "ice-candidate",
                    senderId: current.id,
                    target: participantId,
                    candidate: event.candidate,
                });
            };

            /*
             * Remote audio/video arrived.
             */
            peer.ontrack = (event) => {
                console.log(
                    "[WebRTC] Remote track received:",
                    participantId,
                    event.track.kind
                );

                let stream = event.streams?.[0];

                /*
                 * Some browsers may not provide event.streams[0].
                 */
                if (!stream) {
                    stream = new MediaStream([event.track]);
                }

                setRemoteStreams((current) => ({
                    ...current,
                    [participantId]: stream,
                }));
            };

            /*
             * Connection state.
             */
            peer.onconnectionstatechange = () => {
                console.log(
                    `[WebRTC] ${participantId} connection state:`,
                    peer.connectionState
                );

                if (
                    peer.connectionState === "failed" ||
                    peer.connectionState === "closed"
                ) {
                    closePeerConnection(participantId);
                }
            };

            peer.oniceconnectionstatechange = () => {
                console.log(
                    `[WebRTC] ${participantId} ICE state:`,
                    peer.iceConnectionState
                );
            };

            peer.onsignalingstatechange = () => {
                console.log(
                    `[WebRTC] ${participantId} signaling state:`,
                    peer.signalingState
                );
            };

            return peer;
        },
        [closePeerConnection, sendSocketMessage]
    );

    /*
     * ------------------------------------------------------------
     * CREATE OFFER
     * ------------------------------------------------------------
     */

    const createOfferForParticipant = useCallback(
        async (participantId) => {
            const current =
                participantRef.current;

            if (!current) {
                return;
            }

            let peer =
                peerConnectionsRef.current[
                participantId
                ];

            if (!peer) {
                peer =
                    createPeerConnection(
                        participantId
                    );
            }

            /*
             * Avoid creating an offer if negotiation is
             * already in progress.
             */
            if (
                peer.signalingState !== "stable"
            ) {
                console.log(
                    "[WebRTC] Not creating offer because signaling state is:",
                    peer.signalingState
                );

                return;
            }

            try {
                console.log(
                    "[WebRTC] Creating offer for:",
                    participantId
                );

                const offer =
                    await peer.createOffer();

                await peer.setLocalDescription(
                    offer
                );

                sendSocketMessage({
                    type: "offer",
                    senderId: current.id,
                    target: participantId,
                    offer: peer.localDescription,
                });
            } catch (err) {
                console.error(
                    "[WebRTC] Offer creation failed:",
                    err
                );
            }
        },
        [createPeerConnection, sendSocketMessage]
    );

    /*
     * ------------------------------------------------------------
     * HANDLE OFFER
     * ------------------------------------------------------------
     */

    const handleOffer = useCallback(
        async (message) => {
            const current =
                participantRef.current;

            if (!current) {
                return;
            }

            if (Number(message.target) !== Number(current.id)) {
                return;
            }

            const senderId = Number(
                message.senderId
            );

            let peer =
                peerConnectionsRef.current[
                senderId
                ];

            if (!peer) {
                peer =
                    createPeerConnection(senderId);
            }

            try {
                console.log(
                    "[WebRTC] Received offer from:",
                    senderId
                );

                /*
                 * We should only receive an offer when the
                 * connection is stable.
                 */
                if (
                    peer.signalingState !== "stable"
                ) {
                    console.warn(
                        "[WebRTC] Ignoring offer because signaling state is:",
                        peer.signalingState
                    );

                    return;
                }

                await peer.setRemoteDescription(
                    new RTCSessionDescription(
                        message.offer
                    )
                );

                /*
                 * ICE candidates received before this point
                 * can now safely be added.
                 */
                await flushIceCandidates(
                    senderId,
                    peer
                );

                const answer =
                    await peer.createAnswer();

                await peer.setLocalDescription(
                    answer
                );

                sendSocketMessage({
                    type: "answer",
                    senderId: current.id,
                    target: senderId,
                    answer: peer.localDescription,
                });

                console.log(
                    "[WebRTC] Answer sent to:",
                    senderId
                );
            } catch (err) {
                console.error(
                    "[WebRTC] Offer handling failed:",
                    err
                );
            }
        },
        [
            createPeerConnection,
            flushIceCandidates,
            sendSocketMessage,
        ]
    );

    /*
     * ------------------------------------------------------------
     * HANDLE ANSWER
     * ------------------------------------------------------------
     */

    const handleAnswer = useCallback(
        async (message) => {
            const current =
                participantRef.current;

            if (!current) {
                return;
            }

            if (Number(message.target) !== Number(current.id)) {
                return;
            }

            const senderId = Number(
                message.senderId
            );

            const peer =
                peerConnectionsRef.current[
                senderId
                ];

            if (!peer) {
                console.warn(
                    "[WebRTC] Received answer but peer doesn't exist:",
                    senderId
                );

                return;
            }

            try {
                console.log(
                    "[WebRTC] Received answer from:",
                    senderId
                );

                await peer.setRemoteDescription(
                    new RTCSessionDescription(
                        message.answer
                    )
                );

                await flushIceCandidates(
                    senderId,
                    peer
                );
            } catch (err) {
                console.error(
                    "[WebRTC] Answer handling failed:",
                    err
                );
            }
        },
        [flushIceCandidates]
    );

    /*
     * ------------------------------------------------------------
     * HANDLE ICE
     * ------------------------------------------------------------
     */

    const handleIceCandidate = useCallback(
        async (message) => {
            const current =
                participantRef.current;

            if (!current) {
                return;
            }

            if (Number(message.target) !== Number(current.id)) {
                return;
            }

            const senderId = Number(
                message.senderId
            );

            const peer =
                peerConnectionsRef.current[
                senderId
                ];

            /*
             * Peer may not have been created yet.
             */
            if (!peer) {
                queueIceCandidate(
                    senderId,
                    message.candidate
                );

                return;
            }

            /*
             * Remote description isn't ready yet.
             *
             * This was one of the major problems in the
             * previous implementation.
             */
            if (!peer.remoteDescription) {
                queueIceCandidate(
                    senderId,
                    message.candidate
                );

                return;
            }

            try {
                await peer.addIceCandidate(
                    new RTCIceCandidate(
                        message.candidate
                    )
                );
            } catch (err) {
                console.error(
                    "[WebRTC] ICE candidate failed:",
                    err
                );
            }
        },
        [queueIceCandidate]
    );

    /*
     * ------------------------------------------------------------
     * SOCKET MESSAGE HANDLER
     * ------------------------------------------------------------
     */

    const handleSocketMessage = useCallback(
        async (message) => {
            const current =
                participantRef.current;

            if (!current) {
                return;
            }

            /*
             * Another participant joined.
             *
             * Existing participant becomes the caller.
             */
            if (message.type === "peer-join") {
                const joinedId = Number(
                    message.participantId
                );

                if (
                    joinedId ===
                    Number(current.id)
                ) {
                    return;
                }

                console.log(
                    "[WebRTC] New participant:",
                    joinedId
                );

                await refreshParticipants();

                /*
                 * IMPORTANT:
                 * Existing participant creates the offer.
                 */
                await createOfferForParticipant(
                    joinedId
                );

                return;
            }

            if (
                message.type ===
                "participant_joined"
            ) {
                await refreshParticipants();
                return;
            }

            if (
                message.type ===
                "participant_left"
            ) {
                const participantId =
                    Number(
                        message.participantId
                    );

                if (participantId) {
                    closePeerConnection(
                        participantId
                    );
                }

                await refreshParticipants();

                return;
            }

            /*
             * WebRTC offer.
             */
            if (message.type === "offer") {
                await handleOffer(message);
                return;
            }

            /*
             * WebRTC answer.
             */
            if (message.type === "answer") {
                await handleAnswer(message);
                return;
            }

            /*
             * WebRTC ICE candidate.
             */
            if (
                message.type ===
                "ice-candidate"
            ) {
                await handleIceCandidate(
                    message
                );

                return;
            }

            /*
             * Chat.
             */
            if (message.type === "chat") {
                setMessages(
                    (currentMessages) => [
                        ...currentMessages,
                        {
                            sender:
                                message.sender ||
                                "Participant",
                            participantId:
                                message.participantId,
                            message:
                                message.message,
                            timestamp:
                                message.timestamp ||
                                Date.now(),
                        },
                    ]
                );

                return;
            }

            /*
             * Participant state changed.
             */
            if (
                message.type ===
                "participant-state"
            ) {
                await refreshParticipants();
                return;
            }

            /*
             * Host muted everyone.
             */
            if (message.type === "mute-all") {
                if (
                    Number(
                        message.participantId
                    ) !== Number(current.id)
                ) {
                    setAudioMuted(true);

                    localStreamRef.current
                        ?.getAudioTracks()
                        .forEach(
                            (track) => {
                                track.enabled =
                                    false;
                            }
                        );

                    await refreshParticipants();
                }

                return;
            }

            /*
             * Host removed participant.
             */
            if (
                message.type ===
                "participant-removed"
            ) {
                const removedId = Number(
                    message.participantId
                );

                if (
                    removedId ===
                    Number(current.id)
                ) {
                    try {
                        await leaveMeeting(
                            meetingId,
                            current.id
                        );
                    } catch {
                        // Continue cleanup.
                    }

                    leavingRef.current = true;

                    socketRef.current?.close();

                    closeAllPeerConnections();

                    localStreamRef.current
                        ?.getTracks()
                        .forEach(
                            (track) =>
                                track.stop()
                        );

                    localStreamRef.current =
                        null;

                    sessionStorage.removeItem(
                        `meeting_${meetingId}`
                    );

                    router.push("/");

                    return;
                }

                closePeerConnection(
                    removedId
                );

                await refreshParticipants();

                return;
            }
        },
        [
            closeAllPeerConnections,
            closePeerConnection,
            createOfferForParticipant,
            handleAnswer,
            handleIceCandidate,
            handleOffer,
            meetingId,
            refreshParticipants,
            router,
        ]
    );

    /*
     * ------------------------------------------------------------
     * CONNECT WEBSOCKET
     * ------------------------------------------------------------
     */

    const connectSocket = useCallback(
        (participant) => {
            if (socketRef.current) {
                try {
                    socketRef.current.close();
                } catch {
                    // Ignore.
                }
            }

            const socket = new WebSocket(
                `${WS_URL}/ws/meetings/${meetingId}`
            );

            socketRef.current = socket;

            socket.onopen = () => {
                console.log(
                    "[WebSocket] Connected"
                );

                socket.send(
                    JSON.stringify({
                        type: "peer-join",
                        participantId:
                            participant.id,
                        participantName:
                            participant.display_name,
                    })
                );
            };

            socket.onmessage = async (event) => {
                try {
                    const message =
                        JSON.parse(
                            event.data
                        );

                    /*
                     * Never ignore peer lifecycle
                     * messages because they don't necessarily
                     * contain senderId.
                     */

                    if (
                        message.type ===
                        "participant_joined" ||
                        message.type ===
                        "participant_left" ||
                        message.type ===
                        "peer-join"
                    ) {
                        await handleSocketMessage(
                            message
                        );

                        return;
                    }

                    /*
                     * Ignore our own broadcast messages.
                     */
                    if (
                        message.senderId != null &&
                        Number(
                            message.senderId
                        ) === Number(participant.id)
                    ) {
                        return;
                    }

                    await handleSocketMessage(
                        message
                    );
                } catch (err) {
                    console.error(
                        "[WebSocket] Message error:",
                        err
                    );
                }
            };

            socket.onerror = (event) => {
                console.error(
                    "[WebSocket] Error:",
                    event
                );
            };

            socket.onclose = () => {
                console.log(
                    "[WebSocket] Closed"
                );

                /*
                 * Don't reconnect after user intentionally
                 * left the meeting.
                 */
                if (!leavingRef.current) {
                    console.log(
                        "[WebSocket] Meeting socket closed."
                    );
                }
            };
        },
        [
            handleSocketMessage,
            meetingId,
        ]
    );

    /*
     * ------------------------------------------------------------
     * MEDIA
     * ------------------------------------------------------------
     */

    const startMedia = useCallback(async () => {
        if (
            !navigator.mediaDevices?.getUserMedia
        ) {
            throw new Error(
                "Camera and microphone access is not available."
            );
        }

        let stream = null;

        /*
         * First try camera + microphone.
         */
        try {
            stream =
                await navigator.mediaDevices.getUserMedia(
                    {
                        video: true,
                        audio: true,
                    }
                );

            setVideoEnabled(true);
            setAudioMuted(false);
        } catch (videoError) {
            console.warn(
                "[Media] Camera + microphone failed:",
                videoError.name,
                videoError.message
            );

            /*
             * If the camera is already being used by another
             * application/browser tab, don't kill the entire
             * meeting. Try microphone only.
             */
            try {
                stream =
                    await navigator.mediaDevices.getUserMedia(
                        {
                            video: false,
                            audio: true,
                        }
                    );

                setVideoEnabled(false);
                setAudioMuted(false);

                setCameraWarning(
                    "You joined with microphone only. You can continue the meeting."

                );
            } catch (audioError) {
                console.warn(
                    "[Media] Microphone also failed:",
                    audioError.name,
                    audioError.message
                );

                /*
                 * We can still join the meeting without
                 * sending local media.
                 */
                stream = new MediaStream();

                setVideoEnabled(false);
                setAudioMuted(true);

                setCameraWarning(
                    "Camera and microphone are unavailable. You can still view the meeting."
                );
            }
        }

        localStreamRef.current = stream;


        if (localVideoRef.current) {
            localVideoRef.current.srcObject =
                stream;
        }

        return {
            stream,
            videoEnabled: stream.getVideoTracks().length > 0,
            audioEnabled: stream.getAudioTracks().length > 0,
        };
    }, []);

    /*
     * ------------------------------------------------------------
     * CLEANUP MEDIA
     * ------------------------------------------------------------
     */

    const cleanupMedia = useCallback(() => {
        if (localStreamRef.current) {
            localStreamRef.current
                .getTracks()
                .forEach((track) =>
                    track.stop()
                );

            localStreamRef.current = null;
        }

        if (localVideoRef.current) {
            localVideoRef.current.srcObject =
                null;
        }
    }, []);

    /*
     * ------------------------------------------------------------
     * LEAVE
     * ------------------------------------------------------------
     */

    const cleanupAndLeave = useCallback(
        async (callApi = true) => {
            if (leavingRef.current) {
                return;
            }

            leavingRef.current = true;

            const participant =
                participantRef.current;

            if (
                callApi &&
                participant
            ) {
                try {
                    await leaveMeeting(
                        meetingId,
                        participant.id
                    );
                } catch {
                    // Continue cleanup.
                }
            }

            try {
                socketRef.current?.close();
            } catch {
                // Ignore.
            }

            socketRef.current = null;

            closeAllPeerConnections();

            cleanupMedia();

            sessionStorage.removeItem(
                `meeting_${meetingId}`
            );

            router.push("/");
        },
        [
            cleanupMedia,
            closeAllPeerConnections,
            meetingId,
            router,
        ]
    );

    /*
     * ------------------------------------------------------------
     * JOIN MEETING
     * ------------------------------------------------------------
     */

    useEffect(() => {
        if (!meeting) {
            return;
        }

        if (joinInProgressRef.current) {
            return;
        }

        joinInProgressRef.current = true;
        leavingRef.current = false;

        async function join() {
            try {
                setJoining(true);
                setError("");

                let storedParticipant =
                    null;

                try {
                    const stored =
                        sessionStorage.getItem(
                            `meeting_${meetingId}`
                        );

                    if (stored) {
                        storedParticipant =
                            JSON.parse(
                                stored
                            );
                    }
                } catch {
                    storedParticipant =
                        null;
                }

                /*
                 * ------------------------------------------------
                 * Validate stored participant.
                 * ------------------------------------------------
                 *
                 * The old implementation trusted sessionStorage
                 * blindly. If the participant had already left,
                 * the WebSocket could reject that stale ID.
                 */

                if (
                    storedParticipant?.id
                ) {
                    const activeParticipants =
                        await getParticipants(
                            meetingId
                        );

                    const stillActive =
                        activeParticipants.some(
                            (participant) =>
                                Number(
                                    participant.id
                                ) ===
                                Number(
                                    storedParticipant.id
                                ) &&
                                participant.status ===
                                "joined"
                        );

                    if (stillActive) {
                        if (hostMode) {
                            storedParticipant.role = "host";
                        }

                        setCurrentParticipant(
                            storedParticipant
                        );

                        participantRef.current =
                            storedParticipant;

                        setParticipants(
                            activeParticipants
                        );

                        const mediaState = await startMedia();


                        await updateParticipant(
                            meetingId,
                            storedParticipant.id,
                            {
                                video_enabled: mediaState.videoEnabled,
                            }
                        );

                        connectSocket(
                            storedParticipant
                        );

                        return;
                    }

                    sessionStorage.removeItem(
                        `meeting_${meetingId}`
                    );
                }

                /*
                 * ------------------------------------------------
                 * Determine display name.
                 * ------------------------------------------------
                 */

                let loggedInUser = null;

                try {
                    const storedUser = localStorage.getItem("auth_user");

                    if (storedUser) {
                        loggedInUser = JSON.parse(storedUser);
                    }
                } catch {
                    loggedInUser = null;
                }

                const displayName = hostMode
                    ? loggedInUser?.name?.trim() || "Demo User"
                    : queryName?.trim();

                if (!displayName) {
                    router.replace(
                        `/join?meeting=${encodeURIComponent(
                            meetingId
                        )}`
                    );

                    return;
                }

                /*
                 * ------------------------------------------------
                 * REST JOIN
                 * ------------------------------------------------
                 */

                const response =
                    await joinMeeting(
                        meetingId,
                        displayName
                    );

                const participant =
                    response.participant;

                /*
                 * Host role is currently a frontend UI role.
                 * Backend host authorization should be secured
                 * separately.
                 */
                if (hostMode) {
                    participant.role =
                        "host";
                }

                setCurrentParticipant(
                    participant
                );

                participantRef.current =
                    participant;

                sessionStorage.setItem(
                    `meeting_${meetingId}`,
                    JSON.stringify(
                        participant
                    )
                );

                await refreshParticipants();

                /*
                 * Camera failure should NOT prevent joining.
                 */
                const mediaState = await startMedia();

                await updateParticipant(
                    meetingId,
                    participant.id,
                    {
                        video_enabled: mediaState.videoEnabled,
                    }
                );

                /*
                 * WebSocket connects after local media is ready.
                 * This means an offer contains our local tracks.
                 */
                connectSocket(
                    participant
                );
            } catch (err) {
                if (err.message === "This meeting has been cancelled.") {
                    setError(err.message);
                    return;
                }

                console.error(
                    "[Meeting] Join failed:",
                    err
                );

                setError(
                    err.message ||
                    "Unable to join this meeting."
                );
            } finally {
                setJoining(false);
                joinInProgressRef.current =
                    false;
            }
        }

        join();

        return () => {
            /*
             * Don't call leave here.
             * React Strict Mode can run effects twice in
             * development and accidentally leave the meeting.
             */
        };
    }, [
        connectSocket,
        hostMode,
        meeting,
        meetingId,
        queryName,
        refreshParticipants,
        router,
        startMedia,
    ]);

    /*
     * ------------------------------------------------------------
     * PARTICIPANT POLLING
     * ------------------------------------------------------------
     */

    useEffect(() => {
        if (!currentParticipant) {
            return;
        }

        refreshParticipants();

        const interval = setInterval(
            refreshParticipants,
            3000
        );

        return () =>
            clearInterval(interval);
    }, [
        currentParticipant,
        refreshParticipants,
    ]);

    /*
     * ------------------------------------------------------------
     * GLOBAL CLEANUP
     * ------------------------------------------------------------
     */

    useEffect(() => {
        return () => {
            try {
                socketRef.current?.close();
            } catch {
                // Ignore.
            }

            Object.values(
                peerConnectionsRef.current
            ).forEach((peer) => {
                try {
                    peer.close();
                } catch {
                    // Ignore.
                }
            });

            localStreamRef.current
                ?.getTracks()
                .forEach((track) =>
                    track.stop()
                );
        };
    }, []);

    /*
     * ------------------------------------------------------------
     * REMOTE VIDEO ELEMENTS
     * ------------------------------------------------------------
     */

    useEffect(() => {
        Object.entries(
            remoteVideoRefs.current
        ).forEach(
            ([participantId, element]) => {
                if (!element) {
                    return;
                }

                const stream =
                    remoteStreams[
                    participantId
                    ];

                if (
                    stream &&
                    element.srcObject !== stream
                ) {
                    element.srcObject =
                        stream;

                    /*
                     * Explicitly attempt playback.
                     */
                    element
                        .play()
                        .catch(() => {
                            // Autoplay may already be handling it.
                        });
                }
            }
        );
    }, [remoteStreams]);

    /*
     * ------------------------------------------------------------
     * AUDIO
     * ------------------------------------------------------------
     */

    async function toggleAudio() {
        const participant =
            participantRef.current;

        if (!participant) {
            return;
        }

        const nextMuted = !audioMuted;

        setAudioMuted(nextMuted);

        localStreamRef.current
            ?.getAudioTracks()
            .forEach((track) => {
                track.enabled =
                    !nextMuted;
            });

        try {
            const updated =
                await updateParticipant(
                    meetingId,
                    participant.id,
                    {
                        audio_muted:
                            nextMuted,
                    }
                );

            /*
             * Preserve host UI role.
             */
            if (isHost) {
                updated.role = "host";
            }

            setCurrentParticipant(
                updated
            );

            participantRef.current =
                updated;

            sendSocketMessage({
                type: "participant-state",
                senderId:
                    participant.id,
                participantId:
                    participant.id,
            });

            await refreshParticipants();
        } catch {
            // Local state remains responsive.
        }
    }

    /*
     * ------------------------------------------------------------
     * VIDEO
     * ------------------------------------------------------------
     */

    async function toggleVideo() {
        const participant =
            participantRef.current;

        if (!participant) {
            return;
        }

        const videoTrack =
            localStreamRef.current?.getVideoTracks()?.[0];

        /*
         * If no camera track exists, try to request one.
         */
        if (!videoTrack) {
            try {
                const cameraStream =
                    await navigator.mediaDevices.getUserMedia(
                        {
                            video: true,
                        }
                    );

                const newVideoTrack =
                    cameraStream.getVideoTracks()[0];

                if (!localStreamRef.current) {
                    localStreamRef.current =
                        new MediaStream();
                }

                localStreamRef.current.addTrack(
                    newVideoTrack
                );

                if (localVideoRef.current) {
                    localVideoRef.current.srcObject =
                        localStreamRef.current;
                }

                /*
                 * Add the camera track to every existing
                 * peer connection.
                 */
                Object.entries(
                    peerConnectionsRef.current
                ).forEach(
                    ([participantId, peer]) => {
                        try {
                            peer.addTrack(
                                newVideoTrack,
                                localStreamRef.current
                            );

                            /*
                             * Adding a new track requires
                             * renegotiation.
                             */
                            createOfferForParticipant(
                                Number(
                                    participantId
                                )
                            );
                        } catch (err) {
                            console.error(
                                "Failed to add camera track:",
                                err
                            );
                        }
                    }
                );

                setVideoEnabled(true);
                setCameraWarning("");

                return;
            } catch (err) {
                setCameraWarning(
                    "Camera is unavailable. Make sure no other application or browser tab is using the camera."
                );

                return;
            }
        }

        const nextEnabled =
            !videoEnabled;

        setVideoEnabled(nextEnabled);

        videoTrack.enabled =
            nextEnabled;

        try {
            const updated =
                await updateParticipant(
                    meetingId,
                    participant.id,
                    {
                        video_enabled:
                            nextEnabled,
                    }
                );

            if (isHost) {
                updated.role = "host";
            }

            setCurrentParticipant(
                updated
            );

            participantRef.current =
                updated;

            sendSocketMessage({
                type: "participant-state",
                senderId:
                    participant.id,
                participantId:
                    participant.id,
            });

            await refreshParticipants();
        } catch {
            // Local state remains responsive.
        }
    }

    /*
     * ------------------------------------------------------------
     * SCREEN SHARE
     * ------------------------------------------------------------
     */

    async function toggleScreenShare() {
        if (isScreenSharing) {
            stopScreenShare();
            return;
        }

        try {
            const screenStream =
                await navigator.mediaDevices.getDisplayMedia(
                    {
                        video: true,
                        audio: false,
                    }
                );

            const screenTrack =
                screenStream.getVideoTracks()[0];
            console.log("[Screen Share] Track:", {
                kind: screenTrack.kind,
                readyState: screenTrack.readyState,
                enabled: screenTrack.enabled,
            });

            if (!screenTrack) {
                return;
            }

            Object.values(
                peerConnectionsRef.current
            ).forEach((peer) => {
                const sender =
                    peer
                        .getSenders()
                        .find(
                            (item) =>
                                item.track?.kind ===
                                "video"
                        );

                if (sender) {
                    sender.replaceTrack(
                        screenTrack
                    );
                }
            });

            /*
             * Show screen locally.
             */
            if (localVideoRef.current) {
                localVideoRef.current.srcObject =
                    screenStream;
            }

            screenTrack.onended =
                stopScreenShare;

            setIsScreenSharing(true);
        } catch {
            // User cancelled.
        }
    }

    function stopScreenShare() {
        const cameraTrack =
            localStreamRef.current
                ?.getVideoTracks()
                ?.find(
                    (track) =>
                        track.kind ===
                        "video"
                );

        Object.values(
            peerConnectionsRef.current
        ).forEach((peer) => {
            const sender =
                peer
                    .getSenders()
                    .find(
                        (item) =>
                            item.track?.kind ===
                            "video"
                    );

            if (
                sender &&
                cameraTrack
            ) {
                sender.replaceTrack(
                    cameraTrack
                );
            }
        });

        if (localVideoRef.current) {
            localVideoRef.current.srcObject =
                localStreamRef.current;
        }

        setIsScreenSharing(false);
    }

    /*
     * ------------------------------------------------------------
     * CHAT
     * ------------------------------------------------------------
     */

    function sendChat(message) {
        const participant =
            participantRef.current;

        if (!participant) {
            return;
        }

        const chatMessage = {
            type: "chat",
            senderId:
                participant.id,
            participantId:
                participant.id,
            sender:
                participant.display_name,
            message,
            timestamp: Date.now(),
        };

        setMessages((current) => [
            ...current,
            chatMessage,
        ]);

        sendSocketMessage(
            chatMessage
        );
    }

    /*
     * ------------------------------------------------------------
     * HOST CONTROLS
     * ------------------------------------------------------------
     */

    async function handleMuteAll() {
        if (!isHost) {
            return;
        }

        try {
            await muteAll(meetingId);

            sendSocketMessage({
                type: "mute-all",
                senderId:
                    participantRef.current
                        ?.id,
                participantId:
                    participantRef.current
                        ?.id,
            });

            await refreshParticipants();
        } catch {
            // Ignore API failure.
        }
    }

    async function handleRemoveParticipant(
        participantId
    ) {
        if (!isHost) {
            return;
        }

        try {
            await removeParticipant(
                meetingId,
                participantId
            );

            sendSocketMessage({
                type: "participant-removed",
                senderId:
                    participantRef.current
                        ?.id,
                participantId,
            });

            closePeerConnection(
                participantId
            );

            await refreshParticipants();
        } catch {
            // Ignore API failure.
        }
    }

    /*
     * ------------------------------------------------------------
     * INVITE
     * ------------------------------------------------------------
     */

    async function copyInviteLink() {
        const link =
            meeting?.invite_link ||
            `${window.location.origin}/meeting/${meetingId}`;

        try {
            await navigator.clipboard.writeText(
                link
            );

            setCopied(true);

            setTimeout(() => {
                setCopied(false);
            }, 1800);
        } catch {
            // Clipboard unavailable.
        }
    }

    /*
     * ------------------------------------------------------------
     * REMOTE PARTICIPANTS
     * ------------------------------------------------------------
     *
     * IMPORTANT:
     * Do NOT filter participants based on remoteStreams.
     *
     * A participant should remain visible even while WebRTC
     * negotiation is still happening.
     */

    const remoteParticipantEntries =
        participants.filter(
            (participant) =>
                Number(participant.id) !==
                Number(
                    currentParticipant?.id
                )
        );

    /*
     * ------------------------------------------------------------
     * LOADING
     * ------------------------------------------------------------
     */

    if (loading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#0f1114] text-white">
                <div className="text-center">
                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-[#2d8cff]" />

                    <p className="text-sm text-white/70">
                        Loading meeting...
                    </p>
                </div>
            </main>
        );
    }
    if (meeting?.status === "cancelled") {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#0f1114] px-6 text-white">
                <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#17181a] p-8 text-center shadow-2xl">
                    <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-yellow-400/10 text-yellow-300">
                        !
                    </div>

                    <h1 className="text-2xl font-semibold">
                        Meeting Cancelled
                    </h1>

                    <p className="mt-3 text-sm leading-6 text-white/60">
                        This meeting has been cancelled by the host.
                        You can no longer join this meeting.
                    </p>

                    <button
                        onClick={() => router.push("/")}
                        className="mt-7 rounded-lg bg-[#2d8cff] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#1677e8]"
                    >
                        Back to Home
                    </button>
                </div>
            </main>
        );
    }

    /*
     * ------------------------------------------------------------
     * MEETING ERROR
     * ------------------------------------------------------------
     */

    if (error && !meeting) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#f7f9fc] px-6">
                <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
                        <Video className="text-red-500" />
                    </div>

                    <h1 className="text-xl font-semibold text-gray-900">
                        Unable to join meeting
                    </h1>

                    <p className="mt-2 text-sm text-gray-500">
                        {error}
                    </p>

                    <button
                        onClick={() =>
                            router.push("/")
                        }
                        className="mt-6 rounded-lg bg-[#2d8cff] px-5 py-3 text-sm font-medium text-white hover:bg-[#1677e8]"
                    >
                        Back to home
                    </button>
                </div>
            </main>
        );
    }

    /*
     * ------------------------------------------------------------
     * MAIN MEETING UI
     * ------------------------------------------------------------
     */

    return (
        <main className="relative h-screen overflow-hidden bg-[#0f1114] text-white">
            <header className="absolute left-0 right-0 top-0 z-30 flex h-16 items-center justify-between border-b border-white/10 bg-[#17181a]/95 px-5 backdrop-blur">
                <div className="flex min-w-0 items-center gap-4">
                    <button
                        onClick={() =>
                            cleanupAndLeave(
                                true
                            )
                        }
                        className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white"
                    >
                        <ArrowLeft size={20} />
                    </button>

                    <div className="min-w-0">
                        <h1 className="truncate text-sm font-semibold">
                            {meeting?.title ||
                                "Meeting"}
                        </h1>

                        <div className="flex items-center gap-2 text-xs text-white/50">
                            <span>
                                {
                                    meeting?.meeting_id
                                }
                            </span>

                            {isHost && (
                                <>
                                    <span>
                                        •
                                    </span>

                                    <span className="text-[#6db3ff]">
                                        Host
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={
                            copyInviteLink
                        }
                        className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/80 hover:bg-white/10"
                    >
                        <Copy size={15} />

                        {copied
                            ? "Copied"
                            : "Invite"}
                    </button>

                    <div className="relative">
                        <button
                            onClick={() =>
                                setShowMoreMenu(
                                    (current) =>
                                        !current
                                )
                            }
                            className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white"
                        >
                            <MoreVertical
                                size={19}
                            />
                        </button>

                        {showMoreMenu && (
                            <div className="absolute right-0 top-11 w-52 rounded-xl border border-gray-200 bg-white p-1 shadow-xl">
                                <button
                                    onClick={() => {
                                        copyInviteLink();
                                        setShowMoreMenu(
                                            false
                                        );
                                    }}
                                    className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                                >
                                    Copy invite link
                                </button>

                                <button
                                    onClick={() => {
                                        setActivePanel(
                                            "participants"
                                        );

                                        setShowMoreMenu(
                                            false
                                        );
                                    }}
                                    className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                                >
                                    Manage participants
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <section className="absolute inset-0 px-4 pb-[94px] pt-[76px]">
                {error && (
                    <div className="absolute left-1/2 top-20 z-20 -translate-x-1/2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-xs text-yellow-200">
                        {error}
                    </div>
                )}
                {cameraWarning && (
                    <div className="absolute left-1/2 top-20 z-30 flex w-[min(92vw,430px)] -translate-x-1/2 items-start gap-3 rounded-xl border border-yellow-400/30 bg-[#25272a]/95 px-4 py-3 text-sm text-white shadow-xl backdrop-blur">
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-yellow-400/15 text-yellow-300">
                            !
                        </div>

                        <div className="min-w-0 flex-1">
                            <p className="font-semibold text-yellow-200">
                                Camera unavailable
                            </p>

                            <p className="mt-1 text-xs leading-5 text-white/65">
                                {cameraWarning}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => setCameraWarning("")}
                            aria-label="Dismiss camera warning"
                            className="rounded-md p-1 text-white/50 transition hover:bg-white/10 hover:text-white"
                        >
                            ×
                        </button>
                    </div>
                )}

                <div
                    className={`grid h-full gap-3 ${remoteParticipantEntries.length ===
                        0
                        ? "grid-cols-1"
                        : "grid-cols-2"
                        }`}
                >
                    {/* LOCAL VIDEO */}
                    <div className="relative min-h-0 overflow-hidden rounded-xl bg-[#202124]">
                        <video
                            ref={localVideoRef}
                            autoPlay
                            muted
                            playsInline
                            className={`h-full w-full object-cover ${videoEnabled
                                ? ""
                                : "hidden"
                                }`}
                        />

                        {!videoEnabled && (
                            <div className="flex h-full items-center justify-center">
                                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#2d8cff] text-3xl font-semibold">
                                    {(
                                        currentParticipant?.display_name ||
                                        "D"
                                    )
                                        .charAt(0)
                                        .toUpperCase()}
                                </div>
                            </div>
                        )}

                        <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-md bg-black/60 px-2.5 py-1.5 text-xs">
                            <span>
                                {currentParticipant?.display_name ||
                                    "You"}
                            </span>

                            {isHost && (
                                <span className="rounded bg-[#2d8cff] px-1.5 py-0.5">
                                    Host
                                </span>
                            )}
                        </div>

                        <div className="absolute right-3 top-3 rounded-md bg-black/50 px-2 py-1 text-xs text-white/70">
                            {audioMuted
                                ? "Muted"
                                : "Live"}
                        </div>
                    </div>

                    {/* REMOTE PARTICIPANTS */}
                    {remoteParticipantEntries.map(
                        (participant) => {
                            const stream =
                                remoteStreams[
                                participant.id
                                ];

                            const hasVideo =
                                Boolean(
                                    stream
                                ) &&
                                participant.video_enabled;

                            return (
                                <div
                                    key={
                                        participant.id
                                    }
                                    className="relative min-h-0 overflow-hidden rounded-xl bg-[#202124]"
                                >
                                    <audio
                                        ref={(element) => {
                                            if (element && stream) {
                                                element.srcObject = stream;
                                                element.play().catch(() => { });
                                            }
                                        }}
                                        autoPlay
                                    />
                                    {hasVideo ? (
                                        <video
                                            ref={(
                                                element
                                            ) => {
                                                remoteVideoRefs.current[
                                                    participant.id
                                                ] =
                                                    element;
                                            }}
                                            autoPlay
                                            playsInline
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <div className="flex h-full items-center justify-center">
                                            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#2d8cff] text-3xl font-semibold">
                                                {participant.display_name
                                                    .charAt(
                                                        0
                                                    )
                                                    .toUpperCase()}
                                            </div>
                                        </div>
                                    )}

                                    <div className="absolute bottom-3 left-3 rounded-md bg-black/60 px-2.5 py-1.5 text-xs">
                                        {
                                            participant.display_name
                                        }
                                    </div>

                                    <div className="absolute right-3 top-3 flex gap-1">
                                        {participant.audio_muted && (
                                            <div className="rounded-md bg-black/60 px-2 py-1 text-xs">
                                                Muted
                                            </div>
                                        )}

                                        {!participant.audio_muted && (
                                            <div className="rounded-md bg-black/50 px-2 py-1">
                                                <ShieldCheck
                                                    size={
                                                        13
                                                    }
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {!stream && (
                                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1.5 text-xs text-white/60">
                                            Connecting...
                                        </div>
                                    )}
                                </div>
                            );
                        }
                    )}
                </div>

                {remoteParticipantEntries.length ===
                    0 && (
                        <div className="pointer-events-none absolute bottom-[105px] left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-4 py-2 text-xs text-white/60">
                            Waiting for others to join...
                        </div>
                    )}
            </section>

            {activePanel ===
                "participants" && (
                    <ParticipantsPanel
                        participants={
                            participants
                        }
                        currentParticipantId={
                            currentParticipant?.id
                        }
                        isHost={isHost}
                        onClose={() =>
                            setActivePanel(
                                null
                            )
                        }
                        onMuteAll={
                            handleMuteAll
                        }
                        onRemove={
                            handleRemoveParticipant
                        }
                    />
                )}

            {activePanel === "chat" && (
                <ChatPanel
                    messages={messages}
                    currentParticipant={
                        currentParticipant
                    }
                    onSend={sendChat}
                    onClose={() =>
                        setActivePanel(
                            null
                        )
                    }
                />
            )}

            <MeetingToolbar
                audioMuted={audioMuted}
                videoEnabled={videoEnabled}
                onToggleAudio={
                    toggleAudio
                }
                onToggleVideo={
                    toggleVideo
                }
                onParticipants={() =>
                    setActivePanel(
                        (current) =>
                            current ===
                                "participants"
                                ? null
                                : "participants"
                    )
                }
                onChat={() =>
                    setActivePanel(
                        (current) =>
                            current ===
                                "chat"
                                ? null
                                : "chat"
                    )
                }
                onShare={
                    toggleScreenShare
                }
                onMore={() =>
                    setShowMoreMenu(
                        (current) =>
                            !current
                    )
                }
                onLeave={() =>
                    cleanupAndLeave(
                        true
                    )
                }
            />

            {joining && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70">
                    <div className="text-center">
                        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-[#2d8cff]" />

                        <p className="text-sm text-white">
                            Joining meeting...
                        </p>
                    </div>
                </div>
            )}
        </main>
    );
}