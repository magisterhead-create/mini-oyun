const socket = io();

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

// Bağlantı ekranı
const connectionSection = document.getElementById("connectionSection");
const nameInput = document.getElementById("nameInput");
const roomCodeGroup = document.getElementById("roomCodeGroup");
const roomCodeInput = document.getElementById("roomCodeInput");
const connectBtn = document.getElementById("connectBtn");
const backToMenuFromConnectBtn = document.getElementById("backToMenuFromConnectBtn");
const joinError = document.getElementById("joinError");

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

let myId = null;
let myRole = null;
let myRoomCode = null;
let currentPhase = 0;
let mode = null; // "host" veya "join"
let myLobbyReady = false;

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

function resetUIToMenu() {
  menuSection.style.display = "block";
  connectionSection.style.display = "none";
  lobbySection.style.display = "none";
  phaseSection.style.display = "none";
  finalSection.style.display = "none";
  resultSection.style.display = "none";

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
  nameInput.value = "";
  roomCodeInput.value = "";

  myRoomCode = null;
  myRole = null;
  currentPhase = 0;
  mode = null;
  myLobbyReady = false;

  lobbyReadyBtn.disabled = false;
  lobbyReadyBtn.textContent = "Hazırım";
  startGameBtn.disabled = false;
}

// --- Overlay logic ---
function openOverlay(which) {
  overlayBackdrop.style.display = "flex";
  howToOverlay.style.display = "none";
  creditsOverlay.style.display = "none";
  roleSelectOverlay.style.display = "none";

  if (which === "howto") {
    howToOverlay.style.display = "block";
  } else if (which === "credits") {
    creditsOverlay.style.display = "block";
  } else if (which === "roles") {
    roleSelectOverlay.style.display = "block";
  }
}
function closeOverlay() {
  overlayBackdrop.style.display = "none";
  howToOverlay.style.display = "none";
  creditsOverlay.style.display = "none";
  roleSelectOverlay.style.display = "none";
}

howToBtn.addEventListener("click", () => openOverlay("howto"));
creditsBtn.addEventListener("click", () => openOverlay("credits"));
overlayCloseBtn1.addEventListener("click", closeOverlay);
overlayCloseBtn2.addEventListener("click", closeOverlay);
roleOverlayCloseBtn.addEventListener("click", closeOverlay);
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

// --- Menü butonları ---
hostBtn.addEventListener("click", () => {
  mode = "host";
  menuSection.style.display = "none";
  connectionSection.style.display = "block";
  roomCodeGroup.style.display = "none"; // host iken oda kodu girmeye gerek yok
});

joinMenuBtn.addEventListener("click", () => {
  mode = "join";
  menuSection.style.display = "none";
  connectionSection.style.display = "block";
  roomCodeGroup.style.display = "block"; // join iken oda kodu gerekli
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

  if (mode === "host") {
    socket.emit("createRoom", { name });
  } else {
    if (!roomCode) {
      joinError.style.display = "block";
      joinError.textContent = "Odaya katılmak için oda kodu girmelisin.";
      return;
    }
    socket.emit("joinRoom", { name, roomCode });
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
document.querySelectorAll(".role-card").forEach((card) => {
  card.addEventListener("click", () => {
    const role = card.getAttribute("data-role");
    roleError.style.display = "none";
    roleError.textContent = "";
    socket.emit("chooseRole", { role });
    closeOverlay();
  });
});

// Vaka seçimi (şimdilik placeholder)
selectCaseBtn.addEventListener("click", () => {
  showLobbyInfo("Şimdilik tek bir vaka mevcut. Yeni vakalar yakında eklenecek.");
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

// Sunucudan gelenler

socket.on("welcome", (data) => {
  myId = data.id;
});

socket.on("roomCreated", ({ roomCode }) => {
  myRoomCode = roomCode;
  roomCodeDisplay.textContent = roomCode;
});

socket.on("joinSuccess", (data) => {
  connectionSection.style.display = "none";
  lobbySection.style.display = "block";
  myRoomCode = data.roomCode || myRoomCode;
  myRole = data.role || null;
  updateMyRoleInfo();
  if (myRoomCode) {
    roomCodeDisplay.textContent = myRoomCode;
  }

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
  // Kendi rol ve hazır durumumu güncelle
  const me = data.players.find((p) => p.id === myId);
  if (me) {
    myRole = me.role || null;
    myLobbyReady = !!me.lobbyReady;
    lobbyReadyBtn.textContent = myLobbyReady ? "Hazır değilim" : "Hazırım";
    updateMyRoleInfo();
  }

  const list = data.players
    .map((p) => {
      let roleLabel;
      if (p.role === "dedektif") roleLabel = "Baş Dedektif";
      else if (p.role === "polis") roleLabel = "Polis";
      else roleLabel = "Rol seçilmedi";

      let readyHtml = "";
      if (currentPhase === 0) {
        // Lobby hazır durumu
        readyHtml = p.lobbyReady
          ? '<span class="tag ready">Hazır</span>'
          : '<span class="tag">Hazır değil</span>';
      } else {
        // Faz hazır durumu
        readyHtml = p.readyPhase > 0
          ? '<span class="tag ready">Hazır</span>'
          : '<span class="tag">Hazır değil</span>';
      }

      return \`\${p.name} (\${roleLabel}) \${readyHtml}\`;
    })
    .join("<br/>");

  playersList.innerHTML = list || "Henüz kimse yok.";
});

socket.on("lobbyMessage", (msg) => {
  showLobbyInfo(msg);
});

socket.on("gameStarting", () => {
  showLobbyInfo("Oyun 3 saniye içinde başlıyor...");
});

socket.on("phaseData", (data) => {
  currentPhase = data.phase;
  phaseInfo.style.display = "none";
  phaseReadyBtn.disabled = false;

  // Lobby açık kalıyor (sağda oyuncuları görmeye devam edersin)
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
    resultText.textContent = "TEBRİKLER! Doğru cevabı buldunuz: " + data.correctAnswer.toUpperCase();
  } else {
    resultText.textContent = "Cevaplar yanlış. Tekrar deneyebilirsiniz.";
    submitAnswerBtn.disabled = false;
    answerInput.disabled = false;
    finalSection.style.display = "block";
  }
});

// Copy link & invite friend
function buildRoomLink() {
  if (!myRoomCode) return window.location.origin;
  return window.location.origin + "?room=" + myRoomCode;
}

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

inviteFriendBtn.addEventListener("click", () => {
  const link = buildRoomLink();
  const text = "Baş Dedektif & Polis oyununda odama katıl! Oda kodu: " + (myRoomCode || "—") + " · Link: " + link;
  if (navigator.share) {
    navigator.share({
      title: "Baş Dedektif & Polis",
      text,
      url: link
    }).catch(() => {});
  } else {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => showLobbyInfo("Davet metni panoya kopyalandı, istediğin yere yapıştırabilirsin."),
        () => showLobbyInfo("Paylaşım desteklenmiyor. Metin: " + text)
      );
    } else {
      showLobbyInfo("Paylaşım desteklenmiyor. Metin: " + text);
    }
  }
});
