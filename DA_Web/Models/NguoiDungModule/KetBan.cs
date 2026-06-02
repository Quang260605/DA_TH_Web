using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DA_Web.Models.NguoiDungModule
{
    [Table("KetBans")]
    public class KetBan
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        public int NguoiDungId1 { get; set; }

        [ForeignKey("NguoiDungId1")]
        public virtual NguoiDung? NguoiDung1 { get; set; }

        [Required]
        public int NguoiDungId2 { get; set; }

        [ForeignKey("NguoiDungId2")]
        public virtual NguoiDung? NguoiDung2 { get; set; }

        [Required]
        [StringLength(20)]
        public string TrangThai { get; set; } = "ChoKhaiBao"; // ChoKhaiBao, DaKetBan, DaChan

        public DateTime NgayTao { get; set; } = DateTime.Now;
    }
}
