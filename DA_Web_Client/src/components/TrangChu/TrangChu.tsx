import React from 'react';
import { Gamepad2, Users2, ShieldAlert } from 'lucide-react';

interface TrangChuProps {
  user: {
    id: number;
    tenHienThi: string;
    anhDaiDienUrl: string;
    tongDiem: number;
    capDoHienTai: number;
  };
  onStartMatching: (loaiPhong: 'GhepNgauNhien' | 'VeCungBan') => void;
}

export const TrangChu: React.FC<TrangChuProps> = ({ user, onStartMatching }) => {
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
      <div className="bubble-card" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        marginBottom: '40px',
        padding: '12px 24px',
        borderRadius: '99px',
        background: 'white',
        border: '3px solid #2c3e50'
      }}>
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
            gap: '15px'
          }}>
          <Users2 size={28} />
          Ghép với bạn bè
        </button>
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
    </div>
  );
};
