using Microsoft.EntityFrameworkCore;
using DA_Web.Models.NguoiDungModule;
using DA_Web.Models.GiaoDucModule;
using DA_Web.Models.BangVeModule;
using DA_Web.Models.PhongChoModule;
using DA_Web.Models.TroChoiModule;

namespace DA_Web.Models
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
        {
        }

        // Module 1
        public DbSet<NguoiDung> NguoiDungs { get; set; } = null!;
        public DbSet<KetBan> KetBans { get; set; } = null!;
        public DbSet<BangXepHang> BangXepHangs { get; set; } = null!;

        // Module 2
        public DbSet<ChuDe> ChuDes { get; set; } = null!;
        public DbSet<BaiHoc> BaiHocs { get; set; } = null!;
        public DbSet<CacBuocBaiHoc> CacBuocBaiHocs { get; set; } = null!;
        public DbSet<TienTrinhNguoiDung> TienTrinhNguoiDungs { get; set; } = null!;
        public DbSet<HuyHieu> HuyHieus { get; set; } = null!;
        public DbSet<HuyHieuNguoiDung> HuyHieuNguoiDungs { get; set; } = null!;

        // Module 3
        public DbSet<BanVe> BanVes { get; set; } = null!;
        public DbSet<NguoiVeChung> NguoiVeChungs { get; set; } = null!;
        public DbSet<TaiNguyen> TaiNguyens { get; set; } = null!;

        // Module 4
        public DbSet<PhongCho> PhongChos { get; set; } = null!;
        public DbSet<NguoiChoiTrongPhong> NguoiChoiTrongPhongs { get; set; } = null!;

        // Module 5
        public DbSet<PhienChoiGame> PhienChoiGames { get; set; } = null!;
        public DbSet<VongChoiGame> VongChoiGames { get; set; } = null!;
        public DbSet<LuotChoiGame> LuotChoiGames { get; set; } = null!;

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Cấu hình KetBan: Tránh vòng lập cascade delete giữa NguoiDung và KetBan
            modelBuilder.Entity<KetBan>()
                .HasOne(f => f.NguoiDung1)
                .WithMany()
                .HasForeignKey(f => f.NguoiDungId1)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<KetBan>()
                .HasOne(f => f.NguoiDung2)
                .WithMany()
                .HasForeignKey(f => f.NguoiDungId2)
                .OnDelete(DeleteBehavior.Restrict);

            // Cấu hình NguoiChoiTrongPhong
            modelBuilder.Entity<NguoiChoiTrongPhong>()
                .HasOne(rp => rp.PhongCho)
                .WithMany()
                .HasForeignKey(rp => rp.PhongChoId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<NguoiChoiTrongPhong>()
                .HasOne(rp => rp.NguoiDung)
                .WithMany()
                .HasForeignKey(rp => rp.NguoiDungId)
                .OnDelete(DeleteBehavior.Restrict);

            // Cấu hình NguoiVeChung
            modelBuilder.Entity<NguoiVeChung>()
                .HasOne(c => c.BanVe)
                .WithMany()
                .HasForeignKey(c => c.BanVeId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<NguoiVeChung>()
                .HasOne(c => c.NguoiDung)
                .WithMany()
                .HasForeignKey(c => c.NguoiDungId)
                .OnDelete(DeleteBehavior.Restrict);

            // Cấu hình LuotChoiGame
            modelBuilder.Entity<LuotChoiGame>()
                .HasOne(t => t.LuotTruoc)
                .WithMany()
                .HasForeignKey(t => t.LuotTruocId)
                .OnDelete(DeleteBehavior.NoAction);

            modelBuilder.Entity<LuotChoiGame>()
                .HasOne(t => t.NguoiChoi)
                .WithMany()
                .HasForeignKey(t => t.NguoiChoiId)
                .OnDelete(DeleteBehavior.Restrict);

            // Seed dữ liệu mẫu cho ChuDe
            modelBuilder.Entity<ChuDe>().HasData(
                new ChuDe { Id = 1, TenChuDe = "Anime", MoTa = "Học vẽ nhân vật truyện tranh, mắt Anime lung linh và các phụ kiện dễ thương.", AnhDaiDienUrl = "/assets/topics/anime.png" },
                new ChuDe { Id = 2, TenChuDe = "Động vật", MoTa = "Tập vẽ các con vật gần gũi như con mèo, chú chó, chú khỉ ngộ nghĩnh.", AnhDaiDienUrl = "/assets/topics/dongvat.png" },
                new ChuDe { Id = 3, TenChuDe = "Đồ ăn", MoTa = "Tập vẽ các món ăn bé thích như hamburger, kem ly, bánh ngọt.", AnhDaiDienUrl = "/assets/topics/doan.png" },
                new ChuDe { Id = 4, TenChuDe = "Cây cỏ", MoTa = "Học vẽ các loài hoa xinh đẹp, cây thông Noel hay hoa hướng dương.", AnhDaiDienUrl = "/assets/topics/cayco.png" }
            );

            // Seed một số bài học vẽ mẫu
            modelBuilder.Entity<BaiHoc>().HasData(
                new BaiHoc { Id = 1, ChuDeId = 2, TieuDe = "Vẽ chú mèo con", MoTa = "Học vẽ từng bước chú mèo dễ thương đang ngồi chơi.", DoKho = "De", AnhThuNhoUrl = "/assets/lessons/meocon.png", DiemThuong = 20, NgayTao = new DateTime(2026, 5, 31) },
                new BaiHoc { Id = 2, ChuDeId = 1, TieuDe = "Vẽ mắt Anime nữ", MoTa = "Từng bước phác thảo và vẽ chi tiết mắt lấp lánh kiểu Anime.", DoKho = "TrungBinh", AnhThuNhoUrl = "/assets/lessons/matanime.png", DiemThuong = 30, NgayTao = new DateTime(2026, 5, 31) },
                new BaiHoc { Id = 3, ChuDeId = 3, TieuDe = "Vẽ chiếc bánh Donut", MoTa = "Vẽ chiếc bánh vòng donut phủ kem dâu ngọt ngào.", DoKho = "De", AnhThuNhoUrl = "/assets/lessons/donut.png", DiemThuong = 15, NgayTao = new DateTime(2026, 5, 31) }
            );

            // Seed các bước vẽ chi tiết cho "Vẽ chú mèo con" (Bài học Id = 1)
            modelBuilder.Entity<CacBuocBaiHoc>().HasData(
                new CacBuocBaiHoc { Id = 1, BaiHocId = 1, SoThuTuBuoc = 1, ChuKyHuongDan = "Bước 1: Hãy vẽ một hình tròn to để làm đầu của chú mèo nhé!", DuLieuGuideSvg = "M 100 100 A 50 50 0 1 1 99.9 100", LaBuocToMau = false },
                new CacBuocBaiHoc { Id = 2, BaiHocId = 1, SoThuTuBuoc = 2, ChuKyHuongDan = "Bước 2: Vẽ thêm hai hình tam giác nhọn ở phía trên để làm đôi tai xinh.", DuLieuGuideSvg = "M 120 53 L 130 20 L 150 43 M 80 53 L 70 20 L 50 43", LaBuocToMau = false },
                new CacBuocBaiHoc { Id = 3, BaiHocId = 1, SoThuTuBuoc = 3, ChuKyHuongDan = "Bước 3: Vẽ thêm hai hình tròn nhỏ xíu bên trong làm đôi mắt long lanh và cái miệng cười.", DuLieuGuideSvg = "M 85 90 A 5 5 0 1 1 84.9 90 M 115 90 A 5 5 0 1 1 114.9 90 M 100 105 Q 100 115 105 105 Q 100 115 95 105", LaBuocToMau = false },
                new CacBuocBaiHoc { Id = 4, BaiHocId = 1, SoThuTuBuoc = 4, ChuKyHuongDan = "Bước 4: Cuối cùng, hãy chọn màu và tô điểm cho chú mèo của bạn thật rực rỡ!", DuLieuGuideSvg = "", LaBuocToMau = true }
            );
        }
    }
}
