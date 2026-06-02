import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../../config';
import { Users, Trophy, UserPlus, Search, Circle, Smile } from 'lucide-react';
import { HubConnection } from '@microsoft/signalr';

interface SidebarPhaiProps {
  userId: number;
  connection: HubConnection | null;
  onMoiVeChung?: (banId: number, banveId: number) => void;
  dangVeId?: number; // Nếu đang mở một bản vẽ thì có thể mời bạn vào vẽ chung
  maPhong?: string; // Mã phòng chơi game hiện tại
}

interface NguoiDungBasic {
  id: number;
  tenHienThi: string;
  anhDaiDienUrl: string;
  tongDiem: number;
  capDoHienTai: number;
  online?: boolean;
}

interface RankUser {
  rank: number;
  id: number;
  tenHienThi: string;
  anhDaiDienUrl: string;
  tongDiem: number;
  capDoHienTai: number;
}

export const SidebarPhai: React.FC<SidebarPhaiProps> = ({ userId, connection, onMoiVeChung, dangVeId, maPhong }) => {
  const [tab, setTab] = useState<'banbe' | 'bxh'>('banbe');
  const [bxhFilter, setBxhFilter] = useState<'toancau' | 'banbe'>('toancau');
  const [friends, setFriends] = useState<NguoiDungBasic[]>([]);
  const [leaderboard, setLeaderboard] = useState<RankUser[]>([]);
  
  // Tìm kiếm bạn bè
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NguoiDungBasic[]>([]);
  const [showSearch, setShowSearch] = useState(false);

  // Danh sách yêu cầu kết bạn
  const [friendRequests, setFriendRequests] = useState<any[]>([]);

  // Trạng thái cho menu tương tác nhanh (kết bạn, huỷ kết bạn, mời vẽ)
  const [menuUser, setMenuUser] = useState<{
    id: number;
    tenHienThi: string;
    isFriend: boolean;
    online?: boolean;
  } | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number, y: number } | null>(null);

  // Đóng menu khi click ra ngoài
  useEffect(() => {
    const handleCloseMenu = () => {
      setMenuUser(null);
      setMenuPosition(null);
    };
    window.addEventListener('click', handleCloseMenu);
    return () => {
      window.removeEventListener('click', handleCloseMenu);
    };
  }, []);

  const handleCardClick = (e: React.MouseEvent, targetUser: NguoiDungBasic | RankUser, isFriend: boolean) => {
    if (targetUser.id === userId) return; // Không hiển thị menu cho chính mình
    e.preventDefault();
    e.stopPropagation();

    if (menuUser && menuUser.id === targetUser.id) {
      setMenuUser(null);
      setMenuPosition(null);
      return;
    }

    // Tính toán tọa độ hiển thị đảm bảo không bị tràn màn hình
    let x = e.clientX;
    let y = e.clientY;
    if (x + 190 > window.innerWidth) {
      x = window.innerWidth - 195;
    }
    if (y + 150 > window.innerHeight) {
      y = window.innerHeight - 155;
    }

    setMenuUser({
      id: targetUser.id,
      tenHienThi: targetUser.tenHienThi,
      isFriend: isFriend,
      online: 'online' in targetUser ? targetUser.online : undefined
    });
    setMenuPosition({ x, y });
  };

  const handleRemoveFriend = async (targetId: number, targetName: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn hủy kết bạn với ${targetName}?`)) {
      return;
    }
    try {
      await axios.delete(`${API_URL}/social/remove-friend`, {
        data: {
          nguoiDungId1: userId,
          nguoiDungId2: targetId
        }
      });
      alert(`Đã hủy kết bạn với ${targetName}!`);
      setMenuUser(null);
      fetchFriends();
      fetchLeaderboard();
    } catch (err: any) {
      alert(err.response?.data?.message || "Lỗi hủy kết bạn");
    }
  };

  const fetchFriendRequests = async () => {
    try {
      const res = await axios.get(`${API_URL}/social/friend-requests/${userId}`);
      setFriendRequests(res.data);
    } catch (err) {
      console.error("Lỗi lấy danh sách lời mời kết bạn:", err);
    }
  };

  const handleAcceptFriendRequest = async (friendId: number) => {
    try {
      await axios.post(`${API_URL}/social/add-friend`, {
        nguoiDungId1: userId,
        nguoiDungId2: friendId
      });
      alert("Đã chấp nhận kết bạn!");
      fetchFriendRequests();
      fetchFriends();
      fetchLeaderboard();
      if (connection) {
        connection.invoke('KetNoi', userId).catch(err => console.error(err));
      }
    } catch (err: any) {
      alert(err.response?.data?.message || "Lỗi chấp nhận kết bạn");
    }
  };

  const handleDeclineFriendRequest = async (friendId: number) => {
    try {
      await axios.delete(`${API_URL}/social/remove-friend`, {
        data: {
          nguoiDungId1: userId,
          nguoiDungId2: friendId
        }
      });
      alert("Đã từ chối lời mời kết bạn.");
      fetchFriendRequests();
    } catch (err: any) {
      alert(err.response?.data?.message || "Lỗi từ chối kết bạn");
    }
  };

  useEffect(() => {
    fetchFriends();
    fetchLeaderboard();
    fetchFriendRequests();
  }, [userId, tab, bxhFilter]);

  // Lắng nghe SignalR thay đổi trạng thái online của bạn bè và các yêu cầu kết bạn
  useEffect(() => {
    if (!connection) return;

    connection.on('BanBeOnline', (banId: number) => {
      setFriends(prev => prev.map(f => f.id === banId ? { ...f, online: true } : f));
    });

    connection.on('BanBeOffline', (banId: number) => {
      setFriends(prev => prev.map(f => f.id === banId ? { ...f, online: false } : f));
    });

    connection.on('NhanYeuCauKetBan', (data: { senderId: number, senderName: string }) => {
      alert(`${data.senderName} đã gửi yêu cầu kết bạn với bạn!`);
      fetchFriendRequests();
    });

    connection.on('XacNhanDongYKetBan', (friendId: number) => {
      fetchFriends();
      fetchLeaderboard();
      fetchFriendRequests();
    });

    connection.on('BiXoaBan', (friendId: number) => {
      setFriends(prev => prev.filter(f => f.id !== friendId));
      fetchLeaderboard();
    });

    return () => {
      connection.off('BanBeOnline');
      connection.off('BanBeOffline');
      connection.off('NhanYeuCauKetBan');
      connection.off('XacNhanDongYKetBan');
      connection.off('BiXoaBan');
    };
  }, [connection]);

  const fetchFriends = async () => {
    try {
      const res = await axios.get(`${API_URL}/social/friends/${userId}`);
      // Mặc định ban đầu gán online = false, trạng thái thực tế sẽ do SignalR cập nhật hoặc ta giả lập ngẫu nhiên vài người online cho sinh động
      const friendsWithStatus = res.data.map((f: NguoiDungBasic) => ({
        ...f,
        online: f.id % 2 === 0 // Mock ngẫu nhiên trạng thái online ban đầu
      }));
      setFriends(friendsWithStatus);
    } catch (err) {
      console.error("Lỗi lấy danh sách bạn bè:", err);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const endpoint = bxhFilter === 'toancau' ? 'global' : `friends/${userId}`;
      const res = await axios.get(`${API_URL}/social/leaderboard/${endpoint}`);
      setLeaderboard(res.data);
    } catch (err) {
      console.error("Lỗi lấy bảng xếp hạng:", err);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    try {
      const res = await axios.get(`${API_URL}/social/search-users?query=${searchQuery}&currentUserId=${userId}`);
      setSearchResults(res.data);
      setShowSearch(true);
    } catch (err) {
      console.error("Lỗi tìm kiếm người dùng:", err);
    }
  };

  const handleAddFriend = async (targetId: number) => {
    try {
      await axios.post(`${API_URL}/social/add-friend`, {
        nguoiDungId1: userId,
        nguoiDungId2: targetId
      });
      alert("Đã gửi yêu cầu kết bạn!");
      setSearchQuery('');
      setShowSearch(false);
      fetchFriends();
    } catch (err: any) {
      alert(err.response?.data?.message || "Lỗi kết bạn");
    }
  };

  return (
    <div style={{
      position: 'fixed',
      right: 0,
      top: 0,
      width: '300px',
      height: '100vh',
      background: 'white',
      borderLeft: '4px solid #2c3e50',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 100,
      boxShadow: '-4px 0 10px rgba(0,0,0,0.05)'
    }}>
      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '4px solid #2c3e50' }}>
        <button 
          onClick={() => setTab('banbe')}
          style={{
            flex: 1,
            padding: '16px',
            background: tab === 'banbe' ? 'var(--color-accent)' : '#f8fafc',
            border: 'none',
            fontFamily: 'var(--font-kids)',
            fontWeight: 'bold',
            fontSize: '1rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            color: '#2c3e50',
            transition: 'background 0.2s'
          }}>
          <Users size={20} />
          Bạn bè
        </button>
        <button 
          onClick={() => setTab('bxh')}
          style={{
            flex: 1,
            padding: '16px',
            background: tab === 'bxh' ? 'var(--color-sun)' : '#f8fafc',
            border: 'none',
            fontFamily: 'var(--font-kids)',
            fontWeight: 'bold',
            fontSize: '1rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            color: '#2c3e50',
            transition: 'background 0.2s'
          }}>
          <Trophy size={20} />
          Bảng xếp hạng
        </button>
      </div>

      {/* Nội dung Tab Bạn bè */}
      {tab === 'banbe' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px', overflowY: 'auto' }}>
          {/* Ô tìm kiếm người dùng */}
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
            <input 
              type="text" 
              placeholder="Tìm bạn mới..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '99px',
                border: '2px solid #2c3e50',
                outline: 'none',
                fontFamily: 'var(--font-kids)',
                fontSize: '0.9rem'
              }}
            />
            <button type="submit" style={{
              background: '#2c3e50',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}>
              <Search size={16} />
            </button>
          </form>

          {/* Kết quả tìm kiếm */}
          {showSearch && searchResults.length > 0 && (
            <div style={{
              background: '#f8fafc',
              border: '2px solid #2c3e50',
              borderRadius: '12px',
              padding: '10px',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Kết quả tìm thấy:</span>
                <button onClick={() => setShowSearch(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ff6b81', fontWeight: 'bold' }}>Đóng</button>
              </div>
              {searchResults.map(user => {
                const isFriend = friends.some(f => f.id === user.id);
                return (
                  <div 
                    key={user.id} 
                    onClick={(e) => handleCardClick(e, user, isFriend)}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between', 
                      padding: '6px 8px', 
                      borderBottom: '1px solid #e2e8f0',
                      cursor: 'pointer',
                      borderRadius: '8px',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <img src={user.anhDaiDienUrl} alt={user.tenHienThi} style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid #2c3e50' }} />
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{user.tenHienThi}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Cấp {user.capDoHienTai}</div>
                      </div>
                    </div>
                    {isFriend ? (
                      <span style={{ fontSize: '0.75rem', color: '#2bcbba', fontWeight: 'bold' }}>Bạn bè</span>
                    ) : (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddFriend(user.id);
                        }} 
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#4bc0c0' }}
                      >
                        <UserPlus size={18} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Lời mời kết bạn */}
          {friendRequests.length > 0 && (
            <div style={{
              background: '#fff9db',
              border: '2px solid #2c3e50',
              borderRadius: '16px',
              padding: '12px',
              marginBottom: '16px',
              boxShadow: '0 4px 0 rgba(44, 62, 80, 0.1)'
            }}>
              <h4 style={{ 
                fontSize: '0.9rem', 
                fontWeight: 'bold', 
                marginBottom: '8px', 
                color: '#d97706',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontFamily: 'var(--font-kids)'
              }}>
                🔔 Lời mời kết bạn ({friendRequests.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {friendRequests.map(req => (
                  <div key={req.id} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    padding: '6px 0', 
                    borderBottom: '1px dashed #cbd5e1' 
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <img src={req.anhDaiDienUrl} alt={req.tenHienThi} style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid #2c3e50' }} />
                      <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{req.tenHienThi}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button 
                        onClick={() => handleAcceptFriendRequest(req.id)}
                        style={{
                          background: '#2bcbba',
                          color: 'white',
                          border: '2px solid #2c3e50',
                          borderRadius: '8px',
                          padding: '2px 8px',
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          fontFamily: 'var(--font-kids)'
                        }}
                      >
                        Đồng ý
                      </button>
                      <button 
                        onClick={() => handleDeclineFriendRequest(req.id)}
                        style={{
                          background: '#ff6b81',
                          color: 'white',
                          border: '2px solid #2c3e50',
                          borderRadius: '8px',
                          padding: '2px 8px',
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          fontFamily: 'var(--font-kids)'
                        }}
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Danh sách bạn bè */}
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '10px', color: '#64748b' }}>Bạn bè của bạn ({friends.length})</h3>
            {friends.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8' }}>
                <Smile size={32} style={{ marginBottom: '8px' }} />
                <div>Chưa có bạn bè. Hãy tìm kiếm và kết bạn nhé!</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {friends.map(friend => (
                  <div 
                    key={friend.id} 
                    onClick={(e) => handleCardClick(e, friend, true)}
                    style={{
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      border: '2px solid #2c3e50',
                      borderRadius: '16px',
                      background: friend.online ? '#f0fdf4' : 'white',
                      boxShadow: '0 4px 0 rgba(44, 62, 80, 0.1)',
                      cursor: 'pointer',
                      transition: 'transform 0.1s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ position: 'relative' }}>
                        <img src={friend.anhDaiDienUrl} alt={friend.tenHienThi} style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid #2c3e50' }} />
                        <Circle 
                          size={12} 
                          fill={friend.online ? "#2bcbba" : "#94a3b8"} 
                          color={friend.online ? "#2bcbba" : "#94a3b8"}
                          style={{
                            position: 'absolute',
                            right: 0,
                            bottom: 0,
                            border: '2px solid white',
                            borderRadius: '50%'
                          }}
                        />
                      </div>
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>{friend.tenHienThi}</div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Cấp {friend.capDoHienTai} • {friend.tongDiem}đ</div>
                      </div>
                    </div>

                    {/* Mời vẽ chung khi đang ở giao diện vẽ */}
                    {dangVeId && friend.online && onMoiVeChung && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onMoiVeChung(friend.id, dangVeId);
                        }}
                        style={{
                          background: 'var(--color-primary)',
                          color: 'white',
                          border: '2px solid #2c3e50',
                          borderRadius: '12px',
                          padding: '4px 8px',
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          fontFamily: 'var(--font-kids)',
                          boxShadow: '0 2px 0 #d63031'
                        }}>
                        Mời vẽ
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Nội dung Tab Bảng xếp hạng */}
      {tab === 'bxh' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px', overflowY: 'auto' }}>
          {/* Lọc BXH */}
          <div style={{
            display: 'flex',
            background: '#f1f5f9',
            borderRadius: '99px',
            border: '2px solid #2c3e50',
            padding: '2px',
            marginBottom: '16px'
          }}>
            <button 
              onClick={() => setBxhFilter('toancau')}
              style={{
                flex: 1,
                padding: '6px 12px',
                borderRadius: '99px',
                border: 'none',
                background: bxhFilter === 'toancau' ? 'white' : 'transparent',
                fontWeight: 'bold',
                fontFamily: 'var(--font-kids)',
                fontSize: '0.85rem',
                cursor: 'pointer',
                color: '#2c3e50',
                boxShadow: bxhFilter === 'toancau' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
              }}>
              Toàn cầu
            </button>
            <button 
              onClick={() => setBxhFilter('banbe')}
              style={{
                flex: 1,
                padding: '6px 12px',
                borderRadius: '99px',
                border: 'none',
                background: bxhFilter === 'banbe' ? 'white' : 'transparent',
                fontWeight: 'bold',
                fontFamily: 'var(--font-kids)',
                fontSize: '0.85rem',
                cursor: 'pointer',
                color: '#2c3e50',
                boxShadow: bxhFilter === 'banbe' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
              }}>
              Bạn bè
            </button>
          </div>

          {/* Danh sách BXH */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {leaderboard.map((user) => {
              // Tô màu đặc biệt cho Top 3
              let bg = 'white';
              let badgeColor = '#2c3e50';
              let badgeTextColor = 'white';
              if (user.rank === 1) {
                bg = '#fff9db'; // Vàng nhạt
                badgeColor = 'var(--color-sun)';
                badgeTextColor = '#2c3e50';
              } else if (user.rank === 2) {
                bg = '#f1f5f9'; // Xám bạc
                badgeColor = '#cbd5e1';
                badgeTextColor = '#2c3e50';
              } else if (user.rank === 3) {
                bg = '#fef2e6'; // Đồng
                badgeColor = '#fed7aa';
                badgeTextColor = '#2c3e50';
              }

              const isCurrentUser = user.id === userId;
              const isFriend = friends.some(f => f.id === user.id);

              return (
                <div 
                  key={user.id} 
                  onClick={(e) => !isCurrentUser && handleCardClick(e, user, isFriend)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    border: isCurrentUser ? '3px solid var(--color-primary)' : '2px solid #2c3e50',
                    borderRadius: '16px',
                    background: bg,
                    boxShadow: '0 4px 0 rgba(44, 62, 80, 0.1)',
                    cursor: isCurrentUser ? 'default' : 'pointer',
                    transition: isCurrentUser ? 'none' : 'transform 0.1s'
                  }}
                  onMouseEnter={(e) => {
                    if (!isCurrentUser) e.currentTarget.style.transform = 'scale(1.02)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isCurrentUser) e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {/* Số thứ hạng */}
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: badgeColor,
                      color: badgeTextColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      fontSize: '0.9rem',
                      border: '2px solid #2c3e50'
                    }}>
                      {user.rank}
                    </div>
                    {/* Avatar & Tên */}
                    <img src={user.anhDaiDienUrl} alt={user.tenHienThi} style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid #2c3e50' }} />
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: isCurrentUser ? 'var(--color-primary)' : '#2c3e50' }}>
                        {user.tenHienThi} {isCurrentUser && "(Bạn)"}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Cấp {user.capDoHienTai}</div>
                    </div>
                  </div>
                  {/* Điểm số */}
                  <div style={{ fontWeight: 'bold', color: 'var(--color-primary)', fontSize: '1rem' }}>
                    {user.tongDiem}đ
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Menu tương tác nhanh (kết bạn/hủy kết bạn/mời vẽ) */}
      {menuUser && menuPosition && (
        <div style={{
          position: 'fixed',
          left: `${menuPosition.x}px`,
          top: `${menuPosition.y}px`,
          background: 'white',
          border: '3px solid #2c3e50',
          borderRadius: '16px',
          padding: '8px',
          boxShadow: '0 8px 16px rgba(0,0,0,0.15), 0 4px 0 #2c3e50',
          zIndex: 200,
          minWidth: '180px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          fontFamily: 'var(--font-kids)'
        }}
        onClick={(e) => e.stopPropagation()} // Tránh click vào menu tự đóng
        >
          <div style={{
            fontSize: '0.85rem',
            fontWeight: 'bold',
            padding: '6px 8px',
            borderBottom: '2px dashed #e2e8f0',
            color: '#2c3e50',
            textAlign: 'center'
          }}>
            {menuUser.tenHienThi}
          </div>
          
          {menuUser.isFriend ? (
            <>
              {/* Option: Mời chơi game */}
              {maPhong && menuUser.online && (
                <button
                  onClick={() => {
                    if (connection) {
                      connection.invoke("MoiBanVaoPhong", userId, menuUser.id, maPhong)
                        .then(() => alert(`Đã gửi lời mời tham gia phòng cho ${menuUser.tenHienThi}!`))
                        .catch(err => console.error(err));
                    }
                    setMenuUser(null);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    textAlign: 'left',
                    fontWeight: 'bold',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    color: '#ffa502',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#fffaf0'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                >
                  🎮 Mời vào phòng chơi
                </button>
              )}

              {/* Option: Mời vẽ chung */}
              {dangVeId && menuUser.online && onMoiVeChung && (
                <button
                  onClick={() => {
                    onMoiVeChung(menuUser.id, dangVeId);
                    setMenuUser(null);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    textAlign: 'left',
                    fontWeight: 'bold',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    color: 'var(--color-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                >
                  🎨 Mời vẽ chung
                </button>
              )}

              {/* Option: Hủy kết bạn */}
              <button
                onClick={() => handleRemoveFriend(menuUser.id, menuUser.tenHienThi)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  textAlign: 'left',
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  color: '#ff4757',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#fff5f5'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
              >
                💔 Hủy kết bạn
              </button>
            </>
          ) : (
            /* Option: Kết bạn */
            <button
              onClick={() => {
                handleAddFriend(menuUser.id);
                setMenuUser(null);
              }}
              style={{
                background: 'none',
                border: 'none',
                padding: '8px 12px',
                borderRadius: '8px',
                textAlign: 'left',
                fontWeight: 'bold',
                fontSize: '0.9rem',
                cursor: 'pointer',
                color: '#2ed573',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#eefdf4'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
            >
              ➕ Kết bạn
            </button>
          )}
        </div>
      )}
    </div>
  );
};
