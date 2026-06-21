# Change: Update lobby max players to 12

## Why
To allow larger multiplayer game sessions, the maximum number of players allowed in a single mini-game ('TroChoiMini') or random matchmaking ('GhepNgauNhien') room needs to be increased from 8 to 12.

## What Changes
- Set the maximum player limit for 'TroChoiMini' and 'GhepNgauNhien' rooms to 12.
- Set the maximum player limit when opening a private room to public community matchmaking to 12.

## Impact
- Affected specs: `lobby-management`
- Affected code: `Hubs/GameHub.cs`
