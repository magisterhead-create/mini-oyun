const socket = io();

// Her tarayıcı için kalıcı bir cihaz ID'si
let deviceId = localStorage.getItem("bdp_device_id");
if (!deviceId) {
  deviceId = "dev_" + Math.random().toString(36).substring(2, 11);
  localStorage.setItem("bdp_device_id", deviceId);
}

// --- DOM ELEMANLARI --- //

// Menü
const menuSection = document.getElementById("menuSection");
const hostBtn = document.getElementById("hostBtn");
const joinMenuBtn = document.getElementById("joinMenuBtn");
const settingsBtn = document.getElementById("settingsBtn");
const settingsPanel = document.getElementById("settingsPanel");
const howToBtn = document.getElementById("howToBtn");
const creditsBtn = document.getElementById("creditsBtn");

// Overlay
const overlayBackdrop = document.getElementById("overlayBackdrop");
const howToOverlay = document.getElementById("howToOverlay");
const creditsOverlay = document.getElementById("creditsOverlay");
const roleSelectOverlay = document.getElementById("roleSelectOverlay");
const overlayCloseBtn1 = document.getElementById("overlayCloseBtn1");
const overlayCloseBtn2 = document.getElementById("overlayCloseBtn2");
const roleOverlayCloseBtn = document.getElementById("roleOverlayCloseBtn");

// Case overlay
const caseSelectOverlay = document.getElementById("caseSelectOverlay");
const caseOverlayCloseBtn = document.getElementById("caseOverlayCloseBtn");
const beginInvestigationBtn = document.getElementById("beginInvestigationBtn");

// Bağlantı ekranı
const connectionSection = document.getElementById("connectionSection");
const nameInput = document.getElementById("nameInput");
const roomCodeGroup = document.getElementById("roomCodeGroup");
const roomCodeInput = document.getElementById("roomCodeInput");
const connectBtn = document.getElementById("connectBtn");
const backToMenuFromConnectBtn = document.getElementById("backToMenuFromConnectBtn");
const joinError = document.getElementById("joinError");

// Host ekstra alanları
const hostExtraGroup = document.getElementById("hostExtraGroup");
const roomNameInput = document.getElementById("roomNameInput");
const roomPasswordInput = document.getElementById("roomPasswordInput");

// Oda listesi
const roomListPanel = document.getElementById("roomListPanel");
const roomListContainer = document.getElementById("roomListContainer");
const refreshRoomsBtn = document.getElementById("refreshRoomsBtn");
const pingLabel = document.getElementById("pingLabel");

// Lobby
const lobbyLayout = document.getElementById("lobbyLayout");
if (lobbyLayout) {
  lobbyLayout.style.display = "none"; // sayfa açılır açılmaz lobby+chat gizli
}
const lobbySection = document.getElementById("lobbySection");
const myRoleInfo = document.getElementById("myRoleInfo");
const roomCodeDisplay = document.getElementById("roomCodeDisplay");
const playersList = document.getElementById("playersList");
const lobbyMessage = document.getElementById("lobbyMessage");
const lobbyReadyBtn = document.getElementById("lobbyReadyBtn");
const startGameBtn = document.getElementById("startGameBtn");
const backToMenuBtn = document.getElementById("backToMenuBtn");
const roleError = document.getElementById("roleError");
const copyLinkBtn = document.getElementById("copyLinkBtn");
const inviteFriendBtn = document.getElementById("inviteFriendBtn");
const selectCaseBtn = document.getElementById("selectCaseBtn");
const openRoleSelectBtn = document.getElementById("openRoleSelectBtn");

// Faz bölümü
const phaseSection = document.getElementById("phaseSection");
const phaseTitle = document.getElementById("phaseTitle");
const phaseContent = document.getElementById("phaseContent");
const phaseReadyBtn = document.getElementById("phaseReadyBtn");
const phaseInfo = document.getElementById("phaseInfo");

// Final
const finalSection = document.getElementById("finalSection");
const finalQuestion = document.getElementById("finalQuestion");
const answerInput = document.getElementById("answerInput");
const submitAnswerBtn = document.getElementById("submitAnswerBtn");
const finalInfo = document.getElementById("finalInfo");

