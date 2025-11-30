// Bağlantı
const socket = io();

// --- HTML element referansları ---
const menuSection = document.getElementById("menuSection");
const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");

const joinRoomMenu = document.getElementById("joinRoomMenu");
const joinRoomInput = document.getElementById("joinRoomInput");
const joinRoomSubmit = document.getElementById("joinRoomSubmit");

const lobbySection = document.getElementById("lobbySection");
const roomCodeText = document.getElementById("roomCodeText");
const playersList = document.getElementById("playersList");

const roleSelectBtn = document.getElementById("roleSelectBtn");
const readyBtn = document.getElementById("readyBtn");
const startGameBtn = document.getElementById("startGameBtn");
const backToMenuBtn = document.getElementById("backToMenuBtn");

// --- Ekran yönetimi ---
function showScreen(screenId) {
    document.querySelectorAll(".screen").forEach(s => s.style.display = "none");
    document.getElementById(screenId).style.display = "block";
}

// --- Oda oluştur ---
createRoomBtn.addEventListener("click", () => {
    socket.emit("createRoom");
});

// --- Odaya katıl menüsünü aç ---
joinRoomBtn.addEventListener("click", () => {
    showScreen("joinRoomMenu");
});

// --- Odaya katıl ---
joinRoomSubmit.addEventListener("click", () => {
    const code = joinRoomInput.value.trim().toUpperCase();
    if (code) socket.emit("joinRoom", { code });
});

// --- Lobby ekranında rol seç ---
roleSelectBtn.addEventListener("click", () => {
    showScreen("roleSelectScreen");
});

// --- Hazır butonu ---
readyBtn.addEventListener("click", () => {
    socket.emit("toggleReady");
});

// --- Oyunu başlat (sadece host) ---
startGameBtn.addEventListener("click", () => {
    socket.emit("startGame");
});

// --- Ana menüye dön ---
backToMenuBtn.addEventListener("click", () => {
    window.location.reload();
});

// ---------- SOCKET EVENTS ----------

// Oda oluşturuldu
socket.on("roomCreated", (data) => {
    roomCodeText.textContent = data.code;
    showScreen("lobbySection");
});

// Odaya katıldı
socket.on("roomJoined", (data) => {
    roomCodeText.textContent = data.code;
    showScreen("lobbySection");
});

// Oyuncu listesi güncellemesi
socket.on("playersUpdate", (data) => {
    playersList.innerHTML = "";

    data.players.forEach(p => {
        const div = document.createElement("div");
        div.className = "player-row";
        div.textContent = `${p.name} (${p.role || "rol seçilmedi"})`;

        const readyTag = document.createElement("span");
        readyTag.className = "ready-tag";
        readyTag.textContent = p.ready ? "Hazır" : "Hazır değil";

        div.appendChild(readyTag);
        playersList.appendChild(div);
    });

    // Host kontrolü
    if (data.isHost) {
        startGameBtn.style.display = "inline-block";
    } else {
        startGameBtn.style.display = "none";
    }
});

// Hata mesajı
socket.on("errorMessage", (msg) => {
    alert(msg);
});

// Oyun başladı
socket.on("gameStarted", () => {
    showScreen("gameScreen");
});
