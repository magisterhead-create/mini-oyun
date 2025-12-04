const socket = io();

// Her tarayıcı için kalıcı bir cihaz ID'si
let deviceId = null;
try {
  deviceId = localStorage.getItem("bdp_device_id");
  if (!deviceId) {
    deviceId = "dev_" + Math.random().toString(36).substring(2, 11);
    localStorage.setItem("bdp_device_id", deviceId);
  }
} catch (e) {
  deviceId = "dev_" + Math.random().toString(36).substring(2, 11);
}

// =============================
// DOM ELEMANLARI
// =============================

// --- Oyun ekranı (yeni UI) --- //
const gameSection = document.getElementById("gameScreen");
const gameTimerDisplay = document.getElementById("gameTimer");
const gameRoleLabel = document.getElementById("gameRoleLabel");

const gamePlayersList = document.getElementById("gamePlayersList");
const gameTabContent = document.getElementById("gameTabContent");

const backToMenuGameBtn = document.getElementById("backToMenuGameBtn");

const tabRoleMainBtn = document.getElementById("tabRoleBtn");
const tabRoleSpecialBtn = document.getElementById("tabRoleActionBtn");
const tabSharedBoardBtn = document.getElementById("tabBoardBtn");
const tabNotesBtn = document.getElementById("tabNotesBtn");
const tabSettingsBtn = document.getElementById("tabSettingsBtn");


// Menü
const menuSection = document.getElementById("menuSection");
const hostBtn = document.getElementById("hostBtn");
const joinMenuBtn = document.getElementById("joinMenuBtn");
const settingsBtn = document.getElementById("settingsBtn");
const settingsPanel = document.getElementById("settingsPanel");
const howToBtn = document.getElementById("howToBtn");
const creditsBtn = document.getElementById("creditsBtn");

// Overlay (HowTo / Credits / Role / Case)
const overlayBackdrop = document.getElementById("overlayBackdrop");
const howToOverlay = document.getElementById("howToOverlay");
const creditsOverlay = document.getElementById("creditsOverlay");
const roleSelectOverlay = document.getElementById("roleSelectOverlay");
const overlayCloseBtn1 = document.getElementById("overlayCloseBtn1");
const overlayCloseBtn2 = document.getElementById("overlayCloseBtn2");
const roleOverlayCloseBtn = document.getElementById("roleOverlayCloseBtn");

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

// Lobby layout
const lobbyLayout = document.getElementById("lobbyLayout");
if (lobbyLayout) lobbyLayout.style.display = "none";

// Lobby
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

// Eski faz / final / result (şimdilik altyapı dursun)
const phaseSection = document.getElementById("phaseSection");
const phaseTitle = document.getElementById("phaseTitle");
const phaseContent = document.getElementById("phaseContent");
const phaseReadyBtn = document.getElementById("phaseReadyBtn");
const phaseInfo = document.getElementById("phaseInfo");

const finalSection = document.getElementById("finalSection");
const finalQuestion = document.getElementById("finalQuestion");
const answerInput = document.getElementById("answerInput");
const submitAnswerBtn = document.getElementById("submitAnswerBtn");
const finalInfo = document.getElementById("finalInfo");

const resultSection = document.getElementById("resultSection");
const resultText = document.getElementById("resultText");

// Lobby chat

const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const chatSendBtn = document.getElementById("chatSendBtn");
const chatPlayersList = document.getElementById("chatPlayersList");

// Voice controls
const joinVoiceBtn = document.getElementById("joinVoiceBtn");
const muteToggleBtn = document.getElementById("muteToggleBtn");
const leaveVoiceBtn = document.getElementById("leaveVoiceBtn");

// =============================
// STATE
// =============================

let myId = null;
let myRole = null;
let myRoomCode = null;
let currentPhase = 0;
let mode = null; // "host" | "join"
let myLobbyReady = false;

let selectedCaseId = null;
let currentCaseRoles = [];

let lastPingMs = null;
let pingIntervalId = null;

// Voice / WebRTC
let localAudioStream = null;
let peers = {}; // peerId -> RTCPeerConnection
let isMuted = false;
let listenOnly = false;

// Yeni oyun ekranı state
let inGame = false;
let currentGameTab = "roleMain";
let gameTimerSeconds = 30 * 60;
let gameTimerInterval = null;
let sharedBoardText = "";
let notesText = "";

// =============================
// ROL KONFİG (özel sekme isimleri)
// =============================

