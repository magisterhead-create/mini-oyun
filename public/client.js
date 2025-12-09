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
const gameSection = document.getElementById("gameSection");
const gameTimerDisplay = document.getElementById("gameTimerDisplay");
const gameRoleLabel = document.getElementById("gameRoleLabel");

const gamePlayersList = document.getElementById("gamePlayersList");
const gameTabContent = document.getElementById("gameTabContent");

const backToMenuGameBtn = document.getElementById("backToMenuFromGameBtn");

const tabRoleMainBtn = document.getElementById("tabRoleMainBtn");
const tabRoleSpecialBtn = document.getElementById("tabRoleSpecialBtn");
const tabSharedBoardBtn = document.getElementById("tabSharedBoardBtn");
const tabNotesBtn = document.getElementById("tabNotesBtn");
const tabSettingsBtn = document.getElementById("tabSettingsBtn");

// === SAHA ANALİZCİSİ MODAL ===
const fieldTalkModal     = document.getElementById("fieldTalkModal");
const fieldTalkCloseBtn  = document.getElementById("fieldTalkCloseBtn");
const fieldTalkForm      = document.getElementById("fieldTalkForm");
const fieldTalkInput     = document.getElementById("fieldTalkInput");
const fieldTalkMessages  = document.getElementById("fieldTalkMessages");


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

// Sorgu sistemi (polis)
let currentCaseSuspects = [];          // caseSelected ile gelecek şüpheliler
let currentSuspectId = null;           // şu an seçili şüpheli
let interrogationHistory = {};         // { suspectId: [ { from: "player"|"suspect", text: "" }, ... ] }

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
// Kod Kırıcı — bulduğu deliller
// { text: "Delil cümlesi", sentToBoard: false }
let codebreakerEvidence = [];
let codebreakerView = "menu";   // "menu" | "whatsapp" | "calls" | "gallery" | "notes" | "files" | "location"

// Saha Analizcisi — bölge sohbetleri
let fieldCurrentZoneId = null;      // şu an açık olan bölge
let fieldConversations = {};        // { zoneId: [ { from:"player"|"npc", text } ] }
let fieldHistory = [];
// =============================
// ROL KONFİG (özel sekme isimleri)
// =============================

const ROLE_CONFIG = {
  kodkırıcı: {
    displayName: "Kod Kırıcı",
    specialTabLabel: "Cihaz Analizi",
    description: "Dijital cihazlardan gizli verileri bulan ve zaman çizelgesindeki boşlukları dolduran teknik zeka."
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
  },
  sahaanalizcisi: {
    displayName: "Saha Analizcisi",
    specialTabLabel: "Saha Analizi",
    description: "Şehrin belirli noktalarını analiz ederek ipuçları çıkarır."
  },
    tracker: {
    displayName: "Tracker",
    specialTabLabel: "Takip",
    description:
      "Şüphelilerin gün içi hareketlerini takip eden, zaman-konum çakışmalarını ortaya çıkaran rol."
  }


};

const CODEBREAKER_SECTIONS = {
  whatsapp: {
    label: "WhatsApp",
    items: [
      {
        label: "📱 Sohbet — “Kimseye söyleme… bu gece bitecek.”",
        evidence: "WhatsApp: 22:31 — 'Kimseye söyleme... bu gece bitecek.'"
      },
      {
        label: "📱 Grup: 'Restoran Ekip' — son mesaj 22:10'da sinirli ton",
        evidence: "WhatsApp: 'Bu herif bu gece haddini bilecek.' (Restoran Ekip grubu)"
      }
    ]
  },
  calls: {
    label: "Arama Kayıtları",
    items: [
      {
        label: "📞 23:58 — gizli numara (3 sn)",
        evidence: "Arama kaydı: 23:58 gizli numaradan 3 saniyelik arama."
      },
      {
        label: "📞 22:27 — 'Şef Hakan' 45 sn",
        evidence: "Arama kaydı: 22:27'de Şef Hakan ile 45 saniyelik konuşma."
      }
    ]
  },
  gallery: {
    label: "Galeri",
    items: [
      {
        label: "🖼 22:15 — restoran içi selfie",
        evidence: "Galeri: 22:15'te restoran içinde çekilmiş selfie."
      },
      {
        label: "🔒 Silinmiş Fotoğraflar — 23:39 (kilitli / minigame)",
        evidence: "Galeri: 23:39'da çekilmiş ancak silinmiş bir fotoğraf (arka sokak).",
        locked: true
      }
    ]
  },
  notes: {
    label: "Notlar",
    items: [
      {
        label: "📝 'Beni kimse anlamıyor.' notu",
        evidence: "Notlar: 'Beni kimse anlamıyor.'"
      },
      {
        label: "📝 'Bu gece bitecek.' notu",
        evidence: "Notlar: 'Bu gece bitecek.'"
      }
    ]
  },
  files: {
    label: "Dosyalar",
    items: [
      {
        label: "📁 gizli.zip",
        evidence: "Dosya sistemi: 'gizli.zip' isimli şifreli arşiv dosyası.",
        locked: true
      },
      {
        label: "📄 sifre.docx",
        evidence: "Dosya sistemi: 'sifre.docx' isimli şifre notları dosyası."
      }
    ]
  },
  location: {
    label: "Harita / Konum Geçmişi",
    items: [
      {
        label: "📍 22:41 — Olay yerine yakın 'arka sokak' kaydı",
        evidence: "Konum geçmişi: 22:41'de olay yerine çok yakın 'arka sokak' kaydı."
      },
      {
        label: "📍 23:10 — kısa süreli 'ev' konumu",
        evidence: "Konum geçmişi: 23:10'da kısa süreli 'ev' konumu – alibi çelişkisi yaratıyor."
      }
    ]
  }
};

