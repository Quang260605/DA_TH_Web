// STATE MANAGEMENT
let currentUser = null;
let connection = null;
let currentRoomCode = null;
let currentRoomPlayers = [];
let isHost = false;
let friendsList = [];
let onlineFriends = new Set();
let contextMenuTargetUser = null;
let matchmakingInterval = null;
let currentRoomMaxPlayers = 8;
let currentRoomLoaiPhong = "TroChoiMini";

// GAME STATE STATE VARIABLES
let currentGameRound = null;
let currentGameTimer = null;
let currentGameRoundType = ""; // "VeHinh" hoặc "DoanChu"
let currentReceivedFromTurnId = null;

// ON PAGE LOAD
document.addEventListener("DOMContentLoaded", () => {
    // Check local storage for session
    const storedUser = localStorage.getItem("dwm_user");
    if (storedUser) {
        currentUser = JSON.parse(storedUser);
        loginSuccess(currentUser);
    }

    // Hide context menu on click elsewhere, or show it when left-clicking a user item
    document.addEventListener("click", (e) => {
        const menu = document.getElementById("custom-context-menu");
        
        const friendItem = e.target.closest(".friend-item");
        const leaderboardItem = e.target.closest(".leaderboard-item");
        const searchItem = e.target.closest(".search-user-item");
        const contextMenuItem = e.target.closest(".context-menu");

        let target = friendItem || leaderboardItem || searchItem;
        if (target) {
            e.preventDefault();
            e.stopPropagation();
            
            // Extract data attributes
            const userId = parseInt(target.getAttribute("data-id"));
            const displayName = target.getAttribute("data-name");
            const isFriend = target.getAttribute("data-friend") === "true";

            if (userId === currentUser.id) {
                if (menu) menu.style.display = "none";
                return;
            }

            contextMenuTargetUser = { id: userId, name: displayName, isFriend: isFriend };
            showContextMenu(e.clientX, e.clientY);
        } else if (!contextMenuItem) {
            if (menu) menu.style.display = "none";
        }
    });
});

// QUICK LOGIN FUNCTION (Preconfigured accounts)
async function quickLogin(username, displayName, avatarUrl) {
    try {
        // Register if not exists
        await fetch("/api/Authentication/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                tenDangNhap: username,
                matKhau: "123456",
                tenHienThi: displayName,
                anhDaiDienUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`
            })
        });
    } catch (e) {
        // Ignored if user already exists
    }

    // Login
    try {
        const res = await fetch("/api/Authentication/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                tenDangNhap: username,
                matKhau: "123456"
            })
        });

        if (res.ok) {
            const data = await res.json();
            currentUser = data.user;
            localStorage.setItem("dwm_user", JSON.stringify(currentUser));
            loginSuccess(currentUser);
        } else {
            showToast("Lỗi", "Không thể đăng nhập bằng tài khoản này.", "danger");
        }
    } catch (err) {
        showToast("Lỗi kết nối", "Không thể kết nối đến máy chủ.", "danger");
    }
}

// CUSTOM REGISTER AND LOGIN
async function customRegisterAndLogin() {
    const usernameInput = document.getElementById("custom-username").value.trim();
    const displayNameInput = document.getElementById("custom-display-name").value.trim();

    if (!usernameInput) {
        showToast("Lỗi", "Vui lòng nhập tên đăng nhập.", "warning");
        return;
    }

    const username = usernameInput.toLowerCase();
    const displayName = displayNameInput || `Họa sĩ ${usernameInput}`;

    try {
        // Register
        await fetch("/api/Authentication/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                tenDangNhap: username,
                matKhau: "123456",
                tenHienThi: displayName,
                anhDaiDienUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`
            })
        });
    } catch (e) {}

    // Login
    try {
        const res = await fetch("/api/Authentication/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                tenDangNhap: username,
                matKhau: "123456"
            })
        });

        if (res.ok) {
            const data = await res.json();
            currentUser = data.user;
            localStorage.setItem("dwm_user", JSON.stringify(currentUser));
            loginSuccess(currentUser);
        } else {
            showToast("Thất bại", "Lỗi đăng nhập tài khoản.", "danger");
        }
    } catch (err) {
        showToast("Lỗi kết nối", "Không thể kết nối đến máy chủ.", "danger");
    }
}

