# 📋 Draw with Me - Quick OpenSpec Checklist

## 🎯 Project Overview
- **Type**: ASP.NET Core 10 Web API + SignalR real-time gaming platform
- **Modules**: 5 (User, Education, Drawing, Matchmaking, Game)
- **Database**: SQL Server + EF Core 10
- **AI**: Gemini 1.5 Flash (auto-grading)

## 🔴 Critical Bugs to Fix (Priority)

### Bug #1: String Length Truncation
```
File: Models/GiaoDucModule/TienTrinhNguoiDung.cs (line 37)
Issue: [StringLength(255)] on AnhVeNguoiDungUrl, but saves Base64 (10K+ chars)
Result: DbUpdateException on lesson submission
OpenSpec: fix-string-length-bug
```

### Bug #2: Badge Identity Insert
```
File: Controllers/LessonController.cs (line 173-190)
Issue: Hard-coded Id values on IDENTITY column
Result: SQL Server rejects INSERT
OpenSpec: fix-badge-identity-insert
```

### Bug #3: Game Loop Logic
```
File: Hubs/GameHub.cs (line 415-418)
Issue: From round 2+, game auto-advances on first player submit
Result: Skips turns of other players
OpenSpec: fix-game-loop-logic
```

## 📊 Module Capabilities (To Create Specs)

```
1. user-authentication
   - Register/Login (SHA-256)
   - Profile management

2. social-system
   - Friend requests
   - Online/offline tracking
   - Leaderboards (global & friends)

3. education-grading
   - Lessons (topics, steps, difficulty)
   - User progress
   - AI Gemini grading + VI feedback
   - Achievements

4. collaborative-drawing
   - Individual canvas (Fabric.js)
   - Real-time collab
   - Public/private sharing

5. game-matchmaking
   - Random code rooms
   - Ready states
   - Auto-match

6. gartic-phone-game
   - Draw→Guess→Draw→Guess chaining
   - Round/turn management
   - Scoring

7. real-time-sync
   - SignalR hub
   - Events & reconnection
```

## 🚀 Workflow for Each Change

```bash
# Step 1: Create proposal
openspec propose <change-id>

# Step 2: Review & validate
openspec show <change-id>
openspec validate <change-id> --strict

# Step 3: Get approval
# (Don't start implementation until approved!)

# Step 4: Implement tasks
openspec apply <change-id>
# → Mark tasks [x] as you complete them

# Step 5: Archive
openspec archive <change-id> --yes
```

## 💡 Change ID Naming

- Verb-led: `add-`, `fix-`, `update-`, `remove-`, `refactor-`
- Kebab-case: `fix-string-length-bug` ✅ NOT `StringLengthBugFix` ❌
- Unique: Check `openspec list` before choosing ID

## ✅ Before Starting Any Change

- [ ] `openspec list` - See active changes
- [ ] `openspec list --specs` - See existing capabilities
- [ ] Read `openspec/project.md` - Understand conventions
- [ ] Choose unique, verb-led change ID
- [ ] Validate proposal with `--strict` flag
- [ ] Get approval before implementing
- [ ] Track tasks in `tasks.md`, mark [x] when done

## 📚 Documentation

- **project.md** - Project conventions & structure
- **OPENSPEC_USAGE_PLAN.md** - Detailed implementation plan
- **This file** - Quick reference checklist

## 🔗 Key Files in Project

| File | Purpose |
|------|---------|
| Program.cs | Startup config, SignalR, CORS |
| Controllers/ | 4 REST endpoints + HomeController |
| Models/ | 13 tables across 5 modules |
| Hubs/GameHub.cs | SignalR real-time events |
| Services/AiGradingService.cs | Gemini API integration |
| appsettings.json | DB connection, API keys |

## 📞 Common Commands

```bash
# Check status
openspec list                # Active changes
openspec list --specs        # Capabilities

# Work on change
openspec propose add-feature  # Create new
openspec apply fix-bug        # Start work
openspec archive fix-bug --yes # Finalize

# Validate
openspec validate <id> --strict

# Debug
openspec show <id> --json --deltas-only
openspec update              # Refresh instructions
```

## 🎓 Example: Fix String Length Bug

```bash
# 1. Create proposal
openspec propose fix-string-length-bug

# 2. AI generates:
#    - proposal.md (Why/What/Impact)
#    - tasks.md (checklist)
#    - specs/education-grading/spec.md (delta)

# 3. Review & validate
openspec show fix-string-length-bug
openspec validate fix-string-length-bug --strict

# 4. Get approval
# "Looks good! Go ahead and implement."

# 5. Start implementation
openspec apply fix-string-length-bug

# 6. Follow tasks:
#    [ ] Remove [StringLength(255)] from model
#    [ ] Create EF Core migration
#    [ ] Test lesson submission with large image
#    [ ] Verify database stores full image

# 7. Mark tasks complete: - [x]

# 8. Archive
openspec archive fix-string-length-bug --yes
```

---

**Next Action**: Start with `openspec propose fix-string-length-bug` 🚀