const FIELD_ZONES = {
  // 1) Şu an aktif olan bölge: Çöp alanı
  trash_area: {
    id: "trash_area",
    name: "Çöp Bölgesi",
    img: "/assets/Resim2.png",
    desc: "Kapşonlu biri çöplerin orada oyalanıyor. Seni fark etmiş gibi.",
    npcPrompt:
      "Sen saha analizcisisin. Halktan bilgi topluyorsun. Karşındaki kapşonlu biri seni fark etti, tedirgin davranıyor. Sahaya uygun kısa, doğal cevaplar ver.",
    // Harita üzerinde tıklanabilir dikdörtgen (0–1 arasında oransal)
    rect: {
      xMin: 0.58,
      xMax: 0.80,
      yMin: 0.55,
      yMax: 0.85
    }
  },

  // 2) Şimdilik placeholder bölgeler
  park: {
    id: "park",
    name: "Park",
    rect: {
      xMin: 0.32,
      xMax: 0.68,
      yMin: 0.30,
      yMax: 0.55
    }
  },
  apt_block: {
    id: "apt_block",
    name: "Apartmanlar",
    rect: {
      xMin: 0.05,
      xMax: 0.35,
      yMin: 0.10,
      yMax: 0.45
    }
  },
  warehouse: {
    id: "warehouse",
    name: "Depo / Sanayi",
    rect: {
      xMin: 0.55,
      xMax: 0.95,
      yMin: 0.05,
      yMax: 0.30
    }
  }
};

// Tracker — takip verileri
let trackerTargets = [
  {
    id: "suspect_a",
    name: "Şüpheli A",
    label: "Restoran Garsonu",
    baseTimeline: [
      "18:42 – Evden çıkış",
      "19:05 – Metro giriş (Merkez İstasyon)",
      "19:12 – Market önü güvenlik kamerası",
      "19:20 – Otobüse biniş (Hat 34B)",
      "19:48 – Ev yakını GPS sinyali"
    ],
    deepTimeline: [
      "19:13 – Market içi kamera: Kurbanla aynı koridorda kısa karşılaşma",
      "19:15 – Market çıkışı: Eldiven benzeri bir şey çöp kutusuna atılıyor",
      "19:19 – Otobüs durağı civarında 3 dakika boyunca telefonda tartışma"
    ]
  },
  {
    id: "suspect_b",
    name: "Şüpheli B",
    label: "Restoran Şefi",
    baseTimeline: [
      "17:58 – Restorana giriş (arka kapı)",
      "18:10 – Tedarikçi ile kısa görüşme",
      "21:30 – Mutfak içi yoğun servis",
      "22:10 – Kısa süreli mutfaktan çıkış",
      "23:05 – Restorandan çıkış (arka kapı)"
    ],
    deepTimeline: [
      "22:11 – Arka koridorda 2 dakikalık telefon görüşmesi, sesi yükseliyor",
      "22:13 – Personel kapısı kamerada sigara içerken sinirli hareketler",
      "23:02 – Nakit kasanın bulunduğu odanın yakınında 1 dakikalık görünme"
    ]
  },
  {
    id: "suspect_c",
    name: "Şüpheli C",
    label: "Restoran Ortağı",
    baseTimeline: [
      "16:30 – Ofise giriş",
      "18:00 – Restorana kısa ziyaret",
      "20:15 – Banka ATM kaydı (çekim)",
      "22:20 – GPS: Restoran çevresine yakın",
      "23:30 – Ev bölgesinde sabit sinyal"
    ],
    deepTimeline: [
      "18:05 – Restoran girişinde kurbanla ayaküstü tartışma",
      "20:17 – ATM güvenlik kamerasında cebine bir zarf yerleştirirken",
      "22:23 – Restoranın yan sokağında 7 dakikalık bekleme kaydı"
    ]
  }
];