const ROLE_CONFIG = {
  dedektif: {
    displayName: "Baş Dedektif",
    specialTabLabel: "Analiz",
    description: "İpuçlarını birleştirip büyük resmi gören zihin."
  },
  polis: {
    displayName: "Polis",
    specialTabLabel: "Sorgu",
    description: "Şüphelileri sorgulayan, sahadaki baskı gücü."
  },
  ajan: {
    displayName: "Ajan",
    specialTabLabel: "İstihbarat",
    description: "Gizli bilgilere ulaşıp perde arkasını çözmeye çalışan rol."
  },
  güvenlik: {
    displayName: "Güvenlik",
    specialTabLabel: "Gözetim",
    description: "Kamera kayıtlarını ve güvenlik açıklarını inceleyen oyuncu."
  }
};

// =============================
// KALICI İSİM (localStorage + cookie)
// =============================

function setCookie(name, value, days) {
  try {
    const d = new Date();
    d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
    const expires = "expires=" + d.toUTCString();
    document.cookie = name + "=" + encodeURIComponent(value) + ";" + expires + ";path=/";
  } catch (e) {}
}

function getCookie(name) {
  try {
    const cname = name + "=";
    const decoded = decodeURIComponent(document.cookie || "");
    const parts = decoded.split(";");
    for (let c of parts) {
      c = c.trim();
      if (c.indexOf(cname) === 0) {
        return c.substring(cname.length);
      }
    }
  } catch (e) {}
  return "";
}

function savePlayerName(name) {
  try {
    localStorage.setItem("bdp_name", name);
  } catch (e) {}
  setCookie("bdp_name", name, 365);
}

function loadPlayerName() {
  let n = "";
  try {
    n = localStorage.getItem("bdp_name") || "";
  } catch (e) {
    n = "";
  }
  if (!n) n = getCookie("bdp_name") || "";
  return n;
}

// Sayfa açıldığında kayıtlı nick'i yükle
const savedName = loadPlayerName();
if (savedName && nameInput) {
  nameInput.value = savedName;
}

// =============================
// YARDIMCI FONKSİYONLAR
// =============================

function formatSeconds(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}

function startGameTimer() {
  gameTimerSeconds = 30 * 60;
  if (gameTimerInterval) clearInterval(gameTimerInterval);

  if (gameTimerDisplay) {
    gameTimerDisplay.textContent = formatSeconds(gameTimerSeconds);
  }

  gameTimerInterval = setInterval(() => {
    gameTimerSeconds -= 1;
    if (gameTimerSeconds <= 0) {
      gameTimerSeconds = 0;
      clearInterval(gameTimerInterval);
      gameTimerInterval = null;
      if (gameTimerDisplay) {
        gameTimerDisplay.textContent = "00:00";
      }
      showLobbyInfo("Süre doldu! İsterseniz yeni bir oyun başlatabilirsiniz.");
    } else if (gameTimerDisplay) {
      gameTimerDisplay.textContent = formatSeconds(gameTimerSeconds);
    }
  }, 1000);
}

function updateMyRoleInfo() {
  let text;
  if (myRole === "dedektif") text = "Rolün: Baş Dedektif";
  else if (myRole === "polis") text = "Rolün: Polis";
  else if (myRole === "ajan") text = "Rolün: Ajan";
  else if (myRole === "güvenlik") text = "Rolün: Güvenlik";
  else text = "Rolün: (henüz seçilmedi)";

  if (myRoleInfo) myRoleInfo.textContent = text;
  updateGameRoleUI();
}

function updateGameRoleUI() {
  const cfg = ROLE_CONFIG[myRole] || null;
  const roleLabel = cfg ? cfg.displayName : (myRole || "Rol");
  const specialLabel = cfg ? cfg.specialTabLabel : "Özel Görev";

  if (tabRoleMainBtn) tabRoleMainBtn.textContent = roleLabel;
  if (tabRoleSpecialBtn) tabRoleSpecialBtn.textContent = specialLabel;
  if (gameRoleLabel) gameRoleLabel.textContent = roleLabel;

  if (inGame) renderCurrentTab();
}

function showLobbyInfo(msg) {
  if (!lobbyMessage) return;
  lobbyMessage.style.display = "block";
  lobbyMessage.textContent = msg;
}

function updatePingLabel(ms) {
  if (!pingLabel) return;
  if (ms == null) pingLabel.textContent = "-";
  else pingLabel.textContent = ms + " ms";
}

