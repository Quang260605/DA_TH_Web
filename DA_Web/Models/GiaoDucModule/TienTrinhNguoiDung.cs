using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using DA_Web.Models.NguoiDungModule;

namespace DA_Web.Models.GiaoDucModule
{
    [Table("TienTrinhNguoiDungs")]
    public class TienTrinhNguoiDung
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        public int NguoiDungId { get; set; }

        [ForeignKey("NguoiDungId")]
        public virtual NguoiDung? NguoiDung { get; set; }

        [Required]
        public int BaiHocId { get; set; }

        [ForeignKey("BaiHocId")]
        public virtual BaiHoc? BaiHoc { get; set; }

        [Required]
        [StringLength(20)]
        public string TrangThai { get; set; } = "DangThucHien"; // DangThucHien, DaHoanThanh

        [Required]
        public int BuocCaoNhatDatDuoc { get; set; } = 1;

        public DateTime? NgayHoanThanh { get; set; }

        public string? AnhVeNguoiDungUrl { get; set; }

        public int? DiemAiCham { get; set; }

        [StringLength(500)]
        public string? NhanXetAi { get; set; }
    }
}
