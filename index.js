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
        <title>Baş Dedektif & Polis</title>
        <style>
          :root {
            --accent: #3b82f6;
            --accent-soft: rgba(59, 130, 246, 0.15);
            --bg: #050816;
            --bg-card: #111827;
            --bg-section: #111;
            --text-main: #f9fafb;
            --text-muted: #9ca3af;
            --danger: #b91c1c;
            --success: #16a34a;
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            background: radial-gradient(circle at top, #1d2538, #050816);
            color: var(--text-main);
            display: flex;
            justify-content: center;
            align-items: flex-start;
            min-height: 100vh;
            margin: 0;
            padding: 40px 12px;
          }
          .container {
            width: 100%;
            max-width: 900px;
            background: radial-gradient(circle at top left, #1f2937, #020617);
            border-radius: 16px;
            padding: 24px 24px 16px;
            box-shadow:
              0 25px 50px -12px rgba(0,0,0,0.8),
              0 0 0 1px rgba(148,163,184,0.1);
            position: relative;
            overflow: hidden;
          }
          .container::before {
            content: "";
            position: absolute;
            inset: 0;
            background: radial-gradient(circle at top right, rgba(59,130,246,0.12), transparent 55%);
            opacity: 0.9;
            pointer-events: none;
          }
          .content {
            position: relative;
            z-index: 1;
          }
          h1 {
            margin: 0 0 4px;
            font-size: 28px;
            letter-spacing: 0.06em;
            text-transform: uppercase;
          }
          .game-subtitle {
            margin: 0 0 16px;
            font-size: 13px;
            color: var(--text-muted);
            letter-spacing: 0.12em;
            text-transform: uppercase;
          }
          .section {
            margin-bottom: 16px;
            padding: 14px 16px;
            border-radius: 12px;
            background: rgba(15,23,42,0.92);
            border: 1px solid rgba(148,163,184,0.25);
          }
          .section.main-menu {
            margin: 0 auto 20px;
            max-width: 420px;
          }
          .screen-title {
            margin: 0 0 4px;
            font-size: 18px;
          }
          .screen-subtitle {
            margin: 0 0 14px;
            font-size: 13px;
            color: var(--text-muted);
          }

          .label {
            font-size: 13px;
            opacity: 0.9;
            color: var(--text-muted);
          }
          input, select {
            margin-top: 6px;
            padding: 6px 9px;
            border-radius: 8px;
            border: 1px solid rgba(148,163,184,0.4);
            font-size: 14px;
            width: 100%;
            background: rgba(15,23,42,0.9);
            color: var(--text-main);
            outline: none;
          }
          input:focus, select:focus {
            border-color: var(--accent);
            box-shadow: 0 0 0 1px rgba(37,99,235,0.6);
          }

          button {
            margin-top: 8px;
            padding: 7px 10px;
            border-radius: 999px;
            border: none;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.15s ease;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            white-space: nowrap;
          }
          button:disabled {
            background: #4b5563;
            cursor: default;
            transform: none;
            box-shadow: none;
          }

          .btn-primary {
            background: linear-gradient(135deg, #2563eb, #4f46e5);
            color: #f9fafb;
            box-shadow: 0 8px 18px rgba(37,99,235,0.45);
          }
          .btn-primary:hover:not(:disabled) {
            transform: translateY(-1px);
            box-shadow: 0 12px 25px rgba(37,99,235,0.6);
          }

          .btn-secondary {
            background: rgba(15,23,42,0.9);
            color: #e5e7eb;
            border: 1px solid rgba(148,163,184,0.6);
          }
          .btn-secondary:hover:not(:disabled) {
            background: rgba(30,64,175,0.4);
            border-color: rgba(129,140,248,0.8);
            transform: translateY(-1px);
          }

          .btn-ghost {
            background: transparent;
            color: var(--text-muted);
            border: 1px solid rgba(75,85,99,0.9);
          }
          .btn-ghost:hover {
            background: rgba(31,41,55,0.9);
            color: #e5e7eb;
          }

          .btn-link {
            background: transparent;
            color: var(--text-muted);
            border: none;
            font-size: 13px;
            padding: 4px 6px;
          }
          .btn-link:hover {
            color: var(--accent);
            text-decoration: underline;
            background: rgba(15,23,42,0.6);
          }

          .btn-small {
            font-size: 12px;
            padding: 5px 10px;
          }

          .btn-large {
            padding: 10px 14px;
            font-size: 15px;
            font-weight: 600;
          }

          .menu-buttons {
            display: flex;
            flex-direction: column; /* her zaman dikey */
            gap: 10px;
            margin-top: 8px;
          }

          .settings-btn {
            border-radius: 999px;
            padding-inline: 14px;
            background: rgba(15,23,42,0.95);
            border-color: rgba(148,163,184,0.7);
            color: #e5e7eb;
            box-shadow: 0 6px 14px rgba(15,23,42,0.9);
          }
          .settings-btn:hover {
            background: rgba(37,99,235,0.18);
            border-color: rgba(129,140,248,0.9);
            color: #f9fafb;
            transform: translateY(-1px);
          }

          #playersList {
            font-size: 13px;
          }
          .tag {
            display: inline-block;
            padding: 3px 7px;
            margin-left: 4px;
            border-radius: 999px;
            font-size: 11px;
            background: #374151;
          }
          .tag.ready {
            background: var(--success);
            color: #ecfdf5;
          }

          .message {
            padding: 8px 9px;
            background: rgba(31,41,55,0.95);
            border-radius: 9px;
            margin-top: 8px;
            font-size: 13px;
            border: 1px solid rgba(55,65,81,0.9);
          }
          .message.error {
            background: rgba(127,29,29,0.9);
            border-color: rgba(248,113,113,0.7);
            color: #fee2e2;
          }
          .message.info-soft {
            background: rgba(30,64,175,0.45);
            border-color: rgba(129,140,248,0.8);
          }

          .phase-box {
            white-space: pre-line;
            font-size: 14px;
            line-height: 1.5;
          }

          .lobby-layout {
            display: grid;
            grid-template-columns: minmax(0, 1.1fr) minmax(0, 1.3fr);
            gap: 12px;
          }
          @media (max-width: 720px) {
            .lobby-layout {
              grid-template-columns: minmax(0, 1fr);
            }
          }

          .sub-panel {
            margin-top: 8px;
            padding: 8px 10px;
            border-radius: 10px;
            background: rgba(15,23,42,0.95);
            border: 1px dashed rgba(148,163,184,0.5);
            font-size: 13px;
            color: var(--text-muted);
          }

          .footer-bar {
            margin-top: 14px;
            padding-top: 10px;
            border-top: 1px solid rgba(55,65,81,0.9);
            display: flex;
            justify-content: space-between;
            gap: 10px;
          }

          .footer-bar-left {
            display: flex;
            gap: 8px;
          }
          .footer-bar-right {
            font-size: 11px;
            color: rgba(148,163,184,0.8);
            align-self: center;
          }

          /* Overlay */
          .overlay-backdrop {
            position: fixed;
            inset: 0;
            background: rgba(15,23,42,0.85);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 50;
          }
          .overlay-card {
            background: radial-gradient(circle at top, #111827, #020617);
            border-radius: 14px;
            border: 1px solid rgba(148,163,184,0.5);
            padding: 16px 18px 12px;
            max-width: 420px;
            width: calc(100% - 32px);
            box-shadow: 0 20px 40px rgba(0,0,0,0.85);
          }
          .overlay-card h3 {
            margin: 0 0 6px;
            font-size: 18px;
          }
          .overlay-card p {
            margin: 4px 0;
            font-size: 13px;
            color: var(--text-muted);
          }
          .overlay-footer {
            margin-top: 10px;
            display: flex;
            justify-content: flex-end;
          }

          /* Lobby dikey kart */
          #lobbySection {
            max-width: 420px;
            margin: 0 auto;
          }
          .lobby-top-strip {
            padding: 8px 10px 10px;
            border-radius: 10px;
            background: rgba(15,23,42,0.95);
            border: 1px solid rgba(55,65,81,0.8);
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-bottom: 10px;
          }
          .lobby-top-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
          }
          .room-code-label {
            font-size: 11px;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.12em;
          }
          .room-code-text {
            font-size: 16px;
            font-weight: 600;
            letter-spacing: 0.16em;
          }
          .lobby-top-actions {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
            justify-content: flex-end;
          }
          .btn-chip {
            font-size: 11px;
            padding: 5px 10px;
            border-radius: 999px;
          }
          .players-box-wrapper {
            margin-top: 4px;
          }
          .players-box-title {
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.14em;
            color: var(--text-muted);
            margin-bottom: 4px;
          }
          .players-box {
            padding: 8px 10px;
            border-radius: 10px;
            background: rgba(15,23,42,0.95);
            border: 1px solid rgba(55,65,81,0.8);
            min-height: 42px;
          }

          .lobby-setup {
            margin-top: 12px;
            padding-top: 10px;
            border-top: 1px solid rgba(55,65,81,0.9);
          }
          .lobby-setup-title {
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.14em;
            color: var(--text-muted);
            margin-bottom: 6px;
          }
          .setup-grid {
            display: grid;
            grid-template-columns: minmax(0, 1fr);
            gap: 10px;
          }
          .setup-note {
            font-size: 11px;
            color: var(--text-muted);
            margin-top: 3px;
          }

          .lobby-actions {
            margin-top: 14px;
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
          <div class="content">
            <h1>Baş Dedektif & Polis</h1>
            <div class="game-subtitle">ONLINE CO-OP DEDÜKTİF OYUNU</div>

            <!-- 1) ANA MENÜ -->
            <div class="section main-menu" id="menuSection">
              <h2 class="screen-title">Ana Menü</h2>
              <p class="screen-subtitle">
                Bir oda kurup arkadaşını davet et veya oda koduyla bir oyuna katıl.
              </p>
              <div class="menu-buttons">
                <button id="hostBtn" class="btn-primary btn-large">
                  ODA OLUŞTUR
                </button>
                <button id="joinMenuBtn" class="btn-secondary btn-large">
                  ODAYA KATIL
                </button>
              </div>

              <button id="settingsBtn" class="btn-ghost btn-small settings-btn" style="margin-top:14px;">
                ⚙️ Settings
              </button>
              <div id="settingsPanel" class="sub-panel" style="display:none;">
                <div style="margin-bottom:4px; font-weight:500; color:#e5e7eb;">Oyun Ayarları (placeholder)</div>
                <p>Şimdilik sadece görsel. İleride ses seviyesi, dil, tema gibi ayarları buraya ekleyebiliriz.</p>
              </div>

              <div class="footer-bar">
                <div class="footer-bar-left">
                  <button id="howToBtn" class="btn-link">How to Play</button>
                  <button id="creditsBtn" class="btn-link">Credits</button>
                </div>
                <div class="footer-bar-right">
                  v0.1 · prototip build
                </div>
              </div>
            </div>

            <!-- 2) BAĞLANTI EKRANI -->
            <div class="section" id="connectionSection" style="display:none;">
              <h2 class="screen-title">Bağlan</h2>
              <p class="screen-subtitle">
                İsmini yaz, sonra odaya bağlan. Rolünü lobide seçeceksin.
              </p>

              <div class="label">İsmin</div>
              <input id="nameInput" placeholder="Takma adın (örn: DedektifAyşe)" />

              <div id="roomCodeGroup" style="margin-top:12px; display:none;">
                <div class="label">Oda Kodu</div>
                <input id="roomCodeInput" placeholder="Örn: ABCD1" />
              </div>

              <div style="display:flex; gap:8px; margin-top:14px; flex-wrap:wrap;">
                <button id="connectBtn" class="btn-primary" style="flex:1;">Devam et</button>
                <button id="backToMenuFromConnectBtn" class="btn-secondary" style="flex:1;">Ana menüye dön</button>
              </div>

              <div id="joinError" class="message error" style="display:none;"></div>
            </div>

            <!-- 3) LOBBY + OYUN GÖRÜNÜMÜ -->
            <div class="lobby-layout">
              <!-- Lobby Section -->
              <div class="section" id="lobbySection" style="display:none;">
                <h2 class="screen-title">Lobby</h2>
                <p class="screen-subtitle">
                  Rolünü seç, hazır ol ve host oyunu başlatsın.
                </p>

                <!-- Üst şerit: Room code + davet -->
                <div class="lobby-top-strip">
                  <div class="lobby-top-row">
                    <div>
                      <div class="room-code-label">Room code</div>
                      <div id="roomCodeDisplay" class="room-code-text">— — — — —</div>
                    </div>
                    <div class="lobby-top-actions">
                      <button id="copyLinkBtn" class="btn-secondary btn-chip">
                        Kopyala
                      </button>
                      <button id="inviteFriendBtn" class="btn-primary btn-chip">
                        Invite friend
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Oyuncular -->
                <div class="players-box-wrapper">
                  <div class="players-box-title">Players in room</div>
                  <div class="players-box">
                    <div id="playersList"></div>
                  </div>
                </div>

                <!-- Kurulum strip: rol + vaka -->
                <div class="lobby-setup">
                  <div class="lobby-setup-title">Setup</div>
                  <div class="setup-grid">
                    <div>
                      <div id="myRoleInfo" style="font-size:13px; margin-bottom:6px;"></div>
                      <div class="label">Rolünü seç</div>
                      <select id="lobbyRoleSelect" style="margin-top:6px;">
                        <option value="dedektif">Baş Dedektif</option>
                        <option value="polis">Polis</option>
                      </select>
                      <button id="setRoleBtn" class="btn-secondary btn-small" style="margin-top:6px;">
                        Rolü Kaydet
                      </button>
                      <div id="roleError" class="message error" style="display:none;"></div>
                    </div>

                    <div>
                      <div class="label">Vaka seç (yakında)</div>
                      <button id="selectCaseBtn" class="btn-ghost btn-small" style="margin-top:6px;">
                        Default Case
                      </button>
                      <div class="setup-note">
                        Şimdilik tek vaka var. İleride farklı hikâyeler buradan seçilecek.
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Alt: aksiyonlar -->
                <div class="lobby-actions">
                  <button id="lobbyReadyBtn" class="btn-primary">Hazırım</button>
                  <button id="startGameBtn" class="btn-secondary" style="display:none;">Oyunu Başlat</button>
                  <button id="backToMenuBtn" class="btn-ghost">Ana menüye dön</button>
                </div>
                <div id="lobbyMessage" class="message info-soft" style="display:none; margin-top:10px;"></div>
              </div>

              <!-- Sağ tarafta faz / final / sonuç -->
              <div>
                <!-- 4) İPUCU FAZLARI -->
                <div class="section" id="phaseSection" style="display:none;">
                  <h2 id="phaseTitle">Bölüm</h2>
                  <div id="phaseContent" class="phase-box"></div>
                  <button id="phaseReadyBtn" class="btn-primary" style="margin-top:10px;">
                    Hazırım (Sonraki Aşama)
                  </button>
                  <div id="phaseInfo" class="message info-soft" style="display:none;"></div>
                </div>

                <!-- 5) FİNAL CEVAP -->
                <div class="section" id="finalSection" style="display:none;">
                  <h2>Son Aşama: Çözüm</h2>
                  <div id="finalQuestion" style="margin-bottom:6px;"></div>
                  <input id="answerInput" placeholder="Cevabınız (ör: garson)" />
                  <button id="submitAnswerBtn" class="btn-primary" style="margin-top:10px;">
                    Cevabı Gönder
                  </button>
                  <div id="finalInfo" class="message info-soft" style="display:none;"></div>
                </div>

                <!-- 6) SONUÇ -->
                <div class="section" id="resultSection" style="display:none;">
                  <h2>Sonuç</h2>
                  <div id="resultText"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- HOW TO PLAY / CREDITS OVERLAY -->
        <div id="overlayBackdrop" class="overlay-backdrop" style="display:none;">
          <div class="overlay-card" id="howToOverlay" style="display:none;">
            <h3>How to Play</h3>
            <p>1. Bir oyuncu oda oluşturur ve oluşan oda kodunu arkadaşına gönderir.</p>
            <p>2. Diğer oyuncu “Odaya Katıl” deyip oda kodunu yazar.</p>
            <p>3. Lobide herkes rolünü seçer ve “Hazırım” der.</p>
            <p>4. Host “Oyunu Başlat” dediğinde ipuçları aşama aşama açılır.</p>
            <p>5. Son aşamada herkes katilin kim olduğunu yazar; iki oyuncu da doğruysa kazanırsınız.</p>
            <div class="overlay-footer">
              <button id="overlayCloseBtn1" class="btn-secondary btn-small">Kapat</button>
            </div>
          </div>

          <div class="overlay-card" id="creditsOverlay" style="display:none;">
            <h3>Credits</h3>
            <p>Oyun tasarımı, hikâye ve geliştirme:</p>
            <p>👤 Sen + yapay zeka asistanın (co-op dev mode)</p>
            <p>Teknolojiler: Node.js, Express, Socket.IO, Render</p>
            <div class="overlay-footer">
              <button id="overlayCloseBtn2" class="btn-secondary btn-small">Kapat</button>
            </div>
          </div>
        </div>

        <script src="/socket.io/socket.io.js"></script>
        <script>
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
          const overlayCloseBtn1 = document.getElementById("overlayCloseBtn1");
          const overlayCloseBtn2 = document.getElementById("overlayCloseBtn2");

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
          const copyLinkBtn = document.getElementById("copyLinkBtn");
          const inviteFriendBtn = document.getElementById("inviteFriendBtn");
          const selectCaseBtn = document.getElementById("selectCaseBtn");

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
            if (which === "howto") {
              howToOverlay.style.display = "block";
              creditsOverlay.style.display = "none";
            } else if (which === "credits") {
              howToOverlay.style.display = "none";
              creditsOverlay.style.display = "block";
            }
          }
          function closeOverlay() {
            overlayBackdrop.style.display = "none";
            howToOverlay.style.display = "none";
            creditsOverlay.style.display = "none";
          }

          howToBtn.addEventListener("click", () => openOverlay("howto"));
          creditsBtn.addEventListener("click", () => openOverlay("credits"));
          overlayCloseBtn1.addEventListener("click", closeOverlay);
          overlayCloseBtn2.addEventListener("click", closeOverlay);
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

          // Rol seçimi
          setRoleBtn.addEventListener("click", () => {
            const newRole = lobbyRoleSelect.value;
            roleError.style.display = "none";
            roleError.textContent = "";
            socket.emit("chooseRole", { role: newRole });
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
