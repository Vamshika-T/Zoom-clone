import os
import secrets
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from models import Meeting, Participant, User
from schemas import MeetingCreate


FRONTEND_URL = os.getenv(
    "FRONTEND_URL",
    "http://localhost:3000",
)


def now_utc() -> datetime:
    """
    Return the current UTC time as a naive datetime.

    SQLite stores our timestamps consistently in UTC.
    """
    return datetime.utcnow()


def generate_unique_meeting_id(db: Session) -> str:
    """
    Generate a unique 9-digit user-facing meeting ID.
    """

    while True:
        meeting_id = str(
            secrets.randbelow(900_000_000) + 100_000_000
        )

        existing = db.scalar(
            select(Meeting).where(
                Meeting.meeting_id == meeting_id
            )
        )

        if existing is None:
            return meeting_id


def generate_unique_invite_code(db: Session) -> str:
    """
    Generate a unique invite code.
    """

    while True:
        invite_code = secrets.token_urlsafe(8)

        existing = db.scalar(
            select(Meeting).where(
                Meeting.invite_code == invite_code
            )
        )

        if existing is None:
            return invite_code


def get_invite_link(meeting: Meeting) -> str:
    return (
        f"{FRONTEND_URL}/meeting/"
        f"{meeting.meeting_id}"
    )


def create_meeting(
    db: Session,
    meeting_data: MeetingCreate,
    host: User,
    status: str = "scheduled",
) -> Meeting:

    meeting = Meeting(
        meeting_id=generate_unique_meeting_id(db),
        title=meeting_data.title.strip(),
        description=(
            meeting_data.description.strip()
            if meeting_data.description
            else None
        ),
        scheduled_at=meeting_data.scheduled_at,
        duration_minutes=meeting_data.duration_minutes,
        host_id=host.id,
        invite_code=generate_unique_invite_code(db),
        status=status,
    )

    db.add(meeting)
    db.commit()
    db.refresh(meeting)

    return meeting


def get_meeting_by_id(
    db: Session,
    meeting_id: str,
) -> Meeting | None:

    return db.scalar(
        select(Meeting).where(
            Meeting.meeting_id == meeting_id
        )
    )


def get_meeting_by_invite_code(
    db: Session,
    invite_code: str,
) -> Meeting | None:

    return db.scalar(
        select(Meeting).where(
            Meeting.invite_code == invite_code
        )
    )


def get_upcoming_meetings(
    db: Session,
    host_id: int,
) -> list[Meeting]:

    return list(
        db.scalars(
            select(Meeting)
            .where(
                Meeting.host_id == host_id,
                Meeting.scheduled_at >= now_utc(),
                Meeting.status != "cancelled",
            )
            .order_by(Meeting.scheduled_at.asc())
        )
    )


def get_recent_meetings(
    db: Session,
    host_id: int,
) -> list[Meeting]:

    return list(
        db.scalars(
            select(Meeting)
            .where(
                Meeting.host_id == host_id,
                Meeting.scheduled_at < now_utc(),
            )
            .order_by(Meeting.scheduled_at.desc())
            .limit(20)
        )
    )


def join_meeting(
    db: Session,
    meeting: Meeting,
    display_name: str,
) -> Participant:

    participant = Participant(
        meeting_id=meeting.id,
        display_name=display_name.strip(),
        role="participant",
        status="joined",
        audio_muted=False,
        video_enabled=True,
    )

    db.add(participant)

    if meeting.status == "scheduled":
        meeting.status = "active"

    db.commit()
    db.refresh(participant)

    return participant


def get_active_participants(
    db: Session,
    meeting: Meeting,
) -> list[Participant]:

    return list(
        db.scalars(
            select(Participant)
            .where(
                Participant.meeting_id == meeting.id,
                Participant.status == "joined",
            )
            .order_by(Participant.joined_at.asc())
        )
    )


def leave_meeting(
    db: Session,
    participant: Participant,
) -> Participant:

    participant.status = "left"
    participant.left_at = now_utc()

    db.commit()
    db.refresh(participant)

    return participant


def get_participant(
    db: Session,
    meeting: Meeting,
    participant_id: int,
) -> Participant | None:

    return db.scalar(
        select(Participant).where(
            Participant.id == participant_id,
            Participant.meeting_id == meeting.id,
        )
    )


def update_participant_state(
    db: Session,
    participant: Participant,
    audio_muted: bool | None = None,
    video_enabled: bool | None = None,
) -> Participant:

    if audio_muted is not None:
        participant.audio_muted = audio_muted

    if video_enabled is not None:
        participant.video_enabled = video_enabled

    db.commit()
    db.refresh(participant)

    return participant


def mute_all_participants(
    db: Session,
    meeting: Meeting,
) -> list[Participant]:

    participants = get_active_participants(
        db,
        meeting,
    )

    for participant in participants:
        participant.audio_muted = True

    db.commit()

    for participant in participants:
        db.refresh(participant)

    return participants


def remove_participant(
    db: Session,
    participant: Participant,
) -> Participant:

    participant.status = "removed"
    participant.left_at = now_utc()

    db.commit()
    db.refresh(participant)

    return participant
def cancel_meeting(
    db: Session,
    meeting: Meeting,
) -> Meeting:

    meeting.status = "cancelled"

    db.commit()
    db.refresh(meeting)

    return meeting