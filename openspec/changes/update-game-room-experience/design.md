## Context
The app uses SignalR for lobby, draw-and-guess gameplay, and friend drawing sessions. Current room state exists mostly in memory/client state, so accidental navigation or refresh can orphan the user from the visible room UI even while the backend still has an active lobby entry.

## Goals / Non-Goals
- Goals: make room entry/re-entry reliable, make gameplay settings visible, show round progress, and improve friend drawing synchronization.
- Non-Goals: change account auth, lesson drawing, AI grading, leaderboard scoring rules outside game, or saved drawing management.

## Decisions
- Store an active-room resume record in browser localStorage with userId, room code, room type, and timestamp. This avoids database schema changes and keeps the change limited to game UX.
- Host settings will be sent through SignalR before game start and stored in the in-memory active game state/session values used by the hub.
- Round progress will be included in existing gameplay events so the client can display round and turn context without polling.
- Friend drawing sync will use structured stroke/action messages with stable layer/action metadata where possible, keeping the fix inside the existing game/drawing realtime path.

## Risks / Trade-offs
- LocalStorage recovery is per browser and not a true server-side session browser sync. This is acceptable for accidental refresh/navigation recovery.
- Existing rooms that ended on the server may still appear locally until rejoin fails; the client should clear stale resume data when the server rejects the room.

## Migration Plan
No database migration is planned. Existing rooms and game sessions continue to use current tables.
