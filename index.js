// index.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- SABİT BULMACA --- //
const puzzle = {
  answer: "garson",
  phases: [
    "1. İpucu: Kurbanın telefonunda, olaydan kısa süre önce bir restoran garsonuyla yapılan mesajlaşmalar bulunuyor.",
    "2. İpucu: Olay anında, diğer personel ifade verirken garsonun kısa bir süre ortadan kaybolduğunu söylüyor.",
    "3. İpucu: Güvenlik kamerası kayıtlarında, garsonun olay saatine yakın bir zamanda mutfak kapısının yanında telaşla bir şeyi saklamaya çalıştığı görülüyor."
  ],
  finalQuestion: "Katil kim? (cevabı tek kelime olarak yaz)"
};

// ODA BAZLI OYUN YAPISI
const MAX_PLAYERS = 2;

// rooms: roomCode -> { hostId, players: { socketId: {...} }, currentPhase, puzzle }
const rooms = {};

// Basit normalize fonksiyonu
function normalize(str) {
  return (str || "").trim().toLowerCase();
}

function generateRoomCode() {
  let code;
  do {
    code = Math.random().toString(36).substring(2, 7).toUpperCase();
  } while (rooms[code]);
  return code;
}

function getPublicPlayers(roomCode) {
  const room = rooms[roomCode];
  if (!room) return [];
  return Object.values(room.players).map((p) => ({
    id: p.id,
    name: p.name,
    role: p.role,
    readyPhase: p.readyPhase,
    lobbyReady: p.lobbyReady
  }));
}

function allPlayersReadyForPhase(roomCode, phase) {
  const room = rooms[roomCode];
  if (!room) return false;
  const arr = Object.values(room.players);
  if (arr.length < MAX_PLAYERS) return false;
  return arr.every((p) => p.readyPhase === phase);
}

function allLobbyReady(roomCode) {
  const room = rooms[roomCode];
  if (!room) return false;
  const arr = Object.values(room.players);
  if (arr.length < MAX_PLAYERS) return false;
  // Hem rol seçili hem lobbyReady true olmalı
  return arr.every((p) => p.lobbyReady && p.role);
}

function broadcastPhase(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;

  const currentPhase = room.currentPhase;

  if (currentPhase >= 1 && currentPhase <= 3) {
    const clue = room.puzzle.phases[currentPhase - 1];
    io.to(roomCode).emit("phaseData", {
      phase: currentPhase,
      clue,
      finalQuestion: null
    });
  } else if (currentPhase === 4) {
    io.to(roomCode).emit("phaseData", {
      phase: currentPhase,
      clue: null,
      finalQuestion: room.puzzle.finalQuestion
    });
  }
}

