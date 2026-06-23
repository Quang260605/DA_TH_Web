# 🎯 Draw with Me - OpenSpec Implementation Plan

## Project Structure

### Current State
- **Framework**: ASP.NET Core 10 (Web API + MVC hybrid)
- **Real-time**: SignalR (WebSocket)
- **Database**: SQL Server with EF Core 10
- **Modules**: 5 main modules (User, Education, Drawing, Matchmaking, Game)
- **AI Integration**: Gemini 1.5 Flash API for auto-grading

### Modules That Benefit Most from OpenSpec

| Priority | Module | Change Type | Why OpenSpec? |
|----------|--------|-------------|---------------|
| 🔴 CRITICAL | GiaoDucModule | Fix AI Grading | Complex Gemini integration + error handling |
| 🔴 CRITICAL | TroChoiModule | Fix Game Logic | Multi-round state management + edge cases |
| 🔴 CRITICAL | BangVeModule | Fix String Truncation | Database constraint + data loss prevention |
| 🟠 HIGH | TroChoiModule | Add Replay System | Cross-module state capture + persistence |
| 🟠 HIGH | NguoiDungModule + GameHub | Add Real-time Voice | SignalR enhancement + new endpoint |
| 🟡 MEDIUM | TroChoiModule | Add Race Mode | New game variant + scoring rules |
| 🟡 MEDIUM | GiaoDucModule | Add Lesson Hints | UX feature + progression tracking |

---

## Phase 1: Fix Critical Bugs (ASAP)

### Change 1: Fix String Length Bug
```
Change ID: fix-string-length-bug
Capability: education-grading (affects TienTrinhNguoiDung model)

Affected Files:
- Models/GiaoDucModule/TienTrinhNguoiDung.cs (line 37)
- Controllers/LessonController.cs (line 180-190, submission saving)

Current Behavior:
- AnhVeNguoiDungUrl limited to 255 chars with [StringLength(255)]
- Code tries to save Base64 image (10K+ chars)
- Result: DbUpdateException → crash on lesson submission

Required Changes:
- Remove [StringLength(255)] attribute
- Ensure EF Core maps to NVARCHAR(MAX)
- Update database with migration

Spec Delta Location: openspec/changes/fix-string-length-bug/specs/education-grading/spec.md
```

### Change 2: Fix Badge Identity Insert
```
Change ID: fix-badge-identity-insert
Capability: achievement-system

Affected Files:
- Controllers/LessonController.cs (line 173-190, badge creation)
- Models/GiaoDucModule/HuyHieu.cs (line 10, IDENTITY configuration)

Current Behavior:
- Code explicitly sets Id = 1, 2, 3, ... when creating badges
- SQL Server rejects with Identity_Insert OFF error
- Result: Achievement unlock fails

Required Changes:
- Remove hard-coded Id assignments
- Move badge seeding to OnModelCreating
- Let EF Core auto-generate Ids

Spec Delta Location: openspec/changes/fix-badge-identity-insert/specs/achievement-system/spec.md
```

### Change 3: Fix Game Loop Logic
```
Change ID: fix-game-loop-logic
Capability: gartic-phone-game

Affected Files:
- Hubs/GameHub.cs (line 415-418, round advancement check)
- Models/TroChoiModule/LuotChoiGame.cs (turn chaining logic)

Current Behavior:
- From round 2+, game auto-advances when first player submits
- Uses submittedPlayersCount which was already full from round 1
- Result: Skips turns of other players

Required Changes:
- Fix submit count to be round-aware: totalSubmits == VongHienTai * soNguoiChoi
- Add validation: all players must submit in current round before advancing
- Ensure LuotTruocId chaining is properly reset per round

Spec Delta Location: openspec/changes/fix-game-loop-logic/specs/gartic-phone-game/spec.md
```

---

## Phase 2: Document Existing Capabilities

Before adding features, create specs for current capabilities:

### Specs to Create

```
openspec/specs/
├── user-authentication/spec.md
│   ├── Registration & Login
│   ├── Password hashing (SHA-256)
│   └── User profile management
│
├── social-system/spec.md
│   ├── Friend requests & acceptance
│   ├── Online/offline tracking
│   ├── Global & friend leaderboards
│   └── Real-time notifications via SignalR
│
├── education-grading/spec.md
│   ├── Lesson structure (topics, steps, difficulty)
│   ├── User progress tracking
│   ├── AI auto-grading via Gemini API
│   ├── Vietnamese feedback generation
│   └── Achievement unlock logic
│
├── collaborative-drawing/spec.md
│   ├── Individual canvas (Fabric.js JSON)
│   ├── Real-time collaborative drawing
│   ├── Public/private sharing
│   └── Invite system
│
├── game-matchmaking/spec.md
│   ├── Waiting rooms with random codes
│   ├── Player ready states
│   ├── Auto-match algorithm
│   └── Room state management
│
├── gartic-phone-game/spec.md
│   ├── Game session creation
│   ├── Draw→Guess→Draw→Guess chaining
│   ├── Round management
│   ├── Turn ordering & scoring
│   └── Session results
│
└── real-time-sync/spec.md
    ├── SignalR hub configuration
    ├── Event types (drawing, game state, notifications)
    ├── Connection lifecycle
    └── Error handling & reconnection
```

---

## Phase 3: Feature Additions

