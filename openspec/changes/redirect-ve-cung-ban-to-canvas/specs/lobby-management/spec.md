## ADDED Requirements
### Requirement: VeCungBan Transition to Collaborative Drawing Board
When a host of a 'VeCungBan' lobby starts the game, the system SHALL transition all players in the room to the collaborative drawing board ('BangVe') instead of Gartic Phone. Nét vẽ (points X, Y, and brushes) of each player SHALL be synchronized in real-time to all other players in the room.

#### Scenario: Host starts drawing session
- **WHEN** the host in a 'VeCungBan' lobby starts the game
- **THEN** the server notifies the room group with 'BatDauVeChung', and all clients transition to the 'BangVe' component with the room code and connection
