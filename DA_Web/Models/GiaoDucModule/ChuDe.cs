using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DA_Web.Models.GiaoDucModule
{
    [Table("ChuDes")]
    public class ChuDe
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        [StringLength(100)]
        public string TenChuDe { get; set; } = string.Empty; // Ví dụ: Anime, Động vật, Đồ ăn, Cây cỏ

        [Required]
        [StringLength(255)]
        public string MoTa { get; set; } = string.Empty;

        [Required]
        [StringLength(255)]
        public string AnhDaiDienUrl { get; set; } = string.Empty;
    }
}
