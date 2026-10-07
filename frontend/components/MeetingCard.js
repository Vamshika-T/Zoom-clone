"use client";

import Link from "next/link";
import {
  CalendarDays,
  Clock3,
  Video,
} from "lucide-react";

function formatDate(value) {
  return new Date(value).toLocaleDateString(
    "en-IN",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString(
    "en-IN",
    {
      hour: "numeric",
      minute: "2-digit",
    }
  );
}

export default function MeetingCard({
  meeting,
  recent = false,
  onCancel,
}) {
  return (
    <div className="group rounded-xl border border-gray-200 bg-white p-5 transition hover:border-gray-300 hover:shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#2D8CFF]">
            <Video size={21} />
          </div>

          <div className="min-w-0">
            <h3 className="truncate font-semibold text-gray-900">
              {meeting.title}
            </h3>

            {meeting.description && (
              <p className="mt-1 truncate text-sm text-gray-500">
                {meeting.description}
              </p>
            )}

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <CalendarDays size={14} />
                {formatDate(meeting.scheduled_at)}
              </span>

              <span className="flex items-center gap-1">
                <Clock3 size={14} />
                {formatTime(meeting.scheduled_at)}
              </span>

              <span>
                {meeting.duration_minutes} min
              </span>
            </div>
          </div>
        </div>

        {!recent && (
  <div className="flex shrink-0 gap-2">
    <Link
      href={`/meeting/${meeting.meeting_id}?host=true`}
      className="rounded-lg bg-[#2D8CFF] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0b5cff]"
    >
      Join
    </Link>

    <button
      type="button"
      onClick={() => onCancel?.(meeting)}
      className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
    >
      Cancel
    </button>
  </div>
)}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
        <span className="text-xs text-gray-500">
          Meeting ID: {meeting.meeting_id}
        </span>

        <span
          className={`text-xs font-medium ${
            meeting.status === "active"
              ? "text-green-600"
              : "text-gray-500"
          }`}
        >
          {meeting.status === "active"
            ? "Live"
            : recent
              ? "Completed"
              : "Scheduled"}
        </span>
      </div>
    </div>
  );
}