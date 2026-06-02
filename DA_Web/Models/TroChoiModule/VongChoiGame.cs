using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DA_Web.Models.TroChoiModule
{
    [Table("VongChoiGames")]
    public class VongChoiGame
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        public int PhienChoiGameId { get; set; }

        [ForeignKey("PhienChoiGameId")]
        public virtual PhienChoiGame? PhienChoiGame { get; set; }

        [Required]
        public int SoThuTuVong { get; set; }

        [Required]
        [StringLength(150)]
        public string TuKhoaGoc { get; set; } = string.Empty; // Từ khóa ban đầu, ví dụ "Con khỉ đi xe đạp"
    }
}
