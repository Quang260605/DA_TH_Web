## ADDED Requirements
### Requirement: Game Start and Queue Initialization
When the room host starts the game, the system SHALL transition the room to the Draw & Guess gameplay mode. The system SHALL calculate the queue order of drawers based on the timestamp when they joined the room (oldest first). A game session SHALL run for a maximum of 4 rounds, where a round ends after all players in the queue have taken a turn as the drawer.

#### Scenario: Host starts Draw and Guess game
- **WHEN** the host starts the game in a waiting lobby
- **THEN** the server initializes a new game session with a maximum of 4 rounds, sorts the players by join time, and starts the first turn with the first player in the queue

### Requirement: Word Selection Phase
At the beginning of each turn, the selected drawer SHALL be presented with a choice of 3 random words and have 15 seconds to select one. If the drawer makes a selection, or if the 15-second timer expires, the turn SHALL transition to the Drawing Phase with the selected or automatically selected word. Non-drawers SHALL be notified that the drawer is choosing a word.

#### Scenario: Drawer selects a word
- **WHEN** the drawer selects one of the 3 words within 15 seconds
- **THEN** the server transitions the turn to the Drawing Phase using that chosen word

#### Scenario: Word selection timer expires
- **WHEN** the 15-second word selection timer expires without drawer selection
- **THEN** the server automatically selects the first word and transitions the turn to the Drawing Phase

### Requirement: Simplified Drawing Board
During the Drawing Phase, the drawer SHALL draw on a simplified canvas with basic tools (color selection, brush size, undo last stroke, and clear canvas). The brush coordinates and actions SHALL be synchronized to the other players in the room in real-time. Guessers' canvases SHALL be read-only and render the drawer's brush strokes in real-time.

#### Scenario: Drawer draws strokes on canvas
- **WHEN** the drawer draws lines or triggers undo/clear on their simplified canvas
- **THEN** the actions are sent via SignalR to other players in the room and rendered on their read-only canvases in real-time

### Requirement: Guessing and scoring
Guessers SHALL be able to submit guesses in a guess chat box. If a guess matches the target word (case-insensitive and trimmed), they SHALL be marked as having guessed correctly, receive points, and the drawer SHALL receive a point bonus. Correct guesses SHALL be hidden from other players, showing only a notification of correct guess, whereas incorrect guesses SHALL be displayed publicly in the chat. The Drawing Phase SHALL end early if all guessers guess correctly.

#### Scenario: Guesser guesses word correctly
- **WHEN** a guesser submits a text guess that matches the target word
- **THEN** they get points, the drawer gets a point bonus, their correct guess is hidden from other players, and they are notified of correctness

#### Scenario: Turn ends early when all guessers guess correctly
- **WHEN** the last remaining guesser guesses the word correctly
- **THEN** the server ends the drawing phase immediately and transitions to the turn results

### Requirement: Turn Results and Leaderboard
When a turn ends (either by timer expiration or all guessers guessing correctly), the correct word SHALL be revealed to all players. The system SHALL show the turn results with scores earned and the updated leaderboard for 5 seconds before starting the next turn or ending the game.

#### Scenario: Show results at the end of a turn
- **WHEN** the drawing timer expires
- **THEN** the correct word is revealed, the turn results and leaderboard are displayed, and a 5-second transition timer starts

### Requirement: Game Conclusion
After all rounds (maximum of 4 rounds) are completed, the system SHALL end the game session, transition to a final podium screen showing the final rankings of all players, and allow them to return to the room lobby.

#### Scenario: Game session finishes after 4 rounds
- **WHEN** the final turn of the 4th round is completed
- **THEN** the game session ends, the final podium screen is displayed, and the room status is updated to completed
