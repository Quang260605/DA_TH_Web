using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using DA_Web.Models.NguoiDungModule;

namespace DA_Web.Models.PhongChoModule
{
    [Table("PhongChos")]
    public class PhongCho
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        [StringLength(10)]
        public string MaPhong { get; set; } = string.Empty; // Mã phòng ngẫu nhiên ví dụ "A79B2"

        [Required]
        public int ChuPhongId { get; set; }

        [ForeignKey("ChuPhongId")]
        public virtual NguoiDung? ChuPhong { get; set; }

        [Required]
        [StringLength(20)]
        public string LoaiPhong { get; set; } = "GhepNgauNhien"; // GhepNgauNhien, VeCungBan, TroChoiMini

        [Required]
        [StringLength(20)]
        public string TrangThai { get; set; } = "DangCho"; // DangCho, DangChoi, DaKetThuc

        [Required]
        public int SoNguoiToiDa { get; set; } = 2;

        public DateTime NgayTao { get; set; } = DateTime.Now;
    }
}
