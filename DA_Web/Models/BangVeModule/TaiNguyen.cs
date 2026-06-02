using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DA_Web.Models.BangVeModule
{
    [Table("TaiNguyens")]
    public class TaiNguyen
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        [StringLength(100)]
        public string TenTaiNguyen { get; set; } = string.Empty;

        [Required]
        [StringLength(50)]
        public string LoaiTaiNguyen { get; set; } = "Sticker"; // Sticker, Background, HinhMauErd, NutSoDoTuDuy

        [Required]
        [StringLength(255)]
        public string FileUrl { get; set; } = string.Empty;
    }
}
