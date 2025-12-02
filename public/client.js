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

// --- Yardımcı fonksiyonlar ---

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

  // Sistem mesajı ise daha küçük ve farklı renk
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

  // join ekranından çıkınca ping ve room list döngülerini kes
  stopPingLoop();
  if (roomListContainer) {
    roomListContainer.innerHTML = "Şu anda açık oda yok.";
  }
}

// --- Overlay logic ---

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

// Overlay butonları
howToBtn.addEventListener("click", function () {
  openOverlay("howto");
});

creditsBtn.addEventListener("click", function () {
  openOverlay("credits");
});

overlayCloseBtn1.addEventListener("click", closeOverlay);
overlayCloseBtn2.addEventListener("click", closeOverlay);
roleOverlayCloseBtn.addEventListener("click", closeOverlay);
caseOverlayCloseBtn.addEventListener("click", closeOverlay);

overlayBackdrop.addEventListener("click", function (e) {
  if (e.target === overlayBackdrop) closeOverlay();
});

// Settings toggle
settingsBtn.addEventListener("click", function () {
  if (settingsPanel.style.display === "none") {
    settingsPanel.style.display = "block";
  } else {
    settingsPanel.style.display = "none";
  }
});

// --- Menü butonları ---

hostBtn.addEventListener("click", function () {
  mode = "host";
  menuSection.style.display = "none";
  connectionSection.style.display = "block";
  roomCodeGroup.style.display = "none"; // host iken oda kodu girmeye gerek yok
  if (hostExtraGroup) hostExtraGroup.style.display = "block";
  if (roomListPanel) roomListPanel.style.display = "none";
  stopPingLoop();
});

joinMenuBtn.addEventListener("click", function () {
  mode = "join";
  menuSection.style.display = "none";
  connectionSection.style.display = "block";
  roomCodeGroup.style.display = "block"; // join iken oda kodu gerekli
  if (hostExtraGroup) hostExtraGroup.style.display = "none";
  if (roomListPanel) roomListPanel.style.display = "block";

  // oda listesi iste + ping loop başlat
  requestRoomList();
  startPingLoop();
});

backToMenuFromConnectBtn.addEventListener("click", function () {
  resetUIToMenu();
});

// Bağlan / Devam et
connectBtn.addEventListener("click", function () {
  var name = nameInput.value.trim();
  var roomCode = roomCodeInput.value.trim().toUpperCase();

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
    var roomName = roomNameInput ? roomNameInput.value.trim() : "";
    var roomPassword = roomPasswordInput ? roomPasswordInput.value.trim() : "";
    socket.emit("createRoom", {
      name: name,
      roomName: roomName,
      password: roomPassword
    });
  } else {
    if (!roomCode) {
      joinError.style.display = "block";
      joinError.textContent = "Odaya katılmak için oda kodu girmelisin.";
      return;
    }
    socket.emit("joinRoom", { name: name, roomCode: roomCode });
  }
});

// Lobby hazırım (toggle)
lobbyReadyBtn.addEventListener("click", function () {
  var newReady = !myLobbyReady;
  socket.emit("lobbyReadyToggle", { ready: newReady });
});

// Rol seç ekranını aç
openRoleSelectBtn.addEventListener("click", function () {
  roleError.style.display = "none";
  roleError.textContent = "";
  openOverlay("roles");
});

// Rol kartlarına tıklama
var roleCards = document.querySelectorAll(".role-card");
for (var i = 0; i < roleCards.length; i++) {
  roleCards[i].addEventListener("click", function () {
    var role = this.getAttribute("data-role");
    roleError.style.display = "none";
    roleError.textContent = "";
    socket.emit("chooseRole", { role: role });
    closeOverlay();
  });
}

// CASE kartları
var caseCards = document.querySelectorAll(".case-card");
for (var i2 = 0; i2 < caseCards.length; i2++) {
  caseCards[i2].addEventListener("click", function () {
    selectedCaseId = this.getAttribute("data-case-id");
  });
}

// Case seçimi - overlay aç
selectCaseBtn.addEventListener("click", function () {
  roleError.style.display = "none";
  roleError.textContent = "";
  openOverlay("cases");
});

// Begin Investigation -> seçili case'i sunucuya gönder
beginInvestigationBtn.addEventListener("click", function () {
  if (!myRoomCode) {
    showLobbyInfo("Önce bir odaya bağlı olmalısın.");
    return;
  }
  socket.emit("selectCase", { caseId: selectedCaseId });
  closeOverlay();
});

// Oyunu başlat (sadece host)
startGameBtn.addEventListener("click", function () {
  socket.emit("startGame");
});

// Ana menüye dön (lobiden)
backToMenuBtn.addEventListener("click", function () {
  socket.emit("leaveRoom");
  resetUIToMenu();
});