function startPingLoop() {
  if (pingIntervalId) return;
  const sendPing = () => socket.emit("pingCheck", { sentAt: Date.now() });
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

function highlightSelectedCase(caseId) {
  const cards = document.querySelectorAll(".case-card");
  cards.forEach((card) => {
    const id = card.getAttribute("data-case-id");
    if (id === caseId) {
      card.classList.add("selected");
    } else {
      card.classList.remove("selected");
    }
  });
}

function resetUIToMenu() {
  // Oyun ekranı reset
  if (gameSection) gameSection.style.display = "none";
  inGame = false;
  sharedBoardText = "";
  notesText = "";
  if (gameTimerInterval) {
    clearInterval(gameTimerInterval);
    gameTimerInterval = null;
  }
  if (gameTimerDisplay) gameTimerDisplay.textContent = "30:00";

  // Ana layout
  if (menuSection) menuSection.style.display = "block";
  if (connectionSection) connectionSection.style.display = "none";
  if (lobbySection) lobbySection.style.display = "none";
  if (phaseSection) phaseSection.style.display = "none";
  if (finalSection) finalSection.style.display = "none";
  if (resultSection) resultSection.style.display = "none";
  if (lobbyLayout) lobbyLayout.style.display = "none";

  if (joinError) {
    joinError.style.display = "none";
    joinError.textContent = "";
  }
  if (lobbyMessage) {
    lobbyMessage.style.display = "none";
    lobbyMessage.textContent = "";
  }
  if (playersList) playersList.innerHTML = "";
  if (roomCodeDisplay) roomCodeDisplay.textContent = "— — — — —";
  if (myRoleInfo) myRoleInfo.textContent = "";
  if (resultText) resultText.textContent = "";
  if (finalInfo) {
    finalInfo.style.display = "none";
    finalInfo.textContent = "";
  }
  if (roleError) {
    roleError.style.display = "none";
    roleError.textContent = "";
  }
  if (phaseInfo) {
    phaseInfo.style.display = "none";
    phaseInfo.textContent = "";
  }
  if (phaseReadyBtn) phaseReadyBtn.disabled = false;
  if (submitAnswerBtn) submitAnswerBtn.disabled = false;
  if (answerInput) {
    answerInput.disabled = false;
    answerInput.value = "";
  }
  if (roomCodeInput) roomCodeInput.value = "";
  if (roomNameInput) roomNameInput.value = "";
  if (roomPasswordInput) roomPasswordInput.value = "";
  if (chatMessages) chatMessages.innerHTML = "";
  if (chatInput) chatInput.value = "";

  myRoomCode = null;
  myRole = null;
  currentPhase = 0;
  mode = null;
  myLobbyReady = false;

  if (lobbyReadyBtn) {
    lobbyReadyBtn.disabled = false;
    lobbyReadyBtn.textContent = "Hazırım";
  }
  if (startGameBtn) {
    startGameBtn.disabled = false;
    startGameBtn.style.display = "none";
  }

  // case sıfır
  if (selectCaseBtn) selectCaseBtn.textContent = "Case seçiniz";
  selectedCaseId = null;
  currentCaseRoles = [];
  if (openRoleSelectBtn) openRoleSelectBtn.disabled = true;
  highlightSelectedCase(null);

  // ping & oda listesi
  stopPingLoop();
  if (roomListContainer) {
    roomListContainer.innerHTML = "Şu anda açık oda yok.";
  }

  // voice temizle
  cleanupVoice();
}

// =============================
// OVERLAY LOGIC
// =============================

function openOverlay(which) {
  if (!overlayBackdrop) return;
  overlayBackdrop.style.display = "flex";
  if (howToOverlay) howToOverlay.style.display = "none";
  if (creditsOverlay) creditsOverlay.style.display = "none";
  if (roleSelectOverlay) roleSelectOverlay.style.display = "none";
  if (caseSelectOverlay) caseSelectOverlay.style.display = "none";

  if (which === "howto" && howToOverlay) howToOverlay.style.display = "block";
  else if (which === "credits" && creditsOverlay) creditsOverlay.style.display = "block";
  else if (which === "roles" && roleSelectOverlay) roleSelectOverlay.style.display = "block";
  else if (which === "cases" && caseSelectOverlay) caseSelectOverlay.style.display = "block";
}

function closeOverlay() {
  if (overlayBackdrop) overlayBackdrop.style.display = "none";
  if (howToOverlay) howToOverlay.style.display = "none";
  if (creditsOverlay) creditsOverlay.style.display = "none";
  if (roleSelectOverlay) roleSelectOverlay.style.display = "none";
  if (caseSelectOverlay) caseSelectOverlay.style.display = "none";
}

// =============================
// GAME TABS
// =============================

function setActiveTab(tabName) {
  currentGameTab = tabName;
  const buttons = document.querySelectorAll(".game-tab-btn");
  buttons.forEach((btn) => {
    const id = btn.id;
    let thisTab = null;
    if (id === "tabRoleBtn") thisTab = "roleMain";
    else if (id === "tabRoleActionBtn") thisTab = "roleSpecial";
    else if (id === "tabBoardBtn") thisTab = "sharedBoard";
    else if (id === "tabNotesBtn") thisTab = "notes";
    else if (id === "tabSettingsBtn") thisTab = "settings";

    if (thisTab === tabName) btn.classList.add("active");
    else btn.classList.remove("active");
  });

  renderCurrentTab();
}

function renderCurrentTab() {
  if (!gameTabContent) return;
  const cfg = ROLE_CONFIG[myRole] || null;

  gameTabContent.innerHTML = "";

  if (currentGameTab === "roleMain") {
    const roleLabel = cfg ? cfg.displayName : (myRole || "Rol");
    const desc = cfg
      ? cfg.description
      : "Rolünle ilgili detaylar burada gözükecek.";
    gameTabContent.innerHTML = `
      <h3>${roleLabel}</h3>
      <p style="font-size:13px; color: var(--text-muted);">
        ${desc}
      </p>
    `;
  } else if (currentGameTab === "roleSpecial") {
    const specialLabel = cfg ? cfg.specialTabLabel : "Özel Görev";
    gameTabContent.innerHTML = `
      <h3>${specialLabel}</h3>
      <p style="font-size:13px; color: var(--text-muted);">
        Bu rolde sana özel görevler burada görünecek. Şimdilik placeholder.
      </p>
    `;
  } else if (currentGameTab === "sharedBoard") {
    gameTabContent.innerHTML = `
      <div class="label">Ortak Tahta</div>
      <textarea
        id="sharedBoardTextarea"
        class="board-textarea"
        placeholder="Bulduğun ipuçlarını buraya yaz; tüm oyuncular görebilir."
      ></textarea>
      <button
        id="sharedBoardSaveBtn"
        class="btn-primary btn-small"
        style="margin-top:8px;"
      >
        Kaydet
      </button>
      <div class="setup-note">
        Bu alan odadaki tüm oyuncularla ortaktır.
      </div>
    `;
    const ta = document.getElementById("sharedBoardTextarea");
    const btn = document.getElementById("sharedBoardSaveBtn");
    if (ta) ta.value = sharedBoardText || "";
    if (btn && ta) {
      btn.addEventListener("click", () => {
        const content = ta.value;
        sharedBoardText = content;
        socket.emit("updateSharedBoard", { content });
      });
    }
  } else if (currentGameTab === "notes") {
    gameTabContent.innerHTML = `
      <div class="label">Kişisel Notların</div>
      <textarea
        id="notesTextarea"
        class="board-textarea"
        placeholder="Kendi notlarını buraya yaz; sadece sen göreceksin."
      ></textarea>
      <div class="setup-note">
        Bu notlar sadece bu cihazda saklanır.
      </div>
    `;
    const ta = document.getElementById("notesTextarea");
    if (ta) {
      ta.value = notesText || "";
      ta.addEventListener("input", () => {
        notesText = ta.value;
      });
    }
  } else if (currentGameTab === "settings") {
    gameTabContent.innerHTML = `
      <h3>Ayarlar</h3>
      <p style="font-size:13px; color: var(--text-muted);">
        Bu alanı ileride oyun içi ayarlar için kullanacağız.
      </p>
    `;
  }
}

// =============================
// CHAT
// =============================

function sendChatMessage() {
  if (!chatInput) return;
  const text = chatInput.value.trim();
  if (!text) return;
  socket.emit("sendChat", { message: text });
  chatInput.value = "";
}

// =============================
// VOICE / WEBRTC
// =============================

async function joinVoice() {
  if (localAudioStream || listenOnly) return;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true }
    });

    localAudioStream = stream;
    listenOnly = false;

    if (joinVoiceBtn) joinVoiceBtn.style.display = "none";
    if (muteToggleBtn) {
      muteToggleBtn.style.display = "inline-flex";
      muteToggleBtn.textContent = "🔇 Mute";
    }
    if (leaveVoiceBtn) leaveVoiceBtn.style.display = "inline-flex";

    socket.emit("joinVoice", { listenOnly: false });
  } catch (err) {
    console.warn("Mikrofon alınamadı, dinleyici moda geçiliyor:", err.name, err.message);
    listenOnly = true;
    localAudioStream = null;

    if (joinVoiceBtn) joinVoiceBtn.style.display = "none";
    if (muteToggleBtn) muteToggleBtn.style.display = "none";
    if (leaveVoiceBtn) leaveVoiceBtn.style.display = "inline-flex";

    addChatMessage({
      from: "Sistem",
      text: "Bu cihazda kullanılabilir mikrofon bulunamadı. Sesli sohbeti sadece dinleyici olarak kullanıyorsun.",
      time: Date.now(),
      isSystem: true
    });

    socket.emit("joinVoice", { listenOnly: true });
  }
}

