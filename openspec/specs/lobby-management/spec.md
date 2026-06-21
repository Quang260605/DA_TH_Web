# Capability: Lobby Management

## Purpose
This capability defines how game room lobbies are created, joined, exited, and managed by the host. It ensures correct real-time synchronization of room members, roles, and status changes.
## Requirements
### Requirement: Room Creation
The system SHALL allow a user to create a new game room of type 'TroChoiMini' or 'VeCungBan'. The creator becomes the host (Chủ phòng). For 'TroChoiMini' and 'GhepNgauNhien' rooms, the player limit SHALL be 12. For 'VeCungBan' rooms, the player limit SHALL be 2.

#### Scenario: Success room creation
- **WHEN** a user initiates room creation
- **THEN** a unique room code is generated, the room is created in the database, and the user is set as the host (Chủ phòng)

### Requirement: Room Joining
Users SHALL be able to join an active room either by entering a specific room code or via random matchmaking ('GhepNgauNhien'), provided the room has not reached its player limit.

#### Scenario: Join room by code
- **WHEN** a user inputs a valid room code and submits
- **THEN** they are added to the room database, placed in the SignalR room group, and other players in the room receive a real-time list update

#### Scenario: Join room by random match
- **WHEN** a user requests random matching
- **THEN** they are added to the first available open random match room, or a new random match room is created if none exists

### Requirement: Active Room Exit
When a user decides to leave a room (by clicking the "Thoát phòng" button), they SHALL be removed from the room, and all other players in the room MUST see the player list and player count update immediately.

#### Scenario: Active room exit by client invocation
- **WHEN** a user clicks "Thoát phòng" in the lobby
- **THEN** the client invokes 'ThoatPhong' on SignalR, the user is removed from the database room, removed from the SignalR room group, and remaining players in the room receive the update in real-time

---

### Requirement: Host Status and Transfer
The room creator (host) is indicated in the user list. If the host leaves, the system SHALL transfer host status to the next oldest member in the room. If no players remain, the room state is updated to 'DaKetThuc'.

#### Scenario: Host leaves, transfer authority
- **WHEN** the host leaves the room
- **THEN** the host status is transferred to another player in the room, and all remaining players receive a notification of the new host

---

### Requirement: Host Kick Player
The host of the room SHALL have the authority to kick any player from the room. Kicked players are returned to the main lobby, and their names are removed from the room player list.

#### Scenario: Host kicks a player
- **WHEN** the host clicks "Kick" on a player in the lobby list
- **THEN** the server removes the kicked player from the room database, removes them from the SignalR group, and notifies both the kicked player and remaining players

### Requirement: Room Lock and Unlock Toggle
The host of a game room SHALL be able to lock or unlock the room. Locking a room changes its type from public ('GhepNgauNhien') to private ('TroChoiMini' or 'VeCungBan'), preventing new players from joining via random matchmaking. Unlocking a room changes its type to public ('GhepNgauNhien'), allowing random players to join. This change SHALL be synchronized in real-time to all players in the room.

#### Scenario: Host locks a public room
- **WHEN** the host toggles lock on an open 'GhepNgauNhien' room
- **THEN** the room type changes to 'TroChoiMini' (or 'VeCungBan' if maximum player limit is <= 2), and all players in the room receive a real-time update reflecting that the room is private

#### Scenario: Host unlocks a private room
- **WHEN** the host toggles unlock on a private room ('TroChoiMini' or 'VeCungBan')
- **THEN** the room type changes to 'GhepNgauNhien', and all players in the room receive a real-time update reflecting that the room is public

