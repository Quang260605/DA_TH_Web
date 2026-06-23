# Draw with Me - OpenSpec Project

## Project Overview

**Draw with Me** là nền tảng học vẽ & chơi game cộng tác thời gian thực dùng:
- Frontend: Vite + React (Fabric.js for canvas)
- Backend: ASP.NET Core 10 + Entity Framework Core 10
- Real-time: SignalR
- AI: Gemini 1.5 Flash API (auto-grading)
- Database: SQL Server (LocalDB)

## Module Structure

### 1. **NguoiDungModule** - User & Social
- User authentication (register/login with SHA-256)
- Friend system (requests, pending, accepted states)
- Global & friend leaderboards
- Online/offline status tracking

### 2. **GiaoDucModule** - Education & AI Grading
- 20+ Topics (Anime, Animals, Food, Plants, etc.)
- Lessons with step-by-step guides (SVG)
- Difficulty levels (1-5)
- User progress tracking (in progress, completed, paused)
- AI auto-grading via Gemini (score 75-100 + Vietnamese feedback)
- Achievement badge system

### 3. **BangVeModule** - Drawing & Collaboration
- Individual canvas drawings (Fabric.js JSON persistence)
- Collaborative drawing sessions (real-time sync via SignalR)
- Public/private sharing
- Resource management

### 4. **PhongChoModule** - Game Matchmaking
- Waiting rooms with random codes
- Player tracking & ready states
- Auto-match functionality

### 5. **TroChoiModule** - Gartic Phone (Tam sao thất bản)
- Draw→Guess→Draw→Guess chaining
- Round-robin turn management
- Session & round tracking

## Known Issues

### CRITICAL Bugs 🔴
1. **String Length Truncation** - `AnhVeNguoiDungUrl` limited to 255 chars but stores Base64 images (10K+)
2. **Identity Insert Exception** - Badge creation assigns hard-coded IDs to IDENTITY columns
3. **Game Loop Logic** - From round 2+, game auto-advances incorrectly due to faulty submit count check

### Implementation Gaps 🟠
- Real-time game state sync needs optimization
- Error handling in Gemini API calls
- Database migration strategy for production
- Unit tests for core game logic

## Naming Conventions

- **Capabilities**: verb-noun kebab-case (`user-authentication`, `ai-auto-grading`)
- **Change IDs**: verb-led kebab-case (`fix-string-length-bug`, `add-voice-chat`, `refactor-game-hub`)
- **Models**: PascalCase English (`NguoiDung`, `BaiHoc`, `PhienChoiGame`)
- **Fields**: PascalCase with Vietnamese translations
- **Specs**: organize by capability in `openspec/specs/<capability>/spec.md`

## CI/CD & Deployment

- Build: `dotnet build`
- Test: `dotnet test`
- Run: `dotnet run` (HTTPS: 7134, HTTP: 5081)
- Database: LocalDB (development), SQL Server (production)
- API Documentation: Swagger at `/swagger`

## Branching Strategy

- `main` - production ready
- `develop` - integration branch
- `feature/capability-name` - feature branches
- `fix/issue-id` - bug fix branches
- Archive completed changes to `changes/archive/YYYY-MM-DD-<id>/`

## Decision Criteria

**Create Proposal When:**
- Adding new capability
- Breaking changes (API, schema, game rules)
- Architectural changes
- Bug fixes that modify spec behavior
- Performance optimizations

**Skip Proposal For:**
- Typos, formatting, comments
- Direct bug fixes (restore intended behavior)
- Dependency updates (non-breaking)

## Key References

- Database: 13 tables across 5 modules
- API: 4 REST controllers + 1 SignalR hub
- Real-time Events: 10+ SignalR methods (drawing sync, game events, notifications)
- Seed Data: Topics, Lessons, Badges pre-loaded on first run