// Ana sayfa: HTML + front-end JS
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="tr">
      <head>
        <meta charset="UTF-8" />
        <title>Dedektif & Polis Oyunu</title>
        <style>
          body {
            font-family: sans-serif;
            background: #111;
            color: #f5f5f5;
            display: flex;
            justify-content: center;
            padding-top: 40px;
          }
          .container {
            width: 600px;
            background: #1c1c1c;
            border-radius: 8px;
            padding: 20px 24px;
            box-shadow: 0 0 15px rgba(0,0,0,0.6);
          }
          h1, h2, h3 {
            margin-top: 0;
          }
          .section {
            margin-bottom: 20px;
            padding: 12px;
            border-radius: 6px;
            background: #222;
          }
          .label {
            font-size: 14px;
            opacity: 0.8;
          }
          input, button, select {
            margin-top: 8px;
            padding: 6px 8px;
            border-radius: 4px;
            border: none;
            font-size: 14px;
          }
          input, select {
            width: 100%;
            box-sizing: border-box;
          }
          button {
            cursor: pointer;
            background: #3b82f6;
            color: white;
          }
          button:disabled {
            background: #555;
            cursor: default;
          }
          #playersList {
            font-size: 14px;
          }
          .tag {
            display: inline-block;
            padding: 2px 6px;
            margin-left: 4px;
            border-radius: 4px;
            font-size: 11px;
            background: #333;
          }
          .tag.ready {
            background: #16a34a;
          }
          .message {
            padding: 8px;
            background: #333;
            border-radius: 4px;
            margin-top: 8px;
            font-size: 14px;
          }
          .phase-box {
            white-space: pre-line;
          }
          .menu-buttons {
            display: flex;
            gap: 10px;
            margin-top: 12px;
          }
          .menu-buttons button {
            flex: 1;
          }
          .lobby-actions {
            margin-top: 10px;
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
          }
          .lobby-actions button {
            flex: 1;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Baş Dedektif & Polis</h1>

          <!-- 1) ANA MENÜ -->
          <div class="section" id="menuSection">
            <h2>Ne yapmak istiyorsun?</h2>
            <div class="menu-buttons">
              <button id="hostBtn">Oda Oluştur</button>
              <button id="joinMenuBtn">Odaya Katıl</button>
            </div>
          </div>

          <!-- 2) BAĞLANTI EKRANI -->
          <div class="section" id="connectionSection" style="display:none;">
            <div class="label">İsminiz</div>
            <input id="nameInput" placeholder="Takma adınız" />

            <div id="roomCodeGroup" style="margin-top:10px; display:none;">
              <div class="label">Oda Kodu</div>
              <input id="roomCodeInput" placeholder="Örn: ABCD1" />
            </div>

            <button id="connectBtn" style="margin-top:10px;">Devam et</button>
            <button id="backToMenuFromConnectBtn" style="margin-top:10px; background:#444;">Ana menüye dön</button>
            <div id="joinError" class="message" style="display:none;background:#7f1d1d;"></div>
          </div>

          <!-- 3) LOBBY -->
          <div class="section" id="lobbySection" style="display:none;">
            <h2>Lobby</h2>
            <div id="roomCodeDisplay" style="margin-bottom:8px; font-size:14px; opacity:0.8;"></div>
            <div id="myRoleInfo"></div>

            <div style="margin-top:10px;">
              <div class="label">Rolünü seç</div>
              <select id="lobbyRoleSelect">
                <option value="dedektif">Baş Dedektif</option>
                <option value="polis">Polis</option>
              </select>
              <button id="setRoleBtn" style="margin-top:6px;">Rolü Kaydet</button>
              <div id="roleError" class="message" style="display:none;background:#7f1d1d;"></div>
            </div>

            <div id="playersList" style="margin-top:12px;"></div>

            <div class="lobby-actions">
              <button id="lobbyReadyBtn">Hazırım</button>
              <button id="startGameBtn" style="display:none;">Oyunu Başlat</button>
              <button id="backToMenuBtn" style="background:#444;">Ana menüye dön</button>
            </div>
            <div id="lobbyMessage" class="message" style="display:none;"></div>
          </div>

          <!-- 4) İPUCU FAZLARI -->
          <div class="section" id="phaseSection" style="display:none;">
            <h2 id="phaseTitle">Bölüm</h2>
            <div id="phaseContent" class="phase-box"></div>
            <button id="phaseReadyBtn" style="margin-top:10px;">Hazırım (Sonraki Aşama)</button>
            <div id="phaseInfo" class="message" style="display:none;"></div>
          </div>

          <!-- 5) FİNAL CEVAP -->
          <div class="section" id="finalSection" style="display:none;">
            <h2>Son Aşama: Çözüm</h2>
            <div id="finalQuestion"></div>
            <input id="answerInput" placeholder="Cevabınız (ör: garson)" />
            <button id="submitAnswerBtn" style="margin-top:10px;">Cevabı Gönder</button>
            <div id="finalInfo" class="message" style="display:none;"></div>
          </div>

          <!-- 6) SONUÇ -->
          <div class="section" id="resultSection" style="display:none;">
            <h2>Sonuç</h2>
            <div id="resultText"></div>
          </div>
        </div>

        <script src="/socket.io/socket.io.js"></script>
        <script>
          const socket = io();

          // Menü
          const menuSection = document.getElementById("menuSection");
          const hostBtn = document.getElementById("hostBtn");
          const joinMenuBtn = document.getElementById("joinMenuBtn");

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
          const lobbyRoleSelect = document.getElementById("lobbyRoleSelect");
          const setRoleBtn = document.getElementById("setRoleBtn");
          const roleError = document.getElementById("roleError");

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
            if (myRole === "dedektif") {
              myRoleInfo.textContent = "Rolün: Baş Dedektif";
              lobbyRoleSelect.value = "dedektif";
            } else if (myRole === "polis") {
              myRoleInfo.textContent = "Rolün: Polis";
              lobbyRoleSelect.value = "polis";
            } else {
              myRoleInfo.textContent = "Rolün: (henüz seçilmedi)";
            }
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
            roomCodeDisplay.textContent = "";
            myRoleInfo.textContent = "";
            resultText.textContent = "";
            finalInfo.style.display = "none";
            finalInfo.textContent = "";
            phaseInfo.style.display = "none";
            phaseInfo.textContent = "";
            roleError.style.display = "none";
            roleError.textContent = "";

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
              joinError.textContent = "Önce menüden bir seçenek seçmelisin.";
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

          // Rol seçimi
          setRoleBtn.addEventListener("click", () => {
            const newRole = lobbyRoleSelect.value;
            roleError.style.display = "none";
            roleError.textContent = "";
            socket.emit("chooseRole", { role: newRole });
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
            roomCodeDisplay.textContent = "Oda Kodu: " + roomCode + " (Bu kodu arkadaşınla paylaş)";
          });

          socket.on("joinSuccess", (data) => {
            connectionSection.style.display = "none";
            lobbySection.style.display = "block";
            myRoomCode = data.roomCode || myRoomCode;
            myRole = data.role || null;
            updateMyRoleInfo();
            if (myRoomCode) {
              roomCodeDisplay.textContent = "Oda Kodu: " + myRoomCode;
            }

            // Host ise "Oyunu Başlat" butonu görünsün
            if (data.isHost) {
              startGameBtn.style.display = "inline-block";
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
            lobbyMessage.style.display = "block";
            lobbyMessage.textContent = msg;
          });

          socket.on("gameStarting", () => {
            lobbyMessage.style.display = "block";
            lobbyMessage.textContent = "Oyun 3 saniye içinde başlıyor...";
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
        </script>
      </body>
    </html>
  `);
});

// Socket.io olayları
io.on("connection", (socket) => {
  console.log("Bir kullanıcı bağlandı:", socket.id);
  socket.emit("welcome", { id: socket.id });

  // Oda kurma
  socket.on("createRoom", ({ name }) => {
    const roomCode = generateRoomCode();

    rooms[roomCode] = {
      hostId: socket.id,
      currentPhase: 0,
      puzzle: puzzle, // şimdilik tek bulmaca
      players: {}
    };

    rooms[roomCode].players[socket.id] = {
      id: socket.id,
      name: name || "Anonim",
      role: null,
      readyPhase: 0,
      lobbyReady: false,
      answer: null
    };

    socket.join(roomCode);
    socket.data.roomCode = roomCode;

    socket.emit("roomCreated", { roomCode });
    socket.emit("joinSuccess", { role: null, roomCode, isHost: true });
    io.to(roomCode).emit("playersUpdate", { players: getPublicPlayers(roomCode) });
  });

  // Odaya katılma
  socket.on("joinRoom", ({ name, roomCode }) => {
    roomCode = (roomCode || "").toUpperCase();
    const room = rooms[roomCode];

    if (!room) {
      socket.emit("joinError", "Böyle bir oda bulunamadı.");
      return;
    }

    const playerCount = Object.keys(room.players).length;
    if (playerCount >= MAX_PLAYERS) {
      socket.emit("joinError", "Oda dolu.");
      return;
    }

    room.players[socket.id] = {
      id: socket.id,
      name: name || "Anonim",
      role: null,
      readyPhase: 0,
      lobbyReady: false,
      answer: null
    };

    socket.join(roomCode);
    socket.data.roomCode = roomCode;

    socket.emit("joinSuccess", { role: null, roomCode, isHost: false });
    io.to(roomCode).emit("playersUpdate", { players: getPublicPlayers(roomCode) });

    io.to(roomCode).emit(
      "lobbyMessage",
      "Oyuncular rol seçip 'Hazırım' dedikten sonra host 'Oyunu Başlat' ile oyunu başlatabilir."
    );
  });

  // Lobby hazır toggle
  socket.on("lobbyReadyToggle", ({ ready }) => {
    const roomCode = socket.data?.roomCode;
    if (!roomCode || !rooms[roomCode]) return;

    const room = rooms[roomCode];
    if (!room.players[socket.id]) return;

    room.players[socket.id].lobbyReady = !!ready;
    io.to(roomCode).emit("playersUpdate", { players: getPublicPlayers(roomCode) });
  });

  // Rol seçimi
  socket.on("chooseRole", ({ role }) => {
    const roomCode = socket.data?.roomCode;
    if (!roomCode || !rooms[roomCode]) return;

    const room = rooms[roomCode];
    if (!room.players[socket.id]) return;

    if (role !== "dedektif" && role !== "polis") {
      return;
    }

    // Rol başka biri tarafından alınmış mı?
    const used = Object.values(room.players).some(
      (p) => p.role === role && p.id !== socket.id
    );
    if (used) {
      socket.emit("roleError", "Bu rol zaten alınmış. Diğer rolü seçmeyi dene.");
      return;
    }

    room.players[socket.id].role = role;
    io.to(roomCode).emit("playersUpdate", { players: getPublicPlayers(roomCode) });
  });

  // Host oyunu başlat
  socket.on("startGame", () => {
    const roomCode = socket.data?.roomCode;
    if (!roomCode || !rooms[roomCode]) return;

    const room = rooms[roomCode];
    if (socket.id !== room.hostId) {
      return;
    }

    if (!allLobbyReady(roomCode)) {
      socket.emit(
        "lobbyMessage",
        "Tüm oyuncular hem rol seçmiş hem de hazır olmuş olmalı."
      );
      return;
    }

    room.currentPhase = 1;
    io.to(roomCode).emit("gameStarting");
    setTimeout(() => {
      broadcastPhase(roomCode);
    }, 3000);
  });

  // Faz hazır
  socket.on("phaseReady", ({ phase }) => {
    const roomCode = socket.data?.roomCode;
    if (!roomCode || !rooms[roomCode]) return;

    const room = rooms[roomCode];
    if (!room.players[socket.id]) return;

    room.players[socket.id].readyPhase = phase;
    io.to(roomCode).emit("playersUpdate", { players: getPublicPlayers(roomCode) });

    if (phase === room.currentPhase && allPlayersReadyForPhase(roomCode, phase)) {
      if (room.currentPhase < 3) {
        room.currentPhase += 1;
        broadcastPhase(roomCode);
      } else if (room.currentPhase === 3) {
        room.currentPhase = 4;
        broadcastPhase(roomCode);
      }
    }
  });

  // Cevap gönderme
  socket.on("submitAnswer", ({ answer }) => {
    const roomCode = socket.data?.roomCode;
    if (!roomCode || !rooms[roomCode]) return;

    const room = rooms[roomCode];
    if (!room.players[socket.id]) return;

    room.players[socket.id].answer = answer;

    const arr = Object.values(room.players);
    if (arr.length < MAX_PLAYERS) return;

    if (arr.every((p) => p.answer !== null)) {
      const correct = normalize(room.puzzle.answer);
      const allCorrect = arr.every((p) => normalize(p.answer) === correct);

      if (allCorrect) {
        io.to(roomCode).emit("finalResult", {
          success: true,
          correctAnswer: room.puzzle.answer
        });
      } else {
        io.to(roomCode).emit("finalResult", { success: false });
        arr.forEach((p) => (p.answer = null));
      }
    }
  });

  // Odayı isteyerek terk etme (ana menüye dön)
  socket.on("leaveRoom", () => {
    const roomCode = socket.data?.roomCode;
    if (!roomCode || !rooms[roomCode]) return;

    const room = rooms[roomCode];
    delete room.players[socket.id];
    socket.leave(roomCode);
    socket.data.roomCode = null;

    if (Object.keys(room.players).length === 0) {
      delete rooms[roomCode];
    } else {
      room.currentPhase = 0;
      Object.values(room.players).forEach((p) => {
        p.readyPhase = 0;
        p.lobbyReady = false;
        p.answer = null;
      });
      io.to(roomCode).emit("playersUpdate", { players: getPublicPlayers(roomCode) });
      io.to(roomCode).emit(
        "lobbyMessage",
        "Bir oyuncu lobiden ayrıldı. Oyun resetlendi."
      );
    }
  });

  // Bağlantı kopunca
  socket.on("disconnect", () => {
    console.log("Bir kullanıcı ayrıldı:", socket.id);
    const roomCode = socket.data?.roomCode;
    if (!roomCode || !rooms[roomCode]) return;

    const room = rooms[roomCode];
    delete room.players[socket.id];

    if (Object.keys(room.players).length === 0) {
      delete rooms[roomCode];
    } else {
      room.currentPhase = 0;
      Object.values(room.players).forEach((p) => {
        p.readyPhase = 0;
        p.lobbyReady = false;
        p.answer = null;
      });
      io.to(roomCode).emit("playersUpdate", { players: getPublicPlayers(roomCode) });
      io.to(roomCode).emit(
        "lobbyMessage",
        "Bir oyuncu ayrıldı. Oyun resetlendi."
      );
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Sunucu çalışıyor, port:", PORT);
});
