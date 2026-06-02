using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DA_Web.Models.GiaoDucModule
{
    [Table("BaiHocs")]
    public class BaiHoc
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        public int ChuDeId { get; set; }

        [ForeignKey("ChuDeId")]
        public virtual ChuDe? ChuDe { get; set; }

        [Required]
        [StringLength(100)]
        public string TieuDe { get; set; } = string.Empty;

        [Required]
        [StringLength(255)]
        public string MoTa { get; set; } = string.Empty;

        [Required]
        [StringLength(20)]
        public string DoKho { get; set; } = "De"; // De, TrungBinh, Kho

        [Required]
        [StringLength(255)]
        public string AnhThuNhoUrl { get; set; } = string.Empty;

        [Required]
        public int DiemThuong { get; set; } = 10;

        public DateTime NgayTao { get; set; } = DateTime.Now;
    }
}