// Sonuç
const resultSection = document.getElementById("resultSection");
const resultText = document.getElementById("resultText");

// Lobby chat
const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const chatSendBtn = document.getElementById("chatSendBtn");

// Voice controls
const joinVoiceBtn = document.getElementById("joinVoiceBtn");
const muteToggleBtn = document.getElementById("muteToggleBtn");
const leaveVoiceBtn = document.getElementById("leaveVoiceBtn");

// Sayfa açıldığında kayıtlı nick'i yükle
const savedName = localStorage.getItem("bdp_name");
if (savedName && nameInput) {
  nameInput.value = savedName;
}

// --- STATE --- //

let myId = null;
let myRole = null;
let myRoomCode = null;
let currentPhase = 0;
let mode = null; // "host" veya "join"
let myLobbyReady = false;

// seçili case (şimdilik tek vaka)
let selectedCaseId = "restaurant_murder";

// ping ölçümü
let lastPingMs = null;
let pingIntervalId = null;

// Voice / WebRTC state
let localAudioStream = null;
let peers = {}; // peerId -> RTCPeerConnection
let isMuted = false;
let listenOnly = false; // mikrofon yoksa sadece dinleyici mod

// --- Yardımcı fonksiyonlar --- //

function updateMyRoleInfo() {
  let text;
  if (myRole === "dedektif") {
    text = "Rolün: Baş Dedektif";
  } else if (myRole === "polis") {
    text = "Rolün: Polis";
  } else {
    text = "Rolün: (henüz seçilmedi)";
  }
  myRoleInfo.textContent = text;
}

function showLobbyInfo(msg) {
  lobbyMessage.style.display = "block";
  lobbyMessage.textContent = msg;
}

function updatePingLabel(ms) {
  if (!pingLabel) return;
  if (ms == null) {
    pingLabel.textContent = "-";
  } else {
    pingLabel.textContent = ms + " ms";
  }
}

function startPingLoop() {
  if (pingIntervalId) return;
  const sendPing = () => {
    socket.emit("pingCheck", { sentAt: Date.now() });
  };
  sendPing();
  pingIntervalId = setInterval(sendPing, 8000);
}

function stopPingLoop() {
  if (pingIntervalId) {
    clearInterval(pingIntervalId);
    pingIntervalId = null;
  }
  updatePingLabel(null);
}

function requestRoomList() {
  socket.emit("getRoomList");
}

