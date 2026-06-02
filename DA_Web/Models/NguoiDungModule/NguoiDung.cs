using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DA_Web.Models.NguoiDungModule
{
    [Table("NguoiDungs")]
    public class NguoiDung
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        [StringLength(50)]
        public string TenDangNhap { get; set; } = string.Empty;

        [Required]
        [StringLength(255)]
        public string MatKhauHash { get; set; } = string.Empty;

        [Required]
        [StringLength(100)]
        public string TenHienThi { get; set; } = string.Empty;

        [StringLength(255)]
        public string? AnhDaiDienUrl { get; set; }

        public int TongDiem { get; set; } = 0;

        public int CapDoHienTai { get; set; } = 1;

        public DateTime NgayTao { get; set; } = DateTime.Now;
    }
}
