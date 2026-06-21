## MODIFIED Requirements

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