function addChatMessage(data) {
  if (!chatMessages) return;
  const line = document.createElement("div");
  line.className = "chat-message-line";

  if (data.isSystem) {
    line.classList.add("chat-message-system");
    const textSpan = document.createElement("span");
    textSpan.className = "chat-message-system-text";
    textSpan.textContent = data.text;

    line.appendChild(textSpan);

    if (data.time) {
      const t = new Date(data.time);
      const hh = String(t.getHours()).padStart(2, "0");
      const mm = String(t.getMinutes()).padStart(2, "0");
      const timeSpan = document.createElement("span");
      timeSpan.className = "chat-message-time";
      timeSpan.textContent = " [" + hh + ":" + mm + "]";
      line.appendChild(timeSpan);
    }
  } else {
    const nameSpan = document.createElement("span");
    nameSpan.className = "chat-message-name";
    nameSpan.textContent = data.from + ":";

    const textSpan = document.createElement("span");
    textSpan.className = "chat-message-text";
    textSpan.textContent = " " + data.text;

    line.appendChild(nameSpan);
    line.appendChild(textSpan);

    if (data.time) {
      const t = new Date(data.time);
      const hh = String(t.getHours()).padStart(2, "0");
      const mm = String(t.getMinutes()).padStart(2, "0");
      const timeSpan = document.createElement("span");
      timeSpan.className = "chat-message-time";
      timeSpan.textContent = " [" + hh + ":" + mm + "]";
      line.appendChild(timeSpan);
    }
  }

  chatMessages.appendChild(line);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function resetUIToMenu() {
  menuSection.style.display = "block";
  connectionSection.style.display = "none";
  lobbySection.style.display = "none";
  phaseSection.style.display = "none";
  finalSection.style.display = "none";
  resultSection.style.display = "none";
  if (lobbyLayout) {
    lobbyLayout.style.display = "none";
  }

  joinError.style.display = "none";
  joinError.textContent = "";
  lobbyMessage.style.display = "none";
  lobbyMessage.textContent = "";
  playersList.innerHTML = "";
  roomCodeDisplay.textContent = "— — — — —";
  myRoleInfo.textContent = "";
  resultText.textContent = "";
  finalInfo.style.display = "none";
  finalInfo.textContent = "";
  roleError.style.display = "none";
  roleError.textContent = "";

  phaseInfo.style.display = "none";
  phaseInfo.textContent = "";

  phaseReadyBtn.disabled = false;
  submitAnswerBtn.disabled = false;
  answerInput.disabled = false;
  answerInput.value = "";
  // nameInput.value'ı temizlemiyoruz, localStorage'daki nick kalsın
  roomCodeInput.value = "";

  if (roomNameInput) roomNameInput.value = "";
  if (roomPasswordInput) roomPasswordInput.value = "";

  if (chatMessages) chatMessages.innerHTML = "";
  if (chatInput) chatInput.value = "";

  myRoomCode = null;
  myRole = null;
  currentPhase = 0;
  mode = null;
  myLobbyReady = false;

  lobbyReadyBtn.disabled = false;
  lobbyReadyBtn.textContent = "Hazırım";
  startGameBtn.disabled = false;
  startGameBtn.style.display = "none";

  // case butonu varsayılan haline dönsün
  selectCaseBtn.textContent = "Default Case";
  selectedCaseId = "restaurant_murder";

  // ping & room list reset
  stopPingLoop();
  if (roomListContainer) {
    roomListContainer.innerHTML = "Şu anda açık oda yok.";
  }

  // Voice temizle
  cleanupVoice();
}

// --- Overlay logic --- //

function openOverlay(which) {
  overlayBackdrop.style.display = "flex";
  howToOverlay.style.display = "none";
  creditsOverlay.style.display = "none";
  roleSelectOverlay.style.display = "none";
  caseSelectOverlay.style.display = "none";

  if (which === "howto") {
    howToOverlay.style.display = "block";
  } else if (which === "credits") {
    creditsOverlay.style.display = "block";
  } else if (which === "roles") {
    roleSelectOverlay.style.display = "block";
  } else if (which === "cases") {
    caseSelectOverlay.style.display = "block";
  }
}

function closeOverlay() {
  overlayBackdrop.style.display = "none";
  howToOverlay.style.display = "none";
  creditsOverlay.style.display = "none";
  roleSelectOverlay.style.display = "none";
  caseSelectOverlay.style.display = "none";
}

// Room password prompt for private rooms
function openPasswordPromptForRoom(code) {
  const name = nameInput.value.trim();
  if (!name) {
    joinError.style.display = "block";
    joinError.textContent = "Önce bir isim girin, sonra odaya katılabilirsiniz.";
    return;
  }
  const pwd = window.prompt("Bu oda şifreli. Lütfen şifreyi girin:");
  if (pwd === null) return;
  socket.emit("joinRoom", {
    name,
    roomCode: code,
    password: pwd,
    deviceId
  });
}

// Chat gönderme
function sendChatMessage() {
  if (!chatInput) return;
  const text = chatInput.value.trim();
  if (!text) return;
  socket.emit("sendChat", { message: text });
  chatInput.value = "";
}

// --- Voice / WebRTC Fonksiyonları --- //

async function joinVoice() {
  // Zaten ses kanalında isek tekrar girme
  if (localAudioStream || listenOnly) return;

  try {
    // Normal mod: mikrofonu almaya çalış
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true
      }
    });

    // Başarılı: konuşan/dinleyen mod
    localAudioStream = stream;
    listenOnly = false;

    if (joinVoiceBtn) joinVoiceBtn.style.display = "none";
    if (muteToggleBtn) {
      muteToggleBtn.style.display = "inline-flex";
      muteToggleBtn.textContent = "🔇 Mute";
    }
    if (leaveVoiceBtn) leaveVoiceBtn.style.display = "inline-flex";

    // Sunucuya bildir: normal voice join
    socket.emit("joinVoice", { listenOnly: false });
  } catch (err) {
    // Mikrofon yok / bulunamadı / açılamadı → sadece dinleyici mod
    console.warn(
      "Mikrofon alınamadı, dinleyici moda geçiliyor:",
      err.name,
      err.message
    );

    listenOnly = true;
    localAudioStream = null;

    // UI: sadece "Sessizce Dinle" durumu gibi davransın
    if (joinVoiceBtn) joinVoiceBtn.style.display = "none";
    if (muteToggleBtn) muteToggleBtn.style.display = "none"; // mikrofon yok, mute anlamsız
    if (leaveVoiceBtn) leaveVoiceBtn.style.display = "inline-flex";

    // Chat'e küçük bilgi mesajı
    addChatMessage({
      from: "Sistem",
      text:
        "Bu cihazda kullanılabilir mikrofon bulunamadı. Sesli sohbeti sadece dinleyici olarak kullanıyorsun.",
      time: Date.now(),
      isSystem: true
    });

    // Sunucuya bildir: dinleyici join
    socket.emit("joinVoice", { listenOnly: true });
  }
}