### Candidate Features (in order of complexity)

#### Feature 1: Add Lesson Hints (MEDIUM)
```
Change ID: add-lesson-hints
Type: Enhancement to education-grading

New Endpoints:
- GET /api/lesson/{lessonId}/hints - Get available hints
- POST /api/lesson/{lessonId}/hint-used - Track hint usage

New SignalR Method:
- HintUnlocked(lessonId, hintContent) - Real-time hint delivery

Affected Specs:
- education-grading (MODIFIED: add hint requirements)

Database Changes:
- Add Hints table (LuotGioiY)
- FK to BaiHoc
- Track hint usage per user per lesson

Design needed?: YES (complex hint algorithm + progressive unlocking)
```

#### Feature 2: Add Replay System (HIGH)
```
Change ID: add-replay-system
Type: New capability

New Endpoints:
- POST /api/game/session/{sessionId}/record - Start recording
- GET /api/game/session/{sessionId}/replay - Get replay data
- GET /api/replays/user/{userId} - List user's replays

New Models:
- ReplayFrame (captures game state at each turn)
- ReplaySession (metadata)

Affected Specs:
- gartic-phone-game (MODIFIED: add replay recording)
- real-time-sync (MODIFIED: broadcast frame captures)

Database Changes:
- Add ReplayFrames table
- Add ReplaySession table
- FK to PhienChoiGame

Design needed?: YES (replay data structure + playback timeline)
```

#### Feature 3: Add Voice Chat (HIGH)
```
Change ID: add-voice-chat-drawing
Type: Enhancement to collaborative-drawing

New Endpoints:
- POST /api/voice/token - Generate Agora token (or Twilio)
- GET /api/voice/active-rooms - List active voice sessions

New SignalR Methods:
- VoiceChannelReady(channelId, token)
- VoiceUserJoined(userId, userName)
- VoiceUserLeft(userId)

Affected Specs:
- collaborative-drawing (MODIFIED: add voice capability)
- real-time-sync (MODIFIED: add voice events)

Database Changes:
- Add VoiceSession table (minimal, mostly in-memory)

Design needed?: YES (external provider selection + token lifecycle)
```

---

## How to Use OpenSpec for This Project

### For Bug Fixes

```bash
# Example: Fix string length bug
openspec propose fix-string-length-bug

# AI will generate:
# ✓ openspec/changes/fix-string-length-bug/proposal.md
# ✓ openspec/changes/fix-string-length-bug/tasks.md
# ✓ openspec/changes/fix-string-length-bug/design.md (if cross-cutting)
# ✓ openspec/changes/fix-string-length-bug/specs/education-grading/spec.md

# Workflow:
openspec show fix-string-length-bug           # Review proposal
openspec validate fix-string-length-bug --strict  # Validate
# → Request approval
openspec apply fix-string-length-bug          # Start implementing
# → Complete all tasks in tasks.md, mark [x]
openspec archive fix-string-length-bug --yes  # Archive completed work
```

### For Features

```bash
# Example: Add replay system
openspec propose add-replay-system

# Review:
openspec show add-replay-system --json
# Check specs: should have ADDED Requirements with Scenarios

# Validate:
openspec validate add-replay-system --strict

# Implementation:
openspec apply add-replay-system
# Follow tasks, test each endpoint

# Archive:
openspec archive add-replay-system --yes
# Auto-updates specs/ from delta specs

# Verify:
openspec list --specs  # See updated capabilities
```

### For Breaking Changes

```bash
# Example: Refactor game session state management
openspec propose refactor-game-session-state

# Must include in delta specs:
# - What endpoints change behavior
# - Migration path for existing sessions
# - SignalR event changes
# - Client breaking changes

openspec validate refactor-game-session-state --strict
```

---

## Command Reference

```bash
# Initialize (already done)
openspec init

# Explore
openspec list                       # Active changes
openspec list --specs               # Capabilities
openspec show <item>                # Details
openspec show <change> --json --deltas-only  # Debug parsing

# Create & Validate
openspec propose <change-id>        # Generate proposal
openspec validate <change-id> --strict

# Implement
openspec apply <change-id>          # Start tasks

# Archive
openspec archive <change-id> --yes  # Finalize

# Update instructions
openspec update                     # Refresh agent prompts
```

---

## Next Steps

1. **Today**: Create `openspec/specs/` for each module (user-authentication, social-system, etc.)
2. **Tomorrow**: Use `openspec propose fix-string-length-bug` to fix critical bug
3. **This Week**: Fix other 2 critical bugs using OpenSpec
4. **Next Week**: Start Feature 1 (add-lesson-hints) with full OpenSpec workflow
5. **Ongoing**: Archive completed changes to keep `changes/` clean

---

## Checklist Before Each OpenSpec Change

- [ ] Read `openspec/project.md` for conventions
- [ ] Run `openspec list --specs` - see existing capabilities
- [ ] Check if capability already exists (don't duplicate)
- [ ] Verify no conflicts with other active changes
- [ ] Choose unique, verb-led change ID
- [ ] Create proposal.md with Why/What/Impact
- [ ] Write delta specs with ADDED/MODIFIED/REMOVED
- [ ] Validate with `--strict` flag
- [ ] Request approval before implementing
- [ ] Complete all tasks in tasks.md before archiving
