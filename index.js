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
    name: p.name,
    role: p.role,
    readyPhase: p.readyPhase
  }));
}

function allPlayersReadyForPhase(roomCode, phase) {
  const room = rooms[roomCode];
  if (!room) return false;
  const arr = Object.values(room.players);
  if (arr.length < MAX_PLAYERS) return false;
  return arr.every((p) => p.readyPhase === phase);
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
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Baş Dedektif & Polis</h1>

          <!-- 1) MENÜ: Oda Oluştur / Odaya Katıl -->
          <div class="section" id="menuSection">
            <h2>Ne yapmak istiyorsun?</h2>
            <div class="menu-buttons">
              <button id="hostBtn">Oda Oluştur</button>
              <button id="joinMenuBtn">Odaya Katıl</button>
            </div>
          </div>

          <!-- 2) BAĞLANTI EKRANI: İsim, Rol (+ gerekiyorsa oda kodu) -->
          <div class="section" id="connectionSection" style="display:none;">
            <div class="label">İsminiz</div>
            <input id="nameInput" placeholder="Takma adınız" />

            <div class="label" style="margin-top:10px;">Rolünüzü seçin</div>
            <select id="roleSelect">
              <option value="dedektif">Baş Dedektif</option>
              <option value="polis">Polis</option>
            </select>

            <div id="roomCodeGroup" style="display:none;">
              <div class="label" style="margin-top:10px;">Oda Kodu</div>
              <input id="roomCodeInput" placeholder="Örn: ABCD1" />
            </div>

            <button id="connectBtn" style="margin-top:10px;">Devam et</button>
            <div id="joinError" class="message" style="display:none;background:#7f1d1d;"></div>
          </div>

          <!-- 3) LOBBY -->
          <div class="section" id="lobbySection" style="display:none;">
            <h2>Lobby</h2>
            <div id="roomCodeDisplay" style="margin-bottom:8px; font-size:14px; opacity:0.8;"></div>
            <div id="myRoleInfo"></div>
            <div id="playersList"></div>
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
          const roleSelect = document.getElementById("roleSelect");
          const roomCodeGroup = document.getElementById("roomCodeGroup");
          const roomCodeInput = document.getElementById("roomCodeInput");
          const connectBtn = document.getElementById("connectBtn");
          const joinError = document.getElementById("joinError");

          // Lobby
          const lobbySection = document.getElementById("lobbySection");
          const myRoleInfo = document.getElementById("myRoleInfo");
          const roomCodeDisplay = document.getElementById("roomCodeDisplay");
          const playersList = document.getElementById("playersList");
          const lobbyMessage = document.getElementById("lobbyMessage");

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

          // Bağlan / Devam et
          connectBtn.addEventListener("click", () => {
            const name = nameInput.value.trim();
            const role = roleSelect.value;
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
              socket.emit("createRoom", { name, role });
            } else {
              if (!roomCode) {
                joinError.style.display = "block";
                joinError.textContent = "Odaya katılmak için oda kodu girmelisin.";
                return;
              }
              socket.emit("joinRoom", { name, role, roomCode });
            }
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
            myRole = data.role;
            myRoomCode = data.roomCode || myRoomCode;
            myRoleInfo.textContent = "Rolün: " + (myRole === "dedektif" ? "Baş Dedektif" : "Polis");
            if (myRoomCode) {
              roomCodeDisplay.textContent = "Oda Kodu: " + myRoomCode;
            }
          });

          socket.on("joinError", (msg) => {
            joinError.style.display = "block";
            joinError.textContent = msg;
          });

          socket.on("playersUpdate", (data) => {
            const list = data.players
              .map((p) => {
                const roleLabel = p.role === "dedektif" ? "Baş Dedektif" : "Polis";
                const readyTag = p.readyPhase > 0 ? '<span class="tag ready">Hazır</span>' : '<span class="tag">Hazır değil</span>';
                return \`\${p.name} (\${roleLabel}) \${readyTag}\`;
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

            if (data.phase >= 1 && data.phase <= 3) {
              lobbySection.style.display = "none";
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
  socket.on("createRoom", ({ name, role }) => {
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
      role,
      readyPhase: 0,
      answer: null
    };

    socket.join(roomCode);
    socket.data.roomCode = roomCode;

    socket.emit("roomCreated", { roomCode });
    socket.emit("joinSuccess", { role, roomCode });
    io.to(roomCode).emit("playersUpdate", { players: getPublicPlayers(roomCode) });
  });

  // Odaya katılma
  socket.on("joinRoom", ({ name, role, roomCode }) => {
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

    const rolesInUse = Object.values(room.players).map((p) => p.role);
    if (rolesInUse.includes(role)) {
      socket.emit("joinError", "Bu rol zaten alınmış. Diğer rolü seçmeyi deneyin.");
      return;
    }

    room.players[socket.id] = {
      id: socket.id,
      name: name || "Anonim",
      role,
      readyPhase: 0,
      answer: null
    };

    socket.join(roomCode);
    socket.data.roomCode = roomCode;

    socket.emit("joinSuccess", { role, roomCode });
    io.to(roomCode).emit("playersUpdate", { players: getPublicPlayers(roomCode) });

    // Oda dolunca oyunu başlat
    if (Object.keys(room.players).length === MAX_PLAYERS) {
      io.to(roomCode).emit("lobbyMessage", "İki oyuncu da bağlandı. Herkes rolünü seçip hazır durumda.");
      room.currentPhase = 1;
      io.to(roomCode).emit("gameStarting");
      setTimeout(() => {
        broadcastPhase(roomCode);
      }, 3000);
    }
  });

  // Faz hazır
  socket.on("phaseReady", ({ phase }) => {
    const roomCode = socket.data?.roomCode;
    if (!roomCode) return;

    const room = rooms[roomCode];
    if (!room || !room.players[socket.id]) return;

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
    if (!roomCode) return;

    const room = rooms[roomCode];
    if (!room || !room.players[socket.id]) return;

    room.players[socket.id].answer = answer;

    const arr = Object.values(room.players);
    if (arr.length < MAX_PLAYERS) return;

    if (arr.every((p) => p.answer !== null)) {
      const correct = normalize(room.puzzle.answer);
      const allCorrect = arr.every((p) => normalize(p.answer) === correct);

      if (allCorrect) {
        io.to(roomCode).emit("finalResult", { success: true, correctAnswer: room.puzzle.answer });
      } else {
        io.to(roomCode).emit("finalResult", { success: false });
        arr.forEach((p) => (p.answer = null));
      }
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
        p.answer = null;
      });
      io.to(roomCode).emit("playersUpdate", { players: getPublicPlayers(roomCode) });
      io.to(roomCode).emit("lobbyMessage", "Bir oyuncu ayrıldı. Oyun resetlendi.");
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Sunucu çalışıyor, port:", PORT);
});