let trackerSelectedId = null;       // şu an kimin ekranı açık
let trackerRevealed = {};           // { suspectId: true } -> detay açıldı mı



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
  if (myRole === "kodkırıcı") text = "Rolün: Kod Kırıcı";
  else if (myRole === "polis") text = "Rolün: Polis";
  else if (myRole === "ajan") text = "Rolün: Ajan";
  else if (myRole === "güvenlik") text = "Rolün: Güvenlik";
  else if (myRole === "sahaanalizcisi") text = "Rolün: Saha Analizcisi";
  else if (myRole === "tracker") text = "Rolün: Tracker";
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
function addEvidenceToNotes(evidenceText) {
  const t = (evidenceText || "").trim();
  if (!t) return;

  if (!notesText) {
    notesText = "- " + t;
  } else {
    notesText += "\n- " + t;
  }

  // Notlar sekmesindeysek anında güncelle
  if (currentGameTab === "notes") {
    renderCurrentTab();
  }
}

function pushEvidenceToBoard(text) {
  const current = sharedBoardText || "";
  const line = `• ${text}`;
  sharedBoardText = current ? current + "\n" + line : line;
  socket.emit("updateSharedBoard", { content: sharedBoardText });
}
function pushEvidenceToBoard(evidenceText) {
  const t = (evidenceText || "").trim();
  if (!t) return;

  const line = `[Kod Kırıcı] ${t}`;

  if (!sharedBoardText) {
    sharedBoardText = line;
  } else {
    sharedBoardText += "\n" + line;
  }

  // Sunucuya gönder (ortak tahta güncelle)
  socket.emit("updateSharedBoard", { content: sharedBoardText });
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
    // --- Saha Analizcisi UI reset ---
  fieldCurrentZoneId = null;
  fieldConversations = {};

  if (fieldTalkModal) fieldTalkModal.style.display = "none";
  if (fieldTalkMessages) fieldTalkMessages.innerHTML = "";
  if (fieldTalkInput) fieldTalkInput.value = "";

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
    if (id === "tabRoleMainBtn") thisTab = "roleMain";
    else if (id === "tabRoleSpecialBtn") thisTab = "roleSpecial";
    else if (id === "tabSharedBoardBtn") thisTab = "sharedBoard";
    else if (id === "tabFieldBtn") thisTab = "field";
    else if (id === "tabNotesBtn") thisTab = "notes";
    else if (id === "tabSettingsBtn") thisTab = "settings";

    if (thisTab === tabName) btn.classList.add("active");
    else btn.classList.remove("active");
  });

  // Saha sekmesinden çıktıysak konuşma modalını kapat
  if (tabName !== "field" && fieldTalkModal) {
    fieldTalkModal.style.display = "none";
  }

  renderCurrentTab();
}


