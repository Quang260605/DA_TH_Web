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

            await _context.SaveChangesAsync();

            // 4. Kiểm tra điều kiện mở khóa huy hiệu sau khi tiến trình đã được lưu
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
                .AnyAsync(p => p.NguoiDungId == userId
                    && p.TrangThai == "DaHoanThanh"
                    && p.BaiHoc != null
                    && p.BaiHoc.TieuDe.Contains("Donut"));

            if (daHoanThanhDonut)
            {
                await TraoHuyHieuNeuChuaCo(userId, 1, "Thần đồng hình học", "Hoàn thành bài tập vẽ bánh Donut tròn trịa.", "/assets/badges/badge_donut.png");
            }

            // Huy hiệu 2: Bạn của động vật (Hoàn thành bài tập vẽ Chú mèo con)
            bool daHoanThanhMeoCon = await _context.TienTrinhNguoiDungs
                .AnyAsync(p => p.NguoiDungId == userId
                    && p.TrangThai == "DaHoanThanh"
                    && p.BaiHoc != null
                    && p.BaiHoc.TieuDe.Contains("mèo"));

            if (daHoanThanhMeoCon)
            {
                await TraoHuyHieuNeuChuaCo(userId, 2, "Bạn của động vật", "Hoàn thành xuất sắc bài tập vẽ Chú mèo con đáng yêu.", "/assets/badges/badge_cat.png");
            }
        }

        private async Task TraoHuyHieuNeuChuaCo(int userId, int badgeId, string tieuDe, string moTa, string iconUrl)
        {
            // Kiểm tra HuyHieu đã tồn tại trong DB chưa, nếu chưa thì thêm mới
            var badge = await _context.HuyHieus
                .FirstOrDefaultAsync(b => b.Id == badgeId || b.TieuDe == tieuDe);

            if (badge == null)
            {
                badge = new HuyHieu
                {
                    TieuDe = tieuDe,
                    MoTa = moTa,
                    HinhAnhUrl = iconUrl
                };
                _context.HuyHieus.Add(badge);
                await _context.SaveChangesAsync();
            }

            bool daCo = await _context.HuyHieuNguoiDungs
                .AnyAsync(ub => ub.NguoiDungId == userId && ub.HuyHieuId == badge.Id);

            if (!daCo)
            {
                var userBadge = new HuyHieuNguoiDung
                {
                    NguoiDungId = userId,
                    HuyHieuId = badge.Id,
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
                    _context.CacBuocBaiHocs.AddRange(TaoBuocHuongDan(bh));
                }
                _context.SaveChanges();
            }
        }

        private static CacBuocBaiHoc[] TaoBuocHuongDan(BaiHoc bh)
        {
            var tieuDe = bh.TieuDe;

            if (tieuDe.Contains("mắt Anime", StringComparison.OrdinalIgnoreCase))
            {
                return new[]
                {
                    Buoc(bh, 1, "Bước 1: Vẽ khung mắt cong như chiếc lá mềm.", "M 36 105 Q 105 45 178 104 Q 108 142 36 105"),
                    Buoc(bh, 2, "Bước 2: Thêm tròng mắt lớn và con ngươi ở giữa.", "M 84 101 A 28 34 0 1 1 83.9 101 M 99 101 A 12 16 0 1 1 98.9 101"),
                    Buoc(bh, 3, "Bước 3: Thêm điểm sáng, mi trên và vài sợi mi cong.", "M 72 78 A 6 6 0 1 1 71.9 78 M 119 88 A 4 4 0 1 1 118.9 88 M 38 92 Q 105 30 176 91 M 62 72 L 48 52 M 86 58 L 80 37 M 132 58 L 142 36 M 158 76 L 177 58"),
                    Buoc(bh, 4, "Bước 4: Tô màu tròng mắt và nhấn sáng cho thật long lanh.", "", true)
                };
            }

            if (tieuDe.Contains("tóc Anime", StringComparison.OrdinalIgnoreCase))
            {
                return new[]
                {
                    Buoc(bh, 1, "Bước 1: Vẽ đường mái tóc ôm quanh trán.", "M 52 86 Q 103 34 164 84 M 68 84 Q 82 124 97 84 M 99 78 Q 108 127 124 80 M 129 80 Q 145 118 157 84"),
                    Buoc(bh, 2, "Bước 2: Thêm đuôi tóc bồng phía sau đầu.", "M 158 86 C 220 88 218 170 160 170 C 178 145 178 112 158 86 M 53 88 C 12 102 28 168 75 165"),
                    Buoc(bh, 3, "Bước 3: Kẻ các lọn tóc rơi xuống mềm mại.", "M 76 92 C 63 120 66 147 84 172 M 108 82 C 96 120 101 154 119 182 M 142 92 C 151 123 148 151 134 178 M 183 108 C 168 134 166 153 181 174"),
                    Buoc(bh, 4, "Bước 4: Tô màu tóc và thêm vài đường bóng nhẹ.", "", true)
                };
            }

            if (tieuDe.Contains("khuôn mặt Anime", StringComparison.OrdinalIgnoreCase))
            {
                return new[]
                {
                    Buoc(bh, 1, "Bước 1: Vẽ khuôn mặt thon với cằm nhỏ.", "M 76 54 C 42 86 51 151 108 184 C 165 151 174 86 140 54 C 121 42 95 42 76 54"),
                    Buoc(bh, 2, "Bước 2: Chia trục mặt và đặt hai mắt cân nhau.", "M 108 58 L 108 180 M 66 111 Q 84 96 102 110 M 114 110 Q 134 96 151 111"),
                    Buoc(bh, 3, "Bước 3: Thêm tóc, mũi, miệng và cổ.", "M 55 83 Q 104 16 164 82 M 79 77 Q 92 125 108 82 M 108 122 Q 102 137 109 144 M 94 155 Q 108 164 124 155 M 88 181 L 82 218 M 128 181 L 134 218"),
                    Buoc(bh, 4, "Bước 4: Tô da, tóc và mắt để khuôn mặt có chiều sâu.", "", true)
                };
            }

            if (tieuDe.Contains("đầu chú mèo", StringComparison.OrdinalIgnoreCase))
            {
                return new[]
                {
                    Buoc(bh, 1, "Bước 1: Vẽ đầu mèo tròn hơi phúng phính.", "M 108 54 C 58 54 35 94 43 135 C 51 178 163 178 173 135 C 183 93 158 54 108 54"),
                    Buoc(bh, 2, "Bước 2: Thêm hai tai tam giác phía trên.", "M 66 72 L 50 28 L 90 58 M 128 58 L 168 28 L 151 72"),
                    Buoc(bh, 3, "Bước 3: Vẽ mắt, mũi, miệng và râu mèo.", "M 82 116 A 7 7 0 1 1 81.9 116 M 134 116 A 7 7 0 1 1 133.9 116 M 108 130 L 101 140 L 115 140 Z M 108 140 Q 96 154 84 144 M 108 140 Q 120 154 132 144 M 69 134 L 28 124 M 69 146 L 28 151 M 147 134 L 188 124 M 147 146 L 188 151"),
                    Buoc(bh, 4, "Bước 4: Tô màu má, tai và bộ lông cho chú mèo.", "", true)
                };
            }

            if (tieuDe.Contains("tai mèo", StringComparison.OrdinalIgnoreCase))
            {
                return new[]
                {
                    Buoc(bh, 1, "Bước 1: Vẽ phần đỉnh đầu cong nhẹ.", "M 54 126 Q 108 78 162 126"),
                    Buoc(bh, 2, "Bước 2: Dựng hai tai mèo nhọn và cân nhau.", "M 61 123 L 42 43 L 95 91 M 121 91 L 174 43 L 155 123"),
                    Buoc(bh, 3, "Bước 3: Thêm tai trong và vài sợi lông nhỏ.", "M 62 101 L 55 61 L 85 89 M 132 89 L 162 61 L 154 101 M 82 124 Q 108 137 134 124 M 86 105 L 74 94 M 130 105 L 142 94"),
                    Buoc(bh, 4, "Bước 4: Tô hồng tai trong và thêm màu lông tùy thích.", "", true)
                };
            }

            if (tieuDe.Contains("mèo con hoàn chỉnh", StringComparison.OrdinalIgnoreCase))
            {
                return new[]
                {
                    Buoc(bh, 1, "Bước 1: Vẽ đầu tròn và thân mèo nhỏ bên dưới.", "M 105 39 C 63 39 43 72 47 112 C 51 151 158 151 163 112 C 168 72 147 39 105 39 M 77 151 C 57 188 72 226 107 226 C 143 226 159 188 138 151"),
                    Buoc(bh, 2, "Bước 2: Thêm tai, chân và chiếc đuôi cong.", "M 65 58 L 49 20 L 89 47 M 121 47 L 162 20 L 145 58 M 78 216 Q 91 203 104 216 M 112 216 Q 126 203 139 216 M 141 172 C 206 166 202 94 159 116"),
                    Buoc(bh, 3, "Bước 3: Hoàn thiện mặt, râu và móng nhỏ.", "M 84 99 A 6 6 0 1 1 83.9 99 M 126 99 A 6 6 0 1 1 125.9 99 M 105 114 L 98 123 L 112 123 Z M 105 123 Q 93 138 80 129 M 105 123 Q 118 138 131 129 M 72 121 L 35 111 M 72 133 L 35 137 M 138 121 L 175 111 M 138 133 L 175 137"),
                    Buoc(bh, 4, "Bước 4: Tô màu thân mèo, đuôi và đôi má đáng yêu.", "", true)
                };
            }

            if (tieuDe.Contains("vòng bánh Donut", StringComparison.OrdinalIgnoreCase))
            {
                return new[]
                {
                    Buoc(bh, 1, "Bước 1: Vẽ vòng ngoài của chiếc donut hơi dẹt.", "M 36 112 C 36 62 180 62 180 112 C 180 162 36 162 36 112"),
                    Buoc(bh, 2, "Bước 2: Vẽ lỗ tròn nhỏ ở giữa bánh.", "M 88 112 C 88 91 128 91 128 112 C 128 133 88 133 88 112"),
                    Buoc(bh, 3, "Bước 3: Thêm viền bánh dày và vài nét bo mềm.", "M 50 112 C 55 77 163 77 166 112 C 164 148 54 148 50 112 M 72 91 Q 84 78 104 80 M 136 83 Q 153 93 156 111 M 131 141 Q 111 151 88 141"),
                    Buoc(bh, 4, "Bước 4: Tô màu vàng nâu để chiếc bánh trông thơm ngon.", "", true)
                };
            }

            if (tieuDe.Contains("kem dâu", StringComparison.OrdinalIgnoreCase))
            {
                return new[]
                {
                    Buoc(bh, 1, "Bước 1: Vẽ nền bánh donut làm khung cho lớp kem.", "M 36 122 C 36 72 180 72 180 122 C 180 172 36 172 36 122 M 91 122 C 91 100 125 100 125 122 C 125 144 91 144 91 122"),
                    Buoc(bh, 2, "Bước 2: Vẽ lớp kem dâu chảy lượn sóng trên mặt bánh.", "M 50 109 C 68 83 90 103 106 86 C 122 103 145 83 166 109 C 158 144 57 144 50 109 M 68 134 C 69 158 91 155 91 134 M 129 134 C 131 160 154 154 151 132"),
                    Buoc(bh, 3, "Bước 3: Thêm quả dâu nhỏ và vài hạt cốm trang trí.", "M 108 58 C 82 79 89 113 108 126 C 129 113 135 79 108 58 M 96 61 L 107 48 L 119 61 M 82 96 L 73 91 M 139 96 L 148 91 M 74 118 L 65 123 M 143 119 L 153 124 M 103 82 L 104 86 M 116 93 L 117 97 M 101 109 L 102 113"),
                    Buoc(bh, 4, "Bước 4: Tô kem màu hồng dâu và thêm màu đỏ cho quả dâu.", "", true)
                };
            }

            if (tieuDe.Contains("bánh Donut màu sắc", StringComparison.OrdinalIgnoreCase))
            {
                return new[]
                {
                    Buoc(bh, 1, "Bước 1: Vẽ thân donut và lỗ bánh ở giữa.", "M 34 116 C 34 56 184 56 184 116 C 184 176 34 176 34 116 M 88 116 C 88 91 130 91 130 116 C 130 141 88 141 88 116"),
                    Buoc(bh, 2, "Bước 2: Thêm lớp kem phủ uốn lượn quanh bánh.", "M 47 101 C 64 74 89 100 107 80 C 124 100 150 73 170 102 C 166 153 53 153 47 101 M 66 139 C 70 166 93 157 92 137 M 127 138 C 126 166 151 158 150 137"),
                    Buoc(bh, 3, "Bước 3: Rắc cốm màu bằng những nét ngắn vui mắt.", "M 65 99 L 78 93 M 88 131 L 101 137 M 118 96 L 127 87 M 141 125 L 154 131 M 55 126 L 46 134 M 160 105 L 174 100 M 109 150 L 119 158 M 76 114 L 84 123 M 137 91 L 147 84"),
                    Buoc(bh, 4, "Bước 4: Tô bánh, kem và cốm bằng nhiều màu rực rỡ.", "", true)
                };
            }

            if (tieuDe.Contains("chiếc lá", StringComparison.OrdinalIgnoreCase))
            {
                return new[]
                {
                    Buoc(bh, 1, "Bước 1: Vẽ dáng chiếc lá cong nhọn hai đầu.", "M 42 126 C 78 54 145 42 186 101 C 133 169 78 167 42 126"),
                    Buoc(bh, 2, "Bước 2: Kẻ gân chính từ cuống tới ngọn lá.", "M 44 126 C 85 113 127 93 186 101"),
                    Buoc(bh, 3, "Bước 3: Thêm các gân phụ tỏa đều hai bên.", "M 82 113 L 72 86 M 102 105 L 100 76 M 124 96 L 133 69 M 82 114 L 75 142 M 111 101 L 112 137 M 143 98 L 154 128 M 43 126 L 24 145"),
                    Buoc(bh, 4, "Bước 4: Tô xanh lá và nhấn gân bằng màu đậm hơn.", "", true)
                };
            }

            if (tieuDe.Contains("thân cây mầm", StringComparison.OrdinalIgnoreCase))
            {
                return new[]
                {
                    Buoc(bh, 1, "Bước 1: Vẽ chậu cây nhỏ phía dưới.", "M 62 161 L 157 161 L 145 226 L 74 226 Z M 52 147 L 167 147 L 157 161 L 62 161 Z"),
                    Buoc(bh, 2, "Bước 2: Vẽ thân cây mầm vươn lên từ chậu.", "M 110 147 C 104 122 111 94 109 63 M 121 147 C 126 119 120 93 124 66"),
                    Buoc(bh, 3, "Bước 3: Thêm hai chiếc lá non hai bên thân.", "M 109 91 C 68 63 50 99 93 113 C 102 109 107 101 109 91 M 121 92 C 163 63 184 99 139 114 C 130 109 123 102 121 92"),
                    Buoc(bh, 4, "Bước 4: Tô chậu, thân cây và lá non bằng màu tươi sáng.", "", true)
                };
            }

            if (tieuDe.Contains("hoa hướng dương", StringComparison.OrdinalIgnoreCase))
            {
                return new[]
                {
                    Buoc(bh, 1, "Bước 1: Vẽ nhụy hoa tròn ở giữa.", "M 110 93 A 34 34 0 1 1 109.9 93 M 110 93 A 14 14 0 1 1 109.9 93"),
                    Buoc(bh, 2, "Bước 2: Vẽ các cánh hoa dài tỏa quanh nhụy.", "M 110 59 Q 96 24 110 8 Q 124 24 110 59 M 135 69 Q 168 45 184 58 Q 164 72 141 88 M 145 110 Q 185 119 190 139 Q 163 140 137 126 M 110 127 Q 126 162 110 180 Q 94 162 110 127 M 82 111 Q 42 120 36 140 Q 63 141 89 126 M 80 69 Q 47 45 31 58 Q 51 72 78 88"),
                    Buoc(bh, 3, "Bước 3: Thêm thân cây và hai chiếc lá.", "M 110 127 C 105 160 108 190 105 230 M 120 128 C 124 160 119 190 122 230 M 107 177 C 64 150 48 185 91 197 M 121 181 C 166 154 182 188 137 202"),
                    Buoc(bh, 4, "Bước 4: Tô cánh vàng, nhụy nâu và lá xanh.", "", true)
                };
            }

            return new[]
            {
                Buoc(bh, 1, "Bước 1: Vẽ khung chính của hình.", "M 50 120 Q 105 48 164 120 Q 105 184 50 120"),
                Buoc(bh, 2, "Bước 2: Thêm các chi tiết lớn bên trong.", "M 78 105 Q 107 82 136 105 M 82 136 Q 107 156 132 136"),
                Buoc(bh, 3, "Bước 3: Hoàn thiện các nét trang trí nhỏ.", "M 96 96 L 90 84 M 120 96 L 128 84 M 86 146 L 72 154 M 130 146 L 146 154"),
                Buoc(bh, 4, "Bước 4: Tô màu để hoàn thiện bài vẽ.", "", true)
            };
        }

        private static CacBuocBaiHoc Buoc(BaiHoc bh, int soThuTu, string huongDan, string svgPath, bool laBuocToMau = false)
        {
            return new CacBuocBaiHoc
            {
                BaiHocId = bh.Id,
                SoThuTuBuoc = soThuTu,
                ChuKyHuongDan = huongDan,
                DuLieuGuideSvg = svgPath,
                LaBuocToMau = laBuocToMau
            };
        }
    }

    public class SubmitLessonDto
    {
        public int NguoiDungId { get; set; }
        public int BaiHocId { get; set; }
        public string AnhVeBase64 { get; set; } = string.Empty;
    }
}