// Faz hazır
phaseReadyBtn.addEventListener("click", function () {
  if (currentPhase >= 1 && currentPhase <= 3) {
    socket.emit("phaseReady", { phase: currentPhase });
    phaseReadyBtn.disabled = true;
    phaseInfo.style.display = "block";
    phaseInfo.textContent = "Hazır olarak işaretlendi. Diğer oyuncu bekleniyor...";
  }
});

// Cevap gönder
submitAnswerBtn.addEventListener("click", function () {
  var ans = answerInput.value.trim();
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
function sendChatMessage() {
  if (!chatInput) return;
  var text = chatInput.value.trim();
  if (!text) return;
  socket.emit("sendChat", { message: text });
  chatInput.value = "";
}

if (chatSendBtn) {
  chatSendBtn.addEventListener("click", function () {
    sendChatMessage();
  });
}

if (chatInput) {
  chatInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      sendChatMessage();
    }
  });
}

// --- Room list & ping UI ---

if (refreshRoomsBtn) {
  refreshRoomsBtn.addEventListener("click", function () {
    requestRoomList();
  });
}

function openPasswordPromptForRoom(code) {
  var name = nameInput.value.trim();
  if (!name) {
    joinError.style.display = "block";
    joinError.textContent = "Önce bir isim girin, sonra odaya katılabilirsiniz.";
    return;
  }
  var pwd = window.prompt("Bu oda şifreli. Lütfen şifreyi girin:");
  if (pwd === null) return; // iptal
  socket.emit("joinRoom", { name: name, roomCode: code, password: pwd });
}

// --- Sunucudan gelenler ---

socket.on("welcome", function (data) {
  myId = data.id;
});

socket.on("roomCreated", function (payload) {
  myRoomCode = payload.roomCode;
  roomCodeDisplay.textContent = myRoomCode;
});

