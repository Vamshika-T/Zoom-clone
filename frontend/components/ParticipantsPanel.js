"use client";

import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  X,
  VolumeX,
} from "lucide-react";

export default function ParticipantsPanel({
  participants,
  currentParticipantId,
  isHost,
  onClose,
  onMuteAll,
  onRemove,
}) {
  return (
    <aside className="absolute right-0 top-0 bottom-[82px] z-40 w-[340px] border-l border-gray-200 bg-white shadow-2xl">
      <div className="flex h-16 items-center justify-between border-b border-gray-200 px-5">
        <div>
          <h2 className="font-semibold text-[#1f2329]">Participants</h2>
          <p className="text-xs text-gray-500">
            {participants.length} participant
            {participants.length !== 1 ? "s" : ""}
          </p>
        </div>

        <button
          onClick={onClose}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
        >
          <X size={20} />
        </button>
      </div>

      {isHost && participants.length > 0 && (
        <div className="border-b border-gray-100 px-4 py-3">
          <button
            onClick={onMuteAll}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <VolumeX size={16} />
            Mute All
          </button>
        </div>
      )}

      <div className="overflow-y-auto p-3">
        {participants.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-500">
            No participants yet.
          </div>
        ) : (
          <div className="space-y-1">
            {participants.map((participant) => {
              const isSelf = participant.id === currentParticipantId;

              return (
                <div
                  key={participant.id}
                  className="flex items-center justify-between rounded-lg px-3 py-3 hover:bg-gray-50"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2d8cff] text-sm font-semibold text-white">
                      {participant.display_name
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {participant.display_name}
                        </p>

                        {isSelf && (
                          <span className="text-xs text-gray-400">
                            (You)
                          </span>
                        )}
                      </div>

                      {participant.role === "host" && (
                        <p className="text-xs text-[#2d8cff]">Host</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {participant.audio_muted ? (
                      <MicOff size={16} className="text-red-500" />
                    ) : (
                      <Mic size={16} className="text-gray-400" />
                    )}

                    {participant.video_enabled ? (
                      <Video size={16} className="text-gray-400" />
                    ) : (
                      <VideoOff size={16} className="text-red-500" />
                    )}

                    {isHost && !isSelf && (
                      <button
                        onClick={() => onRemove(participant.id)}
                        title="Remove participant"
                        className="ml-1 rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}