import os
from datetime import datetime, timedelta
from security import hash_password
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import Base, SessionLocal, engine
from models import Meeting, User
from routers.meetings import router as meetings_router
from routers.auth import router as auth_router
from routers.websocket import router as websocket_router
from services.meeting_service import (
    generate_unique_invite_code,
    generate_unique_meeting_id,
)


app = FastAPI(
    title="Zoom Clone API",
    description="Backend API for a Zoom-like video conferencing platform.",
    version="1.0.0",
)


# ---------------------------------------------------------
# CORS
# ---------------------------------------------------------

FRONTEND_URL = os.getenv("FRONTEND_URL")

allow_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://zoom-clone-pearl-iota.vercel.app",

]

if FRONTEND_URL:
    allow_origins.append(FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------
# DATABASE
# ---------------------------------------------------------

Base.metadata.create_all(bind=engine)


# ---------------------------------------------------------
# SEED DATA
# ---------------------------------------------------------

def seed_database():
    db = SessionLocal()

    try:
        user = db.get(User, 1)

        if user is None:
            user = User(
                id=1,
                name="Demo User",
                email="demo@example.com",
                password_hash=hash_password("Demo@12345"),
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        elif not user.password_hash:
            user.password_hash = hash_password(
                "Demo@12345"
            )
            db.commit()
            db.refresh(user)

        existing_meeting = db.query(Meeting).first()

        if existing_meeting is None:
            now = datetime.utcnow()

            upcoming_meeting = Meeting(
                meeting_id=generate_unique_meeting_id(db),
                title="Project Standup",
                description="Daily project standup meeting",
                scheduled_at=now + timedelta(days=1),
                duration_minutes=30,
                host_id=user.id,
                invite_code=generate_unique_invite_code(db),
                status="scheduled",
            )

            recent_meeting = Meeting(
                meeting_id=generate_unique_meeting_id(db),
                title="Previous Team Meeting",
                description="Previous project discussion",
                scheduled_at=now - timedelta(days=1),
                duration_minutes=60,
                host_id=user.id,
                invite_code=generate_unique_invite_code(db),
                status="ended",
            )

            db.add_all(
                [
                    upcoming_meeting,
                    recent_meeting,
                ]
            )

            db.commit()

    finally:
        db.close()


seed_database()


# ---------------------------------------------------------
# ROUTERS
# ---------------------------------------------------------

app.include_router(meetings_router)
app.include_router(auth_router)
app.include_router(websocket_router)


# ---------------------------------------------------------
# BASIC ENDPOINTS
# ---------------------------------------------------------

@app.get("/")
def root():
    return {
        "message": "Zoom Clone API is running"
    }


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy"
    }