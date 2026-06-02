# ⚠️ Danh sách lỗi có thể khiến chương trình không hoạt động (Runtime Bugs)

Dưới đây là các lỗi logic và cấu trúc dữ liệu trong mã nguồn C# có thể trực tiếp làm crash hệ thống, phát sinh lỗi Database hoặc làm treo luồng vận hành của ứng dụng khi chạy thực tế:

---

### 1. Lỗi crash Database khi nộp bài học vẽ (Database Truncation Error)
* **Vị trí:** [TienTrinhNguoiDung.cs:L37](file:///d:/DA_TH_Web/DA_Web/Models/GiaoDucModule/TienTrinhNguoiDung.cs#L37)
* **Mô tả:** 
  Cột `AnhVeNguoiDungUrl` trong cơ sở dữ liệu bị giới hạn độ dài tối đa là 255 ký tự do thuộc tính `[StringLength(255)]`. Tuy nhiên, trong [LessonController.cs:L96](file:///d:/DA_TH_Web/DA_Web/Controllers/LessonController.cs#L96), hệ thống lại lưu trực tiếp ảnh vẽ của người học dưới dạng chuỗi **Base64** (thường dài hàng chục nghìn ký tự). Khi gọi `SaveChangesAsync()`, SQL Server sẽ báo lỗi cắt bớt chuỗi dữ liệu và từ chối lưu, gây lỗi crash hoàn toàn tính năng nộp bài.
* **Cách khắc phục:** 
  Xóa thuộc tính `[StringLength(255)]` phía trên thuộc tính `AnhVeNguoiDungUrl` trong file `TienTrinhNguoiDung.cs` để EF Core tự động mapping cột sang kiểu `nvarchar(max)` trong SQL Server:
  ```diff
  - [StringLength(255)]
    public string? AnhVeNguoiDungUrl { get; set; }
  ```

---

### 2. Lỗi Identity Insert khi trao huy hiệu tự động (Database Insert Exception)
* **Vị trí:** [LessonController.cs:L173](file:///d:/DA_TH_Web/DA_Web/Controllers/LessonController.cs#L173) và [HuyHieu.cs:L10](file:///d:/DA_TH_Web/DA_Web/Models/GiaoDucModule/HuyHieu.cs#L10)
* **Mô tả:** 
  Cột `Id` của bảng `HuyHieus` được đặt làm khóa chính tự tăng `[DatabaseGenerated(DatabaseGeneratedOption.Identity)]`. Tuy nhiên, trong hàm `TraoHuyHieuNeuChuaCo` ở `LessonController.cs`, khi tạo một Huy hiệu mới hệ thống lại gán ID cứng: `badge.Id = badgeId;`. Khi thực hiện lệnh chèn, SQL Server sẽ ném ra ngoại lệ ngăn cản chèn trực tiếp giá trị vào cột khóa chính tự tăng (IDENTITY_INSERT = OFF).
* **Cách khắc phục:** 
  Nên chuyển việc tạo các Huy hiệu sang dạng **Seed Data** trong hàm `OnModelCreating` của file [ApplicationDbContext.cs](file:///d:/DA_TH_Web/DA_Web/Models/ApplicationDbContext.cs) (tương tự như bài học và chủ đề) để tránh chèn động kèm ID cứng trong Controller.

---

### 3. Lỗi logic luân chuyển vòng chơi game Tam sao thất bản (Gartic Phone Loop Bug)
* **Vị trí:** [GameHub.cs:L415-L418](file:///d:/DA_TH_Web/DA_Web/Hubs/GameHub.cs#L415-L418)
* **Mô tả:** 
  Trong hàm `NopLuotChoi`, logic kiểm tra xem cả phòng đã nộp đủ bài để chuyển sang vòng mới được thực hiện bằng cách đếm số người chơi đã nộp ít nhất 1 lượt trong suốt trận đấu:
  ```csharp
  var submittedPlayersCount = await _context.LuotChoiGames
      .Where(l => allRounds.Select(v => v.Id).Contains(l.VongChoiGameId))
      .GroupBy(l => l.NguoiChoiId)
      .CountAsync();
  ```
  Từ **Vòng 2 trở đi**, do tất cả người chơi đều đã nộp bài ở Vòng 1, biến `submittedPlayersCount` sẽ ngay lập tức bằng tổng số người chơi trong phòng ngay khi **người đầu tiên** nộp bài Vòng 2. Kết quả là game sẽ tự động chuyển tiếp vòng mới ngay lập tức mà không đợi những người chơi khác hoàn thành, sử dụng lại bài nộp cũ của họ.
* **Cách khắc phục:** 
  Thay đổi cách kiểm tra bằng cách đếm tổng số lượt đã nộp trong toàn bộ phiên chơi. Vì mỗi vòng mỗi người nộp đúng 1 lượt, tổng số lượt nộp khi kết thúc vòng hiện tại (`phienChoi.VongHienTai`) phải bằng: `VongHienTai * Số_Lượng_Người_Chơi_Trong_Phòng`.
  ```csharp
  var totalSubmits = await _context.LuotChoiGames
      .CountAsync(l => allRounds.Select(v => v.Id).Contains(l.VongChoiGameId));

  if (totalSubmits >= phienChoi.VongHienTai * roomPlayers.Count)
  {
      // Chuyển sang vòng tiếp theo hoặc kết thúc game
  }
  ```

---

### 4. Treo game khi người chơi mất kết nối giữa chừng (Game Hang Issue)
* **Vị trí:** [GameHub.cs:L70-L73](file:///d:/DA_TH_Web/DA_Web/Hubs/GameHub.cs#L70-L73)
* **Mô tả:** 
  Hàm `OnDisconnectedAsync` chỉ xử lý thoát phòng và chuyển quyền chủ phòng khi phòng ở trạng thái `"DangCho"` (đang đợi trong phòng chờ). Khi game đang diễn ra (`"DangChoi"`), nếu có người chơi thoát game hoặc mất mạng đột ngột, hệ thống không xử lý. Game loop sẽ chờ vĩnh viễn lượt nộp bài từ người chơi đã mất kết nối này, làm treo toàn bộ phòng game của các người chơi khác.
* **Cách khắc phục:** 
  Bổ sung xử lý khi người chơi mất kết nối khi phòng ở trạng thái `"DangChoi"`. Có thể tự động nộp bài trống (Auto-submit blank) thay thế cho người đó để trò chơi được tiếp tục, hoặc lập tức kết thúc game và gửi thông báo phòng game bị hủy do có người mất kết nối.
