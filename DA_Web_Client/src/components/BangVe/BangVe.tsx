import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../../config';
import { 
  Undo2, Redo2, Paintbrush, Eraser, PaintBucket, Pipette, Move, 
  Square, Circle, Triangle, Slash, Layers, Eye, EyeOff, Plus, 
  Trash2, ArrowUp, ArrowDown, Settings, Save, Download, Sparkles, 
  Smile, Image as ImageIcon, Check, X, ZoomIn, ZoomOut, RefreshCw,
  Maximize2, Minimize2, Scissors
} from 'lucide-react';
import { HubConnection } from '@microsoft/signalr';

interface Point {
  x: number;
  y: number;
  pressure?: number;
}

interface Stroke {
  id: string;
  type: 'freehand' | 'shape' | 'bucket' | 'image';
  points?: Point[];
  shapeType?: 'line' | 'circle' | 'rectangle' | 'triangle';
  start?: Point;
  end?: Point;
  color: string;
  size: number;
  opacity: number;
  isEraser?: boolean;
  imgUrl?: string;
  imgX?: number;
  imgY?: number;
  imgW?: number;
  imgH?: number;
  tolerance?: number;
}

interface Layer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number; // 0 to 1
  blendMode: GlobalCompositeOperation;
  strokes: Stroke[];
}

interface BangVeProps {
  userId: number;
  connection: HubConnection | null;
  maPhongVect?: string; // Nếu vẽ chung trong phòng
  banVeId?: number; // Cấp ID bản vẽ để tải/lưu đúng
  onClose?: () => void;
}

