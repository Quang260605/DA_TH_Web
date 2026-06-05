# Project Context

## Purpose
An interactive drawing and game web application, featuring educational painting tutorials and real-time multiplayer games (specifically "Tam Sao Thất Bản" / Gartic Phone style Chinese Whispers).

## Tech Stack
- **Backend**: ASP.NET Core (C#), Entity Framework Core, SignalR for real-time room and gameplay communication, SQL Server database.
- **Frontend**: React, Vite, TypeScript, Lucide React (icons), Fabric.js (canvas-based drawing & synchronization).

## Project Conventions

### Code Style
- C# (Backend): PascalCase for class names, methods, and public properties; camelCase for parameters and local variables.
- TypeScript/React (Frontend): camelCase for functions, variables, and file names (except React components which are PascalCase). Standard ESLint configuration.

### Architecture Patterns
- **Real-time Synchronization**: SignalR Hub (`GameHub.cs`) manages connection lifecycles, matchmaking, lobby statuses, and round synchronization.
- **Client-Side State**: React hooks manage game room state (waiting, playing, finished).
- **Data Persistence**: Entity Framework Core maps database models (`NguoiDung`, `PhongCho`, `NguoiChoiTrongPhong`, `LuotChoiGame`, `VongChoiGame`) to SQL Server tables.

### Testing Strategy
- Manual verification via launching backend (`dotnet run`) and frontend (`npm run dev`), testing with multiple browser windows/accounts to verify real-time lobby updates, game lifecycle transitions, and correct SignalR payload delivery.

### Git Workflow
- Standard branch workflow. Main branch contains stable code. Feature branches for modules.

## Domain Context
- **Tam Sao Thất Bản (Chinese Whispers / Gartic Phone)**: A game where players take turns drawing pictures based on text prompts, or guessing text prompts based on drawings. The game propagates in a chain, resulting in a funny summary at the end.
- **Lobby Management**: Players join rooms via random matchmaking or code-based invites. Host can start the game when all players are ready.

## Important Constraints
- Database portability: The database connection must be portable across developer environments (e.g. using LocalDB or easily configurable connection strings).
- Real-time robustness: High reliability for user leave, disconnect, kick, and host transfer events to prevent game room hangs.

## External Dependencies
- Microsoft ASP.NET Core SignalR client library for React.
- Fabric.js for drawing canvas rendering.

