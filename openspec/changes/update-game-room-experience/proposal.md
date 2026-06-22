# Change: Update game room experience

## Why
The current game room flow is fragile when users need to join by code, recover an active room after accidental navigation/refresh, or understand the room/game state during random matching and friend drawing.

## What Changes
- Add a room-code join flow in the game screen.
- Add host-facing room settings for game flow before start.
- Show round/progress information during random match gameplay.
- Show who is drawing together when using the friend drawing flow.
- Preserve the active room locally so accidental navigation, refresh, or UI focus mistakes can re-enter the room instead of losing it.
- Improve real-time friend drawing stroke sync so both sides render the same drawing actions consistently.

## Impact
- Affected specs: `lobby-management`, `draw-guess-gameplay`
- Affected code: `DA_Web/Hubs/GameHub.cs`, `DA_Web_Client/src/components/TroChoi/TroChoiTamSaoThatBan.tsx`, and only the minimum game-entry wiring required for active-room recovery.
- Non-goals: authentication, lesson/AI grading, standalone drawing save/load behavior, social leaderboard behavior.
