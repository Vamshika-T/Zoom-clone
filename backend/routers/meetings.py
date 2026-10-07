from fastapi import APIRouter, Depends, HTTPException, status

from sqlalchemy.orm import Session

from database import get_db
from models import User
from security import get_current_user

from schemas import (
    JoinMeetingRequest,
    JoinMeetingResponse,
    LeaveMeetingResponse,
    MeetingCreate,
    MeetingResponse,
    MeetingWithParticipantsResponse,
    ParticipantControlRequest,
    ParticipantResponse,
    ParticipantStateRequest,
)

from services.meeting_service import (
    create_meeting,
    get_active_participants,
    get_meeting_by_id,
    get_meeting_by_invite_code,
    get_participant,
    get_recent_meetings,
    get_upcoming_meetings,
    get_invite_link,
    join_meeting,
    leave_meeting,
    mute_all_participants,
    remove_participant,
    update_participant_state,
    cancel_meeting,
)


router = APIRouter(
    prefix="/api/meetings",
    tags=["Meetings"],
)


def build_meeting_response(
    meeting,
) -> MeetingResponse:

    return MeetingResponse(
        id=meeting.id,
        meeting_id=meeting.meeting_id,
        title=meeting.title,
        description=meeting.description,
        scheduled_at=meeting.scheduled_at,
        duration_minutes=meeting.duration_minutes,
        host_id=meeting.host_id,
        invite_code=meeting.invite_code,
        invite_link=get_invite_link(meeting),
        status=meeting.status,
    )


# ---------------------------------------------------------
# CREATE INSTANT MEETING
# ---------------------------------------------------------

@router.post(
    "/instant",
    response_model=MeetingResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_instant_meeting(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import datetime

    meeting_data = MeetingCreate(
        title="Instant Meeting",
        description=None,
        scheduled_at=datetime.utcnow(),
        duration_minutes=60,
    )

    meeting = create_meeting(
        db=db,
        meeting_data=meeting_data,
        host=current_user,
        status="active",
    )

    return build_meeting_response(meeting)


# ---------------------------------------------------------
# CREATE SCHEDULED MEETING
# ---------------------------------------------------------

@router.post(
    "",
    response_model=MeetingResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_new_meeting(
    meeting_data: MeetingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    meeting = create_meeting(
        db=db,
        meeting_data=meeting_data,
        host=current_user,
    )

    return build_meeting_response(meeting)


# ---------------------------------------------------------
# UPCOMING MEETINGS
# ---------------------------------------------------------

@router.get(
    "/upcoming",
    response_model=list[MeetingResponse],
)
def upcoming_meetings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    meetings = get_upcoming_meetings(
        db=db,
        host_id=current_user.id,
    )

    return [
        build_meeting_response(meeting)
        for meeting in meetings
    ]


# ---------------------------------------------------------
# RECENT MEETINGS
# ---------------------------------------------------------

@router.get(
    "/recent",
    response_model=list[MeetingResponse],
)
def recent_meetings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    meetings = get_recent_meetings(
        db=db,
        host_id=current_user.id,
    )

    return [
        build_meeting_response(meeting)
        for meeting in meetings
    ]


# ---------------------------------------------------------
# GET BY INVITE CODE
# ---------------------------------------------------------

@router.get(
    "/invite/{invite_code}",
    response_model=MeetingResponse,
)
def get_meeting_by_invite(
    invite_code: str,
    db: Session = Depends(get_db),
):
    meeting = get_meeting_by_invite_code(
        db=db,
        invite_code=invite_code,
    )

    if meeting is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid invite link",
        )

    return build_meeting_response(meeting)


# ---------------------------------------------------------
# GET MEETING
# ---------------------------------------------------------

@router.get(
    "/{meeting_id}",
    response_model=MeetingWithParticipantsResponse,
)
def get_meeting(
    meeting_id: str,
    db: Session = Depends(get_db),
):
    meeting = get_meeting_by_id(
        db=db,
        meeting_id=meeting_id,
    )

    if meeting is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found",
        )

    participants = get_active_participants(
        db=db,
        meeting=meeting,
    )

    return MeetingWithParticipantsResponse(
        meeting=build_meeting_response(meeting),
        participants=[
            ParticipantResponse.model_validate(
                participant
            )
            for participant in participants
        ],
    )


# ---------------------------------------------------------
# JOIN MEETING
# ---------------------------------------------------------

@router.post(
    "/{meeting_id}/join",
    response_model=JoinMeetingResponse,
)
def join_existing_meeting(
    meeting_id: str,
    join_data: JoinMeetingRequest,
    db: Session = Depends(get_db),
):
    meeting = get_meeting_by_id(
        db=db,
        meeting_id=meeting_id,
    )

    if meeting is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found",
        )
    if meeting.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This meeting has been cancelled.",
        )

    display_name = join_data.display_name.strip()

    if not display_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Display name cannot be empty",
        )

    participant = join_meeting(
        db=db,
        meeting=meeting,
        display_name=display_name,
    )

    return JoinMeetingResponse(
        meeting=build_meeting_response(meeting),
        participant=ParticipantResponse.model_validate(
            participant
        ),
    )


