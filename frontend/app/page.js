"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

import Navbar from "../components/Navbar";
import MeetingActions from "../components/MeetingActions";
import MeetingCard from "../components/MeetingCard";
import {
  createInstantMeeting,
  getRecentMeetings,
  getUpcomingMeetings,
  cancelMeeting,
} from "../lib/api";

export default function Home() {
  const router = useRouter();

  const [upcoming, setUpcoming] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      router.replace("/login");
      return;
    }

    const storedUser = localStorage.getItem("auth_user");

    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser));
    }
  }, [router]);

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");

      const [upcomingData, recentData] =
        await Promise.all([
          getUpcomingMeetings(),
          getRecentMeetings(),
        ]);

      setUpcoming(upcomingData);
      setRecent(recentData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleInstantMeeting() {
    try {
      setCreating(true);
      setError("");

      const meeting =
        await createInstantMeeting();

      router.push(
        `/meeting/${meeting.meeting_id}?host=true`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleCancelMeeting(meeting) {
    const confirmed = window.confirm(
      `Cancel "${meeting.title}"?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");

      await cancelMeeting(meeting.meeting_id);

      await loadDashboard();
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    const token = localStorage.getItem("access_token");

    if (token) {
      loadDashboard();
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#F7F9FC]">
      <Navbar />

      <main className="mx-auto max-w-[1200px] px-5 py-10 sm:px-8">
        <section className="mb-10">
          <p className="text-sm font-medium text-[#2D8CFF]">
            Home
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
            Good evening,{" "}
            {currentUser?.name || "User"}
          </h1>

          <p className="mt-2 text-gray-500">
            Start a meeting, join an existing one, or
            schedule your next session.
          </p>
        </section>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="mb-12">
          <MeetingActions
            onInstantMeeting={handleInstantMeeting}
          />

          {creating && (
            <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
              <Loader2
                size={16}
                className="animate-spin"
              />
              Creating your meeting...
            </div>
          )}
        </section>

        <section className="mb-12">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                Upcoming Meetings
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Meetings scheduled for you.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
              Loading meetings...
            </div>
          ) : upcoming.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
              <p className="font-medium">
                No upcoming meetings
              </p>

              <p className="mt-1 text-sm text-gray-500">
                Schedule a meeting to see it here.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {upcoming.map((meeting) => (
                <MeetingCard
                  key={meeting.id}
                  meeting={meeting}
                  onCancel={handleCancelMeeting}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                Recent Meetings
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Your recently completed or active meetings.
              </p>
            </div>

            <button className="hidden items-center gap-1 text-sm font-medium text-[#2D8CFF] sm:flex">
              View all
              <ArrowRight size={15} />
            </button>
          </div>

          {loading ? (
            <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
              Loading meetings...
            </div>
          ) : recent.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
              <p className="font-medium">
                No recent meetings
              </p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {recent.map((meeting) => (
                <MeetingCard
                  key={meeting.id}
                  meeting={meeting}
                  recent
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}