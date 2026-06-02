using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace DA_Web.Services
{
    public interface IAiGradingService
    {
        Task<(int Diem, string NhanXet)> GradeDrawingAsync(string base64Image, string tieuDeBaiHoc, string moTaBaiHoc);
    }

    public class AiGradingService : IAiGradingService
    {
        private readonly string _apiKey;
        private readonly HttpClient _httpClient;
        private readonly ILogger<AiGradingService> _logger;

        public AiGradingService(IConfiguration configuration, ILogger<AiGradingService> logger)
        {
            _logger = logger;
            _apiKey = configuration["GeminiSettings:ApiKey"] ?? string.Empty;
            _httpClient = new HttpClient();
        }

        public async Task<(int Diem, string NhanXet)> GradeDrawingAsync(string base64Image, string tieuDeBaiHoc, string moTaBaiHoc)
        {
            // Kiểm tra nếu chưa cấu hình API Key hoặc dùng Key mặc định thì chạy giả lập offline
            if (string.IsNullOrEmpty(_apiKey) || _apiKey == "YOUR_GEMINI_API_KEY_HERE")
            {
                _logger.LogWarning("Gemini API Key chưa được cấu hình. Sử dụng cơ chế chấm điểm tự động giả lập.");
                return GenerateMockGrade(tieuDeBaiHoc);
            }

            try
            {
                // Tiền xử lý chuỗi base64 (loại bỏ tiền tố data:image/png;base64, nếu có)
                string cleanBase64 = base64Image;
                string mimeType = "image/png";
                if (base64Image.Contains(","))
                {
                    var parts = base64Image.Split(',');
                    cleanBase64 = parts[1];
                    if (parts[0].Contains("image/jpeg") || parts[0].Contains("image/jpg"))
                    {
                        mimeType = "image/jpeg";
                    }
                }

                var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={_apiKey}";

                // Prompt hướng dẫn chấm bài cho AI
                string prompt = $"Bạn là một giáo viên dạy vẽ bao dung và vui vẻ trên ứng dụng 'Draw with me'. " +
                                $"Hãy xem bức vẽ này (được vẽ dựa trên bài học '{tieuDeBaiHoc}' có mô tả '{moTaBaiHoc}'). " +
                                $"Hãy chấm điểm cho bức vẽ trên thang điểm từ 75 đến 100 (tuyệt đối không cho dưới 70 để động viên người vẽ, hãy chấm điểm dựa vào độ cố gắng, sự sáng tạo và độ đẹp một cách tương đối, không quá gò bó theo nét mẫu). " +
                                $"Đồng thời hãy viết một lời nhận xét thật thân thiện, tích cực (dưới 400 ký tự) bằng tiếng Việt để khen ngợi nét vẽ của bạn ấy (chỉ ra nét đáng yêu, độc đáo hoặc màu sắc rực rỡ, hay nét vẽ rất cá tính,...). " +
                                $"Bạn BẮT BUỘC phải trả về kết quả dưới định dạng JSON duy nhất sau đây, không có bất kỳ ký tự nào khác bên ngoài block JSON (ví dụ không thêm ```json ... ```): " +
                                $"{{ \"diem\": 85, \"nhanXet\": \"Lời nhận xét dễ thương của bạn...\" }}";

                // Tạo payload request cho Gemini API
                var requestPayload = new
                {
                    contents = new[]
                    {
                        new
                        {
                            parts = new object[]
                            {
                                new { text = prompt },
                                new
                                {
                                    inlineData = new
                                    {
                                        mimeType = mimeType,
                                        data = cleanBase64
                                    }
                                }
                            }
                        }
                    },
                    generationConfig = new
                    {
                        responseMimeType = "application/json"
                    }
                };

                string jsonPayload = JsonSerializer.Serialize(requestPayload);
                var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");

                var response = await _httpClient.PostAsync(url, content);
                if (response.IsSuccessStatusCode)
                {
                    string responseString = await response.Content.ReadAsStringAsync();
                    using var doc = JsonDocument.Parse(responseString);
                    var textResponse = doc.RootElement
                        .GetProperty("candidates")[0]
                        .GetProperty("content")
                        .GetProperty("parts")[0]
                        .GetProperty("text")
                        .GetString();

                    if (!string.IsNullOrEmpty(textResponse))
                    {
                        var gradingResult = JsonSerializer.Deserialize<GradingResult>(textResponse);
                        if (gradingResult != null)
                        {
                            return (gradingResult.diem, gradingResult.nhanXet);
                        }
                    }
                }
                else
                {
                    _logger.LogError($"Lỗi gọi Gemini API: {response.StatusCode} - {await response.Content.ReadAsStringAsync()}");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"Ngoại lệ xảy ra khi chấm điểm bằng Gemini API: {ex.Message}");
            }

            // Nếu gặp bất kỳ lỗi gì, trả về kết quả giả lập để tránh làm ứng dụng bị đứng
            return GenerateMockGrade(tieuDeBaiHoc);
        }

        private (int Diem, string NhanXet) GenerateMockGrade(string tieuDeBaiHoc)
        {
            var random = new Random();
            int diem = random.Next(78, 98); // Điểm ngẫu nhiên từ 78 đến 97 để động viên người vẽ

            string[] nhanXetTemplates = new[]
            {
                $"Tuyệt vời! Bức tranh '{tieuDeBaiHoc}' của bạn vẽ rất có hồn, những đường nét cực kỳ ngộ nghĩnh và đáng yêu. Cách phối màu sắc rực rỡ thật sự rất ấn tượng!",
                $"Wao, bạn vẽ '{tieuDeBaiHoc}' sáng tạo quá đi thôi! Nét vẽ tuy phóng khoáng nhưng lại tạo nên sự độc đáo và cá tính riêng cho bức tranh. Hãy tiếp tục phát huy nhé!",
                $"Bức tranh '{tieuDeBaiHoc}' này siêu dễ thương luôn! Cách vẽ chi tiết trông rất sống động. Bạn thực sự có năng khiếu hội họa đấy!",
                $"Ôi, tác phẩm '{tieuDeBaiHoc}' này trông thật đáng yêu và vui vẻ! Những đường nét đầy sáng tạo. Chúc mừng bạn đã hoàn thành xuất sắc bài vẽ!"
            };

            string nhanXet = nhanXetTemplates[random.Next(nhanXetTemplates.Length)];
            return (diem, nhanXet);
        }

        private class GradingResult
        {
            public int diem { get; set; }
            public string nhanXet { get; set; } = string.Empty;
        }
    }
}