function toggleMute() {
  if (!localAudioStream) return;
  isMuted = !isMuted;
  localAudioStream.getAudioTracks().forEach((track) => {
    track.enabled = !isMuted;
  });
  if (muteToggleBtn) {
    muteToggleBtn.textContent = isMuted ? "🔈 Unmute" : "🔇 Mute";
  }
}

function cleanupVoice() {
  listenOnly = false;
  if (localAudioStream) {
    localAudioStream.getTracks().forEach((t) => t.stop());
    localAudioStream = null;
  }
  Object.values(peers).forEach((pc) => pc.close());
  peers = {};

  if (joinVoiceBtn) joinVoiceBtn.style.display = "inline-flex";
  if (muteToggleBtn) muteToggleBtn.style.display = "none";
  if (leaveVoiceBtn) leaveVoiceBtn.style.display = "none";

  // remote audio elementlerini temizle
  const audios = document.querySelectorAll("[id^='audio_']");
  audios.forEach((a) => a.remove());
}

function leaveVoice() {
  cleanupVoice();
  socket.emit("leaveVoice");
}

function createPeerConnection(peerId) {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  // Lokal ses akışı
  if (localAudioStream) {
    localAudioStream.getTracks().forEach((track) => {
      pc.addTrack(track, localAudioStream);
    });
  }

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("voiceIceCandidate", {
        to: peerId,
        candidate: event.candidate
      });
    }
  };

  pc.ontrack = (event) => {
    const remoteStream = event.streams[0];
    let audioEl = document.getElementById("audio_" + peerId);
    if (!audioEl) {
      audioEl = document.createElement("audio");
      audioEl.id = "audio_" + peerId;
      audioEl.autoplay = true;
      audioEl.playsInline = true;
      document.body.appendChild(audioEl);
    }
    audioEl.srcObject = remoteStream;
  };

  return pc;
}

// --- EVENT LISTENERS --- //

// Overlay butonları
howToBtn.addEventListener("click", () => openOverlay("howto"));
creditsBtn.addEventListener("click", () => openOverlay("credits"));
overlayCloseBtn1.addEventListener("click", closeOverlay);
overlayCloseBtn2.addEventListener("click", closeOverlay);
roleOverlayCloseBtn.addEventListener("click", closeOverlay);
caseOverlayCloseBtn.addEventListener("click", closeOverlay);

overlayBackdrop.addEventListener("click", (e) => {
  if (e.target === overlayBackdrop) closeOverlay();
});

