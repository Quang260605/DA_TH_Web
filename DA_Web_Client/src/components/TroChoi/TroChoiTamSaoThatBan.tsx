import React, { useEffect, useRef, useState } from 'react';
// @ts-ignore
import * as fabric from 'fabric';
import axios from 'axios';
import { API_URL } from '../../config';
import { HubConnection } from '@microsoft/signalr';
import { Users, Play, Send, Clock, CheckCircle2, ArrowRight } from 'lucide-react';

interface TroChoiTamSaoThatBanProps {
  userId: number;
  tenHienThi: string;
  connection: HubConnection | null;
  maPhongInit?: string; // Nếu người dùng join phòng bằng mã phòng
  loaiPhong?: 'GhepNgauNhien' | 'VeCungBan' | 'TroChoiMini';
  onRoomCodeChange?: (code: string | undefined) => void;
  onClose?: () => void;
}

interface RoomPlayer {
  userId: number;
  tenHienThi: string;
  anhDaiDienUrl: string;
  sanSang: boolean;
}

interface VongChoiData {
  gameSessionId: number;
  roundNumber: number;
  gameRoundId: number;
  loaiLuotChoi: 'VeHinh' | 'DoanChu';
  noiDungNhan: string; // Chữ để vẽ (nếu VeHinh) hoặc Ảnh Base64 để đoán (nếu DoanChu)
  receivedFromTurnId: number | null;
  thoiGianGiay: number;
}

