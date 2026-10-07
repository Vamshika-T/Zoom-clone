from datetime import datetime

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from database import SessionLocal
from models import Participant
from services.websocket_manager import manager


router = APIRouter(tags=["WebSocket"])


SIGNALING_MESSAGES = {
    "offer",
    "answer",
    "ice-candidate",
}


@router.websocket("/ws/meetings/{meeting_id}")
async def meeting_websocket(
    websocket: WebSocket,
    meeting_id: str,
):
    await manager.connect(meeting_id, websocket)

    participant_id: int | None = None

    try:
        while True:
            message = await websocket.receive_json()

            message_type = message.get("type")

            # ---------------------------------------------------------
            # FIRST MESSAGE: REGISTER PARTICIPANT
            # ---------------------------------------------------------

            if message_type == "peer-join":
                incoming_participant_id = message.get("participantId")

                if incoming_participant_id is None:
                    await websocket.close(code=1008)
                    return

                db = SessionLocal()

                try:
                    participant = db.scalar(
                        select(Participant).where(
                            Participant.id == incoming_participant_id,
                            Participant.status == "joined",
                        )
                    )

                    if participant is None:
                        await websocket.close(code=1008)
                        return

                finally:
                    db.close()

                participant_id = int(incoming_participant_id)

                manager.register_participant(
                    meeting_id,
                    participant_id,
                    websocket,
                )

                # Tell existing participants that a new peer has joined.
                #
                # IMPORTANT:
                # We deliberately send "peer-join".
                # The existing frontend uses this event to create
                # the WebRTC offer.
                await manager.broadcast(
                    meeting_id,
                    {
                        "type": "peer-join",
                        "meeting_id": meeting_id,
                        "participantId": participant_id,
                        "participantName": message.get(
                            "participantName",
                            participant.display_name,
                        ),
                    },
                    exclude=websocket,
                )

                # Also notify clients that their REST participant list
                # should be refreshed.
                await manager.broadcast(
                    meeting_id,
                    {
                        "type": "participant_joined",
                        "meeting_id": meeting_id,
                        "participantId": participant_id,
                        "participantName": message.get(
                            "participantName",
                            participant.display_name,
                        ),
                    },
                    exclude=websocket,
                )

                continue

            # Ignore messages until the socket has identified itself.
            if participant_id is None:
                continue

            # ---------------------------------------------------------
            # BASIC SENDER VALIDATION
            # ---------------------------------------------------------

            sender_id = message.get("senderId")

            if sender_id is not None:
                try:
                    sender_id = int(sender_id)
                except (TypeError, ValueError):
                    continue

                if sender_id != participant_id:
                    continue

            # ---------------------------------------------------------
            # WEBRTC SIGNALING
            # ---------------------------------------------------------

            if message_type in SIGNALING_MESSAGES:
                target_id = message.get("target")

                if target_id is None:
                    continue

                try:
                    target_id = int(target_id)
                except (TypeError, ValueError):
                    continue

                # Route offer/answer/ICE only to the intended peer.
                await manager.send_to_participant(
                    meeting_id,
                    target_id,
                    message,
                )

                continue

            # ---------------------------------------------------------
            # NORMAL ROOM EVENTS
            # ---------------------------------------------------------

            await manager.broadcast(
                meeting_id,
                message,
                exclude=websocket,
            )

    except WebSocketDisconnect:
        was_active_connection = manager.unregister_participant(
            meeting_id,
            participant_id,
            websocket,
        )

    # If this websocket was replaced by a newer connection,
    # do not mark the participant as having left.
        if not was_active_connection:
            return

    # Mark participant as having left the meeting.
        if participant_id is not None:
            db = SessionLocal()

            try:
                participant = db.scalar(
                    select(Participant).where(
                        Participant.id == participant_id,
                        Participant.status == "joined",
                    )
                )

                if participant:
                    participant.status = "left"
                    participant.left_at = datetime.utcnow()
                    db.commit()

            finally:
                db.close()

        await manager.broadcast(
            meeting_id,
            {
                "type": "participant_left",
                "meeting_id": meeting_id,
                "participantId": participant_id,
            },
        )

    except Exception:
        manager.unregister_participant(
            meeting_id,
            participant_id,
            websocket,
        )
        raise