function renderCurrentTab() {
  if (!gameTabContent) return;
  const cfg = ROLE_CONFIG[myRole] || null;

  gameTabContent.innerHTML = "";

  // 1) ROL ANA BİLGİ (roleMain)
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
  }

  // 2) ROL ÖZEL GÖREV SEKMESİ (roleSpecial)
  else if (currentGameTab === "roleSpecial") {

    // 2.a) POLİS — Sorgu Odası
    if (myRole === "polis") {
      // Şüpheli listesi HTML
      const suspectsHtml = (currentCaseSuspects || [])
        .map((s) => {
          const isActive = s.id === currentSuspectId;
          return `
            <div class="case-card ${isActive ? "selected" : ""}" data-suspect-id="${s.id}">
              <div class="case-title">
                ${s.name}
                <span style="font-size:11px; color:var(--text-muted);">
                  · ${s.roleLabel || "Şüpheli"}
                </span>
              </div>
              <div class="case-meta">Üzerine tıklayıp sorgulamaya başla.</div>
            </div>
          `;
        })
        .join("") || `
          <div class="setup-note">
            Bu vakada tanımlı şüpheli bulunamadı. (Backend'e suspects eklemelisin.)
          </div>
        `;

      // Seçili şüphelinin chat geçmişi
      const history =
        (currentSuspectId && interrogationHistory[currentSuspectId]) || [];
      const chatHtml =
        history
          .map((m) => {
            const cls =
              m.from === "player"
                ? 'style="text-align:right; margin-bottom:4px; font-size:13px;"'
                : 'style="text-align:left; margin-bottom:4px; font-size:13px;"';
            const label = m.from === "player" ? "Sen" : "Şüpheli";
            return `<div ${cls}><strong>${label}:</strong> ${m.text}</div>`;
          })
          .join("") ||
        `
          <div class="setup-note">
            Henüz soru sormadın. Aşağıya bir soru yazıp gönder, şüpheli cevap verecek.
          </div>
        `;

      gameTabContent.innerHTML = `
        <h3>Sorgu Odası</h3>
        <p style="font-size:12px; color:var(--text-muted); margin-bottom:8px;">
          Şüphelilerden birini seç ve olayla ilgili sorular sor. Dava dışı saçma sorular sorarsan
          şüpheli seni tersleyebilir.
        </p>

        <div class="players-box" style="margin-bottom:8px; max-height:150px; overflow-y:auto;">
          ${suspectsHtml}
        </div>

        <div class="players-box" style="margin-bottom:8px; max-height:180px; overflow-y:auto;">
          ${chatHtml}
        </div>

        <div style="display:flex; gap:6px; margin-top:4px;">
          <input
            id="interrogationInput"
            placeholder="Şüpheliye sorunu yaz..."
            style="margin-top:0; flex:1;"
          />
          <button id="interrogationSendBtn" class="btn-primary btn-small">
            Sor
          </button>
        </div>
        <div class="setup-note" style="margin-top:4px;">
          Sadece bu vakayla ilgili, mantıklı sorular sor. İtirafı koparmaya çalış.
        </div>
      `;

      // Event binding (şüpheli seçme)
      const suspectCards = gameTabContent.querySelectorAll("[data-suspect-id]");
      suspectCards.forEach((el) => {
        el.addEventListener("click", () => {
          const id = el.getAttribute("data-suspect-id");
          currentSuspectId = id;
          renderCurrentTab(); // seçimi güncelle ve chat'i o şüpheliye göre göster
        });
      });

      // Soru gönderme
      const inputEl = document.getElementById("interrogationInput");
      const sendBtn = document.getElementById("interrogationSendBtn");

      if (sendBtn && inputEl) {
        // Seçili şüpheli yoksa butonu kilitle
        if (!currentSuspectId) {
          sendBtn.disabled = true;
          inputEl.disabled = true;
        }

        sendBtn.addEventListener("click", () => {
          sendInterrogationQuestion();
        });

        inputEl.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            sendInterrogationQuestion();
          }
        });
      }
    }

    // 2.b) KOD KIRICI — Cihaz Analizi
    // 2.b) KOD KIRICI — Cihaz Analizi
