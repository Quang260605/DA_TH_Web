## 1. Specification
- [ ] 1.1 Review current lobby and draw-guess specs.
- [ ] 1.2 Define room-code join, settings, round display, room recovery, and friend drawing sync requirements.

## 2. Backend
- [ ] 2.1 Add SignalR support for applying host game settings before start.
- [ ] 2.2 Include round/turn progress metadata in gameplay events.
- [ ] 2.3 Ensure joining by code and recovery paths return enough room data for the client to restore UI.

## 3. Frontend
- [ ] 3.1 Add room-code input on the game screen.
- [ ] 3.2 Add a settings panel in the lobby for host-controlled game settings.
- [ ] 3.3 Display round/turn progress during random match gameplay.
- [ ] 3.4 Persist and show an active-room resume entry after accidental navigation or refresh.
- [ ] 3.5 Show who is in the friend drawing session.
- [ ] 3.6 Fix friend drawing synchronization rendering mismatches.

## 4. Verification
- [ ] 4.1 Build backend.
- [ ] 4.2 Build frontend.
- [ ] 4.3 Manually verify two-account room join, random match round display, friend drawing sync, and refresh/re-entry.
