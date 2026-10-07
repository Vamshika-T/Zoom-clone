const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

async function request(endpoint, options = {}) {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("access_token")
      : null;

  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.detail || "Something went wrong"
    );
  }

  return data;
}

export function getUpcomingMeetings() {
  return request("/api/meetings/upcoming");
}

export function getRecentMeetings() {
  return request("/api/meetings/recent");
}

export function createInstantMeeting() {
  return request("/api/meetings/instant", {
    method: "POST",
  });
}

export function createMeeting(data) {
  return request("/api/meetings", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getMeeting(meetingId) {
  return request(`/api/meetings/${meetingId}`);
}

export function joinMeeting(meetingId, displayName) {
  return request(`/api/meetings/${meetingId}/join`, {
    method: "POST",
    body: JSON.stringify({
      display_name: displayName,
    }),
  });
}

export function getParticipants(meetingId) {
  return request(`/api/meetings/${meetingId}/participants`);
}

export function leaveMeeting(meetingId, participantId) {
  return request(
    `/api/meetings/${meetingId}/leave/${participantId}`,
    {
      method: "POST",
    }
  );
}

export function updateParticipant(
  meetingId,
  participantId,
  state
) {
  return request(
    `/api/meetings/${meetingId}/participants/${participantId}`,
    {
      method: "PATCH",
      body: JSON.stringify(state),
    }
  );
}

export function muteAll(meetingId) {
  return request(
    `/api/meetings/${meetingId}/host/mute-all`,
    {
      method: "POST",
    }
  );
}

export function removeParticipant(
  meetingId,
  participantId
) {
  return request(
    `/api/meetings/${meetingId}/host/remove`,
    {
      method: "POST",
      body: JSON.stringify({
        participant_id: participantId,
      }),
    }
  );
}
export function cancelMeeting(meetingId) {
  return request(
    `/api/meetings/${meetingId}/cancel`,
    {
      method: "POST",
    }
  );
}
export async function signup(data) {
  const response = await request(
    "/api/auth/signup",
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );

  localStorage.setItem(
    "access_token",
    response.access_token
  );

  localStorage.setItem(
    "auth_user",
    JSON.stringify(response.user)
  );

  return response;
}

export async function login(data) {
  const response = await request(
    "/api/auth/login",
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );

  localStorage.setItem(
    "access_token",
    response.access_token
  );

  localStorage.setItem(
    "auth_user",
    JSON.stringify(response.user)
  );

  return response;
}

export function logout() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("auth_user");
}

export function getStoredUser() {
  if (typeof window === "undefined") {
    return null;
  }

  const user = localStorage.getItem("auth_user");

  return user ? JSON.parse(user) : null;
}