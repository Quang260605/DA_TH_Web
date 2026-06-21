## ADDED Requirements
### Requirement: Room Lock and Unlock Toggle
The host of a game room SHALL be able to lock or unlock the room. Locking a room changes its type from public ('GhepNgauNhien') to private ('TroChoiMini' or 'VeCungBan'), preventing new players from joining via random matchmaking. Unlocking a room changes its type to public ('GhepNgauNhien'), allowing random players to join. This change SHALL be synchronized in real-time to all players in the room.

#### Scenario: Host locks a public room
- **WHEN** the host toggles lock on an open 'GhepNgauNhien' room
- **THEN** the room type changes to 'TroChoiMini' (or 'VeCungBan' if maximum player limit is <= 2), and all players in the room receive a real-time update reflecting that the room is private

#### Scenario: Host unlocks a private room
- **WHEN** the host toggles unlock on a private room ('TroChoiMini' or 'VeCungBan')
- **THEN** the room type changes to 'GhepNgauNhien', and all players in the room receive a real-time update reflecting that the room is public