socket.on("joinSuccess", function (data) {
  connectionSection.style.display = "none";
  lobbySection.style.display = "block";
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

socket.on("joinError", function (msg) {
  joinError.style.display = "block";
  joinError.textContent = msg;
});

socket.on("roleError", function (msg) {
  roleError.style.display = "block";
  roleError.textContent = msg;
});

socket.on("playersUpdate", function (data) {socket.on("playersUpdate", function (data) {
  // Kendi rol ve hazır durumumu güncelle
  var me = null;
  for (var i = 0; i < data.players.length; i++) {
    if (data.players[i].id === myId) {
      me = data.players[i];
      break;
    }
  }

  if (me) {
    myRole = me.role || null;
    myLobbyReady = !!me.lobbyReady;
    lobbyReadyBtn.textContent = myLobbyReady ? "Hazır değilim" : "Hazırım";
    updateMyRoleInfo();

    // ⭐ host isen Oyunu Başlat butonu görünsün
    if (me.isHost) {
      startGameBtn.style.display = "inline-flex";
    } else {
      startGameBtn.style.display = "none";
    }
  }

  var listHtml = "";
  for (var j = 0; j < data.players.length; j++) {
    var p = data.players[j];

    var roleLabel;
    if (p.role === "dedektif") roleLabel = "Baş Dedektif";
    else if (p.role === "polis") roleLabel = "Polis";
    else roleLabel = "Rol seçilmedi";

    var readyHtml = "";
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

    // HOST etiketi
    var hostHtml = p.isHost
      ? '<span class="host-label">HOST</span>'
      : '';

    // ⭐ Kick link (sadece host görür ve kendine değil)
    var kickHtml = "";
    if (me && me.isHost && p.id !== myId) {
      kickHtml =
        ' <span class="kick-link" data-kick-id="' +
        p.id +
        '">Kick</span>';
    }

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

  // ⭐ Kick linklerine tıklama
  if (me && me.isHost) {
    var kickLinks = playersList.querySelectorAll(".kick-link");
    kickLinks.forEach(function (el) {
      el.addEventListener("click", function () {
        var targetId = this.getAttribute("data-kick-id");
        if (!targetId) return;
        var sure = window.confirm("Bu oyuncuyu odadan atmak istediğine emin misin?");
        if (!sure) return;
        socket.emit("kickPlayer", { targetId: targetId });
      });
    });
  }
});

  }

  if (me) {
    myRole = me.role || null;
    myLobbyReady = !!me.lobbyReady;
    lobbyReadyBtn.textContent = myLobbyReady ? "Hazır değilim" : "Hazırım";
    updateMyRoleInfo();
  }

  // Host ben miyim? Butonu güncelle
  if (hostId && hostId === myId) {
    startGameBtn.style.display = "inline-flex";
  } else {
    startGameBtn.style.display = "none";
  }

  var listHtml = "";
  for (var j = 0; j < players.length; j++) {
    var p = players[j];

    var roleLabel;
    if (p.role === "dedektif") roleLabel = "Baş Dedektif";
    else if (p.role === "polis") roleLabel = "Polis";
    else roleLabel = "Rol seçilmedi";

    var readyHtml = "";
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

    var hostHtml = "";
    if (hostId && p.id === hostId) {
      hostHtml = '<span class="tag host">HOST</span>';
    }

    listHtml +=
      p.name + " (" + roleLabel + ") " + hostHtml + " " + readyHtml + "<br/>";
  }

  playersList.innerHTML = listHtml || "Henüz kimse yok.";
});

socket.on("lobbyMessage", function (msg) {
  showLobbyInfo(msg);
  // aynı mesajı sistem chat'e de düşürelim
  addChatMessage({
    from: "Sistem",
    text: msg,
    time: Date.now(),
    isSystem: true
  });
});
socket.on("kicked", function (data) {
  var reason = (data && data.reason) || "Host seni odadan attı.";
  alert(reason);
  resetUIToMenu();
});

socket.on("gameStarting", function () {
  showLobbyInfo("Oyun 3 saniye içinde başlıyor...");
});

socket.on("caseSelected", function (data) {
  // seçilen vakayı lobide göster
  showLobbyInfo("Seçilen vaka: " + data.title);
  selectCaseBtn.textContent = "Vaka: " + data.title;
});

socket.on("phaseData", function (data) {
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

socket.on("finalResult", function (data) {
  resultSection.style.display = "block";
  finalSection.style.display = "none";

  if (data.success) {
    resultText.textContent =
      "TEBRİKLER! Doğru cevabı buldunuz: " + data.correctAnswer.toUpperCase();
  } else {
    resultText.textContent = "Cevaplar yanlış. Tekrar deneyebilirsiniz.";
    submitAnswerBtn.disabled = false;
    answerInput.disabled = false;
    finalSection.style.display = "block";
  }
});

// Oda listesi güncelleme
socket.on("roomList", function (data) {
  if (!roomListContainer) return;
  var rooms = data.rooms || [];
  if (!rooms.length) {
    roomListContainer.innerHTML = "Şu anda açık oda yok.";
    return;
  }

  var html = "";
  rooms.forEach(function (r) {
    var lockIcon = r.isPrivate ? "🔒" : "🔓";
    var statusLabel = r.status === "LOBBY" ? "Lobby" : "Oyunda";
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

  // tıklayan odaya katılmaya çalışsın
  var items = roomListContainer.querySelectorAll(".room-list-item");
  items.forEach(function (el) {
    el.addEventListener("click", function () {
      var code = this.getAttribute("data-room-code");
      var isPrivate = this.getAttribute("data-private") === "true";

      roomCodeInput.value = code; // inputa da yaz

      if (!isPrivate) {
        var name = nameInput.value.trim();
        if (!name) {
          joinError.style.display = "block";
          joinError.textContent = "Önce bir isim girin, sonra odaya katılabilirsiniz.";
          return;
        }
        socket.emit("joinRoom", { name: name, roomCode: code });
      } else {
        openPasswordPromptForRoom(code);
      }
    });
  });
});

// ping cevabı
socket.on("pongCheck", function (data) {
  if (!data || !data.sentAt) return;
  var rtt = Date.now() - data.sentAt;
  lastPingMs = rtt;
  updatePingLabel(rtt);
});

// Chat mesajı
socket.on("chatMessage", function (data) {
  addChatMessage(data);
});

// --- Paylaşım / link oluşturma ---

function buildRoomLink() {
  if (!myRoomCode) return window.location.origin;
  return window.location.origin + "?room=" + myRoomCode;
}

copyLinkBtn.addEventListener("click", function () {
  var link = buildRoomLink();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(link).then(
      function () {
        showLobbyInfo("Oda linki panoya kopyalandı.");
      },
      function () {
        showLobbyInfo("Link kopyalanamadı, elle kopyalamayı deneyin: " + link);
      }
    );
  } else {
    showLobbyInfo("Tarayıcı kopyalama desteği yok. Link: " + link);
  }
});

inviteFriendBtn.addEventListener("click", function () {
  var link = buildRoomLink();
  var text =
    "Baş Dedektif & Polis oyununda odama katıl! Oda kodu: " +
    (myRoomCode || "—") +
    " · Link: " +
    link;

  if (navigator.share) {
    navigator
      .share({
        title: "Baş Dedektif & Polis",
        text: text,
        url: link
      })
      .catch(function () {});
  } else {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () {
          showLobbyInfo(
            "Davet metni panoya kopyalandı, istediğin yere yapıştırabilirsin."
          );
        },
        function () {
          showLobbyInfo("Paylaşım desteklenmiyor. Metin: " + text);
        }
      );
    } else {
      showLobbyInfo("Paylaşım desteklenmiyor. Metin: " + text);
    }
  }
});