else if (myRole === "kodkırıcı") {
  // Telefonun sol tarafı: menü veya uygulama içi ekran
  let phoneHtml = "";

  if (codebreakerView === "menu") {
    // Ana menü
    phoneHtml = `
      <div class="label">Şüpheli Cihazı (prototip)</div>
      <div style="font-size:12px; color:var(--text-muted); margin-bottom:4px;">
        Bir uygulamaya tıkla; içindeki öğelerden delil toplayabilirsin.
      </div>

      <div class="code-device phone-device">
        <button class="phone-app-btn" data-phone-open="whatsapp">WhatsApp</button>
        <button class="phone-app-btn" data-phone-open="sms">Mesajlar (SMS)</button>
        <button class="phone-app-btn" data-phone-open="calls">Arama Kayıtları</button>
        <button class="phone-app-btn" data-phone-open="gallery">Galeri</button>
        <button class="phone-app-btn" data-phone-open="notes">Notlar</button>
        <button class="phone-app-btn" data-phone-open="files">Dosyalar</button>
        <button class="phone-app-btn" data-phone-open="location">Harita / Konum geçmişi</button>
      </div>
    `;
  } else {
    // Uygulama içi ekran
    const key = codebreakerView;
    const section =
      CODEBREAKER_SECTIONS[key === "sms" ? "whatsapp" : key] || null;

    if (!section) {
      // güvenlik: bilinmeyen state'te menüye dön
      codebreakerView = "menu";
      return renderCurrentTab();
    }

    const itemsHtml = section.items
      .map((item) => {
        const locked = item.locked
          ? '<span style="font-size:11px; color:#f97373; margin-left:4px;">🔒 (mini oyun yakında)</span>'
          : "";
        const attr = item.locked ? "" : `data-evidence-text="${item.evidence}"`;
        const lockedClass = item.locked ? "locked" : "";
        return `
          <div class="phone-item ${lockedClass}" ${attr}>
            ${item.label}
            ${locked}
          </div>
        `;
      })
      .join("");

    phoneHtml = `
      <div class="phone-header">
        <button id="phoneBackBtn" class="btn-ghost btn-xs">← Menü</button>
        <span class="phone-title">${section.label}</span>
      </div>
      <div class="phone-body">
        ${itemsHtml}
      </div>
    `;
  }

  // Sağ taraftaki delil listesi
  const evListHtml =
    codebreakerEvidence.length === 0
      ? `
        <div class="setup-note">
          Henüz delil eklemedin. Soldaki cihazdaki öğelere tıklayarak
          şüpheli verileri <strong>notlarına</strong> kaydedebilirsin.
        </div>
      `
      : `
        <ul style="padding-left:16px; font-size:13px;">
          ${codebreakerEvidence
            .map((e, idx) => {
              const sent = e.sentToBoard
                ? '<span class="tag ready" style="margin-left:4px;">Tahtada</span>'
                : "";
              return `
                <li style="margin-bottom:4px;">
                  ${e.text}
                  <button
                    class="btn-primary btn-xs"
                    data-send-evidence="${idx}"
                    style="margin-left:6px;"
                  >
                    Tahtaya Gönder
                  </button>
                  ${sent}
                </li>
              `;
            })
            .join("")}
        </ul>
      `;

  gameTabContent.innerHTML = `
    <h3>Kod Kırıcı — Cihaz Analizi</h3>
    <p style="font-size:12px; color:var(--text-muted); margin-bottom:8px;">
      Şüphelinin telefonunu/laptopunu kurcalıyorsun. Şimdilik prototip:
      cihaz içindeki örnek verileri tıklayarak delil topla.
    </p>

    <div style="display:grid; grid-template-columns:1.2fr 1fr; gap:10px;">
      <!-- Sol: Telefon -->
      <div class="players-box" style="min-height:260px;">
        ${phoneHtml}
      </div>

      <!-- Sağ: Bulduğun deliller -->
      <div class="players-box" style="min-height:260px;">
        <div class="label">Bulduğun Deliller</div>
        ${evListHtml}
        <div class="setup-note" style="margin-top:6px;">
          Deliller notlarına da eklenir. “Tahtaya Gönder” ile
          <strong>Ortak Tahta</strong>ya düşer ve herkes görür.
        </div>
      </div>
    </div>
  `;

  // ---- Eventler ----

  // Menüdeki app butonları
  const appButtons = gameTabContent.querySelectorAll("[data-phone-open]");
  appButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-phone-open");
      if (target === "sms") {
        codebreakerView = "whatsapp"; // SMS’i de aynı veriye yönlendirdik şimdilik
      } else {
        codebreakerView = target;
      }
      renderCurrentTab();
    });
  });

  // Geri butonu
  const backBtn = document.getElementById("phoneBackBtn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      codebreakerView = "menu";
      renderCurrentTab();
    });
  }

  // Uygulama içi delil satırları
  const evidenceNodes = gameTabContent.querySelectorAll("[data-evidence-text]");
  evidenceNodes.forEach((el) => {
    el.addEventListener("click", () => {
      const text = (el.getAttribute("data-evidence-text") || "").trim();
      if (!text) return;

      const already = codebreakerEvidence.some((e) => e.text === text);
      if (!already) {
        codebreakerEvidence.push({ text, sentToBoard: false });
        addEvidenceToNotes(text);
        renderCurrentTab();
      }
    });
  });

  // Delili ortak tahtaya gönder
  const sendButtons = gameTabContent.querySelectorAll("[data-send-evidence]");
  sendButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-send-evidence"), 10);
      const ev = codebreakerEvidence[idx];
      if (!ev) return;
      if (!ev.sentToBoard) {
        pushEvidenceToBoard(ev.text);
        codebreakerEvidence[idx].sentToBoard = true;
        renderCurrentTab();
      }
    });
  });
}

  else if (myRole === "tracker") {
  const selected = trackerTargets.find(t => t.id === trackerSelectedId) || null;

  // Sol: takip edilebilir kişiler listesi
  const targetsHtml = trackerTargets
    .map(t => {
      const isActive = selected && selected.id === t.id;
      return `
        <div class="case-card ${isActive ? "selected" : ""}" data-tracker-id="${t.id}">
          <div class="case-title">${t.name}</div>
          <div class="case-meta">${t.label}</div>
        </div>
      `;
    })
    .join("");

  // Sağ: seçilen kişinin zaman çizelgesi
  let detailHtml = `
    <div class="setup-note">
      Bir kişiyi seçtiğinde, son 24 saat içindeki hareketleri burada göreceksin.
    </div>
  `;

  if (selected) {
    const baseLines = selected.baseTimeline
      .map(l => `<li>${l}</li>`)
      .join("");

    const deepOpened = !!trackerRevealed[selected.id];
    let deepBlock = "";

    if (deepOpened) {
      const deepLines = selected.deepTimeline
        .map(l => `<li>${l}</li>`)
        .join("");

      deepBlock = `
        <div class="label" style="margin-top:8px;">Detaylı Takip</div>
        <ul class="tracker-timeline">
          ${deepLines}
        </ul>
      `;
    }

    detailHtml = `
      <div class="label">Son 24 Saat — ${selected.name}</div>
      <ul class="tracker-timeline">
        ${baseLines}
      </ul>

      ${deepBlock}

      <div style="display:flex; gap:6px; margin-top:10px; flex-wrap:wrap;">
        <button id="trackerFollowBtn" class="btn-primary btn-small">
          ${deepOpened ? "Takip Ediliyor" : "Takip Et"}
        </button>
        <button id="trackerPushBoardBtn" class="btn-secondary btn-small">
          Tahtaya Aktar
        </button>
      </div>

      <div class="setup-note" style="margin-top:4px;">
        “Takip Et” ile daha derin kameralara ve GPS loglarına erişirsin.
        “Tahtaya Aktar” ile bu kişinin hareket özetini ortak tahtaya yazarsın.
      </div>
    `;
  }

  gameTabContent.innerHTML = `
    <h3>Tracker — Takip Paneli</h3>
    <p style="font-size:12px; color:var(--text-muted); margin-bottom:8px;">
      Şüphelilerin gün içindeki konumlarını ve saatlerini inceleyip
      alibilerindeki boşlukları yakalamaya çalış.
    </p>

    <div style="display:grid; grid-template-columns:1.1fr 1.6fr; gap:10px;">
      <div class="players-box" style="max-height:260px; overflow-y:auto;">
        ${targetsHtml}
      </div>
      <div class="players-box" style="min-height:220px;">
        ${detailHtml}
      </div>
    </div>
  `;

  // Kişi seçme
  const cards = gameTabContent.querySelectorAll("[data-tracker-id]");
  cards.forEach(card => {
    card.addEventListener("click", () => {
      const id = card.getAttribute("data-tracker-id");
      trackerSelectedId = id;
      renderCurrentTab();
    });
  });

  // Takip Et
  const followBtn = document.getElementById("trackerFollowBtn");
  if (followBtn && selected) {
    followBtn.addEventListener("click", () => {
      trackerRevealed[selected.id] = true;
      renderCurrentTab();
    });
  }

  // Tahtaya Aktar
  const pushBtn = document.getElementById("trackerPushBoardBtn");
  if (pushBtn && selected) {
    pushBtn.addEventListener("click", () => {
      const lines = [
        `Tracker – ${selected.name} hareket özeti:`,
        ...selected.baseTimeline
      ];

      if (trackerRevealed[selected.id]) {
        lines.push("Detaylı takip:");
        lines.push(...selected.deepTimeline);
      }

      const textBlock = lines.join("\n");

      addEvidenceToNotes(textBlock);
      pushEvidenceToBoard(textBlock);

      showLobbyInfo(`${selected.name} için takip özeti tahtaya aktarıldı.`);
    });
  }
 }

