# DA_TH_Web - Draw With Me

Web học vẽ, vẽ tranh và chơi game thời gian thực.

## Yêu cầu

- .NET SDK 10 trở lên
- Node.js
- SQL Server LocalDB

## Cách chạy

Clone project:

```powershell
git clone https://github.com/Quang260605/DA_TH_Web.git
cd DA_TH_Web
```

Chạy backend:

```powershell
dotnet run --project .\DA_Web\DA_Web.csproj --urls http://localhost:5058
```

Backend dùng sẵn database trong thư mục:

```text
database\DrawWithMeDb.mdf
```

Nếu backend báo lỗi database, có thể restore file:

```text
database\DrawWithMeDb.bak
```

Chạy frontend trong terminal khác:

```powershell
cd .\DA_Web_Client
npm install
npm run dev
```

Mở web:

```text
http://localhost:5173
```

Nếu Vite hiện port khác, ví dụ `5174`, hãy mở đúng link Vite báo trong terminal.

## Ghi chú

- Frontend gọi backend mặc định ở `http://localhost:5058`.
- Nếu đổi port backend, tạo file `.env` trong `DA_Web_Client`:

```env
VITE_BACKEND_URL=http://localhost:5058
```
