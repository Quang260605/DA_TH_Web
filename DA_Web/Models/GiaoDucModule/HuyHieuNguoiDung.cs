using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using DA_Web.Models.NguoiDungModule;

namespace DA_Web.Models.GiaoDucModule
{
    [Table("HuyHieuNguoiDungs")]
    public class HuyHieuNguoiDung
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        public int NguoiDungId { get; set; }

        [ForeignKey("NguoiDungId")]
        public virtual NguoiDung? NguoiDung { get; set; }

        [Required]
        public int HuyHieuId { get; set; }

        [ForeignKey("HuyHieuId")]
        public virtual HuyHieu? HuyHieu { get; set; }

        public DateTime NgayNhan { get; set; } = DateTime.Now;
    }
}