// 2.d) SAHA ANALİZCİSİ — Saha Analizi / Haritası
    else if (myRole === "sahaanalizcisi") {
      // BURAYA DAHA ÖNCE currentGameTab === "field" İÇİN YAZDIĞIMIZ HARİTA KODUNU KOYACAĞIZ
      gameTabContent.innerHTML = `
        <h3>Saha Analizi</h3>
        <p style="font-size:12px; color: var(--text-muted); margin-bottom:8px;">
          Harita üzerindeki işaretli noktalara tıklayarak ipuçları topla. Şimdilik sadece bir nokta aktif.
        </p>

        <div class="players-box" style="text-align:center;">
          <div id="fieldMapWrapper"
               style="position:relative; display:inline-block; max-width:100%;">
            <img src="/assets/Resim1.png"
                 id="fieldMapImg"
                 style="max-width:100%; border-radius:8px; display:block;" />
          </div>
          <div style="margin-top:6px; font-size:12px; color:var(--text-muted);">
            Sadece görünen noktalara tıklanabilir.
          </div>
        </div>

        <div id="fieldDetailBox" style="margin-top:12px;"></div>
      `;

      const wrapper   = document.getElementById("fieldMapWrapper");
      const detailBox = document.getElementById("fieldDetailBox");

      if (wrapper && detailBox) {
        Object.values(FIELD_ZONES).forEach((zone) => {
          if (!zone.rect) return;
          const r = zone.rect;

          const cx = (r.xMin + r.xMax) / 2;
          const cy = (r.yMin + r.yMax) / 2;

          const marker = document.createElement("button");
          marker.type = "button";
          marker.className = "field-marker";
          marker.style.position = "absolute";
          marker.style.left = (cx * 100) + "%";
          marker.style.top = (cy * 100) + "%";
          marker.style.transform = "translate(-50%, -50%)";
          marker.style.width = "14px";
          marker.style.height = "14px";
          marker.style.borderRadius = "999px";
          marker.style.border = "2px solid rgba(255,255,255,0.9)";
          marker.style.background = "rgba(59,130,246,0.9)";
          marker.style.boxShadow = "0 0 6px rgba(59,130,246,0.9)";
          marker.style.cursor = "pointer";
          marker.style.padding = "0";
          marker.style.outline = "none";

          marker.title = zone.name || "Bölge";

          marker.addEventListener("click", (e) => {
            e.stopPropagation();

            fieldCurrentZoneId = zone.id;

            detailBox.innerHTML = `
              <div class="players-box" style="margin-top:10px;">
                ${zone.img ? `<img src="${zone.img}" style="max-width:100%; border-radius:8px;" />` : ""}
                <p style="font-size:13px; margin-top:6px;">${zone.desc || ""}</p>

                <div style="display:flex; gap:8px; margin-top:8px;">
                  <button id="fieldTalkBtn" class="btn-primary btn-small">Konuş</button>
                  <button id="fieldBackBtn" class="btn-secondary btn-small">Geri</button>
                </div>
              </div>
            `;

            const talkBtn = document.getElementById("fieldTalkBtn");
            const backBtn = document.getElementById("fieldBackBtn");

            if (backBtn) {
              backBtn.addEventListener("click", () => {
                fieldCurrentZoneId = null;
                detailBox.innerHTML = "";
              });
            }

            if (talkBtn) {
              talkBtn.addEventListener("click", () => {
                openFieldTalkModal();
              });
            }
          });

          wrapper.appendChild(marker);
        });
      }
    }


    // 2.c) Diğer roller için placeholder
    else {
      const specialLabel = cfg ? cfg.specialTabLabel : "Özel Görev";
      gameTabContent.innerHTML = `
        <h3>${specialLabel}</h3>
        <p style="font-size:13px; color: var(--text-muted);">
          Bu rolde sana özel görevler burada görünecek. Şimdilik placeholder.
        </p>
      `;
    }
 }
      


  // 3) ORTAK TAHTA
  else if (currentGameTab === "sharedBoard") {
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
  }

  // 4) NOTLAR
  else if (currentGameTab === "notes") {
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
  }

  // 5) AYARLAR
  else if (currentGameTab === "settings") {
    gameTabContent.innerHTML = `
      <h3>Ayarlar</h3>
      <p style="font-size:13px; color: var(--text-muted);">
        Bu alanı ileride oyun içi ayarlar için kullanacağız.
      </p>
    `;
  }
}

