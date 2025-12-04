const socket = io();

// Her tarayıcı için kalıcı bir cihaz ID'si
let deviceId = localStorage.getItem("bdp_device_id");
if (!deviceId) {
  deviceId = "dev_" + Math.random().toString(36).substring(2, 11);
  localStorage.setItem("bdp_device_id", deviceId);
}

// --- DOM ELEMANLARI --- //
const gameSection = document.getElementById("gameSection");
const gameTimerDisplay = document.getElementById("gameTimerDisplay");
const gamePlayersList = document.getElementById("gamePlayersList");
const gameTabContent = document.getElementById("gameTabContent");
const tabRoleMainBtn = document.getElementById("tabRoleMainBtn");
const tabRoleSpecialBtn = document.getElementById("tabRoleSpecialBtn");
const tabSharedBoardBtn = document.getElementById("tabSharedBoardBtn");
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

// Overlay
const overlayBackdrop = document.getElementById("overlayBackdrop");
const howToOverlay = document.getElementById("howToOverlay");
const creditsOverlay = document.getElementById("creditsOverlay");
const roleSelectOverlay = document.getElementById("roleSelectOverlay");
const overlayCloseBtn1 = document.getElementById("overlayCloseBtn1");
const overlayCloseBtn2 = document.getElementById("overlayCloseBtn2");
const roleOverlayCloseBtn = document.getElementById("roleOverlayCloseBtn");
// Overlay butonları (güvenli bağlama)
if (howToBtn) howToBtn.addEventListener("click", () => openOverlay("howto"));
if (creditsBtn) creditsBtn.addEventListener("click", () => openOverlay("credits"));
if (overlayCloseBtn1) overlayCloseBtn1.addEventListener("click", closeOverlay);
if (overlayCloseBtn2) overlayCloseBtn2.addEventListener("click", closeOverlay);
if (roleOverlayCloseBtn) roleOverlayCloseBtn.addEventListener("click", closeOverlay);
if (caseOverlayCloseBtn) caseOverlayCloseBtn.addEventListener("click", closeOverlay);


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

// Sayfa açıldığında kayıtlı nick'i yükle (localStorage + cookie fallback)
const savedName = loadPlayerName();
if (savedName && nameInput) {
  nameInput.value = savedName;
}

// --- STATE --- //
let inGame = false;
let currentGameTab = "roleMain";
let gameTimerSeconds = 30 * 60;
let gameTimerInterval = null;
let sharedBoardText = "";
let notesText = "";

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
// --- Nick / kalıcı isim için storage helper'ları --- //
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

function setCookie(name, value, days) {
  try {
    const d = new Date();
    d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
    const expires = "expires=" + d.toUTCString();
    document.cookie = name + "=" + encodeURIComponent(value) + ";" + expires + ";path=/";
  } catch (e) {
    // bazı eski tarayıcılarda sorun çıkarsa sessiz geç
  }
}

