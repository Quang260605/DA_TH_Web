using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DA_Web.Models.GiaoDucModule
{
    [Table("CacBuocBaiHocs")]
    public class CacBuocBaiHoc
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        public int BaiHocId { get; set; }

        [ForeignKey("BaiHocId")]
        public virtual BaiHoc? BaiHoc { get; set; }

        [Required]
        public int SoThuTuBuoc { get; set; }

        [Required]
        [StringLength(255)]
        public string ChuKyHuongDan { get; set; } = string.Empty;

        [Required]
        public string DuLieuGuideSvg { get; set; } = string.Empty; // Chứa tọa độ các vector nét vẽ chuẩn hoặc dữ liệu vẽ đứt mờ dạng SVG/JSON

        [Required]
        public bool LaBuocToMau { get; set; } = false;
    }
}