// Settings toggle
settingsBtn.addEventListener("click", () => {
  if (settingsPanel.style.display === "none") {
    settingsPanel.style.display = "block";
  } else {
    settingsPanel.style.display = "none";
  }
});

// Menü butonları
hostBtn.addEventListener("click", () => {
  mode = "host";
  menuSection.style.display = "none";
  connectionSection.style.display = "block";
  roomCodeGroup.style.display = "none";
  if (hostExtraGroup) hostExtraGroup.style.display = "block";
  if (roomListPanel) roomListPanel.style.display = "none";
  stopPingLoop();
});

joinMenuBtn.addEventListener("click", () => {
  mode = "join";
  menuSection.style.display = "none";
  connectionSection.style.display = "block";
  roomCodeGroup.style.display = "block";
  if (hostExtraGroup) hostExtraGroup.style.display = "none";
  if (roomListPanel) roomListPanel.style.display = "block";

  requestRoomList();
  startPingLoop();
});

backToMenuFromConnectBtn.addEventListener("click", () => {
  resetUIToMenu();
});

// Bağlan / Devam et
connectBtn.addEventListener("click", () => {
  const name = nameInput.value.trim();
  const roomCode = roomCodeInput.value.trim().toUpperCase();

  joinError.style.display = "none";
  joinError.textContent = "";

  if (!mode) {
    joinError.style.display = "block";
    joinError.textContent = "Önce ana menüden bir seçenek seçmelisin.";
    return;
  }

  if (!name) {
    joinError.style.display = "block";
    joinError.textContent = "Lütfen bir isim girin.";
    return;
  }

  // Nick'i kaydet
  localStorage.setItem("bdp_name", name);

  if (mode === "host") {
    const roomName = roomNameInput ? roomNameInput.value.trim() : "";
    const roomPassword = roomPasswordInput ? roomPasswordInput.value.trim() : "";
    socket.emit("createRoom", {
      name,
      roomName,
      password: roomPassword,
      deviceId
    });
  } else {
    if (!roomCode) {
      joinError.style.display = "block";
      joinError.textContent = "Odaya katılmak için oda kodu girmelisin.";
      return;
    }
    socket.emit("joinRoom", {
      name,
      roomCode,
      deviceId
    });
  }
});

// Lobby hazırım (toggle)
lobbyReadyBtn.addEventListener("click", () => {
  const newReady = !myLobbyReady;
  socket.emit("lobbyReadyToggle", { ready: newReady });
});

// Rol seç ekranını aç
openRoleSelectBtn.addEventListener("click", () => {
  roleError.style.display = "none";
  roleError.textContent = "";
  openOverlay("roles");
});

// Rol kartlarına tıklama
const roleCards = document.querySelectorAll(".role-card");
roleCards.forEach((card) => {
  card.addEventListener("click", function () {
    const role = this.getAttribute("data-role");
    roleError.style.display = "none";
    roleError.textContent = "";
    socket.emit("chooseRole", { role });
    closeOverlay();
  });
});

// CASE kartları
const caseCards = document.querySelectorAll(".case-card");
caseCards.forEach((card) => {
  card.addEventListener("click", function () {
    selectedCaseId = this.getAttribute("data-case-id");
  });
});

// Case seçimi - overlay aç
selectCaseBtn.addEventListener("click", () => {
  roleError.style.display = "none";
  roleError.textContent = "";
  openOverlay("cases");
});

// Begin Investigation -> seçili case'i sunucuya gönder
beginInvestigationBtn.addEventListener("click", () => {
  if (!myRoomCode) {
    showLobbyInfo("Önce bir odaya bağlı olmalısın.");
    return;
  }
  socket.emit("selectCase", { caseId: selectedCaseId });
  closeOverlay();
});

// Oyunu başlat (sadece host)
startGameBtn.addEventListener("click", () => {
  socket.emit("startGame");
});

// Ana menüye dön (lobiden)
backToMenuBtn.addEventListener("click", () => {
  socket.emit("leaveRoom");
  resetUIToMenu();
});

