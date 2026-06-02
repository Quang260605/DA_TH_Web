using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DA_Web.Models;
using DA_Web.Models.GiaoDucModule;
using DA_Web.Services;

namespace DA_Web.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class LessonController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IAiGradingService _aiGradingService;

        public LessonController(ApplicationDbContext context, IAiGradingService aiGradingService)
        {
            _context = context;
            _aiGradingService = aiGradingService;
        }

        // Lấy danh sách tất cả chủ đề học vẽ
        [HttpGet("topics")]
        public async Task<IActionResult> GetTopics()
        {
            var topics = await _context.ChuDes.ToListAsync();
            return Ok(topics);
        }

        // Lấy danh sách bài học theo chủ đề
        [HttpGet("topic/{topicId}/lessons")]
        public async Task<IActionResult> GetLessonsByTopic(int topicId)
        {
            var lessons = await _context.BaiHocs
                .Where(l => l.ChuDeId == topicId)
                .ToListAsync();
            return Ok(lessons);
        }

        // Lấy chi tiết các bước vẽ của một bài học
        [HttpGet("{lessonId}/steps")]
        public async Task<IActionResult> GetLessonSteps(int lessonId)
        {
            var lesson = await _context.BaiHocs.FindAsync(lessonId);
            if (lesson == null)
            {
                return NotFound(new { message = "Không tìm thấy bài học vẽ này!" });
            }

            var steps = await _context.CacBuocBaiHocs
                .Where(s => s.BaiHocId == lessonId)
                .OrderBy(s => s.SoThuTuBuoc)
                .ToListAsync();

            return Ok(new
            {
                lessonId = lesson.Id,
                tieuDe = lesson.TieuDe,
                moTa = lesson.MoTa,
                doKho = lesson.DoKho,
                steps = steps
            });
        }

        // Nộp bài tập vẽ và nhờ AI chấm điểm
        [HttpPost("submit")]
        public async Task<IActionResult> SubmitLesson([FromBody] SubmitLessonDto dto)
        {
            var user = await _context.NguoiDungs.FindAsync(dto.NguoiDungId);
            if (user == null) return NotFound(new { message = "Không tìm thấy người dùng!" });

            var lesson = await _context.BaiHocs.FindAsync(dto.BaiHocId);
            if (lesson == null) return NotFound(new { message = "Không tìm thấy bài học vẽ!" });

            // 1. Gọi AI chấm điểm bức vẽ
            var (diemAi, nhanXetAi) = await _aiGradingService.GradeDrawingAsync(dto.AnhVeBase64, lesson.TieuDe, lesson.MoTa);

            // 2. Cập nhật hoặc thêm mới tiến trình của người dùng
            var progress = await _context.TienTrinhNguoiDungs
                .FirstOrDefaultAsync(p => p.NguoiDungId == dto.NguoiDungId && p.BaiHocId == dto.BaiHocId);

            int diemCong = diemAi + lesson.DiemThuong;

            if (progress == null)
            {
                progress = new TienTrinhNguoiDung
                {
                    NguoiDungId = dto.NguoiDungId,
                    BaiHocId = dto.BaiHocId,
                    TrangThai = "DaHoanThanh",
                    BuocCaoNhatDatDuoc = 4, // Đã xong bước cuối
                    NgayHoanThanh = DateTime.Now,
                    AnhVeNguoiDungUrl = dto.AnhVeBase64, // Để đơn giản, lưu ảnh Base64 trong DB để dễ demo
                    DiemAiCham = diemAi,
                    NhanXetAi = nhanXetAi
                };
                _context.TienTrinhNguoiDungs.Add(progress);
                
                // Cộng điểm tích lũy vào tài khoản người học
                user.TongDiem += diemCong;
            }
            else
            {
                // Nếu đã vẽ rồi thì cập nhật kết quả mới (nếu điểm mới cao hơn điểm cũ)
                if (!progress.DiemAiCham.HasValue || diemAi > progress.DiemAiCham.Value)
                {
                    // Trừ điểm cũ cộng điểm mới chênh lệch
                    int diemChenhLech = diemAi - (progress.DiemAiCham ?? 0);
                    user.TongDiem += diemChenhLech;

                    progress.DiemAiCham = diemAi;
                    progress.NhanXetAi = nhanXetAi;
                    progress.AnhVeNguoiDungUrl = dto.AnhVeBase64;
                }
                progress.TrangThai = "DaHoanThanh";
                progress.NgayHoanThanh = DateTime.Now;
                _context.Entry(progress).State = EntityState.Modified;
            }

            // 3. Tự động tính toán cấp độ mới (Ví dụ: Cứ 100 điểm tăng 1 cấp)
            user.CapDoHienTai = (user.TongDiem / 100) + 1;
            _context.Entry(user).State = EntityState.Modified;

            // 4. Kiểm tra điều kiện mở khóa huy hiệu
            await KiemTraHuyHieu(user.Id);

            await _context.SaveChangesAsync();

            return Ok(new
            {
                diemAiCham = diemAi,
                nhanXetAi = nhanXetAi,
                diemCong = diemCong,
                tongDiemMoi = user.TongDiem,
                capDoMoi = user.CapDoHienTai
            });
        }

        // Kiểm tra và trao huy hiệu tự động
        private async Task KiemTraHuyHieu(int userId)
        {
            // Định nghĩa điều kiện đạt huy hiệu
            // Huy hiệu 1: Thần đồng hình học (Hoàn thành bài tập vẽ Donut)
            bool daHoanThanhDonut = await _context.TienTrinhNguoiDungs
                .AnyAsync(p => p.NguoiDungId == userId && p.BaiHocId == 3 && p.TrangThai == "DaHoanThanh");

            if (daHoanThanhDonut)
            {
                await TraoHuyHieuNeuChuaCo(userId, 1, "Thần đồng hình học", "Hoàn thành bài tập vẽ bánh Donut tròn trịa.", "/assets/badges/badge_donut.png");
            }

            // Huy hiệu 2: Bạn của động vật (Hoàn thành bài tập vẽ Chú mèo con)
            bool daHoanThanhMeoCon = await _context.TienTrinhNguoiDungs
                .AnyAsync(p => p.NguoiDungId == userId && p.BaiHocId == 1 && p.TrangThai == "DaHoanThanh");

            if (daHoanThanhMeoCon)
            {
                await TraoHuyHieuNeuChuaCo(userId, 2, "Bạn của động vật", "Hoàn thành xuất sắc bài tập vẽ Chú mèo con đáng yêu.", "/assets/badges/badge_cat.png");
            }
        }

        private async Task TraoHuyHieuNeuChuaCo(int userId, int badgeId, string tieuDe, string moTa, string iconUrl)
        {
            // Kiểm tra HuyHieu đã tồn tại trong DB chưa, nếu chưa thì thêm mới
            var badge = await _context.HuyHieus.FindAsync(badgeId);
            if (badge == null)
            {
                badge = new HuyHieu
                {
                    Id = badgeId,
                    TieuDe = tieuDe,
                    MoTa = moTa,
                    HinhAnhUrl = iconUrl
                };
                _context.HuyHieus.Add(badge);
                // Bật identity insert tạm thời nếu cần, nhưng EF Core xử lý ID thủ công nếu đã được cấu hình đúng
            }

            bool daCo = await _context.HuyHieuNguoiDungs
                .AnyAsync(ub => ub.NguoiDungId == userId && ub.HuyHieuId == badgeId);

            if (!daCo)
            {
                var userBadge = new HuyHieuNguoiDung
                {
                    NguoiDungId = userId,
                    HuyHieuId = badgeId,
                    NgayNhan = DateTime.Now
                };
                _context.HuyHieuNguoiDungs.Add(userBadge);
            }
        }
    }

    public class SubmitLessonDto
    {
        public int NguoiDungId { get; set; }
        public int BaiHocId { get; set; }
        public string AnhVeBase64 { get; set; } = string.Empty;
    }
}
