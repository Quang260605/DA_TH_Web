using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using DA_Web.Models.NguoiDungModule;

namespace DA_Web.Models.BangVeModule
{
    [Table("NguoiVeChungs")]
    public class NguoiVeChung
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        public int BanVeId { get; set; }

        [ForeignKey("BanVeId")]
        public virtual BanVe? BanVe { get; set; }

        [Required]
        public int NguoiDungId { get; set; }

        [ForeignKey("NguoiDungId")]
        public virtual NguoiDung? NguoiDung { get; set; }

        [Required]
        [StringLength(20)]
        public string VaiTro { get; set; } = "BienTap"; // BienTap (Editor), Xem (Viewer)

        public DateTime NgayThamGia { get; set; } = DateTime.Now;
    }
}
