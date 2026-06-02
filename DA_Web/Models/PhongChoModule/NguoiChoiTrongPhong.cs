using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using DA_Web.Models.NguoiDungModule;

namespace DA_Web.Models.PhongChoModule
{
    [Table("NguoiChoiTrongPhongs")]
    public class NguoiChoiTrongPhong
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        public int PhongChoId { get; set; }

        [ForeignKey("PhongChoId")]
        public virtual PhongCho? PhongCho { get; set; }

        [Required]
        public int NguoiDungId { get; set; }

        [ForeignKey("NguoiDungId")]
        public virtual NguoiDung? NguoiDung { get; set; }

        [Required]
        public bool SanSang { get; set; } = false;

        public DateTime NgayThamGia { get; set; } = DateTime.Now;
    }
}
