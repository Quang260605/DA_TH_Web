import React, { useState } from 'react';
import { Gamepad2, Users2, ShieldAlert, X } from 'lucide-react';
import axios from 'axios';
import { BACKEND_URL } from '../../config';

const PRESET_AVATARS = [
  '/assets/avatars/avatar_bo.png',
  '/assets/avatars/avatar_na.png',
  '/assets/avatars/default.png',
  'https://img.icons8.com/color/96/unicorn.png',
  'https://img.icons8.com/color/96/dinosaur.png',
  'https://img.icons8.com/color/96/superman.png',
  'https://img.icons8.com/color/96/wonder-woman.png',
];

interface TrangChuProps {
  user: {
    id: number;
    tenHienThi: string;
    anhDaiDienUrl: string;
    tongDiem: number;
    capDoHienTai: number;
  };
  onStartMatching: (loaiPhong: 'GhepNgauNhien' | 'VeCungBan') => void;
  onJoinRoomById: (maPhong: string) => void;
  onProfileUpdate: (updatedUser: any) => void;
}

export const TrangChu: React.FC<TrangChuProps> = ({ user, onStartMatching, onJoinRoomById, onProfileUpdate }) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [nickname, setNickname] = useState(user.tenHienThi);
  const [avatarUrl, setAvatarUrl] = useState(user.anhDaiDienUrl);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) {
      alert("Biệt danh không được để trống đâu nhé!");
      return;
    }
    try {
      const res = await axios.post(`${BACKEND_URL}/api/authentication/update-profile`, {
        id: user.id,
        tenHienThi: nickname.trim(),
        anhDaiDienUrl: avatarUrl.trim()
      });
      
      onProfileUpdate(res.data.user);
      alert("Cập nhật thông tin tài khoản thành công! 🎉");
      setIsSettingsOpen(false);
    } catch (err: any) {
      console.error(err);
      alert("Có lỗi xảy ra khi cập nhật thông tin rồi. Bạn thử lại nhé!");
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      minHeight: '80vh',
      textAlign: 'center',
      padding: '20px'
    }}>
      {/* Khung profile của bạn */}
      <div 
        className="bubble-card hover-bounce" 
        onClick={() => {
          setNickname(user.tenHienThi);
          setAvatarUrl(user.anhDaiDienUrl);
          setIsSettingsOpen(true);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '15px',
          marginBottom: '40px',
          padding: '12px 24px',
          borderRadius: '99px',
          background: 'white',
          border: '3px solid #2c3e50',
          cursor: 'pointer'
        }}
        title="Bấm vào để cài đặt biệt danh và ảnh đại diện nhé!"
      >
        <img 
          src={user.anhDaiDienUrl} 
          alt={user.tenHienThi} 
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            border: '2px solid #2c3e50'
          }}
        />
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--color-primary)' }}>
            Chào {user.tenHienThi}!
          </div>
          <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 'bold' }}>
            Cấp độ: {user.capDoHienTai} • Điểm: {user.tongDiem}đ
          </div>
        </div>
      </div>

      {/* Logo lớn ở giữa màn hình */}
      <div className="animate-bounce-slow" style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginBottom: '50px'
      }}>
        <div style={{
          width: '180px',
          height: '180px',
          borderRadius: '50%',
          background: 'var(--color-sun)',
          border: '6px solid #2c3e50',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 12px 0 #2c3e50, 0 20px 30px rgba(0,0,0,0.15)',
          fontSize: '5rem',
          transform: 'rotate(-5deg)',
          userSelect: 'none'
        }}>
          🎨
        </div>
        <h1 className="title-kids" style={{
          marginTop: '30px',
          fontSize: '3.5rem',
          letterSpacing: '1px'
        }}>
          Draw with me
        </h1>
        <p style={{
          fontSize: '1.2rem',
          color: '#64748b',
          fontWeight: '600',
          maxWidth: '500px',
          lineHeight: '1.5',
          marginTop: '10px'
        }}>
          Thế giới sắc màu kỳ diệu! Nơi bạn học vẽ tranh siêu ngộ nghĩnh và kết nối với những người bạn đáng yêu!
        </p>
      </div>

      {/* 2 Nút ghép trận lớn bong bóng */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        width: '100%',
        maxWidth: '550px',
        justifyContent: 'center'
      }}>
        <button 
          onClick={() => onStartMatching('GhepNgauNhien')}
          className="btn-bubble btn-pink hover-bounce" 
          style={{
            padding: '20px 40px',
            fontSize: '1.3rem',
            width: '100%',
            justifyContent: 'center',
            gap: '15px'
          }}>
          <Gamepad2 size={28} />
          Ghép ngẫu nhiên
        </button>

        <button 
          onClick={() => onStartMatching('VeCungBan')}
          className="btn-bubble btn-blue hover-bounce" 
          style={{
            padding: '20px 40px',
            fontSize: '1.3rem',
            width: '100%',
            justifyContent: 'center',
            gap: '15px',
            marginBottom: '10px'
          }}>
          <Users2 size={28} />
          Ghép với bạn bè
        </button>

        {/* Tìm kiếm/Vào phòng bằng mã ID */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          width: '100%',
          marginTop: '10px',
          padding: '18px 24px',
          background: 'white',
          border: '3px solid #2c3e50',
          borderRadius: '24px',
          boxShadow: '0 6px 0 rgba(44, 62, 80, 0.1)',
          textAlign: 'left'
        }}>
          <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#2c3e50', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-kids)' }}>
            🔑 Vào phòng bằng mã ID
          </div>
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              const code = (e.currentTarget.elements.namedItem('roomCode') as HTMLInputElement).value.trim().toUpperCase();
              if (code) {
                onJoinRoomById(code);
              } else {
                alert("Bạn hãy nhập mã phòng nhé!");
              }
            }}
            style={{ display: 'flex', gap: '10px', width: '100%' }}
          >
            <input 
              name="roomCode"
              type="text" 
              placeholder="Nhập mã phòng (ví dụ: ABCDE)..." 
              maxLength={5}
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: '16px',
                border: '3px solid #2c3e50',
                outline: 'none',
                fontFamily: 'var(--font-kids)',
                fontSize: '1rem',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)'
              }}
            />
            <button
              type="submit"
              className="btn-bubble btn-green hover-bounce"
              style={{
                padding: '12px 24px',
                fontSize: '1rem',
                fontWeight: 'bold',
                whiteSpace: 'nowrap'
              }}
            >
              Vào phòng
            </button>
          </form>
        </div>
      </div>

      {/* Hướng dẫn an toàn */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginTop: '60px',
        color: '#94a3b8',
        fontSize: '0.9rem',
        fontWeight: '600'
      }}>
        <ShieldAlert size={18} />
        <span>Không gian sáng tạo lành mạnh và bảo mật an toàn cho bạn</span>
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(44, 62, 80, 0.6)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          fontFamily: 'var(--font-kids)'
        }}>
          <div className="bubble-card" style={{
            background: 'white',
            border: '4px solid #2c3e50',
            borderRadius: '28px',
            padding: '24px 30px',
            width: '100%',
            maxWidth: '460px',
            boxShadow: '0 12px 0 #2c3e50, 0 20px 40px rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            position: 'relative'
          }}>
            {/* Close button */}
            <button 
              type="button"
              onClick={() => setIsSettingsOpen(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: '#ff4757',
                color: 'white',
                border: '2px solid #2c3e50',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 3px 0 #2c3e50',
                fontWeight: 'bold',
                zIndex: 10
              }}>
              <X size={18} />
            </button>

            <h3 style={{
              margin: 0,
              fontSize: '1.6rem',
              fontWeight: 'bold',
              color: '#2c3e50',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}>
              ⚙️ Cài đặt tài khoản
            </h3>

            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontWeight: 'bold', color: '#2c3e50', display: 'block', marginBottom: '8px', textAlign: 'left' }}>
                  👤 Biệt danh của bé:
                </label>
                <input 
                  type="text" 
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Nhập biệt danh đáng yêu của bé..."
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '16px',
                    border: '3px solid #2c3e50',
                    outline: 'none',
                    fontSize: '1rem',
                    fontWeight: 'bold'
                  }}
                />
              </div>

              <div>
                <label style={{ fontWeight: 'bold', color: '#2c3e50', display: 'block', marginBottom: '8px', textAlign: 'left' }}>
                  🌟 Chọn ảnh đại diện:
                </label>
                
                {/* Preset Avatar Selection Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '10px',
                  marginBottom: '12px',
                  background: '#f8fafc',
                  padding: '12px',
                  borderRadius: '16px',
                  border: '2px solid #cbd5e1'
                }}>
                  {PRESET_AVATARS.map((preset) => {
                    const isSelected = avatarUrl === preset;
                    return (
                      <div 
                        key={preset}
                        onClick={() => setAvatarUrl(preset)}
                        style={{
                          position: 'relative',
                          cursor: 'pointer',
                          borderRadius: '50%',
                          border: isSelected ? '3px solid var(--color-primary)' : '3px solid transparent',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s ease',
                          transform: isSelected ? 'scale(1.1)' : 'none',
                          background: isSelected ? 'rgba(52, 152, 219, 0.1)' : 'none'
                        }}
                      >
                        <img 
                          src={preset} 
                          alt="preset avatar"
                          style={{
                            width: '46px',
                            height: '46px',
                            borderRadius: '50%',
                            border: '2px solid #2c3e50'
                          }}
                        />
                        {isSelected && (
                          <div style={{
                            position: 'absolute',
                            bottom: '-4px',
                            right: '-4px',
                            background: '#2ed573',
                            border: '2px solid #2c3e50',
                            borderRadius: '50%',
                            width: '16px',
                            height: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '10px'
                          }}>
                            ✓
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <label style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '6px', textAlign: 'left' }}>
                  Hoặc nhập liên kết ảnh riêng của bạn:
                </label>
                <input 
                  type="text" 
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="Nhập link ảnh https://..."
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    border: '3px solid #2c3e50',
                    outline: 'none',
                    fontSize: '0.9rem',
                    fontWeight: '600'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="submit"
                  className="btn-bubble btn-green hover-bounce"
                  style={{
                    flex: 1,
                    padding: '12px',
                    fontSize: '1.05rem',
                    fontWeight: 'bold',
                    justifyContent: 'center',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  Lưu cài đặt
                </button>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="btn-bubble btn-pink hover-bounce"
                  style={{
                    padding: '12px 20px',
                    fontSize: '1.05rem',
                    fontWeight: 'bold',
                    justifyContent: 'center',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