# ---------------------------------------------------------
# LIST PARTICIPANTS
# ---------------------------------------------------------

@router.get(
    "/{meeting_id}/participants",
    response_model=list[ParticipantResponse],
)
def list_participants(
    meeting_id: str,
    db: Session = Depends(get_db),
):
    meeting = get_meeting_by_id(
        db=db,
        meeting_id=meeting_id,
    )

    if meeting is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found",
        )

    participants = get_active_participants(
        db=db,
        meeting=meeting,
    )

    return [
        ParticipantResponse.model_validate(
            participant
        )
        for participant in participants
    ]


# ---------------------------------------------------------
# LEAVE MEETING
# ---------------------------------------------------------

@router.post(
    "/{meeting_id}/leave/{participant_id}",
    response_model=LeaveMeetingResponse,
)
def leave_existing_meeting(
    meeting_id: str,
    participant_id: int,
    db: Session = Depends(get_db),
):
    meeting = get_meeting_by_id(
        db=db,
        meeting_id=meeting_id,
    )

    if meeting is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found",
        )

    participant = get_participant(
        db=db,
        meeting=meeting,
        participant_id=participant_id,
    )

    if participant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Participant not found",
        )

    participant = leave_meeting(
        db=db,
        participant=participant,
    )

    return LeaveMeetingResponse(
        message="You have left the meeting",
        participant=ParticipantResponse.model_validate(
            participant
        ),
    )


# ---------------------------------------------------------
# PARTICIPANT STATE
# ---------------------------------------------------------

@router.patch(
    "/{meeting_id}/participants/{participant_id}",
    response_model=ParticipantResponse,
)
def update_participant(
    meeting_id: str,
    participant_id: int,
    state: ParticipantStateRequest,
    db: Session = Depends(get_db),
):
    meeting = get_meeting_by_id(
        db=db,
        meeting_id=meeting_id,
    )

    if meeting is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found",
        )

    participant = get_participant(
        db=db,
        meeting=meeting,
        participant_id=participant_id,
    )

    if participant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Participant not found",
        )

    participant = update_participant_state(
        db=db,
        participant=participant,
        audio_muted=state.audio_muted,
        video_enabled=state.video_enabled,
    )

    return ParticipantResponse.model_validate(
        participant
    )


# ---------------------------------------------------------
# HOST: MUTE ALL
# ---------------------------------------------------------

@router.post(
    "/{meeting_id}/host/mute-all",
    response_model=list[ParticipantResponse],
)
def host_mute_all(
    meeting_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    meeting = get_meeting_by_id(
        db=db,
        meeting_id=meeting_id,
    )

    if meeting is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found",
        )

    if meeting.host_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the meeting host can mute participants",
        )

    participants = mute_all_participants(
        db=db,
        meeting=meeting,
    )

    return [
        ParticipantResponse.model_validate(
            participant
        )
        for participant in participants
    ]


# ---------------------------------------------------------
# HOST: REMOVE PARTICIPANT
# ---------------------------------------------------------

@router.post(
    "/{meeting_id}/host/remove",
    response_model=ParticipantResponse,
)
def host_remove_participant(
    meeting_id: str,
    control: ParticipantControlRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    meeting = get_meeting_by_id(
        db=db,
        meeting_id=meeting_id,
    )

    if meeting is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found",
        )

    if meeting.host_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the meeting host can remove participants",
        )

    participant = get_participant(
        db=db,
        meeting=meeting,
        participant_id=control.participant_id,
    )

    if participant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Participant not found",
        )

    if participant.role == "host":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The host cannot be removed",
        )

    participant = remove_participant(
        db=db,
        participant=participant,
    )

    return ParticipantResponse.model_validate(
        participant
    )


# ---------------------------------------------------------
# CANCEL MEETING
# ---------------------------------------------------------

@router.post("/{meeting_id}/cancel")
def cancel_meeting_endpoint(
    meeting_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    meeting = get_meeting_by_id(
        db=db,
        meeting_id=meeting_id,
    )

    if meeting is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found",
        )

    if meeting.host_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the meeting host can cancel this meeting",
        )

    if meeting.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Meeting is already cancelled",
        )

    cancel_meeting(
        db=db,
        meeting=meeting,
    )

    return {
        "message": "Meeting cancelled successfully",
        "meeting_id": meeting.meeting_id,
        "status": meeting.status,
    }