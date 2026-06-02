using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DA_Web.Models;
using DA_Web.Models.BangVeModule;

namespace DA_Web.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class DrawingController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public DrawingController(ApplicationDbContext context)
        {
            _context = context;
        }

        // Lưu bản vẽ mới hoặc cập nhật bản vẽ hiện tại
        [HttpPost("save")]
        public async Task<IActionResult> SaveDrawing([FromBody] SaveDrawingDto dto)
        {
            BanVe? drawing;
            if (dto.Id > 0)
            {
                // Cập nhật bản vẽ hiện tại
                drawing = await _context.BanVes.FindAsync(dto.Id);
                if (drawing == null)
                {
                    return NotFound(new { message = "Không tìm thấy bản vẽ để cập nhật!" });
                }

                if (drawing.NguoiDungId != dto.NguoiDungId)
                {
                    // Kiểm tra xem có quyền vẽ chung không
                    bool coQuyen = await _context.NguoiVeChungs
                        .AnyAsync(c => c.BanVeId == dto.Id && c.NguoiDungId == dto.NguoiDungId && c.VaiTro == "BienTap");
                    
                    if (!coQuyen)
                    {
                        return Unauthorized(new { message = "Bạn không có quyền chỉnh sửa bản vẽ này!" });
                    }
                }

                drawing.TieuDe = dto.TieuDe ?? drawing.TieuDe;
                drawing.DuLieuCanvasJson = dto.DuLieuCanvasJson;
                drawing.AnhThuNhoUrl = dto.AnhThuNhoUrl ?? drawing.AnhThuNhoUrl;
                drawing.CongKhai = dto.CongKhai;
                drawing.NgayCapNhat = DateTime.Now;

                _context.Entry(drawing).State = EntityState.Modified;
            }
            else
            {
                // Tạo mới bản vẽ
                drawing = new BanVe
                {
                    NguoiDungId = dto.NguoiDungId,
                    TieuDe = dto.TieuDe ?? "Bản vẽ chưa đặt tên",
                    DuLieuCanvasJson = dto.DuLieuCanvasJson,
                    AnhThuNhoUrl = dto.AnhThuNhoUrl,
                    CongKhai = dto.CongKhai,
                    NgayTao = DateTime.Now,
                    NgayCapNhat = DateTime.Now
                };
                _context.BanVes.Add(drawing);
            }

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Lưu bản vẽ thành công!",
                drawingId = drawing.Id,
                tieuDe = drawing.TieuDe
            });
        }

        // Lấy danh sách các bản vẽ của người dùng
        [HttpGet("user/{userId}")]
        public async Task<IActionResult> GetUserDrawings(int userId)
        {
            // Lấy bản vẽ cá nhân sở hữu
            var ownDrawings = await _context.BanVes
                .Where(d => d.NguoiDungId == userId)
                .OrderByDescending(d => d.NgayCapNhat)
                .Select(d => new
                {
                    id = d.Id,
                    tieuDe = d.TieuDe,
                    anhThuNhoUrl = d.AnhThuNhoUrl,
                    congKhai = d.CongKhai,
                    ngayCapNhat = d.NgayCapNhat,
                    laChuSoHuu = true
                })
                .ToListAsync();

            // Lấy bản vẽ được mời vẽ chung
            var collabDrawings = await _context.NguoiVeChungs
                .Where(c => c.NguoiDungId == userId)
                .Include(c => c.BanVe)
                .OrderByDescending(c => c.BanVe!.NgayCapNhat)
                .Select(c => new
                {
                    id = c.BanVeId,
                    tieuDe = c.BanVe!.TieuDe,
                    anhThuNhoUrl = c.BanVe.AnhThuNhoUrl,
                    congKhai = c.BanVe.CongKhai,
                    ngayCapNhat = c.BanVe.NgayCapNhat,
                    laChuSoHuu = false
                })
                .ToListAsync();

            var allDrawings = ownDrawings.Concat(collabDrawings)
                .OrderByDescending(d => d.ngayCapNhat)
                .ToList();

            return Ok(allDrawings);
        }

        // Lấy chi tiết dữ liệu JSON của một bản vẽ để mở lên Canvas
        [HttpGet("{id}")]
        public async Task<IActionResult> GetDrawingDetails(int id, [FromQuery] int userId)
        {
            var drawing = await _context.BanVes.FindAsync(id);
            if (drawing == null)
            {
                return NotFound(new { message = "Không tìm thấy bản vẽ!" });
            }

            // Kiểm tra quyền truy cập (nếu bản vẽ công khai thì ai cũng coi được, nếu riêng tư thì chỉ chủ sở hữu hoặc người vẽ chung mới xem được)
            if (!drawing.CongKhai && drawing.NguoiDungId != userId)
            {
                bool coQuyen = await _context.NguoiVeChungs
                    .AnyAsync(c => c.BanVeId == id && c.NguoiDungId == userId);

                if (!coQuyen)
                {
                    return Unauthorized(new { message = "Bản vẽ này ở chế độ riêng tư, bạn không có quyền xem!" });
                }
            }

            return Ok(new
            {
                id = drawing.Id,
                nguoiDungId = drawing.NguoiDungId,
                tieuDe = drawing.TieuDe,
                duLieuCanvasJson = drawing.DuLieuCanvasJson,
                anhThuNhoUrl = drawing.AnhThuNhoUrl,
                congKhai = drawing.CongKhai
            });
        }

        // Xóa bản vẽ
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteDrawing(int id, [FromQuery] int userId)
        {
            var drawing = await _context.BanVes.FindAsync(id);
            if (drawing == null) return NotFound(new { message = "Không tìm thấy bản vẽ!" });

            if (drawing.NguoiDungId != userId)
            {
                return Unauthorized(new { message = "Bạn không có quyền xóa bản vẽ của người khác!" });
            }

            // Xóa người vẽ chung trước
            var collabs = await _context.NguoiVeChungs.Where(c => c.BanVeId == id).ToListAsync();
            _context.NguoiVeChungs.RemoveRange(collabs);

            _context.BanVes.Remove(drawing);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Đã xóa bản vẽ thành công!" });
        }

        // Lấy danh sách các bức tranh cộng đồng công khai
        [HttpGet("shared")]
        public async Task<IActionResult> GetSharedDrawings()
        {
            var shared = await _context.BanVes
                .Where(d => d.CongKhai)
                .Include(d => d.NguoiDung)
                .OrderByDescending(d => d.NgayCapNhat)
                .Select(d => new
                {
                    id = d.Id,
                    tieuDe = d.TieuDe,
                    anhThuNhoUrl = d.AnhThuNhoUrl,
                    tacGia = d.NguoiDung!.TenHienThi,
                    tacGiaAvatar = d.NguoiDung.AnhDaiDienUrl,
                    ngayCapNhat = d.NgayCapNhat
                })
                .ToListAsync();

            return Ok(shared);
        }

        // Thêm người vẽ chung (mời bạn vẽ chung)
        [HttpPost("invite-collaborator")]
        public async Task<IActionResult> InviteCollaborator([FromBody] InviteCollabDto dto)
        {
            var drawing = await _context.BanVes.FindAsync(dto.BanVeId);
            if (drawing == null) return NotFound(new { message = "Không tìm thấy bản vẽ!" });

            // Kiểm tra xem người dùng hiện tại có phải chủ sở hữu không
            if (drawing.NguoiDungId != dto.ChuSoHuuId)
            {
                return Unauthorized(new { message = "Chỉ chủ sở hữu bản vẽ mới có quyền mời vẽ chung!" });
            }

            // Kiểm tra xem người được mời đã vẽ chung chưa
            bool daTonTai = await _context.NguoiVeChungs
                .AnyAsync(c => c.BanVeId == dto.BanVeId && c.NguoiDungId == dto.NguoiDuocMoiId);

            if (!daTonTai)
            {
                var collab = new NguoiVeChung
                {
                    BanVeId = dto.BanVeId,
                    NguoiDungId = dto.NguoiDuocMoiId,
                    VaiTro = dto.VaiTro ?? "BienTap", // BienTap hoặc Xem
                    NgayThamGia = DateTime.Now
                };
                _context.NguoiVeChungs.Add(collab);
                await _context.SaveChangesAsync();
            }

            return Ok(new { message = "Đã cấp quyền tham gia vẽ chung thành công!" });
        }

        // Lấy danh sách tài nguyên chèn ảnh (Sticker, BG, ERD, Mindmap)
        [HttpGet("assets")]
        public async Task<IActionResult> GetAssets([FromQuery] string? type)
        {
            var query = _context.TaiNguyens.AsQueryable();
            if (!string.IsNullOrEmpty(type))
            {
                query = query.Where(a => a.LoaiTaiNguyen == type);
            }
            var assets = await query.ToListAsync();
            return Ok(assets);
        }
    }

    public class SaveDrawingDto
    {
        public int Id { get; set; }
        public int NguoiDungId { get; set; }
        public string? TieuDe { get; set; }
        public string DuLieuCanvasJson { get; set; } = string.Empty;
        public string? AnhThuNhoUrl { get; set; }
        public bool CongKhai { get; set; }
    }

    public class InviteCollabDto
    {
        public int BanVeId { get; set; }
        public int ChuSoHuuId { get; set; }
        public int NguoiDuocMoiId { get; set; }
        public string? VaiTro { get; set; } // BienTap, Xem
    }
}