// Faz hazır
phaseReadyBtn.addEventListener("click", () => {
  if (currentPhase >= 1 && currentPhase <= 3) {
    socket.emit("phaseReady", { phase: currentPhase });
    phaseReadyBtn.disabled = true;
    phaseInfo.style.display = "block";
    phaseInfo.textContent = "Hazır olarak işaretlendi. Diğer oyuncu bekleniyor...";
  }
});

// Cevap gönder
submitAnswerBtn.addEventListener("click", () => {
  const ans = answerInput.value.trim();
  if (!ans) {
    finalInfo.style.display = "block";
    finalInfo.textContent = "Önce bir cevap yazmalısın.";
    return;
  }
  socket.emit("submitAnswer", { answer: ans });
  finalInfo.style.display = "block";
  finalInfo.textContent = "Cevabın gönderildi. Diğer oyuncu bekleniyor...";
  submitAnswerBtn.disabled = true;
  answerInput.disabled = true;
});

// Chat gönder
if (chatSendBtn) {
  chatSendBtn.addEventListener("click", () => {
    sendChatMessage();
  });
}

if (chatInput) {
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendChatMessage();
    }
  });
}

// Room list refresh
if (refreshRoomsBtn) {
  refreshRoomsBtn.addEventListener("click", () => {
    requestRoomList();
  });
}

// Voice buttons
if (joinVoiceBtn) {
  joinVoiceBtn.addEventListener("click", () => {
    joinVoice();
  });
}
if (muteToggleBtn) {
  muteToggleBtn.addEventListener("click", () => {
    toggleMute();
  });
}
if (leaveVoiceBtn) {
  leaveVoiceBtn.addEventListener("click", () => {
    leaveVoice();
  });
}

// --- Sunucudan gelenler --- //

socket.on("welcome", (data) => {
  myId = data.id;
});

socket.on("roomCreated", (payload) => {
  myRoomCode = payload.roomCode;
  roomCodeDisplay.textContent = myRoomCode;
});

socket.on("joinSuccess", (data) => {
  connectionSection.style.display = "none";
  lobbySection.style.display = "block";
    if (lobbyLayout) {
    lobbyLayout.style.display = "grid"; // CSS’te zaten grid layout var
  }
  myRoomCode = data.roomCode || myRoomCode;
  myRole = data.role || null;
  updateMyRoleInfo();
  if (myRoomCode) {
    roomCodeDisplay.textContent = myRoomCode;
  }

  // join ekranından çıktık, ping loop durabilir
  stopPingLoop();

  // Host ise "Oyunu Başlat" butonu görünsün
  if (data.isHost) {
    startGameBtn.style.display = "inline-flex";
  } else {
    startGameBtn.style.display = "none";
  }
});

socket.on("joinError", (msg) => {
  joinError.style.display = "block";
  joinError.textContent = msg;
});

socket.on("roleError", (msg) => {
  roleError.style.display = "block";
  roleError.textContent = msg;
});

