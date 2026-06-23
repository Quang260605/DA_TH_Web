import React, { useEffect, useRef, useState } from 'react';
import { Canvas as FabricCanvas, PencilBrush, Path } from 'fabric';
import axios from 'axios';
import { API_URL } from '../../config';
import confetti from 'canvas-confetti';
import { ArrowRight, Sparkles, BookOpen, AlertCircle, Smile, CheckCircle2, Play, ArrowLeft } from 'lucide-react';

interface BaiTapHocVeProps {
  userId: number;
  onClose?: () => void;
  onUserUpdate?: (newPoints: number, newLevel: number) => void;

  selectedChuDe: ChuDe | null;
  setSelectedChuDe: React.Dispatch<React.SetStateAction<ChuDe | null>>;
  selectedBaiHoc: BaiHoc | null;
  setSelectedBaiHoc: React.Dispatch<React.SetStateAction<BaiHoc | null>>;
  steps: CacBuocBaiHoc[];
  setSteps: React.Dispatch<React.SetStateAction<CacBuocBaiHoc[]>>;
  currentStepIdx: number;
  setCurrentStepIdx: React.Dispatch<React.SetStateAction<number>>;
  savedDrawingData: string | null;
  setSavedDrawingData: React.Dispatch<React.SetStateAction<string | null>>;
  aiResult: { diem: number; nhanXet: string; diemCong: number } | null;
  setAiResult: React.Dispatch<React.SetStateAction<{ diem: number; nhanXet: string; diemCong: number } | null>>;
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

export const BaiTapHocVe: React.FC<BaiTapHocVeProps> = ({ 
  userId, 
  onClose, 
  onUserUpdate,
  selectedChuDe,
  setSelectedChuDe,
  selectedBaiHoc,
  setSelectedBaiHoc,
  steps,
  setSteps,
  currentStepIdx,
  setCurrentStepIdx,
  savedDrawingData,
  setSavedDrawingData,
  aiResult,
  setAiResult
}) => {
  const [chuDes, setChuDes] = useState<ChuDe[]>([]);
  const [_baiHocs, setBaiHocs] = useState<BaiHoc[]>([]);
  const [completedLessonIds, setCompletedLessonIds] = useState<number[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvas, setCanvas] = useState<FabricCanvas | null>(null);
  const [selectedColor, setSelectedColor] = useState('#ff6b81');
  const [brushSize] = useState(8);

  // Trạng thái AI Chấm điểm
  const [loadingAi, setLoadingAi] = useState(false);

  // Lộ trình học vẽ
  const [allLessons, setAllLessons] = useState<BaiHoc[]>([]);

  // Lấy danh sách Chủ đề & Lộ trình bài vẽ & Tiến trình khi mở
  useEffect(() => {
    fetchChuDes();
    fetchAllLessons();
    fetchUserProgress();
  }, []);

  const fetchUserProgress = async () => {
    try {
      const res = await axios.get(`${API_URL}/lesson/user/${userId}/progress`);
      const completedIds = res.data
        .filter((p: any) => p.trangThai === 'DaHoanThanh')
        .map((p: any) => p.baiHocId);
      setCompletedLessonIds(completedIds);
    } catch (err) {
      console.error("Lỗi lấy tiến trình vẽ:", err);
    }
  };

  const fetchAllLessons = async () => {
    try {
      const res = await axios.get(`${API_URL}/lesson/all-lessons`);
      // Sắp xếp bài vẽ theo điểm thưởng tăng dần để tạo lộ trình từ dễ đến khó
      const sorted = res.data.sort((a: BaiHoc, b: BaiHoc) => a.diemThuong - b.diemThuong);
      setAllLessons(sorted);
    } catch (err) {
      console.error(err);
    }
  };

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
    setSavedDrawingData(null); // Xóa hình vẽ cũ của bài tập trước
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
    const fbCanvas = new FabricCanvas(canvasRef.current, {
      width: 500,
      height: 400,
      backgroundColor: '#ffffff',
      isDrawingMode: true
    });

    // Fabric.js v7: phải tạo PencilBrush thủ công
    const brush = new PencilBrush(fbCanvas);
    brush.color = selectedColor;
    brush.width = brushSize;
    fbCanvas.freeDrawingBrush = brush;

    // Phục hồi hình vẽ cũ nếu có
    if (savedDrawingData) {
      try {
        fbCanvas.loadFromJSON(JSON.parse(savedDrawingData)).then(() => {
          fbCanvas.renderAll();
        });
      } catch (err) {
        console.error("Lỗi phục hồi hình vẽ:", err);
      }
    }

    // Đăng ký lưu hình vẽ real-time khi người dùng vẽ xong một nét
    fbCanvas.on('path:created', () => {
      const oldGuides = fbCanvas.getObjects().filter((obj: any) => (obj as any).isGuide);
      oldGuides.forEach((obj: any) => fbCanvas.remove(obj));
      
      const json = JSON.stringify(fbCanvas.toJSON());
      setSavedDrawingData(json);
      
      oldGuides.forEach((obj: any) => {
        fbCanvas.add(obj);
        fbCanvas.sendObjectToBack(obj);
      });
      fbCanvas.renderAll();
    });

    setCanvas(fbCanvas);

    return () => {
      const oldGuides = fbCanvas.getObjects().filter((obj: any) => (obj as any).isGuide);
      oldGuides.forEach((obj: any) => fbCanvas.remove(obj));
      const json = JSON.stringify(fbCanvas.toJSON());
      setSavedDrawingData(json);

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

    // Vẽ nét vẽ mẫu nếu có dữ liệu SVG path
    if (currentStep.duLieuGuideSvg) {
      // Tạo trực tiếp Path objects từ SVG path data (Fabric.js v7 compatible)
      const pathStrings = currentStep.duLieuGuideSvg.split(/(?=M)/g).filter((s: string) => s.trim());
      // Gộp lại thành 1 path duy nhất
      const fullPath = pathStrings.join(' ');
      try {
        const guidePath = new Path(fullPath, {
          selectable: false,
          evented: false,
          strokeDashArray: [8, 8],
          stroke: '#cbd5e1',
          fill: 'transparent',
          strokeWidth: 2
        });
        const pathWidth = Math.max(guidePath.width || 1, 1);
        const pathHeight = Math.max(guidePath.height || 1, 1);
        const scale = Math.min(
          (canvas.getWidth() - 80) / pathWidth,
          (canvas.getHeight() - 70) / pathHeight,
          1.6
        );
        guidePath.set({
          originX: 'center',
          originY: 'center',
          left: canvas.getWidth() / 2,
          top: canvas.getHeight() / 2,
          scaleX: scale,
          scaleY: scale
        });
        (guidePath as any).isGuide = true;
        canvas.add(guidePath);
        canvas.sendObjectToBack(guidePath);
        canvas.renderAll();
      } catch (err) {
        console.warn("Không thể vẽ nét hướng dẫn:", err);
      }
    }

    // Luôn cho phép vẽ tự do
    canvas.isDrawingMode = true;
    if (canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = selectedColor;
      canvas.freeDrawingBrush.width = brushSize;
    } else {
      const brush = new PencilBrush(canvas);
      brush.color = selectedColor;
      brush.width = brushSize;
      canvas.freeDrawingBrush = brush;
    }
  }, [canvas, currentStepIdx, steps, selectedColor, brushSize]);

