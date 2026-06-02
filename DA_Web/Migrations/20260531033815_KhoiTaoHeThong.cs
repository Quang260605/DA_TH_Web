using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace DA_Web.Migrations
{
    /// <inheritdoc />
    public partial class KhoiTaoHeThong : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ChuDes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TenChuDe = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    MoTa = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    AnhDaiDienUrl = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChuDes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "HuyHieus",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TieuDe = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    MoTa = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    HinhAnhUrl = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HuyHieus", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "NguoiDungs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TenDangNhap = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    MatKhauHash = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    TenHienThi = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    AnhDaiDienUrl = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    TongDiem = table.Column<int>(type: "int", nullable: false),
                    CapDoHienTai = table.Column<int>(type: "int", nullable: false),
                    NgayTao = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NguoiDungs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TaiNguyens",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TenTaiNguyen = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    LoaiTaiNguyen = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    FileUrl = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TaiNguyens", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "BaiHocs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ChuDeId = table.Column<int>(type: "int", nullable: false),
                    TieuDe = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    MoTa = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    DoKho = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    AnhThuNhoUrl = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    DiemThuong = table.Column<int>(type: "int", nullable: false),
                    NgayTao = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BaiHocs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BaiHocs_ChuDes_ChuDeId",
                        column: x => x.ChuDeId,
                        principalTable: "ChuDes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "BangXepHangs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    NguoiDungId = table.Column<int>(type: "int", nullable: false),
                    LoaiXepHang = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    DiemDatDuoc = table.Column<int>(type: "int", nullable: false),
                    NgayCapNhat = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BangXepHangs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BangXepHangs_NguoiDungs_NguoiDungId",
                        column: x => x.NguoiDungId,
                        principalTable: "NguoiDungs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "BanVes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    NguoiDungId = table.Column<int>(type: "int", nullable: false),
                    TieuDe = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    DuLieuCanvasJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    AnhThuNhoUrl = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    CongKhai = table.Column<bool>(type: "bit", nullable: false),
                    NgayTao = table.Column<DateTime>(type: "datetime2", nullable: false),
                    NgayCapNhat = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BanVes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BanVes_NguoiDungs_NguoiDungId",
                        column: x => x.NguoiDungId,
                        principalTable: "NguoiDungs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "HuyHieuNguoiDungs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    NguoiDungId = table.Column<int>(type: "int", nullable: false),
                    HuyHieuId = table.Column<int>(type: "int", nullable: false),
                    NgayNhan = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HuyHieuNguoiDungs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_HuyHieuNguoiDungs_HuyHieus_HuyHieuId",
                        column: x => x.HuyHieuId,
                        principalTable: "HuyHieus",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_HuyHieuNguoiDungs_NguoiDungs_NguoiDungId",
                        column: x => x.NguoiDungId,
                        principalTable: "NguoiDungs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "KetBans",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    NguoiDungId1 = table.Column<int>(type: "int", nullable: false),
                    NguoiDungId2 = table.Column<int>(type: "int", nullable: false),
                    TrangThai = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    NgayTao = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KetBans", x => x.Id);
                    table.ForeignKey(
                        name: "FK_KetBans_NguoiDungs_NguoiDungId1",
                        column: x => x.NguoiDungId1,
                        principalTable: "NguoiDungs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_KetBans_NguoiDungs_NguoiDungId2",
                        column: x => x.NguoiDungId2,
                        principalTable: "NguoiDungs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PhongChos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    MaPhong = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    ChuPhongId = table.Column<int>(type: "int", nullable: false),
                    LoaiPhong = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    TrangThai = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    SoNguoiToiDa = table.Column<int>(type: "int", nullable: false),
                    NgayTao = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PhongChos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PhongChos_NguoiDungs_ChuPhongId",
                        column: x => x.ChuPhongId,
                        principalTable: "NguoiDungs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CacBuocBaiHocs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BaiHocId = table.Column<int>(type: "int", nullable: false),
                    SoThuTuBuoc = table.Column<int>(type: "int", nullable: false),
                    ChuKyHuongDan = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    DuLieuGuideSvg = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    LaBuocToMau = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CacBuocBaiHocs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CacBuocBaiHocs_BaiHocs_BaiHocId",
                        column: x => x.BaiHocId,
                        principalTable: "BaiHocs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TienTrinhNguoiDungs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    NguoiDungId = table.Column<int>(type: "int", nullable: false),
                    BaiHocId = table.Column<int>(type: "int", nullable: false),
                    TrangThai = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    BuocCaoNhatDatDuoc = table.Column<int>(type: "int", nullable: false),
                    NgayHoanThanh = table.Column<DateTime>(type: "datetime2", nullable: true),
                    AnhVeNguoiDungUrl = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    DiemAiCham = table.Column<int>(type: "int", nullable: true),
                    NhanXetAi = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TienTrinhNguoiDungs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TienTrinhNguoiDungs_BaiHocs_BaiHocId",
                        column: x => x.BaiHocId,
                        principalTable: "BaiHocs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TienTrinhNguoiDungs_NguoiDungs_NguoiDungId",
                        column: x => x.NguoiDungId,
                        principalTable: "NguoiDungs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "NguoiVeChungs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BanVeId = table.Column<int>(type: "int", nullable: false),
                    NguoiDungId = table.Column<int>(type: "int", nullable: false),
                    VaiTro = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    NgayThamGia = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NguoiVeChungs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_NguoiVeChungs_BanVes_BanVeId",
                        column: x => x.BanVeId,
                        principalTable: "BanVes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_NguoiVeChungs_NguoiDungs_NguoiDungId",
                        column: x => x.NguoiDungId,
                        principalTable: "NguoiDungs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "NguoiChoiTrongPhongs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PhongChoId = table.Column<int>(type: "int", nullable: false),
                    NguoiDungId = table.Column<int>(type: "int", nullable: false),
                    SanSang = table.Column<bool>(type: "bit", nullable: false),
                    NgayThamGia = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NguoiChoiTrongPhongs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_NguoiChoiTrongPhongs_NguoiDungs_NguoiDungId",
                        column: x => x.NguoiDungId,
                        principalTable: "NguoiDungs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_NguoiChoiTrongPhongs_PhongChos_PhongChoId",
                        column: x => x.PhongChoId,
                        principalTable: "PhongChos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PhienChoiGames",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PhongChoId = table.Column<int>(type: "int", nullable: false),
                    VongHienTai = table.Column<int>(type: "int", nullable: false),
                    TongSoVong = table.Column<int>(type: "int", nullable: false),
                    NgayBatDau = table.Column<DateTime>(type: "datetime2", nullable: false),
                    NgayKetThuc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PhienChoiGames", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PhienChoiGames_PhongChos_PhongChoId",
                        column: x => x.PhongChoId,
                        principalTable: "PhongChos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "VongChoiGames",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PhienChoiGameId = table.Column<int>(type: "int", nullable: false),
                    SoThuTuVong = table.Column<int>(type: "int", nullable: false),
                    TuKhoaGoc = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VongChoiGames", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VongChoiGames_PhienChoiGames_PhienChoiGameId",
                        column: x => x.PhienChoiGameId,
                        principalTable: "PhienChoiGames",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "LuotChoiGames",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    VongChoiGameId = table.Column<int>(type: "int", nullable: false),
                    NguoiChoiId = table.Column<int>(type: "int", nullable: false),
                    LoaiLuotChoi = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    DuLieuNoiDung = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    LuotTruocId = table.Column<int>(type: "int", nullable: true),
                    DiemDatDuoc = table.Column<int>(type: "int", nullable: false),
                    NgayNop = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LuotChoiGames", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LuotChoiGames_LuotChoiGames_LuotTruocId",
                        column: x => x.LuotTruocId,
                        principalTable: "LuotChoiGames",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_LuotChoiGames_NguoiDungs_NguoiChoiId",
                        column: x => x.NguoiChoiId,
                        principalTable: "NguoiDungs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LuotChoiGames_VongChoiGames_VongChoiGameId",
                        column: x => x.VongChoiGameId,
                        principalTable: "VongChoiGames",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "ChuDes",
                columns: new[] { "Id", "AnhDaiDienUrl", "MoTa", "TenChuDe" },
                values: new object[,]
                {
                    { 1, "/assets/topics/anime.png", "Học vẽ nhân vật truyện tranh, mắt Anime lung linh và các phụ kiện dễ thương.", "Anime" },
                    { 2, "/assets/topics/dongvat.png", "Tập vẽ các con vật gần gũi như con mèo, chú chó, chú khỉ ngộ nghĩnh.", "Động vật" },
                    { 3, "/assets/topics/doan.png", "Tập vẽ các món ăn bé thích như hamburger, kem ly, bánh ngọt.", "Đồ ăn" },
                    { 4, "/assets/topics/cayco.png", "Học vẽ các loài hoa xinh đẹp, cây thông Noel hay hoa hướng dương.", "Cây cỏ" }
                });

            migrationBuilder.InsertData(
                table: "BaiHocs",
                columns: new[] { "Id", "AnhThuNhoUrl", "ChuDeId", "DiemThuong", "DoKho", "MoTa", "NgayTao", "TieuDe" },
                values: new object[,]
                {
                    { 1, "/assets/lessons/meocon.png", 2, 20, "De", "Học vẽ từng bước chú mèo dễ thương đang ngồi chơi.", new DateTime(2026, 5, 31, 0, 0, 0, 0, DateTimeKind.Unspecified), "Vẽ chú mèo con" },
                    { 2, "/assets/lessons/matanime.png", 1, 30, "TrungBinh", "Từng bước phác thảo và vẽ chi tiết mắt lấp lánh kiểu Anime.", new DateTime(2026, 5, 31, 0, 0, 0, 0, DateTimeKind.Unspecified), "Vẽ mắt Anime nữ" },
                    { 3, "/assets/lessons/donut.png", 3, 15, "De", "Vẽ chiếc bánh vòng donut phủ kem dâu ngọt ngào.", new DateTime(2026, 5, 31, 0, 0, 0, 0, DateTimeKind.Unspecified), "Vẽ chiếc bánh Donut" }
                });

            migrationBuilder.InsertData(
                table: "CacBuocBaiHocs",
                columns: new[] { "Id", "BaiHocId", "ChuKyHuongDan", "DuLieuGuideSvg", "LaBuocToMau", "SoThuTuBuoc" },
                values: new object[,]
                {
                    { 1, 1, "Bước 1: Hãy vẽ một hình tròn to để làm đầu của chú mèo nhé!", "M 100 100 A 50 50 0 1 1 99.9 100", false, 1 },
                    { 2, 1, "Bước 2: Vẽ thêm hai hình tam giác nhọn ở phía trên để làm đôi tai xinh.", "M 120 53 L 130 20 L 150 43 M 80 53 L 70 20 L 50 43", false, 2 },
                    { 3, 1, "Bước 3: Vẽ thêm hai hình tròn nhỏ xíu bên trong làm đôi mắt long lanh và cái miệng cười.", "M 85 90 A 5 5 0 1 1 84.9 90 M 115 90 A 5 5 0 1 1 114.9 90 M 100 105 Q 100 115 105 105 Q 100 115 95 105", false, 3 },
                    { 4, 1, "Bước 4: Cuối cùng, hãy chọn màu và tô điểm cho chú mèo của bạn thật rực rỡ!", "", true, 4 }
                });

            migrationBuilder.CreateIndex(
                name: "IX_BaiHocs_ChuDeId",
                table: "BaiHocs",
                column: "ChuDeId");

            migrationBuilder.CreateIndex(
                name: "IX_BangXepHangs_NguoiDungId",
                table: "BangXepHangs",
                column: "NguoiDungId");

            migrationBuilder.CreateIndex(
                name: "IX_BanVes_NguoiDungId",
                table: "BanVes",
                column: "NguoiDungId");

            migrationBuilder.CreateIndex(
                name: "IX_CacBuocBaiHocs_BaiHocId",
                table: "CacBuocBaiHocs",
                column: "BaiHocId");

            migrationBuilder.CreateIndex(
                name: "IX_HuyHieuNguoiDungs_HuyHieuId",
                table: "HuyHieuNguoiDungs",
                column: "HuyHieuId");

            migrationBuilder.CreateIndex(
                name: "IX_HuyHieuNguoiDungs_NguoiDungId",
                table: "HuyHieuNguoiDungs",
                column: "NguoiDungId");

            migrationBuilder.CreateIndex(
                name: "IX_KetBans_NguoiDungId1",
                table: "KetBans",
                column: "NguoiDungId1");

            migrationBuilder.CreateIndex(
                name: "IX_KetBans_NguoiDungId2",
                table: "KetBans",
                column: "NguoiDungId2");

            migrationBuilder.CreateIndex(
                name: "IX_LuotChoiGames_LuotTruocId",
                table: "LuotChoiGames",
                column: "LuotTruocId");

            migrationBuilder.CreateIndex(
                name: "IX_LuotChoiGames_NguoiChoiId",
                table: "LuotChoiGames",
                column: "NguoiChoiId");

            migrationBuilder.CreateIndex(
                name: "IX_LuotChoiGames_VongChoiGameId",
                table: "LuotChoiGames",
                column: "VongChoiGameId");

            migrationBuilder.CreateIndex(
                name: "IX_NguoiChoiTrongPhongs_NguoiDungId",
                table: "NguoiChoiTrongPhongs",
                column: "NguoiDungId");

            migrationBuilder.CreateIndex(
                name: "IX_NguoiChoiTrongPhongs_PhongChoId",
                table: "NguoiChoiTrongPhongs",
                column: "PhongChoId");

            migrationBuilder.CreateIndex(
                name: "IX_NguoiVeChungs_BanVeId",
                table: "NguoiVeChungs",
                column: "BanVeId");

            migrationBuilder.CreateIndex(
                name: "IX_NguoiVeChungs_NguoiDungId",
                table: "NguoiVeChungs",
                column: "NguoiDungId");

            migrationBuilder.CreateIndex(
                name: "IX_PhienChoiGames_PhongChoId",
                table: "PhienChoiGames",
                column: "PhongChoId");

            migrationBuilder.CreateIndex(
                name: "IX_PhongChos_ChuPhongId",
                table: "PhongChos",
                column: "ChuPhongId");

            migrationBuilder.CreateIndex(
                name: "IX_TienTrinhNguoiDungs_BaiHocId",
                table: "TienTrinhNguoiDungs",
                column: "BaiHocId");

            migrationBuilder.CreateIndex(
                name: "IX_TienTrinhNguoiDungs_NguoiDungId",
                table: "TienTrinhNguoiDungs",
                column: "NguoiDungId");

            migrationBuilder.CreateIndex(
                name: "IX_VongChoiGames_PhienChoiGameId",
                table: "VongChoiGames",
                column: "PhienChoiGameId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BangXepHangs");

            migrationBuilder.DropTable(
                name: "CacBuocBaiHocs");

            migrationBuilder.DropTable(
                name: "HuyHieuNguoiDungs");

            migrationBuilder.DropTable(
                name: "KetBans");

            migrationBuilder.DropTable(
                name: "LuotChoiGames");

            migrationBuilder.DropTable(
                name: "NguoiChoiTrongPhongs");

            migrationBuilder.DropTable(
                name: "NguoiVeChungs");

            migrationBuilder.DropTable(
                name: "TaiNguyens");

            migrationBuilder.DropTable(
                name: "TienTrinhNguoiDungs");

            migrationBuilder.DropTable(
                name: "HuyHieus");

            migrationBuilder.DropTable(
                name: "VongChoiGames");

            migrationBuilder.DropTable(
                name: "BanVes");

            migrationBuilder.DropTable(
                name: "BaiHocs");

            migrationBuilder.DropTable(
                name: "PhienChoiGames");

            migrationBuilder.DropTable(
                name: "ChuDes");

            migrationBuilder.DropTable(
                name: "PhongChos");

            migrationBuilder.DropTable(
                name: "NguoiDungs");
        }
    }
}
