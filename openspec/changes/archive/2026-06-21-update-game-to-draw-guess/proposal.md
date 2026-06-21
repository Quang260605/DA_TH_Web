# Change: Redesign multiplayer game mode to Draw and Guess

## Why
Currently, the "Trò chơi" tab implements a Chinese Whispers/Gartic Phone style whisper chain. The user wants the game mode to behave like a classic turn-based Draw & Guess game (such as Gartic.io) with 3 word choices for the drawer, player rotation order determined by the joining time, a maximum of 4 rounds, and a simplified drawing canvas (equipped with color palette, brush size, undo, and clear).

## What Changes
- **Backend (`GameHub.cs` & Models)**:
  - Implement a transient in-memory state tracking (`GameRoomState` and a static dictionary `ActiveGames`) to manage active Draw & Guess sessions (the current drawer, current word, word choices, guessed players, score updates, phase status).
  - Update `BatDauGame` to initialize the drawer queue based on the joining time order (`NguoiChoiTrongPhong.NgayThamGia` ascending). Set `PhongCho.TrangThai = "DangChoi"`.
  - Add hub methods: `ChonTuKhoa(string maPhong, string tuKhoa)` for word selection, `GuiPhanDoan(string maPhong, int userId, string phanDoan)` for guess submissions, and `DongBoVeGame(string maPhong, string netVe)` for canvas synchronization.
  - Implement scoring calculations and save round results using `PhienChoiGame`, `VongChoiGame`, and `LuotChoiGame` models without requiring schema modifications.
- **Frontend (`TroChoiTamSaoThatBan.tsx`)**:
  - Redesign the React component to support Draw & Guess phases (`'lobby'`, `'word_selection'`, `'playing'`, `'turn_results'`, `'finished'`).
  - Render an overlay/dialog for the active drawer to choose 1 of 3 words, and a placeholder screen for guessers.
  - Implement a lighter, simplified HTML5 canvas drawing interface for the drawer supporting drawing strokes, brush size, color selection, undo last stroke, and canvas clear.
  - Broadcast brush coordinates and canvas action signals via SignalR in real-time, and parse these signals to render on guessers' canvases.
  - Render guess input, correct guess notifications, and public chat logs for guessers.

## Impact
- Affected specs: `draw-guess-gameplay` (new spec)
- Affected code: `Hubs/GameHub.cs`, `components/TroChoi/TroChoiTamSaoThatBan.tsx`
