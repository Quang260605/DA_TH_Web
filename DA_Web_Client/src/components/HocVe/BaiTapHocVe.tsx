import React, { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import axios from 'axios';
import { API_URL } from '../../config';
import confetti from 'canvas-confetti';
import { ArrowRight, Sparkles, BookOpen, AlertCircle, Smile } from 'lucide-react';

interface BaiTapHocVeProps {
  userId: number;
  onClose?: () => void;
  onUserUpdate?: (newPoints: number, newLevel: number) => void;
}

interface ChuDe {
  id: number;
  tenChuDe: string;
  moTa: string;
  anhDaiDienUrl: string;
}

interface BaiHoc {
  id: number;
  chuDeId: number;
  tieuDe: string;
  moTa: string;
  doKho: string;
  anhThuNhoUrl: string;
  diemThuong: number;
}

interface CacBuocBaiHoc {
  id: number;
  soThuTuBuoc: number;
  chuKyHuongDan: string;
  duLieuGuideSvg: string;
  laBuocToMau: boolean;
}

export const BaiTapHocVe: React.FC<BaiTapHocVeProps> = ({ userId, onClose, onUserUpdate }) => {
  const [chuDes, setChuDes] = useState<ChuDe[]>([]);
  const [selectedChuDe, setSelectedChuDe] = useState<ChuDe | null>(null);
  
  const [baiHocs, setBaiHocs] = useState<BaiHoc[]>([]);
  const [selectedBaiHoc, setSelectedBaiHoc] = useState<BaiHoc | null>(null);

  const [steps, setSteps] = useState<CacBuocBaiHoc[]>([]);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
  const [selectedColor, setSelectedColor] = useState('#ff6b81');
  const [brushSize] = useState(8);

  // Trạng thái AI Chấm điểm
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiResult, setAiResult] = useState<{ diem: number; nhanXet: string; diemCong: number } | null>(null);

  // Lấy danh sách Chủ đề khi mở
  useEffect(() => {
    fetchChuDes();
  }, []);

  const fetchChuDes = async () => {
    try {
      const res = await axios.get(`${API_URL}/lesson/topics`);
      setChuDes(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // Lấy danh sách bài học khi chọn chủ đề
  const handleSelectChuDe = async (cd: ChuDe) => {
    setSelectedChuDe(cd);
    try {
      const res = await axios.get(`${API_URL}/lesson/topic/${cd.id}/lessons`);
      setBaiHocs(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // Lấy chi tiết các bước vẽ của bài học
  const handleSelectBaiHoc = async (bh: BaiHoc) => {
    setSelectedBaiHoc(bh);
    try {
      const res = await axios.get(`${API_URL}/lesson/${bh.id}/steps`);
      setSteps(res.data.steps);
      setCurrentStepIdx(0);
    } catch (err) {
      console.error(err);
    }
  };

  // Khởi tạo Canvas vẽ học tập
  useEffect(() => {
    if (!selectedBaiHoc || !canvasRef.current || steps.length === 0) return;

    // Khởi tạo canvas
    const fbCanvas = new fabric.Canvas(canvasRef.current, {
      width: 500,
      height: 400,
      backgroundColor: '#ffffff',
      isDrawingMode: true
    });

    fbCanvas.freeDrawingBrush!.color = selectedColor;
    fbCanvas.freeDrawingBrush!.width = brushSize;

    setCanvas(fbCanvas);

    return () => {
      fbCanvas.dispose();
    };
  }, [selectedBaiHoc, steps]);

  // Vẽ nét đứt hướng dẫn mẫu lên Canvas theo từng bước
  useEffect(() => {
    if (!canvas || steps.length === 0) return;

    // Lọc bước hiện tại
    const currentStep = steps[currentStepIdx];
    
    // Xóa tất cả các đối tượng mẫu nét đứt cũ (nếu có)
    const oldGuides = canvas.getObjects().filter((obj: any) => (obj as any).isGuide);
    oldGuides.forEach((obj: any) => canvas.remove(obj));

    // Vẽ nét vẽ mẫu nếu có dữ liệu SVG
    if (currentStep.duLieuGuideSvg) {
      fabric.loadSVGFromString(currentStep.duLieuGuideSvg, (objects: any, options: any) => {
        const obj = fabric.util.groupSVGElements(objects, options);
        obj.set({
          left: 100,
          top: 80,
          scaleX: 1.5,
          scaleY: 1.5,
          selectable: false,
          evented: false,
          strokeDashArray: [8, 8],
          stroke: '#cbd5e1', // Màu xám nhạt nét đứt
          fill: 'transparent'
        });
        (obj as any).isGuide = true;
        canvas.add(obj);
        (canvas as any).sendToBack(obj);
        canvas.renderAll();
      });
    }

    // Nếu bước cuối cùng (tô màu), cho phép đổ màu nền hoặc tô tự do
    if (currentStep.laBuocToMau) {
      canvas.isDrawingMode = true;
    } else {
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush!.color = selectedColor;
      canvas.freeDrawingBrush!.width = brushSize;
    }
  }, [canvas, currentStepIdx, steps, selectedColor, brushSize]);

  // Nút Next Step
  const nextStep = () => {
    if (currentStepIdx < steps.length - 1) {
      setCurrentStepIdx(currentStepIdx + 1);
    }
  };

  // Nút Nộp Bài cho AI Chấm Điểm
  const submitDrawing = async () => {
    if (!canvas || !selectedBaiHoc) return;

    // Lấy ảnh vẽ hiện tại của bé
    // Xóa bỏ nét vẽ đứt mẫu trước khi xuất ảnh gửi AI
    const guides = canvas.getObjects().filter((obj: any) => (obj as any).isGuide);
    guides.forEach((obj: any) => canvas.remove(obj));
    canvas.renderAll();

    const dataURL = canvas.toDataURL({
      format: 'png',
      quality: 0.7,
      multiplier: 1
    });

    // Vẽ lại nét đứt để bé vẫn thấy
    guides.forEach((obj: any) => {
      canvas.add(obj);
      (canvas as any).sendToBack(obj);
    });
    canvas.renderAll();

    setLoadingAi(true);
    setAiResult(null);

    try {
      const res = await axios.post(`${API_URL}/lesson/submit`, {
        nguoiDungId: userId,
        baiHocId: selectedBaiHoc.id,
        anhVeBase64: dataURL
      });

      setAiResult({
        diem: res.data.diemAiCham,
        nhanXet: res.data.nhanXetAi,
        diemCong: res.data.diemCong
      });

      // Kích hoạt pháo hoa giấy ăn mừng!
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });

      // Gọi callback cập nhật điểm trên Header
      if (onUserUpdate) {
        onUserUpdate(res.data.tongDiemMoi, res.data.capDoMoi);
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi kết nối AI, hãy thử lại.");
    } finally {
      setLoadingAi(false);
    }
  };

  const resetLessonState = () => {
    setSelectedBaiHoc(null);
    setSteps([]);
    setCanvas(null);
    setAiResult(null);
  };

  return (
    <div style={{ width: '100%', maxWidth: '900px', margin: '0 auto' }}>
      
      {/* 1. CHỌN CHỦ ĐỀ VẼ */}
      {!selectedChuDe && (
        <div>
          <h2 className="title-kids">🌟 Bạn muốn tập vẽ gì hôm nay? 🌟</h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '24px',
            marginTop: '30px'
          }}>
            {chuDes.map(cd => (
              <div 
                key={cd.id} 
                onClick={() => handleSelectChuDe(cd)}
                className="bubble-card hover-bounce" 
                style={{
                  cursor: 'pointer',
                  textAlign: 'center',
                  background: 'white',
                  padding: '24px',
                  border: '3px solid #2c3e50'
                }}>
                <div style={{
                  fontSize: '4rem',
                  marginBottom: '10px'
                }}>
                  {cd.id === 1 ? "🎎" : cd.id === 2 ? "🐱" : cd.id === 3 ? "🍩" : "🌻"}
                </div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 'bold', marginBottom: '8px' }}>{cd.tenChuDe}</h3>
                <p style={{ fontSize: '0.85rem', color: '#64748b' }}>{cd.moTa}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. CHỌN BÀI HỌC VẼ */}
      {selectedChuDe && !selectedBaiHoc && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <button onClick={() => setSelectedChuDe(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#2c3e50', fontWeight: 'bold', textDecoration: 'underline' }}>
              Quay lại Chủ đề
            </button>
            <span style={{ color: '#94a3b8' }}>/</span>
            <span style={{ fontWeight: 'bold', color: '#64748b' }}>Chủ đề: {selectedChuDe.tenChuDe}</span>
          </div>

          <h2 className="title-kids">Chọn hình để tập vẽ nha!</h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '24px',
            marginTop: '20px'
          }}>
            {baiHocs.map(bh => (
              <div 
                key={bh.id}
                onClick={() => handleSelectBaiHoc(bh)}
                className="bubble-card hover-bounce"
                style={{
                  cursor: 'pointer',
                  background: 'white',
                  padding: '16px',
                  border: '3px solid #2c3e50',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center'
                }}>
                {/* Ảnh sản phẩm vẽ */}
                <div style={{
                  width: '100%',
                  height: '140px',
                  background: '#f8fafc',
                  border: '2px solid #2c3e50',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '12px',
                  fontSize: '3rem'
                }}>
                  {bh.id === 1 ? "🐱" : bh.id === 2 ? "👁️" : "🍩"}
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '6px' }}>{bh.tieuDe}</h3>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    padding: '2px 8px',
                    borderRadius: '8px',
                    background: bh.doKho === 'De' ? '#f0fdf4' : '#fffbeb',
                    color: bh.doKho === 'De' ? '#15803d' : '#b45309',
                    border: '1px solid #2c3e50'
                  }}>
                    Độ khó: {bh.doKho === 'De' ? "Dễ" : "Trung bình"}
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>+{bh.diemThuong} điểm</span>
                </div>
                <p style={{ fontSize: '0.85rem', color: '#64748b', textAlign: 'center' }}>{bh.moTa}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. CANVAS TỪNG BƯỚC VÀ AI CHẤM ĐIỂM */}
      {selectedBaiHoc && steps.length > 0 && (
        <div className="bubble-card" style={{
          background: 'white',
          padding: '24px',
          border: '3px solid #2c3e50'
        }}>
          {/* Header bài vẽ */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2c3e50' }}>{selectedBaiHoc.tieuDe}</h3>
              <p style={{ fontSize: '0.9rem', color: '#64748b' }}>Độ khó: {selectedBaiHoc.doKho === 'De' ? "Dễ" : "Trung bình"}</p>
            </div>
            <button onClick={resetLessonState} style={{
              background: 'none',
              border: 'none',
              color: '#ff6b81',
              fontWeight: 'bold',
              textDecoration: 'underline',
              cursor: 'pointer'
            }}>
              Đổi bài vẽ khác
            </button>
          </div>

          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '24px',
            justifyContent: 'center'
          }}>
            {/* Cột trái: Hướng dẫn vẽ */}
            <div style={{
              flex: 1,
              minWidth: '280px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              border: '3px solid #2c3e50',
              borderRadius: '20px',
              padding: '20px',
              background: '#f8fafc'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-primary)', fontWeight: 'bold', marginBottom: '12px' }}>
                  <BookOpen size={18} />
                  <span>HƯỚNG DẪN TỪNG BƯỚC</span>
                </div>
                
                {/* Bước hiện tại */}
                <div style={{
                  fontSize: '1.2rem',
                  fontWeight: 'bold',
                  background: 'var(--color-sun)',
                  color: '#2c3e50',
                  border: '2px solid #2c3e50',
                  borderRadius: '12px',
                  padding: '8px 16px',
                  display: 'inline-block',
                  marginBottom: '16px',
                  boxShadow: '0 3px 0 #2c3e50'
                }}>
                  Bước {currentStepIdx + 1} / {steps.length}
                </div>

                <p style={{
                  fontSize: '1.1rem',
                  fontWeight: '600',
                  color: '#2c3e50',
                  lineHeight: '1.5'
                }}>
                  {steps[currentStepIdx].chuKyHuongDan}
                </p>
              </div>

              {/* Ô tô màu nét vẽ */}
              {!steps[currentStepIdx].laBuocToMau && (
                <div style={{
                  marginTop: '20px',
                  padding: '12px',
                  background: '#f0fdf4',
                  borderRadius: '12px',
                  border: '1.5px solid #2c3e50',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.85rem',
                  color: '#166534',
                  fontWeight: 'bold'
                }}>
                  <AlertCircle size={16} />
                  <span>Bạn hãy chọn màu hồng dâu mặc định bên dưới để vẽ đè lên nét đứt màu xám nhé!</span>
                </div>
              )}

              {/* Nút hành động chuyển bước hoặc nộp bài */}
              <div style={{ marginTop: '30px' }}>
                {currentStepIdx < steps.length - 1 ? (
                  <button 
                    onClick={nextStep}
                    className="btn-bubble btn-pink"
                    style={{ width: '100%', justifyContent: 'center' }}>
                    Nét vẽ tiếp theo
                    <ArrowRight size={18} />
                  </button>
                ) : (
                  <button 
                    onClick={submitDrawing}
                    disabled={loadingAi}
                    className="btn-bubble btn-green hover-bounce"
                    style={{ width: '100%', justifyContent: 'center' }}>
                    <Sparkles size={20} />
                    {loadingAi ? "AI đang chấm điểm..." : "Hoàn thành và chấm điểm"}
                  </button>
                )}
              </div>
            </div>

            {/* Cột phải: Bảng vẽ Canvas */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                border: '5px solid #2c3e50',
                borderRadius: '24px',
                overflow: 'hidden',
                boxShadow: '0 8px 0 #2c3e50',
                background: 'white',
                width: '500px',
                height: '400px'
              }}>
                <canvas ref={canvasRef} />
              </div>

              {/* Bảng màu và nét bút để tô màu ở bước cuối */}
              <div style={{
                display: 'flex',
                gap: '8px',
                marginTop: '16px',
                background: '#f8fafc',
                border: '2px solid #2c3e50',
                borderRadius: '12px',
                padding: '6px'
              }}>
                {['#ff6b81', '#ff4757', '#ffa502', '#ffd32a', '#2bcbba', '#70a1ff', '#a55eea', '#2f3542'].map(color => (
                  <button 
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    style={{
                      background: color,
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      border: selectedColor === color ? '3px solid #2c3e50' : '1px solid #cbd5e1',
                      cursor: 'pointer'
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POPUP HIỂN THỊ KẾT QUẢ AI CHẤM ĐIỂM */}
      {aiResult && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="bubble-card animate-wiggle" style={{
            background: 'white',
            width: '100%',
            maxWidth: '480px',
            border: '4px solid #2c3e50',
            textAlign: 'center',
            padding: '30px'
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '10px' }}>🏆</div>
            <h2 className="title-kids" style={{ fontSize: '2rem', marginBottom: '8px' }}>Kết quả AI Chấm điểm!</h2>
            
            {/* Điểm AI */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              background: 'var(--color-sun)',
              border: '4px solid #2c3e50',
              fontWeight: 'bold',
              fontSize: '2rem',
              color: '#2c3e50',
              boxShadow: '0 6px 0 #2c3e50',
              margin: '15px 0'
            }}>
              {aiResult.diem}đ
            </div>

            <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#16a34a', marginBottom: '20px' }}>
              Bạn được thưởng +{aiResult.diemCong} điểm tích lũy!
            </div>

            {/* Nhận xét AI */}
            <div style={{
              background: '#f8fafc',
              border: '2px solid #2c3e50',
              borderRadius: '16px',
              padding: '16px',
              textAlign: 'left',
              fontSize: '0.95rem',
              fontWeight: '600',
              lineHeight: '1.6',
              color: '#2c3e50',
              marginBottom: '30px',
              position: 'relative'
            }}>
              <Smile size={18} style={{ color: 'var(--color-primary)', position: 'absolute', top: '16px', right: '16px' }} />
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>Lời nhận xét của AI:</div>
              "{aiResult.nhanXet}"
            </div>

            <button 
              onClick={() => {
                setAiResult(null);
                resetLessonState();
              }}
              className="btn-bubble btn-pink"
              style={{ padding: '12px 30px' }}>
              Nhận phần thưởng
            </button>
          </div>
        </div>
      )}

      {onClose && (
        <button 
          onClick={onClose}
          style={{
            marginTop: '20px',
            background: 'none',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            fontWeight: 'bold',
            textDecoration: 'underline'
          }}>
          Quay lại Trang chủ
        </button>
      )}
    </div>
  );
};
