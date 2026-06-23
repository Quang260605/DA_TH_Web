using System;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DA_Web.Models;
using DA_Web.Models.NguoiDungModule;

namespace DA_Web.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthenticationController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public AuthenticationController(ApplicationDbContext context)
        {
            _context = context;
        }

        // Đăng ký tài khoản
        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterDto dto)
        {
            if (await _context.NguoiDungs.AnyAsync(u => u.TenDangNhap == dto.TenDangNhap))
            {
                return BadRequest(new { message = "Tên đăng nhập đã tồn tại trên hệ thống!" });
            }

            var user = new NguoiDung
            {
                TenDangNhap = dto.TenDangNhap,
                MatKhauHash = HashPassword(dto.MatKhau),
                TenHienThi = string.IsNullOrEmpty(dto.TenHienThi) ? "Họa sĩ nhí mới" : dto.TenHienThi,
                AnhDaiDienUrl = dto.AnhDaiDienUrl ?? "/assets/avatars/default.png",
                TongDiem = 0,
                CapDoHienTai = 1,
                NgayTao = DateTime.Now
            };

            _context.NguoiDungs.Add(user);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Đăng ký thành công!",
                user = new
                {
                    id = user.Id,
                    tenDangNhap = user.TenDangNhap,
                    tenHienThi = user.TenHienThi,
                    anhDaiDienUrl = user.AnhDaiDienUrl
                }
            });
        }

        // Đăng nhập
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginDto dto)
        {
            var matKhauHashInput = HashPassword(dto.MatKhau);
            var user = await _context.NguoiDungs
                .FirstOrDefaultAsync(u => u.TenDangNhap == dto.TenDangNhap && u.MatKhauHash == matKhauHashInput);

            if (user == null)
            {
                return Unauthorized(new { message = "Tên đăng nhập hoặc mật khẩu không chính xác!" });
            }

            return Ok(new
            {
                message = "Đăng nhập thành công!",
                user = new
                {
                    id = user.Id,
                    tenDangNhap = user.TenDangNhap,
                    tenHienThi = user.TenHienThi,
                    anhDaiDienUrl = user.AnhDaiDienUrl,
                    tongDiem = user.TongDiem,
                    capDoHienTai = user.CapDoHienTai
                }
            });
        }

        // Lấy thông tin tài khoản
        [HttpGet("profile/{id}")]
        public async Task<IActionResult> GetProfile(int id)
        {
            var user = await _context.NguoiDungs.FindAsync(id);
            if (user == null)
            {
                return NotFound(new { message = "Không tìm thấy người dùng!" });
            }

            // Lấy thêm huy hiệu của người dùng
            var huyHieus = await _context.HuyHieuNguoiDungs
                .Where(ub => ub.NguoiDungId == id)
                .Include(ub => ub.HuyHieu)
                .Select(ub => new
                {
                    id = ub.HuyHieuId,
                    tieuDe = ub.HuyHieu!.TieuDe,
                    moTa = ub.HuyHieu.MoTa,
                    hinhAnhUrl = ub.HuyHieu.HinhAnhUrl,
                    ngayNhan = ub.NgayNhan
                })
                .ToListAsync();

            return Ok(new
            {
                id = user.Id,
                tenDangNhap = user.TenDangNhap,
                tenHienThi = user.TenHienThi,
                anhDaiDienUrl = user.AnhDaiDienUrl,
                tongDiem = user.TongDiem,
                capDoHienTai = user.CapDoHienTai,
                ngayTao = user.NgayTao,
                huyHieus = huyHieus
            });
        }

        // Quên mật khẩu
        [HttpPost("forgot-password")]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordDto dto)
        {
            var user = await _context.NguoiDungs.FirstOrDefaultAsync(u => u.TenDangNhap == dto.TenDangNhap);
            if (user == null)
            {
                return NotFound(new { message = "Không tìm thấy tài khoản này!" });
            }

            user.MatKhauHash = HashPassword(dto.MatKhauMoi);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Cập nhật mật khẩu mới thành công!" });
        }

        // Cập nhật thông tin hiển thị (biệt danh & ảnh đại diện)
        [HttpPost("update-profile")]
        public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileDto dto)
        {
            var user = await _context.NguoiDungs.FindAsync(dto.Id);
            if (user == null)
            {
                return NotFound(new { message = "Không tìm thấy người dùng!" });
            }

            if (!string.IsNullOrEmpty(dto.TenHienThi))
            {
                user.TenHienThi = dto.TenHienThi;
            }

            if (!string.IsNullOrEmpty(dto.AnhDaiDienUrl))
            {
                user.AnhDaiDienUrl = dto.AnhDaiDienUrl;
            }

            _context.Entry(user).State = EntityState.Modified;
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Cập nhật tài khoản thành công!",
                user = new
                {
                    id = user.Id,
                    tenDangNhap = user.TenDangNhap,
                    tenHienThi = user.TenHienThi,
                    anhDaiDienUrl = user.AnhDaiDienUrl,
                    tongDiem = user.TongDiem,
                    capDoHienTai = user.CapDoHienTai
                }
            });
        }

        // Hàm băm mật khẩu SHA256
        private string HashPassword(string password)
        {
            using (var sha256 = SHA256.Create())
            {
                var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(password));
                var builder = new StringBuilder();
                for (int i = 0; i < bytes.Length; i++)
                {
                    builder.Append(bytes[i].ToString("x2"));
                }
                return builder.ToString();
            }
        }
    }

    public class RegisterDto
    {
        public string TenDangNhap { get; set; } = string.Empty;
        public string MatKhau { get; set; } = string.Empty;
        public string? TenHienThi { get; set; }
        public string? AnhDaiDienUrl { get; set; }
    }

    public class LoginDto
    {
        public string TenDangNhap { get; set; } = string.Empty;
        public string MatKhau { get; set; } = string.Empty;
    }

    public class ForgotPasswordDto
    {
        public string TenDangNhap { get; set; } = string.Empty;
        public string MatKhauMoi { get; set; } = string.Empty;
    }

    public class UpdateProfileDto
    {
        public int Id { get; set; }
        public string? TenHienThi { get; set; }
        public string? AnhDaiDienUrl { get; set; }
    }
}