function toggleMute() {
  if (!localAudioStream) return;
  isMuted = !isMuted;
  localAudioStream.getAudioTracks().forEach((t) => (t.enabled = !isMuted));
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

// =============================
// EVENT LISTENERS
// =============================

// Game tab buttons
if (tabRoleMainBtn) tabRoleMainBtn.addEventListener("click", () => setActiveTab("roleMain"));
if (tabRoleSpecialBtn) tabRoleSpecialBtn.addEventListener("click", () => setActiveTab("roleSpecial"));
if (tabSharedBoardBtn) tabSharedBoardBtn.addEventListener("click", () => setActiveTab("sharedBoard"));
if (tabNotesBtn) tabNotesBtn.addEventListener("click", () => setActiveTab("notes"));
if (tabSettingsBtn) tabSettingsBtn.addEventListener("click", () => setActiveTab("settings"));

// Overlay buttons
if (howToBtn) howToBtn.addEventListener("click", () => openOverlay("howto"));
if (creditsBtn) creditsBtn.addEventListener("click", () => openOverlay("credits"));
if (overlayCloseBtn1) overlayCloseBtn1.addEventListener("click", closeOverlay);
if (overlayCloseBtn2) overlayCloseBtn2.addEventListener("click", closeOverlay);
if (roleOverlayCloseBtn) roleOverlayCloseBtn.addEventListener("click", closeOverlay);
if (caseOverlayCloseBtn) caseOverlayCloseBtn.addEventListener("click", closeOverlay);

if (overlayBackdrop) {
  overlayBackdrop.addEventListener("click", (e) => {
    if (e.target === overlayBackdrop) closeOverlay();
  });
}

// Settings toggle
if (settingsBtn) {
  settingsBtn.addEventListener("click", () => {
    if (!settingsPanel) return;
    settingsPanel.style.display =
      settingsPanel.style.display === "none" || !settingsPanel.style.display
        ? "block"
        : "none";
  });
}

// Menü butonları
if (hostBtn) {
  hostBtn.addEventListener("click", () => {
    mode = "host";
    if (menuSection) menuSection.style.display = "none";
    if (connectionSection) connectionSection.style.display = "block";
    if (roomCodeGroup) roomCodeGroup.style.display = "none";
    if (hostExtraGroup) hostExtraGroup.style.display = "block";
    if (roomListPanel) roomListPanel.style.display = "none";
    stopPingLoop();
  });
}

if (joinMenuBtn) {
  joinMenuBtn.addEventListener("click", () => {
    mode = "join";
    if (menuSection) menuSection.style.display = "none";
    if (connectionSection) connectionSection.style.display = "block";
    if (roomCodeGroup) roomCodeGroup.style.display = "block";
    if (hostExtraGroup) hostExtraGroup.style.display = "none";
    if (roomListPanel) roomListPanel.style.display = "block";
    requestRoomList();
    startPingLoop();
  });
}

if (backToMenuFromConnectBtn) {
  backToMenuFromConnectBtn.addEventListener("click", () => {
    resetUIToMenu();
  });
}

// Bağlan / Devam et
if (connectBtn) {
  connectBtn.addEventListener("click", () => {
    const name = (nameInput && nameInput.value.trim()) || "";
    const roomCode = (roomCodeInput && roomCodeInput.value.trim().toUpperCase()) || "";

    if (joinError) {
      joinError.style.display = "none";
      joinError.textContent = "";
    }

    if (!mode) {
      if (joinError) {
        joinError.style.display = "block";
        joinError.textContent = "Önce ana menüden bir seçenek seçmelisin.";
      }
      return;
    }

    if (!name) {
      if (joinError) {
        joinError.style.display = "block";
        joinError.textContent = "Lütfen bir isim girin.";
      }
      return;
    }

    savePlayerName(name);

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
        if (joinError) {
          joinError.style.display = "block";
          joinError.textContent = "Odaya katılmak için oda kodu girmelisin.";
        }
        return;
      }
      socket.emit("joinRoom", {
        name,
        roomCode,
        deviceId
      });
    }
  });
}

