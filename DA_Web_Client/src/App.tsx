import { useState, useEffect } from 'react';
import * as signalR from '@microsoft/signalr';
import { SidebarPhai } from './components/GiaoDienChung/SidebarPhai';
import { TrangChu } from './components/TrangChu/TrangChu';
import { BangVe } from './components/BangVe/BangVe';
import { BaiTapHocVe } from './components/HocVe/BaiTapHocVe';
import { TroChoiTamSaoThatBan } from './components/TroChoi/TroChoiTamSaoThatBan';
import { Palette, LogOut, User, Lock, ShieldCheck, KeyRound, Sparkles, ArrowLeft } from 'lucide-react';
import axios from 'axios';

import { BACKEND_URL } from './config';

interface RoomPlayer {
  userId: number;
  tenHienThi: string;
  anhDaiDienUrl: string;
  sanSang: boolean;
  isChuPhong?: boolean;
}

function App() {
  const [activeTab, setActiveTab] = useState<'Home' | 'BangVe' | 'BaiTap' | 'Game'>('Home');
  const [user, setUser] = useState<{
    id: number;
    tenHienThi: string;
    anhDaiDienUrl: string;
    tongDiem: number;
    capDoHienTai: number;
  } | null>(null);

  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Trạng thái cho màn hình xác thực
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');

  const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
  const [dangVeId, setDangVeId] = useState<number | undefined>(undefined);
  const [gameRoomCode, setGameRoomCode] = useState<string | undefined>(undefined);
  const [currentRoomCode, setCurrentRoomCode] = useState<string | undefined>(undefined);
  const [matchType, setMatchType] = useState<'GhepNgauNhien' | 'VeCungBan' | 'TroChoiMini'>('TroChoiMini');
  const [autoStartGameRoom, setAutoStartGameRoom] = useState(false);
  const [currentRoomType, setCurrentRoomType] = useState<'GhepNgauNhien' | 'VeCungBan' | 'TroChoiMini' | null>(null);
  const [currentRoomPlayers, setCurrentRoomPlayers] = useState<RoomPlayer[]>([]);
  const [currentRoomStatus, setCurrentRoomStatus] = useState<'DangCho' | 'DangChoi' | null>(null);

  // States lifted for BaiTapHocVe to prevent state loss on tab change
  const [selectedChuDe, setSelectedChuDe] = useState<any>(null);
  const [selectedBaiHoc, setSelectedBaiHoc] = useState<any>(null);
  const [steps, setSteps] = useState<any[]>([]);
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);
  const [savedDrawingData, setSavedDrawingData] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<any>(null);

  const [notifications, setNotifications] = useState<{
    id: string;
    type: 'game' | 'draw';
    senderName: string;
    roomCode?: string;
    banVeId?: number;
    tieuDeBanVe?: string;
  }[]>([]);

  const SERVER_URL = BACKEND_URL; // Cần trùng cổng của Backend

  // Tự động đăng nhập tài khoản Bo hoặc Na để demo dễ dàng
  useEffect(() => {
    if (isLoggedIn && user) {
      // Khởi tạo kết nối SignalR
      const newConnection = new signalR.HubConnectionBuilder()
        .withUrl(`${SERVER_URL}/gamehub`)
        .withAutomaticReconnect()
        .build();

      newConnection.start()
        .then(() => {
          console.log("Đã kết nối thành công tới SignalR Hub!");
          setConnection(newConnection);
          
          // Đăng ký người dùng online
          newConnection.invoke('KetNoi', user.id).catch(err => console.error(err));

          // Lắng nghe lời mời vào phòng game
          newConnection.on('NhanLoiMoiVaoPhong', (data: { nguoiMoiId: number, tenNguoiMoi: string, maPhong: string }) => {
            const id = `invite_${Date.now()}`;
            setNotifications(prev => [...prev, {
              id,
              type: 'game',
              senderName: data.tenNguoiMoi,
              roomCode: data.maPhong
            }]);
            setTimeout(() => {
              setNotifications(prev => prev.filter(n => n.id !== id));
            }, 15000);
          });

          // Lắng nghe lời mời vẽ chung
          newConnection.on('NhanLoiMoiVeChung', (data: { nguoiMoiId: number, tenNguoiMoi: string, banVeId: number, tieuDeBanVe: string }) => {
            const id = `invite_${Date.now()}`;
            setNotifications(prev => [...prev, {
              id,
              type: 'draw',
              senderName: data.tenNguoiMoi,
              banVeId: data.banVeId,
              tieuDeBanVe: data.tieuDeBanVe
            }]);
            setTimeout(() => {
              setNotifications(prev => prev.filter(n => n.id !== id));
            }, 15000);
          });

          // Lắng nghe bắt đầu vẽ chung (VeCungBan)
          newConnection.on('BatDauVeChung', (maPhong: string) => {
            console.log("Nhận sự kiện BatDauVeChung, mã phòng:", maPhong);
            setGameRoomCode(maPhong);
            setCurrentRoomType('VeCungBan');
            setCurrentRoomStatus('DangChoi');
            setDangVeId(undefined);
            setActiveTab('BangVe');
          });

          // Lắng nghe tạo phòng
          newConnection.on('RoomCreated', (data: any) => {
            console.log("Nhận sự kiện RoomCreated:", data);
            setCurrentRoomType(data.loaiPhong);
            setGameRoomCode(data.maPhong);
            setCurrentRoomStatus(data.trangThai);
          });

          // Lắng nghe vào phòng
          newConnection.on('RoomJoined', (data: any) => {
            console.log("Nhận sự kiện RoomJoined:", data);
            setCurrentRoomType(data.loaiPhong);
            setGameRoomCode(data.maPhong);
            setCurrentRoomStatus(data.trangThai);
          });

          // Lắng nghe cập nhật danh sách người chơi trong phòng
          newConnection.on('CapNhatPhong', (roomCode: string, players: RoomPlayer[]) => {
            console.log("Nhận sự kiện CapNhatPhong:", roomCode, players);
            setGameRoomCode(roomCode);
            setCurrentRoomPlayers(players);
          });

          // Lắng nghe người chơi khác thoát phòng
          newConnection.on('NguoiChoiThoatPhong', (leftUserId: number) => {
            console.log("Nhận sự kiện NguoiChoiThoatPhong:", leftUserId);
            setCurrentRoomPlayers(prev => prev.filter(p => p.userId !== leftUserId));
          });

          // Lắng nghe bị chủ phòng kick
          newConnection.on('BiKickKhoiPhong', () => {
            console.log("Nhận sự kiện BiKickKhoiPhong");
            setGameRoomCode(undefined);
            setCurrentRoomPlayers([]);
            setCurrentRoomType(null);
            setCurrentRoomStatus(null);
            setActiveTab('Home');
          });

          // Lắng nghe phòng bị hủy dọc đường (mất kết nối)
          newConnection.on('GameBiHuyDocDuong', (_uId: number, message: string) => {
            console.log("Nhận sự kiện GameBiHuyDocDuong:", message);
            alert(message);
            setGameRoomCode(undefined);
            setCurrentRoomPlayers([]);
            setCurrentRoomType(null);
            setCurrentRoomStatus(null);
            setActiveTab('Home');
          });
        })
        .catch(err => console.error("Lỗi kết nối SignalR Hub:", err));

      return () => {
        if (newConnection) {
          newConnection.off('NhanLoiMoiVaoPhong');
          newConnection.off('NhanLoiMoiVeChung');
          newConnection.off('BatDauVeChung');
          newConnection.off('RoomCreated');
          newConnection.off('RoomJoined');
          newConnection.off('CapNhatPhong');
          newConnection.off('NguoiChoiThoatPhong');
          newConnection.off('BiKickKhoiPhong');
          newConnection.off('GameBiHuyDocDuong');
          newConnection.stop();
        }
      };
    }
  }, [isLoggedIn, user?.id]);

  // Quản lý việc thoát phòng khi gameRoomCode thay đổi hoặc bị xóa
  useEffect(() => {
    if (currentRoomCode && currentRoomCode !== gameRoomCode && connection && user) {
      connection.invoke('ThoatPhong', currentRoomCode, user.id)
        .catch(err => console.error("Lỗi tự động thoát phòng cũ:", err));
      if (!gameRoomCode) {
        setCurrentRoomPlayers([]);
        setCurrentRoomType(null);
        setCurrentRoomStatus(null);
      }
    }
    setCurrentRoomCode(gameRoomCode);
  }, [gameRoomCode, connection, user?.id]);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!usernameInput.trim() || !passwordInput.trim()) {
      alert("Bạn hãy nhập đầy đủ tên tài khoản và mật khẩu nhé!");
      return;
    }
    try {
      const res = await axios.post(`${SERVER_URL}/api/authentication/login`, {
        tenDangNhap: usernameInput.trim(),
        matKhau: passwordInput
      });
      setUser(res.data.user);
      setIsLoggedIn(true);
      setActiveTab('Home');
      // Reset inputs
      setUsernameInput('');
      setPasswordInput('');
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.message || "Tên đăng nhập hoặc mật khẩu không chính xác!";
      alert(msg);
    }
  };

  const handleRegister = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!usernameInput.trim() || !passwordInput.trim() || !confirmPasswordInput.trim()) {
      alert("Bạn hãy điền đầy đủ các thông tin đăng ký nhé!");
      return;
    }
    if (passwordInput !== confirmPasswordInput) {
      alert("Mật khẩu xác nhận không khớp, bạn kiểm tra lại nha!");
      return;
    }
    try {
      // Chọn ngẫu nhiên hoặc gán ảnh đại diện cute
      const isBebo = usernameInput.toLowerCase().includes("bo");
      const defaultAvatar = isBebo ? "/assets/avatars/avatar_bo.png" : "/assets/avatars/avatar_na.png";
      const defaultDisplayName = isBebo ? "Bạn Bo" : usernameInput;

      await axios.post(`${SERVER_URL}/api/authentication/register`, {
        tenDangNhap: usernameInput.trim(),
        matKhau: passwordInput,
        tenHienThi: defaultDisplayName,
        anhDaiDienUrl: defaultAvatar
      });

      alert("Tạo tài khoản thành công! Hệ thống đã điền sẵn thông tin. Bạn chỉ cần bấm Đăng nhập là xong nhé!");
      setAuthMode('login');
      setConfirmPasswordInput('');
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.message || "Tên đăng nhập đã tồn tại hoặc có lỗi xảy ra!";
      alert(msg);
    }
  };

  const handleForgotPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!usernameInput.trim() || !newPasswordInput.trim()) {
      alert("Bạn hãy điền tên tài khoản và mật khẩu mới nhé!");
      return;
    }
    try {
      await axios.post(`${SERVER_URL}/api/authentication/forgot-password`, {
        tenDangNhap: usernameInput.trim(),
        matKhauMoi: newPasswordInput
      });

      alert("Đặt lại mật khẩu mới thành công! Bây giờ bạn hãy đăng nhập bằng mật khẩu mới nhé.");
      setAuthMode('login');
      setPasswordInput('');
      setNewPasswordInput('');
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.message || "Không tìm thấy tài khoản hoặc có lỗi xảy ra!";
      alert(msg);
    }
  };

  // Cập nhật điểm và cấp độ hiển thị thời gian thực sau khi vẽ xong bài học
  const handleUserUpdate = (newPoints: number, newLevel: number) => {
    if (user) {
      setUser({
        ...user,
        tongDiem: newPoints,
        capDoHienTai: newLevel
      });
    }
  };

  const handleStartMatching = (loaiPhong: 'GhepNgauNhien' | 'VeCungBan') => {
    // Chuyển sang tab Game và kích hoạt ghép phòng
    setMatchType(loaiPhong);
    setAutoStartGameRoom(true);
    setActiveTab('Game');
    setGameRoomCode(undefined); // Để TroChoi tự sinh hoặc ghép phòng
  };

  const handleJoinRoomById = (maPhong: string) => {
    setGameRoomCode(maPhong);
    setAutoStartGameRoom(false);
    setActiveTab('Game');
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUser(null);
    setGameRoomCode(undefined);
    setCurrentRoomType(null);
    setCurrentRoomPlayers([]);
    setCurrentRoomStatus(null);
    if (connection) {
      connection.stop();
      setConnection(null);
    }
  };

  // ======================= MÀN HÌNH ĐĂNG NHẬP / ĐĂNG KÝ / QUÊN MẬT KHẨU =======================
  if (!isLoggedIn || !user) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--bg-sky)',
        padding: '20px',
        textAlign: 'center'
      }}>
        <div className="bubble-card" style={{
          background: 'white',
          width: '100%',
          maxWidth: '440px',
          border: '4px solid #2c3e50',
          padding: '30px 40px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch'
        }}>
          <div className="animate-bounce-slow" style={{ fontSize: '4.5rem', marginBottom: '10px' }}>🎨</div>
          <h1 className="title-kids" style={{ fontSize: '2.5rem', marginBottom: '8px' }}>Draw with me</h1>
          
          {/* Form Header / Subtitle */}
          {authMode === 'login' && (
            <p style={{ fontWeight: 'bold', color: '#64748b', marginBottom: '24px' }}>
              Chào mừng bạn! Bạn hãy đăng nhập để bắt đầu vẽ nhé!
            </p>
          )}
          {authMode === 'register' && (
            <p style={{ fontWeight: 'bold', color: '#64748b', marginBottom: '24px' }}>
              Tạo tài khoản mới cực kỳ dễ dàng để học vẽ cùng bạn bè!
            </p>
          )}
          {authMode === 'forgot' && (
            <p style={{ fontWeight: 'bold', color: '#64748b', marginBottom: '24px' }}>
              Quên mật khẩu? Bạn hãy nhập tên tài khoản và mật khẩu mới để đổi nhé!
            </p>
          )}

          {/* Form Fields */}
          {authMode === 'login' && (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
              <div>
                <label style={{ fontWeight: 'bold', color: '#2c3e50', display: 'block', marginBottom: '6px', fontSize: '0.95rem' }}>
                  👤 Tên tài khoản:
                </label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="text" 
                    placeholder="Nhập tên tài khoản..." 
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px 12px 42px',
                      borderRadius: '16px',
                      border: '3px solid #2c3e50',
                      outline: 'none',
                      fontFamily: 'var(--font-kids)',
                      fontSize: '1rem',
                      fontWeight: '600'
                    }}
                  />
                  <User size={18} style={{ position: 'absolute', left: '16px', top: '15px', color: '#64748b' }} />
                </div>
              </div>

              <div>
                <label style={{ fontWeight: 'bold', color: '#2c3e50', display: 'block', marginBottom: '6px', fontSize: '0.95rem' }}>
                  🔒 Mật khẩu:
                </label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="password" 
                    placeholder="Nhập mật khẩu..." 
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px 12px 42px',
                      borderRadius: '16px',
                      border: '3px solid #2c3e50',
                      outline: 'none',
                      fontFamily: 'var(--font-kids)',
                      fontSize: '1rem',
                      fontWeight: '600'
                    }}
                  />
                  <Lock size={18} style={{ position: 'absolute', left: '16px', top: '15px', color: '#64748b' }} />
                </div>
              </div>

              <button 
                type="submit"
                className="btn-bubble btn-pink hover-bounce"
                style={{ padding: '14px', justifyContent: 'center', fontSize: '1.15rem', marginTop: '10px' }}>
                <Sparkles size={20} /> ĐĂNG NHẬP
              </button>
            </form>
          )}

          {authMode === 'register' && (
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
              <div>
                <label style={{ fontWeight: 'bold', color: '#2c3e50', display: 'block', marginBottom: '6px', fontSize: '0.95rem' }}>
                  👤 Tên tài khoản:
                </label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="text" 
                    placeholder="Nhập tên tài khoản..." 
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px 12px 42px',
                      borderRadius: '16px',
                      border: '3px solid #2c3e50',
                      outline: 'none',
                      fontFamily: 'var(--font-kids)',
                      fontSize: '1rem',
                      fontWeight: '600'
                    }}
                  />
                  <User size={18} style={{ position: 'absolute', left: '16px', top: '15px', color: '#64748b' }} />
                </div>
              </div>

              <div>
                <label style={{ fontWeight: 'bold', color: '#2c3e50', display: 'block', marginBottom: '6px', fontSize: '0.95rem' }}>
                  🔒 Mật khẩu:
                </label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="password" 
                    placeholder="Nhập mật khẩu..." 
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px 12px 42px',
                      borderRadius: '16px',
                      border: '3px solid #2c3e50',
                      outline: 'none',
                      fontFamily: 'var(--font-kids)',
                      fontSize: '1rem',
                      fontWeight: '600'
                    }}
                  />
                  <Lock size={18} style={{ position: 'absolute', left: '16px', top: '15px', color: '#64748b' }} />
                </div>
              </div>

              <div>
                <label style={{ fontWeight: 'bold', color: '#2c3e50', display: 'block', marginBottom: '6px', fontSize: '0.95rem' }}>
                  🛡️ Xác nhận mật khẩu:
                </label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="password" 
                    placeholder="Nhập lại mật khẩu..." 
                    value={confirmPasswordInput}
                    onChange={(e) => setConfirmPasswordInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px 12px 42px',
                      borderRadius: '16px',
                      border: '3px solid #2c3e50',
                      outline: 'none',
                      fontFamily: 'var(--font-kids)',
                      fontSize: '1rem',
                      fontWeight: '600'
                    }}
                  />
                  <ShieldCheck size={18} style={{ position: 'absolute', left: '16px', top: '15px', color: '#64748b' }} />
                </div>
              </div>

              <button 
                type="submit"
                className="btn-bubble btn-green hover-bounce"
                style={{ padding: '14px', justifyContent: 'center', fontSize: '1.15rem', marginTop: '10px' }}>
                🌟 TẠO TÀI KHOẢN
              </button>
            </form>
          )}

          {authMode === 'forgot' && (
            <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
              <div>
                <label style={{ fontWeight: 'bold', color: '#2c3e50', display: 'block', marginBottom: '6px', fontSize: '0.95rem' }}>
                  👤 Tên tài khoản:
                </label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="text" 
                    placeholder="Nhập tên tài khoản của bạn..." 
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px 12px 42px',
                      borderRadius: '16px',
                      border: '3px solid #2c3e50',
                      outline: 'none',
                      fontFamily: 'var(--font-kids)',
                      fontSize: '1rem',
                      fontWeight: '600'
                    }}
                  />
                  <User size={18} style={{ position: 'absolute', left: '16px', top: '15px', color: '#64748b' }} />
                </div>
              </div>

              <div>
                <label style={{ fontWeight: 'bold', color: '#2c3e50', display: 'block', marginBottom: '6px', fontSize: '0.95rem' }}>
                  🔑 Mật khẩu mới:
                </label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="password" 
                    placeholder="Nhập mật khẩu mới..." 
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px 12px 42px',
                      borderRadius: '16px',
                      border: '3px solid #2c3e50',
                      outline: 'none',
                      fontFamily: 'var(--font-kids)',
                      fontSize: '1rem',
                      fontWeight: '600'
                    }}
                  />
                  <KeyRound size={18} style={{ position: 'absolute', left: '16px', top: '15px', color: '#64748b' }} />
                </div>
              </div>

              <button 
                type="submit"
                className="btn-bubble btn-yellow hover-bounce"
                style={{ padding: '14px', justifyContent: 'center', fontSize: '1.15rem', marginTop: '10px' }}>
                🔄 ĐỔI MẬT KHẨU
              </button>
            </form>
          )}

          {/* Bottom links for navigation between modes */}
          <div style={{
            marginTop: '24px',
            paddingTop: '16px',
            borderTop: '2px dashed #cbd5e1',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            fontSize: '0.9rem',
            fontWeight: 'bold',
            color: '#475569'
          }}>
            {authMode === 'login' && (
              <>
                <span 
                  onClick={() => {
                    setAuthMode('forgot');
                    setPasswordInput('');
                    setNewPasswordInput('');
                  }}
                  style={{ color: '#ff6b81', cursor: 'pointer', textDecoration: 'underline' }}>
                  🔑 Quên mật khẩu?
                </span>
                <span 
                  onClick={() => {
                    setAuthMode('register');
                    setUsernameInput('');
                    setPasswordInput('');
                    setConfirmPasswordInput('');
                  }}
                  style={{ color: '#0984e3', cursor: 'pointer', textDecoration: 'underline' }}>
                  👶 Chưa có tài khoản? Đăng ký ngay!
                </span>
              </>
            )}

            {authMode === 'register' && (
              <span 
                onClick={() => {
                  setAuthMode('login');
                  setUsernameInput('');
                  setPasswordInput('');
                }}
                style={{ color: '#0984e3', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <ArrowLeft size={16} /> Quay lại Đăng nhập
              </span>
            )}

            {authMode === 'forgot' && (
              <span 
                onClick={() => {
                  setAuthMode('login');
                  setUsernameInput('');
                  setPasswordInput('');
                }}
                style={{ color: '#0984e3', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <ArrowLeft size={16} /> Quay lại Đăng nhập
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  const renderFloatingCollabWidget = () => {
    // Chỉ hiển thị khi có phòng hoạt động và người dùng đã trong phòng
    if (!gameRoomCode || !currentRoomType) return null;

    // Không hiển thị widget khi đang ở tab Game vì giao diện game/phòng chờ đã có sẵn thông tin
    if (activeTab === 'Game') return null;

    const otherPlayers = currentRoomPlayers.filter(p => p.userId !== user?.id);
    if (otherPlayers.length === 0) return null;

    // Dynamic title based on room type
    const titleText = currentRoomType === 'VeCungBan' 
      ? '🎨 Vẽ cùng bạn bè' 
      : currentRoomType === 'GhepNgauNhien' 
        ? '🎮 Ghép ngẫu nhiên' 
        : '🧩 Phòng game';

    return (
      <div style={{
        position: 'fixed',
        bottom: '20px',
        left: '20px',
        zIndex: 9999,
        fontFamily: 'var(--font-kids)',
        pointerEvents: 'auto'
      }}>
        <div className="bubble-card" style={{
          padding: '16px 20px',
          background: 'white',
          border: '4px solid #2c3e50',
          boxShadow: '0 8px 0 #2c3e50, 0 10px 25px rgba(0,0,0,0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          minWidth: '280px',
          transition: 'all 0.3s ease'
        }}>
          {/* Header row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '2px dashed #cbd5e1',
            paddingBottom: '8px'
          }}>
            <span style={{ fontWeight: 'bold', fontSize: '1rem', color: '#2c3e50', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {titleText}
            </span>
            <span style={{
              background: '#e2e8f0',
              padding: '2px 8px',
              borderRadius: '8px',
              fontSize: '0.75rem',
              fontWeight: 'bold',
              color: '#475569'
            }}>
              Phòng: {gameRoomCode}
            </span>
          </div>

          {/* User info row - Scrollable player list */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            maxHeight: '150px',
            overflowY: 'auto',
            paddingRight: '4px'
          }}>
            {otherPlayers.map(p => (
              <div key={p.userId} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: '#f8fafc',
                padding: '6px 12px',
                borderRadius: '12px',
                border: '2px solid #e2e8f0'
              }}>
                <img
                  src={p.anhDaiDienUrl || '/assets/avatars/avatar_bo.png'}
                  alt={p.tenHienThi}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    border: '2px solid #2c3e50'
                  }}
                />
                <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#2c3e50' }}>
                  {p.tenHienThi}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#22c55e', fontWeight: 'bold' }}>
                  🟢 Online
                </span>
              </div>
            ))}
          </div>

          {/* Actions row */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            {activeTab !== 'BangVe' && (
              <button
                onClick={() => {
                  if (currentRoomType === 'VeCungBan' && currentRoomStatus === 'DangChoi') {
                    setActiveTab('BangVe');
                  } else {
                    setActiveTab('Game');
                  }
                }}
                className="btn-bubble btn-green hover-bounce"
                style={{
                  flex: 1,
                  padding: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  justifyContent: 'center',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                {currentRoomType === 'VeCungBan' && currentRoomStatus === 'DangChoi' ? 'Quay lại vẽ' : 'Quay lại phòng'}
              </button>
            )}
            <button
              onClick={() => {
                if (window.confirm("Bạn có chắc chắn muốn rời phòng game/vẽ không?")) {
                  setGameRoomCode(undefined);
                  setCurrentRoomPlayers([]);
                  setCurrentRoomType(null);
                  setCurrentRoomStatus(null);
                  setActiveTab('Home');
                }
              }}
              className="btn-bubble btn-pink hover-bounce"
              style={{
                flex: activeTab === 'BangVe' ? 1 : 'none',
                padding: '8px 12px',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                justifyContent: 'center',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              Rời phòng
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ======================= GIAO DIỆN CHÍNH SAU KHI ĐĂNG NHẬP =======================
  return (
    <div className="app-container">
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(120%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>

      {/* Khung thông báo lời mời nổi (Toasts) */}
      <div style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        pointerEvents: 'none'
      }}>
        {notifications.map(notif => (
          <div key={notif.id} style={{
            pointerEvents: 'auto',
            background: 'white',
            border: '3px solid #2c3e50',
            borderRadius: '20px',
            padding: '16px',
            width: '320px',
            boxShadow: '0 8px 0 #2c3e50, 0 10px 25px rgba(0,0,0,0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            animation: 'slideIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
            fontFamily: 'var(--font-kids)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', fontSize: '1.1rem', color: '#2c3e50' }}>
              {notif.type === 'game' ? '🎮 Lời Mời Chơi Game' : '🎨 Lời Mời Vẽ Chung'}
            </div>
            
            <div style={{ fontSize: '0.9rem', color: '#475569', lineHeight: '1.4', textAlign: 'left' }}>
              {notif.type === 'game' ? (
                <span>Bé <strong>{notif.senderName}</strong> vừa mời bạn tham gia phòng chơi của họ!</span>
              ) : (
                <span>Bé <strong>{notif.senderName}</strong> muốn cùng bạn vẽ bức tranh <strong>"{notif.tieuDeBanVe}"</strong>!</span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button
                onClick={() => {
                  if (notif.type === 'game' && notif.roomCode) {
                    setGameRoomCode(notif.roomCode);
                    setMatchType('VeCungBan');
                    setAutoStartGameRoom(true);
                    setActiveTab('Game');
                  } else if (notif.type === 'draw' && notif.banVeId) {
                    setDangVeId(notif.banVeId);
                    setActiveTab('BangVe');
                  }
                  setNotifications(prev => prev.filter(n => n.id !== notif.id));
                }}
                style={{
                  flex: 1,
                  background: '#2ed573',
                  color: 'white',
                  border: '2px solid #2c3e50',
                  borderRadius: '12px',
                  padding: '8px',
                  fontWeight: 'bold',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  boxShadow: '0 3px 0 #218c4e',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}
              >
                Đồng ý
              </button>
              <button
                onClick={() => {
                  setNotifications(prev => prev.filter(n => n.id !== notif.id));
                }}
                style={{
                  flex: 1,
                  background: '#ff4757',
                  color: 'white',
                  border: '2px solid #2c3e50',
                  borderRadius: '12px',
                  padding: '8px',
                  fontWeight: 'bold',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  boxShadow: '0 3px 0 #a31d27',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}
              >
                Bỏ qua
              </button>
            </div>
          </div>
        ))}
      </div>
      
      {/* Sidebar bên phải hiển thị Bạn bè và Bảng xếp hạng */}
      <SidebarPhai 
        userId={user.id} 
        connection={connection} 
        dangVeId={dangVeId}
        maPhong={gameRoomCode}
        onMoiVeChung={(banId, bveId) => {
          if (connection) {
            connection.invoke('MoiBanVeChung', user.id, banId, bveId)
              .then(() => alert("Đã gửi lời mời vẽ chung tới bạn!"))
              .catch(err => console.error(err));
          }
        }}
      />

      {/* Vùng nội dung chính */}
      <div className="main-content">
        
        {/* Header hoạt hình */}
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          maxWidth: '900px',
          background: 'white',
          border: '3px solid #2c3e50',
          borderRadius: '24px',
          padding: '12px 24px',
          marginBottom: '30px',
          boxShadow: '0 6px 0 rgba(44, 62, 80, 0.1)',
          position: 'sticky',
          top: '20px',
          zIndex: 90
        }}>
          {/* Logo */}
          <div 
            onClick={() => setActiveTab('Home')}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px', 
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '1.3rem',
              color: '#2c3e50'
            }}>
            <Palette size={28} style={{ color: 'var(--color-primary)' }} />
            <span style={{ fontFamily: 'var(--font-kids)', fontWeight: 'bold' }}>Draw with me</span>
          </div>

          {/* Menu Điều hướng */}
          <nav style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => setActiveTab('Home')}
              style={{
                background: activeTab === 'Home' ? 'var(--color-accent)' : 'none',
                border: activeTab === 'Home' ? '2px solid #2c3e50' : 'none',
                borderRadius: '12px',
                padding: '6px 12px',
                fontWeight: 'bold',
                fontFamily: 'var(--font-kids)',
                fontSize: '0.9rem',
                cursor: 'pointer',
                color: '#2c3e50'
              }}>
              Trang chủ
            </button>
            
            <button 
              onClick={() => {
                setActiveTab('BangVe');
                setDangVeId(999); // Giả lập ID bản vẽ hiện tại để bé mời bạn vẽ chung được
              }}
              style={{
                background: activeTab === 'BangVe' ? 'var(--color-accent)' : 'none',
                border: activeTab === 'BangVe' ? '2px solid #2c3e50' : 'none',
                borderRadius: '12px',
                padding: '6px 12px',
                fontWeight: 'bold',
                fontFamily: 'var(--font-kids)',
                fontSize: '0.9rem',
                cursor: 'pointer',
                color: '#2c3e50'
              }}>
              Bảng vẽ
            </button>

            <button 
              onClick={() => setActiveTab('BaiTap')}
              style={{
                background: activeTab === 'BaiTap' ? 'var(--color-accent)' : 'none',
                border: activeTab === 'BaiTap' ? '2px solid #2c3e50' : 'none',
                borderRadius: '12px',
                padding: '6px 12px',
                fontWeight: 'bold',
                fontFamily: 'var(--font-kids)',
                fontSize: '0.9rem',
                cursor: 'pointer',
                color: '#2c3e50'
              }}>
              Bài tập vẽ
            </button>

            <button 
              onClick={() => {
                setActiveTab('Game');
                setAutoStartGameRoom(false);
                if (!currentRoomType) {
                  setGameRoomCode(undefined);
                }
              }}
              style={{
                background: activeTab === 'Game' ? 'var(--color-accent)' : 'none',
                border: activeTab === 'Game' ? '2px solid #2c3e50' : 'none',
                borderRadius: '12px',
                padding: '6px 12px',
                fontWeight: 'bold',
                fontFamily: 'var(--font-kids)',
                fontSize: '0.9rem',
                cursor: 'pointer',
                color: '#2c3e50'
              }}>
              Trò chơi
            </button>
          </nav>

          {/* Đăng xuất */}
          <button 
            onClick={handleLogout}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontWeight: 'bold'
            }}
            title="Đăng xuất tài khoản">
            <LogOut size={18} />
          </button>
        </header>

        {/* Nội dung thay đổi theo Tab */}
        <div style={{ width: '100%', maxWidth: '900px' }}>
          {activeTab === 'Home' && (
            <TrangChu 
              user={user} 
              onStartMatching={handleStartMatching} 
              onJoinRoomById={handleJoinRoomById}
              onProfileUpdate={(updatedUser) => setUser(updatedUser)}
            />
          )}

          {activeTab === 'BangVe' && (
            <BangVe 
              userId={user.id} 
              connection={connection} 
              maPhongVect={gameRoomCode}
              banVeId={dangVeId} 
              onClose={() => {
                if (currentRoomType !== 'VeCungBan') {
                  setGameRoomCode(undefined);
                  setCurrentRoomStatus(null);
                }
                setActiveTab('Home');
              }} 
            />
          )}

          {activeTab === 'BaiTap' && (
            <BaiTapHocVe 
              userId={user.id} 
              onUserUpdate={handleUserUpdate} 
              onClose={() => setActiveTab('Home')} 
              selectedChuDe={selectedChuDe}
              setSelectedChuDe={setSelectedChuDe}
              selectedBaiHoc={selectedBaiHoc}
              setSelectedBaiHoc={setSelectedBaiHoc}
              steps={steps}
              setSteps={setSteps}
              currentStepIdx={currentStepIdx}
              setCurrentStepIdx={setCurrentStepIdx}
              savedDrawingData={savedDrawingData}
              setSavedDrawingData={setSavedDrawingData}
              aiResult={aiResult}
              setAiResult={setAiResult}
            />
          )}

          {activeTab === 'Game' && (
            <TroChoiTamSaoThatBan 
              userId={user.id} 
              tenHienThi={user.tenHienThi} 
              connection={connection} 
              maPhongInit={gameRoomCode}
              loaiPhong={autoStartGameRoom ? matchType : undefined}
              onRoomCodeChange={(code) => setGameRoomCode(code)}
              onClose={() => {
                setGameRoomCode(undefined);
                setActiveTab('Home');
              }} 
            />
          )}
        </div>
      </div>
      {renderFloatingCollabWidget()}
    </div>
  );
}

export default App;
