import React, { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import axios from 'axios';
import { API_URL } from '../../config';
import { 
  Edit2, Eraser, Image as ImageIcon, 
  Download, Save, Sparkles, Layout, Trash2, Smile
} from 'lucide-react';
import { HubConnection } from '@microsoft/signalr';

interface BangVeTreEmProps {
  userId: number;
  connection: HubConnection | null;
  maPhongVect?: string; // Nếu vẽ chung trong phòng
  onClose?: () => void;
}

export const BangVeTreEm: React.FC<BangVeTreEmProps> = ({ userId, connection, maPhongVect, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
  const [selectedColor, setSelectedColor] = useState('#ff6b81'); // Hồng mặc định
  const [brushSize, setBrushSize] = useState(8);
  const [tool, setTool] = useState<'pen' | 'eraser' | 'select'>('pen');
  const [autoShape, setAutoShape] = useState(true); // Bật mặc định tự nắn hình
  const [tieuDe, setTieuDe] = useState('Bức vẽ thần tiên');
  
  const [showStickers, setShowStickers] = useState(false);
  const [showBackgrounds, setShowBackgrounds] = useState(false);

  // List Stickers mẫu ngộ nghĩnh cho trẻ em
  const STICKERS = [
    { name: 'Mèo con', url: 'https://images.vexels.com/media/users/3/185213/isolated/preview/26e38b34003d7c387190de12470725ad-flat-kitten-cat.png' },
    { name: 'Kẹo ngọt', url: 'https://images.vexels.com/media/users/3/200096/isolated/preview/2c129e9215099b2446fec368da26e476-cute-swirly-lollipop-icon.png' },
    { name: 'Ngôi sao', url: 'https://images.vexels.com/media/users/3/136746/isolated/preview/2a66e4a065abf47b2c01991d3cb99a09-star-doodle-icon.png' },
    { name: 'Mặt trời', url: 'https://images.vexels.com/media/users/3/135118/isolated/preview/7c22998f48f435c24e6fb5b0583b27b4-sun-doodle-drawing.png' },
    { name: 'Vương miện', url: 'https://images.vexels.com/media/users/3/157297/isolated/preview/c4b8b600a0f0d2c676f4bf98a7281ee0-gold-tiara-princess-crown.png' },
    { name: 'Kẹo mút', url: 'https://images.vexels.com/media/users/3/145453/isolated/preview/363f735d4fa5cc083f2dc5e36f9efc53-lollipop-candy-color-doodle.png' }
  ];

  // List Backgrounds mẫu cho trẻ em
  const BACKGROUNDS = [
    { name: 'Mây hồng', color: '#ffe4e6' },
    { name: 'Đại dương', color: '#e0f2fe' },
    { name: 'Rừng xanh', color: '#f0fdf4' },
    { name: 'Vũ trụ', color: '#faf5ff' },
    { name: 'Bảng phấn', color: '#1e293b' }
  ];

  useEffect(() => {
    if (!canvasRef.current) return;

    // Khởi tạo Fabric Canvas
    const fbCanvas = new fabric.Canvas(canvasRef.current, {
      width: 750,
      height: 480,
      backgroundColor: '#ffffff',
      isDrawingMode: true
    });

    // Cấu hình bút vẽ mặc định
    fbCanvas.freeDrawingBrush!.color = selectedColor;
    fbCanvas.freeDrawingBrush!.width = brushSize;

    setCanvas(fbCanvas);

    return () => {
      fbCanvas.dispose();
    };
  }, []);

  // Theo dõi SignalR để nhận nét vẽ từ người khác (Vẽ chung)
  useEffect(() => {
    if (!connection || !canvas || !maPhongVect) return;

    connection.on('NhanNetVeDongBo', (duLieuNetVe: string) => {
      // Load nét vẽ mới nhận được vào Canvas
      (fabric.util.enlivenObjects as any)([JSON.parse(duLieuNetVe)], (objects: fabric.Object[]) => {
        objects.forEach(obj => {
          // Tránh bắn lại vòng lập vô tận
          (obj as any).fromRemote = true;
          canvas.add(obj);
          canvas.renderAll();
        });
      }, 'fabric');
    });

    return () => {
      connection.off('NhanNetVeDongBo');
    };
  }, [connection, canvas, maPhongVect]);

  // Cập nhật bút vẽ khi màu sắc hoặc nét vẽ thay đổi
  useEffect(() => {
    if (!canvas) return;
    if (tool === 'pen') {
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush!.color = selectedColor;
      canvas.freeDrawingBrush!.width = brushSize;
    } else if (tool === 'eraser') {
      canvas.isDrawingMode = true;
      // Dùng màu trắng làm màu xóa (hoặc dùng eraser brush nếu được hỗ trợ)
      canvas.freeDrawingBrush!.color = canvas.backgroundColor as string || '#ffffff';
      canvas.freeDrawingBrush!.width = brushSize * 2;
    } else {
      canvas.isDrawingMode = false;
    }
  }, [canvas, selectedColor, brushSize, tool]);

  // Lắng nghe sự kiện vẽ nét tự do xong để thực hiện Auto-shape (Nắn thẳng hình)
  useEffect(() => {
    if (!canvas) return;

    const handlePathCreated = (e: any) => {
      const path = e.path;
      if (!path || (path as any).fromRemote) return;

      // Đồng bộ sang SignalR nếu đang vẽ chung
      if (connection && maPhongVect) {
        const pathJson = JSON.stringify(path.toJSON());
        connection.invoke('DongBoNetVe', maPhongVect, pathJson).catch(err => console.error(err));
      }

      // Xử lý nắn hình
      if (autoShape && tool === 'pen') {
        const W = path.width;
        const H = path.height;
        const left = path.left;
        const top = path.top;

        // Nếu kích thước vẽ quá nhỏ, bỏ qua
        if (W < 20 || H < 20) return;

        const ratio = W / H;

        // Xóa path vẽ tay cũ
        canvas.remove(path);

        let newObj: fabric.Object;

        // Nếu tỷ lệ gần 1:1, nắn thành Hình tròn hoặc Hình vuông
        if (ratio >= 0.82 && ratio <= 1.22) {
          // Kiểm tra xem nét vẽ có xu hướng khép kín kiểu tròn không (giả lập)
          // Để thân thiện với bé, ta tự động nắn thành hình tròn đẹp
          newObj = new fabric.Circle({
            left: left,
            top: top,
            radius: (W + H) / 4,
            fill: 'transparent',
            stroke: selectedColor,
            strokeWidth: brushSize,
            cornerColor: 'var(--color-primary)',
            transparentCorners: false
          });
        } else {
          // Nắn thành Hình chữ nhật chuẩn
          newObj = new fabric.Rect({
            left: left,
            top: top,
            width: W,
            height: H,
            fill: 'transparent',
            stroke: selectedColor,
            strokeWidth: brushSize,
            cornerColor: 'var(--color-primary)',
            transparentCorners: false
          });
        }

        canvas.add(newObj);
        canvas.setActiveObject(newObj);
        canvas.renderAll();

        // Đồng bộ hình học mới được nắn lên phòng vẽ chung
        if (connection && maPhongVect) {
          const objJson = JSON.stringify(newObj.toJSON());
          connection.invoke('DongBoNetVe', maPhongVect, objJson).catch(err => console.error(err));
        }
      }
    };

    canvas.on('path:created', handlePathCreated);

    return () => {
      canvas.off('path:created', handlePathCreated);
    };
  }, [canvas, autoShape, tool, selectedColor, brushSize, connection, maPhongVect]);

  // Thêm Sticker vào bảng vẽ
  const addSticker = (url: string) => {
    if (!canvas) return;
    (fabric.Image as any).fromURL(url, (img: any) => {
      img.scaleToWidth(120);
      img.set({
        left: 100,
        top: 100,
        cornerColor: 'var(--color-primary)',
        cornerSize: 10,
        transparentCorners: false
      });
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();
      setShowStickers(false);

      // Đồng bộ chèn sticker thời gian thực lên SignalR
      if (connection && maPhongVect) {
        connection.invoke('DongBoNetVe', maPhongVect, JSON.stringify(img.toJSON())).catch(err => console.error(err));
      }
    }, { crossOrigin: 'anonymous' });
  };

  // Đổi hình nền hoạt hình
  const setBackground = (color: string) => {
    if (!canvas) return;
    (canvas as any).setBackgroundColor(color, () => {
      canvas.renderAll();
    });
    setShowBackgrounds(false);
  };

  // Xóa sạch bảng vẽ
  const clearCanvas = () => {
    if (!canvas) return;
    if (confirm("Con có muốn xóa sạch bảng vẽ để vẽ lại từ đầu không?")) {
      canvas.clear();
      (canvas as any).setBackgroundColor('#ffffff', () => canvas.renderAll());
    }
  };

  // Tải ảnh vẽ về máy (Xuất file PNG)
  const downloadDrawing = () => {
    if (!canvas) return;
    const dataURL = canvas.toDataURL({
      format: 'png',
      quality: 1.0,
      multiplier: 1
    });
    const link = document.createElement('a');
    link.download = `${tieuDe}.png`;
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Lưu bản vẽ lên Database
  const saveDrawing = async () => {
    if (!canvas) return;
    try {
      const canvasJson = JSON.stringify(canvas.toJSON());
      const thumbnailBase64 = canvas.toDataURL({ format: 'png', quality: 0.5, multiplier: 1 });

      await axios.post(`${API_URL}/drawing/save`, {
        id: 0,
        nguoiDungId: userId,
        tieuDe: tieuDe,
        duLieuCanvasJson: canvasJson,
        anhThuNhoUrl: thumbnailBase64,
        congKhai: false
      });

      alert("Tuyệt vời! Bức vẽ của con đã được lưu vào bộ sưu tập.");
    } catch (err) {
      console.error(err);
      alert("Không thể lưu bản vẽ, hãy thử lại sau.");
    }
  };

  return (
    <div className="bubble-card" style={{
      width: '100%',
      maxWidth: '820px',
      margin: '20px auto',
      background: 'white',
      padding: '20px'
    }}>
      {/* Tiêu đề bảng vẽ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '15px' }}>
        <input 
          type="text" 
          value={tieuDe}
          onChange={(e) => setTieuDe(e.target.value)}
          style={{
            fontSize: '1.5rem',
            fontWeight: 'bold',
            color: '#2c3e50',
            border: 'none',
            borderBottom: '3px solid var(--color-sun)',
            outline: 'none',
            fontFamily: 'var(--font-kids)',
            width: '280px'
          }}
        />
        
        {/* Nút bật/tắt Auto-shape nắn hình */}
        <button 
          onClick={() => setAutoShape(!autoShape)}
          style={{
            background: autoShape ? 'var(--color-purple)' : '#e2e8f0',
            color: autoShape ? 'white' : '#64748b',
            border: '2px solid #2c3e50',
            borderRadius: '99px',
            padding: '8px 16px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontFamily: 'var(--font-kids)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: autoShape ? '0 4px 0 #8854d0' : 'none'
          }}>
          <Sparkles size={16} />
          {autoShape ? "Đang bật Tự Nắn Nét Vẽ" : "Đã tắt Tự Nắn Nét Vẽ"}
        </button>
      </div>

      {/* Toolbar vẽ chính */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '10px',
        marginBottom: '16px',
        background: '#f8fafc',
        border: '3px solid #2c3e50',
        borderRadius: '16px',
        padding: '10px'
      }}>
        {/* Chọn công cụ */}
        <button 
          onClick={() => setTool('pen')}
          style={{
            background: tool === 'pen' ? 'var(--color-primary)' : 'white',
            color: tool === 'pen' ? 'white' : '#2c3e50',
            border: '2px solid #2c3e50',
            borderRadius: '12px',
            width: '42px',
            height: '42px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Bút vẽ tự do">
          <Edit2 size={20} />
        </button>

        <button 
          onClick={() => setTool('eraser')}
          style={{
            background: tool === 'eraser' ? 'var(--color-primary)' : 'white',
            color: tool === 'eraser' ? 'white' : '#2c3e50',
            border: '2px solid #2c3e50',
            borderRadius: '12px',
            width: '42px',
            height: '42px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Cục tẩy">
          <Eraser size={20} />
        </button>

        <button 
          onClick={() => setTool('select')}
          style={{
            background: tool === 'select' ? 'var(--color-primary)' : 'white',
            color: tool === 'select' ? 'white' : '#2c3e50',
            border: '2px solid #2c3e50',
            borderRadius: '12px',
            width: '42px',
            height: '42px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Chọn & Di chuyển nhãn dán">
          <Layout size={20} />
        </button>

        <div style={{ height: '30px', width: '3px', background: '#e2e8f0', margin: '6px 5px' }}></div>

        {/* Chọn cỡ cọ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Nét bút:</span>
          <input 
            type="range" 
            min="3" 
            max="30" 
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            style={{ width: '80px', cursor: 'pointer' }}
          />
        </div>

        <div style={{ height: '30px', width: '3px', background: '#e2e8f0', margin: '6px 5px' }}></div>

        {/* Nút Nhãn dán và Background */}
        <button 
          onClick={() => { setShowStickers(!showStickers); setShowBackgrounds(false); }}
          style={{
            background: 'white',
            color: '#2c3e50',
            border: '2px solid #2c3e50',
            borderRadius: '12px',
            padding: '8px 12px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontFamily: 'var(--font-kids)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
          <Smile size={18} />
          Nhãn dán
        </button>

        <button 
          onClick={() => { setShowBackgrounds(!showBackgrounds); setShowStickers(false); }}
          style={{
            background: 'white',
            color: '#2c3e50',
            border: '2px solid #2c3e50',
            borderRadius: '12px',
            padding: '8px 12px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontFamily: 'var(--font-kids)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
          <ImageIcon size={18} />
          Hình nền
        </button>

        <div style={{ flex: 1 }}></div>

        {/* Các nút hành động lưu / tải */}
        <button onClick={saveDrawing} className="btn-bubble btn-green" style={{ padding: '8px 16px', fontSize: '0.85rem', boxShadow: '0 3px 0 #00b894' }}>
          <Save size={16} />
          Lưu
        </button>

        <button onClick={downloadDrawing} className="btn-bubble btn-blue" style={{ padding: '8px 16px', fontSize: '0.85rem', boxShadow: '0 3px 0 #0984e3' }}>
          <Download size={16} />
          Tải ảnh
        </button>

        <button onClick={clearCanvas} style={{
          background: 'none',
          color: '#ff6b81',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontWeight: 'bold'
        }}>
          <Trash2 size={18} />
          Xóa sạch
        </button>
      </div>

      {/* Popups chọn Stickers */}
      {showStickers && (
        <div style={{
          background: '#f8fafc',
          border: '3px solid #2c3e50',
          borderRadius: '16px',
          padding: '16px',
          marginBottom: '16px',
          display: 'flex',
          gap: '16px',
          overflowX: 'auto'
        }}>
          {STICKERS.map((sticker, idx) => (
            <div key={idx} onClick={() => addSticker(sticker.url)} style={{
              cursor: 'pointer',
              padding: '6px',
              border: '2px solid transparent',
              borderRadius: '12px',
              transition: 'all 0.2s'
            }}
            className="hover-bounce">
              <img src={sticker.url} alt={sticker.name} style={{ width: '60px', height: '60px', objectFit: 'contain' }} />
              <div style={{ fontSize: '0.75rem', textAlign: 'center', fontWeight: 'bold', marginTop: '4px' }}>{sticker.name}</div>
            </div>
          ))}
        </div>
      )}

      {/* Popups chọn Backgrounds */}
      {showBackgrounds && (
        <div style={{
          background: '#f8fafc',
          border: '3px solid #2c3e50',
          borderRadius: '16px',
          padding: '16px',
          marginBottom: '16px',
          display: 'flex',
          gap: '12px'
        }}>
          {BACKGROUNDS.map((bg, idx) => (
            <button 
              key={idx} 
              onClick={() => setBackground(bg.color)}
              style={{
                background: bg.color,
                width: '60px',
                height: '60px',
                border: '2px solid #2c3e50',
                borderRadius: '12px',
                cursor: 'pointer',
                boxShadow: '0 4px 0 #2c3e50'
              }}
              title={bg.name}
            />
          ))}
        </div>
      )}

      {/* Canvas vẽ chính */}
      <div style={{
        border: '5px solid #2c3e50',
        borderRadius: '24px',
        overflow: 'hidden',
        boxShadow: '0 10px 0 #2c3e50, 0 20px 30px rgba(0,0,0,0.08)',
        background: 'white',
        width: '750px',
        height: '480px',
        margin: '0 auto'
      }}>
        <canvas ref={canvasRef} />
      </div>

      {/* Bảng màu Palette hoạt hình (dưới canvas) */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '10px',
        marginTop: '24px',
        background: '#f8fafc',
        border: '3px solid #2c3e50',
        borderRadius: '16px',
        padding: '12px'
      }}>
        {/* Vòng tròn màu cầu vồng tuyển chọn */}
        {['#ff6b81', '#ff4757', '#ff7f50', '#ffa502', '#ffd32a', '#2bcbba', '#7bed9f', '#70a1ff', '#1e90ff', '#a55eea', '#2f3542', '#ffffff'].map((color) => (
          <button 
            key={color}
            onClick={() => setSelectedColor(color)}
            style={{
              background: color,
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: selectedColor === color ? '4px solid #2c3e50' : '2px solid #cbd5e1',
              cursor: 'pointer',
              transform: selectedColor === color ? 'scale(1.2)' : 'none',
              transition: 'transform 0.1s'
            }}
          />
        ))}
      </div>

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
