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
            SeedLessonsIfEmpty();
        }

        // Lấy danh sách tất cả chủ đề học vẽ
        [HttpGet("topics")]
        public async Task<IActionResult> GetTopics()
        {
            var topics = await _context.ChuDes.ToListAsync();
            return Ok(topics);
        }

        // Lấy tất cả bài học (cho lộ trình học vẽ)
        [HttpGet("all-lessons")]
        public async Task<IActionResult> GetAllLessons()
        {
            var lessons = await _context.BaiHocs.ToListAsync();
            return Ok(lessons);
        }

        // Lấy danh sách tiến trình vẽ của người dùng
        [HttpGet("user/{userId}/progress")]
        public async Task<IActionResult> GetUserProgress(int userId)
        {
            var progress = await _context.TienTrinhNguoiDungs
                .Where(p => p.NguoiDungId == userId)
                .Select(p => new {
                    baiHocId = p.BaiHocId,
                    trangThai = p.TrangThai,
                    diemAiCham = p.DiemAiCham,
                    nhanXetAi = p.NhanXetAi,
                    ngayHoanThanh = p.NgayHoanThanh
                })
                .ToListAsync();
            return Ok(progress);
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

        private void SeedLessonsIfEmpty()
        {
            if (_context.BaiHocs.Count() <= 3)
            {
                _context.Database.ExecuteSqlRaw("DELETE FROM TienTrinhNguoiDungs");
                _context.Database.ExecuteSqlRaw("DELETE FROM CacBuocBaiHocs");
                _context.Database.ExecuteSqlRaw("DELETE FROM BaiHocs");

                var a1 = new BaiHoc { ChuDeId = 1, TieuDe = "Vẽ mắt Anime dễ", MoTa = "Bước đầu học vẽ phác thảo đôi mắt to tròn long lanh kiểu Anime.", DoKho = "De", AnhThuNhoUrl = "👁️", DiemThuong = 15, NgayTao = DateTime.Now };
                var a2 = new BaiHoc { ChuDeId = 1, TieuDe = "Vẽ tóc Anime nữ", MoTa = "Tập vẽ kiểu tóc đuôi ngựa bồng bềnh cá tính.", DoKho = "De", DiemThuong = 20, AnhThuNhoUrl = "👧", NgayTao = DateTime.Now };
                var a3 = new BaiHoc { ChuDeId = 1, TieuDe = "Vẽ khuôn mặt Anime nữ", MoTa = "Từng bước phác thảo và vẽ chi tiết khuôn mặt tỉ lệ chuẩn Anime.", DoKho = "TrungBinh", DiemThuong = 30, AnhThuNhoUrl = "✨", NgayTao = DateTime.Now };

                var d1 = new BaiHoc { ChuDeId = 2, TieuDe = "Vẽ đầu chú mèo tròn", MoTa = "Học vẽ đầu chú mèo tròn trịa đáng yêu cực kỳ đơn giản.", DoKho = "De", AnhThuNhoUrl = "🐱", DiemThuong = 15, NgayTao = DateTime.Now };
                var d2 = new BaiHoc { ChuDeId = 2, TieuDe = "Vẽ tai mèo ngộ nghĩnh", MoTa = "Học vẽ đôi tai mèo nhọn xinh xắn và râu mèo.", DoKho = "De", AnhThuNhoUrl = "👂", DiemThuong = 20, NgayTao = DateTime.Now };
                var d3 = new BaiHoc { ChuDeId = 2, TieuDe = "Vẽ chú mèo con hoàn chỉnh", MoTa = "Học vẽ từng bước chú mèo dễ thương đang ngồi chơi và cười đùa.", DoKho = "TrungBinh", AnhThuNhoUrl = "🐈", DiemThuong = 30, NgayTao = DateTime.Now };

                var f1 = new BaiHoc { ChuDeId = 3, TieuDe = "Vẽ vòng bánh Donut", MoTa = "Vẽ hình tròn bánh donut cơ bản cực dễ.", DoKho = "De", AnhThuNhoUrl = "🍩", DiemThuong = 15, NgayTao = DateTime.Now };
                var f2 = new BaiHoc { ChuDeId = 3, TieuDe = "Vẽ lớp kem dâu phủ bánh", MoTa = "Vẽ lớp kem phủ lượn sóng ngọt ngào trên bánh.", DoKho = "De", AnhThuNhoUrl = "🍓", DiemThuong = 20, NgayTao = DateTime.Now };
                var f3 = new BaiHoc { ChuDeId = 3, TieuDe = "Hoàn thiện bánh Donut màu sắc", MoTa = "Vẽ chiếc bánh vòng donut phủ kem dâu và cốm màu rực rỡ.", DoKho = "TrungBinh", AnhThuNhoUrl = "🧁", DiemThuong = 30, NgayTao = DateTime.Now };

                var c1 = new BaiHoc { ChuDeId = 4, TieuDe = "Vẽ chiếc lá xanh", MoTa = "Học vẽ chiếc lá cây đơn giản với các đường gân lá.", DoKho = "De", AnhThuNhoUrl = "🍃", DiemThuong = 15, NgayTao = DateTime.Now };
                var c2 = new BaiHoc { ChuDeId = 4, TieuDe = "Vẽ thân cây mầm", MoTa = "Tập vẽ chậu cây mầm nhỏ nhắn đang vươn lên đón nắng.", DoKho = "De", AnhThuNhoUrl = "🌱", DiemThuong = 20, NgayTao = DateTime.Now };
                var c3 = new BaiHoc { ChuDeId = 4, TieuDe = "Vẽ bông hoa hướng dương", MoTa = "Tập vẽ bông hoa hướng dương nở rộ rực rỡ dưới nắng mặt trời.", DoKho = "TrungBinh", AnhThuNhoUrl = "🌻", DiemThuong = 30, NgayTao = DateTime.Now };

                _context.BaiHocs.AddRange(a1, a2, a3, d1, d2, d3, f1, f2, f3, c1, c2, c3);
                _context.SaveChanges();

                var tatCaBaiHoc = _context.BaiHocs.ToList();
                foreach (var bh in tatCaBaiHoc)
                {
                    if (bh.ChuDeId == 1)
                    {
                        _context.CacBuocBaiHocs.AddRange(
                            new CacBuocBaiHoc { BaiHocId = bh.Id, SoThuTuBuoc = 1, ChuKyHuongDan = "Bước 1: Hãy vẽ một hình tròn to làm tròng mắt Anime nhé!", DuLieuGuideSvg = "M 100 100 A 50 50 0 1 1 99.9 100", LaBuocToMau = false },
                            new CacBuocBaiHoc { BaiHocId = bh.Id, SoThuTuBuoc = 2, ChuKyHuongDan = "Bước 2: Vẽ thêm các đường mi mắt cong dày phía trên mi.", DuLieuGuideSvg = "M 50 60 Q 100 20 150 60", LaBuocToMau = false },
                            new CacBuocBaiHoc { BaiHocId = bh.Id, SoThuTuBuoc = 3, ChuKyHuongDan = "Bước 3: Vẽ thêm hai hình tròn nhỏ xíu bên trong làm con ngươi lấp lánh.", DuLieuGuideSvg = "M 85 90 A 5 5 0 1 1 84.9 90 M 115 90 A 5 5 0 1 1 114.9 90", LaBuocToMau = false },
                            new CacBuocBaiHoc { BaiHocId = bh.Id, SoThuTuBuoc = 4, ChuKyHuongDan = "Bước 4: Cuối cùng, hãy chọn màu và tô điểm cho mắt thật rực rỡ!", DuLieuGuideSvg = "", LaBuocToMau = true }
                        );
                    }
                    else if (bh.ChuDeId == 2)
                    {
                        _context.CacBuocBaiHocs.AddRange(
                            new CacBuocBaiHoc { BaiHocId = bh.Id, SoThuTuBuoc = 1, ChuKyHuongDan = "Bước 1: Hãy vẽ một hình tròn to để làm đầu của chú mèo nhé!", DuLieuGuideSvg = "M 100 100 A 50 50 0 1 1 99.9 100", LaBuocToMau = false },
                            new CacBuocBaiHoc { BaiHocId = bh.Id, SoThuTuBuoc = 2, ChuKyHuongDan = "Bước 2: Vẽ thêm hai hình tam giác nhọn ở phía trên để làm đôi tai xinh.", DuLieuGuideSvg = "M 120 53 L 130 20 L 150 43 M 80 53 L 70 20 L 50 43", LaBuocToMau = false },
                            new CacBuocBaiHoc { BaiHocId = bh.Id, SoThuTuBuoc = 3, ChuKyHuongDan = "Bước 3: Vẽ thêm hai hình tròn nhỏ xíu bên trong làm đôi mắt long lanh và cái miệng cười.", DuLieuGuideSvg = "M 85 90 A 5 5 0 1 1 84.9 90 M 115 90 A 5 5 0 1 1 114.9 90 M 100 105 Q 100 115 105 105 Q 100 115 95 105", LaBuocToMau = false },
                            new CacBuocBaiHoc { BaiHocId = bh.Id, SoThuTuBuoc = 4, ChuKyHuongDan = "Bước 4: Cuối cùng, hãy chọn màu và tô điểm cho chú mèo của bạn thật rực rỡ!", DuLieuGuideSvg = "", LaBuocToMau = true }
                        );
                    }
                    else if (bh.ChuDeId == 3)
                    {
                        _context.CacBuocBaiHocs.AddRange(
                            new CacBuocBaiHoc { BaiHocId = bh.Id, SoThuTuBuoc = 1, ChuKyHuongDan = "Bước 1: Vẽ một hình tròn to bên ngoài làm viền bánh donut.", DuLieuGuideSvg = "M 100 100 A 50 50 0 1 1 99.9 100", LaBuocToMau = false },
                            new CacBuocBaiHoc { BaiHocId = bh.Id, SoThuTuBuoc = 2, ChuKyHuongDan = "Bước 2: Vẽ một hình tròn nhỏ ở chính giữa làm lỗ bánh donut nhé!", DuLieuGuideSvg = "M 100 100 A 15 15 0 1 1 99.9 100", LaBuocToMau = false },
                            new CacBuocBaiHoc { BaiHocId = bh.Id, SoThuTuBuoc = 3, ChuKyHuongDan = "Bước 3: Vẽ các đường gợn sóng xung quanh để làm lớp kem phủ.", DuLieuGuideSvg = "M 70 80 Q 90 90 100 70 Q 110 90 130 80", LaBuocToMau = false },
                            new CacBuocBaiHoc { BaiHocId = bh.Id, SoThuTuBuoc = 4, ChuKyHuongDan = "Bước 4: Hãy chọn những màu sắc sặc sỡ nhất để tô vẽ chiếc bánh Donut ngon lành này!", DuLieuGuideSvg = "", LaBuocToMau = true }
                        );
                    }
                    else if (bh.ChuDeId == 4)
                    {
                        _context.CacBuocBaiHocs.AddRange(
                            new CacBuocBaiHoc { BaiHocId = bh.Id, SoThuTuBuoc = 1, ChuKyHuongDan = "Bước 1: Vẽ một hình oval to ở giữa làm nhụy hoa hướng dương.", DuLieuGuideSvg = "M 100 100 A 40 40 0 1 1 99.9 100", LaBuocToMau = false },
                            new CacBuocBaiHoc { BaiHocId = bh.Id, SoThuTuBuoc = 2, ChuKyHuongDan = "Bước 2: Vẽ thêm các cánh hoa xung quanh nhụy hoa.", DuLieuGuideSvg = "M 100 60 Q 90 40 100 20 Q 110 40 100 60", LaBuocToMau = false },
                            new CacBuocBaiHoc { BaiHocId = bh.Id, SoThuTuBuoc = 3, ChuKyHuongDan = "Bước 3: Vẽ cuống hoa thẳng đứng phía dưới.", DuLieuGuideSvg = "M 100 140 L 100 200", LaBuocToMau = false },
                            new CacBuocBaiHoc { BaiHocId = bh.Id, SoThuTuBuoc = 4, ChuKyHuongDan = "Bước 4: Dùng màu vàng nắng rực rỡ để tô điểm cho bông hoa hướng dương của bé nhé!", DuLieuGuideSvg = "", LaBuocToMau = true }
                        );
                    }
                }
                _context.SaveChanges();
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
