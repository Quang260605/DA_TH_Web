using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DA_Web.Models;
using DA_Web.Models.NguoiDungModule;
using Microsoft.AspNetCore.SignalR;
using DA_Web.Hubs;

namespace DA_Web.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class SocialController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IHubContext<GameHub> _hubContext;

        public SocialController(ApplicationDbContext context, IHubContext<GameHub> hubContext)
        {
            _context = context;
            _hubContext = hubContext;
        }

        // Gửi lời mời kết bạn hoặc đồng ý kết bạn
        [HttpPost("add-friend")]
        public async Task<IActionResult> AddFriend([FromBody] AddFriendDto dto)
        {
            if (dto.NguoiDungId1 == dto.NguoiDungId2)
            {
                return BadRequest(new { message = "Bạn không thể tự kết bạn với chính mình!" });
            }

            // Kiểm tra xem mối quan hệ đã tồn tại chưa
            var friendship = await _context.KetBans
                .FirstOrDefaultAsync(f => 
                    (f.NguoiDungId1 == dto.NguoiDungId1 && f.NguoiDungId2 == dto.NguoiDungId2) ||
                    (f.NguoiDungId1 == dto.NguoiDungId2 && f.NguoiDungId2 == dto.NguoiDungId1));

            if (friendship == null)
            {
                // Chưa tồn tại -> Tạo yêu cầu kết bạn mới (trạng thái pending/ChoKhaiBao)
                friendship = new KetBan
                {
                    NguoiDungId1 = dto.NguoiDungId1,
                    NguoiDungId2 = dto.NguoiDungId2,
                    TrangThai = "ChoKhaiBao",
                    NgayTao = DateTime.Now
                };
                _context.KetBans.Add(friendship);
                await _context.SaveChangesAsync();

                // Gửi thông báo real-time cho đối phương
                var sender = await _context.NguoiDungs.FindAsync(dto.NguoiDungId1);
                var receiverConnId = GameHub.GetConnectionId(dto.NguoiDungId2);
                if (receiverConnId != null && sender != null)
                {
                    await _hubContext.Clients.Client(receiverConnId).SendAsync("NhanYeuCauKetBan", new
                    {
                        senderId = sender.Id,
                        senderName = sender.TenHienThi
                    });
                }

                return Ok(new { message = "Đã gửi lời mời kết bạn!", status = "ChoKhaiBao" });
            }
            else
            {
                // Đã tồn tại mối quan hệ
                if (friendship.TrangThai == "ChoKhaiBao")
                {
                    // Nếu người nhận đồng ý (người nhấn là NguoiDungId2)
                    if (friendship.NguoiDungId2 == dto.NguoiDungId1)
                    {
                        friendship.TrangThai = "DaKetBan";
                        _context.Entry(friendship).State = EntityState.Modified;
                        await _context.SaveChangesAsync();

                        // Gửi thông báo cho người gửi ban đầu biết đã đồng ý
                        var requesterConnId = GameHub.GetConnectionId(friendship.NguoiDungId1);
                        var accepterConnId = GameHub.GetConnectionId(friendship.NguoiDungId2);
                        if (requesterConnId != null)
                        {
                            await _hubContext.Clients.Client(requesterConnId).SendAsync("XacNhanDongYKetBan", friendship.NguoiDungId2);
                            if (accepterConnId != null)
                            {
                                await _hubContext.Clients.Client(requesterConnId).SendAsync("BanBeOnline", friendship.NguoiDungId2);
                                await _hubContext.Clients.Client(accepterConnId).SendAsync("BanBeOnline", friendship.NguoiDungId1);
                            }
                        }

                        return Ok(new { message = "Hai bạn đã trở thành bạn bè của nhau!", status = "DaKetBan" });
                    }
                    else
                    {
                        return Ok(new { message = "Lời mời kết bạn đang chờ phản hồi từ đối phương.", status = "ChoKhaiBao" });
                    }
                }
                else if (friendship.TrangThai == "DaKetBan")
                {
                    return BadRequest(new { message = "Hai người đã kết bạn với nhau từ trước!" });
                }
                else
                {
                    return BadRequest(new { message = "Không thể thực hiện do tài khoản đã bị chặn!" });
                }
            }
        }

        // Lấy danh sách bạn bè đã kết bạn
        [HttpGet("friends/{userId}")]
        public async Task<IActionResult> GetFriends(int userId)
        {
            var friends = await _context.KetBans
                .Where(f => (f.NguoiDungId1 == userId || f.NguoiDungId2 == userId) && f.TrangThai == "DaKetBan")
                .Include(f => f.NguoiDung1)
                .Include(f => f.NguoiDung2)
                .Select(f => f.NguoiDungId1 == userId ? f.NguoiDung2 : f.NguoiDung1)
                .Select(u => new
                {
                    id = u!.Id,
                    tenHienThi = u.TenHienThi,
                    anhDaiDienUrl = u.AnhDaiDienUrl,
                    tongDiem = u.TongDiem,
                    capDoHienTai = u.CapDoHienTai
                })
                .ToListAsync();

            return Ok(friends);
        }

        // Lấy danh sách lời mời kết bạn đang chờ đồng ý
        [HttpGet("friend-requests/{userId}")]
        public async Task<IActionResult> GetFriendRequests(int userId)
        {
            var requests = await _context.KetBans
                .Where(f => f.NguoiDungId2 == userId && f.TrangThai == "ChoKhaiBao")
                .Include(f => f.NguoiDung1)
                .Select(f => new
                {
                    friendshipId = f.Id,
                    id = f.NguoiDung1!.Id,
                    tenHienThi = f.NguoiDung1.TenHienThi,
                    anhDaiDienUrl = f.NguoiDung1.AnhDaiDienUrl
                })
                .ToListAsync();

            return Ok(requests);
        }

        [HttpGet("leaderboard/global")]
        public async Task<IActionResult> GetGlobalLeaderboard()
        {
            var topUsers = await _context.NguoiDungs
                .OrderByDescending(u => u.TongDiem)
                .Take(50) // Lấy top 50 người điểm cao nhất
                .Select(u => new
                {
                    rank = 0, // Sẽ gán sau ở bộ nhớ
                    id = u.Id,
                    tenHienThi = u.TenHienThi,
                    anhDaiDienUrl = u.AnhDaiDienUrl,
                    tongDiem = u.TongDiem,
                    capDoHienTai = u.CapDoHienTai
                })
                .ToListAsync();

            var ranked = topUsers.Select((u, i) => new
            {
                rank = i + 1,
                id = u.id,
                tenHienThi = u.tenHienThi,
                anhDaiDienUrl = u.anhDaiDienUrl,
                tongDiem = u.tongDiem,
                capDoHienTai = u.capDoHienTai
            }).ToList();

            return Ok(ranked);
        }

        // BẢNG XẾP HẠNG BẠN BÈ (FRIENDS LEADERBOARD)
        [HttpGet("leaderboard/friends/{userId}")]
        public async Task<IActionResult> GetFriendsLeaderboard(int userId)
        {
            // 1. Lấy danh sách ID của bạn bè
            var friendIds = await _context.KetBans
                .Where(f => (f.NguoiDungId1 == userId || f.NguoiDungId2 == userId) && f.TrangThai == "DaKetBan")
                .Select(f => f.NguoiDungId1 == userId ? f.NguoiDungId2 : f.NguoiDungId1)
                .ToListAsync();

            // 2. Thêm chính người dùng hiện tại vào danh sách xếp hạng
            friendIds.Add(userId);

            // 3. Lấy thông tin điểm số và sắp xếp giảm dần
            var players = await _context.NguoiDungs
                .Where(u => friendIds.Contains(u.Id))
                .OrderByDescending(u => u.TongDiem)
                .Select(u => new
                {
                    id = u.Id,
                    tenHienThi = u.TenHienThi,
                    anhDaiDienUrl = u.AnhDaiDienUrl,
                    tongDiem = u.TongDiem,
                    capDoHienTai = u.CapDoHienTai
                })
                .ToListAsync();

            // 4. Gán thứ hạng
            var ranked = players.Select((u, i) => new
            {
                rank = i + 1,
                id = u.id,
                tenHienThi = u.tenHienThi,
                anhDaiDienUrl = u.anhDaiDienUrl,
                tongDiem = u.tongDiem,
                capDoHienTai = u.capDoHienTai
            }).ToList();

            return Ok(ranked);
        }

        // Tìm kiếm người dùng bằng tên để kết bạn
        [HttpGet("search-users")]
        public async Task<IActionResult> SearchUsers([FromQuery] string query, [FromQuery] int currentUserId)
        {
            if (string.IsNullOrWhiteSpace(query))
            {
                return Ok(new List<object>());
            }

            var users = await _context.NguoiDungs
                .Where(u => u.Id != currentUserId && (u.TenDangNhap.Contains(query) || u.TenHienThi.Contains(query)))
                .Take(10)
                .Select(u => new
                {
                    id = u.Id,
                    tenHienThi = u.TenHienThi,
                    anhDaiDienUrl = u.AnhDaiDienUrl,
                    capDoHienTai = u.CapDoHienTai
                })
                .ToListAsync();

            return Ok(users);
        }

        // Lấy danh sách các phòng chờ đang mở (loại phòng là VeCungBan và trạng thái là DangCho)
        [HttpGet("active-rooms")]
        public async Task<IActionResult> GetActiveRooms()
        {
            var activeRooms = await _context.PhongChos
                .Where(p => p.LoaiPhong == "VeCungBan" && p.TrangThai == "DangCho")
                .Include(p => p.ChuPhong)
                .Select(p => new
                {
                    id = p.Id,
                    maPhong = p.MaPhong,
                    chuPhongId = p.ChuPhongId,
                    chuPhongTen = p.ChuPhong != null ? p.ChuPhong.TenHienThi : "Chủ phòng",
                    soNguoiHienTai = _context.NguoiChoiTrongPhongs.Count(rp => rp.PhongChoId == p.Id),
                    soNguoiToiDa = p.SoNguoiToiDa
                })
                .ToListAsync();

            return Ok(activeRooms);
        }

        // Hủy kết bạn (xoá bạn)
        [HttpDelete("remove-friend")]
        public async Task<IActionResult> RemoveFriend([FromBody] AddFriendDto dto)
        {
            var friendship = await _context.KetBans
                .FirstOrDefaultAsync(f => 
                    (f.NguoiDungId1 == dto.NguoiDungId1 && f.NguoiDungId2 == dto.NguoiDungId2) ||
                    (f.NguoiDungId1 == dto.NguoiDungId2 && f.NguoiDungId2 == dto.NguoiDungId1));

            if (friendship == null)
            {
                return NotFound(new { message = "Không tìm thấy mối quan hệ bạn bè này!" });
            }

            _context.KetBans.Remove(friendship);
            await _context.SaveChangesAsync();

            // Gửi tín hiệu thông báo cho người kia biết đã bị hủy kết bạn để cập nhật UI
            var receiverConnId = GameHub.GetConnectionId(dto.NguoiDungId2);
            if (receiverConnId != null)
            {
                await _hubContext.Clients.Client(receiverConnId).SendAsync("BiXoaBan", dto.NguoiDungId1);
            }

            return Ok(new { message = "Đã hủy kết bạn thành công!" });
        }
    }

    public class AddFriendDto
    {
        public int NguoiDungId1 { get; set; }
        public int NguoiDungId2 { get; set; }
    }
}
