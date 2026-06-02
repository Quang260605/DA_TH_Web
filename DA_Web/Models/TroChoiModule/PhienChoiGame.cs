using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using DA_Web.Models.PhongChoModule;

namespace DA_Web.Models.TroChoiModule
{
    [Table("PhienChoiGames")]
    public class PhienChoiGame
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        public int PhongChoId { get; set; }

        [ForeignKey("PhongChoId")]
        public virtual PhongCho? PhongCho { get; set; }

        [Required]
        public int VongHienTai { get; set; } = 1;

        [Required]
        public int TongSoVong { get; set; }

        public DateTime NgayBatDau { get; set; } = DateTime.Now;

        public DateTime? NgayKetThuc { get; set; }
    }
}