export const TroChoiTamSaoThatBan: React.FC<TroChoiTamSaoThatBanProps> = ({ userId, tenHienThi, connection, maPhongInit, loaiPhong, onRoomCodeChange, onClose }) => {
  const [gameState, setGameState] = useState<'lobby' | 'playing' | 'waiting_next' | 'finished'>('lobby');
  const [maPhong, setMaPhong] = useState(maPhongInit || '');
  const [isChuPhong, setIsChuPhong] = useState(false);
  const [roomPlayers, setRoomPlayers] = useState<RoomPlayer[]>([]);
  const [isReady, setIsReady] = useState(false);

  // Ref theo dõi việc khởi tạo phòng chơi để tránh lặp lại nhiều lần
  const hasInitializedRoom = useRef(false);

  // Vòng chơi hiện tại
  const [vongData, setVongData] = useState<VongChoiData | null>(null);
  const [timeLeft, setTimeLeft] = useState(60);
  const [doanChuInput, setDoanChuInput] = useState('');
  const [daNopBai, setDaNopBai] = useState(false);
  const [soNguoiDaNop, setSoNguoiDaNop] = useState(0);

  // Canvas vẽ game
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
  const [selectedColor, setSelectedColor] = useState('#2f3542');
  const [brushSize, setBrushSize] = useState(8);

  // Kết quả tổng kết game
  const [gameResultChain, setGameResultChain] = useState<any[]>([]);
  const [currentChainIdx, setCurrentChainIdx] = useState(0);

  // 1. Đăng ký các sự kiện lắng nghe SignalR
  useEffect(() => {
    if (!connection) return;

    const handleRoomCreated = (data: any) => {
      setMaPhong(data.maPhong);
      if (onRoomCodeChange) onRoomCodeChange(data.maPhong);
      setIsChuPhong(data.chuPhongId === userId);
      setRoomPlayers([{ userId, tenHienThi, anhDaiDienUrl: '/assets/avatars/default.png', sanSang: true }]);
    };

    const handleCapNhatPhong = (roomCode: string, players: RoomPlayer[]) => {
      setMaPhong(roomCode);
      if (onRoomCodeChange) onRoomCodeChange(roomCode);
      setRoomPlayers(players);
      const me = players.find(p => p.userId === userId);
      if (me) setIsReady(me.sanSang);
      
      // Kiểm tra xem ai là chủ phòng thực tế
      if (players.length > 0 && players[0].userId === userId) {
        setIsChuPhong(true);
      }
    };

    const handleChuPhongMoi = (chuPhongId: number) => {
      setIsChuPhong(chuPhongId === userId);
    };

    const handleNguoiChoiThayDoiSanSang = (uId: number, ready: boolean) => {
      setRoomPlayers(prev => prev.map(p => p.userId === uId ? { ...p, sanSang: ready } : p));
      if (uId === userId) setIsReady(ready);
    };

    const handleBatDauVongChoi = (data: VongChoiData) => {
      setVongData(data);
      setTimeLeft(data.thoiGianGiay);
      setDaNopBai(false);
      setSoNguoiDaNop(0);
      setDoanChuInput('');
      setGameState('playing');
    };

    const handleNguoiChoiDaNopBai = (_uId: number) => {
      setSoNguoiDaNop(prev => prev + 1);
    };

    const handleGameKetThuc = (phienGameId: number) => {
      setGameState('finished');
      fetchGameResults(phienGameId);
    };

    connection.on('RoomCreated', handleRoomCreated);
    connection.on('CapNhatPhong', handleCapNhatPhong);
    connection.on('ChuPhongMoi', handleChuPhongMoi);
    connection.on('NguoiChoiThayDoiSanSang', handleNguoiChoiThayDoiSanSang);
    connection.on('BatDauVongChoi', handleBatDauVongChoi);
    connection.on('NguoiChoiDaNopBai', handleNguoiChoiDaNopBai);
    connection.on('GameKetThuc', handleGameKetThuc);

    return () => {
      if (onRoomCodeChange) onRoomCodeChange(undefined);
      connection.off('RoomCreated', handleRoomCreated);
      connection.off('CapNhatPhong', handleCapNhatPhong);
      connection.off('ChuPhongMoi', handleChuPhongMoi);
      connection.off('NguoiChoiThayDoiSanSang', handleNguoiChoiThayDoiSanSang);
      connection.off('BatDauVongChoi', handleBatDauVongChoi);
      connection.off('NguoiChoiDaNopBai', handleNguoiChoiDaNopBai);
      connection.off('GameKetThuc', handleGameKetThuc);
    };
  }, [connection, userId]);

  // 2. Tự động tạo phòng hoặc join phòng một lần duy nhất khi kết nối sẵn sàng
  useEffect(() => {
    if (!connection) return;
    if (hasInitializedRoom.current) return;
    hasInitializedRoom.current = true;

    if (maPhongInit) {
      // Người dùng join phòng có sẵn
      connection.invoke('ThamGiaPhong', maPhongInit, userId).catch(err => console.error(err));
    } else if (loaiPhong === 'GhepNgauNhien') {
      // Ghép ngẫu nhiên: Tìm phòng có sẵn hoặc tự tạo phòng mới
      connection.invoke('GhepTrangNgauNhien', userId).catch(err => console.error(err));
    } else {
      // Người dùng tự tạo phòng chơi game
      connection.invoke('TaoPhong', userId, loaiPhong || 'TroChoiMini').catch(err => console.error(err));
    }
  }, [connection, userId, maPhongInit]);

  // Bộ đếm ngược thời gian chơi
  useEffect(() => {
    if (gameState !== 'playing' || timeLeft <= 0 || daNopBai) return;

    const timer = setTimeout(() => {
      setTimeLeft(timeLeft - 1);
    }, 1000);

    if (timeLeft === 1) {
      // Hết giờ -> Tự động nộp bài
      handleNopBai();
    }

    return () => clearTimeout(timer);
  }, [timeLeft, gameState, daNopBai]);

  // Khởi tạo Canvas vẽ khi đến lượt Vẽ hình
  useEffect(() => {
    if (gameState !== 'playing' || !vongData || vongData.loaiLuotChoi !== 'VeHinh' || !canvasRef.current) return;

    const fbCanvas = new fabric.Canvas(canvasRef.current, {
      width: 550,
      height: 380,
      backgroundColor: '#ffffff',
      isDrawingMode: true
    });

    fbCanvas.freeDrawingBrush!.color = selectedColor;
    fbCanvas.freeDrawingBrush!.width = brushSize;

    setCanvas(fbCanvas);

    return () => {
      fbCanvas.dispose();
      setCanvas(null);
    };
  }, [gameState, vongData]);

  // Cập nhật bút vẽ game
  useEffect(() => {
    if (!canvas) return;
    canvas.freeDrawingBrush!.color = selectedColor;
    canvas.freeDrawingBrush!.width = brushSize;
  }, [canvas, selectedColor, brushSize]);

  // Bấm Sẵn sàng
  const handleToggleReady = () => {
    if (!connection || !maPhong) return;
    connection.invoke('ThayDoiSanSang', maPhong, userId).catch(err => console.error(err));
  };

  // Chủ phòng bấm Bắt đầu game
  const handleStartGame = () => {
    if (!connection || !maPhong) return;
    connection.invoke('BatDauGame', maPhong).catch(err => console.error(err));
  };

  // Nộp kết quả lượt chơi
  const handleNopBai = async () => {
    if (!connection || !vongData || daNopBai) return;

    let contentData = '';

    if (vongData.loaiLuotChoi === 'VeHinh') {
      if (canvas) {
        contentData = canvas.toDataURL({ format: 'png', quality: 0.5, multiplier: 1 });
      }
    } else {
      contentData = doanChuInput.trim() || 'Không đoán được';
    }

    setDaNopBai(true);
    setGameState('waiting_next');

    // Gọi SignalR nộp bài
    connection.invoke('NopLuotChoi', 
      vongData.gameRoundId, 
      userId, 
      vongData.loaiLuotChoi, 
      contentData, 
      vongData.receivedFromTurnId
    ).catch(err => {
      console.error(err);
      setDaNopBai(false);
      setGameState('playing');
    });
  };

  // Tải kết quả chuỗi game sau khi kết thúc
  const fetchGameResults = async (_phienGameId: number) => {
    try {
      // Gọi API lấy chuỗi lịch sử game
      await axios.get(`${API_URL}/drawing/assets?type=Sticker`); // Tạm thời dùng API mock, ta sẽ xây dựng endpoint thật sau hoặc render chuỗi dummy cho vui
      // Để demo hiển thị sinh động, ta mock một chuỗi truyền tin siêu vui nhộn:
      const mockChain = [
        { kieu: 'chu', nguoi: 'Bạn Bo', noiDung: 'Con khỉ đi xe đạp' },
        { kieu: 'hinh', nguoi: 'Họa sĩ', noiDung: 'https://images.vexels.com/media/users/3/185213/isolated/preview/26e38b34003d7c387190de12470725ad-flat-kitten-cat.png' }, // Thay thế bằng vẽ mẫu
        { kieu: 'chu', nguoi: 'Bạn Na', noiDung: 'Chú mèo lái phi thuyền' },
        { kieu: 'hinh', nguoi: 'Bạn Bo', noiDung: 'https://images.vexels.com/media/users/3/135118/isolated/preview/7c22998f48f435c24e6fb5b0583b27b4-sun-doodle-drawing.png' }
      ];
      setGameResultChain(mockChain);
      setCurrentChainIdx(0);
    } catch (err) {
      console.error(err);
    }
  };

  const allPlayersReady = roomPlayers.length >= 2 && roomPlayers.every(p => p.userId === userId || p.sanSang);

  return (
    <div style={{ width: '100%', maxWidth: '850px', margin: '0 auto' }}>
      
      {/* 1. GIAO DIỆN PHÒNG CHỜ (LOBBY) */}
      {gameState === 'lobby' && (
        <div className="bubble-card" style={{ background: 'white', padding: '24px', border: '3px solid #2c3e50' }}>
          <h2 className="title-kids">Phòng chơi Tam sao thất bản</h2>
          
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

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '30px', marginTop: '30px', justifyContent: 'center' }}>
            {/* Cột trái: Thành viên phòng */}
            <div style={{ flex: 1, minWidth: '280px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '16px', color: '#64748b' }}>
                <Users size={20} />
                Bạn chơi đang chờ ({roomPlayers.length})
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
                    background: p.sanSang ? '#f0fdf4' : 'white',
                    boxShadow: '0 4px 0 rgba(44, 62, 80, 0.1)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <img src={p.anhDaiDienUrl} alt={p.tenHienThi} style={{ width: '36px', height: '36px', borderRadius: '50%', border: '2px solid #2c3e50' }} />
                      <span style={{ fontWeight: 'bold' }}>{p.tenHienThi} {p.userId === userId && "(Bạn)"}</span>
                    </div>
                    <div>
                      {p.sanSang ? (
                        <span style={{ color: '#16a34a', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem' }}>
                          <CheckCircle2 size={16} /> Đã sẵn sàng
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontWeight: 'bold', fontSize: '0.9rem' }}>Đang chờ...</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cột phải: Thao tác phòng */}
            <div style={{
              width: '260px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '20px'
            }}>
              {isChuPhong ? (
                <button 
                  onClick={handleStartGame}
                  disabled={!allPlayersReady}
                  className="btn-bubble btn-pink hover-bounce"
                  style={{ width: '100%', padding: '16px', fontSize: '1.2rem', justifyContent: 'center' }}>
                  <Play size={22} />
                  Bắt đầu game
                </button>
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
                  : "Đợi chủ phòng bấm bắt đầu game để chơi nha bạn!"
                }
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. GIAO DIỆN CHƠI GAME VẼ / ĐOÁN CHỮ (PLAYING) */}
      {gameState === 'playing' && vongData && (
        <div className="bubble-card" style={{ background: 'white', padding: '24px', border: '3px solid #2c3e50' }}>
          
          {/* Thanh trạng thái vòng và thời gian đếm ngược */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{
              background: 'var(--color-primary)',
              color: 'white',
              border: '2px solid #2c3e50',
              borderRadius: '12px',
              padding: '6px 16px',
              fontWeight: 'bold',
              fontFamily: 'var(--font-kids)',
              boxShadow: '0 3px 0 #2c3e50'
            }}>
              VÒNG CHƠI {vongData.roundNumber}
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '1.2rem',
              fontWeight: 'bold',
              color: timeLeft <= 10 ? '#ff6b81' : '#2c3e50'
            }}>
              <Clock size={22} />
              <span>Thời gian còn: {timeLeft}s</span>
            </div>
          </div>

          {/* LƯỢT 1: VẼ HÌNH TỪ TỪ KHÓA NHẬN ĐƯỢC */}
          {vongData.loaiLuotChoi === 'VeHinh' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                background: '#f8fafc',
                border: '3px solid #2c3e50',
                borderRadius: '16px',
                padding: '12px 24px',
                fontSize: '1.2rem',
                fontWeight: 'bold',
                color: 'var(--color-primary)',
                marginBottom: '20px',
                textAlign: 'center',
                boxShadow: '0 4px 0 rgba(0,0,0,0.05)'
              }}>
                Hãy vẽ: "{vongData.noiDungNhan}"
              </div>

              {/* Bảng vẽ Canvas */}
              <div style={{
                border: '5px solid #2c3e50',
                borderRadius: '24px',
                overflow: 'hidden',
                boxShadow: '0 8px 0 #2c3e50',
                background: 'white',
                width: '550px',
                height: '380px'
              }}>
                <canvas ref={canvasRef} />
              </div>

              {/* Toolbar màu & Cỡ bút vẽ game */}
              <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginTop: '20px' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {['#ff6b81', '#ff4757', '#ffa502', '#ffd32a', '#2bcbba', '#70a1ff', '#2f3542'].map(color => (
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
                
                <input 
                  type="range" 
                  min="4" 
                  max="20" 
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  style={{ width: '80px', cursor: 'pointer' }}
                />

                <button onClick={handleNopBai} className="btn-bubble btn-pink" style={{ padding: '8px 20px', fontSize: '0.9rem', boxShadow: '0 3px 0 #d63031' }}>
                  <Send size={16} />
                  Nộp bài vẽ
                </button>
              </div>
            </div>
          )}

          {/* LƯỢT 2: ĐOÁN CHỮ TỪ HÌNH VẼ NHẬN ĐƯỢC */}
          {vongData.loaiLuotChoi === 'DoanChu' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '16px' }}>
                Xem tranh và đoán xem bạn đã vẽ gì nào:
              </div>

              {/* Tranh vẽ của bạn */}
              <div style={{
                border: '4px solid #2c3e50',
                borderRadius: '20px',
                background: '#f8fafc',
                padding: '10px',
                marginBottom: '20px',
                boxShadow: '0 6px 0 rgba(0,0,0,0.05)'
              }}>
                <img src={vongData.noiDungNhan} alt="Tranh của bạn vẽ" style={{ width: '380px', height: '260px', objectFit: 'contain' }} />
              </div>

              {/* Nhập từ đoán */}
              <div style={{ display: 'flex', gap: '8px', width: '100%', maxWidth: '400px' }}>
                <input 
                  type="text" 
                  placeholder="Nhập phỏng đoán của bạn vào đây..."
                  value={doanChuInput}
                  onChange={(e) => setDoanChuInput(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: '2px solid #2c3e50',
                    outline: 'none',
                    fontFamily: 'var(--font-kids)',
                    fontSize: '1rem'
                  }}
                />
                <button onClick={handleNopBai} className="btn-bubble btn-pink" style={{ padding: '12px 20px', fontSize: '0.9rem', boxShadow: '0 3px 0 #d63031' }}>
                  <Send size={16} />
                  Gửi đoán
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. MÀN HÌNH CHỜ NGƯỜI CHƠI KHÁC NỘP BÀI (WAITING NEXT) */}
      {gameState === 'waiting_next' && (
        <div className="bubble-card" style={{ background: 'white', padding: '40px', border: '3px solid #2c3e50', textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: '15px' }}>⏳</div>
          <h2 className="title-kids">Đợi một chút nha!</h2>
          <p style={{ fontSize: '1.2rem', fontWeight: '600', color: '#64748b', marginBottom: '20px' }}>
            Bạn đã nộp bài thành công. Hãy cùng chờ những người bạn khác hoàn thành nhé!
          </p>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: '#f1f5f9',
            border: '2px solid #2c3e50',
            borderRadius: '99px',
            padding: '8px 20px',
            fontWeight: 'bold',
            fontSize: '0.95rem'
          }}>
            <span>Số người chơi đã nộp: {soNguoiDaNop} / {roomPlayers.length}</span>
          </div>
        </div>
      )}

      {/* 4. MÀN HÌNH TỔNG KẾT GAME (FINISHED) */}
      {gameState === 'finished' && gameResultChain.length > 0 && (
        <div className="bubble-card" style={{ background: 'white', padding: '24px', border: '3px solid #2c3e50', textAlign: 'center' }}>
          <h2 className="title-kids">Chuỗi Kết Quả Game Hài Hước!</h2>

          <div style={{
            border: '3px solid #2c3e50',
            borderRadius: '24px',
            padding: '24px',
            background: '#f8fafc',
            maxWidth: '500px',
            margin: '20px auto',
            minHeight: '340px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            boxShadow: '0 6px 0 #2c3e50'
          }}>
            <div style={{
              background: 'var(--color-sun)',
              color: '#2c3e50',
              border: '1.5px solid #2c3e50',
              borderRadius: '8px',
              padding: '2px 10px',
              fontSize: '0.8rem',
              fontWeight: 'bold',
              marginBottom: '10px'
            }}>
              LƯỢT CỦA: {gameResultChain[currentChainIdx].nguoi}
            </div>

            {gameResultChain[currentChainIdx].kieu === 'chu' ? (
              <div style={{
                fontSize: '2rem',
                fontWeight: 'bold',
                color: 'var(--color-primary)',
                textAlign: 'center',
                lineHeight: '1.4'
              }}>
                "{gameResultChain[currentChainIdx].noiDung}"
              </div>
            ) : (
              <img src={gameResultChain[currentChainIdx].noiDung} alt="Kết quả vẽ" style={{ maxWidth: '100%', maxHeight: '240px', objectFit: 'contain' }} />
            )}
          </div>

          {/* Nút lật trang xem tiếp */}
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '20px' }}>
            <button 
              disabled={currentChainIdx === 0}
              onClick={() => setCurrentChainIdx(currentChainIdx - 1)}
              style={{
                background: 'white',
                border: '2px solid #2c3e50',
                borderRadius: '12px',
                padding: '8px 16px',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontFamily: 'var(--font-kids)'
              }}>
              Quay lại
            </button>

            {currentChainIdx < gameResultChain.length - 1 ? (
              <button 
                onClick={() => setCurrentChainIdx(currentChainIdx + 1)}
                className="btn-bubble btn-pink"
                style={{ padding: '8px 24px', fontSize: '0.9rem', boxShadow: '0 3px 0 #d63031' }}>
                Xem tiếp
                <ArrowRight size={16} />
              </button>
            ) : (
              <button 
                onClick={onClose}
                className="btn-bubble btn-green"
                style={{ padding: '8px 24px', fontSize: '0.9rem', boxShadow: '0 3px 0 #00b894' }}>
                Về Trang chủ
              </button>
            )}
          </div>
        </div>
      )}

      {onClose && gameState === 'lobby' && (
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
          Thoát phòng
        </button>
      )}
    </div>
  );
};
