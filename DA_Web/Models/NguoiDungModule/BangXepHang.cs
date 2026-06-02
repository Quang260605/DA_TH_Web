using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DA_Web.Models.NguoiDungModule
{
    [Table("BangXepHangs")]
    public class BangXepHang
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        public int NguoiDungId { get; set; }

        [ForeignKey("NguoiDungId")]
        public virtual NguoiDung? NguoiDung { get; set; }

        [Required]
        [StringLength(20)]
        public string LoaiXepHang { get; set; } = "MoiThoiGian"; // Tuan, Thang, MoiThoiGian

        [Required]
        public int DiemDatDuoc { get; set; }

        public DateTime NgayCapNhat { get; set; } = DateTime.Now;
    }
}