function loginSuccess(user) {
    document.getElementById("login-screen").classList.remove("active");
    document.getElementById("dashboard-screen").classList.add("active");
    
    document.getElementById("user-display-name").innerText = user.tenHienThi;
    document.getElementById("user-score").innerText = user.tongDiem;
    document.getElementById("user-avatar-img").src = user.anhDaiDienUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.tenHienThi}`;

    // Load initial data
    loadFriends();
    loadFriendRequests();
    loadGlobalLeaderboard();
    loadActiveRooms();

    initSignalRConnection();
}

function logoutUser() {
    localStorage.removeItem("dwm_user");
    currentUser = null;
    if (connection) {
        connection.stop();
    }
    
    // Clear state
    onlineFriends.clear();
    friendsList = [];
    currentRoomPlayers = [];
    currentRoomCode = null;
    currentRoomHostId = null;
    
    // Switch views
    document.getElementById("dashboard-screen").classList.remove("active");
    document.getElementById("login-screen").classList.add("active");
    
    // Clear inputs
    document.getElementById("custom-username").value = "";
    document.getElementById("custom-display-name").value = "";
}

// SIGNALR CONNECTION & REAL-TIME EVENTS
function initSignalRConnection() {
    connection = new signalR.HubConnectionBuilder()
        .withUrl("/gamehub")
        .withAutomaticReconnect()
        .build();

    // Listeners
    connection.on("XacNhanKetNoi", (msg) => {
        console.log("Real-time Connection: " + msg);
    });

    connection.on("BanBeOnline", (friendId) => {
        onlineFriends.add(friendId);
        updateFriendsUI();
    });

    connection.on("BanBeOffline", (friendId) => {
        onlineFriends.delete(friendId);
        updateFriendsUI();
    });

    connection.on("NhanLoiMoiVaoPhong", (invite) => {
        showInviteToast(invite.tenNguoiMoi, invite.maPhong);
    });

    connection.on("NhanYeuCauKetBan", (data) => {
        showFriendRequestToast(data.senderName, data.senderId);
        loadFriendRequests();
    });

    connection.on("XacNhanDongYKetBan", (friendId) => {
        showToast("Kết bạn thành công", "Yêu cầu kết bạn của bạn đã được chấp nhận!", "success");
        loadFriends();
        loadGlobalLeaderboard();
    });

    connection.on("BiXoaBan", (friendId) => {
        onlineFriends.delete(friendId);
        showToast("Hủy kết bạn", "Một người chơi đã hủy kết bạn với bạn.", "info");
        loadFriends();
        loadGlobalLeaderboard();
    });

    connection.on("RoomCreated", (room) => {
        currentRoomCode = room.maPhong;
        currentRoomHostId = room.chuPhongId;
        isHost = room.chuPhongId === currentUser.id;
        currentRoomMaxPlayers = room.soNguoiToiDa;
        currentRoomLoaiPhong = room.loaiPhong;
        switchToRoomLobbyView(room);
        loadActiveRooms();
    });

    connection.on("RoomJoined", (room) => {
        currentRoomCode = room.maPhong;
        currentRoomHostId = room.chuPhongId;
        isHost = room.chuPhongId === currentUser.id;
        currentRoomMaxPlayers = room.soNguoiToiDa;
        currentRoomLoaiPhong = room.loaiPhong;
        document.getElementById("matchmaking-overlay").classList.remove("active");
        switchToRoomLobbyView(room);
        loadActiveRooms();
    });

    connection.on("CapNhatPhong", (maPhong, danhSachNguoiChoi) => {
        currentRoomPlayers = danhSachNguoiChoi;
        currentRoomCode = maPhong;
        
        // Find if host changed
        // Normally host id is stored in room entity, let's assume if we are first in list or we received Host crown
        renderLobbyPlayers();
    });

    connection.on("NguoiChoiThayDoiSanSang", (userId, sanSang) => {
        const player = currentRoomPlayers.find(p => p.userId === userId);
        if (player) {
            player.sanSang = sanSang;
            renderLobbyPlayers();
        }
    });

    connection.on("NguoiChoiThoatPhong", (userId) => {
        currentRoomPlayers = currentRoomPlayers.filter(p => p.userId != userId);
        renderLobbyPlayers();
        loadActiveRooms();
    });

    connection.on("ChuPhongMoi", (newHostId) => {
        currentRoomHostId = newHostId;
        isHost = currentUser.id == newHostId;
        showToast("Thay đổi phòng", `Chủ phòng mới là ${isHost ? 'bạn' : 'một người chơi khác'}.`, "info");
        
        // Update host buttons
        const startBtn = document.getElementById("btn-start-game");
        const openWorldBtn = document.getElementById("btn-open-world");
        if (startBtn) startBtn.style.display = isHost ? "inline-block" : "none";
        if (openWorldBtn) openWorldBtn.style.display = isHost ? "inline-block" : "none";

        renderRoomLockState();
        // Re-render to update the host crown icon
        renderLobbyPlayers();
    });

    connection.on("BiKickKhoiPhong", () => {
        showToast("Bị đuổi", "Bạn đã bị chủ phòng mời ra khỏi phòng.", "warning");
        setTimeout(() => {
            window.location.reload();
        }, 1500);
    });

    connection.on("PhongDaMoCongDong", (maxPlayers) => {
        currentRoomMaxPlayers = maxPlayers;
        currentRoomLoaiPhong = "GhepNgauNhien";
        showToast("Mở rộng phòng", `Phòng chờ đã mở công cộng cho mọi người cùng ghép vào!`, "success");
        renderRoomLockState();
        renderLobbyPlayers();
    });

    connection.on("CapNhatKhoaPhong", (loaiPhongMoi) => {
        currentRoomLoaiPhong = loaiPhongMoi;
        renderRoomLockState();
    });

    connection.on("BatDauVongChoi", (roundInfo) => {
        // roundInfo: { gameSessionId, roundNumber, gameRoundId, loaiLuotChoi, noiDungNhan, receivedFromTurnId, thoiGianGiay }
        currentGameRound = roundInfo;
        currentGameRoundType = roundInfo.loaiLuotChoi;
        currentReceivedFromTurnId = roundInfo.receivedFromTurnId || null;

        // Switch to Game Screen
        switchView("game-active");

        // Clear canvas
        clearDrawCanvas();
        document.getElementById("txt-guess-answer").value = "";

        document.getElementById("game-round-number").innerText = roundInfo.roundNumber;
        document.getElementById("btn-submit-turn").innerHTML = `<i class="fa-solid fa-paper-plane"></i> Nộp Bài`;
        document.getElementById("btn-submit-turn").disabled = false;

        if (roundInfo.loaiLuotChoi === "VeHinh") {
            document.getElementById("game-round-type").innerText = "Vẽ Hình";
            document.getElementById("game-prompt-hint").innerHTML = `Hãy vẽ từ khóa: <strong class="text-warning" style="font-size:18px;">${roundInfo.noiDungNhan}</strong>`;
            document.getElementById("draw-canvas-container").style.display = "flex";
            document.getElementById("guess-input-container").style.display = "none";
        } else {
            document.getElementById("game-round-type").innerText = "Đoán Chữ";
            document.getElementById("game-prompt-hint").innerText = "Hãy đoán xem bức tranh sau đây vẽ cái gì?";
            document.getElementById("draw-canvas-container").style.display = "none";
            document.getElementById("guess-input-container").style.display = "flex";
            
            // Show received doodle preview
            const canvasPlaceholder = document.getElementById("guess-image-text");
            canvasPlaceholder.innerText = "";
            canvasPlaceholder.style.display = "none";

            const guessImg = document.getElementById("guess-image");
            guessImg.style.display = "block";
            // Check if doodle data is Base64 image
            if (roundInfo.noiDungNhan.startsWith("data:image")) {
                guessImg.src = roundInfo.noiDungNhan;
            } else {
                // Mock image or show canvas layout
                guessImg.style.display = "none";
                canvasPlaceholder.style.display = "block";
                canvasPlaceholder.innerHTML = `<div class="p-3 text-center"><i class="fa-solid fa-palette text-muted display-4 mb-2"></i><br/>Nét vẽ của bạn chơi: <br/><em class="text-indigo">${roundInfo.noiDungNhan.substring(0, 100)}...</em></div>`;
            }
        }

        // Start timer
        startCountdownTimer(roundInfo.thoiGianGiay);
    });

    connection.on("NguoiChoiDaNopBai", (userId) => {
        const player = currentRoomPlayers.find(p => p.userId === userId);
        const name = player ? player.tenHienThi : "Người chơi";
        showToast("Nộp bài", `${name} đã hoàn thành lượt chơi và đang đợi.`, "info");
    });

    connection.on("GameBiHuyDocDuong", (userId, message) => {
        stopCountdownTimer();
        showToast("Game bị hủy", message, "danger");
        // Return to lobby wait state
        switchView("room-lobby");
        renderLobbyPlayers();
    });

    connection.on("GameKetThuc", (sessionId) => {
        stopCountdownTimer();
        showToast("Trò chơi kết thúc!", "Tất cả các lượt chơi đã hoàn tất, đang xem kết quả.", "success");
        switchView("game-results");
        
        // Add points locally
        currentUser.tongDiem += 10;
        document.getElementById("user-score").innerText = currentUser.tongDiem;
        localStorage.setItem("dwm_user", JSON.stringify(currentUser));
    });

    // Start Hub Connection
    connection.start()
        .then(() => {
            connection.invoke("KetNoi", currentUser.id);
            console.log("SignalR connected!");
        })
        .catch(err => console.error("SignalR Connection Error: ", err));
}

// REST API CLIENT - FRIENDS & LEADERBOARDS
async function loadFriends() {
    try {
        const res = await fetch(`/api/Social/friends/${currentUser.id}`);
        if (res.ok) {
            friendsList = await res.json();
            document.getElementById("friends-count-badge").innerText = friendsList.length;
            updateFriendsUI();
        }
    } catch (e) {
        console.error("Error loading friends: ", e);
    }
}

async function loadFriendRequests() {
    try {
        const res = await fetch(`/api/Social/friend-requests/${currentUser.id}`);
        if (res.ok) {
            const reqs = await res.json();
            const panel = document.getElementById("friend-requests-section");
            const list = document.getElementById("friend-requests-list");
            
            if (reqs && reqs.length > 0) {
                panel.style.display = "block";
                list.innerHTML = reqs.map(r => `
                    <div class="request-item">
                        <div class="req-info">
                            <img src="https://api.dicebear.com/7.x/bottts/svg?seed=${r.tenHienThi}" alt="avatar" />
                            <span>${r.tenHienThi}</span>
                        </div>
                        <div class="request-actions">
                            <button class="btn-req-accept" onclick="acceptFriendRequest(${r.id})">Đồng ý</button>
                            <button class="btn-req-decline" onclick="declineFriendRequest(${r.friendshipId})">Hủy</button>
                        </div>
                    </div>
                `).join("");
            } else {
                panel.style.display = "none";
            }
        }
    } catch (e) {
        console.error("Error loading friend requests: ", e);
    }
}

async function acceptFriendRequest(friendId) {
    try {
        const res = await fetch("/api/Social/add-friend", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                nguoiDungId1: currentUser.id,
                nguoiDungId2: friendId
            })
        });

        if (res.ok) {
            showToast("Thành công", "Đã chấp nhận kết bạn!", "success");
            loadFriends();
            loadFriendRequests();
            // notify signalr so friends list online updates
            if (connection) {
                connection.invoke("KetNoi", currentUser.id);
            }
        }
    } catch (e) {
        console.error(e);
    }
}

async function declineFriendRequest(friendshipId) {
    showToast("Đã hủy", "Từ chối yêu cầu kết bạn.", "info");
    // For simplicity, we just hide and reload requests
    setTimeout(() => {
        loadFriendRequests();
    }, 400);
}

async function loadGlobalLeaderboard() {
    try {
        const res = await fetch("/api/Social/leaderboard/global");
        if (res.ok) {
            const leaderboard = await res.json();
            const container = document.getElementById("leaderboard-container");
            
            container.innerHTML = leaderboard.map(user => {
                const isUserFriend = friendsList.some(f => f.id === user.id);
                return `
                    <div class="leaderboard-item" data-id="${user.id}" data-name="${user.tenHienThi}" data-friend="${isUserFriend}">
                        <div class="rank">${user.rank}</div>
                        <img src="https://api.dicebear.com/7.x/bottts/svg?seed=${user.tenHienThi}" alt="avatar" />
                        <div class="meta">
                            <span class="name">${user.tenHienThi}</span>
                            <span class="score">${user.tongDiem} điểm | Cấp ${user.capDoHienTai}</span>
                        </div>
                    </div>
                `;
            }).join("");
        }
    } catch (e) {
        console.error("Error loading leaderboard: ", e);
    }
}

async function loadActiveRooms() {
    try {
        const res = await fetch("/api/Social/active-rooms");
        if (res.ok) {
            const rooms = await res.json();
            const list = document.getElementById("rooms-list");
            
            if (rooms && rooms.length > 0) {
                list.innerHTML = rooms.map(room => `
                    <div class="room-card">
                        <div class="room-details">
                            <span class="host-name">Chủ phòng: ${room.chuPhongTen}</span>
                            <div class="room-code-tag">
                                Mã phòng: <span class="room-code-badge">${room.maPhong}</span>
                            </div>
                        </div>
                        <div class="d-flex align-items-center gap-3">
                            <span class="player-count-badge">${room.soNguoiHienTai}/${room.soNguoiToiDa}</span>
                            <button class="btn-success btn-sm" onclick="joinRoomLobby('${room.maPhong}')">
                                <i class="fa-solid fa-right-to-bracket"></i> Tham gia
                            </button>
                        </div>
                    </div>
                `).join("");
            } else {
                list.innerHTML = `
                    <div class="no-rooms">
                        <i class="fa-regular fa-folder-open"></i>
                        <p>Hiện không có phòng vẽ cùng bạn bè nào đang hoạt động.</p>
                    </div>
                `;
            }
        }
    } catch (e) {
        console.error(e);
    }
}

async function searchUsersByUsername(val) {
    const resultsDiv = document.getElementById("search-results");
    if (!val || val.trim().length === 0) {
        resultsDiv.classList.remove("active");
        return;
    }

    try {
        const res = await fetch(`/api/Social/search-users?query=${encodeURIComponent(val)}&currentUserId=${currentUser.id}`);
        if (res.ok) {
            const users = await res.json();
            if (users && users.length > 0) {
                resultsDiv.classList.add("active");
                resultsDiv.innerHTML = users.map(user => {
                    const isUserFriend = friendsList.some(f => f.id === user.id);
                    return `
                        <div class="search-user-item" data-id="${user.id}" data-name="${user.tenHienThi}" data-friend="${isUserFriend}">
                            <img class="user-avatar-small" src="https://api.dicebear.com/7.x/bottts/svg?seed=${user.tenHienThi}" alt="avatar" />
                            <div class="user-info">
                                <span class="name">${user.tenHienThi}</span>
                                <span class="level">Cấp ${user.capDoHienTai}</span>
                            </div>
                            ${isUserFriend ? `<span class="badge badge-success">Bạn bè</span>` : `<span class="badge badge-warning" style="font-size:10px; background: rgba(99,102,241,0.15); color:#818cf8; border:1px solid rgba(99,102,241,0.25); border-radius:6px; padding:2px 8px;">Chuột trái để kết bạn</span>`}
                        </div>
                    `;
                }).join("");
            } else {
                resultsDiv.classList.add("active");
                resultsDiv.innerHTML = `<div class="p-2 text-muted text-center" style="font-size:12px;">Không tìm thấy người dùng phù hợp</div>`;
            }
        }
    } catch (e) {
        console.error(e);
    }
}

// CONTEXT MENU LOGIC
function showContextMenu(x, y) {
    const menu = document.getElementById("custom-context-menu");
    menu.style.display = "block";
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    // Configure options based on contextTarget
    document.getElementById("context-user-name").innerText = contextMenuTargetUser.name;

    const addFriendBtn = document.getElementById("menu-add-friend");
    const inviteBtn = document.getElementById("menu-invite-room");
    const removeFriendBtn = document.getElementById("menu-remove-friend");

    if (contextMenuTargetUser.isFriend) {
        addFriendBtn.style.display = "none";
        removeFriendBtn.style.display = "flex";
        // Can invite if current user is in a lobby and is host
        if (currentRoomCode && isHost) {
            inviteBtn.style.display = "flex";
        } else {
            inviteBtn.style.display = "none";
        }
    } else {
        addFriendBtn.style.display = "flex";
        inviteBtn.style.display = "none";
        removeFriendBtn.style.display = "none";
    }
}

async function sendFriendRequestDirect(targetId) {
    try {
        const res = await fetch("/api/Social/add-friend", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                nguoiDungId1: currentUser.id,
                nguoiDungId2: targetId
            })
        });

        if (res.ok) {
            const data = await res.json();
            showToast("Kết bạn", data.message || "Đã gửi lời mời kết bạn!", "success");
            loadFriendRequests();
            loadFriends();
            
            // Hide popovers
            document.getElementById("search-results").classList.remove("active");
            document.getElementById("txt-search-user").value = "";
        }
    } catch (e) {
        console.error(e);
    }
}

function actionAddFriend() {
    if (contextMenuTargetUser) {
        sendFriendRequestDirect(contextMenuTargetUser.id);
    }
}

function actionInviteFriendToRoom() {
    if (contextMenuTargetUser && currentRoomCode && connection) {
        connection.invoke("MoiBanVaoPhong", currentUser.id, contextMenuTargetUser.id, currentRoomCode)
            .then(() => {
                showToast("Đã mời", `Đã gửi lời mời tham gia phòng cho ${contextMenuTargetUser.name}!`, "success");
            });
    }
}

async function actionRemoveFriend() {
    if (!contextMenuTargetUser) return;
    
    if (confirm(`Bạn có chắc chắn muốn hủy kết bạn với ${contextMenuTargetUser.name}?`)) {
        try {
            const res = await fetch("/api/Social/remove-friend", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nguoiDungId1: currentUser.id,
                    nguoiDungId2: contextMenuTargetUser.id
                })
            });

            if (res.ok) {
                showToast("Hủy kết bạn", `Đã hủy kết bạn với ${contextMenuTargetUser.name}.`, "success");
                loadFriends();
                loadGlobalLeaderboard();
                if (connection) {
                    connection.invoke("KetNoi", currentUser.id);
                }
            } else {
                showToast("Thất bại", "Không thể hủy kết bạn.", "danger");
            }
        } catch (e) {
            console.error(e);
        }
    }
}

function actionViewProfile() {
    if (contextMenuTargetUser) {
        showToast("Thông tin", `${contextMenuTargetUser.name} | ID: ${contextMenuTargetUser.id} | Bấm chuột phải để tương tác nhanh.`, "info");
    }
}

// ROOM & MATCHMAKING OPERATIONS
function createNewFriendRoom() {
    if (connection) {
        connection.invoke("TaoPhong", currentUser.id, "VeCungBan");
    }
}

function joinRoomByInputCode() {
    const code = document.getElementById("room-code-input").value.trim().toUpperCase();
    if (!code) {
        showToast("Lỗi", "Vui lòng nhập mã phòng.", "warning");
        return;
    }
    joinRoomLobby(code);
}

function joinRoomLobby(code) {
    if (connection) {
        connection.invoke("ThamGiaPhong", code, currentUser.id)
            .then(() => {
                document.getElementById("room-code-input").value = "";
            });
    }
}

function toggleReadyState() {
    if (connection && currentRoomCode) {
        connection.invoke("ThayDoiSanSang", currentRoomCode, currentUser.id);
    }
}

function openRoomToWorld() {
    if (connection && currentRoomCode && isHost) {
        const shouldLock = currentRoomLoaiPhong === "GhepNgauNhien";
        connection.invoke("ThayDoiKhoaPhong", currentRoomCode, shouldLock).catch(err => console.error(err));
    }
}

function renderRoomLockState() {
    const lockBtn = document.getElementById("btn-open-world");
    if (!lockBtn) return;

    const isPublic = currentRoomLoaiPhong === "GhepNgauNhien";

    const typeText = document.getElementById("lobby-type-text");
    if (typeText) {
        typeText.innerText = isPublic ? "Ghép ngẫu nhiên (Công khai)" : (currentRoomMaxPlayers <= 2 ? "Vẽ cùng bạn (Riêng tư)" : "Ghép với bạn (Riêng tư)");
        typeText.className = isPublic ? "text-success" : "text-warning";
    }

    lockBtn.style.display = isHost ? "inline-block" : "none";
    if (isHost) {
        if (isPublic) {
            lockBtn.innerHTML = `<i class="fa-solid fa-lock"></i> Khóa phòng (Riêng tư)`;
            lockBtn.style.background = "#ff4757"; // Red color
            lockBtn.style.borderColor = "#ff4757";
        } else {
            lockBtn.innerHTML = `<i class="fa-solid fa-lock-open"></i> Mở phòng (Công khai)`;
            lockBtn.style.background = ""; // Default CSS class btn-warning
            lockBtn.style.borderColor = "";
        }
    }
}

function startGameSession() {
    if (connection && currentRoomCode && isHost) {
        // Check if there are at least 2 players
        if (currentRoomPlayers.length < 2) {
            showToast("Lỗi", "Phòng chơi cần tối thiểu 2 người để bắt đầu.", "warning");
            return;
        }
        connection.invoke("BatDauGame", currentRoomCode);
    }
}

function leaveRoomLobby() {
    if (connection && currentRoomCode) {
        connection.invoke("ThoatPhong", currentRoomCode, currentUser.id).then(() => {
            window.location.reload();
        }).catch(err => {
            console.error("Lỗi thoát phòng: ", err);
            window.location.reload();
        });
    } else {
        window.location.reload();
    }
}

// RANDOM MATCHMAKING
function startRandomMatchmaking() {
    document.getElementById("matchmaking-overlay").classList.add("active");
    if (connection) {
        // Trigger SignalR search
        connection.invoke("GhepTrangNgauNhien", currentUser.id);
    }
}

function cancelMatchmaking() {
    document.getElementById("matchmaking-overlay").classList.remove("active");
    if (connection) {
        connection.invoke("HuyTimPhong", currentUser.id);
    }
}

// FRONTEND VIEW SWITCHING
function switchView(viewName) {
    const panels = ["lobby-selector-view", "room-lobby-view", "game-active-view", "game-results-view"];
    panels.forEach(p => {
        document.getElementById(p).classList.remove("active");
    });

    document.getElementById(`${viewName}-view`).classList.add("active");
}

function switchToRoomLobbyView(room) {
    switchView("room-lobby");

    document.getElementById("lobby-room-code").innerText = room.maPhong;
    
    // Toggle host actions
    const startBtn = document.getElementById("btn-start-game");
    const openWorldBtn = document.getElementById("btn-open-world");
    const readyBtn = document.getElementById("btn-ready-toggle");

    if (isHost) {
        startBtn.style.display = "inline-block";
        openWorldBtn.style.display = "inline-block";
        readyBtn.style.display = "none";
    } else {
        startBtn.style.display = "none";
        openWorldBtn.style.display = "none";
        readyBtn.style.display = "inline-block";
    }

    renderRoomLockState();
}

function renderLobbyPlayers() {
    const list = document.getElementById("lobby-players-list");
    document.getElementById("lobby-player-count").innerText = `${currentRoomPlayers.length}/${currentRoomMaxPlayers}`;

    list.innerHTML = currentRoomPlayers.map(p => {
        const isThisUserHost = p.userId == currentRoomHostId;
        const crown = isThisUserHost ? `<i class="fa-solid fa-crown host-crown"></i>` : '';
        const readyClass = isThisUserHost ? 'host' : (p.sanSang ? 'ready' : 'waiting');
        const readyText = isThisUserHost ? 'CHỦ PHÒNG' : (p.sanSang ? 'ĐÃ SẴN SÀNG' : 'ĐANG CHỜ...');

        let kickBtn = '';
        if (isHost && !isThisUserHost) {
            kickBtn = `<button class="btn btn-sm btn-outline-danger ms-auto" style="border: none; padding: 2px 6px;" onclick="kickPlayer(${p.userId})" title="Đuổi khỏi phòng"><i class="fa-solid fa-user-xmark"></i></button>`;
        }

        return `
            <div class="lobby-player-card ${isThisUserHost ? 'is-chu-phong' : ''}">
                ${crown}
                <img src="https://api.dicebear.com/7.x/bottts/svg?seed=${p.tenHienThi}" alt="avatar" />
                <span class="name">${p.tenHienThi}</span>
                <span class="status-text ${readyClass}">${readyText}</span>
                ${kickBtn}
            </div>
        `;
    }).join("");
}

function kickPlayer(userId) {
    if (confirm("Bạn có chắc chắn muốn đuổi người chơi này khỏi phòng?")) {
        if (connection && currentRoomCode) {
            connection.invoke("KickNguoiChoi", currentRoomCode, userId).catch(err => console.error(err));
        }
    }
}

function returnToLobbyFromGame() {
    window.location.reload();
}

// FRIENDS LIST RENDER
function updateFriendsUI() {
    const container = document.getElementById("friends-list-container");
    if (!friendsList || friendsList.length === 0) {
        container.innerHTML = `
            <div class="no-friends">
                <i class="fa-solid fa-user-plus"></i>
                <p>Chưa có bạn bè nào. Hãy dùng ô tìm kiếm bên trên hoặc chuột phải người lạ trên Bảng xếp hạng để kết bạn.</p>
            </div>
        `;
        return;
    }

    // Sort online first
    const sorted = [...friendsList].sort((a, b) => {
        const aOnline = onlineFriends.has(a.id);
        const bOnline = onlineFriends.has(b.id);
        if (aOnline && !bOnline) return -1;
        if (!aOnline && bOnline) return 1;
        return 0;
    });

    container.innerHTML = sorted.map(f => {
        const isOnline = onlineFriends.has(f.id);
        return `
            <div class="friend-item" data-id="${f.id}" data-name="${f.tenHienThi}" data-friend="true">
                <div class="avatar-wrapper">
                    <img class="friend-avatar" src="https://api.dicebear.com/7.x/bottts/svg?seed=${f.tenHienThi}" alt="avatar" />
                    <div class="status-dot ${isOnline ? 'online' : ''}"></div>
                </div>
                <div class="meta">
                    <span class="name">${f.tenHienThi}</span>
                    <span class="details"><i class="fa-solid fa-trophy text-amber"></i> ${f.tongDiem || 0} | Cấp ${f.capDoHienTai || 1}</span>
                </div>
            </div>
        `;
    }).join("");
}

function switchSidebarTab(tabName) {
    document.getElementById("tab-friends-btn").classList.remove("active");
    document.getElementById("tab-leaderboard-btn").classList.remove("active");
    document.getElementById("tab-friends").classList.remove("active");
    document.getElementById("tab-leaderboard").classList.remove("active");

    document.getElementById(`tab-${tabName}-btn`).classList.add("active");
    document.getElementById(`tab-${tabName}`).classList.add("active");
}

// GAME TIMER COUNTDOWN
function startCountdownTimer(secs) {
    stopCountdownTimer();
    let timeLeft = secs;
    const el = document.getElementById("game-timer-countdown");
    el.innerText = timeLeft;

    currentGameTimer = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
            clearInterval(currentGameTimer);
            // Auto submit
            submitGameTurn();
        }
        el.innerText = timeLeft;
    }, 1000);
}

function stopCountdownTimer() {
    if (currentGameTimer) {
        clearInterval(currentGameTimer);
        currentGameTimer = null;
    }
}

// DRAWING CANVAS SIMULATOR
function addMockDoodles() {
    if (currentGameRoundType !== "VeHinh") return;

    const board = document.getElementById("canvas-board");
    const doodleArea = document.getElementById("canvas-doodle-area");
    const placeholder = board.querySelector(".canvas-placeholder");
    if (placeholder) placeholder.style.opacity = "0";

    const color = document.getElementById("pencil-color").value;
    
    // Add random brush paths inside mock canvas to make it feel premium and interactive
    for (let i = 0; i < 5; i++) {
        const stroke = document.createElement("div");
        stroke.className = "mock-doodle-stroke";
        stroke.style.background = color;
        
        const size = Math.floor(Math.random() * 8) + 6;
        const x = Math.floor(Math.random() * 80) + 10;
        const y = Math.floor(Math.random() * 80) + 10;

        stroke.style.width = `${size}px`;
        stroke.style.height = `${size}px`;
        stroke.style.left = `${x}%`;
        stroke.style.top = `${y}%`;

        doodleArea.appendChild(stroke);
    }
}

function clearDrawCanvas() {
    const doodleArea = document.getElementById("canvas-doodle-area");
    if (doodleArea) doodleArea.innerHTML = "";
    
    const placeholder = document.querySelector(".canvas-placeholder");
    if (placeholder) placeholder.style.opacity = "1";
}

// SUBMIT GAME TURN
function submitGameTurn() {
    stopCountdownTimer();
    document.getElementById("btn-submit-turn").disabled = true;
    document.getElementById("btn-submit-turn").innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang chờ người khác...`;

    if (connection && currentGameRound) {
        let contentData = "";
        if (currentGameRoundType === "VeHinh") {
            // Generate a random dicebear bottts avatar as our base64 drawing mockup to avoid empty strings
            const seed = `drawing_${currentUser.id}_${Date.now()}`;
            contentData = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40" stroke="green" stroke-width="4" fill="yellow" /></svg>`;
        } else {
            contentData = document.getElementById("txt-guess-answer").value.trim() || "Con mèo";
        }

        connection.invoke("NopLuotChoi", 
            currentGameRound.gameRoundId, 
            currentUser.id, 
            currentGameRoundType, 
            contentData, 
            currentReceivedFromTurnId
        ).catch(err => {
            console.error("Lỗi nộp bài: ", err);
            showToast("Lỗi nộp bài", "Không thể nộp bài, vui lòng thử lại.", "danger");
        });
    }
}