function openFieldTalkModal() {
    // Sadece oyun içindeyken ve saha sekmesi açıksa, doğru rolde çalışsın
  if (!inGame) return;
  if (currentGameTab !== "field") return;
  if (myRole !== "sahaanalizcisi") return;
  
  if (!fieldCurrentZoneId) return;
  if (!fieldConversations[fieldCurrentZoneId]) {
    fieldConversations[fieldCurrentZoneId] = [];
  }

  if (!fieldTalkModal || !fieldTalkMessages) return;

  // Eski mesajları temizle
  fieldTalkMessages.innerHTML = "";

  fieldConversations[fieldCurrentZoneId].forEach((m) => {
    const bubble = document.createElement("div");
    bubble.className =
      "interrogation-bubble " + (m.from === "player" ? "player" : "suspect");
    bubble.textContent = (m.from === "player" ? "Sen: " : "NPC: ") + m.text;
    fieldTalkMessages.appendChild(bubble);
  });

  fieldTalkMessages.scrollTop = fieldTalkMessages.scrollHeight;
  fieldTalkModal.style.display = "flex";
}


function sendInterrogationQuestion() {
  if (myRole !== "polis") return;
  if (!currentSuspectId) return;

  const inputEl = document.getElementById("interrogationInput");
  if (!inputEl) return;

  const text = (inputEl.value || "").trim();
  if (!text) return;

  // local history'ye oyuncu mesajını ekle
  if (!interrogationHistory[currentSuspectId]) {
    interrogationHistory[currentSuspectId] = [];
  }
  interrogationHistory[currentSuspectId].push({
    from: "player",
    text
  });

  // server'a gönder
  socket.emit("policeInterrogate", {
    suspectId: currentSuspectId,
    question: text,
    history: interrogationHistory[currentSuspectId]
  });

  inputEl.value = "";

  // UI'yi güncelle (mesajı hemen gör)
  if (currentGameTab === "roleSpecial" && myRole === "polis") {
    renderCurrentTab();
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

// === Saha Analizcisi modal kontrolleri ===
if (fieldTalkCloseBtn) {
  fieldTalkCloseBtn.addEventListener("click", () => {
    fieldTalkModal.style.display = "none";
  });
}

if (fieldTalkForm) {
  fieldTalkForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!fieldCurrentZoneId) return;

    const text = (fieldTalkInput.value || "").trim();
    if (!text) return;

    if (!fieldConversations[fieldCurrentZoneId]) {
      fieldConversations[fieldCurrentZoneId] = [];
    }
    fieldConversations[fieldCurrentZoneId].push({
      from: "player",
      text
    });

    // Mesajı hemen modalda göster
    const bubble = document.createElement("div");
    bubble.className = "interrogation-bubble player";
    bubble.textContent = "Sen: " + text;
    fieldTalkMessages.appendChild(bubble);
    fieldTalkMessages.scrollTop = fieldTalkMessages.scrollHeight;

    // Sunucuya yolla
    socket.emit("fieldTalk", {
      zoneId: fieldCurrentZoneId,
      question: text,
      history: fieldConversations[fieldCurrentZoneId]
    });

    fieldTalkInput.value = "";
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
if (p.role === "kodkırıcı") roleLabel = "Kod Kırıcı";
else if (p.role === "polis") roleLabel = "Polis";
else if (p.role === "ajan") roleLabel = "Ajan";
else if (p.role === "güvenlik") roleLabel = "Güvenlik";
else if (p.role === "sahaanalizcisi") roleLabel = "Saha Analizcisi";
else if (p.role === "tracker") roleLabel = "Tracker";
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
  
  // 🔹 ŞÜPHELİ LİSTESİ (polis sorgu sekmesi için)
  currentCaseSuspects = data.suspects || [];
  interrogationHistory = {};                               // yeni vakada temizle
  if (currentCaseSuspects && currentCaseSuspects.length > 0) {
  currentSuspectId = currentCaseSuspects[0].id;
} else {
  currentSuspectId = null;
}   // varsa ilk şüpheliyi seçili yap

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
socket.on("interrogationReply", (data) => {
  const { suspectId, answer } = data || {};
  if (!suspectId || !answer) return;

  if (!interrogationHistory[suspectId]) {
    interrogationHistory[suspectId] = [];
  }
  interrogationHistory[suspectId].push({
    from: "suspect",
    text: answer
  });

  // Eğer şu an sorgu sekmesindeysek ekranı yenile
  if (currentGameTab === "roleSpecial" && myRole === "polis") {
    renderCurrentTab();
  }
});

socket.on("fieldReply", (data) => {
  const { zoneId, answer } = data || {};
  if (!zoneId || !answer) return;

  if (!fieldConversations[zoneId]) {
    fieldConversations[zoneId] = [];
  }
  fieldConversations[zoneId].push({
    from: "npc",
    text: answer
  });

  // Eğer şu an saha analizcisi bu bölgeyle meşgulse ve modal açıksa ekrana da bas
  if (
    myRole === "sahaanalizcisi" &&
    fieldCurrentZoneId === zoneId &&
    fieldTalkModal &&
    fieldTalkModal.style.display !== "none"
  ) {
    const bubble = document.createElement("div");
    bubble.className = "interrogation-bubble suspect";
    bubble.textContent = "NPC: " + answer;
    fieldTalkMessages.appendChild(bubble);
    fieldTalkMessages.scrollTop = fieldTalkMessages.scrollHeight;
  }
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
