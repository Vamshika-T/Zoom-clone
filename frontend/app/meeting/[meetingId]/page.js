"use client";

import { use } from "react";
import MeetingRoom from "../../../components/MeetingRoom";

export default function MeetingPage({ params }) {
  const { meetingId } = use(params);

  return <MeetingRoom meetingId={meetingId} />;
}