// Lobby hazırım (toggle)
if (lobbyReadyBtn) {
  lobbyReadyBtn.addEventListener("click", () => {
    const newReady = !myLobbyReady;
    socket.emit("lobbyReadyToggle", { ready: newReady });
  });
}

// Rol seç ekranını aç
if (openRoleSelectBtn) {
  openRoleSelectBtn.addEventListener("click", () => {
    if (openRoleSelectBtn.disabled) return;
    if (roleError) {
      roleError.style.display = "none";
      roleError.textContent = "";
    }
    openOverlay("roles");
  });
}

// Statik role-card'lar (ilk yüklemede belki vardır)
const staticRoleCards = document.querySelectorAll(".role-card");
staticRoleCards.forEach((card) => {
  card.addEventListener("click", function () {
    const role = this.getAttribute("data-role");
    if (roleError) {
      roleError.style.display = "none";
      roleError.textContent = "";
    }
    socket.emit("chooseRole", { role });
    closeOverlay();
  });
});

// CASE kartları
const caseCards = document.querySelectorAll(".case-card");
caseCards.forEach((card) => {
  card.addEventListener("click", function () {
    selectedCaseId = this.getAttribute("data-case-id");
    highlightSelectedCase(selectedCaseId);
  });
});

// Case seçimi - overlay aç
if (selectCaseBtn) {
  selectCaseBtn.addEventListener("click", () => {
    if (selectCaseBtn.disabled) return;
    if (roleError) {
      roleError.style.display = "none";
      roleError.textContent = "";
    }
    openOverlay("cases");
  });
}

