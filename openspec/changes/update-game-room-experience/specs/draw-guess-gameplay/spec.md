## ADDED Requirements
### Requirement: Round Progress Display
During Draw and Guess gameplay, the system SHALL provide enough round and turn metadata for the client to display the current round, total rounds, and turn progress, including rooms entered through random matchmaking.

#### Scenario: Random match displays round progress
- **WHEN** a random match game is in word selection, drawing, or turn results
- **THEN** the client displays the current round and total rounds for all players

### Requirement: Configurable Game Settings
Before a Draw and Guess game starts, the host SHALL be able to configure supported game settings such as total rounds and drawing duration within server-defined bounds.

#### Scenario: Host starts game with custom settings
- **WHEN** the host configures supported settings and starts the game
- **THEN** the server uses those settings for the game session and sends the values to clients in gameplay events

### Requirement: Friend Drawing Stroke Consistency
Friend drawing synchronization SHALL render the same drawing actions for all participants in the room, including stroke start, stroke movement, stroke end, undo, redo, clear, and layer-affecting actions that are supported by the client.

#### Scenario: Remote participant sees matching stroke
- **WHEN** one participant draws a stroke in a friend drawing room
- **THEN** the other participant renders the same stroke with the same color, size, opacity, and coordinates

#### Scenario: Remote participant receives clear or undo
- **WHEN** one participant clears or undoes drawing content in a friend drawing room
- **THEN** the other participant applies the corresponding action instead of leaving a mismatched canvas
