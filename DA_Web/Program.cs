using Microsoft.EntityFrameworkCore;
using Microsoft.Data.SqlClient;
using DA_Web.Models;
using DA_Web.Services;
using DA_Web.Hubs;

var builder = WebApplication.CreateBuilder(args);

// 1. Cấu hình Connection String cho SQL Server
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
var databaseFile = builder.Configuration["DatabaseSettings:DatabaseFile"];
if (!string.IsNullOrWhiteSpace(databaseFile))
{
    var databaseFilePath = Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, databaseFile));
    if (File.Exists(databaseFilePath))
    {
        var databaseServer = builder.Configuration["DatabaseSettings:Server"] ?? @"(localdb)\mssqllocaldb";
        var databaseName = builder.Configuration["DatabaseSettings:DatabaseName"] ?? "DrawWithMeDb";
        var attachedDatabaseName = TryGetAttachedDatabaseName(databaseServer, databaseFilePath);
        connectionString = string.IsNullOrWhiteSpace(attachedDatabaseName)
            ? $"Server={databaseServer};AttachDBFilename={databaseFilePath};Database={databaseName};Trusted_Connection=True;MultipleActiveResultSets=true;TrustServerCertificate=True;"
            : $"Server={databaseServer};Database={attachedDatabaseName};Trusted_Connection=True;MultipleActiveResultSets=true;TrustServerCertificate=True;";
    }
}

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
        policy.WithOrigins(
                  "http://localhost:5173",
                  "http://localhost:5174",
                  "http://localhost:3000",
                  "http://localhost:5000")
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

static string? TryGetAttachedDatabaseName(string databaseServer, string databaseFilePath)
{
    try
    {
        using var connection = new SqlConnection($"Server={databaseServer};Database=master;Trusted_Connection=True;TrustServerCertificate=True;");
        connection.Open();

        using var command = connection.CreateCommand();
        command.CommandText = "SELECT TOP(1) DB_NAME(database_id) FROM sys.master_files WHERE type = 0 AND physical_name = @databaseFilePath";
        command.Parameters.AddWithValue("@databaseFilePath", databaseFilePath);

        return command.ExecuteScalar() as string;
    }
    catch
    {
        return null;
    }
}