socket.on("playersUpdate", (data) => {
  const players = data.players || [];

  // Kendi rol ve hazır durumumu güncelle
  let me = null;
  for (let i = 0; i < players.length; i++) {
    if (players[i].id === myId) {
      me = players[i];
      break;
    }
  }

  if (me) {
    myRole = me.role || null;
    myLobbyReady = !!me.lobbyReady;
    lobbyReadyBtn.textContent = myLobbyReady ? "Hazır değilim" : "Hazırım";
    updateMyRoleInfo();

    // Host isem Oyunu Başlat butonu görünsün
    if (me.isHost) {
      startGameBtn.style.display = "inline-flex";
    } else {
      startGameBtn.style.display = "none";
    }
  }

  let listHtml = "";
  for (let j = 0; j < players.length; j++) {
    const p = players[j];

    let roleLabel;
    if (p.role === "dedektif") roleLabel = "Baş Dedektif";
    else if (p.role === "polis") roleLabel = "Polis";
    else roleLabel = "Rol seçilmedi";

    let readyHtml = "";
    if (currentPhase === 0) {
      readyHtml = p.lobbyReady
        ? '<span class="tag ready">Hazır</span>'
        : '<span class="tag">Hazır değil</span>';
    } else {
      readyHtml =
        p.readyPhase > 0
          ? '<span class="tag ready">Hazır</span>'
          : '<span class="tag">Hazır değil</span>';
    }

    const hostHtml = p.isHost
      ? '<span class="host-label">HOST</span>'
      : "";

    let kickHtml = "";
    if (me && me.isHost && p.id !== myId) {
      kickHtml =
        ' <span class="kick-link" data-kick-id="' +
        p.id +
        '">Kick</span>';
    }
const voiceHtml = p.inVoice ? " 🎧" : "";
    listHtml +=
      p.name +
      " (" +
      roleLabel +
      ") " +
      hostHtml +
      " " +
      readyHtml +
      kickHtml +
      "<br/>";
  }

  playersList.innerHTML = listHtml || "Henüz kimse yok.";

  // Kick link eventleri
  if (me && me.isHost) {
    const kickLinks = playersList.querySelectorAll(".kick-link");
    kickLinks.forEach((el) => {
      el.addEventListener("click", function () {
        const targetId = this.getAttribute("data-kick-id");
        if (!targetId) return;
        const sure = window.confirm(
          "Bu oyuncuyu odadan atmak istediğine emin misin?"
        );
        if (!sure) return;
        socket.emit("kickPlayer", { targetId });
      });
    });
  }
});

socket.on("lobbyMessage", (msg) => {
  showLobbyInfo(msg);
  addChatMessage({
    from: "Sistem",
    text: msg,
    time: Date.now(),
    isSystem: true
  });
});

socket.on("kicked", (data) => {
  const reason = (data && data.reason) || "Host seni odadan attı.";
  alert(reason);
  resetUIToMenu();
});

socket.on("gameStarting", () => {
  showLobbyInfo("Oyun 3 saniye içinde başlıyor...");
});

socket.on("caseSelected", (data) => {
  showLobbyInfo("Seçilen vaka: " + data.title);
  selectCaseBtn.textContent = "Vaka: " + data.title;
});

socket.on("phaseData", (data) => {
  currentPhase = data.phase;
  phaseInfo.style.display = "none";
  phaseReadyBtn.disabled = false;

  if (data.phase >= 1 && data.phase <= 3) {
    finalSection.style.display = "none";
    resultSection.style.display = "none";
    phaseSection.style.display = "block";

    phaseTitle.textContent = data.phase + ". Bölüm";
    phaseContent.textContent = data.clue;
  } else if (data.phase === 4) {
    phaseSection.style.display = "none";
    resultSection.style.display = "none";
    finalSection.style.display = "block";

    finalQuestion.textContent = data.finalQuestion;
    finalInfo.style.display = "none";
    submitAnswerBtn.disabled = false;
    answerInput.disabled = false;
    answerInput.value = "";
  }
});

socket.on("finalResult", (data) => {
  resultSection.style.display = "block";
  finalSection.style.display = "none";

  if (data.success) {
    resultText.textContent =
      "TEBRİKLER! Doğru cevabı buldunuz: " +
      data.correctAnswer.toUpperCase();
  } else {
    resultText.textContent = "Cevaplar yanlış. Tekrar deneyebilirsiniz.";
    submitAnswerBtn.disabled = false;
    answerInput.disabled = false;
    finalSection.style.display = "block";
  }
});

