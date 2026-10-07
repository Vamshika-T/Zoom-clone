"use client";

import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Users,
  MessageSquare,
  MonitorUp,
  MoreHorizontal,
  PhoneOff,
} from "lucide-react";

export default function MeetingToolbar({
  audioMuted,
  videoEnabled,
  onToggleAudio,
  onToggleVideo,
  onParticipants,
  onChat,
  onShare,
  onMore,
  onLeave,
}) {
  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 flex h-[82px] items-center justify-center border-t border-white/10 bg-[#17181a] px-4">
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleAudio}
          className="flex h-14 min-w-[68px] flex-col items-center justify-center rounded-lg text-white transition hover:bg-white/10"
        >
          {audioMuted ? <MicOff size={22} /> : <Mic size={22} />}
          <span className="mt-1 text-xs">
            {audioMuted ? "Unmute" : "Mute"}
          </span>
        </button>

        <button
          onClick={onToggleVideo}
          className="flex h-14 min-w-[68px] flex-col items-center justify-center rounded-lg text-white transition hover:bg-white/10"
        >
          {videoEnabled ? <Video size={22} /> : <VideoOff size={22} />}
          <span className="mt-1 text-xs">
            {videoEnabled ? "Stop Video" : "Start Video"}
          </span>
        </button>

        <button
          onClick={onParticipants}
          className="flex h-14 min-w-[68px] flex-col items-center justify-center rounded-lg text-white transition hover:bg-white/10"
        >
          <Users size={22} />
          <span className="mt-1 text-xs">Participants</span>
        </button>

        <button
          onClick={onChat}
          className="flex h-14 min-w-[68px] flex-col items-center justify-center rounded-lg text-white transition hover:bg-white/10"
        >
          <MessageSquare size={22} />
          <span className="mt-1 text-xs">Chat</span>
        </button>

        <button
          onClick={onShare}
          className="flex h-14 min-w-[68px] flex-col items-center justify-center rounded-lg text-white transition hover:bg-white/10"
        >
          <MonitorUp size={22} />
          <span className="mt-1 text-xs">Share</span>
        </button>

        <button
          onClick={onMore}
          className="flex h-14 min-w-[68px] flex-col items-center justify-center rounded-lg text-white transition hover:bg-white/10"
        >
          <MoreHorizontal size={22} />
          <span className="mt-1 text-xs">More</span>
        </button>

        <div className="mx-2 h-9 w-px bg-white/10" />

        <button
          onClick={onLeave}
          className="flex h-11 items-center gap-2 rounded-lg bg-[#dc3545] px-5 text-sm font-medium text-white transition hover:bg-[#c82333]"
        >
          <PhoneOff size={18} />
          Leave
        </button>
      </div>
    </div>
  );
}