// Begin Investigation -> seçili case'i sunucuya gönder
if (beginInvestigationBtn) {
  beginInvestigationBtn.addEventListener("click", () => {
    if (!myRoomCode) {
      showLobbyInfo("Önce bir odaya bağlı olmalısın.");
      return;
    }
    if (!selectedCaseId) {
      showLobbyInfo("Önce bir vaka seçmelisin.");
      return;
    }
    socket.emit("selectCase", { caseId: selectedCaseId });
    closeOverlay();
  });
}

// Oyunu başlat (sadece host)
if (startGameBtn) {
  startGameBtn.addEventListener("click", () => {
    socket.emit("startGame");
  });
}

// Ana menüye dön (lobiden)
if (backToMenuBtn) {
  backToMenuBtn.addEventListener("click", () => {
    socket.emit("leaveRoom");
    resetUIToMenu();
  });
}
// Oyun ekranından ana menüye dön
if (backToMenuGameBtn) {
  backToMenuGameBtn.addEventListener("click", () => {
    socket.emit("leaveRoom");
    resetUIToMenu();
  });
}

// Faz hazır
if (phaseReadyBtn) {
  phaseReadyBtn.addEventListener("click", () => {
    if (currentPhase >= 1 && currentPhase <= 3) {
      socket.emit("phaseReady", { phase: currentPhase });
      phaseReadyBtn.disabled = true;
      if (phaseInfo) {
        phaseInfo.style.display = "block";
        phaseInfo.textContent = "Hazır olarak işaretlendi. Diğer oyuncu bekleniyor...";
      }
    }
  });
}

// Cevap gönder
if (submitAnswerBtn) {
  submitAnswerBtn.addEventListener("click", () => {
    const ans = (answerInput && answerInput.value.trim()) || "";
    if (!ans) {
      if (finalInfo) {
        finalInfo.style.display = "block";
        finalInfo.textContent = "Önce bir cevap yazmalısın.";
      }
      return;
    }
    socket.emit("submitAnswer", { answer: ans });
    if (finalInfo) {
      finalInfo.style.display = "block";
      finalInfo.textContent = "Cevabın gönderildi. Diğer oyuncu bekleniyor...";
    }
    submitAnswerBtn.disabled = true;
    if (answerInput) answerInput.disabled = true;
  });
}

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
if (joinVoiceBtn) joinVoiceBtn.addEventListener("click", () => joinVoice());
if (muteToggleBtn) muteToggleBtn.addEventListener("click", () => toggleMute());
if (leaveVoiceBtn) leaveVoiceBtn.addEventListener("click", () => leaveVoice());

// Paylaşım / link
function buildRoomLink() {
  if (!myRoomCode) return window.location.origin;
  return window.location.origin + "?room=" + myRoomCode;
}

