"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Video, Link2 } from "lucide-react";

function JoinPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [meetingId, setMeetingId] = useState("");
  const [displayName, setDisplayName] = useState("Demo User");
  const [error, setError] = useState("");

  useEffect(() => {
    const meetingFromUrl = searchParams.get("meeting");

    if (meetingFromUrl) {
      setMeetingId(meetingFromUrl);
    }
  }, [searchParams]);

  function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const cleanMeetingId = meetingId.replace(/\s/g, "");
    const cleanName = displayName.trim();

    if (!/^\d{9}$/.test(cleanMeetingId)) {
      setError("Enter a valid 9-digit meeting ID.");
      return;
    }

    if (!cleanName) {
      setError("Please enter your name.");
      return;
    }

    router.push(
      `/meeting/${cleanMeetingId}?name=${encodeURIComponent(cleanName)}`
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc]">
      <header className="h-16 border-b border-gray-200 bg-white px-6 flex items-center">
        <button
          onClick={() => router.push("/")}
          className="text-2xl font-bold tracking-tight text-[#2d8cff]"
        >
          Zoom
        </button>
      </header>

      <section className="min-h-[calc(100vh-64px)] flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <div className="mb-7 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
                <Video size={28} className="text-[#2d8cff]" />
              </div>

              <h1 className="text-2xl font-semibold text-[#1f2329]">
                Join a meeting
              </h1>

              <p className="mt-2 text-sm text-gray-500">
                Enter the meeting ID and your name to join.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Meeting ID
                </label>

                <div className="relative">
                  <Link2
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={9}
                    placeholder="123 456 789"
                    value={meetingId}
                    onChange={(e) =>
                      setMeetingId(
                        e.target.value.replace(/\D/g, "").slice(0, 9)
                      )
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white py-3 pl-10 pr-4 outline-none transition focus:border-[#2d8cff] focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Your name
                </label>

                <input
                  type="text"
                  maxLength={100}
                  placeholder="Enter your name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-[#2d8cff] focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#2d8cff] py-3 font-medium text-white transition hover:bg-[#1677e8]"
              >
                Join Meeting
                <ArrowRight size={18} />
              </button>
            </form>

            <button
              onClick={() => router.push("/")}
              className="mt-5 w-full text-center text-sm text-gray-500 hover:text-gray-800"
            >
              Back to home
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#f7f9fc]">
          <p className="text-sm text-gray-500">
            Loading...
          </p>
        </main>
      }
    >
      <JoinPageContent />
    </Suspense>
  );
}