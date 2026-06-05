using Microsoft.EntityFrameworkCore;
using DA_Web.Models;
using DA_Web.Services;
using DA_Web.Hubs;

var builder = WebApplication.CreateBuilder(args);

// 1. Cấu hình Connection String cho SQL Server
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(connectionString));

// 2. Đăng ký các Service
builder.Services.AddScoped<IAiGradingService, AiGradingService>();

// 3. Đăng ký SignalR để xử lý real-time
builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = true;
});

// 4. Đăng ký Controllers
builder.Services.AddControllersWithViews();

// 5. Cấu hình CORS để Frontend (Vite chạy cổng 5173 hoặc 3000) có thể gọi API & SignalR
builder.Services.AddCors(options =>
{
    options.AddPolicy("CorsPolicy", policy =>
    {
        policy.WithOrigins("http://localhost:5173", "http://localhost:3000", "http://localhost:5000")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials(); // Bắt buộc cho SignalR kết nối
    });
});

var app = builder.Build();

// Cấu hình HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}

app.UseHttpsRedirection();

// Sử dụng CORS
app.UseCors("CorsPolicy");

// Phục vụ file tĩnh trong wwwroot
app.UseStaticFiles();

app.UseAuthorization();

// Route cho Web API
app.MapControllers();

// Route cho Hub SignalR thời gian thực
app.MapHub<GameHub>("/gamehub");

// Route mặc định (Fallback)
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();
