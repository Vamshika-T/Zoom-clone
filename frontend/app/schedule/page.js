"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Clock, ArrowLeft, CheckCircle2 } from "lucide-react";
import { createMeeting } from "../../lib/api";

export default function SchedulePage() {
  const router = useRouter();

  const [form, setForm] = useState({
    title: "",
    description: "",
    date: "",
    time: "",
    duration: "30",
  });

  const [loading, setLoading] = useState(false);
  const [createdMeeting, setCreatedMeeting] = useState(null);
  const [error, setError] = useState("");

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!form.title.trim()) {
      setError("Please enter a meeting title.");
      return;
    }

    if (!form.date || !form.time) {
      setError("Please select a date and time.");
      return;
    }

    try {
      setLoading(true);

      const scheduledAt = `${form.date}T${form.time}:00`;

      const meeting = await createMeeting({
        title: form.title.trim(),
        description: form.description.trim() || null,
        scheduled_at: scheduledAt,
        duration_minutes: Number(form.duration),
      });

      setCreatedMeeting(meeting);
    } catch (err) {
      setError(err.message || "Unable to schedule meeting.");
    } finally {
      setLoading(false);
    }
  }

  if (createdMeeting) {
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
          <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
              <CheckCircle2 size={34} className="text-green-600" />
            </div>

            <h1 className="text-2xl font-semibold text-[#1f2329]">
              Meeting scheduled
            </h1>

            <p className="mt-2 text-gray-500">
              Your meeting has been created successfully.
            </p>

            <div className="mt-6 rounded-xl bg-gray-50 p-5 text-left">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Meeting title
              </p>

              <p className="mt-1 font-medium text-gray-900">
                {createdMeeting.title}
              </p>

              <p className="mt-4 text-xs font-medium uppercase tracking-wide text-gray-400">
                Meeting ID
              </p>

              <p className="mt-1 font-mono text-lg font-semibold text-[#2d8cff]">
                {createdMeeting.meeting_id}
              </p>

              <p className="mt-4 text-xs font-medium uppercase tracking-wide text-gray-400">
                Invite link
              </p>

              <p className="mt-1 break-all text-sm text-gray-600">
                {createdMeeting.invite_link}
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => router.push("/")}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-3 font-medium text-gray-700 hover:bg-gray-50"
              >
                Back Home
              </button>

              <button
                onClick={() =>
                  router.push(
                    `/meeting/${createdMeeting.meeting_id}?host=true`
                  )
                }
                className="flex-1 rounded-lg bg-[#2d8cff] px-4 py-3 font-medium text-white hover:bg-[#1677e8]"
              >
                Start Meeting
              </button>
            </div>
          </div>
        </section>
      </main>
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

      <section className="mx-auto max-w-3xl px-6 py-10">
        <button
          onClick={() => router.push("/")}
          className="mb-6 flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft size={17} />
          Back to home
        </button>

        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="mb-8">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
              <CalendarDays size={25} className="text-[#2d8cff]" />
            </div>

            <h1 className="text-2xl font-semibold text-[#1f2329]">
              Schedule a meeting
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Set up your meeting details and share the generated invite link.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Meeting title
              </label>

              <input
                type="text"
                maxLength={200}
                placeholder="e.g. Weekly Project Standup"
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-[#2d8cff] focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Description
              </label>

              <textarea
                rows={4}
                maxLength={2000}
                placeholder="Add a short description or agenda..."
                value={form.description}
                onChange={(e) =>
                  updateField("description", e.target.value)
                }
                className="w-full resize-none rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-[#2d8cff] focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Date
                </label>

                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => updateField("date", e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-[#2d8cff] focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Time
                </label>

                <input
                  type="time"
                  value={form.time}
                  onChange={(e) => updateField("time", e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-[#2d8cff] focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                <Clock size={16} />
                Duration
              </label>

              <select
                value={form.duration}
                onChange={(e) => updateField("duration", e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-[#2d8cff] focus:ring-2 focus:ring-blue-100"
              >
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">1 hour</option>
                <option value="90">1 hour 30 minutes</option>
                <option value="120">2 hours</option>
              </select>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#2d8cff] px-4 py-3 font-medium text-white transition hover:bg-[#1677e8] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Scheduling..." : "Schedule Meeting"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}