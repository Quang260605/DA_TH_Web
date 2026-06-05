using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using DA_Web.Models;
using DA_Web.Models.NguoiDungModule;
using DA_Web.Models.PhongChoModule;
using DA_Web.Models.TroChoiModule;

namespace DA_Web.Hubs
{
    public class GameHub : Hub
    {
        private readonly ApplicationDbContext _context;
        // Quản lý ánh xạ ConnectionId -> UserId và ngược lại để theo dõi trạng thái Online
        private static readonly ConcurrentDictionary<string, int> ConnectionToUser = new();
        private static readonly ConcurrentDictionary<int, string> UserToConnection = new();

        public static string? GetConnectionId(int userId)
        {
            return UserToConnection.TryGetValue(userId, out var connId) ? connId : null;
        }

        public GameHub(ApplicationDbContext context)
        {
            _context = context;
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
            room.SoNguoiToiDa = 8;
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

        // ======================= MODULE 5: TRÒ CHƠI TAM SAO THẤT BẢN (GARTIC PHONE) =======================

        // Bắt đầu game (Chỉ chủ phòng gọi được)
        public async Task BatDauGame(string maPhong)
        {
            var room = await _context.PhongChos
                .FirstOrDefaultAsync(p => p.MaPhong == maPhong && p.TrangThai == "DangCho");

            if (room == null) return;

            var players = await _context.NguoiChoiTrongPhongs
                .Where(rp => rp.PhongChoId == room.Id)
                .ToListAsync();

            if (players.Count < 2)
            {
                await Clients.Caller.SendAsync("LoiGame", "Cần tối thiểu 2 người chơi để bắt đầu game.");
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
                TongSoVong = players.Count, // Số vòng bằng số người chơi
                NgayBatDau = DateTime.Now
            };
            _context.PhienChoiGames.Add(phienChoi);
            await _context.SaveChangesAsync();

            // Khởi tạo Từ khóa gốc cho các vòng của phiên chơi
            string[] tuKhoaMau = new[] {
                "Con khỉ đi xe đạp",
                "Con mèo ăn bánh ngọt",
                "Chú chó lái phi thuyền",
                "Người tuyết ăn lẩu nóng",
                "Mặt trời đeo kính râm",
                "Người ngoài hành tinh đá bóng"
            };
            var random = new Random();

            for (int i = 1; i <= players.Count; i++)
            {
                var vong = new VongChoiGame
                {
                    PhienChoiGameId = phienChoi.Id,
                    SoThuTuVong = i,
                    TuKhoaGoc = tuKhoaMau[random.Next(tuKhoaMau.Length)]
                };
                _context.VongChoiGames.Add(vong);
            }
            await _context.SaveChangesAsync();

            // Bắt đầu vòng 1: Gửi từ khóa cho từng người chơi để vẽ
            // Trong Gartic Phone, ở Vòng 1: Mỗi người chơi nhận 1 từ khóa ngẫu nhiên khác nhau
            var danhSachVong = await _context.VongChoiGames
                .Where(v => v.PhienChoiGameId == phienChoi.Id)
                .ToListAsync();

            for (int i = 0; i < players.Count; i++)
            {
                int pId = players[i].NguoiDungId;
                var tuKhoa = danhSachVong[i].TuKhoaGoc;

                if (UserToConnection.TryGetValue(pId, out string? connId))
                {
                    await Clients.Client(connId).SendAsync("BatDauVongChoi", new
                    {
                        gameSessionId = phienChoi.Id,
                        roundNumber = 1,
                        gameRoundId = danhSachVong[i].Id,
                        loaiLuotChoi = "VeHinh", // Vòng đầu tiên luôn là Vẽ hình dựa trên từ khóa gốc
                        noiDungNhan = tuKhoa, // Nhận từ khóa để vẽ
                        thoiGianGiay = 60 // 60 giây để vẽ
                    });
                }
            }
        }

        // Người chơi nộp kết quả lượt chơi (được gọi khi hết giờ hoặc bấm nộp sớm)
        public async Task NopLuotChoi(int gameRoundId, int userId, string loaiLuotChoi, string contentData, int? receivedFromTurnId)
        {
            var luot = new LuotChoiGame
            {
                VongChoiGameId = gameRoundId,
                NguoiChoiId = userId,
                LoaiLuotChoi = loaiLuotChoi,
                DuLieuNoiDung = contentData,
                LuotTruocId = receivedFromTurnId,
                DiemDatDuoc = 10, // Điểm cố định cho mỗi lượt hoàn thành
                NgayNop = DateTime.Now
            };

            _context.LuotChoiGames.Add(luot);
            await _context.SaveChangesAsync();

            // Kiểm tra xem tất cả người chơi trong phiên chơi đã nộp bài ở vòng hiện tại chưa
            var currentRoundGame = await _context.VongChoiGames
                .Include(v => v.PhienChoiGame)
                .FirstOrDefaultAsync(v => v.Id == gameRoundId);

            if (currentRoundGame == null) return;

            var phienChoi = currentRoundGame.PhienChoiGame!;
            var roomPlayers = await _context.NguoiChoiTrongPhongs
                .Where(rp => rp.PhongChoId == phienChoi.PhongChoId)
                .Select(rp => rp.NguoiDungId)
                .ToListAsync();

            // Lấy tất cả các vòng chơi thuộc phiên chơi này
            var allRounds = await _context.VongChoiGames
                .Where(v => v.PhienChoiGameId == phienChoi.Id)
                .ToListAsync();

            // Tính số lượng lượt đã nộp của vòng chơi hiện tại trên toàn phiên game
            // Trong Gartic Phone, ở Vòng R, mỗi người chơi sẽ làm 1 lượt trên 1 Vòng chơi khác nhau (luân chuyển vòng)
            // Ví dụ: Người 1 làm Vòng 1, Người 2 làm Vòng 2 ở Round 1. Ở Round 2, Người 1 làm Vòng 2, Người 2 làm Vòng 1.
            // Vậy tổng số lượt nộp của cả phòng ở Round R phải bằng số lượng người chơi
            // Tính số lượng lượt đã nộp trong suốt phiên chơi từ lúc bắt đầu
            var totalSubmits = await _context.LuotChoiGames
                .CountAsync(l => allRounds.Select(v => v.Id).Contains(l.VongChoiGameId) && l.NgayNop >= phienChoi.NgayBatDau);

            // Lấy danh sách mã phòng để phát sóng
            var roomObj = await _context.PhongChos.FindAsync(phienChoi.PhongChoId);
            if (roomObj == null) return;

            // Nếu tất cả người chơi đã nộp lượt của vòng hiện tại
            if (totalSubmits >= phienChoi.VongHienTai * roomPlayers.Count)
            {
                // Kiểm tra xem đã kết thúc game chưa (đạt số vòng tối đa)
                if (phienChoi.VongHienTai >= phienChoi.TongSoVong)
                {
                    // Kết thúc game, tổng hợp kết quả
                    phienChoi.NgayKetThuc = DateTime.Now;
                    roomObj.TrangThai = "DaKetThuc";
                    _context.Entry(phienChoi).State = EntityState.Modified;
                    _context.Entry(roomObj).State = EntityState.Modified;
                    await _context.SaveChangesAsync();

                    // Gửi tín hiệu kết thúc game và gửi kết quả tổng hợp về
                    await Clients.Group($"Room_{roomObj.MaPhong}").SendAsync("GameKetThuc", phienChoi.Id);
                }
                else
                {
                    // Chuyển sang vòng tiếp theo
                    phienChoi.VongHienTai += 1;
                    _context.Entry(phienChoi).State = EntityState.Modified;
                    await _context.SaveChangesAsync();

                    // Luân chuyển bài viết/bài vẽ:
                    // Người chơi i sẽ nhận kết quả của người chơi (i-1) từ vòng chơi khác.
                    // Ví dụ: Người chơi A nhận bài của Người chơi B.
                    // Chúng ta sẽ ghép chéo lượt chơi vừa nộp ở vòng hiện tại để gửi cho người chơi tiếp theo.
                    var luotVừaNop = await _context.LuotChoiGames
                        .Where(l => allRounds.Select(v => v.Id).Contains(l.VongChoiGameId))
                        .OrderByDescending(l => l.NgayNop)
                        .Take(roomPlayers.Count)
                        .ToListAsync();

                    for (int i = 0; i < roomPlayers.Count; i++)
                    {
                        int nguoiChoiHienTai = roomPlayers[i];
                        // Người chơi trước đó trong danh sách xoay vòng
                        int nguoiChoiTruoc = roomPlayers[(i - 1 + roomPlayers.Count) % roomPlayers.Count];

                        // Tìm lượt chơi của người chơi trước vừa nộp
                        var luotTruoc = luotVừaNop.FirstOrDefault(l => l.NguoiChoiId == nguoiChoiTruoc);
                        if (luotTruoc == null) continue;

                        // Tìm vòng chơi mà người chơi trước vừa làm, ta chuyển vòng chơi đó cho người chơi hiện tại làm tiếp
                        int nextGameRoundId = luotTruoc.VongChoiGameId;

                        string tiepTheoLoai = luotTruoc.LoaiLuotChoi == "VeHinh" ? "DoanChu" : "VeHinh";
                        string noiDungNhan = luotTruoc.DuLieuNoiDung; // Nếu trước vẽ hình thì nay nhận ảnh vẽ để đoán chữ, ngược lại nhận chữ để vẽ hình

                        if (UserToConnection.TryGetValue(nguoiChoiHienTai, out string? connId))
                        {
                            await Clients.Client(connId).SendAsync("BatDauVongChoi", new
                            {
                                gameSessionId = phienChoi.Id,
                                roundNumber = phienChoi.VongHienTai,
                                gameRoundId = nextGameRoundId,
                                loaiLuotChoi = tiepTheoLoai,
                                noiDungNhan = noiDungNhan,
                                receivedFromTurnId = luotTruoc.Id,
                                thoiGianGiay = 60
                            });
                        }
                    }
                }
            }
            else
            {
                // Thông báo cho cả phòng biết có người vừa nộp bài để hiển thị UI chờ đợi
                await Clients.Group($"Room_{roomObj.MaPhong}").SendAsync("NguoiChoiDaNopBai", userId);
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
}