// Oda listesi
socket.on("roomList", (data) => {
  if (!roomListContainer) return;
  const rooms = data.rooms || [];
  if (!rooms.length) {
    roomListContainer.innerHTML = "Şu anda açık oda yok.";
    return;
  }

  let html = "";
  rooms.forEach((r) => {
    const lockIcon = r.isPrivate ? "🔒" : "🔓";
    const statusLabel = r.status === "LOBBY" ? "Lobby" : "Oyunda";
    html += `
      <div class="room-list-item" data-room-code="${r.roomCode}" data-private="${r.isPrivate}">
        <div class="room-list-top">
          <span class="room-list-name">${lockIcon} ${r.name}</span>
          <span class="room-list-players">${r.currentPlayers}/${r.maxPlayers}</span>
        </div>
        <div class="room-list-meta">
          Kod: ${r.roomCode} · Durum: ${statusLabel}
          ${r.caseTitle ? " · Vaka: " + r.caseTitle : ""}
        </div>
      </div>
    `;
  });

  roomListContainer.innerHTML = html;

  const items = roomListContainer.querySelectorAll(".room-list-item");
  items.forEach((el) => {
    el.addEventListener("click", function () {
      const code = this.getAttribute("data-room-code");
      const isPrivate = this.getAttribute("data-private") === "true";

      roomCodeInput.value = code;

      const name = nameInput.value.trim();
      if (!name) {
        joinError.style.display = "block";
        joinError.textContent = "Önce bir isim girin, sonra odaya katılabilirsiniz.";
        return;
      }

      if (!isPrivate) {
        socket.emit("joinRoom", { name, roomCode: code, deviceId });
      } else {
        openPasswordPromptForRoom(code);
      }
    });
  });
});

// ping cevabı
socket.on("pongCheck", (data) => {
  if (!data || !data.sentAt) return;
  const rtt = Date.now() - data.sentAt;
  lastPingMs = rtt;
  updatePingLabel(rtt);
});

// Chat mesajı
socket.on("chatMessage", (data) => {
  addChatMessage(data);
});

// Voice signaling
socket.on("voiceNewPeer", async ({ peerId, polite }) => {
  const pc = createPeerConnection(peerId);
  peers[peerId] = pc;

  if (!polite && localAudioStream) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("voiceOffer", {
      to: peerId,
      description: pc.localDescription
    });
  }
});

socket.on("voiceOffer", async ({ from, description }) => {
  let pc = peers[from];
  if (!pc) {
    pc = createPeerConnection(from);
    peers[from] = pc;
  }

  await pc.setRemoteDescription(description);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  socket.emit("voiceAnswer", {
    to: from,
    description: pc.localDescription
  });
});

socket.on("voiceAnswer", async ({ from, description }) => {
  const pc = peers[from];
  if (!pc) return;
  await pc.setRemoteDescription(description);
});

socket.on("voiceIceCandidate", async ({ from, candidate }) => {
  const pc = peers[from];
  if (!pc) return;
  try {
    await pc.addIceCandidate(candidate);
  } catch (err) {
    console.error("ICE candidate eklenemedi:", err);
  }
});

socket.on("voicePeerLeft", ({ peerId }) => {
  const pc = peers[peerId];
  if (pc) pc.close();
  delete peers[peerId];

  const audioEl = document.getElementById("audio_" + peerId);
  if (audioEl) audioEl.remove();
});

// --- Paylaşım / link oluşturma --- //

function buildRoomLink() {
  if (!myRoomCode) return window.location.origin;
  return window.location.origin + "?room=" + myRoomCode;
}

copyLinkBtn.addEventListener("click", () => {
  const link = buildRoomLink();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(link).then(
      () => {
        showLobbyInfo("Oda linki panoya kopyalandı.");
      },
      () => {
        showLobbyInfo("Link kopyalanamadı, elle kopyalamayı deneyin: " + link);
      }
    );
  } else {
    showLobbyInfo("Tarayıcı kopyalama desteği yok. Link: " + link);
  }
});

inviteFriendBtn.addEventListener("click", () => {
  const link = buildRoomLink();
  const text =
    "Baş Dedektif & Polis oyununda odama katıl! Oda kodu: " +
    (myRoomCode || "—") +
    " · Link: " +
    link;

  if (navigator.share) {
    navigator
      .share({
        title: "Baş Dedektif & Polis",
        text,
        url: link
      })
      .catch(() => {});
  } else {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => {
          showLobbyInfo(
            "Davet metni panoya kopyalandı, istediğin yere yapıştırabilirsin."
          );
        },
        () => {
          showLobbyInfo("Paylaşım desteklenmiyor. Metin: " + text);
        }
      );
    } else {
      showLobbyInfo("Paylaşım desteklenmiyor. Metin: " + text);
    }
  }
});
