# Change: Redirect VeCungBan to Collaborative Drawing Board

## Why
Currently, starting any room lobby (including `VeCungBan` / match with friends) starts the Gartic Phone (Tam Sao Thất Bản) game. For `VeCungBan`, users want to enter the drawing board (`BangVe`) directly and paint together in real-time. Additionally, the GhepNgauNhien button on the homepage should be renamed to "Tạo phòng" to clarify its purpose.

## What Changes
- Update `BatDauGame` in `GameHub.cs` to check if the room type is `VeCungBan` and send `BatDauVeChung` instead of starting Gartic Phone.
- Update `App.tsx` to handle the `BatDauVeChung` listener, transition to the `'BangVe'` tab, and pass `maPhongVect={gameRoomCode}` to `BangVe`.

## Impact
- Affected specs: `lobby-management`
- Affected code: `Hubs/GameHub.cs`, `App.tsx`
