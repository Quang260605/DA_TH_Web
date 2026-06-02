# 🎨 Draw with Me - Web Server API & Real-time Collaboration Game

Dự án **Draw with Me** là một hệ thống Web API kết hợp Real-time WebSockets (SignalR) phục vụ ứng dụng vẽ tranh, học vẽ có tích hợp trí tuệ nhân tạo (Gemini API) để chấm điểm vẽ và hỗ trợ trò chơi cộng tác thời gian thực "Tam sao thất bản" (Gartic Phone).

---

## 📌 Các Tính Năng & Module Chính

Hệ thống được chia làm 5 module chức năng nghiệp vụ cốt lõi:

1. **Module 1: Người dùng & Mạng xã hội (`NguoiDungModule`)**
   - Đăng ký, đăng nhập bảo mật bằng cơ chế băm mật khẩu SHA-256.
   - Tìm kiếm người dùng, gửi/nhận lời mời kết bạn.
   - Quản lý trạng thái trực tuyến (Online/Offline) thời gian thực.
   - Bảng xếp hạng điểm số (Leaderboard) toàn cầu và bảng xếp hạng bạn bè.

2. **Module 2: Giáo trình học vẽ & chấm điểm AI (`GiaoDucModule`)**
   - Phân chia bài học theo chủ đề (Anime, Động vật, Đồ ăn, Cây cỏ...) kèm theo độ khó khác nhau.
   - Bài học chia thành nhiều bước vẽ chi tiết (được dẫn hướng bằng tọa độ Vector SVG/mô tả).
   - Tích hợp **Gemini 1.5 Flash API** tự động phân tích nét vẽ, chấm điểm (thang điểm 75-100) và nhận xét tích cực bằng tiếng Việt để khuyến khích học viên.
   - Hệ thống tự động thăng cấp và trao tặng huy hiệu khi hoàn thành mục tiêu.

3. **Module 3: Bảng vẽ & Vẽ nhóm thời gian thực (`BangVeModule`)**
   - Lưu trữ/chia sẻ bản vẽ của người dùng dưới dạng JSON (tương thích Fabric.js).
   - Mời bạn bè cùng tham gia vẽ chung trên một Canvas.
   - Đồng bộ hóa các nét vẽ vẽ trực tiếp giữa các cộng tác viên trong phòng thông qua SignalR.

4. **Module 4: Phòng chờ & Ghép trận (`PhongChoModule`)**
   - Tạo phòng chờ (Lobby), tham gia phòng bằng mã Code ngẫu nhiên.
   - Tự động ghép trận ngẫu nhiên (Matchmaking) tìm các phòng đang chờ.
   - Chuẩn bị sẵn sàng (Ready) trước khi bắt đầu trận đấu.

5. **Module 5: Trò chơi Tam sao thất bản - Gartic Phone (`TroChoiModule`)**
   - Quy trình chơi luân chuyển vòng tròn (Round-robin routing): Vẽ hình dựa trên từ khóa -> Đoán chữ dựa trên hình vẽ -> Vẽ hình dựa trên đoán chữ...
   - Đồng bộ thời gian và tổng hợp chuỗi kết quả khi kết thúc phiên chơi.

---

## 🛠️ Hướng dẫn Cấu hình & Chạy dự án

### 1. Yêu cầu hệ thống
- [.NET 10.0 SDK](https://dotnet.microsoft.com/download/dotnet/10.0) trở lên.
- [SQL Server](https://www.microsoft.com/en-us/sql-server/sql-server-downloads) (SQLEXPRESS hoặc bản LocalDB).

### 2. Cấu hình Connection String và API Key
Mở file [appsettings.json](file:///d:/DA_TH_Web/DA_Web/appsettings.json) ở thư mục gốc dự án và thay thế các thông tin:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=TÊN_SERVER_SQL_CỦA_BẠN;Database=DrawWithMeDb;Trusted_Connection=True;TrustServerCertificate=True;"
  },
  "GeminiSettings": {
    "ApiKey": "API_KEY_GEMINI_CỦA_BẠN"
  }
}
```
> 💡 *Lưu ý: Nếu không cấu hình `ApiKey` hoặc giữ nguyên mặc định `"YOUR_GEMINI_API_KEY_HERE"`, hệ thống sẽ tự động chuyển sang cơ chế chấm điểm giả lập (Mocking Offline) để tránh gián đoạn ứng dụng.*

### 3. Tạo cơ sở dữ liệu (EF Core Migrations)
Mở cửa sổ dòng lệnh tại thư mục dự án và chạy câu lệnh sau để tự động tạo Database cùng các bảng và dữ liệu mẫu (Seed Data):
```bash
dotnet ef database update
```
*(Nếu máy của bạn chưa cài đặt công cụ `dotnet-ef`, hãy chạy `dotnet tool install --global dotnet-ef` trước).*

### 4. Khởi chạy Server
Chạy lệnh bên dưới để khởi động dự án ở chế độ Development:
```bash
dotnet run
```
Mặc định API sẽ chạy trên cổng HTTPS `https://localhost:7134` (hoặc HTTP `http://localhost:5081`). Endpoint SignalR sẽ là:
```text
http://localhost:<PORT>/gamehub
```
