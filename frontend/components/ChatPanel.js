"use client";

import { useState } from "react";
import { Send, X } from "lucide-react";

export default function ChatPanel({
  messages,
  currentParticipant,
  onSend,
  onClose,
}) {
  const [message, setMessage] = useState("");

  function handleSubmit(event) {
    event.preventDefault();

    const cleanMessage = message.trim();

    if (!cleanMessage) {
      return;
    }

    onSend(cleanMessage);
    setMessage("");
  }

  return (
    <aside className="absolute right-0 top-0 bottom-[82px] z-40 flex w-[340px] flex-col border-l border-gray-200 bg-white shadow-2xl">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 px-5">
        <div>
          <h2 className="font-semibold text-[#1f2329]">In-meeting chat</h2>
          <p className="text-xs text-gray-500">Everyone</p>
        </div>

        <button
          onClick={onClose}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-gray-500">
            <p>No messages yet.<br />Start the conversation.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((item, index) => {
              const isSelf =
                item.participantId === currentParticipant?.id;

              return (
                <div
                  key={`${item.timestamp}-${index}`}
                  className={isSelf ? "text-right" : "text-left"}
                >
                  <p className="mb-1 text-xs font-medium text-gray-500">
                    {isSelf ? "You" : item.sender}
                  </p>

                  <div
                    className={`inline-block max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                      isSelf
                        ? "bg-[#2d8cff] text-white"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {item.message}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex shrink-0 gap-2 border-t border-gray-200 p-3"
      >
        <input
          type="text"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Type a message..."
          maxLength={1000}
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#2d8cff] focus:ring-2 focus:ring-blue-100"
        />

        <button
          type="submit"
          disabled={!message.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#2d8cff] text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send size={17} />
        </button>
      </form>
    </aside>
  );
}