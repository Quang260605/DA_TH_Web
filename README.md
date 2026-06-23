# DA_TH_Web - Draw With Me

Đây là đồ án web vẽ tranh, học vẽ và chơi game thời gian thực. Project gồm 2 phần:

- `DA_Web`: Backend ASP.NET Core, Web API, SignalR, Entity Framework Core, SQL Server LocalDB.
- `DA_Web_Client`: Frontend React + Vite.

## Yêu cầu cài đặt

- .NET SDK 10 trở lên
- Node.js
- SQL Server LocalDB hoặc SQL Server
- Visual Studio / Visual Studio Code

## Clone project từ GitHub

```powershell
git clone https://github.com/Quang260605/DA_TH_Web.git
cd DA_TH_Web
```

## Database

Project có kèm thư mục:

```text
database/
```

Trong thư mục này có:

- `DrawWithMeDb.bak`: file backup database.
- `DrawWithMeDb.mdf`: file database.
- `DrawWithMeDb_log.ldf`: file log database.
- `restore_DrawWithMeDb.sql`: script restore mẫu.

### Cách 1: Restore bằng file .bak

1. Mở SQL Server Management Studio.
2. Kết nối tới:

```text
(localdb)\mssqllocaldb
```

3. Chuột phải `Databases` > `Restore Database`.
4. Chọn `Device` > trỏ tới file:

```text
database\DrawWithMeDb.bak
```

5. Đặt tên database là:

```text
DrawWithMeDb
```

### Cách 2: Attach file .mdf

1. Mở SQL Server Management Studio.
2. Chuột phải `Databases` > `Attach`.
3. Chọn file:

```text
database\DrawWithMeDb.mdf
```

4. File log `DrawWithMeDb_log.ldf` để cùng thư mục.

## Cấu hình connection string

Backend đang dùng connection string trong file:

```text
DA_Web\appsettings.json
```

Mặc định:

```json
"ConnectionStrings": {
  "DefaultConnection": "Server=(localdb)\\mssqllocaldb;Database=DrawWithMeDb;Trusted_Connection=True;MultipleActiveResultSets=true;TrustServerCertificate=True;"
}
```

Nếu dùng SQL Server khác, sửa lại `Server=...` cho đúng máy của bạn.

## Chạy backend

Mở Terminal / PowerShell tại thư mục gốc project:

```powershell
dotnet restore .\DA_Web\DA_Web.csproj
dotnet run --project .\DA_Web\DA_Web.csproj --urls http://localhost:5058
```

Backend sẽ chạy tại:

```text
http://localhost:5058
```

Kiểm tra API:

```text
http://localhost:5058/api/lesson/topics
```

## Chạy frontend

Mở thêm một Terminal / PowerShell khác:

```powershell
cd .\DA_Web_Client
npm install
npm run dev
```

Frontend sẽ chạy tại:

```text
http://localhost:5173
```

Nếu Vite báo port khác, ví dụ `5174`, thì mở đúng link Vite hiển thị.

## Lưu ý về frontend gọi backend

File cấu hình frontend nằm ở:

```text
DA_Web_Client\src\config.ts
```

Mặc định frontend gọi backend:

```text
http://localhost:5058
```

Nếu backend chạy port khác, tạo file `.env` trong thư mục `DA_Web_Client`:

```env
VITE_BACKEND_URL=http://localhost:5058
```

Sau đó chạy lại:

```powershell
npm run dev
```

## Thứ tự chạy web

1. Restore hoặc attach database.
2. Chạy backend ở `http://localhost:5058`.
3. Chạy frontend ở `http://localhost:5173`.
4. Mở trình duyệt vào `http://localhost:5173`.

## Đẩy code lên GitHub

Nếu chưa cấu hình remote:

```powershell
git remote add origin https://github.com/Quang260605/DA_TH_Web.git
```

Nếu remote đã có rồi:

```powershell
git remote set-url origin https://github.com/Quang260605/DA_TH_Web.git
```

Commit và push:

```powershell
git add .
git commit -m "Add run instructions and database files"
git branch -M main
git push -u origin main
```

## Không cần upload các thư mục này

Các thư mục sau không cần đưa lên GitHub:

```text
bin/
obj/
node_modules/
.vs/
```

Khi clone về máy khác, chỉ cần chạy `dotnet restore` và `npm install` để cài lại dependency.
