"use client";

import {
  CalendarPlus,
  Link2,
  Video,
} from "lucide-react";
import Link from "next/link";

export default function MeetingActions({
  onInstantMeeting,
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <button
        onClick={onInstantMeeting}
        className="group rounded-xl bg-[#2D8CFF] p-6 text-left text-white shadow-sm transition hover:bg-[#0b5cff] hover:shadow-md"
      >
        <div className="mb-8 flex h-11 w-11 items-center justify-center rounded-lg bg-white/15">
          <Video size={22} />
        </div>

        <p className="text-lg font-semibold">
          New Meeting
        </p>

        <p className="mt-1 text-sm text-blue-100">
          Start an instant meeting
        </p>
      </button>

      <Link
        href="/join"
        className="group rounded-xl border border-gray-200 bg-white p-6 text-left transition hover:border-gray-300 hover:shadow-md"
      >
        <div className="mb-8 flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-[#2D8CFF]">
          <Link2 size={22} />
        </div>

        <p className="text-lg font-semibold">
          Join Meeting
        </p>

        <p className="mt-1 text-sm text-gray-500">
          Join using a meeting ID
        </p>
      </Link>

      <Link
        href="/schedule"
        className="group rounded-xl border border-gray-200 bg-white p-6 text-left transition hover:border-gray-300 hover:shadow-md"
      >
        <div className="mb-8 flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-[#2D8CFF]">
          <CalendarPlus size={22} />
        </div>

        <p className="text-lg font-semibold">
          Schedule
        </p>

        <p className="mt-1 text-sm text-gray-500">
          Plan a meeting for later
        </p>
      </Link>
    </div>
  );
}