  // Nút Next Step
  const nextStep = () => {
    if (currentStepIdx < steps.length - 1) {
      if (canvas && setSavedDrawingData) {
        const oldGuides = canvas.getObjects().filter((obj: any) => (obj as any).isGuide);
        oldGuides.forEach((obj: any) => canvas.remove(obj));
        const json = JSON.stringify(canvas.toJSON());
        setSavedDrawingData(json);
        oldGuides.forEach((obj: any) => {
          canvas.add(obj);
          canvas.sendObjectToBack(obj);
        });
        canvas.renderAll();
      }
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
      canvas.sendObjectToBack(obj);
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
      fetchUserProgress();
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
    setSavedDrawingData(null);
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

      {/* 2. LỘ TRÌNH HỌC VẼ CỦA CHỦ ĐỀ */}
      {selectedChuDe && !selectedBaiHoc && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '30px' }}>
            <button 
              onClick={() => setSelectedChuDe(null)} 
              className="btn-bubble btn-yellow"
              style={{ 
                padding: '8px 16px', 
                fontSize: '0.9rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <ArrowLeft size={16} />
              Quay lại Chủ đề
            </button>
            <span style={{ color: '#94a3b8', fontSize: '1.2rem', fontWeight: 'bold' }}>/</span>
            <span style={{ fontWeight: '700', color: '#475569', fontSize: '1.1rem' }}>
              Chủ đề: {selectedChuDe.tenChuDe}
            </span>
          </div>

          <h2 className="title-kids">🗺️ Lộ trình vẽ từ dễ đến khó: {selectedChuDe.tenChuDe} 🗺️</h2>
          <p style={{ textAlign: 'center', color: '#64748b', fontSize: '1rem', fontWeight: '600', marginBottom: '40px' }}>
            Hãy hoàn thành từng bài tập nhỏ dưới đây để nhận điểm thưởng và thăng hạng trên Bảng xếp hạng nhé!
          </p>

          <div style={{
            position: 'relative',
            maxWidth: '700px',
            margin: '0 auto',
            padding: '20px 0'
          }}>
            {/* Đường kẻ trục dọc nối các node */}
            <div style={{
              position: 'absolute',
              left: '50%',
              top: '40px',
              bottom: '40px',
              width: '6px',
              backgroundColor: '#2c3e50',
              borderStyle: 'dashed',
              transform: 'translateX(-50%)',
              zIndex: 1
            }}></div>

            {/* Render các chặng (lessons) */}
            {allLessons.filter(bh => bh.chuDeId === selectedChuDe.id).map((bh, idx) => {
              const isCompleted = completedLessonIds.includes(bh.id);
              const stepNumber = idx + 1;
              const isEven = idx % 2 === 0;

              return (
                <div 
                  key={bh.id} 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isEven ? 'flex-start' : 'flex-end',
                    width: '100%',
                    marginBottom: '60px',
                    position: 'relative',
                    zIndex: 2
                  }}
                >
                  {/* Điểm nút tròn (Node) ở giữa */}
                  <div 
                    style={{
                      position: 'absolute',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      border: '4px solid #2c3e50',
                      backgroundColor: isCompleted ? '#2bcbba' : '#ffd32a',
                      color: '#2c3e50',
                      fontWeight: 'bold',
                      fontSize: '1.2rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 0 #2c3e50',
                      zIndex: 3
                    }}
                  >
                    {isCompleted ? <CheckCircle2 size={24} style={{ color: 'white' }} /> : stepNumber}
                  </div>

                  {/* Card thông tin bài vẽ */}
                  <div 
                    onClick={() => handleSelectBaiHoc(bh)}
                    className="bubble-card hover-bounce"
                    style={{
                      width: '43%',
                      cursor: 'pointer',
                      background: 'white',
                      border: '3px solid #2c3e50',
                      padding: '20px',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: isEven ? '6px 6px 0px rgba(44, 62, 80, 0.15)' : '-6px 6px 0px rgba(44, 62, 80, 0.15)'
                    }}
                  >
                    <div style={{
                      fontSize: '3.5rem',
                      background: '#f8fafc',
                      border: '2px solid #2c3e50',
                      borderRadius: '16px',
                      width: '100%',
                      height: '110px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {bh.anhThuNhoUrl}
                    </div>
                    
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#2c3e50', margin: '4px 0 0 0' }}>
                      {bh.tieuDe}
                    </h3>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        padding: '2px 8px',
                        borderRadius: '8px',
                        background: bh.doKho === 'De' ? '#f0fdf4' : '#fffbeb',
                        color: bh.doKho === 'De' ? '#15803d' : '#b45309',
                        border: '1.5px solid #2c3e50'
                      }}>
                        {bh.doKho === 'De' ? "Dễ" : "Trung bình"}
                      </span>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        padding: '2px 8px',
                        borderRadius: '8px',
                        background: '#e0f2fe',
                        color: '#0369a1',
                        border: '1.5px solid #2c3e50'
                      }}>
                        +{bh.diemThuong} điểm
                      </span>
                    </div>

                    <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '4px 0' }}>
                      {bh.moTa}
                    </p>

                    <div style={{ width: '100%', marginTop: '10px' }}>
                      {isCompleted ? (
                        <div style={{
                          background: '#d1fae5',
                          color: '#065f46',
                          border: '2px solid #2c3e50',
                          borderRadius: '12px',
                          padding: '6px 12px',
                          fontWeight: 'bold',
                          fontSize: '0.85rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <CheckCircle2 size={16} />
                          Đã hoàn thành
                        </div>
                      ) : (
                        <div className="btn-bubble btn-pink" style={{
                          padding: '6px 16px',
                          fontSize: '0.85rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 3px 0 #d63031'
                        }}>
                          <Play size={14} fill="currentColor" />
                          Bắt đầu vẽ
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
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
