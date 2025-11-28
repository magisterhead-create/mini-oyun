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

// Oyun durumu (şimdilik tek oda / en fazla 2 oyuncu)
const MAX_PLAYERS = 2;
let players = {}; // socket.id -> { name, role, readyPhase, answer }
let currentPhase = 0; // 0 = rol seçimi, 1-3 = ipuçları, 4 = final cevap

function getPublicPlayers() {
  // Kullanıcılara göstereceğimiz sade bilgi
  return Object.values(players).map((p) => ({
    name: p.name,
    role: p.role,
    readyPhase: p.readyPhase
  }));
}

function allPlayersReadyForPhase(phase) {
  const arr = Object.values(players);
  if (arr.length < MAX_PLAYERS) return false;
  return arr.every((p) => p.readyPhase === phase);
}

function broadcastPhase() {
  if (currentPhase >= 1 && currentPhase <= 3) {
    const clue = puzzle.phases[currentPhase - 1];
    io.emit("phaseData", {
      phase: currentPhase,
      clue,
      finalQuestion: null
    });
  } else if (currentPhase === 4) {
    io.emit("phaseData", {
      phase: currentPhase,
      clue: null,
      finalQuestion: puzzle.finalQuestion
    });
  }
}

// Basit normalize fonksiyonu
function normalize(str) {
  return (str || "").trim().toLowerCase();
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
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Baş Dedektif & Polis</h1>

          <div class="section" id="connectionSection">
            <div class="label">İsminiz</div>
            <input id="nameInput" placeholder="Takma adınız" />

            <div class="label" style="margin-top:10px;">Rolünüzü seçin</div>
            <select id="roleSelect">
              <option value="dedektif">Baş Dedektif</option>
              <option value="polis">Polis</option>
            </select>

            <button id="joinBtn" style="margin-top:10px;">Rolü Seç ve Hazırım</button>
            <div id="joinError" class="message" style="display:none;background:#7f1d1d;"></div>
          </div>

          <div class="section" id="lobbySection" style="display:none;">
            <h2>Lobby</h2>
            <div id="myRoleInfo"></div>
            <div id="playersList"></div>
            <div id="lobbyMessage" class="message" style="display:none;"></div>
          </div>

          <div class="section" id="phaseSection" style="display:none;">
            <h2 id="phaseTitle">Bölüm</h2>
            <div id="phaseContent" class="phase-box"></div>
            <button id="phaseReadyBtn" style="margin-top:10px;">Hazırım (Sonraki Aşama)</button>
            <div id="phaseInfo" class="message" style="display:none;"></div>
          </div>

          <div class="section" id="finalSection" style="display:none;">
            <h2>Son Aşama: Çözüm</h2>
            <div id="finalQuestion"></div>
            <input id="answerInput" placeholder="Cevabınız (ör: garson)" />
            <button id="submitAnswerBtn" style="margin-top:10px;">Cevabı Gönder</button>
            <div id="finalInfo" class="message" style="display:none;"></div>
          </div>

          <div class="section" id="resultSection" style="display:none;">
            <h2>Sonuç</h2>
            <div id="resultText"></div>
          </div>
        </div>

        <script src="/socket.io/socket.io.js"></script>
        <script>
          const socket = io();

          const nameInput = document.getElementById("nameInput");
          const roleSelect = document.getElementById("roleSelect");
          const joinBtn = document.getElementById("joinBtn");
          const joinError = document.getElementById("joinError");

          const lobbySection = document.getElementById("lobbySection");
          const myRoleInfo = document.getElementById("myRoleInfo");
          const playersList = document.getElementById("playersList");
          const lobbyMessage = document.getElementById("lobbyMessage");

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

          let myId = null;
          let myRole = null;
          let currentPhase = 0;

          joinBtn.addEventListener("click", () => {
            const name = nameInput.value.trim();
            const role = roleSelect.value;
            joinError.style.display = "none";
            joinError.textContent = "";

            if (!name) {
              joinError.style.display = "block";
              joinError.textContent = "Lütfen bir isim girin.";
              return;
            }

            socket.emit("joinGame", { name, role });
          });

          phaseReadyBtn.addEventListener("click", () => {
            if (currentPhase >= 1 && currentPhase <= 3) {
              socket.emit("phaseReady", { phase: currentPhase });
              phaseReadyBtn.disabled = true;
              phaseInfo.style.display = "block";
              phaseInfo.textContent = "Hazır olarak işaretlendi. Diğer oyuncu bekleniyor...";
            }
          });

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

          socket.on("joinSuccess", (data) => {
            document.getElementById("connectionSection").style.display = "none";
            lobbySection.style.display = "block";
            myRole = data.role;
            myRoleInfo.textContent = "Rolün: " + (myRole === "dedektif" ? "Baş Dedektif" : "Polis");
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
              // Yeniden denemeye izin vermek için:
              submitAnswerBtn.disabled = false;
              answerInput.disabled = false;
              finalSection.style.display = "block";
            }
          });

          socket.on("roomFull", () => {
            joinError.style.display = "block";
            joinError.textContent = "Oda dolu. Şu an en fazla 2 oyuncu destekleniyor.";
            joinBtn.disabled = true;
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

  if (Object.keys(players).length >= MAX_PLAYERS) {
    socket.emit("roomFull");
    return;
  }

  socket.on("joinGame", ({ name, role }) => {
    if (Object.keys(players).length >= MAX_PLAYERS) {
      socket.emit("joinError", "Oda dolu.");
      return;
    }

    // Rol zaten alınmış mı kontrol edelim (isteğe bağlı, şimdilik 1 dedektif - 1 polis)
    const rolesInUse = Object.values(players).map((p) => p.role);
    if (rolesInUse.includes(role)) {
      socket.emit("joinError", "Bu rol zaten alınmış. Diğer rolü seçmeyi deneyin.");
      return;
    }

    players[socket.id] = {
      id: socket.id,
      name: name || "Anonim",
      role,
      readyPhase: 0,
      answer: null
    };

    socket.emit("joinSuccess", { role });
    io.emit("playersUpdate", { players: getPublicPlayers() });

    // 2 oyuncu olunca lobby mesajı
    if (Object.keys(players).length === MAX_PLAYERS) {
      io.emit("lobbyMessage", "İki oyuncu da bağlandı. Herkes rolünü seçip hazır durumda.");
      // İki oyuncu bağlanınca direkt hazır sayıyoruz (joinGame = hazır)
      players[socket.id].readyPhase = 0;
      io.emit("playersUpdate", { players: getPublicPlayers() });

      // Herkes hazır varsayımı: 3 saniye sonra 1. faz
      io.emit("gameStarting");
      currentPhase = 1;
      setTimeout(() => {
        broadcastPhase();
      }, 3000);
    }
  });

  socket.on("phaseReady", ({ phase }) => {
    if (!players[socket.id]) return;
    players[socket.id].readyPhase = phase;
    io.emit("playersUpdate", { players: getPublicPlayers() });

    if (phase === currentPhase && allPlayersReadyForPhase(phase)) {
      // Bir sonraki aşamaya geç
      if (currentPhase < 3) {
        currentPhase += 1;
        broadcastPhase();
      } else if (currentPhase === 3) {
        currentPhase = 4; // final aşaması
        broadcastPhase();
      }
    }
  });

  socket.on("submitAnswer", ({ answer }) => {
    if (!players[socket.id]) return;
    players[socket.id].answer = answer;

    const arr = Object.values(players);
    if (arr.length < MAX_PLAYERS) return;

    // Her iki oyuncu da cevap verdiyse kontrol et
    if (arr.every((p) => p.answer !== null)) {
      const correct = normalize(puzzle.answer);
      const allCorrect = arr.every((p) => normalize(p.answer) === correct);

      if (allCorrect) {
        io.emit("finalResult", { success: true, correctAnswer: puzzle.answer });
      } else {
        io.emit("finalResult", { success: false });
        // Yeniden deneme için cevapları sıfırlayalım
        arr.forEach((p) => (p.answer = null));
      }
    }
  });

  socket.on("disconnect", () => {
    console.log("Bir kullanıcı ayrıldı:", socket.id);
    delete players[socket.id];

    // Oyun sıfırlama (şimdilik çok basit)
    players = {};
    currentPhase = 0;
    io.emit("playersUpdate", { players: getPublicPlayers() });
    io.emit("lobbyMessage", "Bir oyuncu ayrıldı. Oyun resetlendi.");
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Sunucu çalışıyor, port:", PORT);
});