if (copyLinkBtn) {
  copyLinkBtn.addEventListener("click", () => {
    const link = buildRoomLink();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(
        () => showLobbyInfo("Oda linki panoya kopyalandı."),
        () => showLobbyInfo("Link kopyalanamadı, elle kopyalamayı deneyin: " + link)
      );
    } else {
      showLobbyInfo("Tarayıcı kopyalama desteği yok. Link: " + link);
    }
  });
}

if (inviteFriendBtn) {
  inviteFriendBtn.addEventListener("click", () => {
    const link = buildRoomLink();
    const text =
      "Baş Dedektif & Polis oyununda odama katıl! Oda kodu: " +
      (myRoomCode || "—") +
      " · Link: " +
      link;

    if (navigator.share) {
      navigator
        .share({ title: "Baş Dedektif & Polis", text, url: link })
        .catch(() => {});
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () =>
          showLobbyInfo(
            "Davet metni panoya kopyalandı, istediğin yere yapıştırabilirsin."
          ),
        () => showLobbyInfo("Paylaşım desteklenmiyor. Metin: " + text)
      );
    } else {
      showLobbyInfo("Paylaşım desteklenmiyor. Metin: " + text);
    }
  });
}

// =============================
// SOCKET.IO EVENTLERİ
// =============================

socket.on("welcome", (data) => {
  myId = data.id;
});

socket.on("roomCreated", (payload) => {
  myRoomCode = payload.roomCode;
  if (roomCodeDisplay) roomCodeDisplay.textContent = myRoomCode;
});

socket.on("joinSuccess", (data) => {
  if (connectionSection) connectionSection.style.display = "none";
  if (lobbySection) lobbySection.style.display = "block";
  if (lobbyLayout) lobbyLayout.style.display = "grid";

  myRoomCode = data.roomCode || myRoomCode;
  myRole = data.role || null;
  updateMyRoleInfo();
  if (myRoomCode && roomCodeDisplay) roomCodeDisplay.textContent = myRoomCode;

  stopPingLoop();

  if (data.isHost) {
    if (startGameBtn) startGameBtn.style.display = "inline-flex";
    if (selectCaseBtn) selectCaseBtn.disabled = false;
  } else {
    if (startGameBtn) startGameBtn.style.display = "none";
    if (selectCaseBtn) selectCaseBtn.disabled = true;
  }
});

socket.on("joinError", (msg) => {
  if (!joinError) return;
  joinError.style.display = "block";
  joinError.textContent = msg;
});

socket.on("roleError", (msg) => {
  if (!roleError) return;
  roleError.style.display = "block";
  roleError.textContent = msg;
});

