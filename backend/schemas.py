from datetime import datetime

from pydantic import BaseModel, Field


class MeetingCreate(BaseModel):
    title: str = Field(
        min_length=1,
        max_length=200,
    )

    description: str | None = Field(
        default=None,
        max_length=2000,
    )

    scheduled_at: datetime

    duration_minutes: int = Field(
        gt=0,
        le=1440,
    )


class MeetingResponse(BaseModel):
    id: int
    meeting_id: str
    title: str
    description: str | None
    scheduled_at: datetime
    duration_minutes: int
    host_id: int
    invite_code: str
    invite_link: str
    status: str

    model_config = {
        "from_attributes": True,
    }


class ParticipantResponse(BaseModel):
    id: int
    meeting_id: int
    display_name: str
    role: str
    joined_at: datetime
    left_at: datetime | None
    status: str
    audio_muted: bool
    video_enabled: bool

    model_config = {
        "from_attributes": True,
    }


class JoinMeetingRequest(BaseModel):
    display_name: str = Field(
        min_length=1,
        max_length=100,
    )


class JoinMeetingResponse(BaseModel):
    meeting: MeetingResponse
    participant: ParticipantResponse


class LeaveMeetingResponse(BaseModel):
    message: str
    participant: ParticipantResponse


class ParticipantControlRequest(BaseModel):
    participant_id: int


class ParticipantStateRequest(BaseModel):
    audio_muted: bool | None = None
    video_enabled: bool | None = None


class MeetingWithParticipantsResponse(BaseModel):
    meeting: MeetingResponse
    participants: list[ParticipantResponse]

class SignupRequest(BaseModel):
    name: str = Field(
        min_length=1,
        max_length=100,
    )
    email: str = Field(
        min_length=3,
        max_length=255,
    )
    password: str = Field(
        min_length=8,
        max_length=128,
    )


class LoginRequest(BaseModel):
    email: str = Field(
        min_length=3,
        max_length=255,
    )
    password: str


class UserResponse(BaseModel):
    id: int
    name: str
    email: str

    model_config = {
        "from_attributes": True,
    }


class AuthResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse