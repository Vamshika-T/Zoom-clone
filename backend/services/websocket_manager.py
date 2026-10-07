from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.rooms: dict[str, list[WebSocket]] = defaultdict(list)
        self.participants: dict[str, dict[int, WebSocket]] = defaultdict(dict)

    async def connect(self, meeting_id: str, websocket: WebSocket):
        await websocket.accept()
        self.rooms[meeting_id].append(websocket)

    def register_participant(
        self,
        meeting_id: str,
        participant_id: int,
        websocket: WebSocket,
    ):
        self.participants[meeting_id][participant_id] = websocket

    def unregister_participant(
        self,
        meeting_id: str,
        participant_id: int | None,
        websocket: WebSocket,
    ) -> bool:
        """
        Remove a participant connection only if this websocket is
        still the participant's active websocket.

        Returns True if this websocket was the active connection.
        Returns False if the participant has already reconnected
        through a newer websocket.
        """
        was_active_connection = False

        if participant_id is not None:
            room_participants = self.participants.get(meeting_id)

            if room_participants:
                if room_participants.get(participant_id) is websocket:
                    del room_participants[participant_id]
                    was_active_connection = True

                if not room_participants:
                    del self.participants[meeting_id]

        self.disconnect(meeting_id, websocket)

        return was_active_connection

    def disconnect(self, meeting_id: str, websocket: WebSocket):
        connections = self.rooms.get(meeting_id)

        if not connections:
            return

        if websocket in connections:
            connections.remove(websocket)

        if not connections:
            del self.rooms[meeting_id]

    async def send_to_participant(
        self,
        meeting_id: str,
        participant_id: int,
        message: dict,
    ) -> bool:
        websocket = self.participants.get(meeting_id, {}).get(participant_id)

        if websocket is None:
            return False

        try:
            await websocket.send_json(message)
            return True
        except Exception:
            self.unregister_participant(
                meeting_id,
                participant_id,
                websocket,
            )
            return False

    async def broadcast(
        self,
        meeting_id: str,
        message: dict,
        exclude: WebSocket | None = None,
    ):
        connections = list(self.rooms.get(meeting_id, []))

        for connection in connections:
            if connection is exclude:
                continue

            try:
                await connection.send_json(message)
            except Exception:
                self.disconnect(meeting_id, connection)


manager = ConnectionManager()