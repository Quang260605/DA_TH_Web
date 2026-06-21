using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using DA_Web.Models;
using DA_Web.Models.NguoiDungModule;
using DA_Web.Models.PhongChoModule;
using DA_Web.Models.TroChoiModule;

namespace DA_Web.Hubs
{
    public class GameHub : Hub
    {
        private readonly ApplicationDbContext _context;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IHubContext<GameHub> _hubContext;
        // Quản lý ánh xạ ConnectionId -> UserId và ngược lại để theo dõi trạng thái Online
        private static readonly ConcurrentDictionary<string, int> ConnectionToUser = new();
        private static readonly ConcurrentDictionary<int, string> UserToConnection = new();
        private static readonly ConcurrentDictionary<string, GameRoomState> ActiveGames = new();

        public static string? GetConnectionId(int userId)
        {
            return UserToConnection.TryGetValue(userId, out var connId) ? connId : null;
        }

        public GameHub(ApplicationDbContext context, IServiceScopeFactory scopeFactory, IHubContext<GameHub> hubContext)
        {
            _context = context;
            _scopeFactory = scopeFactory;
            _hubContext = hubContext;
        }

        // Kết nối hệ thống bạn bè online
        public async Task KetNoi(int userId)
        {
            ConnectionToUser[Context.ConnectionId] = userId;
            UserToConnection[userId] = Context.ConnectionId;

            // Tự động khôi phục nhóm SignalR nếu người chơi đang ở trong phòng chờ/phòng chơi nào đó
            var phongHienTai = await _context.NguoiChoiTrongPhongs
                .Include(rp => rp.PhongCho)
                .Where(rp => rp.NguoiDungId == userId && (rp.PhongCho!.TrangThai == "DangCho" || rp.PhongCho.TrangThai == "DangChoi"))
                .Select(rp => rp.PhongCho!.MaPhong)
                .FirstOrDefaultAsync();

            if (phongHienTai != null)
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, $"Room_{phongHienTai}");
            }

            // Cập nhật trạng thái online đến bạn bè của người này
            var banBeIds = await _context.KetBans
                .Where(kb => (kb.NguoiDungId1 == userId || kb.NguoiDungId2 == userId) && kb.TrangThai == "DaKetBan")
                .Select(kb => kb.NguoiDungId1 == userId ? kb.NguoiDungId2 : kb.NguoiDungId1)
                .ToListAsync();

            foreach (var banId in banBeIds)
            {
                if (UserToConnection.TryGetValue(banId, out string? connId))
                {
                    await Clients.Client(connId).SendAsync("BanBeOnline", userId);
                }
            }

            await Clients.Caller.SendAsync("XacNhanKetNoi", "Kết nối thành công!");
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            if (ConnectionToUser.TryRemove(Context.ConnectionId, out int userId))
            {
                UserToConnection.TryRemove(userId, out _);

                // Thông báo bạn bè offline
                var banBeIds = await _context.KetBans
                    .Where(kb => (kb.NguoiDungId1 == userId || kb.NguoiDungId2 == userId) && kb.TrangThai == "DaKetBan")
                    .Select(kb => kb.NguoiDungId1 == userId ? kb.NguoiDungId2 : kb.NguoiDungId1)
                    .ToListAsync();

                foreach (var banId in banBeIds)
                {
                    if (UserToConnection.TryGetValue(banId, out string? connId))
                    {
                        await Clients.Client(connId).SendAsync("BanBeOffline", userId);
                    }
                }

                // Xử lý nếu người chơi mất kết nối khi đang chơi game (DangChoi)
                var activePlayer = await _context.NguoiChoiTrongPhongs
                    .Include(rp => rp.PhongCho)
                    .FirstOrDefaultAsync(rp => rp.NguoiDungId == userId && rp.PhongCho!.TrangThai == "DangChoi");

                if (activePlayer != null)
                {
                    var room = activePlayer.PhongCho!;
                    room.TrangThai = "DaKetThuc";
                    _context.Entry(room).State = EntityState.Modified;
                    _context.NguoiChoiTrongPhongs.Remove(activePlayer);
                    await _context.SaveChangesAsync();

                    ActiveGames.TryRemove(room.MaPhong, out _);

                    await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"Room_{room.MaPhong}");
                    await Clients.Group($"Room_{room.MaPhong}").SendAsync("GameBiHuyDocDuong", userId, "Người chơi mất kết nối, game đã bị hủy.");
                }

                // Xử lý tự động thoát phòng nếu đang ở trong phòng chờ nào đó
                var player = await _context.NguoiChoiTrongPhongs
                    .Include(rp => rp.PhongCho)
                    .FirstOrDefaultAsync(rp => rp.NguoiDungId == userId && rp.PhongCho!.TrangThai == "DangCho");

                if (player != null)
                {
                    var room = player.PhongCho!;
                    _context.NguoiChoiTrongPhongs.Remove(player);
                    await _context.SaveChangesAsync();

                    await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"Room_{room.MaPhong}");
                    await Clients.Group($"Room_{room.MaPhong}").SendAsync("NguoiChoiThoatPhong", userId);