socket.on("playersUpdate", (data) => {
  const players = data.players || [];

  let me = null;
  for (let p of players) {
    if (p.id === myId) {
      me = p;
      break;
    }
  }

  if (me) {
    myRole = me.role || null;
    myLobbyReady = !!me.lobbyReady;
    if (lobbyReadyBtn)
      lobbyReadyBtn.textContent = myLobbyReady ? "Hazır değilim" : "Hazırım";
    updateMyRoleInfo();

    if (me.isHost) {
      if (startGameBtn) startGameBtn.style.display = "inline-flex";
      // host case seçebilir
      if (selectCaseBtn) selectCaseBtn.disabled = false;
    } else {
      if (startGameBtn) startGameBtn.style.display = "none";
      if (selectCaseBtn) selectCaseBtn.disabled = true;
    }
  }

  let listHtml = "";
  players.forEach((p) => {
    let roleLabel;
    if (p.role === "dedektif") roleLabel = "Baş Dedektif";
    else if (p.role === "polis") roleLabel = "Polis";
    else if (p.role === "ajan") roleLabel = "Ajan";
    else if (p.role === "güvenlik") roleLabel = "Güvenlik";
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

    const hostHtml = p.isHost ? '<span class="host-label">HOST</span>' : "";
    const voiceHtml = p.inVoice ? " 🎧" : "";

    let kickHtml = "";
    if (me && me.isHost && p.id !== myId) {
      kickHtml =
        ' <span class="kick-link" data-kick-id="' +
        p.id +
        '">Kick</span>';
    }

    listHtml +=
      p.name +
      voiceHtml +
      " (" +
      roleLabel +
      ") " +
      hostHtml +
      " " +
      readyHtml +
      kickHtml +
      "<br/>";
  });

  if (playersList) playersList.innerHTML = listHtml || "Henüz kimse yok.";
  if (gamePlayersList) {
    gamePlayersList.innerHTML = listHtml || "Henüz kimse yok.";
  }
  if (chatPlayersList) {
    chatPlayersList.innerHTML = listHtml || "Henüz kimse yok.";
  }

  if (me && me.isHost && playersList) {
    const kickLinks = playersList.querySelectorAll(".kick-link");
    kickLinks.forEach((el) => {
      el.addEventListener("click", function () {
        const targetId = this.getAttribute("data-kick-id");
        if (!targetId) return;
        const sure = window.confirm("Bu oyuncuyu odadan atmak istediğine emin misin?");
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

// Case seçildiğinde
socket.on("caseSelected", (data) => {
  showLobbyInfo("Seçilen vaka: " + data.title);
  if (selectCaseBtn) selectCaseBtn.textContent = "Vaka: " + data.title;

  currentCaseRoles = data.roles || [];
  selectedCaseId = data.caseId || null;
  highlightSelectedCase(selectedCaseId);

  // rol seç butonu aktif
  if (openRoleSelectBtn) openRoleSelectBtn.disabled = false;

  // role overlay'i dinamik doldur
  const roleGrid = document.querySelector(".role-grid");
  if (roleGrid) {
    roleGrid.innerHTML = "";
    currentCaseRoles.forEach((role) => {
      const card = document.createElement("div");
      card.className = "role-card";
      card.setAttribute("data-role", role);
      card.innerHTML = `
        <div class="role-avatar" style="background:linear-gradient(135deg,#1e3a8a,#6366f1);"></div>
        <div class="role-name">${role.toUpperCase()}</div>
        <div class="role-desc">${role} rolünü üstlen.</div>
      `;
      card.addEventListener("click", () => {
        socket.emit("chooseRole", { role });
        closeOverlay();
      });
      roleGrid.appendChild(card);
    });
  }

  // kendi rolümüzü sıfırla
  myRole = null;
  updateMyRoleInfo();
});

// Ortak tahta güncellemesi
socket.on("sharedBoardUpdated", (data) => {
  sharedBoardText = data.content || "";
  if (currentGameTab === "sharedBoard") {
    renderCurrentTab();
  }
});

// Faz verisi
socket.on("phaseData", (data) => {
  currentPhase = data.phase;

  if (phaseSection) phaseSection.style.display = "none";
  if (finalSection) finalSection.style.display = "none";
  if (resultSection) resultSection.style.display = "none";

  if (lobbySection) lobbySection.style.display = "none";
  if (gameSection && lobbyLayout) {
    gameSection.style.display = "block";
    lobbyLayout.style.display = "grid";
  }

  if (!inGame) {
    inGame = true;
    startGameTimer();
    setActiveTab("roleMain");
  }

  if (data.clue) {
    const header = `Bölüm ${data.phase} İpucu:\n`;
    if (!sharedBoardText) {
      sharedBoardText = header + data.clue;
    } else {
      sharedBoardText += `\n\n${header}${data.clue}`;
    }
    if (currentGameTab === "sharedBoard") {
      renderCurrentTab();
    }
  }

  if (data.phase >= 1 && data.phase <= 3) {
    if (phaseTitle) phaseTitle.textContent = data.phase + ". Bölüm";
    if (phaseContent) phaseContent.textContent = data.clue || "";
  } else if (data.phase === 4 && finalQuestion) {
    finalQuestion.textContent = data.finalQuestion || "";
  }
});

socket.on("finalResult", (data) => {
  if (resultSection) resultSection.style.display = "block";
  if (finalSection) finalSection.style.display = "none";

  if (data.success) {
    if (resultText) {
      resultText.textContent =
        "TEBRİKLER! Doğru cevabı buldunuz: " +
        data.correctAnswer.toUpperCase();
    }
  } else {
    if (resultText) {
      resultText.textContent = "Cevaplar yanlış. Tekrar deneyebilirsiniz.";
    }
    if (submitAnswerBtn) submitAnswerBtn.disabled = false;
    if (answerInput) answerInput.disabled = false;
    if (finalSection) finalSection.style.display = "block";
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

      if (roomCodeInput) roomCodeInput.value = code;

      const name = (nameInput && nameInput.value.trim()) || "";
      if (!name) {
        if (joinError) {
          joinError.style.display = "block";
          joinError.textContent =
            "Önce bir isim girin, sonra odaya katılabilirsiniz.";
        }
        return;
      }

      if (!isPrivate) {
        socket.emit("joinRoom", { name, roomCode: code, deviceId });
      } else {
        const pwd = window.prompt("Bu oda şifreli. Lütfen şifreyi girin:");
        if (pwd === null) return;
        socket.emit("joinRoom", {
          name,
          roomCode: code,
          password: pwd,
          deviceId
        });
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
