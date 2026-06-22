## ADDED Requirements
### Requirement: Room Code Entry
Users SHALL be able to enter a room code from the game screen and join the active room when the room exists, is waiting, and has capacity.

#### Scenario: User joins by code from game screen
- **WHEN** a user enters a valid waiting room code and submits it
- **THEN** the user is added to the room, the game screen shows the room lobby, and all room members receive the updated player list

#### Scenario: User enters invalid code
- **WHEN** a user submits an invalid, ended, started, or full room code
- **THEN** the system shows the room error and does not replace the user's current active room

### Requirement: Active Room Recovery
The client SHALL preserve the user's active room locally while the room is waiting or playing, and SHALL offer a visible re-entry action when the user returns to the game screen after accidental navigation, refresh, or UI focus mistakes.

#### Scenario: User returns after accidental navigation
- **WHEN** a user has a locally saved active room and opens the game screen
- **THEN** the game screen displays a resume action with the room code and room type

#### Scenario: User resumes active room
- **WHEN** a user clicks the resume action for a waiting room
- **THEN** the client rejoins the room by code and restores the lobby UI

#### Scenario: Saved room is stale
- **WHEN** the server rejects the locally saved room as missing, full, started, or ended
- **THEN** the client clears the saved room and shows the normal game entry options

### Requirement: Friend Drawing Participants
When users use the friend drawing room flow, the lobby or drawing entry UI SHALL show the visible participants so users know who they are drawing with.

#### Scenario: Friend drawing room displays participants
- **WHEN** a user is in a `VeCungBan` room with another participant
- **THEN** the UI displays the participants in that room before or during the friend drawing session

## MODIFIED Requirements
### Requirement: Room Creation
The system SHALL allow a user to create a new game room of type 'TroChoiMini' or 'VeCungBan'. The creator becomes the host (Chá»§ phÃ²ng). For 'TroChoiMini' and 'GhepNgauNhien' rooms, the player limit SHALL be 12. For 'VeCungBan' rooms, the player limit SHALL be 2. The room creator SHALL be able to configure supported lobby settings before gameplay starts.

#### Scenario: Success room creation
- **WHEN** a user initiates room creation
- **THEN** a unique room code is generated, the room is created in the database, and the user is set as the host (Chá»§ phÃ²ng)

#### Scenario: Host updates lobby settings
- **WHEN** the host changes supported game settings before the game starts
- **THEN** the settings are stored for the room and synchronized to all lobby participants
