import React, { useEffect, useRef, useState } from 'react';
import { HubConnection } from '@microsoft/signalr';
import { Users, Play, Send, Clock, CheckCircle2, RotateCcw, Trash2, Trophy, ArrowRight, Search, Settings } from 'lucide-react';

interface TroChoiTamSaoThatBanProps {
  userId: number;
  tenHienThi: string;
  connection: HubConnection | null;
  maPhongInit?: string;
  loaiPhong?: 'GhepNgauNhien' | 'VeCungBan' | 'TroChoiMini';
  onRoomCodeChange?: (code: string | undefined) => void;
  onClose?: () => void;
}

interface RoomPlayer {
  userId: number;
  tenHienThi: string;
  anhDaiDienUrl: string;
  sanSang: boolean;
  isChuPhong?: boolean;
}

interface ChatMessage {
  sender: string;
  text: string;
  isSystem?: boolean;
  isCorrect?: boolean;
}

interface GameSettingsState {
  tongSoVong: number;
  thoiGianVeGiay: number;
  thoiGianChonTuGiay?: number;
  thoiGianKetQuaGiay?: number;
}

interface GameProgress {
  roundNumber: number;
  totalRounds: number;
  turnNumber: number;
  totalTurns: number;
}

interface SavedRoom {
  maPhong: string;
  loaiPhong: string;
  savedAt: number;
}