export const BangVe: React.FC<BangVeProps> = ({ userId, connection, maPhongVect, banVeId, onClose }) => {
  const scratchCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOverlayFullscreen, setIsOverlayFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = !!document.fullscreenElement;
      if (!isFs) {
        setIsOverlayFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    
    if (!isOverlayFullscreen) {
      setIsOverlayFullscreen(true);
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen().catch((err) => {
          console.warn("Fullscreen API failed, using CSS fallback:", err);
        });
      }
    } else {
      setIsOverlayFullscreen(false);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch((err) => {
          console.warn("Exit Fullscreen API failed:", err);
        });
      }
    }
  };
  
  // State quản lý dự án
  const [tieuDe, setTieuDe] = useState('Bức vẽ thần tiên');
  const [currentBanVeId, setCurrentBanVeId] = useState<number>(banVeId || 0);
  
  // Kích thước canvas cố định theo chuẩn màn hình máy tính 16:9
  const canvasWidth = 960;
  const canvasHeight = 540;

  // Zoom và Pan
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  // Thiết lập công cụ
  const [tool, setTool] = useState<'pen' | 'pencil' | 'brush' | 'airbrush' | 'eraser' | 'stroke_eraser' | 'bucket' | 'picker' | 'pan'>('brush');
  const [strokeEraserEnabled, setStrokeEraserEnabled] = useState(false);
  const [brushColor, setBrushColor] = useState('#6c5ce7'); // Màu mặc định đẹp
  const [brushSize, setBrushSize] = useState(10);
  const [brushOpacity, setBrushOpacity] = useState(1.0);
  const [stabilizer, setStabilizer] = useState(6); // Mức độ mượt nét vẽ (0-10)
  const [tolerance, setTolerance] = useState(30); // Độ lệch màu khi đổ màu (0-255)
  const [pressureEnabled, setPressureEnabled] = useState(true);
  const hasDeletedAnyRef = useRef(false);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // Nhận dạng hình tự động (Hold to Snap)
  const [autoShape, setAutoShape] = useState(true);
  const [isSnapped, setIsSnapped] = useState(false);
  const [snappedType, setSnappedType] = useState<'line' | 'circle' | 'rectangle' | 'triangle'>('line');
  const shapeHoldTimerRef = useRef<any>(null);
  const shapeHoldStartCoordsRef = useRef<Point | null>(null);
  const isSnappedRef = useRef(false);
  const snappedShapeRef = useRef<{
    type: 'line' | 'circle' | 'rectangle' | 'triangle';
    start: Point;
    end: Point;
  } | null>(null);

  // Danh sách Layer (Mặc định có Background trắng và Layer 1 trống)
  const [layers, setLayers] = useState<Layer[]>([
    { id: 'layer-bg', name: 'Background', visible: true, opacity: 1.0, blendMode: 'source-over', strokes: [] },
    { id: 'layer-1', name: 'Layer 1', visible: true, opacity: 1.0, blendMode: 'source-over', strokes: [] }
  ]);
  const [activeLayerId, setActiveLayerId] = useState<string>('layer-1');
  
  // Refs hỗ trợ vẽ thời gian thực và đồng bộ React nhanh
  const layersRef = useRef<Layer[]>(layers);
  const activeLayerIdRef = useRef<string>(activeLayerId);
  const brushColorRef = useRef(brushColor);
  const brushSizeRef = useRef(brushSize);
  const brushOpacityRef = useRef(brushOpacity);
  const toolRef = useRef(tool);
  const strokeEraserEnabledRef = useRef(strokeEraserEnabled);
  const autoShapeRef = useRef(autoShape);
  const stabilizerRef = useRef(stabilizer);
  const toleranceRef = useRef(tolerance);
  const pressureEnabledRef = useRef(pressureEnabled);
  
  // Lịch sử Undo / Redo
  const undoStackRef = useRef<any[]>([]);
  const redoStackRef = useRef<any[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Trạng thái vẽ
  const isDrawingRef = useRef(false);
  const pointsRef = useRef<Point[]>([]);
  const lastSmoothedPointRef = useRef<Point | null>(null);
  const brushTipCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sticker và Background nhanh
  const [showStickers, setShowStickers] = useState(false);
  const [customStickerUrl, setCustomStickerUrl] = useState('');
  const [customSwatches, setCustomSwatches] = useState<string[]>(() => {
    const saved = localStorage.getItem('custom_swatches');
    return saved ? JSON.parse(saved) : ['#ff7675', '#fd79a8', '#ffeaa7', '#55efc4', '#81ecec', '#74b9ff', '#a29bfe', '#dfe6e9'];
  });

  const STICKERS = [
    { name: 'Mèo con', url: 'https://cdn-icons-png.flaticon.com/512/616/616430.png' },
    { name: 'Chó con', url: 'https://cdn-icons-png.flaticon.com/512/616/616408.png' },
    { name: 'Ngôi sao', url: 'https://cdn-icons-png.flaticon.com/512/1828/1828884.png' },
    { name: 'Mặt trời', url: 'https://cdn-icons-png.flaticon.com/512/4814/4814268.png' },
    { name: 'Mặt trăng', url: 'https://cdn-icons-png.flaticon.com/512/3659/3659296.png' },
    { name: 'Cầu vồng', url: 'https://cdn-icons-png.flaticon.com/512/2635/2635419.png' },
    { name: 'Tên lửa', url: 'https://cdn-icons-png.flaticon.com/512/1356/1356479.png' },
    { name: 'Pizza', url: 'https://cdn-icons-png.flaticon.com/512/3595/3595455.png' },
    { name: 'Kem cây', url: 'https://cdn-icons-png.flaticon.com/512/938/938063.png' },
    { name: 'Vương miện', url: 'https://cdn-icons-png.flaticon.com/512/2636/2636428.png' },
    { name: 'Trái tim', url: 'https://cdn-icons-png.flaticon.com/512/833/833472.png' },
    { name: 'Tay chơi game', url: 'https://cdn-icons-png.flaticon.com/512/3408/3408506.png' },
    { name: 'Smile Emoji', url: 'https://cdn-icons-png.flaticon.com/512/4951/4951557.png' },
    { name: 'Gấu Trúc', url: 'https://cdn-icons-png.flaticon.com/512/3504/3504810.png' },
    { name: 'Thỏ con', url: 'https://cdn-icons-png.flaticon.com/512/3504/3504781.png' },
    { name: 'Gấu Teddy', url: 'https://cdn-icons-png.flaticon.com/512/3069/3069172.png' },
    { name: 'Kim cương', url: 'https://cdn-icons-png.flaticon.com/512/1045/1045239.png' },
    { name: 'Ngọn lửa', url: 'https://cdn-icons-png.flaticon.com/512/785/785116.png' },
    { name: 'Bông hoa', url: 'https://cdn-icons-png.flaticon.com/512/3468/3468383.png' },
    { name: 'Xương rồng', url: 'https://cdn-icons-png.flaticon.com/512/3069/3069136.png' }
  ];

  const SWATCH_PALETTE = [
    // Hàng 1: Màu cơ bản đậm
    '#d63031', '#e84393', '#e17055', '#fdcb6e', '#00b894', '#00cec9', '#0984e3', '#6c5ce7', '#2d3436', '#ffffff',
    // Hàng 2: Màu nhạt / Pastel
    '#ff7675', '#fd79a8', '#fab1a0', '#ffeaa7', '#55efc4', '#81ecec', '#74b9ff', '#a29bfe', '#b2bec3', '#dfe6e9',
    // Hàng 3: Màu da vẽ Anime & Tone ấm
    '#fed330', '#f7b731', '#fa8231', '#ef5777', '#f8a5c2', '#ffdd59', '#ffd2ff', '#ffecd2', '#fcb69f', '#ff9a9e'
  ];

  // Đồng bộ hóa Refs với States
  useEffect(() => { layersRef.current = layers; }, [layers]);
  useEffect(() => { activeLayerIdRef.current = activeLayerId; }, [activeLayerId]);
  useEffect(() => { brushColorRef.current = brushColor; }, [brushColor]);
  useEffect(() => { brushSizeRef.current = brushSize; }, [brushSize]);
  useEffect(() => { brushOpacityRef.current = brushOpacity; }, [brushOpacity]);
  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { strokeEraserEnabledRef.current = strokeEraserEnabled; }, [strokeEraserEnabled]);
  useEffect(() => { autoShapeRef.current = autoShape; }, [autoShape]);
  useEffect(() => { stabilizerRef.current = stabilizer; }, [stabilizer]);
  useEffect(() => { toleranceRef.current = tolerance; }, [tolerance]);
  useEffect(() => { pressureEnabledRef.current = pressureEnabled; }, [pressureEnabled]);

  // Khởi tạo Canvas đầu tiên
  useEffect(() => {
    // Đợi DOM render rồi mới fill Background trắng cho layer-bg
    setTimeout(() => {
      const bgCanvas = document.getElementById('canvas-layer-layer-bg') as HTMLCanvasElement;
      if (bgCanvas) {
        const ctx = bgCanvas.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      }
      saveHistoryState();
    }, 200);

    // Tải bản vẽ cũ từ Database nếu có
    if (banVeId && banVeId > 0 && banVeId !== 999) {
      axios.get(`${API_URL}/Drawing/${banVeId}?userId=${userId}`)
        .then(res => {
          if (res.data) {
            setTieuDe(res.data.tieuDe || 'Bức vẽ thần tiên');
            setCurrentBanVeId(res.data.id);
            if (res.data.duLieuCanvasJson) {
              loadDrawingFromJson(res.data.duLieuCanvasJson);
            }
          }
        })
        .catch(err => console.error("Lỗi lấy thông tin bản vẽ:", err));
    }
  }, []);

  // Lắng nghe vẽ chung qua SignalR
  useEffect(() => {
    if (!connection || !maPhongVect) return;

    const handleRemoteStroke = (duLieuNetVe: string) => {
      handleRemoteDraw(duLieuNetVe);
    };

    connection.on('NhanNetVeDongBo', handleRemoteStroke);

    return () => {
      connection.off('NhanNetVeDongBo');
    };
  }, [connection, maPhongVect, layers]);

  // Cập nhật cấu hình Cọ vẽ khi cài đặt thay đổi
  useEffect(() => {
    updateBrushTip();
  }, [brushColor, brushSize, tool, brushOpacity]);

  // Hàm tạo Brush Tip (Cọ vẽ)
  const updateBrushTip = () => {
    const canvas = brushTipCanvasRef.current || document.createElement('canvas');
    brushTipCanvasRef.current = canvas;
    const size = brushSize;
    canvas.width = size * 2;
    canvas.height = size * 2;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cx = size;
    const cy = size;

    if (tool === 'pen') {
      // Bút máy nét cứng chuẩn
      ctx.fillStyle = brushColor;
      ctx.beginPath();
      ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (tool === 'pencil') {
      // Bút chì nhám hạt graphite
      ctx.fillStyle = brushColor;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
      ctx.fill();
      // Tạo nhiễu hạt chì
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0) {
          const noise = (Math.random() - 0.5) * 160;
          data[i + 3] = Math.max(0, Math.min(255, data[i + 3] + noise));
        }
      }
      ctx.putImageData(imgData, 0, 0);
    } else if (tool === 'brush') {
      // Cọ vẽ mềm mịn màng
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size);
      grad.addColorStop(0, brushColor);
      grad.addColorStop(0.3, hexToRgba(brushColor, 0.7));
      grad.addColorStop(1, hexToRgba(brushColor, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, size, 0, Math.PI * 2);
      ctx.fill();
    } else if (tool === 'airbrush') {
      // Cọ phun sơn hạt siêu mịn
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size);
      grad.addColorStop(0, hexToRgba(brushColor, 0.25));
      grad.addColorStop(0.5, hexToRgba(brushColor, 0.08));
      grad.addColorStop(1, hexToRgba(brushColor, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, size, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  // Convert Hex to RGBA
  const hexToRgba = (hex: string, alpha: number) => {
    let c = hex.substring(1);
    if (c.length === 3) {
      c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    }
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Trích xuất chế độ trộn màu CSS từ blendMode canvas
  const getMixBlendMode = (mode: string) => {
    switch (mode) {
      case 'source-over': return 'normal';
      case 'multiply': return 'multiply';
      case 'screen': return 'screen';
      case 'overlay': return 'overlay';
      case 'darken': return 'darken';
      case 'lighten': return 'lighten';
      case 'color-burn': return 'color-burn';
      default: return 'normal';
    }
  };

  // Lấy tọa độ tương đối trên Canvas (hỗ trợ scale/pan)
  const getCanvasCoords = (clientX: number, clientY: number, canvasEl: HTMLCanvasElement) => {
    const rect = canvasEl.getBoundingClientRect();
    const x = (clientX - rect.left) * (canvasWidth / rect.width);
    const y = (clientY - rect.top) * (canvasHeight / rect.height);
    return { x, y };
  };

  // ----------------------------------------------------
  // HÀM VẼ CHÍNH & POINTER EVENTS
  // ----------------------------------------------------
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const currentTool = toolRef.current;
    if (currentTool === 'pan') return;

    const scratch = scratchCanvasRef.current;
    if (!scratch) return;

    const coords = getCanvasCoords(e.clientX, e.clientY, scratch);
    const pressure = e.pointerType === 'pen' && pressureEnabledRef.current ? e.pressure : 1.0;

    isDrawingRef.current = true;
    pointsRef.current = [{ ...coords, pressure }];
    lastSmoothedPointRef.current = { ...coords, pressure };

    // Bắt đầu timer để tự động nắn hình
    if (autoShapeRef.current && (currentTool === 'pen' || currentTool === 'brush' || currentTool === 'pencil')) {
      isSnappedRef.current = false;
      setIsSnapped(false);
      snappedShapeRef.current = null;
      shapeHoldStartCoordsRef.current = { x: coords.x, y: coords.y };
      
      if (shapeHoldTimerRef.current) clearTimeout(shapeHoldTimerRef.current);
      shapeHoldTimerRef.current = setTimeout(() => {
        if (isDrawingRef.current && pointsRef.current.length > 5) {
          triggerShapeSnap();
        }
      }, 5500); // 5.5s giữ im bút vẽ
    }

    // Các tác vụ vẽ tức thì
    if (currentTool === 'picker') {
      pickColorAt(coords.x, coords.y);
      isDrawingRef.current = false;
      return;
    }

    if (currentTool === 'bucket') {
      fillBucketAt(coords.x, coords.y);
      isDrawingRef.current = false;
      return;
    }

    if (currentTool === 'stroke_eraser' || (currentTool === 'eraser' && strokeEraserEnabledRef.current)) {
      isDrawingRef.current = true;
      eraseStrokeAt(coords.x, coords.y);
      return;
    }

    // Thiết lập cho cọ vẽ nháy màu
    const scratchCtx = scratch.getContext('2d')!;
    scratchCtx.clearRect(0, 0, canvasWidth, canvasHeight);

    const activeCanvas = document.getElementById(`canvas-layer-${activeLayerIdRef.current}`) as HTMLCanvasElement;
    if (currentTool === 'eraser' && !strokeEraserEnabledRef.current && activeCanvas) {
      // Eraser vẽ trực tiếp trên Layer hiện tại
      const activeCtx = activeCanvas.getContext('2d')!;
      activeCtx.save();
      activeCtx.globalCompositeOperation = 'destination-out';
      activeCtx.lineCap = 'round';
      activeCtx.lineJoin = 'round';
      activeCtx.lineWidth = brushSizeRef.current;
      activeCtx.beginPath();
      activeCtx.moveTo(coords.x, coords.y);
      activeCtx.lineTo(coords.x, coords.y);
      activeCtx.stroke();
      activeCtx.restore();
    } else {
      // Các nét vẽ thông thường vẽ lên Scratch
      stampBrushAt(scratchCtx, coords.x, coords.y, pressure);
    }
  };

  const handleCanvasPointerLeave = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (shapeHoldTimerRef.current) clearTimeout(shapeHoldTimerRef.current);
    if (isDrawingRef.current) {
      handleCanvasPointerUp(e);
    } else {
      const scratch = scratchCanvasRef.current;
      if (scratch) {
        scratch.getContext('2d')!.clearRect(0, 0, canvasWidth, canvasHeight);
      }
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();

    const scratch = scratchCanvasRef.current;
    if (!scratch) return;

    const coords = getCanvasCoords(e.clientX, e.clientY, scratch);
    const pressure = e.pointerType === 'pen' && pressureEnabledRef.current ? e.pressure : 1.0;
    const currentTool = toolRef.current;

    if (!isDrawingRef.current) {
      // Draw Brush size circle guide (Tránh vẽ nhầm / tẩy nhầm)
      const scratchCtx = scratch.getContext('2d')!;
      scratchCtx.clearRect(0, 0, canvasWidth, canvasHeight);
      
      if (currentTool === 'stroke_eraser' || (currentTool === 'eraser' && strokeEraserEnabledRef.current)) {
        scratchCtx.save();
        // Draw dashed orange outline circle for stroke eraser
        scratchCtx.beginPath();
        scratchCtx.arc(coords.x, coords.y, 12, 0, Math.PI * 2);
        scratchCtx.strokeStyle = '#ff7675';
        scratchCtx.lineWidth = 1.5;
        scratchCtx.stroke();
        
        // Draw crosshair guide
        scratchCtx.beginPath();
        scratchCtx.moveTo(coords.x - 5, coords.y - 5);
        scratchCtx.lineTo(coords.x + 5, coords.y + 5);
        scratchCtx.moveTo(coords.x + 5, coords.y - 5);
        scratchCtx.lineTo(coords.x - 5, coords.y + 5);
        scratchCtx.strokeStyle = '#ff7675';
        scratchCtx.lineWidth = 1.5;
        scratchCtx.stroke();
        scratchCtx.restore();
        return;
      }

      if (currentTool === 'brush' || currentTool === 'pen' || currentTool === 'pencil' || currentTool === 'airbrush' || (currentTool === 'eraser' && !strokeEraserEnabledRef.current)) {
        const radius = brushSizeRef.current / 2;
        scratchCtx.save();
        
        // Outline 1: White solid
        scratchCtx.beginPath();
        scratchCtx.arc(coords.x, coords.y, radius, 0, Math.PI * 2);
        scratchCtx.strokeStyle = '#ffffff';
        scratchCtx.lineWidth = 1.5;
        scratchCtx.stroke();
        
        // Outline 2: Black dashed for high contrast
        scratchCtx.beginPath();
        scratchCtx.arc(coords.x, coords.y, radius, 0, Math.PI * 2);
        scratchCtx.strokeStyle = '#000000';
        scratchCtx.lineWidth = 1.0;
        scratchCtx.setLineDash([3, 3]);
        scratchCtx.stroke();
        
        // Tiny center dot
        scratchCtx.beginPath();
        scratchCtx.arc(coords.x, coords.y, 1.5, 0, Math.PI * 2);
        scratchCtx.fillStyle = '#ffffff';
        scratchCtx.fill();
        scratchCtx.beginPath();
        scratchCtx.arc(coords.x, coords.y, 0.8, 0, Math.PI * 2);
        scratchCtx.fillStyle = '#000000';
        scratchCtx.fill();
        
        scratchCtx.restore();
      }
      return;
    }

    if (currentTool === 'stroke_eraser' || (currentTool === 'eraser' && strokeEraserEnabledRef.current)) {
      if (isDrawingRef.current) {
        eraseStrokeAt(coords.x, coords.y);
      }
      return;
    }

    const lastPoint = pointsRef.current[pointsRef.current.length - 1];
    pointsRef.current.push({ ...coords, pressure });

    // Nếu dịch chuyển ra xa quá 8px so với điểm bắt đầu giữ thì reset timer nắn nét
    if (autoShapeRef.current && shapeHoldStartCoordsRef.current && (currentTool === 'pen' || currentTool === 'brush' || currentTool === 'pencil')) {
      const distFromStart = Math.hypot(coords.x - shapeHoldStartCoordsRef.current.x, coords.y - shapeHoldStartCoordsRef.current.y);
      if (distFromStart > 8) {
        shapeHoldStartCoordsRef.current = { x: coords.x, y: coords.y };
        if (shapeHoldTimerRef.current) {
          clearTimeout(shapeHoldTimerRef.current);
        }
        shapeHoldTimerRef.current = setTimeout(() => {
          if (isDrawingRef.current && pointsRef.current.length > 5) {
            triggerShapeSnap();
          }
        }, 5500);
      }
    }

    if (isSnappedRef.current && snappedShapeRef.current) {
      // Khi đã nắn hình, kéo rê để chỉnh sửa điểm kết thúc
      snappedShapeRef.current.end = { x: coords.x, y: coords.y };
      renderSnappedShapePreview();
      return;
    }

    const scratchCtx = scratch.getContext('2d')!;
    const activeCanvas = document.getElementById(`canvas-layer-${activeLayerIdRef.current}`) as HTMLCanvasElement;

    // Làm mượt nét vẽ (Stabilizer)
    const lastSmoothed = lastSmoothedPointRef.current;
    if (lastSmoothed) {
      const strength = stabilizerRef.current / 10; // 0 -> 0.9
      const sx = lastSmoothed.x + (coords.x - lastSmoothed.x) * (1 - strength);
      const sy = lastSmoothed.y + (coords.y - lastSmoothed.y) * (1 - strength);
      const sp = lastSmoothed.pressure + (pressure - lastSmoothed.pressure) * (1 - strength);

      const nextSmoothed = { x: sx, y: sy, pressure: sp };

      if (currentTool === 'eraser' && !strokeEraserEnabledRef.current && activeCanvas) {
        const activeCtx = activeCanvas.getContext('2d')!;
        activeCtx.save();
        activeCtx.globalCompositeOperation = 'destination-out';
        activeCtx.lineCap = 'round';
        activeCtx.lineJoin = 'round';
        activeCtx.lineWidth = brushSizeRef.current;
        activeCtx.beginPath();
        activeCtx.moveTo(lastSmoothed.x, lastSmoothed.y);
        activeCtx.lineTo(sx, sy);
        activeCtx.stroke();
        activeCtx.restore();
      } else {
        // Nối nét trên Scratch
        drawSegment(scratchCtx, lastSmoothed, nextSmoothed, pressureEnabledRef.current);
      }

      lastSmoothedPointRef.current = nextSmoothed;
    }
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (shapeHoldTimerRef.current) clearTimeout(shapeHoldTimerRef.current);
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    const currentTool = toolRef.current;
    if (currentTool === 'stroke_eraser' || (currentTool === 'eraser' && strokeEraserEnabledRef.current)) {
      if (hasDeletedAnyRef.current) {
        saveHistoryState();
        hasDeletedAnyRef.current = false;
      }
      return;
    }

    const scratch = scratchCanvasRef.current;
    const activeCanvas = document.getElementById(`canvas-layer-${activeLayerIdRef.current}`) as HTMLCanvasElement;
    
    if (!scratch || !activeCanvas) return;

    const activeCtx = activeCanvas.getContext('2d')!;
    activeCtx.save();

    const strokeId = `stroke-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    if (isSnappedRef.current && snappedShapeRef.current) {
      // Vẽ hình đã nắn lên Layer
      activeCtx.globalAlpha = brushOpacityRef.current;
      drawShape(activeCtx, snappedShapeRef.current.type, snappedShapeRef.current.start, snappedShapeRef.current.end, brushColorRef.current, brushSizeRef.current);
      
      const newStroke: Stroke = {
        id: strokeId,
        type: 'shape',
        shapeType: snappedShapeRef.current.type,
        start: snappedShapeRef.current.start,
        end: snappedShapeRef.current.end,
        color: brushColorRef.current,
        size: brushSizeRef.current,
        opacity: brushOpacityRef.current
      };
      setLayers(prev => prev.map(l => l.id === activeLayerIdRef.current ? { ...l, strokes: [...(l.strokes || []), newStroke] } : l));

      // Đồng bộ vẽ hình qua SignalR
      syncDrawing({
        id: strokeId,
        type: 'shape',
        shapeType: snappedShapeRef.current.type,
        start: snappedShapeRef.current.start,
        end: snappedShapeRef.current.end,
        color: brushColorRef.current,
        size: brushSizeRef.current,
        opacity: brushOpacityRef.current,
        layerId: activeLayerIdRef.current
      });
    } else if (currentTool !== 'eraser' && currentTool !== 'picker' && currentTool !== 'bucket') {
      // Gộp nét từ Scratch canvas lên Layer chính
      activeCtx.globalAlpha = brushOpacityRef.current;
      activeCtx.drawImage(scratch, 0, 0);

      const newStroke: Stroke = {
        id: strokeId,
        type: 'freehand',
        points: pointsRef.current,
        color: brushColorRef.current,
        size: brushSizeRef.current,
        opacity: brushOpacityRef.current,
        isEraser: false
      };
      setLayers(prev => prev.map(l => l.id === activeLayerIdRef.current ? { ...l, strokes: [...(l.strokes || []), newStroke] } : l));

      // Đồng bộ nét vẽ tự do qua SignalR
      syncDrawing({
        id: strokeId,
        type: 'freehand',
        points: pointsRef.current,
        color: brushColorRef.current,
        size: brushSizeRef.current,
        opacity: brushOpacityRef.current,
        isEraser: false,
        layerId: activeLayerIdRef.current
      });
    } else if (currentTool === 'eraser') {
      const newStroke: Stroke = {
        id: strokeId,
        type: 'freehand',
        points: pointsRef.current,
        color: '#ffffff',
        size: brushSizeRef.current,
        opacity: 1.0,
        isEraser: true
      };
      setLayers(prev => prev.map(l => l.id === activeLayerIdRef.current ? { ...l, strokes: [...(l.strokes || []), newStroke] } : l));

      // Đồng bộ tẩy nét qua SignalR
      syncDrawing({
        id: strokeId,
        type: 'freehand',
        points: pointsRef.current,
        color: '#ffffff',
        size: brushSizeRef.current,
        opacity: 1.0,
        isEraser: true,
        layerId: activeLayerIdRef.current
      });
    }

    activeCtx.restore();

    // Reset scratch
    const scratchCtx = scratch.getContext('2d')!;
    scratchCtx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Lưu vào lịch sử vẽ
    saveHistoryState();

    // Reset trạng thái Snap nhưng cho phép thanh menu chỉnh sửa hiện ở trên
    isSnappedRef.current = false;
  };

  // Vẽ các nét cọ
  const drawSegment = (ctx: CanvasRenderingContext2D, p0: Point, p1: Point, usePressure: boolean) => {
    const currentTool = toolRef.current;
    if (currentTool === 'pen') {
      ctx.save();
      ctx.strokeStyle = brushColorRef.current;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const press0 = p0.pressure !== undefined ? p0.pressure : 1.0;
      const press1 = p1.pressure !== undefined ? p1.pressure : 1.0;
      const avgPress = usePressure ? (press0 + press1) / 2 : 1.0;
      ctx.lineWidth = brushSizeRef.current * (0.2 + 0.8 * avgPress);
      
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
      ctx.restore();
      return;
    }

    const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    const steps = Math.max(1, Math.ceil(dist / (brushSizeRef.current * 0.1)));

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = p0.x + (p1.x - p0.x) * t;
      const y = p0.y + (p1.y - p0.y) * t;
      const press = p0.pressure! + (p1.pressure! - p0.pressure!) * t;
      const scale = usePressure ? (0.2 + 0.8 * press) : 1.0;

      stampBrushAt(ctx, x, y, scale);
    }
  };

  const stampBrushAt = (ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) => {
    const tip = brushTipCanvasRef.current;
    if (!tip) return;
    const w = tip.width * scale;
    const h = tip.height * scale;
    ctx.drawImage(tip, x - w / 2, y - h / 2, w, h);
  };

  // ----------------------------------------------------
  // THUẬT TOÁN TỰ NẮN HÌNH (HOLD-TO-SHAPE)
  // ----------------------------------------------------
  const triggerShapeSnap = () => {
    const pts = pointsRef.current;
    if (pts.length < 6) return;

    const start = pts[0];
    const end = pts[pts.length - 1];

    // Tìm bounding box
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    pts.forEach(p => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });

    const w = maxX - minX;
    const h = maxY - minY;
    const straightDist = Math.hypot(end.x - start.x, end.y - start.y);
    
    // Tính tổng chiều dài nét vẽ
    let pathDist = 0;
    for (let i = 1; i < pts.length; i++) {
      pathDist += Math.hypot(pts[i].x - pts[i-1].x, pts[i].y - pts[i-1].y);
    }

    let detected: 'line' | 'circle' | 'rectangle' | 'triangle' = 'line';

    if (straightDist / pathDist > 0.86) {
      // Đường thẳng
      detected = 'line';
    } else {
      // Kiểm tra đường khép kín
      const isClosed = straightDist < Math.max(w, h) * 0.35;
      if (isClosed) {
        // Kiểm tra xem có fit hình tròn/ellipse không
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const rx = w / 2;
        const ry = h / 2;

        let ellipseDevSum = 0;
        pts.forEach(p => {
          const val = Math.pow(p.x - cx, 2) / Math.pow(rx || 1, 2) + Math.pow(p.y - cy, 2) / Math.pow(ry || 1, 2);
          ellipseDevSum += Math.abs(val - 1);
        });
        const avgDev = ellipseDevSum / pts.length;

        if (avgDev < 0.28) {
          detected = 'circle';
        } else {
          detected = 'rectangle';
        }
      } else {
        // Mặc định nắn thành đường thẳng
        detected = 'line';
      }
    }

    // Đánh dấu snap thành công
    isSnappedRef.current = true;
    setIsSnapped(true);
    setSnappedType(detected);
    snappedShapeRef.current = {
      type: detected,
      start,
      end
    };

    // Rung phản hồi giả lập
    if (navigator.vibrate) navigator.vibrate(50);

    renderSnappedShapePreview();
  };

  const renderSnappedShapePreview = () => {
    const scratch = scratchCanvasRef.current;
    if (!scratch || !snappedShapeRef.current) return;
    const ctx = scratch.getContext('2d')!;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    ctx.save();
    // Vẽ nét mờ xanh để làm guide
    drawShape(ctx, snappedShapeRef.current.type, snappedShapeRef.current.start, snappedShapeRef.current.end, '#7d5fff', brushSize + 4);
    // Vẽ hình dạng chuẩn
    drawShape(ctx, snappedShapeRef.current.type, snappedShapeRef.current.start, snappedShapeRef.current.end, brushColor, brushSize);
    ctx.restore();
  };

  const drawShape = (
    ctx: CanvasRenderingContext2D, 
    type: 'line' | 'circle' | 'rectangle' | 'triangle', 
    start: Point, 
    end: Point, 
    color: string, 
    size: number
  ) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    if (type === 'line') {
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
    } else if (type === 'circle') {
      const rx = Math.abs(end.x - start.x) / 2;
      const ry = Math.abs(end.y - start.y) / 2;
      const cx = (start.x + end.x) / 2;
      const cy = (start.y + end.y) / 2;
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    } else if (type === 'rectangle') {
      ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
    } else if (type === 'triangle') {
      const minX = Math.min(start.x, end.x);
      const maxX = Math.max(start.x, end.x);
      const minY = Math.min(start.y, end.y);
      const maxY = Math.max(start.y, end.y);
      ctx.moveTo((minX + maxX) / 2, minY);
      ctx.lineTo(maxX, maxY);
      ctx.lineTo(minX, maxY);
      ctx.closePath();
    }
    ctx.stroke();
  };

  // Thay đổi loại hình snap thủ công từ thanh công cụ nổi
  const changeSnappedType = (type: 'line' | 'circle' | 'rectangle' | 'triangle') => {
    if (snappedShapeRef.current) {
      snappedShapeRef.current.type = type;
      setSnappedType(type);
      renderSnappedShapePreview();
      
      // Vẽ luôn lên layer chính và lưu nếu người dùng đã buông tay
      if (!isDrawingRef.current) {
        const activeCanvas = document.getElementById(`canvas-layer-${activeLayerIdRef.current}`) as HTMLCanvasElement;
        if (activeCanvas) {
          const ctx = activeCanvas.getContext('2d')!;
          // Rollback history trước đó vì nét vẽ cũ đã lưu
          handleUndo();

          const strokeId = `stroke-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          // Vẽ hình mới
          ctx.save();
          ctx.globalAlpha = brushOpacityRef.current;
          drawShape(ctx, type, snappedShapeRef.current.start, snappedShapeRef.current.end, brushColorRef.current, brushSizeRef.current);
          ctx.restore();
          
          const newStroke: Stroke = {
            id: strokeId,
            type: 'shape',
            shapeType: type,
            start: snappedShapeRef.current.start,
            end: snappedShapeRef.current.end,
            color: brushColorRef.current,
            size: brushSizeRef.current,
            opacity: brushOpacityRef.current
          };
          setLayers(prev => prev.map(l => l.id === activeLayerIdRef.current ? { ...l, strokes: [...(l.strokes || []), newStroke] } : l));

          saveHistoryState();
          
          // Sync SignalR
          syncDrawing({
            id: strokeId,
            type: 'shape',
            shapeType: type,
            start: snappedShapeRef.current.start,
            end: snappedShapeRef.current.end,
            color: brushColorRef.current,
            size: brushSizeRef.current,
            opacity: brushOpacityRef.current,
            layerId: activeLayerIdRef.current
          });
        }
      }
    }
  };

  // ----------------------------------------------------
  // THUẬT TOÁN ĐỔ MÀU (FLOOD FILL)
  // ----------------------------------------------------
  const fillBucketAt = (startX: number, startY: number) => {
    const activeCanvas = document.getElementById(`canvas-layer-${activeLayerId}`) as HTMLCanvasElement;
    if (!activeCanvas) return;
    const ctx = activeCanvas.getContext('2d')!;

    const x = Math.round(startX);
    const y = Math.round(startY);

    if (x < 0 || x >= canvasWidth || y < 0 || y >= canvasHeight) return;

    floodFill(ctx, x, y, brushColor, tolerance);

    const strokeId = `stroke-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newStroke: Stroke = {
      id: strokeId,
      type: 'bucket',
      start: { x, y },
      color: brushColor,
      size: 0,
      opacity: 1.0,
      tolerance: tolerance
    };
    setLayers(prev => prev.map(l => l.id === activeLayerId ? { ...l, strokes: [...(l.strokes || []), newStroke] } : l));

    saveHistoryState();

    // Đồng bộ đổ màu
    syncDrawing({
      id: strokeId,
      type: 'bucket',
      x,
      y,
      color: brushColor,
      tolerance,
      layerId: activeLayerId
    });
  };

  const floodFill = (ctx: CanvasRenderingContext2D, startX: number, startY: number, fillColor: string, colorTolerance: number) => {
    const imgData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    const data = imgData.data;

    // Màu đích
    const fillRgb = hexToRgbValues(fillColor);
    
    // Màu tại điểm click
    const startIdx = (startY * canvasWidth + startX) * 4;
    const startR = data[startIdx];
    const startG = data[startIdx + 1];
    const startB = data[startIdx + 2];
    const startA = data[startIdx + 3];

    if (
      Math.abs(startR - fillRgb.r) <= 5 &&
      Math.abs(startG - fillRgb.g) <= 5 &&
      Math.abs(startB - fillRgb.b) <= 5 &&
      Math.abs(startA - 255) <= 5
    ) {
      return; // Cùng màu thì bỏ qua
    }

    const queue: number[] = [];
    queue.push(startX, startY);

    const visited = new Uint8Array(canvasWidth * canvasHeight);
    visited[startY * canvasWidth + startX] = 1;

    while (queue.length > 0) {
      const cy = queue.pop()!;
      const cx = queue.pop()!;

      const idx = (cy * canvasWidth + cx) * 4;
      data[idx] = fillRgb.r;
      data[idx + 1] = fillRgb.g;
      data[idx + 2] = fillRgb.b;
      data[idx + 3] = 255;

      const neighbors = [
        [cx + 1, cy],
        [cx - 1, cy],
        [cx, cy + 1],
        [cx, cy - 1]
      ];

      for (let i = 0; i < neighbors.length; i++) {
        const nx = neighbors[i][0];
        const ny = neighbors[i][1];

        if (nx >= 0 && nx < canvasWidth && ny >= 0 && ny < canvasHeight) {
          const nIdx = ny * canvasWidth + nx;
          if (!visited[nIdx]) {
            const pIdx = nIdx * 4;
            const r = data[pIdx];
            const g = data[pIdx + 1];
            const b = data[pIdx + 2];
            const a = data[pIdx + 3];

            // Kiểm tra độ lệch màu
            const diff = Math.abs(r - startR) + Math.abs(g - startG) + Math.abs(b - startB) + Math.abs(a - startA);
            if (diff <= colorTolerance) {
              visited[nIdx] = 1;
              queue.push(nx, ny);
            }
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
  };

  const hexToRgbValues = (hex: string) => {
    let c = hex.substring(1);
    if (c.length === 3) {
      c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    }
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return { r, g, b };
  };

  // ----------------------------------------------------
  // CÔNG CỤ HÚT MÀU (EYEDROPPER)
  // ----------------------------------------------------
  const pickColorAt = (x: number, y: number) => {
    // Tạo composite canvas tạm thời để hút màu tổng hợp của tất cả các layer
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvasWidth;
    tempCanvas.height = canvasHeight;
    const tempCtx = tempCanvas.getContext('2d')!;

    // Vẽ từng layer visible lên
    layers.forEach(layer => {
      if (layer.visible) {
        const c = document.getElementById(`canvas-layer-${layer.id}`) as HTMLCanvasElement;
        if (c) {
          tempCtx.save();
          tempCtx.globalAlpha = layer.opacity;
          tempCtx.globalCompositeOperation = layer.blendMode;
          tempCtx.drawImage(c, 0, 0);
          tempCtx.restore();
        }
      }
    });

    const pixel = tempCtx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
    if (pixel[3] > 0) {
      const r = pixel[0];
      const g = pixel[1];
      const b = pixel[2];
      const hex = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
      setBrushColor(hex);
      setTool('brush'); // Quay lại cọ vẽ sau khi hút màu
    }
  };

  const distToSegment = (p: Point, a: Point, b: Point) => {
    const l2 = Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2);
    if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + t * (b.x - a.x)), p.y - (a.y + t * (b.y - a.y)));
  };

  const checkCollision = (stroke: Stroke, x: number, y: number): boolean => {
    const threshold = Math.max(brushSizeRef.current / 2 + 6, stroke.size / 2 + 6);

    if (stroke.type === 'freehand') {
      if (!stroke.points || stroke.points.length === 0) return false;
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      stroke.points.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      });
      if (x < minX - threshold || x > maxX + threshold || y < minY - threshold || y > maxY + threshold) {
        return false;
      }
      if (stroke.points.length === 1) {
        return Math.hypot(x - stroke.points[0].x, y - stroke.points[0].y) < threshold;
      }
      for (let i = 1; i < stroke.points.length; i++) {
        if (distToSegment({ x, y }, stroke.points[i - 1], stroke.points[i]) < threshold) {
          return true;
        }
      }
    } else if (stroke.type === 'shape') {
      const start = stroke.start!;
      const end = stroke.end!;
      const type = stroke.shapeType;

      if (type === 'line') {
        return distToSegment({ x, y }, start, end) < threshold;
      } else if (type === 'rectangle') {
        const x1 = start.x;
        const y1 = start.y;
        const x2 = end.x;
        const y2 = end.y;
        const d1 = distToSegment({ x, y }, { x: x1, y: y1 }, { x: x2, y: y1 });
        const d2 = distToSegment({ x, y }, { x: x1, y: y2 }, { x: x2, y: y2 });
        const d3 = distToSegment({ x, y }, { x: x1, y: y1 }, { x: x1, y: y2 });
        const d4 = distToSegment({ x, y }, { x: x2, y: y1 }, { x: x2, y: y2 });
        return Math.min(d1, d2, d3, d4) < threshold;
      } else if (type === 'circle') {
        const rx = Math.abs(end.x - start.x) / 2;
        const ry = Math.abs(end.y - start.y) / 2;
        const cx = (start.x + end.x) / 2;
        const cy = (start.y + end.y) / 2;
        const dist = Math.hypot(x - cx, y - cy);
        const avgR = (rx + ry) / 2;
        return Math.abs(dist - avgR) < threshold;
      } else if (type === 'triangle') {
        const minX = Math.min(start.x, end.x);
        const maxX = Math.max(start.x, end.x);
        const minY = Math.min(start.y, end.y);
        const maxY = Math.max(start.y, end.y);

        const p1 = { x: (minX + maxX) / 2, y: minY };
        const p2 = { x: maxX, y: maxY };
        const p3 = { x: minX, y: maxY };

        const d1 = distToSegment({ x, y }, p1, p2);
        const d2 = distToSegment({ x, y }, p2, p3);
        const d3 = distToSegment({ x, y }, p3, p1);
        return Math.min(d1, d2, d3) < threshold;
      }
    } else if (stroke.type === 'image') {
      const start = { x: stroke.imgX!, y: stroke.imgY! };
      const end = { x: stroke.imgX! + stroke.imgW!, y: stroke.imgY! + stroke.imgH! };
      return x >= start.x && x <= end.x && y >= start.y && y <= end.y;
    }
    return false;
  };

  const eraseStrokeAt = (x: number, y: number) => {
    setLayers(prev => {
      const activeLayer = prev.find(l => l.id === activeLayerIdRef.current);
      if (!activeLayer || !activeLayer.strokes || activeLayer.strokes.length === 0) return prev;

      const deletedIds: string[] = [];
      const remainingStrokes = activeLayer.strokes.filter(stroke => {
        const collided = checkCollision(stroke, x, y);
        if (collided) {
          deletedIds.push(stroke.id);
        }
        return !collided;
      });

      if (deletedIds.length > 0) {
        const updated = prev.map(l => 
          l.id === activeLayerIdRef.current ? { ...l, strokes: remainingStrokes } : l
        );

        setTimeout(() => {
          deletedIds.forEach(id => {
            syncDrawing({
              type: 'delete-stroke',
              strokeId: id,
              layerId: activeLayerIdRef.current
            });
          });
          redrawLayer(activeLayerIdRef.current, updated);
        }, 0);

        hasDeletedAnyRef.current = true;
        return updated;
      }
      return prev;
    });
  };

  const redrawLayer = (layerId: string, updatedLayers?: Layer[]) => {
    const canvas = document.getElementById(`canvas-layer-${layerId}`) as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    if (layerId === 'layer-bg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    } else {
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    }

    const currentLayers = updatedLayers || layersRef.current;
    const layer = currentLayers.find(l => l.id === layerId);
    if (!layer || !layer.strokes) return;

    layer.strokes.forEach(stroke => {
      ctx.save();
      ctx.globalAlpha = stroke.opacity;

      if (stroke.type === 'freehand') {
        if (stroke.isEraser) {
          ctx.globalCompositeOperation = 'destination-out';
        } else {
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const pts = stroke.points;
        if (pts && pts.length > 0) {
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
          }
          ctx.stroke();
        }
      } else if (stroke.type === 'shape') {
        ctx.globalCompositeOperation = 'source-over';
        drawShape(ctx, stroke.shapeType!, stroke.start!, stroke.end!, stroke.color, stroke.size);
      } else if (stroke.type === 'bucket') {
        ctx.globalCompositeOperation = 'source-over';
        floodFill(ctx, stroke.start!.x, stroke.start!.y, stroke.color, stroke.tolerance ?? tolerance);
      } else if (stroke.type === 'image' && stroke.imgUrl) {
        ctx.globalCompositeOperation = 'source-over';
        const cachedImg = imageCacheRef.current.get(stroke.imgUrl);
        if (cachedImg && cachedImg.complete) {
          ctx.drawImage(cachedImg, stroke.imgX!, stroke.imgY!, stroke.imgW!, stroke.imgH!);
        } else {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            imageCacheRef.current.set(stroke.imgUrl!, img);
            redrawLayer(layerId, updatedLayers);
          };
          img.src = stroke.imgUrl;
        }
      }
      ctx.restore();
    });
  };

  // ----------------------------------------------------
  // QUẢN LÝ LỊCH SỬ UNDO / REDO
  // ----------------------------------------------------
  const saveHistoryState = (customLayers?: Layer[]) => {
    const targetLayers = customLayers || layersRef.current;
    const state = {
      activeLayerId: activeLayerIdRef.current,
      layers: targetLayers.map(l => {
        const canvas = document.getElementById(`canvas-layer-${l.id}`) as HTMLCanvasElement;
        const temp = document.createElement('canvas');
        temp.width = canvasWidth;
        temp.height = canvasHeight;
        if (canvas) {
          temp.getContext('2d')!.drawImage(canvas, 0, 0);
        }
        return {
          id: l.id,
          name: l.name,
          visible: l.visible,
          opacity: l.opacity,
          blendMode: l.blendMode,
          canvasCopy: temp,
          strokes: l.strokes || []
        };
      })
    };

    undoStackRef.current.push(state);
    if (undoStackRef.current.length > 20) {
      undoStackRef.current.shift();
    }
    
    // Clear redo
    redoStackRef.current = [];
    
    setCanUndo(undoStackRef.current.length > 1);
    setCanRedo(false);
  };

  const handleUndo = () => {
    if (undoStackRef.current.length < 2) return;

    // Pop state hiện tại để sang Redo
    const currentState = undoStackRef.current.pop()!;
    redoStackRef.current.push(currentState);

    // Lấy state trước đó
    const prevState = undoStackRef.current[undoStackRef.current.length - 1];

    // Khôi phục
    setLayers(prevState.layers.map((l: any) => ({
      id: l.id,
      name: l.name,
      visible: l.visible,
      opacity: l.opacity,
      blendMode: l.blendMode,
      strokes: l.strokes || []
    })));
    setActiveLayerId(prevState.activeLayerId);

    setTimeout(() => {
      prevState.layers.forEach((l: any) => {
        const canvas = document.getElementById(`canvas-layer-${l.id}`) as HTMLCanvasElement;
        if (canvas) {
          const ctx = canvas.getContext('2d')!;
          ctx.clearRect(0, 0, canvasWidth, canvasHeight);
          ctx.drawImage(l.canvasCopy, 0, 0);
        }
      });
    }, 50);

    setCanUndo(undoStackRef.current.length > 1);
    setCanRedo(true);
  };

  const handleRedo = () => {
    if (redoStackRef.current.length === 0) return;

    const nextState = redoStackRef.current.pop()!;
    undoStackRef.current.push(nextState);

    setLayers(nextState.layers.map((l: any) => ({
      id: l.id,
      name: l.name,
      visible: l.visible,
      opacity: l.opacity,
      blendMode: l.blendMode,
      strokes: l.strokes || []
    })));
    setActiveLayerId(nextState.activeLayerId);

    setTimeout(() => {
      nextState.layers.forEach((l: any) => {
        const canvas = document.getElementById(`canvas-layer-${l.id}`) as HTMLCanvasElement;
        if (canvas) {
          const ctx = canvas.getContext('2d')!;
          ctx.clearRect(0, 0, canvasWidth, canvasHeight);
          ctx.drawImage(l.canvasCopy, 0, 0);
        }
      });
    }, 50);

    setCanUndo(true);
    setCanRedo(redoStackRef.current.length > 0);
  };

  // ----------------------------------------------------
  // QUẢN LÝ LAYERS HỆ THỐNG
  // ----------------------------------------------------
  const addLayer = () => {
    const newId = `layer-${Date.now()}`;
    const newLayer: Layer = {
      id: newId,
      name: `Layer ${layers.length}`,
      visible: true,
      opacity: 1.0,
      blendMode: 'source-over',
      strokes: []
    };
    
    const updated = [...layers, newLayer];
    setLayers(updated);
    setActiveLayerId(newId);
    
    saveHistoryState(updated);
  };

  const deleteLayer = (id: string) => {
    if (layers.length <= 1) {
      alert("Bạn phải giữ lại ít nhất 1 layer!");
      return;
    }
    if (id === 'layer-bg') {
      alert("Không thể xóa layer Background gốc!");
      return;
    }

    const updated = layers.filter(l => l.id !== id);
    setLayers(updated);
    if (activeLayerId === id) {
      setActiveLayerId(updated[updated.length - 1].id);
    }
    
    saveHistoryState(updated);
  };

  const toggleLayerVisible = (id: string) => {
    setLayers(layers.map(l => l.id === id ? { ...l, visible: !l.visible } : l));
  };

  const changeLayerOpacity = (id: string, opacity: number) => {
    setLayers(layers.map(l => l.id === id ? { ...l, opacity } : l));
  };

  const changeLayerBlendMode = (id: string, blendMode: GlobalCompositeOperation) => {
    setLayers(layers.map(l => l.id === id ? { ...l, blendMode } : l));
  };

  const moveLayer = (idx: number, dir: 'up' | 'down') => {
    const nextIdx = dir === 'up' ? idx + 1 : idx - 1;
    if (nextIdx < 0 || nextIdx >= layers.length) return;

    const copy = [...layers];
    const temp = copy[idx];
    copy[idx] = copy[nextIdx];
    copy[nextIdx] = temp;

    setLayers(copy);
    saveHistoryState(copy);
  };

  const mergeDown = (idx: number) => {
    if (idx === 0) return; // Layer dưới cùng không thể merge
    const targetIdx = idx - 1;
    const currentLayer = layers[idx];
    const bottomLayer = layers[targetIdx];

    const currentCanvas = document.getElementById(`canvas-layer-${currentLayer.id}`) as HTMLCanvasElement;
    const bottomCanvas = document.getElementById(`canvas-layer-${bottomLayer.id}`) as HTMLCanvasElement;

    if (currentCanvas && bottomCanvas) {
      const bottomCtx = bottomCanvas.getContext('2d')!;
      bottomCtx.save();
      bottomCtx.globalAlpha = currentLayer.opacity;
      bottomCtx.globalCompositeOperation = currentLayer.blendMode;
      bottomCtx.drawImage(currentCanvas, 0, 0);
      bottomCtx.restore();

      // Hợp nhất các nét vẽ của hai layer
      const mergedStrokes = [
        ...(bottomLayer.strokes || []),
        ...(currentLayer.strokes || []).map(s => ({
          ...s,
          opacity: s.opacity * currentLayer.opacity
        }))
      ];

      // Xóa layer hiện tại và cập nhật layer dưới
      const updated = layers
        .filter(l => l.id !== currentLayer.id)
        .map(l => l.id === bottomLayer.id ? { ...l, strokes: mergedStrokes } : l);

      setLayers(updated);
      setActiveLayerId(bottomLayer.id);

      saveHistoryState(updated);
    }
  };

  const clearLayer = (id: string) => {
    const canvas = document.getElementById(`canvas-layer-${id}`) as HTMLCanvasElement;
    if (canvas) {
      const ctx = canvas.getContext('2d')!;
      if (id === 'layer-bg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      } else {
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      }
      
      const updated = layers.map(l => l.id === id ? { ...l, strokes: [] } : l);
      setLayers(updated);
      saveHistoryState(updated);
    }
  };

  // ----------------------------------------------------
  // THU PHÓNG & DI CHUYỂN CANVAS (ZOOM & PAN)
  // ----------------------------------------------------
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const factor = 1.1;
    let newZoom = zoom;
    if (e.deltaY < 0) {
      newZoom = Math.min(zoom * factor, 8); // Max zoom x8
    } else {
      newZoom = Math.max(zoom / factor, 0.2); // Min zoom x0.2
    }
    setZoom(newZoom);
  };

  const handleViewportPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (tool === 'pan' || e.button === 1 || e.shiftKey) {
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      const el = e.currentTarget;
      el.setPointerCapture(e.pointerId);
    }
  };

  const handleViewportPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPanningRef.current) {
      const nx = e.clientX - panStartRef.current.x;
      const ny = e.clientY - panStartRef.current.y;
      setPan({ x: nx, y: ny });
    }
  };

  const handleViewportPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const resetZoomPan = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // ----------------------------------------------------
  // NHẬP ẢNH & XUẤT ẢNH & LƯU DB
  // ----------------------------------------------------
  const handleImportImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Tạo layer mới cho ảnh chèn vào
        const newId = `layer-img-${Date.now()}`;
        const newLayer: Layer = {
          id: newId,
          name: `Image Layer`,
          visible: true,
          opacity: 1.0,
          blendMode: 'source-over',
          strokes: []
        };

        setLayers([...layers, newLayer]);
        setActiveLayerId(newId);

        setTimeout(() => {
          const canvas = document.getElementById(`canvas-layer-${newId}`) as HTMLCanvasElement;
          if (canvas) {
            const ctx = canvas.getContext('2d')!;
            // Scale ảnh vừa với canvas tỉ lệ đẹp
            const scale = Math.min(canvasWidth / img.width, canvasHeight / img.height) * 0.8;
            const w = img.width * scale;
            const h = img.height * scale;
            const x = (canvasWidth - w) / 2;
            const y = (canvasHeight - h) / 2;
            ctx.drawImage(img, x, y, w, h);

            const strokeId = `stroke-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const newStroke: Stroke = {
              id: strokeId,
              type: 'image',
              imgUrl: event.target?.result as string,
              imgX: x,
              imgY: y,
              imgW: w,
              imgH: h,
              color: '',
              size: 0,
              opacity: 1.0
            };
            imageCacheRef.current.set(event.target?.result as string, img);

            setLayers(prev => prev.map(l => l.id === newId ? { ...l, strokes: [newStroke] } : l));

            saveHistoryState();
          }
        }, 100);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const addSticker = (url: string) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const newId = `layer-sticker-${Date.now()}`;
      const newLayer: Layer = {
        id: newId,
        name: `Sticker Layer`,
        visible: true,
        opacity: 1.0,
        blendMode: 'source-over',
        strokes: []
      };

      setLayers([...layers, newLayer]);
      setActiveLayerId(newId);

      setTimeout(() => {
        const canvas = document.getElementById(`canvas-layer-${newId}`) as HTMLCanvasElement;
        if (canvas) {
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 150, 150, 180, 180);

          const strokeId = `stroke-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const newStroke: Stroke = {
            id: strokeId,
            type: 'image',
            imgUrl: url,
            imgX: 150,
            imgY: 150,
            imgW: 180,
            imgH: 180,
            color: '',
            size: 0,
            opacity: 1.0
          };
          imageCacheRef.current.set(url, img);

          setLayers(prev => prev.map(l => l.id === newId ? { ...l, strokes: [newStroke] } : l));

          saveHistoryState();
          setShowStickers(false);

          // Đồng bộ chèn sticker
          syncDrawing({
            id: strokeId,
            type: 'shape',
            shapeType: 'rectangle',
            start: { x: 150, y: 150 },
            end: { x: 330, y: 330 },
            color: brushColor,
            size: brushSize,
            opacity: brushOpacity,
            layerId: newId
          });
        }
      }, 100);
    };
    img.src = url;
  };

  const downloadDrawing = () => {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvasWidth;
    tempCanvas.height = canvasHeight;
    const tempCtx = tempCanvas.getContext('2d')!;

    // Ghép các layer
    layers.forEach(l => {
      if (l.visible) {
        const c = document.getElementById(`canvas-layer-${l.id}`) as HTMLCanvasElement;
        if (c) {
          tempCtx.save();
          tempCtx.globalAlpha = l.opacity;
          tempCtx.globalCompositeOperation = l.blendMode;
          tempCtx.drawImage(c, 0, 0);
          tempCtx.restore();
        }
      }
    });

    const link = document.createElement('a');
    link.download = `${tieuDe}.png`;
    link.href = tempCanvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const saveDrawing = async () => {
    try {
      // Đóng gói JSON layers chứa ảnh base64
      const layersData = layers.map(l => {
        const canvas = document.getElementById(`canvas-layer-${l.id}`) as HTMLCanvasElement;
        return {
          id: l.id,
          name: l.name,
          visible: l.visible,
          opacity: l.opacity,
          blendMode: l.blendMode,
          dataUrl: canvas ? canvas.toDataURL() : '',
          strokes: l.strokes || []
        };
      });

      const projectJson = JSON.stringify({
        version: 'v2',
        width: canvasWidth,
        height: canvasHeight,
        layers: layersData
      });

      // Tạo thumbnail gộp
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 300;
      tempCanvas.height = 225;
      const tempCtx = tempCanvas.getContext('2d')!;
      
      layers.forEach(l => {
        if (l.visible) {
          const c = document.getElementById(`canvas-layer-${l.id}`) as HTMLCanvasElement;
          if (c) {
            tempCtx.save();
            tempCtx.globalAlpha = l.opacity;
            tempCtx.globalCompositeOperation = l.blendMode;
            tempCtx.drawImage(c, 0, 0, 300, 225);
            tempCtx.restore();
          }
        }
      });
      const thumbnailBase64 = tempCanvas.toDataURL('image/png', 0.6);

      const res = await axios.post(`${API_URL}/Drawing/save`, {
        id: currentBanVeId,
        nguoiDungId: userId,
        tieuDe: tieuDe,
        duLieuCanvasJson: projectJson,
        anhThuNhoUrl: thumbnailBase64,
        congKhai: false
      });

      if (res.data && res.data.drawingId) {
        setCurrentBanVeId(res.data.drawingId);
      }

      alert("Tuyệt vời! Bản vẽ của bạn đã được lưu lại thành công.");
    } catch (err) {
      console.error(err);
      alert("Không thể lưu bản vẽ, hãy thử lại sau nhé!");
    }
  };

  const loadDrawingFromJson = (jsonStr: string) => {
    try {
      const data = JSON.parse(jsonStr);
      if (data.version === 'v2') {
        const loadedLayers = data.layers.map((l: any) => ({
          id: l.id,
          name: l.name,
          visible: l.visible,
          opacity: l.opacity,
          blendMode: l.blendMode,
          strokes: l.strokes || []
        }));

        setLayers(loadedLayers);
        setActiveLayerId(loadedLayers[loadedLayers.length - 1].id);

        setTimeout(() => {
          data.layers.forEach((l: any) => {
            const canvas = document.getElementById(`canvas-layer-${l.id}`) as HTMLCanvasElement;
            if (canvas && l.dataUrl) {
              const ctx = canvas.getContext('2d')!;
              const img = new Image();
              img.onload = () => {
                ctx.clearRect(0, 0, canvasWidth, canvasHeight);
                ctx.drawImage(img, 0, 0);
              };
              img.src = l.dataUrl;
            }
          });

          setTimeout(() => {
            saveHistoryState();
          }, 150);
        }, 150);
      }
    } catch (e) {
      console.error("Lỗi parse JSON bản vẽ:", e);
    }
  };

  // ----------------------------------------------------
  // ĐỒNG BỘ SIGNALR & VẼ TỪ XA
  // ----------------------------------------------------
  const syncDrawing = (data: any) => {
    if (connection && maPhongVect) {
      const syncStr = JSON.stringify(data);
      connection.invoke('DongBoNetVe', maPhongVect, syncStr).catch(err => console.error("Lỗi gửi nét vẽ:", err));
    }
  };

  const handleRemoteDraw = (dataStr: string) => {
    try {
      const data = JSON.parse(dataStr);
      
      // Hỗ trợ đồng bộ xóa nét vẽ bằng Tẩy theo nét từ xa
      if (data.type === 'delete-stroke') {
        const targetLayerId = data.layerId;
        setLayers(prev => {
          const updated = prev.map(l => {
            if (l.id === targetLayerId) {
              const filtered = (l.strokes || []).filter(s => s.id !== data.strokeId);
              return { ...l, strokes: filtered };
            }
            return l;
          });
          setTimeout(() => {
            redrawLayer(targetLayerId, updated);
          }, 0);
          return updated;
        });
        return;
      }

      const targetCanvas = document.getElementById(`canvas-layer-${data.layerId}`) as HTMLCanvasElement;
      if (!targetCanvas) return;
      const ctx = targetCanvas.getContext('2d')!;

      ctx.save();
      if (data.type === 'freehand') {
        if (data.isEraser) {
          ctx.globalCompositeOperation = 'destination-out';
        } else {
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.strokeStyle = data.color;
        ctx.lineWidth = data.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = data.opacity;

        const pts = data.points;
        if (pts.length > 0) {
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
          }
          ctx.stroke();
        }
      } else if (data.type === 'shape') {
        ctx.globalAlpha = data.opacity;
        drawShape(ctx, data.shapeType, data.start, data.end, data.color, data.size);
      } else if (data.type === 'bucket') {
        floodFill(ctx, data.x, data.y, data.color, data.tolerance);
      }
      ctx.restore();

      // Đưa nét vẽ nhận được từ xa vào danh sách nét vẽ của Layer đó để giữ đồng bộ
      const newStroke: Stroke = {
        id: data.id || `remote-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: data.type === 'bucket' ? 'bucket' : (data.type === 'shape' ? 'shape' : 'freehand'),
        points: data.points,
        shapeType: data.shapeType,
        start: data.start,
        end: data.end,
        color: data.color,
        size: data.size,
        opacity: data.opacity,
        isEraser: data.isEraser
      };
      setLayers(prev => prev.map(l => l.id === data.layerId ? { ...l, strokes: [...(l.strokes || []), newStroke] } : l));
    } catch (e) {
      console.error("Lỗi xử lý vẽ từ xa:", e);
    }
  };

  // Lưu Custom Swatches vào Local Storage
  const addColorToSwatches = () => {
    if (customSwatches.includes(brushColor)) return;
    const updated = [brushColor, ...customSwatches.slice(0, 15)];
    setCustomSwatches(updated);
    localStorage.setItem('custom_swatches', JSON.stringify(updated));
  };

  return (
    <div 
      ref={containerRef}
      style={isOverlayFullscreen ? {
        display: 'flex',
        flexDirection: 'column',
        width: '100vw',
        height: '100vh',
        background: '#15151e',
        color: '#f1f2f6',
        padding: '24px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        boxSizing: 'border-box',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 99999,
        overflowY: 'auto'
      } : {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        maxWidth: '1240px',
        margin: '0 auto',
        background: '#15151e',
        color: '#f1f2f6',
        borderRadius: '24px',
        padding: '24px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        boxShadow: '0 30px 60px rgba(0,0,0,0.4)',
        border: '1px solid #23232f',
        boxSizing: 'border-box'
      }}
    >
      {/* Top Menu: Title & Actions */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        paddingBottom: '16px',
        borderBottom: '2px solid #23232f',
        flexWrap: 'wrap',
        gap: '15px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '1.8rem' }}>🎨</span>
          <input 
            type="text" 
            value={tieuDe}
            onChange={(e) => setTieuDe(e.target.value)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: '2px dashed #4834d4',
              color: '#ffffff',
              fontSize: '1.4rem',
              fontWeight: '700',
              outline: 'none',
              padding: '2px 6px',
              width: '240px'
            }}
            title="Đổi tiêu đề bức vẽ"
          />
        </div>

        {/* Floating Snapped Shape Edit Bar */}
        {isSnapped && snappedShapeRef.current && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(108, 92, 231, 0.15)',
            border: '2px solid #6c5ce7',
            padding: '8px 16px',
            borderRadius: '99px',
            animation: 'pulse 2s infinite'
          }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#a29bfe' }}>Nắn hình:</span>
            {(['line', 'circle', 'rectangle', 'triangle'] as const).map(t => (
              <button
                key={t}
                onClick={() => changeSnappedType(t)}
                style={{
                  background: snappedType === t ? '#6c5ce7' : 'rgba(255,255,255,0.08)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '4px 10px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  textTransform: 'capitalize'
                }}
              >
                {t === 'line' ? 'Thẳng' : t === 'circle' ? 'Tròn' : t === 'rectangle' ? 'H.Chữ nhật' : 'Tam giác'}
              </button>
            ))}
            <button
              onClick={() => setIsSnapped(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#ff7675',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Zoom Actions */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: '#23232f',
            borderRadius: '12px',
            padding: '4px 8px',
            gap: '6px'
          }}>
            <button onClick={() => setZoom(z => Math.max(z - 0.1, 0.2))} style={{ background: 'none', border: 'none', color: '#b2bec3', cursor: 'pointer' }}><ZoomOut size={16} /></button>
            <span style={{ fontSize: '0.8rem', fontWeight: 'bold', width: '40px', textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(z + 0.1, 8))} style={{ background: 'none', border: 'none', color: '#b2bec3', cursor: 'pointer' }}><ZoomIn size={16} /></button>
            <button onClick={resetZoomPan} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#ffffff', borderRadius: '6px', padding: '2px 6px', fontSize: '0.75rem', cursor: 'pointer' }}>Khớp</button>
          </div>

        <button 
          onClick={toggleFullscreen}
          style={{
            background: '#23232f',
            color: '#ffffff',
            border: 'none',
            borderRadius: '12px',
            width: '40px',
            height: '40px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s'
          }}
          title={isOverlayFullscreen ? "Thu nhỏ màn hình" : "Toàn màn hình"}
        >
          {isOverlayFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>

        <div style={{ width: '1px', height: '24px', background: '#23232f' }}></div>

          <button 
            disabled={!canUndo}
            onClick={handleUndo}
            style={{
              background: '#23232f',
              color: canUndo ? '#ffffff' : '#5f5f7f',
              border: 'none',
              borderRadius: '12px',
              width: '40px',
              height: '40px',
              cursor: canUndo ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Quay lại (Ctrl+Z)"
          >
            <Undo2 size={18} />
          </button>

          <button 
            disabled={!canRedo}
            onClick={handleRedo}
            style={{
              background: '#23232f',
              color: canRedo ? '#ffffff' : '#5f5f7f',
              border: 'none',
              borderRadius: '12px',
              width: '40px',
              height: '40px',
              cursor: canRedo ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Làm lại (Ctrl+Y)"
          >
            <Redo2 size={18} />
          </button>

          <button onClick={saveDrawing} style={{
            background: '#00b894',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            padding: '10px 18px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer'
          }}>
            <Save size={18} />
            Lưu bản vẽ
          </button>

          <button onClick={downloadDrawing} style={{
            background: '#0984e3',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            padding: '10px 18px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer'
          }}>
            <Download size={18} />
            Xuất ảnh PNG
          </button>

          {onClose && (
            <button onClick={onClose} style={{
              background: 'none',
              border: 'none',
              color: '#ff7675',
              fontWeight: 'bold',
              cursor: 'pointer',
              marginLeft: '10px',
              textDecoration: 'underline'
            }}>
              Đóng
            </button>
          )}
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 280px', gap: '20px', alignItems: 'stretch' }}>
        
        {/* Left Toolbar */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          background: '#23232f',
          borderRadius: '16px',
          padding: '16px 10px',
          height: 'fit-content'
        }}>
          {/* Cọ thường */}
          <button 
            onClick={() => setTool('brush')}
            style={{
              background: tool === 'brush' ? '#6c5ce7' : 'rgba(255,255,255,0.05)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              width: '46px',
              height: '46px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s'
            }}
            title="Cọ mềm (Paintbrush)"
          >
            <Paintbrush size={20} />
          </button>

          {/* Bút máy nét cứng */}
          <button 
            onClick={() => setTool('pen')}
            style={{
              background: tool === 'pen' ? '#6c5ce7' : 'rgba(255,255,255,0.05)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              width: '46px',
              height: '46px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s',
              fontSize: '1rem',
              fontWeight: 'bold'
            }}
            title="Bút máy nét cứng (Pen)"
          >
            🖊️
          </button>

          {/* Bút chì nhám */}
          <button 
            onClick={() => setTool('pencil')}
            style={{
              background: tool === 'pencil' ? '#6c5ce7' : 'rgba(255,255,255,0.05)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              width: '46px',
              height: '46px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s',
              fontSize: '1rem'
            }}
            title="Bút chì phác thảo (Pencil)"
          >
            ✏️
          </button>

          {/* Cọ phun Airbrush */}
          <button 
            onClick={() => setTool('airbrush')}
            style={{
              background: tool === 'airbrush' ? '#6c5ce7' : 'rgba(255,255,255,0.05)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              width: '46px',
              height: '46px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s',
              fontSize: '1.2rem'
            }}
            title="Cọ phun sơn mịn (Airbrush)"
          >
            💨
          </button>

          {/* Eraser */}
          <button 
            onClick={() => setTool('eraser')}
            style={{
              background: tool === 'eraser' ? '#6c5ce7' : 'rgba(255,255,255,0.05)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              width: '46px',
              height: '46px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s'
            }}
            title="Tẩy (Eraser)"
          >
            <Eraser size={20} />
          </button>

          {/* Bucket Fill */}
          <button 
            onClick={() => setTool('bucket')}
            style={{
              background: tool === 'bucket' ? '#6c5ce7' : 'rgba(255,255,255,0.05)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              width: '46px',
              height: '46px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s'
            }}
            title="Đổ màu (Flood Fill)"
          >
            <PaintBucket size={20} />
          </button>

          {/* Eyedropper */}
          <button 
            onClick={() => setTool('picker')}
            style={{
              background: tool === 'picker' ? '#6c5ce7' : 'rgba(255,255,255,0.05)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              width: '46px',
              height: '46px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s'
            }}
            title="Hút màu trên màn hình"
          >
            <Pipette size={20} />
          </button>

          {/* Pan Viewport */}
          <button 
            onClick={() => setTool('pan')}
            style={{
              background: tool === 'pan' ? '#6c5ce7' : 'rgba(255,255,255,0.05)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              width: '46px',
              height: '46px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s'
            }}
            title="Di chuyển màn hình vẽ (Hold Spacebar)"
          >
            <Move size={20} />
          </button>

          <div style={{ width: '30px', height: '2px', background: '#2d2d3d', margin: '4px 0' }}></div>

          {/* Import Image Icon button */}
          <label style={{
            background: 'rgba(255,255,255,0.05)',
            color: '#ffffff',
            borderRadius: '12px',
            width: '46px',
            height: '46px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s'
          }} title="Chèn ảnh vào canvas">
            <ImageIcon size={20} />
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleImportImage} 
              style={{ display: 'none' }} 
            />
          </label>
        </div>

        {/* Center: Canvas Viewport */}
        <div 
          className="canvas-viewport"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0d0d12',
            overflow: 'hidden',
            position: 'relative',
            height: isOverlayFullscreen ? 'calc(100vh - 120px)' : '620px',
            borderRadius: '20px',
            border: '2px solid #23232f',
            cursor: tool === 'pan' ? 'grab' : 'crosshair'
          }}
          onWheel={handleWheel}
          onPointerDown={handleViewportPointerDown}
          onPointerMove={handleViewportPointerMove}
          onPointerUp={handleViewportPointerUp}
        >
          <div
            className="canvas-transform-container"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              position: 'relative',
              width: `${canvasWidth}px`,
              height: `${canvasHeight}px`,
              boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
              backgroundColor: '#ffffff'
            }}
          >
            {/* Grid Pattern Background for Transparent layers */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundImage: 'linear-gradient(45deg, #f0f0f0 25%, transparent 25%), linear-gradient(-45deg, #f0f0f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f0f0f0 75%), linear-gradient(-45deg, transparent 75%, #f0f0f0 75%)',
              backgroundSize: '20px 20px',
              backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
              zIndex: 0
            }}></div>

            {/* DOM Layers */}
            {layers.map(layer => (
              <canvas
                key={layer.id}
                id={`canvas-layer-${layer.id}`}
                width={canvasWidth}
                height={canvasHeight}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: `${canvasWidth}px`,
                  height: `${canvasHeight}px`,
                  pointerEvents: 'none',
                  visibility: layer.visible ? 'visible' : 'hidden',
                  opacity: layer.opacity,
                  mixBlendMode: getMixBlendMode(layer.blendMode) as any,
                  zIndex: layers.indexOf(layer) + 1
                }}
              />
            ))}
            
            {/* Real-time Interaction Scratch Canvas */}
            <canvas
              ref={scratchCanvasRef}
              width={canvasWidth}
              height={canvasHeight}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: `${canvasWidth}px`,
                height: `${canvasHeight}px`,
                pointerEvents: tool === 'pan' ? 'none' : 'auto',
                zIndex: 999,
                mixBlendMode: 'normal'
              }}
              onPointerDown={handleCanvasPointerDown}
              onPointerMove={handleCanvasPointerMove}
              onPointerUp={handleCanvasPointerUp}
              onPointerLeave={handleCanvasPointerLeave}
            />
          </div>
        </div>

        {/* Right Sidebar panels */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          maxHeight: isOverlayFullscreen ? 'calc(100vh - 120px)' : '620px',
          overflowY: 'auto',
          paddingRight: '4px'
        }}>
          {/* Panel 1: Color Picker */}
          <div style={{
            background: '#23232f',
            borderRadius: '16px',
            padding: '16px',
            border: '1px solid #2d2d3d'
          }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 'bold', margin: '0 0 12px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Bảng Màu</span>
              <button 
                onClick={addColorToSwatches}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#6c5ce7',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                + Lưu màu
              </button>
            </h3>

            {/* Canvas Color Wheel & HTML color select picker combined */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '12px' }}>
              <input 
                type="color" 
                value={brushColor}
                onChange={(e) => setBrushColor(e.target.value)}
                style={{
                  width: '50px',
                  height: '50px',
                  border: '3px solid #2d2d3d',
                  borderRadius: '12px',
                  background: 'none',
                  cursor: 'pointer'
                }}
              />
              <div style={{ flex: 1 }}>
                <input 
                  type="text" 
                  value={brushColor.toUpperCase()}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.startsWith('#') && val.length <= 7) {
                      setBrushColor(val);
                    }
                  }}
                  style={{
                    width: '100%',
                    background: '#15151e',
                    border: '1px solid #2d2d3d',
                    borderRadius: '8px',
                    color: '#ffffff',
                    padding: '6px 10px',
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    outline: 'none'
                  }}
                  placeholder="#HEX CODE"
                />
              </div>
            </div>

            {/* Quick Preset Palette Swatches */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(10, 1fr)',
              gap: '4px',
              marginBottom: '10px'
            }}>
              {SWATCH_PALETTE.map((color, idx) => (
                <button
                  key={idx}
                  onClick={() => setBrushColor(color)}
                  style={{
                    background: color,
                    height: '18px',
                    border: brushColor === color ? '2px solid #ffffff' : 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transform: brushColor === color ? 'scale(1.15)' : 'none',
                    boxShadow: brushColor === color ? '0 0 5px rgba(255,255,255,0.5)' : 'none'
                  }}
                  title={color}
                />
              ))}
            </div>

            {/* User Saved custom color swatches */}
            {customSwatches.length > 0 && (
              <>
                <div style={{ height: '1px', background: '#2d2d3d', margin: '8px 0' }}></div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {customSwatches.map((color, idx) => (
                    <button
                      key={idx}
                      onClick={() => setBrushColor(color)}
                      style={{
                        background: color,
                        width: '20px',
                        height: '20px',
                        border: brushColor === color ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Panel 2: Brush Settings */}
          <div style={{
            background: '#23232f',
            borderRadius: '16px',
            padding: '16px',
            border: '1px solid #2d2d3d'
          }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 'bold', margin: '0 0 12px 0' }}>Nét Bút</h3>
            
            {/* Brush Size */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#b2bec3', marginBottom: '4px' }}>
                <span>Cỡ cọ:</span>
                <span>{brushSize}px</span>
              </div>
              <input 
                type="range" 
                min="1" 
                max="100" 
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                style={{ width: '100%', cursor: 'pointer', accentColor: '#6c5ce7' }}
              />
            </div>

            {/* Opacity */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#b2bec3', marginBottom: '4px' }}>
                <span>Độ mờ cọ:</span>
                <span>{Math.round(brushOpacity * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="0.05" 
                max="1.0" 
                step="0.05"
                value={brushOpacity}
                onChange={(e) => setBrushOpacity(Number(e.target.value))}
                style={{ width: '100%', cursor: 'pointer', accentColor: '#6c5ce7' }}
              />
            </div>

            {/* Stabilizer (Anime helper) */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#b2bec3', marginBottom: '4px' }}>
                <span>Bộ làm mượt cọ (Stabilizer):</span>
                <span>{stabilizer}</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="9" 
                value={stabilizer}
                onChange={(e) => setStabilizer(Number(e.target.value))}
                style={{ width: '100%', cursor: 'pointer', accentColor: '#6c5ce7' }}
              />
            </div>

            {/* Color Bucket Tolerance */}
            {tool === 'bucket' && (
              <div style={{ marginBottom: '12px', background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#b2bec3', marginBottom: '4px' }}>
                  <span>Dung sai đổ màu (Tolerance):</span>
                  <span>{tolerance}</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="150" 
                  value={tolerance}
                  onChange={(e) => setTolerance(Number(e.target.value))}
                  style={{ width: '100%', cursor: 'pointer', accentColor: '#6c5ce7' }}
                />
              </div>
            )}

            {/* Eraser Stroke Toggle */}
            {tool === 'eraser' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: '#b2bec3' }}>Tẩy theo nét (Stroke Eraser):</span>
                <button
                  onClick={() => setStrokeEraserEnabled(!strokeEraserEnabled)}
                  style={{
                    background: strokeEraserEnabled ? '#6c5ce7' : 'rgba(255,255,255,0.08)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  {strokeEraserEnabled ? "Đang bật" : "Đã tắt"}
                </button>
              </div>
            )}

            {/* Auto Shape Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
              <span style={{ fontSize: '0.8rem', color: '#b2bec3' }}>Tự nắn hình (Hold 5.5s):</span>
              <button
                onClick={() => setAutoShape(!autoShape)}
                style={{
                  background: autoShape ? '#6c5ce7' : 'rgba(255,255,255,0.08)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                {autoShape ? "Đang bật" : "Đã tắt"}
              </button>
            </div>

            {/* Stylus pressure support indicator */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
              <span style={{ fontSize: '0.8rem', color: '#b2bec3' }}>Lực nhấn bút Stylus:</span>
              <button
                onClick={() => setPressureEnabled(!pressureEnabled)}
                style={{
                  background: pressureEnabled ? '#6c5ce7' : 'rgba(255,255,255,0.08)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                {pressureEnabled ? "Mở" : "Tắt"}
              </button>
            </div>
          </div>

          {/* Panel 3: Layers System */}
          <div style={{
            background: '#23232f',
            borderRadius: '16px',
            padding: '16px',
            border: '1px solid #2d2d3d',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 'bold', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={16} /> Layers
              </h3>
              <button 
                onClick={addLayer}
                style={{
                  background: '#6c5ce7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  width: '28px',
                  height: '28px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Thêm Layer mới"
              >
                <Plus size={16} />
              </button>
            </div>

            {/* List of Layers */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              maxHeight: '180px',
              overflowY: 'auto'
            }}>
              {layers.slice().reverse().map((layer, reverseIdx) => {
                const idx = layers.length - 1 - reverseIdx;
                const isActive = layer.id === activeLayerId;
                return (
                  <div 
                    key={layer.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      background: isActive ? 'rgba(108, 92, 231, 0.15)' : 'rgba(255,255,255,0.03)',
                      border: isActive ? '1px solid #6c5ce7' : '1px solid #2d2d3d',
                      borderRadius: '10px',
                      padding: '8px',
                      gap: '8px'
                    }}
                  >
                    {/* Hộp xem trước thumbnail nhỏ */}
                    <div style={{
                      width: '28px',
                      height: '22px',
                      background: '#15151e',
                      border: '1px solid #2d2d3d',
                      borderRadius: '4px',
                      position: 'relative',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        fontSize: '0.55rem',
                        fontWeight: 'bold',
                        textAlign: 'center',
                        lineHeight: '20px',
                        color: '#64748b'
                      }}>L{idx + 1}</div>
                    </div>

                    {/* Tên Layer */}
                    <div 
                      onClick={() => setActiveLayerId(layer.id)}
                      style={{
                        flex: 1,
                        fontSize: '0.8rem',
                        fontWeight: isActive ? 'bold' : 'normal',
                        color: isActive ? '#ffffff' : '#b2bec3',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {layer.name}
                    </div>

                    {/* Toggle Hiện/Ẩn */}
                    <button 
                      onClick={() => toggleLayerVisible(layer.id)}
                      style={{ background: 'none', border: 'none', color: '#b2bec3', cursor: 'pointer', padding: '2px' }}
                    >
                      {layer.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                    </button>

                    {/* Nút di chuyển layer */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <button 
                        onClick={() => moveLayer(idx, 'up')}
                        disabled={idx === layers.length - 1}
                        style={{ background: 'none', border: 'none', color: idx === layers.length - 1 ? '#4a4a5a' : '#b2bec3', cursor: 'pointer', padding: 0 }}
                      >
                        <ArrowUp size={11} />
                      </button>
                      <button 
                        onClick={() => moveLayer(idx, 'down')}
                        disabled={idx === 0}
                        style={{ background: 'none', border: 'none', color: idx === 0 ? '#4a4a5a' : '#b2bec3', cursor: 'pointer', padding: 0 }}
                      >
                        <ArrowDown size={11} />
                      </button>
                    </div>

                    {/* Nút hành động khác */}
                    {idx > 0 && (
                      <button 
                        onClick={() => mergeDown(idx)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#00b894',
                          cursor: 'pointer',
                          padding: '2px',
                          fontSize: '0.7rem',
                          fontWeight: 'bold'
                        }}
                        title="Gộp xuống Layer dưới"
                      >
                        🗜️
                      </button>
                    )}

                    <button 
                      onClick={() => clearLayer(layer.id)}
                      style={{ background: 'none', border: 'none', color: '#e17055', cursor: 'pointer', padding: '2px' }}
                      title="Clear Layer"
                    >
                      🗑️
                    </button>

                    {layer.id !== 'layer-bg' && (
                      <button 
                        onClick={() => deleteLayer(layer.id)}
                        style={{ background: 'none', border: 'none', color: '#ff7675', cursor: 'pointer', padding: '2px' }}
                        title="Xóa Layer"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Layer Opacity và Blend Mode của Active Layer */}
            {layers.find(l => l.id === activeLayerId) && (
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #2d2d3d',
                marginTop: '4px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#b2bec3', marginBottom: '4px' }}>
                  <span>Mức mờ Layer:</span>
                  <span>{Math.round((layers.find(l => l.id === activeLayerId)?.opacity || 0) * 100)}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="1.0" 
                  step="0.05"
                  value={layers.find(l => l.id === activeLayerId)?.opacity || 0}
                  onChange={(e) => changeLayerOpacity(activeLayerId, Number(e.target.value))}
                  style={{ width: '100%', cursor: 'pointer', accentColor: '#6c5ce7', marginBottom: '8px' }}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: '#b2bec3' }}>Chế độ trộn:</span>
                  <select
                    value={layers.find(l => l.id === activeLayerId)?.blendMode || 'source-over'}
                    onChange={(e) => changeLayerBlendMode(activeLayerId, e.target.value as any)}
                    style={{
                      background: '#15151e',
                      color: 'white',
                      border: '1px solid #2d2d3d',
                      borderRadius: '6px',
                      padding: '4px 6px',
                      fontSize: '0.75rem',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="source-over">Normal</option>
                    <option value="multiply">Multiply</option>
                    <option value="screen">Screen</option>
                    <option value="overlay">Overlay</option>
                    <option value="darken">Darken</option>
                    <option value="lighten">Lighten</option>
                    <option value="color-burn">Color Burn</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Panel 4: Sticker nhanh */}
          <div style={{
            background: '#23232f',
            borderRadius: '16px',
            padding: '16px',
            border: '1px solid #2d2d3d'
          }}>
            <h3 
              onClick={() => setShowStickers(!showStickers)}
              style={{ 
                fontSize: '0.95rem', 
                fontWeight: 'bold', 
                margin: 0, 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                cursor: 'pointer',
                justifyContent: 'space-between'
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Smile size={16} /> Nhãn Dán Hỗ Trợ</span>
              <span style={{ fontSize: '0.8rem', color: '#6c5ce7' }}>{showStickers ? 'Ẩn' : 'Hiện'}</span>
            </h3>

            {showStickers && (
              <>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  gap: '8px',
                  marginTop: '12px',
                  maxHeight: '160px',
                  overflowY: 'auto',
                  paddingRight: '2px'
                }}>
                  {STICKERS.map((st, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => addSticker(st.url)}
                      style={{
                        cursor: 'pointer',
                        background: '#15151e',
                        border: '1px solid #2d2d3d',
                        borderRadius: '8px',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'transform 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      title={st.name}
                    >
                      <img src={st.url} alt={st.name} style={{ width: '100%', height: '32px', objectFit: 'contain' }} />
                    </div>
                  ))}
                </div>

                {/* Custom sticker url frame */}
                <div style={{
                  marginTop: '12px',
                  padding: '10px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '10px',
                  border: '1px solid #2d2d3d'
                }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#b2bec3', marginBottom: '6px' }}>Tự thêm Nhãn Dán:</div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input 
                      type="text" 
                      placeholder="Dán link ảnh (URL)..."
                      value={customStickerUrl}
                      onChange={(e) => setCustomStickerUrl(e.target.value)}
                      style={{
                        flex: 1,
                        background: '#15151e',
                        border: '1px solid #2d2d3d',
                        borderRadius: '8px',
                        color: '#ffffff',
                        padding: '6px 10px',
                        fontSize: '0.75rem',
                        outline: 'none'
                      }}
                    />
                    <button
                      onClick={() => {
                        if (customStickerUrl.trim()) {
                          addSticker(customStickerUrl.trim());
                          setCustomStickerUrl('');
                        } else {
                          alert("Bạn hãy nhập URL ảnh nhãn dán nhé!");
                        }
                      }}
                      style={{
                        background: '#6c5ce7',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '0 12px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      Thêm
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
