# Zoom Clone

A full-stack video conferencing application inspired by Zoom.

## Features

### Core Features

- Zoom-style professional dashboard
- Create instant meetings
- Automatically generate unique 9-digit Meeting IDs
- Generate shareable meeting links
- Join meetings using Meeting IDs
- Join meetings using invite links
- Enter a display name before joining
- Validate meeting existence
- Schedule meetings
- Add meeting title and description
- Select date and time
- Select meeting duration
- Store meetings in the database
- Display upcoming meetings
- Display recent meetings
- Cancel scheduled meetings

### Additional Features

- User registration and login
- JWT-based authentication
- Password hashing using Argon2
- Protected dashboard
- Host authorization
- Participant list
- Multiple participants
- Camera controls
- Microphone controls
- Screen sharing
- In-meeting chat
- Host mute-all control
- Host remove-participant control
- Leave meeting
- Rejoin/reconnect support
- Camera-unavailable fallback
- Responsive UI

## Tech Stack

### Frontend

- Next.js
- React
- JavaScript
- Tailwind CSS
- Lucide React

### Backend

- Python
- FastAPI
- SQLAlchemy
- Uvicorn
- WebSockets

### Database

- SQLite

### Authentication

- JWT
- Argon2 password hashing

### Browser Technologies

- WebRTC
- Media APIs
- WebSocket communication

## Project Structure

```text
zoom clone/
│
├── frontend/
│   ├── app/
│   │   ├── join/
│   │   ├── login/
│   │   ├── meeting/
│   │   ├── schedule/
│   │   ├── signup/
│   │   └── page.js
│   │
│   ├── components/
│   │   ├── MeetingRoom.js
│   │   └── Navbar.js
│   │
│   ├── lib/
│   │   └── api.js
│   │
│   └── package.json
│
├── backend/
│   ├── routers/
│   │   ├── auth.py
│   │   └── meetings.py
│   │
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   ├── security.py
│   ├── main.py
│   └── requirements.txt
│
├── .gitignore
└── README.md
```

## Database Design

The application uses SQLite with SQLAlchemy.

### User

Stores registered user information.

- `id`
- `name`
- `email`
- `password_hash`
- `created_at`

### Meeting

Stores meeting information.

- `id`
- `meeting_id`
- `title`
- `description`
- `scheduled_at`
- `duration_minutes`
- `host_id`
- `invite_code`
- `status`

### Participant

Stores participants associated with meetings.

- Participant ID
- Meeting ID
- Display name
- Role
- Join/leave information
- Participant status

The `host_id` connects meetings to their respective users.

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd "zoom clone"
```

### 2. Backend Setup

Navigate to the backend:

```bash
cd backend
```

Create a virtual environment:

```bash
python -m venv .venv
```

Activate it on Windows:

```powershell
.venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create a `.env` file inside the backend folder:

```env
JWT_SECRET_KEY=your-secret-key
```

Start the backend:

```bash
uvicorn main:app --reload --host 0.0.0.0
```

The backend will run at:

http://127.0.0.1:8000

FastAPI documentation:

http://127.0.0.1:8000/docs

### 3. Frontend Setup

Open another terminal and navigate to the frontend:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Create `.env.local`:


NEXT_PUBLIC_API_URL=http://127.0.0.1:8000

Start the frontend:

```bash
npm run dev
```

The application will run at:

```text
http://localhost:3000
```

## How to Use

### Create an Instant Meeting

1. Log in.
2. Click **New Meeting**.
3. A unique Meeting ID is generated.
4. The user is redirected to the meeting room.
5. The generated meeting link can be shared with other participants.

### Schedule a Meeting

1. Open **Schedule Meeting**.
2. Enter the meeting title.
3. Enter the description.
4. Select the date and time.
5. Select the duration.
6. Submit the form.
7. The meeting is stored in the database.
8. The meeting appears under **Upcoming Meetings**.

### Join a Meeting

1. Click **Join Meeting**.
2. Enter the Meeting ID.
3. Enter your display name.
4. Click **Join Meeting**.
5. The backend validates that the meeting exists.
6. The participant enters the meeting room.

Participants can also join using a shared meeting link.

## Meeting Room

The meeting room provides:

- Camera on/off
- Microphone mute/unmute
- Screen sharing
- Participant list
- In-meeting chat
- Leave meeting
- Host mute-all
- Host remove participant

The application also handles situations where camera access is unavailable and allows the participant to continue with microphone/audio functionality.

## Authentication

The application includes authentication functionality.

Users can:

- Create an account
- Log in
- Log out
- Access their protected dashboard

Passwords are securely hashed using Argon2.

Authentication uses JWT access tokens.

Meeting creation and host-specific operations are authorized using the authenticated user.

## API Overview

### Authentication

```text
POST /api/auth/signup
POST /api/auth/login
GET  /api/auth/me
```

### Meetings

```text
POST /api/meetings/instant
POST /api/meetings
GET  /api/meetings/upcoming
GET  /api/meetings/recent
GET  /api/meetings/{meeting_id}
POST /api/meetings/{meeting_id}/join
POST /api/meetings/{meeting_id}/leave
POST /api/meetings/{meeting_id}/cancel
```

Additional endpoints are provided for participant and host controls.

## Assumptions

- The application is designed as a Zoom-like video conferencing system.
- SQLite is used as the default local database.
- Authentication was added as an enhancement.
- Meeting IDs are generated by the backend.
- Real-time meeting communication uses WebSocket and browser media capabilities.
- Camera and microphone functionality depends on browser permissions and device availability.
- The application is designed for demonstration and deployment rather than large-scale production use.

## Validation and Error Handling

The application handles:

- Invalid meeting IDs
- Non-existent meetings
- Invalid login credentials
- Duplicate email registration
- Missing display names
- Invalid scheduled meeting data
- Unauthorized host actions
- Camera access failures
- Participant leaving and rejoining
- Cancelled meetings
