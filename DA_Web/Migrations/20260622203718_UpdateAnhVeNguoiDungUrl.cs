using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DA_Web.Migrations
{
    /// <inheritdoc />
    public partial class UpdateAnhVeNguoiDungUrl : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "AnhVeNguoiDungUrl",
                table: "TienTrinhNguoiDungs",
                type: "nvarchar(max)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(255)",
                oldMaxLength: 255,
                oldNullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "AnhVeNguoiDungUrl",
                table: "TienTrinhNguoiDungs",
                type: "nvarchar(255)",
                maxLength: 255,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)",
                oldNullable: true);
        }
    }
}
