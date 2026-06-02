using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using DA_Web.Models.NguoiDungModule;

namespace DA_Web.Models.TroChoiModule
{
    [Table("LuotChoiGames")]
    public class LuotChoiGame
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        public int VongChoiGameId { get; set; }

        [ForeignKey("VongChoiGameId")]
        public virtual VongChoiGame? VongChoiGame { get; set; }

        [Required]
        public int NguoiChoiId { get; set; }

        [ForeignKey("NguoiChoiId")]
        public virtual NguoiDung? NguoiChoi { get; set; }

        [Required]
        [StringLength(20)]
        public string LoaiLuotChoi { get; set; } = "VeHinh"; // VeHinh, DoanChu

        [Required]
        public string DuLieuNoiDung { get; set; } = string.Empty; // Chứa ảnh Base64/JSON vẽ nét hoặc từ đoán chữ

        public int? LuotTruocId { get; set; }

        [ForeignKey("LuotTruocId")]
        public virtual LuotChoiGame? LuotTruoc { get; set; }

        [Required]
        public int DiemDatDuoc { get; set; } = 0;

        public DateTime NgayNop { get; set; } = DateTime.Now;
    }
}
