## 1. Implementation

- [ ] 1.1 Update `BatDauGame` in `GameHub.cs` to check if `room.LoaiPhong == "VeCungBan"`, set room status to `"DangChoi"`, save, and broadcast `BatDauVeChung` to all players in the room.
- [ ] 1.2 Update `App.tsx` in React client to register `BatDauVeChung` listener and set active tab to `'BangVe'` and `gameRoomCode` to the room's code.
- [ ] 1.3 Ensure `App.tsx` passes `maPhongVect={gameRoomCode}` to `BangVe` and clears `gameRoomCode` when the drawing board is closed.
## 2. Verification

- [ ] 2.1 Verify TypeScript compiles without errors in the client.
- [ ] 2.2 Verify C# project compiles successfully.