// TOAST NOTIFICATIONS UTILITY
function showToast(title, body, type = "primary") {
    const wrapper = document.getElementById("toast-wrapper");
    const id = `toast_${Date.now()}`;

    const toastHtml = `
        <div class="toast toast-${type}" id="${id}">
            <div class="toast-header">
                <i class="fa-solid fa-bell"></i>
                <span>${title}</span>
            </div>
            <div class="toast-body">${body}</div>
        </div>
    `;

    wrapper.insertAdjacentHTML("beforeend", toastHtml);
    
    setTimeout(() => {
        const el = document.getElementById(id);
        if (el) {
            el.style.opacity = "0";
            setTimeout(() => el.remove(), 300);
        }
    }, 4000);
}

function showInviteToast(senderName, maPhong) {
    const wrapper = document.getElementById("toast-wrapper");
    const id = `toast_${Date.now()}`;

    const toastHtml = `
        <div class="toast toast-warning" id="${id}">
            <div class="toast-header">
                <i class="fa-solid fa-gamepad"></i>
                <span>Lời Mời Chơi Game</span>
            </div>
            <div class="toast-body">
                <strong>${senderName}</strong> vừa mời bạn tham gia phòng chơi của họ!
            </div>
            <div class="toast-actions">
                <button class="btn-toast-ok" onclick="acceptInvite('${maPhong}', '${id}')">Đồng ý</button>
                <button class="btn-toast-no" onclick="dismissToast('${id}')">Bác bỏ</button>
            </div>
        </div>
    `;

    wrapper.insertAdjacentHTML("beforeend", toastHtml);
}