                    // Nếu chủ phòng thoát, chuyển quyền chủ phòng hoặc đóng phòng
                    if (room.ChuPhongId == userId)
                    {
                        var nguoiChoiConLai = await _context.NguoiChoiTrongPhongs
                            .Where(rp => rp.PhongChoId == room.Id)
                            .FirstOrDefaultAsync();

                        if (nguoiChoiConLai != null)
                        {
                            room.ChuPhongId = nguoiChoiConLai.NguoiDungId;
                            _context.Entry(room).State = EntityState.Modified;
                            await _context.SaveChangesAsync();
                            await Clients.Group($"Room_{room.MaPhong}").SendAsync("ChuPhongMoi", room.ChuPhongId);
                        }
                    }

                    // Đảm bảo đóng phòng nếu không còn ai
                    var playersLeft = await _context.NguoiChoiTrongPhongs.CountAsync(rp => rp.PhongChoId == room.Id);
                    if (playersLeft == 0)
                    {
                        room.TrangThai = "DaKetThuc";
                        _context.Entry(room).State = EntityState.Modified;
                        await _context.SaveChangesAsync();
                    }
                }
            }

            await base.OnDisconnectedAsync(exception);
        }

        // ======================= MODULE 4: PHÒNG CHỜ & GHÉP TRẬN =======================

        private async Task RemoveUserFromAllRooms(int userId, string excludeMaPhong = null)
        {
            var oldRooms = await _context.NguoiChoiTrongPhongs
                .Include(rp => rp.PhongCho)
                .Where(rp => rp.NguoiDungId == userId && (excludeMaPhong == null || rp.PhongCho!.MaPhong != excludeMaPhong))
                .ToListAsync();

            foreach (var player in oldRooms)
            {
                var room = player.PhongCho!;
                _context.NguoiChoiTrongPhongs.Remove(player);
                await _context.SaveChangesAsync();

                if (UserToConnection.TryGetValue(userId, out string connId))
                {
                    await Groups.RemoveFromGroupAsync(connId, $"Room_{room.MaPhong}");
                }
                
                await Clients.Group($"Room_{room.MaPhong}").SendAsync("NguoiChoiThoatPhong", userId);

                if (room.ChuPhongId == userId)
                {
                    var nguoiChoiConLai = await _context.NguoiChoiTrongPhongs
                        .Where(rp => rp.PhongChoId == room.Id)
                        .FirstOrDefaultAsync();

                    if (nguoiChoiConLai != null)
                    {
                        room.ChuPhongId = nguoiChoiConLai.NguoiDungId;
                        _context.Entry(room).State = EntityState.Modified;
                        await _context.SaveChangesAsync();
                        await Clients.Group($"Room_{room.MaPhong}").SendAsync("ChuPhongMoi", room.ChuPhongId);
                    }
                }

                var playersLeft = await _context.NguoiChoiTrongPhongs.CountAsync(rp => rp.PhongChoId == room.Id);
                if (playersLeft == 0)
                {
                    room.TrangThai = "DaKetThuc";
                    _context.Entry(room).State = EntityState.Modified;
                    await _context.SaveChangesAsync();
                }
            }
        }

        public async Task HuyTimPhong(int userId)
        {
            await RemoveUserFromAllRooms(userId);
        }

        public async Task KickNguoiChoi(string maPhong, int targetUserId)
        {
            if (!ConnectionToUser.TryGetValue(Context.ConnectionId, out int hostId)) return;

            var room = await _context.PhongChos.FirstOrDefaultAsync(p => p.MaPhong == maPhong && p.TrangThai == "DangCho");
            if (room == null || room.ChuPhongId != hostId) return; // Chỉ chủ phòng mới được kick

            var targetPlayer = await _context.NguoiChoiTrongPhongs
                .FirstOrDefaultAsync(rp => rp.NguoiDungId == targetUserId && rp.PhongChoId == room.Id);

            if (targetPlayer != null)
            {
                _context.NguoiChoiTrongPhongs.Remove(targetPlayer);
                await _context.SaveChangesAsync();

                if (UserToConnection.TryGetValue(targetUserId, out string targetConnId))
                {
                    await Groups.RemoveFromGroupAsync(targetConnId, $"Room_{maPhong}");
                    await Clients.Client(targetConnId).SendAsync("BiKickKhoiPhong");
                }
                
                await Clients.Group($"Room_{maPhong}").SendAsync("NguoiChoiThoatPhong", targetUserId);
            }
        }

        // Tạo phòng chờ mới
        public async Task TaoPhong(int userId, string loaiPhong)
        {
            await RemoveUserFromAllRooms(userId);
            
            // loaiPhong: GhepNgauNhien, VeCungBan, TroChoiMini
            string maPhong = GenerateRoomCode();
            var user = await _context.NguoiDungs.FindAsync(userId);
            if (user == null) return;

            var phong = new PhongCho
            {
                MaPhong = maPhong,
                ChuPhongId = userId,
                LoaiPhong = loaiPhong,
                TrangThai = "DangCho",
                SoNguoiToiDa = (loaiPhong == "TroChoiMini" || loaiPhong == "GhepNgauNhien") ? 8 : 2,
                NgayTao = DateTime.Now
            };

            _context.PhongChos.Add(phong);
            await _context.SaveChangesAsync();

            var nguoiChoi = new NguoiChoiTrongPhong
            {
                PhongChoId = phong.Id,
                NguoiDungId = userId,
                SanSang = true, // Chủ phòng luôn sẵn sàng
                NgayThamGia = DateTime.Now
            };

            _context.NguoiChoiTrongPhongs.Add(nguoiChoi);
            await _context.SaveChangesAsync();

            await Groups.AddToGroupAsync(Context.ConnectionId, $"Room_{maPhong}");

            await Clients.Caller.SendAsync("RoomCreated", new
            {
                phongId = phong.Id,
                maPhong = phong.MaPhong,
                chuPhongId = phong.ChuPhongId,
                loaiPhong = phong.LoaiPhong,
                soNguoiToiDa = phong.SoNguoiToiDa
            });
        }

        // Ghép trận ngẫu nhiên (Tìm phòng có sẵn hoặc tự tạo phòng mới)
        public async Task GhepTrangNgauNhien(int userId)
        {
            // Tìm các phòng loại GhepNgauNhien đang ở trạng thái DangCho
            var tatCaPhongDangCho = await _context.PhongChos
                .Where(p => p.LoaiPhong == "GhepNgauNhien" && p.TrangThai == "DangCho")
                .OrderBy(p => p.NgayTao)
                .ToListAsync();

            PhongCho? phongKhaDung = null;
            foreach (var p in tatCaPhongDangCho)
            {
                var count = await _context.NguoiChoiTrongPhongs.CountAsync(rp => rp.PhongChoId == p.Id);
                if (count < p.SoNguoiToiDa)
                {
                    phongKhaDung = p;
                    break;
                }
            }

            if (phongKhaDung != null)
            {
                await ThamGiaPhong(phongKhaDung.MaPhong, userId);
            }
            else
            {
                await TaoPhong(userId, "GhepNgauNhien");
            }
        }

        // Tham gia phòng bằng mã phòng
        public async Task ThamGiaPhong(string maPhong, int userId)
        {
            var phong = await _context.PhongChos
                .FirstOrDefaultAsync(p => p.MaPhong == maPhong && p.TrangThai == "DangCho");

            if (phong == null)
            {
                await Clients.Caller.SendAsync("LoiPhong", "Phòng không tồn tại hoặc đã bắt đầu chơi.");
                return;
            }

            var soLuongHienTai = await _context.NguoiChoiTrongPhongs.CountAsync(rp => rp.PhongChoId == phong.Id);
            if (soLuongHienTai >= phong.SoNguoiToiDa)
            {
                await Clients.Caller.SendAsync("LoiPhong", "Phòng đã đầy người chơi.");
                return;
            }

            await RemoveUserFromAllRooms(userId, phong.MaPhong);

            // Kiểm tra xem đã trong phòng chưa
            var daTrongPhong = await _context.NguoiChoiTrongPhongs
                .AnyAsync(rp => rp.PhongChoId == phong.Id && rp.NguoiDungId == userId);

            if (!daTrongPhong)
            {
                var nguoiChoi = new NguoiChoiTrongPhong
                {
                    PhongChoId = phong.Id,
                    NguoiDungId = userId,
                    SanSang = false,
                    NgayThamGia = DateTime.Now
                };
                _context.NguoiChoiTrongPhongs.Add(nguoiChoi);
                await _context.SaveChangesAsync();
            }

            await Groups.AddToGroupAsync(Context.ConnectionId, $"Room_{maPhong}");

            var danhSachNguoiChoi = await _context.NguoiChoiTrongPhongs
                .Where(rp => rp.PhongChoId == phong.Id)
                .Include(rp => rp.NguoiDung)
                .Select(rp => new
                {
                    userId = rp.NguoiDungId,
                    tenHienThi = rp.NguoiDung!.TenHienThi,
                    anhDaiDienUrl = rp.NguoiDung.AnhDaiDienUrl,
                    sanSang = rp.SanSang,
                    isChuPhong = rp.NguoiDungId == phong.ChuPhongId
                })
                .ToListAsync();

            // Thông báo cho cả phòng danh sách người chơi mới
            await Clients.Group($"Room_{maPhong}").SendAsync("CapNhatPhong", maPhong, danhSachNguoiChoi);

            // Gửi sự kiện cho người vừa join để họ chuyển giao diện
            await Clients.Caller.SendAsync("RoomJoined", new
            {
                phongId = phong.Id,
                maPhong = phong.MaPhong,
                chuPhongId = phong.ChuPhongId,
                loaiPhong = phong.LoaiPhong,
                soNguoiToiDa = phong.SoNguoiToiDa
            });
        }

        // Thoát phòng chủ động
        public async Task ThoatPhong(string maPhong, int userId)
        {
            var player = await _context.NguoiChoiTrongPhongs
                .Include(rp => rp.PhongCho)
                .FirstOrDefaultAsync(rp => rp.NguoiDungId == userId && rp.PhongCho!.MaPhong == maPhong);

            if (player != null)
            {
                var room = player.PhongCho!;
                _context.NguoiChoiTrongPhongs.Remove(player);
                await _context.SaveChangesAsync();

                await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"Room_{maPhong}");
                
                // Báo cho những người còn lại
                await Clients.Group($"Room_{maPhong}").SendAsync("NguoiChoiThoatPhong", userId);

                // Chuyển chủ phòng hoặc đóng phòng nếu chủ phòng thoát
                if (room.ChuPhongId == userId)
                {
                    var nguoiChoiConLai = await _context.NguoiChoiTrongPhongs
                        .Where(rp => rp.PhongChoId == room.Id)
                        .FirstOrDefaultAsync();

                    if (nguoiChoiConLai != null)
                    {
                        room.ChuPhongId = nguoiChoiConLai.NguoiDungId;
                        _context.Entry(room).State = EntityState.Modified;
                        await _context.SaveChangesAsync();
                        await Clients.Group($"Room_{maPhong}").SendAsync("ChuPhongMoi", room.ChuPhongId);
                    }
                }

                var playersLeft = await _context.NguoiChoiTrongPhongs.CountAsync(rp => rp.PhongChoId == room.Id);
                if (playersLeft == 0)
                {
                    room.TrangThai = "DaKetThuc";
                    _context.Entry(room).State = EntityState.Modified;
                    await _context.SaveChangesAsync();
                }
            }
        }


        // Bấm Sẵn sàng
        public async Task ThayDoiSanSang(string maPhong, int userId)
        {
            var player = await _context.NguoiChoiTrongPhongs
                .Include(rp => rp.PhongCho)
                .FirstOrDefaultAsync(rp => rp.NguoiDungId == userId && rp.PhongCho!.MaPhong == maPhong);

            if (player != null)
            {
                player.SanSang = !player.SanSang;
                _context.Entry(player).State = EntityState.Modified;
                await _context.SaveChangesAsync();

                await Clients.Group($"Room_{maPhong}").SendAsync("NguoiChoiThayDoiSanSang", userId, player.SanSang);
            }
        }

        // ======================= MODULE 3: BẢNG VẼ NÂNG CAO (VẼ CHUNG) =======================

        // Gửi nét vẽ thời gian thực cho người cùng phòng (vẽ chung)
        public async Task DongBoNetVe(string maPhong, string duLieuNetVe)
        {
            // duLieuNetVe: chuỗi JSON chứa tọa độ nét vẽ mới, loại màu, nét bút của Fabric.js
            // Chỉ gửi cho NHỮNG NGƯỜI CHƠI KHÁC trong phòng (Exclude Caller)
            await Clients.OthersInGroup($"Room_{maPhong}").SendAsync("NhanNetVeDongBo", duLieuNetVe);
        }

        // Mời bạn vẽ chung (nhấn mời ở Sidebar bạn bè)
        public async Task MoiBanVeChung(int nguoiMoiId, int nguoiDuocMoiId, int banVeId)
        {
            if (UserToConnection.TryGetValue(nguoiDuocMoiId, out string? connId))
            {
                var nguoiMoi = await _context.NguoiDungs.FindAsync(nguoiMoiId);
                var banVe = await _context.BanVes.FindAsync(banVeId);
                if (nguoiMoi != null && banVe != null)
                {
                    await Clients.Client(connId).SendAsync("NhanLoiMoiVeChung", new
                    {
                        nguoiMoiId = nguoiMoiId,
                        tenNguoiMoi = nguoiMoi.TenHienThi,
                        banVeId = banVeId,
                        tieuDeBanVe = banVe.TieuDe
                    });
                }
            }
        }

        // Chủ phòng mở phòng rộng rãi ra cộng đồng (đổi LoaiPhong sang GhepNgauNhien)
        public async Task MoPhongCongDong(string maPhong)
        {
            var room = await _context.PhongChos
                .FirstOrDefaultAsync(p => p.MaPhong == maPhong && p.TrangThai == "DangCho");

            if (room == null)
            {
                await Clients.Caller.SendAsync("LoiPhong", "Phòng không tồn tại hoặc đã bắt đầu chơi.");
                return;
            }

            if (!ConnectionToUser.TryGetValue(Context.ConnectionId, out int userId))
            {
                await Clients.Caller.SendAsync("LoiPhong", "Không tìm thấy phiên người dùng.");
                return;
            }

            if (room.ChuPhongId != userId)
            {
                await Clients.Caller.SendAsync("LoiPhong", "Chỉ chủ phòng mới có quyền mở rộng phòng ra cộng đồng.");
                return;
            }

            room.LoaiPhong = "GhepNgauNhien";
            room.SoNguoiToiDa = 12;
            _context.Entry(room).State = EntityState.Modified;
            await _context.SaveChangesAsync();

            await Clients.Group($"Room_{maPhong}").SendAsync("PhongDaMoCongDong", room.SoNguoiToiDa);

            var danhSachNguoiChoi = await _context.NguoiChoiTrongPhongs
                .Where(rp => rp.PhongChoId == room.Id)
                .Include(rp => rp.NguoiDung)
                .Select(rp => new
                {
                    userId = rp.NguoiDungId,
                    tenHienThi = rp.NguoiDung!.TenHienThi,
                    anhDaiDienUrl = rp.NguoiDung.AnhDaiDienUrl,
                    sanSang = rp.SanSang,
                    isChuPhong = rp.NguoiDungId == room.ChuPhongId
                })
                .ToListAsync();

            await Clients.Group($"Room_{maPhong}").SendAsync("CapNhatPhong", maPhong, danhSachNguoiChoi);
        }

        // Thay đổi trạng thái khóa phòng (khoa: true -> khóa phòng riêng tư, khoa: false -> mở phòng công khai)
        public async Task ThayDoiKhoaPhong(string maPhong, bool khoa)
        {
            var room = await _context.PhongChos
                .FirstOrDefaultAsync(p => p.MaPhong == maPhong && p.TrangThai == "DangCho");

            if (room == null)
            {
                await Clients.Caller.SendAsync("LoiPhong", "Phòng không tồn tại hoặc đã bắt đầu chơi.");
                return;
            }

            if (!ConnectionToUser.TryGetValue(Context.ConnectionId, out int userId))
            {
                await Clients.Caller.SendAsync("LoiPhong", "Không tìm thấy phiên người dùng.");
                return;
            }

            if (room.ChuPhongId != userId)
            {
                await Clients.Caller.SendAsync("LoiPhong", "Chỉ chủ phòng mới có quyền thay đổi khóa phòng.");
                return;
            }

            if (khoa)
            {
                // Khóa phòng: Chuyển về phòng riêng tư
                room.LoaiPhong = room.SoNguoiToiDa <= 2 ? "VeCungBan" : "TroChoiMini";
            }
            else
            {
                // Mở phòng: Chuyển về phòng công khai
                room.LoaiPhong = "GhepNgauNhien";
            }

            _context.Entry(room).State = EntityState.Modified;
            await _context.SaveChangesAsync();

            await Clients.Group($"Room_{maPhong}").SendAsync("CapNhatKhoaPhong", room.LoaiPhong);

            var danhSachNguoiChoi = await _context.NguoiChoiTrongPhongs
                .Where(rp => rp.PhongChoId == room.Id)
                .Include(rp => rp.NguoiDung)
                .Select(rp => new
                {
                    userId = rp.NguoiDungId,
                    tenHienThi = rp.NguoiDung!.TenHienThi,
                    anhDaiDienUrl = rp.NguoiDung.AnhDaiDienUrl,
                    sanSang = rp.SanSang,
                    isChuPhong = rp.NguoiDungId == room.ChuPhongId
                })
                .ToListAsync();

            await Clients.Group($"Room_{maPhong}").SendAsync("CapNhatPhong", maPhong, danhSachNguoiChoi);
        }

        // Mời bạn bè vào phòng game (chuột phải bạn bè -> Mời bạn)
        public async Task MoiBanVaoPhong(int nguoiMoiId, int nguoiDuocMoiId, string maPhong)
        {
            if (UserToConnection.TryGetValue(nguoiDuocMoiId, out string? connId))
            {
                var nguoiMoi = await _context.NguoiDungs.FindAsync(nguoiMoiId);
                if (nguoiMoi != null)
                {
                    await Clients.Client(connId).SendAsync("NhanLoiMoiVaoPhong", new
                    {
                        nguoiMoiId = nguoiMoiId,
                        tenNguoiMoi = nguoiMoi.TenHienThi,
                        maPhong = maPhong
                    });
                }
            }
        }

        // ======================= MODULE 5: TRÒ CHƠI VẼ VÀ ĐOÁN (DRAW & GUESS) =======================

        private static readonly List<string> WordDatabase = new()
        {
            "Con mèo", "Quả táo", "Cái bàn", "Xe đạp", "Khủng long", "Phi thuyền", "Mặt trời", "Pizza", "Ngôi nhà", "Bàn chải",
            "Cá mập", "Hoa hướng dương", "Bóng đá", "Người nhện", "Rô bốt", "Bánh sinh nhật", "Rạp xiếc", "Lâu đài", "Cây cầu", "Kim tự tháp",
            "Khinh khí cầu", "Đàn ghi ta", "Cái ô", "Máy bay", "Tàu hỏa", "Con voi", "Con sư tử", "Cá vàng", "Con chuột", "Quả chuối",
            "Cà rốt", "Dưa hấu", "Kem", "Bánh mì", "Xe máy", "Mũ bảo hiểm", "Kính râm", "Đồng hồ", "Điện thoại", "Quyển sách",
            "Cây bút", "Cái ghế", "Giường ngủ", "Tivi", "Máy tính", "Quạt máy", "Đèn học", "Ba lô", "Đôi giày", "Cái thìa",
            "Cái dĩa", "Đôi đũa", "Cái bát", "Cái cốc", "Hộp sữa", "Bóng bay", "Con cá", "Ngôi sao", "Mặt trăng", "Đám mây",
            "Cầu vồng", "Cảnh sát", "Bác sĩ", "Học sinh", "Giáo viên", "Ca sĩ", "Phù thủy", "Công chúa", "Hoàng tử", "Siêu nhân",
            "Quả bóng", "Cái áo", "Cái quần", "Cái mũ", "Cái kính", "Cây cối", "Bông hoa", "Con ong", "Bánh ngọt", "Cá heo"
        };

        // Bắt đầu game (Chỉ chủ phòng gọi được)
        public async Task BatDauGame(string maPhong)
        {
            var room = await _context.PhongChos
                .FirstOrDefaultAsync(p => p.MaPhong == maPhong && p.TrangThai == "DangCho");

            if (room == null) return;

            var players = await _context.NguoiChoiTrongPhongs
                .Where(rp => rp.PhongChoId == room.Id)
                .OrderBy(rp => rp.NgayThamGia) // Sắp xếp thứ tự theo thời gian vào phòng
                .ToListAsync();

            if (players.Count < 2)
            {
                await Clients.Caller.SendAsync("LoiGame", "Cần tối thiểu 2 người chơi để bắt đầu game.");
                return;
            }

            if (room.LoaiPhong == "VeCungBan")
            {
                room.TrangThai = "DangChoi";
                _context.Entry(room).State = EntityState.Modified;
                await _context.SaveChangesAsync();

                await Clients.Group($"Room_{maPhong}").SendAsync("BatDauVeChung", maPhong);
                return;
            }

            // Đổi trạng thái phòng
            room.TrangThai = "DangChoi";
            _context.Entry(room).State = EntityState.Modified;

            // Tạo phiên chơi game
            var phienChoi = new PhienChoiGame
            {
                PhongChoId = room.Id,
                VongHienTai = 1,
                TongSoVong = 4, // Tối đa 4 vòng chơi
                NgayBatDau = DateTime.Now
            };
            _context.PhienChoiGames.Add(phienChoi);
            await _context.SaveChangesAsync();

            // Khởi tạo trạng thái game room in-memory
            var roomState = new GameRoomState
            {
                MaPhong = maPhong,
                PhienChoiId = phienChoi.Id,
                RoundNumber = 1,
                PlayerQueue = players.Select(p => p.NguoiDungId).ToList(),
                CurrentDrawerIndex = 0
            };

            foreach (var p in players)
            {
                roomState.TotalScores[p.NguoiDungId] = 0;
                roomState.TurnScores[p.NguoiDungId] = 0;
            }

            ActiveGames[maPhong] = roomState;

            // Bắt đầu phase chọn từ khóa cho người vẽ đầu tiên
            await StartWordSelection(roomState, _context);
        }

        private async Task StartWordSelection(GameRoomState state, ApplicationDbContext context)
        {
            state.IsSelectingWord = true;
            state.IsDrawing = false;
            state.CorrectGuessers.Clear();
            foreach (var key in state.TurnScores.Keys.ToList())
            {
                state.TurnScores[key] = 0;
            }

            // Chọn 3 từ ngẫu nhiên không trùng nhau
            var rand = new Random();
            var choices = new List<string>();
            while (choices.Count < 3)
            {
                var w = WordDatabase[rand.Next(WordDatabase.Count)];
                if (!choices.Contains(w))
                {
                    choices.Add(w);
                }
            }
            state.WordChoices = choices;
            state.CurrentWord = string.Empty;

            var drawerId = state.CurrentDrawerId;
            
            // Gửi sự kiện cho người vẽ chọn từ
            if (UserToConnection.TryGetValue(drawerId, out string? drawerConnId))
            {
                await _hubContext.Clients.Client(drawerConnId).SendAsync("BanPhaiChonTuKhoa", choices, 15);
            }

            // Gửi sự kiện cho các người đoán đang đợi
            var guesserIds = state.PlayerQueue.Where(id => id != drawerId).ToList();
            var drawerName = await context.NguoiDungs
                .Where(u => u.Id == drawerId)
                .Select(u => u.TenHienThi)
                .FirstOrDefaultAsync() ?? "Người vẽ";

            foreach (var gId in guesserIds)
            {
                if (UserToConnection.TryGetValue(gId, out string? connId))
                {
                    await _hubContext.Clients.Client(connId).SendAsync("NguoiChoiDangChonTuKhoa", drawerName, drawerId, 15);
                }
            }

            // Tự động chạy timer 15 giây chọn từ
            _ = Task.Run(async () =>
            {
                await Task.Delay(15000);
                using (var scope = _scopeFactory.CreateScope())
                {
                    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                    if (ActiveGames.TryGetValue(state.MaPhong, out var s) && s.PhienChoiId == state.PhienChoiId && s.IsSelectingWord && string.IsNullOrEmpty(s.CurrentWord))
                    {
                        // Tự động chọn từ đầu tiên nếu hết giờ
                        await ExecuteWordSelection(s, s.WordChoices[0], db);
                    }
                }
            });
        }

        public async Task ChonTuKhoa(string maPhong, string tuKhoa)
        {
            if (!ConnectionToUser.TryGetValue(Context.ConnectionId, out int userId)) return;

            if (ActiveGames.TryGetValue(maPhong, out var state))
            {
                if (state.IsSelectingWord && state.CurrentDrawerId == userId && state.WordChoices.Contains(tuKhoa))
                {
                    await ExecuteWordSelection(state, tuKhoa, _context);
                }
            }
        }

        private async Task ExecuteWordSelection(GameRoomState state, string tuKhoa, ApplicationDbContext context)
        {
            state.IsSelectingWord = false;
            state.IsDrawing = true;
            state.CurrentWord = tuKhoa;
            state.TurnStartTime = DateTime.Now;

            // Tạo VongChoiGame trong database
            var vong = new VongChoiGame
            {
                PhienChoiGameId = state.PhienChoiId,
                SoThuTuVong = (state.RoundNumber - 1) * state.PlayerQueue.Count + state.CurrentDrawerIndex + 1,
                TuKhoaGoc = tuKhoa
            };
            context.VongChoiGames.Add(vong);
            await context.SaveChangesAsync();

            state.GameRoundId = vong.Id;

            var drawerId = state.CurrentDrawerId;
            var drawerName = await context.NguoiDungs
                .Where(u => u.Id == drawerId)
                .Select(u => u.TenHienThi)
                .FirstOrDefaultAsync() ?? "Người vẽ";

            // Bắt đầu đếm ngược 60 giây vẽ hình cho cả phòng
            await _hubContext.Clients.Group($"Room_{state.MaPhong}").SendAsync("BatDauLuotVe", new
            {
                drawerId = drawerId,
                drawerName = drawerName,
                gameRoundId = vong.Id,
                tuKhoa = tuKhoa, // Client đoán sẽ ẩn đi
                thoiGianGiay = 60
            });

            // Tự động hết giờ sau 60 giây
            _ = Task.Run(async () =>
            {
                await Task.Delay(60000);
                using (var scope = _scopeFactory.CreateScope())
                {
                    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                    if (ActiveGames.TryGetValue(state.MaPhong, out var s) && s.PhienChoiId == state.PhienChoiId && s.IsDrawing && s.GameRoundId == vong.Id)
                    {
                        await EndTurn(s, db);
                    }
                }
            });
        }

        public async Task DongBoVeGame(string maPhong, string duLieuNetVe)
        {
            if (!ConnectionToUser.TryGetValue(Context.ConnectionId, out int userId)) return;

            if (ActiveGames.TryGetValue(maPhong, out var state))
            {
                if (state.IsDrawing && state.CurrentDrawerId == userId)
                {
                    await Clients.OthersInGroup($"Room_{maPhong}").SendAsync("NhanNetVeGame", duLieuNetVe);
                }
            }
        }

        public async Task GuiPhanDoan(string maPhong, string phanDoan)
        {
            if (!ConnectionToUser.TryGetValue(Context.ConnectionId, out int userId)) return;
            if (!ActiveGames.TryGetValue(maPhong, out var state)) return;

            // Người vẽ không được đoán
            if (state.CurrentDrawerId == userId) return;

            // Đã đoán đúng rồi không đoán tiếp
            if (state.CorrectGuessers.Contains(userId)) return;

            var user = await _context.NguoiDungs.FindAsync(userId);
            if (user == null) return;

            string tuChuanHoa = state.CurrentWord.Trim().ToLower();
            string phanDoanChuanHoa = phanDoan.Trim().ToLower();

            if (LoaiBoDauTiengViet(tuChuanHoa) == LoaiBoDauTiengViet(phanDoanChuanHoa))
            {
                // Đoán đúng!
                state.CorrectGuessers.Add(userId);

                // Tính điểm: Người thứ nhất 100đ, người sau 50đ
                int score = state.CorrectGuessers.Count == 1 ? 100 : 50;
                state.TurnScores[userId] = score;
                state.TotalScores[userId] += score;

                // Cộng điểm người vẽ
                state.TurnScores[state.CurrentDrawerId] += 10;
                state.TotalScores[state.CurrentDrawerId] += 10;

                await _hubContext.Clients.Group($"Room_{maPhong}").SendAsync("NguoiChoiDoanDung", new
                {
                    userId = userId,
                    tenHienThi = user.TenHienThi
                });

                // Nếu tất cả đoán đúng -> Kết thúc sớm
                int totalGuessers = state.PlayerQueue.Count - 1;
                if (state.CorrectGuessers.Count >= totalGuessers)
                {
                    await EndTurn(state, _context);
                }
            }
            else
            {
                // Đoán sai -> Hiện tin nhắn chat
                await _hubContext.Clients.Group($"Room_{maPhong}").SendAsync("NhanTinNhanGame", new
                {
                    userId = userId,
                    tenHienThi = user.TenHienThi,
                    tinNhan = phanDoan
                });
            }
        }

        private string LoaiBoDauTiengViet(string text)
        {
            if (string.IsNullOrEmpty(text)) return text;
            string[] arr1 = new string[] { "á", "à", "ả", "ã", "ạ", "â", "ấ", "ầ", "ẩ", "ẫ", "ậ", "ă", "ắ", "ằ", "ẳ", "ẵ", "ặ",
                "đ",
                "é","è","ẻ","ẽ","ẹ","ê","ế","ề","ể","ễ","ệ",
                "í","ì","ỉ","ĩ","ị",
                "ó","ò","ỏ","õ","ọ","ô","ố","ồ","ổ","ỗ","ộ","ơ","ớ","ờ","ở","ỡ","ợ",
                "ú","ù","ủ","ũ","ụ","ư","ứ","ừ","ử","ữ","ự",
                "ý","ỳ","ỷ","ỹ","ỵ",};
            string[] arr2 = new string[] { "a", "a", "a", "a", "a", "a", "a", "a", "a", "a", "a", "a", "a", "a", "a", "a", "a",
                "d",
                "e","e","e","e","e","e","e","e","e","e","e",
                "i","i","i","i","i",
                "o","o","o","o","o","o","o","o","o","o","o","o","o","o","o","o","o",
                "u","u","u","u","u","u","u","u","u","u","u",
                "y","y","y","y","y",};
            for (int i = 0; i < arr1.Length; i++)
            {
                text = text.Replace(arr1[i], arr2[i]);
                text = text.Replace(arr1[i].ToUpper(), arr2[i].ToUpper());
            }
            return text;
        }

        private async Task EndTurn(GameRoomState state, ApplicationDbContext context)
        {
            state.IsDrawing = false;

            // Lưu điểm Drawer
            var luotDraw = new LuotChoiGame
            {
                VongChoiGameId = state.GameRoundId,
                NguoiChoiId = state.CurrentDrawerId,
                LoaiLuotChoi = "VeHinh",
                DuLieuNoiDung = state.CurrentWord,
                DiemDatDuoc = state.TurnScores[state.CurrentDrawerId],
                NgayNop = DateTime.Now
            };
            context.LuotChoiGames.Add(luotDraw);

            // Lưu các câu đoán đúng
            foreach (var gId in state.CorrectGuessers)
            {
                var luotGuess = new LuotChoiGame
                {
                    VongChoiGameId = state.GameRoundId,
                    NguoiChoiId = gId,
                    LoaiLuotChoi = "DoanChu",
                    DuLieuNoiDung = state.CurrentWord,
                    DiemDatDuoc = state.TurnScores[gId],
                    NgayNop = DateTime.Now
                };
                context.LuotChoiGames.Add(luotGuess);
            }
            await context.SaveChangesAsync();

            // Tổng hợp bảng điểm
            var leaderboard = new List<object>();
            foreach (var pId in state.PlayerQueue)
            {
                var name = await context.NguoiDungs
                    .Where(u => u.Id == pId)
                    .Select(u => u.TenHienThi)
                    .FirstOrDefaultAsync() ?? "Người chơi";
                leaderboard.Add(new
                {
                    userId = pId,
                    tenHienThi = name,
                    diemLuotNay = state.TurnScores.GetValueOrDefault(pId, 0),
                    tongDiem = state.TotalScores.GetValueOrDefault(pId, 0)
                });
            }

            await _hubContext.Clients.Group($"Room_{state.MaPhong}").SendAsync("ShowKetQuaLuot", new
            {
                tuKhoaDung = state.CurrentWord,
                turnScores = state.TurnScores,
                leaderboard = leaderboard,
                thoiGianGiay = 5
            });

            _ = Task.Run(async () =>
            {
                await Task.Delay(5000);
                using (var scope = _scopeFactory.CreateScope())
                {
                    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                    if (ActiveGames.TryGetValue(state.MaPhong, out var s) && s.PhienChoiId == state.PhienChoiId)
                    {
                        await NextTurn(s, db);
                    }
                }
            });
        }

        private async Task NextTurn(GameRoomState state, ApplicationDbContext context)
        {
            state.CurrentDrawerIndex++;

            if (state.CurrentDrawerIndex >= state.PlayerQueue.Count)
            {
                state.CurrentDrawerIndex = 0;
                state.RoundNumber++;
            }

            if (state.RoundNumber > 4)
            {
                await EndGameSession(state, context);
            }
            else
            {
                await StartWordSelection(state, context);
            }
        }

        private async Task EndGameSession(GameRoomState state, ApplicationDbContext context)
        {
            if (ActiveGames.TryRemove(state.MaPhong, out _))
            {
                var phien = await context.PhienChoiGames.FindAsync(state.PhienChoiId);
                if (phien != null)
                {
                    phien.NgayKetThuc = DateTime.Now;
                    context.Entry(phien).State = EntityState.Modified;
                }

                var room = await context.PhongChos.FirstOrDefaultAsync(p => p.MaPhong == state.MaPhong);
                if (room != null)
                {
                    room.TrangThai = "DaKetThuc";
                    context.Entry(room).State = EntityState.Modified;
                }

                foreach (var kv in state.TotalScores)
                {
                    var user = await context.NguoiDungs.FindAsync(kv.Key);
                    if (user != null)
                    {
                        user.TongDiem += kv.Value;
                        user.CapDoHienTai = 1 + (user.TongDiem / 1000);
                        context.Entry(user).State = EntityState.Modified;
                    }
                }
                await context.SaveChangesAsync();

                var finalLeaderboard = new List<object>();
                foreach (var pId in state.PlayerQueue)
                {
                    var name = await context.NguoiDungs
                        .Where(u => u.Id == pId)
                        .Select(u => u.TenHienThi)
                        .FirstOrDefaultAsync() ?? "Người chơi";
                    var avatar = await context.NguoiDungs
                        .Where(u => u.Id == pId)
                        .Select(u => u.AnhDaiDienUrl)
                        .FirstOrDefaultAsync() ?? "/assets/avatars/default.png";
                    finalLeaderboard.Add(new
                    {
                        userId = pId,
                        tenHienThi = name,
                        anhDaiDienUrl = avatar,
                        tongDiem = state.TotalScores.GetValueOrDefault(pId, 0)
                    });
                }

                finalLeaderboard = finalLeaderboard
                    .OrderByDescending(x => ((dynamic)x).tongDiem)
                    .ToList();

                await _hubContext.Clients.Group($"Room_{state.MaPhong}").SendAsync("GameKetThucGameDrawGuess", finalLeaderboard);
            }
        }

        // ======================= HELPER METHODS =======================

        private string GenerateRoomCode()
        {
            const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
            var random = new Random();
            string code;
            do
            {
                code = new string(Enumerable.Repeat(chars, 5)
                    .Select(s => s[random.Next(s.Length)]).ToArray());
            } while (_context.PhongChos.Any(p => p.MaPhong == code));

            return code;
        }
    }

    public class GameRoomState
    {
        public string MaPhong { get; set; } = string.Empty;
        public int PhienChoiId { get; set; }
        public int RoundNumber { get; set; } = 1;
        public List<int> PlayerQueue { get; set; } = new();
        public int CurrentDrawerIndex { get; set; } = 0;
        public int CurrentDrawerId => PlayerQueue.Count > 0 ? PlayerQueue[CurrentDrawerIndex % PlayerQueue.Count] : 0;
        public string CurrentWord { get; set; } = string.Empty;
        public List<string> WordChoices { get; set; } = new();
        public HashSet<int> CorrectGuessers { get; set; } = new();
        public Dictionary<int, int> TurnScores { get; set; } = new();
        public Dictionary<int, int> TotalScores { get; set; } = new();
        public bool IsSelectingWord { get; set; } = false;
        public bool IsDrawing { get; set; } = false;
        public int GameRoundId { get; set; }
        public DateTime TurnStartTime { get; set; }
    }
}

