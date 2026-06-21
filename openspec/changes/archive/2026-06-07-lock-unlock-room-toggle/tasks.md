## 1. Implementation

- [ ] 1.1 Implement `ThayDoiKhoaPhong` method in `GameHub.cs` to update room's `LoaiPhong` based on the requested lock state and broadcast `CapNhatKhoaPhong` to the room group.
- [ ] 1.2 Update MVC client (`wwwroot/js/site.js`) to support toggling the room lock state via `ThayDoiKhoaPhong` SignalR call and update button styling and text dynamically in `renderRoomLockState`.
- [ ] 1.3 Ensure `switchToRoomLobbyView(room)` in `site.js` initializes and shows the lock toggle button appropriately for the host.
- [ ] 1.4 Update React client (`TroChoiTamSaoThatBan.tsx`) to add a SignalR listener for `CapNhatKhoaPhong` and update the lock/unlock toggle button in the host UI.

## 2. Verification

- [ ] 2.1 Verify TypeScript code compilation in React client.
- [ ] 2.2 Verify C# project compiles successfully.
