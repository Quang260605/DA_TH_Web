# Change: Add Room Lock and Unlock Toggle

## Why
Currently, a host can only open a private friend room to the community (changing `LoaiPhong` to `GhepNgauNhien`). There is no way for a host to lock a public room or revert it back to private once opened. This change allows hosts to lock/unlock rooms to toggle between random matchmaking (public) and private friend play.

## What Changes
- Add `ThayDoiKhoaPhong(string maPhong, bool khoa)` in `GameHub.cs` to handle room locking and unlocking on the server.
- Update React client (`TroChoiTamSaoThatBan.tsx`) to register `CapNhatKhoaPhong` listener and show a dynamic button to toggle lock state.
- Update MVC client (`wwwroot/js/site.js`) to support toggling and listening to locking events.

## Impact
- Affected specs: `lobby-management`
- Affected code: `Hubs/GameHub.cs`, `wwwroot/js/site.js`, `TroChoiTamSaoThatBan.tsx`