function acceptInvite(maPhong, toastId) {
    dismissToast(toastId);
    joinRoomLobby(maPhong);
}

function dismissToast(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function copyRoomCode() {
    const code = document.getElementById("lobby-room-code").innerText;
    navigator.clipboard.writeText(code).then(() => {
        showToast("Sao chép", "Đã sao chép mã phòng vào clipboard!", "success");
    });
}

function showFriendRequestToast(senderName, senderId) {
    const wrapper = document.getElementById("toast-wrapper");
    const id = `toast_${Date.now()}`;

    const toastHtml = `
        <div class="toast toast-success" id="${id}">
            <div class="toast-header">
                <i class="fa-solid fa-user-plus text-success"></i>
                <span>Yêu Cầu Kết Bạn Mới</span>
            </div>
            <div class="toast-body">
                <strong>${senderName}</strong> muốn kết bạn với bạn!
            </div>
            <div class="toast-actions">
                <button class="btn-toast-ok" onclick="acceptFriendRequestDirect('${senderId}', '${id}')">Đồng ý</button>
                <button class="btn-toast-no" onclick="dismissToast('${id}')">Bỏ qua</button>
            </div>
        </div>
    `;

    wrapper.insertAdjacentHTML("beforeend", toastHtml);
}

async function acceptFriendRequestDirect(senderId, toastId) {
    dismissToast(toastId);
    await acceptFriendRequest(parseInt(senderId));
}
