using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using DA_Web.Models.NguoiDungModule;

namespace DA_Web.Models.BangVeModule
{
    [Table("BanVes")]
    public class BanVe
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        public int NguoiDungId { get; set; }

        [ForeignKey("NguoiDungId")]
        public virtual NguoiDung? NguoiDung { get; set; }

        [Required]
        [StringLength(150)]
        public string TieuDe { get; set; } = "Bản vẽ chưa đặt tên";

        [Required]
        public string DuLieuCanvasJson { get; set; } = string.Empty; // Chứa dữ liệu canvas dạng JSON của Fabric.js

        [StringLength(255)]
        public string? AnhThuNhoUrl { get; set; }

        [Required]
        public bool CongKhai { get; set; } = false;

        public DateTime NgayTao { get; set; } = DateTime.Now;

        public DateTime NgayCapNhat { get; set; } = DateTime.Now;
    }
}