function setActiveTab(tabName) {
  currentGameTab = tabName;
  const buttons = document.querySelectorAll(".game-tab-btn");
  buttons.forEach((btn) => {
    if (btn.getAttribute("data-tab") === tabName) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
  renderCurrentTab();
}

function renderCurrentTab() {
  if (!gameTabContent) return;
  const cfg = ROLE_CONFIG[myRole] || null;
  gameTabContent.innerHTML = "";

  if (currentGameTab === "roleMain") {
    const roleLabel = cfg ? cfg.displayName : (myRole || "Rol");
    const desc = cfg ? cfg.description : "Rolünle ilgili detaylar burada gözükecek.";
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
    if (btn) {
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
    if (ta) ta.value = notesText || "";
    if (ta) {
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
  // localStorage varsa oraya da yaz
  try {
    localStorage.setItem("bdp_name", name);
  } catch (e) {
    // bazı mobil tarayıcılar izin vermeyebilir
  }
  // cookie'ye mutlaka yaz (1 yıl)
  setCookie("bdp_name", name, 365);
}

function loadPlayerName() {
  let name = "";
  try {
    name = localStorage.getItem("bdp_name") || "";
  } catch (e) {
    name = "";
  }
  if (!name) {
    name = getCookie("bdp_name") || "";
  }
  return name;
}


function updateMyRoleInfo() {
  let text;
  if (myRole === "dedektif") {
    text = "Rolün: Baş Dedektif";
  } else if (myRole === "polis") {
    text = "Rolün: Polis";
  } else if (myRole === "ajan") {
    text = "Rolün: Ajan";
  } else if (myRole === "güvenlik") {
    text = "Rolün: Güvenlik";
  } else {
    text = "Rolün: (henüz seçilmedi)";
  }
  myRoleInfo.textContent = text;
  updateGameRoleUI();
}

function updateGameRoleUI() {
  if (!tabRoleMainBtn || !tabRoleSpecialBtn) return;

  const cfg = ROLE_CONFIG[myRole] || null;
  const roleLabel = cfg ? cfg.displayName : (myRole || "Rol");
  const specialLabel = cfg ? cfg.specialTabLabel : "Özel Görev";

  tabRoleMainBtn.textContent = roleLabel;
  tabRoleSpecialBtn.textContent = specialLabel;

  if (inGame) {
    renderCurrentTab();
  }
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
  if (gameSection) {
  gameSection.style.display = "none";
}
inGame = false;
sharedBoardText = "";
notesText = "";
if (gameTimerInterval) {
  clearInterval(gameTimerInterval);
  gameTimerInterval = null;
}
if (gameTimerDisplay) {
  gameTimerDisplay.textContent = "30:00";
}

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
  selectCaseBtn.textContent = "Case seçiniz";
selectedCaseId = null;
currentCaseRoles = [];
openRoleSelectBtn.disabled = true;
highlightSelectedCase(null); // hiçbir kart seçili olmasın

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
if (tabRoleMainBtn) {
  tabRoleMainBtn.addEventListener("click", () => setActiveTab("roleMain"));
}
if (tabRoleSpecialBtn) {
  tabRoleSpecialBtn.addEventListener("click", () => setActiveTab("roleSpecial"));
}
if (tabSharedBoardBtn) {
  tabSharedBoardBtn.addEventListener("click", () => setActiveTab("sharedBoard"));
}
if (tabNotesBtn) {
  tabNotesBtn.addEventListener("click", () => setActiveTab("notes"));
}
if (tabSettingsBtn) {
  tabSettingsBtn.addEventListener("click", () => setActiveTab("settings"));
}

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
    highlightSelectedCase(selectedCaseId);
  });
});

// Case seçimi - overlay aç
selectCaseBtn.addEventListener("click", () => {
  // host değilse veya buton disabled ise hiçbir şey yapma
  if (selectCaseBtn.disabled) return;

  roleError.style.display = "none";
  roleError.textContent = "";
  openOverlay("cases");
});

socket.on("sharedBoardUpdated", (data) => {
  sharedBoardText = data.content || "";
  if (currentGameTab === "sharedBoard") {
    const ta = document.getElementById("sharedBoardTextarea");
    if (ta) ta.value = sharedBoardText;
  }
});

socket.on("caseSelected", (data) => {
  openRoleSelectBtn.disabled = false; // ⭐ artık rol seçilebilir
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
    selectCaseBtn.disabled = false;
  } else {
    startGameBtn.style.display = "none";
    selectCaseBtn.disabled = true;
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

    if (me.isHost) {
      startGameBtn.style.display = "inline-flex";
    } else {
      startGameBtn.style.display = "none";
      selectCaseBtn.disabled = true; // ⭐ non-host case butonu kapalı
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

    // 🎧 BURASI: sesli sohbetteyse ikon
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
  }

  playersList.innerHTML = listHtml || "Henüz kimse yok.";
  if (gamePlayersList) {
  gamePlayersList.innerHTML = listHtml || "Henüz kimse yok.";
}


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
let currentCaseRoles = []; // seçilen case'in rollerini tutar
socket.on("caseSelected", (data) => {
  showLobbyInfo("Seçilen vaka: " + data.title);
  selectCaseBtn.textContent = "Vaka: " + data.title;
   // ⭐ roller kaydediliyor
  currentCaseRoles = data.roles;

  // Rol seçme overlay’ini güncelle
  updateRoleSelectOverlay();

  // Oyuncuların rolünü resetle
  myRole = null;
  updateMyRoleInfo();
   // ⭐ kart highlight
  highlightSelectedCase(data.caseId);
  // Rol seç butonu artık aktif
  openRoleSelectBtn.disabled = false;
});
function updateRoleSelectOverlay() {
  const roleGrid = document.querySelector(".role-grid");
  roleGrid.innerHTML = ""; // eski rolleri temizle

  currentCaseRoles.forEach((role) => {
    const card = document.createElement("div");
    card.className = "role-card";
    card.setAttribute("data-role", role);

    card.innerHTML = `
      <div class="role-avatar" style="background:linear-gradient(135deg,#1e3a8a,#6366f1);"></div>
      <div class="role-name">${role.toUpperCase()}</div>
      <div class="role-desc">${role} rolünü üstlen.</div>
    `;

    card.addEventListener("click", function () {
      socket.emit("chooseRole", { role });
      closeOverlay();
    });

    roleGrid.appendChild(card);
  });
}


socket.on("phaseData", (data) => {
  currentPhase = data.phase;

  // Eski faz ekranlarını kapat
  phaseSection.style.display = "none";
  finalSection.style.display = "none";
  resultSection.style.display = "none";

  // Lobby'yi gizle, oyun ekranını aç
  lobbySection.style.display = "none";
  if (gameSection && lobbyLayout) {
    gameSection.style.display = "block";
    lobbyLayout.style.display = "grid";
  }

  // İlk kez oyuna geçiş
  if (!inGame) {
    inGame = true;
    startGameTimer();
    setActiveTab("roleMain");
  }

  // Server'dan gelen clue'ları istersek ortak tahtaya ekleyebiliriz
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

  // Final question vs. için şimdilik ayrı ekran açmıyoruz,
  // mevcut ortak tahtayı kullanmaya devam edeceğiz (ileride değiştirebiliriz).
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
