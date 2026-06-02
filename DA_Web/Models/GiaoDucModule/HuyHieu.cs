using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DA_Web.Models.GiaoDucModule
{
    [Table("HuyHieus")]
    public class HuyHieu
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        [StringLength(100)]
        public string TieuDe { get; set; } = string.Empty; // Ví dụ: Thần đồng hình học, Bậc thầy vẽ mèo

        [Required]
        [StringLength(255)]
        public string MoTa { get; set; } = string.Empty; // Ví dụ: Hoàn thành 5 bài tập cấp độ Khó

        [Required]
        [StringLength(255)]
        public string HinhAnhUrl { get; set; } = string.Empty;
    }
}