export const TroChoiTamSaoThatBan: React.FC<TroChoiTamSaoThatBanProps> = ({ 
  userId, 
  tenHienThi, 
  connection, 
  maPhongInit, 
  loaiPhong, 
  onRoomCodeChange, 
  onClose 
}) => {
  const [gameState, setGameState] = useState<'lobby' | 'word_selection' | 'playing' | 'turn_results' | 'finished'>('lobby');
  const [maPhong, setMaPhong] = useState(maPhongInit || '');
  const [isChuPhong, setIsChuPhong] = useState(false);
  const [roomPlayers, setRoomPlayers] = useState<RoomPlayer[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [currentLoaiPhong, setCurrentLoaiPhong] = useState<string>(loaiPhong || 'TroChoiMini');
  const [maxPlayers, setMaxPlayers] = useState<number>(8);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [settings, setSettings] = useState<GameSettingsState>({ tongSoVong: 4, thoiGianVeGiay: 60 });
  const [gameProgress, setGameProgress] = useState<GameProgress>({ roundNumber: 1, totalRounds: 4, turnNumber: 1, totalTurns: 1 });
  const savedRoomKey = `draw_with_me_active_room_${userId}`;
  const [savedRoom, setSavedRoom] = useState<SavedRoom | null>(() => {
    try {
      const raw = localStorage.getItem(`draw_with_me_active_room_${userId}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [timeLeft, setTimeLeft] = useState(60);
  const [doanChuInput, setDoanChuInput] = useState('');
  
  // Game Play States
  const [drawerId, setDrawerId] = useState<number>(0);
  const [drawerName, setDrawerName] = useState<string>('');
  const [choices, setChoices] = useState<string[]>([]);
  const [chosenWord, setChosenWord] = useState<string>('');
  const [guessedCorrectly, setGuessedCorrectly] = useState(false);
  const [correctGuessers, setCorrectGuessers] = useState<number[]>([]);
  const [correctWord, setCorrectWord] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  // Canvas States
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedColor, setSelectedColor] = useState('#2f3542');
  const [brushSize, setBrushSize] = useState(6);
  const [isDrawing, setIsDrawing] = useState(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const [strokes, setStrokes] = useState<any[][]>([]);
  const currentStroke = useRef<any[]>([]);
  
  // Guesser Synced Strokes
  const guesserStrokes = useRef<any[][]>([]);
  const currentGuesserStroke = useRef<any[]>([]);

  // Refs
  const lastInitializedRoomRef = useRef<string | null>(null);
  const hasExitedRef = useRef(false);

  const rememberRoom = (roomCode: string, roomType: string) => {
    const next = { maPhong: roomCode, loaiPhong: roomType, savedAt: Date.now() };
    localStorage.setItem(savedRoomKey, JSON.stringify(next));
    setSavedRoom(next);
  };

  const forgetRoom = () => {
    localStorage.removeItem(savedRoomKey);
    setSavedRoom(null);
  };

  // Exit Room
  const handleThoatPhong = async () => {
    hasExitedRef.current = true;
    if (connection && maPhong) {
      try {
        await connection.invoke('ThoatPhong', maPhong, userId);
      } catch (err) {
        console.error("Lỗi khi thoát phòng:", err);
      }
    }
    forgetRoom();
    if (onClose) onClose();
  };

  const handleKickPlayer = (targetId: number) => {
    if (!connection || !maPhong) return;
    connection.invoke('KickNguoiChoi', maPhong, targetId).catch(err => console.error(err));
  };

  // SignalR Event Listeners
  useEffect(() => {
    if (!connection) return;

    const handleRoomCreated = (data: any) => {
      lastInitializedRoomRef.current = `join_${data.maPhong}`;
      setMaPhong(data.maPhong);
      if (onRoomCodeChange) onRoomCodeChange(data.maPhong);
      setIsChuPhong(data.chuPhongId === userId);
      setCurrentLoaiPhong(data.loaiPhong);
      setMaxPlayers(data.soNguoiToiDa);
      if (data.settings) setSettings(data.settings);
      rememberRoom(data.maPhong, data.loaiPhong);
      setRoomPlayers([{ userId, tenHienThi, anhDaiDienUrl: '/assets/avatars/default.png', sanSang: true, isChuPhong: true }]);
    };

    const handleRoomJoined = (data: any) => {
      setMaPhong(data.maPhong);
      if (onRoomCodeChange) onRoomCodeChange(data.maPhong);
      setIsChuPhong(data.chuPhongId === userId);
      setCurrentLoaiPhong(data.loaiPhong);
      setMaxPlayers(data.soNguoiToiDa);
      if (data.settings) setSettings(data.settings);
      rememberRoom(data.maPhong, data.loaiPhong);
    };

    const handlePhongDaMoCongDong = (maxPlayersLimit: number) => {
      setCurrentLoaiPhong('GhepNgauNhien');
      setMaxPlayers(maxPlayersLimit);
    };

    const handleCapNhatKhoaPhong = (loaiPhongMoi: string) => {
      setCurrentLoaiPhong(loaiPhongMoi);
    };

    const handleCapNhatPhong = (roomCode: string, players: RoomPlayer[]) => {
      setMaPhong(roomCode);
      if (onRoomCodeChange) onRoomCodeChange(roomCode);
      setRoomPlayers(players);
      if (roomCode) rememberRoom(roomCode, currentLoaiPhong);
      const me = players.find(p => p.userId === userId);
      if (me) {
        setIsReady(me.sanSang);
        setIsChuPhong(!!me.isChuPhong);
      }
    };

    const handleChuPhongMoi = (chuPhongId: number) => {
      setIsChuPhong(chuPhongId === userId);
      setRoomPlayers(prev => prev.map(p => p.userId === chuPhongId ? { ...p, isChuPhong: true } : { ...p, isChuPhong: false }));
    };

    const handleNguoiChoiThoatPhong = (thoatUserId: number) => {
      setRoomPlayers(prev => prev.filter(p => p.userId !== thoatUserId));
    };

    const handleBiKickKhoiPhong = () => {
      alert("Bạn đã bị chủ phòng mời ra khỏi phòng chơi.");
      forgetRoom();
      if (onClose) onClose();
    };

    const handleLoiPhong = (message: string) => {
      alert("Lỗi phòng: " + message);
      if (!maPhong) {
        forgetRoom();
      }
    };

    const handleLoiGame = (message: string) => {
      alert("Lỗi game: " + message);
    };

    const handleGameBiHuyDocDuong = (_thoatUserId: number, message: string) => {
      alert(message);
      forgetRoom();
      if (onClose) onClose();
    };

    const handleNguoiChoiThayDoiSanSang = (uId: number, ready: boolean) => {
      setRoomPlayers(prev => prev.map(p => p.userId === uId ? { ...p, sanSang: ready } : p));
      if (uId === userId) setIsReady(ready);
    };

    const handleCaiDatPhongCapNhat = (nextSettings: GameSettingsState) => {
      setSettings(nextSettings);
    };

    // Draw and Guess Specific Listeners
    const handleBanPhaiChonTuKhoa = (wordChoices: string[], time: number, progress?: GameProgress) => {
      setChoices(wordChoices);
      setTimeLeft(time);
      if (progress) setGameProgress(progress);
      setGameState('word_selection');
      setGuessedCorrectly(false);
      setCorrectGuessers([]);
      setChatMessages([]);
      setDrawerId(userId);
      setDrawerName(tenHienThi);
    };

    const handleNguoiChoiDangChonTuKhoa = (name: string, drId: number, time: number, progress?: GameProgress) => {
      setDrawerName(name);
      setDrawerId(drId);
      setTimeLeft(time);
      if (progress) setGameProgress(progress);
      setGameState('word_selection');
      setGuessedCorrectly(false);
      setCorrectGuessers([]);
      setChatMessages([]);
    };

    const handleBatDauLuotVe = (data: any) => {
      setDrawerId(data.drawerId);
      setDrawerName(data.drawerName);
      setChosenWord(data.tuKhoa);
      setTimeLeft(data.thoiGianGiay);
      if (data.progress) setGameProgress(data.progress);
      setGameState('playing');
      
      // Clear local canvas
      setTimeout(() => {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
        }
      }, 50);

      setStrokes([]);
      guesserStrokes.current = [];
    };

    const drawLine = (ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string, size: number) => {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    };

    const handleNhanNetVeGame = (dataStr: string) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const data = JSON.parse(dataStr);
      if (data.type === 'start_stroke') {
        currentGuesserStroke.current = [];
      } else if (data.type === 'draw') {
        drawLine(ctx, data.x0, data.y0, data.x1, data.y1, data.color, data.size);
        currentGuesserStroke.current.push(data);
      } else if (data.type === 'end_stroke') {
        if (currentGuesserStroke.current.length > 0) {
          guesserStrokes.current.push(currentGuesserStroke.current);
        }
      } else if (data.type === 'clear') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        guesserStrokes.current = [];
      } else if (data.type === 'undo') {
        guesserStrokes.current.pop();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        guesserStrokes.current.forEach(stroke => {
          stroke.forEach(seg => {
            drawLine(ctx, seg.x0, seg.y0, seg.x1, seg.y1, seg.color, seg.size);
          });
        });
      }
    };

    const handleNhanTinNhanGame = (data: any) => {
      setChatMessages(prev => [...prev, { sender: data.tenHienThi, text: data.tinNhan }]);
    };

    const handleNguoiChoiDoanDung = (data: any) => {
      setChatMessages(prev => [...prev, { sender: 'Hệ thống', text: `${data.tenHienThi} đã đoán chính xác từ khóa!`, isSystem: true, isCorrect: true }]);
      setCorrectGuessers(prev => [...prev, data.userId]);
      if (data.userId === userId) {
        setGuessedCorrectly(true);
      }
    };

    const handleShowKetQuaLuot = (data: any) => {
      setCorrectWord(data.tuKhoaDung);
      setLeaderboard(data.leaderboard);
      setTimeLeft(data.thoiGianGiay);
      if (data.progress) setGameProgress(data.progress);
      setGameState('turn_results');
    };

    const handleGameKetThucGameDrawGuess = (rankings: any[]) => {
      setLeaderboard(rankings);
      setGameState('finished');
    };

    connection.on('RoomCreated', handleRoomCreated);
    connection.on('RoomJoined', handleRoomJoined);
    connection.on('PhongDaMoCongDong', handlePhongDaMoCongDong);
    connection.on('CapNhatKhoaPhong', handleCapNhatKhoaPhong);
    connection.on('CapNhatPhong', handleCapNhatPhong);
    connection.on('ChuPhongMoi', handleChuPhongMoi);
    connection.on('NguoiChoiThoatPhong', handleNguoiChoiThoatPhong);
    connection.on('BiKickKhoiPhong', handleBiKickKhoiPhong);
    connection.on('LoiPhong', handleLoiPhong);
    connection.on('LoiGame', handleLoiGame);
    connection.on('GameBiHuyDocDuong', handleGameBiHuyDocDuong);
    connection.on('NguoiChoiThayDoiSanSang', handleNguoiChoiThayDoiSanSang);
    connection.on('CaiDatPhongCapNhat', handleCaiDatPhongCapNhat);
    connection.on('BanPhaiChonTuKhoa', handleBanPhaiChonTuKhoa);
    connection.on('NguoiChoiDangChonTuKhoa', handleNguoiChoiDangChonTuKhoa);
    connection.on('BatDauLuotVe', handleBatDauLuotVe);
    connection.on('NhanNetVeGame', handleNhanNetVeGame);
    connection.on('NhanTinNhanGame', handleNhanTinNhanGame);
    connection.on('NguoiChoiDoanDung', handleNguoiChoiDoanDung);
    connection.on('ShowKetQuaLuot', handleShowKetQuaLuot);
    connection.on('GameKetThucGameDrawGuess', handleGameKetThucGameDrawGuess);

    return () => {
      connection.off('RoomCreated', handleRoomCreated);
      connection.off('RoomJoined', handleRoomJoined);
      connection.off('PhongDaMoCongDong', handlePhongDaMoCongDong);
      connection.off('CapNhatKhoaPhong', handleCapNhatKhoaPhong);
      connection.off('CapNhatPhong', handleCapNhatPhong);
      connection.off('ChuPhongMoi', handleChuPhongMoi);
      connection.off('NguoiChoiThoatPhong', handleNguoiChoiThoatPhong);
      connection.off('BiKickKhoiPhong', handleBiKickKhoiPhong);
      connection.off('LoiPhong', handleLoiPhong);
      connection.off('LoiGame', handleLoiGame);
      connection.off('GameBiHuyDocDuong', handleGameBiHuyDocDuong);
      connection.off('NguoiChoiThayDoiSanSang', handleNguoiChoiThayDoiSanSang);
      connection.off('CaiDatPhongCapNhat', handleCaiDatPhongCapNhat);
      connection.off('BanPhaiChonTuKhoa', handleBanPhaiChonTuKhoa);
      connection.off('NguoiChoiDangChonTuKhoa', handleNguoiChoiDangChonTuKhoa);
      connection.off('BatDauLuotVe', handleBatDauLuotVe);
      connection.off('NhanNetVeGame', handleNhanNetVeGame);
      connection.off('NhanTinNhanGame', handleNhanTinNhanGame);
      connection.off('NguoiChoiDoanDung', handleNguoiChoiDoanDung);
      connection.off('ShowKetQuaLuot', handleShowKetQuaLuot);
      connection.off('GameKetThucGameDrawGuess', handleGameKetThucGameDrawGuess);
    };
  }, [connection, userId, tenHienThi]);

  // Handle auto-match or room creation logic
  useEffect(() => {
    if (!connection) return;
    if (!maPhongInit && !loaiPhong) return;

    const initKey = maPhongInit ? `join_${maPhongInit}` : `match_${loaiPhong}`;
    if (lastInitializedRoomRef.current === initKey) return;
    lastInitializedRoomRef.current = initKey;

    if (maPhongInit) {
      connection.invoke('ThamGiaPhong', maPhongInit, userId).catch(err => console.error(err));
    } else if (loaiPhong === 'GhepNgauNhien') {
      connection.invoke('GhepTrangNgauNhien', userId).catch(err => console.error(err));
    } else {
      connection.invoke('TaoPhong', userId, loaiPhong || 'TroChoiMini').catch(err => console.error(err));
    }
  }, [connection, userId, maPhongInit, loaiPhong]);

  // Timers countdown
  useEffect(() => {
    if (gameState === 'lobby' || timeLeft <= 0) return;

    const timer = setTimeout(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [timeLeft, gameState]);

  // Drawer word selection action
  const handleJoinByCode = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = joinCodeInput.trim().toUpperCase();
    if (!connection || !code) return;
    lastInitializedRoomRef.current = `join_${code}`;
    connection.invoke('ThamGiaPhong', code, userId).catch(err => console.error(err));
  };

  const handleCreatePrivateRoom = (roomType: 'TroChoiMini' | 'VeCungBan') => {
    if (!connection) return;
    lastInitializedRoomRef.current = `manual_${roomType}_${Date.now()}`;
    connection.invoke('TaoPhong', userId, roomType).catch(err => console.error(err));
  };

  const handleResumeRoom = () => {
    if (!connection || !savedRoom) return;
    setJoinCodeInput(savedRoom.maPhong);
    lastInitializedRoomRef.current = `resume_${savedRoom.maPhong}_${Date.now()}`;
    connection.invoke('ThamGiaPhong', savedRoom.maPhong, userId).catch(err => console.error(err));
  };

  const handleSettingsChange = (next: GameSettingsState) => {
    setSettings(next);
    if (connection && maPhong && isChuPhong) {
      connection.invoke('CapNhatCaiDatPhong', maPhong, next.tongSoVong, next.thoiGianVeGiay)
        .catch(err => console.error(err));
    }
  };

  const handleSelectWord = (word: string) => {
    if (!connection || !maPhong) return;
    connection.invoke('ChonTuKhoa', maPhong, word).catch(err => console.error(err));
  };

  // Guess submission
  const handleSendGuess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!doanChuInput.trim() || !connection || !maPhong || guessedCorrectly) return;
    connection.invoke('GuiPhanDoan', maPhong, doanChuInput.trim()).catch(err => console.error(err));
    setDoanChuInput('');
  };

  // Drawing Canvas Handlers (Drawer side)
  const drawLine = (ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string, size: number) => {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (userId !== drawerId || gameState !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    
    lastPos.current = { x, y };
    setIsDrawing(true);
    currentStroke.current = [];

    if (connection && maPhong) {
      connection.invoke('DongBoVeGame', maPhong, JSON.stringify({ type: 'start_stroke' })).catch(err => console.error(err));
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || userId !== drawerId || gameState !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    const ctx = canvas.getContext('2d');
    if (ctx) {
      drawLine(ctx, lastPos.current.x, lastPos.current.y, x, y, selectedColor, brushSize);
      
      const segment = {
        type: 'draw',
        x0: lastPos.current.x,
        y0: lastPos.current.y,
        x1: x,
        y1: y,
        color: selectedColor,
        size: brushSize
      };
      
      currentStroke.current.push(segment);

      if (connection && maPhong) {
        connection.invoke('DongBoVeGame', maPhong, JSON.stringify(segment)).catch(err => console.error(err));
      }
    }
    lastPos.current = { x, y };
  };

  const handleMouseUp = () => {
    if (!isDrawing || userId !== drawerId) return;
    setIsDrawing(false);
    if (currentStroke.current.length > 0) {
      setStrokes(prev => [...prev, currentStroke.current]);
    }
    if (connection && maPhong) {
      connection.invoke('DongBoVeGame', maPhong, JSON.stringify({ type: 'end_stroke' })).catch(err => console.error(err));
    }
  };

  const handleClear = () => {
    if (userId !== drawerId || gameState !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    setStrokes([]);
    if (connection && maPhong) {
      connection.invoke('DongBoVeGame', maPhong, JSON.stringify({ type: 'clear' })).catch(err => console.error(err));
    }
  };

  const handleUndo = () => {
    if (userId !== drawerId || gameState !== 'playing' || strokes.length === 0) return;
    const newStrokes = [...strokes];
    newStrokes.pop();
    setStrokes(newStrokes);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      newStrokes.forEach(stroke => {
        stroke.forEach(seg => {
          drawLine(ctx, seg.x0, seg.y0, seg.x1, seg.y1, seg.color, seg.size);
        });
      });
    }

    if (connection && maPhong) {
      connection.invoke('DongBoVeGame', maPhong, JSON.stringify({ type: 'undo' })).catch(err => console.error(err));
    }
  };

  // Toggle ready & start game
  const handleToggleReady = () => {
    if (!connection || !maPhong) return;
    connection.invoke('ThayDoiSanSang', maPhong, userId).catch(err => console.error(err));
  };

  const handleStartGame = () => {
    console.log("handleStartGame called, connection:", connection, "maPhong:", maPhong);
    if (!connection || !maPhong) return;
    connection.invoke('BatDauGame', maPhong).catch(err => {
      console.error("Lỗi invoke BatDauGame:", err);
      alert("Không thể bắt đầu game: " + err.message);
    });
  };

  const handleThayDoiKhoaPhong = (khoa: boolean) => {
    if (!connection || !maPhong) return;
    connection.invoke('ThayDoiKhoaPhong', maPhong, khoa).catch(err => console.error(err));
  };

  const getWordHint = (word: string) => {
    if (!word) return '';
    return word.split('').map(char => (char === ' ' ? '   ' : '_ ')).join('');
  };

  const allPlayersReady = roomPlayers.length >= 2 && roomPlayers.every(p => {
    console.log("Checking player ready:", p, "vs current userId:", userId, "matches:", p.userId === userId);
    return p.userId === userId || p.sanSang;
  });

  useEffect(() => {
    console.log("allPlayersReady state:", {
      allPlayersReady,
      roomPlayers,
      userId,
      length: roomPlayers.length
    });
  }, [allPlayersReady, roomPlayers, userId]);

  const renderRoundProgress = () => (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      background: '#f8fafc',
      border: '2px solid #2c3e50',
      borderRadius: '999px',
      padding: '6px 14px',
      fontWeight: 'bold',
      color: '#2c3e50',
      boxShadow: '0 3px 0 rgba(44, 62, 80, 0.15)'
    }}>
      <Trophy size={16} />
      Vong {gameProgress.roundNumber}/{gameProgress.totalRounds} - Luot {gameProgress.turnNumber}/{gameProgress.totalTurns}
    </div>
  );

  return (
    <div style={{ width: '100%', maxWidth: '850px', margin: '0 auto' }}>
      {gameState === 'lobby' && !maPhong && (
        <div className="bubble-card" style={{ background: 'white', padding: '28px', border: '3px solid #2c3e50' }}>
          <h2 className="title-kids">Vào phòng chơi</h2>

          {savedRoom && (
            <div style={{
              margin: '18px auto',
              padding: '14px 16px',
              border: '2px solid #2c3e50',
              borderRadius: '16px',
              background: '#fff9db',
              maxWidth: '520px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap'
            }}>
              <div style={{ fontWeight: 'bold', color: '#2c3e50' }}>
                Phòng đang lưu: {savedRoom.maPhong} ({savedRoom.loaiPhong === 'VeCungBan' ? 'Vẽ cùng bạn' : 'Trò chơi'})
              </div>
              <button onClick={handleResumeRoom} className="btn-bubble btn-yellow" style={{ padding: '8px 14px' }}>
                Tiếp tục phòng
              </button>
            </div>
          )}

          <form onSubmit={handleJoinByCode} style={{ display: 'flex', gap: '10px', justifyContent: 'center', margin: '22px auto', maxWidth: '520px' }}>
            <input
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
              placeholder="Nhập mã phòng..."
              maxLength={8}
              style={{
                flex: 1,
                minWidth: 0,
                padding: '12px 14px',
                border: '3px solid #2c3e50',
                borderRadius: '14px',
                fontWeight: 'bold',
                fontFamily: 'var(--font-kids)',
                outline: 'none',
                textTransform: 'uppercase'
              }}
            />
            <button type="submit" className="btn-bubble btn-blue" style={{ padding: '10px 16px' }}>
              <Search size={18} />
              Tìm phòng
            </button>
          </form>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginTop: '24px' }}>
            <button onClick={() => handleCreatePrivateRoom('TroChoiMini')} className="btn-bubble btn-pink" style={{ justifyContent: 'center', padding: '18px' }}>
              <Play size={22} />
              Tạo phòng chơi
            </button>
            <button onClick={() => handleCreatePrivateRoom('VeCungBan')} className="btn-bubble btn-green" style={{ justifyContent: 'center', padding: '18px' }}>
              <Users size={22} />
              Tạo phòng vẽ bạn bè
            </button>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              style={{ marginTop: '22px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline' }}
            >
              Quay lại trang chủ
            </button>
          )}
        </div>
      )}
      
      {/* 1. LOBBY STATE */}
      {gameState === 'lobby' && maPhong && (
        <div className="bubble-card" style={{ background: 'white', padding: '24px', border: '3px solid #2c3e50' }}>
          <h2 className="title-kids">Phòng chờ Vẽ & Đoán</h2>
          
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--color-sun)',
            border: '2px solid #2c3e50',
            borderRadius: '12px',
            padding: '10px',
            fontSize: '1.2rem',
            fontWeight: 'bold',
            color: '#2c3e50',
            width: '240px',
            margin: '20px auto',
            boxShadow: '0 4px 0 #2c3e50'
          }}>
            MÃ PHÒNG: {maPhong}
          </div>

          <div style={{ textAlign: 'center', fontSize: '1rem', color: '#64748b', fontWeight: 'bold', marginBottom: '20px' }}>
            Trạng thái: {currentLoaiPhong === 'GhepNgauNhien' ? 'Công khai (Toàn server)' : 'Riêng tư (Chờ kết nối)'} ({roomPlayers.length}/{maxPlayers} người)
          </div>

          {currentLoaiPhong === 'VeCungBan' && roomPlayers.length > 0 && (
            <div style={{
              textAlign: 'center',
              background: '#f0fdf4',
              border: '2px solid #2c3e50',
              borderRadius: '14px',
              padding: '10px 14px',
              margin: '0 auto 18px auto',
              maxWidth: '560px',
              fontWeight: 'bold',
              color: '#166534'
            }}>
              Dang ve cung: {roomPlayers.map(p => p.userId === userId ? `${p.tenHienThi} (Ban)` : p.tenHienThi).join(' va ')}
            </div>
          )}

          {currentLoaiPhong !== 'VeCungBan' && (
            <div style={{
              border: '2px solid #2c3e50',
              borderRadius: '16px',
              padding: '14px',
              marginBottom: '20px',
              background: '#f8fafc'
            }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 12px 0', fontSize: '1rem', color: '#2c3e50' }}>
                <Settings size={18} />
                Cai dat tran dau
              </h3>
              {isChuPhong ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' }}>
                  <label style={{ fontWeight: 'bold', color: '#475569' }}>
                    So vong: {settings.tongSoVong}
                    <input
                      type="range"
                      min="1"
                      max="6"
                      value={settings.tongSoVong}
                      onChange={(e) => handleSettingsChange({ ...settings, tongSoVong: Number(e.target.value) })}
                      style={{ width: '100%', accentColor: '#ff6b81' }}
                    />
                  </label>
                  <label style={{ fontWeight: 'bold', color: '#475569' }}>
                    Thoi gian ve: {settings.thoiGianVeGiay}s
                    <input
                      type="range"
                      min="30"
                      max="120"
                      step="15"
                      value={settings.thoiGianVeGiay}
                      onChange={(e) => handleSettingsChange({ ...settings, thoiGianVeGiay: Number(e.target.value) })}
                      style={{ width: '100%', accentColor: '#70a1ff' }}
                    />
                  </label>
                </div>
              ) : (
                <div style={{ fontWeight: 'bold', color: '#64748b' }}>
                  {settings.tongSoVong} vong, {settings.thoiGianVeGiay}s moi luot ve
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '30px', marginTop: '10px', justifyContent: 'center' }}>
            <div style={{ flex: 1, minWidth: '280px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '16px', color: '#64748b' }}>
                <Users size={20} />
                Bạn chơi trong phòng ({roomPlayers.length})
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {roomPlayers.map(p => (
                  <div key={p.userId} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 16px',
                    border: '2px solid #2c3e50',
                    borderRadius: '16px',
                    background: p.isChuPhong ? '#fff5f5' : p.sanSang ? '#f0fdf4' : 'white',
                    boxShadow: '0 4px 0 rgba(44, 62, 80, 0.1)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <img src={p.anhDaiDienUrl} alt={p.tenHienThi} style={{ width: '36px', height: '36px', borderRadius: '50%', border: '2px solid #2c3e50' }} />
                      <span style={{ fontWeight: 'bold' }}>{p.tenHienThi} {p.userId === userId && "(Bạn)"}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {p.isChuPhong ? (
                        <span style={{ color: '#ff4757', fontWeight: 'bold', fontSize: '0.9rem' }}>Chủ phòng</span>
                      ) : p.sanSang ? (
                        <span style={{ color: '#16a34a', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem' }}>
                          <CheckCircle2 size={16} /> Sẵn sàng
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontWeight: 'bold', fontSize: '0.9rem' }}>Đang đợi...</span>
                      )}

                      {isChuPhong && !p.isChuPhong && (
                        <button
                          onClick={() => handleKickPlayer(p.userId)}
                          style={{
                            marginLeft: '12px',
                            background: '#ff4757',
                            color: 'white',
                            border: '2px solid #2c3e50',
                            borderRadius: '8px',
                            padding: '4px 10px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: 'bold',
                            boxShadow: '0 2px 0 #2c3e50'
                          }}
                        >
                          Đuổi
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ width: '260px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '20px' }}>
              {isChuPhong ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
                  <button 
                    onClick={handleStartGame}
                    disabled={!allPlayersReady}
                    className="btn-bubble btn-pink hover-bounce"
                    style={{ width: '100%', padding: '16px', fontSize: '1.2rem', justifyContent: 'center' }}>
                    <Play size={22} />
                    Bắt đầu game
                  </button>
                  {currentLoaiPhong === 'GhepNgauNhien' ? (
                    <button 
                      onClick={() => handleThayDoiKhoaPhong(true)}
                      className="btn-bubble hover-bounce"
                      style={{ width: '100%', padding: '12px', fontSize: '1.1rem', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px', background: '#ff4757', border: '3px solid #2c3e50', color: 'white', boxShadow: '0 6px 0 #2c3e50' }}>
                      <Users size={18} />
                      Khóa phòng (Riêng tư)
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleThayDoiKhoaPhong(false)}
                      className="btn-bubble btn-yellow hover-bounce"
                      style={{ width: '100%', padding: '12px', fontSize: '1.1rem', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Users size={18} />
                      Mở phòng toàn server
                    </button>
                  )}
                </div>
              ) : (
                <button 
                  onClick={handleToggleReady}
                  className={`btn-bubble ${isReady ? 'btn-green' : 'btn-yellow'}`}
                  style={{ width: '100%', padding: '16px', fontSize: '1.2rem', justifyContent: 'center' }}>
                  {isReady ? "Hủy Sẵn sàng" : "Sẵn sàng chơi"}
                </button>
              )}
              
              <div style={{ fontSize: '0.8rem', color: '#64748b', textAlign: 'center', fontWeight: 'bold' }}>
                {isChuPhong 
                  ? "Hãy bấm Bắt đầu khi có ít nhất 2 người chơi và mọi người đều Sẵn sàng nhé!"
                  : "Đợi chủ phòng bấm bắt đầu để chiến đấu nhé bé!"
                }
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. WORD SELECTION STATE */}
      {gameState === 'word_selection' && (
        <div className="bubble-card" style={{ background: 'white', padding: '40px', border: '3px solid #2c3e50', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', fontSize: '1.2rem', fontWeight: 'bold', color: '#2c3e50', marginBottom: '20px' }}>
            <Clock size={24} />
            <span>Còn lại: {timeLeft} giây</span>
          </div>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            {renderRoundProgress()}
          </div>

          {userId === drawerId ? (
            <div>
              <h2 className="title-kids" style={{ fontSize: '2rem', marginBottom: '15px' }}>Đến lượt bạn chọn từ khóa!</h2>
              <p style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#64748b', marginBottom: '30px' }}>Bé hãy chọn 1 trong 3 từ dưới đây để vẽ nhé:</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '300px', margin: '0 auto' }}>
                {choices.map(word => (
                  <button
                    key={word}
                    onClick={() => handleSelectWord(word)}
                    className="btn-bubble btn-pink hover-bounce"
                    style={{ padding: '16px', fontSize: '1.25rem', justifyContent: 'center' }}
                  >
                    {word}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '4rem', marginBottom: '15px' }}>⏳</div>
              <h2 className="title-kids" style={{ fontSize: '2rem', marginBottom: '15px' }}>Đang chuẩn bị...</h2>
              <p style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#64748b' }}>
                Bé hãy đợi một chút, họa sĩ <strong>{drawerName}</strong> đang chọn từ khóa để vẽ nhé!
              </p>
            </div>
          )}
        </div>
      )}

      {/* 3. PLAYING STATE */}
      {gameState === 'playing' && (
        <div className="bubble-card" style={{ background: 'white', padding: '24px', border: '3px solid #2c3e50' }}>
          
          {/* Header Vòng chơi và Timer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ background: 'var(--color-primary)', color: 'white', border: '2px solid #2c3e50', borderRadius: '12px', padding: '4px 12px', fontWeight: 'bold', fontFamily: 'var(--font-kids)' }}>
                HỌA SĨ: {drawerName} {userId === drawerId && "(Bạn)"}
              </div>
              {renderRoundProgress()}
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '1.15rem',
              fontWeight: 'bold',
              color: timeLeft <= 10 ? '#ff6b81' : '#2c3e50'
            }}>
              <Clock size={20} />
              <span>Còn lại: {timeLeft}s</span>
            </div>
          </div>

          {/* Hiển thị Từ khóa / Gợi ý */}
          <div style={{
            background: '#f8fafc',
            border: '3px solid #2c3e50',
            borderRadius: '16px',
            padding: '12px',
            fontSize: '1.3rem',
            fontWeight: 'bold',
            color: 'var(--color-primary)',
            marginBottom: '20px',
            textAlign: 'center',
            letterSpacing: userId === drawerId ? 'normal' : '4px',
            boxShadow: '0 4px 0 rgba(0,0,0,0.05)'
          }}>
            {userId === drawerId ? `Bé hãy vẽ từ: "${chosenWord}"` : `Đoán từ: ${getWordHint(chosenWord)}`}
          </div>

          {/* Khung chơi game chính chia 2 cột */}
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            {/* Cột Trái: Canvas vẽ và Toolbars */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: '400px' }}>
              
              <div style={{
                border: '5px solid #2c3e50',
                borderRadius: '24px',
                overflow: 'hidden',
                boxShadow: '0 8px 0 #2c3e50',
                background: 'white',
                width: '500px',
                height: '350px',
                position: 'relative'
              }}>
                <canvas 
                  ref={canvasRef}
                  width={500}
                  height={350}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  style={{
                    display: 'block',
                    width: '100%',
                    height: '100%',
                    cursor: userId === drawerId ? 'crosshair' : 'not-allowed'
                  }}
                />
              </div>

              {/* Thanh màu & Nút chức năng chỉ hiện cho người vẽ */}
              {userId === drawerId && (
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '16px', width: '100%', justifyContent: 'space-between' }}>
                  
                  {/* Bảng màu */}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {['#ff6b81', '#ff4757', '#ffa502', '#ffd32a', '#2bcbba', '#70a1ff', '#2f3542', '#000000'].map(color => (
                      <button 
                        key={color}
                        onClick={() => setSelectedColor(color)}
                        style={{
                          background: color,
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          border: selectedColor === color ? '3px solid #2c3e50' : '1.5px solid #cbd5e1',
                          cursor: 'pointer',
                          transition: 'transform 0.1s'
                        }}
                      />
                    ))}
                  </div>
                  
                  {/* Kích thước bút vẽ */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Cọ:</span>
                    <input 
                      type="range" 
                      min="2" 
                      max="16" 
                      value={brushSize}
                      onChange={(e) => setBrushSize(Number(e.target.value))}
                      style={{ width: '70px', cursor: 'pointer' }}
                    />
                  </div>

                  {/* Hoàn tác & Xóa bảng */}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button 
                      onClick={handleUndo} 
                      title="Quay lại"
                      style={{
                        background: '#f1f5f9',
                        border: '2px solid #2c3e50',
                        borderRadius: '10px',
                        padding: '6px 10px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        boxShadow: '0 2px 0 #2c3e50'
                      }}
                    >
                      <RotateCcw size={16} />
                    </button>
                    <button 
                      onClick={handleClear} 
                      title="Xóa hết"
                      style={{
                        background: '#ff4757',
                        border: '2px solid #2c3e50',
                        color: 'white',
                        borderRadius: '10px',
                        padding: '6px 10px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        boxShadow: '0 2px 0 #2c3e50'
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Cột Phải: Chat dự đoán & người đoán */}
            <div style={{ width: '280px', display: 'flex', flexDirection: 'column', height: '350px', border: '3px solid #2c3e50', borderRadius: '24px', overflow: 'hidden', background: '#f8fafc', boxShadow: '0 4px 0 #2c3e50' }}>
              
              {/* Tiêu đề Box */}
              <div style={{ background: '#2c3e50', color: 'white', padding: '8px 12px', fontWeight: 'bold', fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>ĐOÁN CHỮ</span>
                <span>{correctGuessers.length} đúng</span>
              </div>

              {/* Khung chat */}
              <div style={{ flex: 1, padding: '10px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                {chatMessages.map((msg, i) => (
                  <div 
                    key={i} 
                    style={{
                      padding: '6px 10px',
                      borderRadius: '10px',
                      background: msg.isCorrect ? '#d4edda' : '#ffffff',
                      border: msg.isCorrect ? '1.5px solid #c3e6cb' : '1.5px solid #e2e8f0',
                      color: msg.isCorrect ? '#155724' : '#2d3436',
                      fontWeight: msg.isSystem ? 'bold' : 'normal',
                      textAlign: 'left'
                    }}
                  >
                    {!msg.isSystem && <strong>{msg.sender}: </strong>}
                    <span>{msg.text}</span>
                  </div>
                ))}
              </div>

              {/* Ô gõ dự đoán */}
              {userId !== drawerId ? (
                <form onSubmit={handleSendGuess} style={{ display: 'flex', padding: '8px', gap: '4px', borderTop: '2px solid #e2e8f0', background: 'white' }}>
                  <input 
                    type="text" 
                    placeholder={guessedCorrectly ? "Bạn đã đoán trúng rồi! 🌟" : "Nhập câu đoán..."}
                    value={doanChuInput}
                    disabled={guessedCorrectly}
                    onChange={(e) => setDoanChuInput(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      border: '2px solid #cbd5e1',
                      borderRadius: '12px',
                      outline: 'none',
                      fontFamily: 'var(--font-kids)',
                      fontSize: '0.85rem'
                    }}
                  />
                  <button 
                    type="submit" 
                    disabled={guessedCorrectly}
                    className="btn-bubble btn-pink" 
                    style={{ padding: '8px 12px', fontSize: '0.8rem', boxShadow: '0 2px 0 #d63031', borderRadius: '12px' }}
                  >
                    <Send size={14} />
                  </button>
                </form>
              ) : (
                <div style={{ padding: '10px', background: '#fff3cd', borderTop: '2px solid #ffeeba', color: '#856404', fontSize: '0.8rem', fontWeight: 'bold' }}>
                  Bé vẽ thật đẹp để bạn bè dễ đoán trúng nha!
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. TURN RESULTS STATE */}
      {gameState === 'turn_results' && (
        <div className="bubble-card" style={{ background: 'white', padding: '30px', border: '3px solid #2c3e50', textAlign: 'center' }}>
          <div style={{ marginBottom: '18px' }}>
            {renderRoundProgress()}
          </div>
          <h2 className="title-kids" style={{ fontSize: '2.5rem', color: '#16a34a' }}>Hết giờ vẽ rồi!</h2>
          <div style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '24px' }}>
            Từ khóa chính xác là: <strong style={{ color: '#ff4757', fontSize: '1.6rem' }}>"{correctWord}"</strong>
          </div>

          <div style={{ maxWidth: '400px', margin: '0 auto' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#64748b', marginBottom: '16px', textAlign: 'left', borderBottom: '2px dashed #cbd5e1', paddingBottom: '6px' }}>
              Điểm số lượt này:
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '30px' }}>
              {leaderboard.map(p => (
                <div key={p.userId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', border: '1.5px solid #2c3e50', borderRadius: '12px', background: p.diemLuotNay > 0 ? '#f0fdf4' : 'white', fontWeight: 'bold' }}>
                  <span>{p.tenHienThi} {p.userId === userId && "(Bạn)"}</span>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ color: '#16a34a' }}>+{p.diemLuotNay}đ</span>
                    <span style={{ color: '#64748b' }}>(Tổng: {p.tongDiem}đ)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '1.1rem', fontWeight: 'bold', color: '#2c3e50' }}>
            <Clock size={20} />
            <span>Tiếp tục trong: {timeLeft}s</span>
          </div>
        </div>
      )}

      {/* 5. FINISHED STATE (GAME END Rankings) */}
      {gameState === 'finished' && (
        <div className="bubble-card" style={{ background: 'white', padding: '32px', border: '3px solid #2c3e50', textAlign: 'center' }}>
          <div style={{ fontSize: '4.5rem', marginBottom: '12px' }}>🏆</div>
          <h2 className="title-kids" style={{ fontSize: '3rem', marginBottom: '24px' }}>BẢNG XẾP HẠNG CHUNG CUỘC</h2>

          <div style={{ maxWidth: '500px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
            {leaderboard.map((p, idx) => (
              <div 
                key={p.userId} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  padding: '12px 20px', 
                  border: '3px solid #2c3e50', 
                  borderRadius: '20px', 
                  background: idx === 0 ? 'var(--color-sun)' : idx === 1 ? '#e2e8f0' : idx === 2 ? '#ffecd2' : 'white',
                  boxShadow: '0 5px 0 #2c3e50',
                  fontWeight: 'bold',
                  fontSize: '1.1rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '1.25rem', color: '#2c3e50', width: '24px' }}>
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`}
                  </span>
                  <img src={p.anhDaiDienUrl} alt={p.tenHienThi} style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid #2c3e50' }} />
                  <span>{p.tenHienThi} {p.userId === userId && "(Bạn)"}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#2c3e50' }}>
                  <Trophy size={18} />
                  <span>{p.tongDiem}đ</span>
                </div>
              </div>
            ))}
          </div>

          <button 
            onClick={handleThoatPhong} 
            className="btn-bubble btn-pink hover-bounce" 
            style={{ padding: '16px 36px', fontSize: '1.2rem', display: 'inline-flex', gap: '8px', margin: '0 auto' }}
          >
            Quay lại trang chủ
            <ArrowRight size={20} />
          </button>
        </div>
      )}

      {onClose && gameState === 'lobby' && (
        <button 
          onClick={handleThoatPhong}
          style={{
            marginTop: '20px',
            background: 'none',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            fontWeight: 'bold',
            textDecoration: 'underline'
          }}>
          Thoát phòng
        </button>
      )}
    </div>
  );
};
