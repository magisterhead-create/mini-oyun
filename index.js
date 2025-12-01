// index.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// public klasörünü statik olarak sun
app.use(express.static("public"));

// --- VAKALAR / CASE'LER --- //
const CASES = {
  restaurant_murder: {
    id: "restaurant_murder",
    title: "Restorandaki Cinayet",
    victimName: "Mert Yılmaz",
    victimDesc:
      "Şehrin bilinen iş insanlarından, akşam yemeği sırasında öldürülüyor.",
    location: "İstanbul, Nişantaşı - şık bir restoran",
    time: "22:30 civarı",
    suspects: [
      {
        name: "Restoran Garsonu",
        brief: "Olaydan kısa süre önce kurbanla mesajlaşıyor.",
      },
      {
        name: "İş Ortağı",
        brief: "Son zamanlarda araları bozuk, maddi anlaşmazlık var.",
      },
      {
        name: "Eski Sevgili",
        brief: "Restorana tesadüfen gelmiş gibi davranıyor.",
      },
    ],
    answer: "garson",
    phases: [
      "1. İpucu: Kurbanın telefonunda, olaydan kısa süre önce bir restoran garsonuyla yapılan mesajlaşmalar bulunuyor.",
      "2. İpucu: Olay anında, diğer personel ifade verirken garsonun kısa bir süre ortadan kaybolduğunu söylüyor.",
      "3. İpucu: Güvenlik kamerası kayıtlarında, garsonun olay saatine yakın bir zamanda mutfak kapısının yanında telaşla bir şeyi saklamaya çalıştığı görülüyor.",
    ],
    finalQuestion: "Katil kim? (cevabı tek kelime olarak yaz)",
  },
};

const DEFAULT_CASE_ID = "restaurant_murder";

// ODA BAZLI OYUN YAPISI
const MAX_PLAYERS = 2;

// rooms: roomCode -> {
//   hostId,
//   players: { socketId: {...} },
//   currentPhase,
//   puzzle,
//   selectedCaseId,
//   name, isPrivate, password, createdAt
// }
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
    lobbyReady: p.lobbyReady,
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
      finalQuestion: null,
    });
  } else if (currentPhase === 4) {
    io.to(roomCode).emit("phaseData", {
      phase: currentPhase,
      clue: null,
      finalQuestion: room.puzzle.finalQuestion,
    });
  }
}

// Oda listesi üret (community server list için)
function getPublicRoomList() {
  const list = Object.entries(rooms).map(([code, room]) => {
    const currentPlayers = Object.keys(room.players).length;
    return {
      roomCode: code,
      name: room.name || "İsimsiz Oda",
      isPrivate: !!room.isPrivate,
      currentPlayers,
      maxPlayers: MAX_PLAYERS,
      caseTitle: room.puzzle?.title || null,
      status: room.currentPhase === 0 ? "LOBBY" : "IN_GAME",
      createdAt: room.createdAt || 0,
    };
  });

  // Dolu odaları istersen filtreleyebiliriz (şimdilik herkes görebilsin ama client doluysa katılmayı engeller)
  // .filter(r => r.currentPlayers < r.maxPlayers);

  // Önce lobbydekiler, sonra eski/yeniler
  list.sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === "LOBBY" ? -1 : 1;
    }
    return a.createdAt - b.createdAt;
  });

  return list;
}

function broadcastRoomList() {
  io.emit("roomList", { rooms: getPublicRoomList() });
}

// Socket.io olayları
io.on("connection", (socket) => {
  console.log("Bir kullanıcı bağlandı:", socket.id);
  socket.emit("welcome", { id: socket.id });

  // basit ping altyapısı (client burada RTT ölçebilir)
  socket.on("pingCheck", (payload) => {
    socket.emit("pongCheck", {
      sentAt: payload?.sentAt || null,
      serverNow: Date.now(),
    });
  });

  // Oda listesi isteği (join ekranındaki "serverleri yenile" butonu vs. burayı kullanacak)
  socket.on("getRoomList", () => {
    socket.emit("roomList", { rooms: getPublicRoomList() });
  });

  // Oda kurma
  socket.on("createRoom", ({ name, roomName, password }) => {
    const roomCode = generateRoomCode();

    rooms[roomCode] = {
      hostId: socket.id,
      currentPhase: 0,
      selectedCaseId: DEFAULT_CASE_ID,
      puzzle: CASES[DEFAULT_CASE_ID], // varsayılan vaka
      name: roomName || "İsimsiz Oda",
      isPrivate: !!password,
      password: password || null, // basit string, istersen ileride hash yaparsın
      createdAt: Date.now(),
      players: {},
    };

    rooms[roomCode].players[socket.id] = {
      id: socket.id,
      name: name || "Anonim",
      role: null,
      readyPhase: 0,
      lobbyReady: false,
      answer: null,
    };

    socket.join(roomCode);
    socket.data.roomCode = roomCode;

    socket.emit("roomCreated", { roomCode });
    socket.emit("joinSuccess", { role: null, roomCode, isHost: true });
    io.to(roomCode).emit("playersUpdate", {
      players: getPublicPlayers(roomCode),
    });

    broadcastRoomList();
  });

  // Odaya katılma
  socket.on("joinRoom", ({ name, roomCode, password }) => {
    roomCode = (roomCode || "").toUpperCase();
    const room = rooms[roomCode];

    if (!room) {
      socket.emit("joinError", "Böyle bir oda bulunamadı.");
      return;
    }

    // Şifre kontrolü (oda private ise)
    if (room.isPrivate) {
      const given = (password || "").trim();
      const real = (room.password || "").trim();
      if (!given || given !== real) {
        socket.emit("joinError", "Bu oda şifreli. Şifre yanlış.");
        return;
      }
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
      answer: null,
    };

    socket.join(roomCode);
    socket.data.roomCode = roomCode;

    socket.emit("joinSuccess", { role: null, roomCode, isHost: false });
    io.to(roomCode).emit("playersUpdate", {
      players: getPublicPlayers(roomCode),
    });

    io.to(roomCode).emit(
      "lobbyMessage",
      "Oyuncular rol seçip 'Hazırım' dedikten sonra host 'Oyunu Başlat' ile oyunu başlatabilir."
    );

    broadcastRoomList();
  });

  // Lobby hazır toggle
  socket.on("lobbyReadyToggle", ({ ready }) => {
    const roomCode = socket.data?.roomCode;
    if (!roomCode || !rooms[roomCode]) return;

    const room = rooms[roomCode];
    if (!room.players[socket.id]) return;

    room.players[socket.id].lobbyReady = !!ready;
    io.to(roomCode).emit("playersUpdate", {
      players: getPublicPlayers(roomCode),
    });
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
    io.to(roomCode).emit("playersUpdate", {
      players: getPublicPlayers(roomCode),
    });
  });

  // Vaka seçme (sadece host)
  socket.on("selectCase", ({ caseId }) => {
    const roomCode = socket.data?.roomCode;
    if (!roomCode || !rooms[roomCode]) return;

    const room = rooms[roomCode];

    // sadece host değiştirebilsin
    if (socket.id !== room.hostId) return;

    if (!CASES[caseId]) return;

    room.selectedCaseId = caseId;
    room.puzzle = CASES[caseId];

    // lobide herkese hangi vakanın seçildiğini söyle
    io.to(roomCode).emit("caseSelected", {
      caseId: caseId,
      title: CASES[caseId].title,
    });

    broadcastRoomList();
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
    broadcastRoomList(); // status LOBBY -> IN_GAME

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
    io.to(roomCode).emit("playersUpdate", {
      players: getPublicPlayers(roomCode),
    });

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
      const allCorrect = arr.every(
        (p) => normalize(p.answer) === correct
      );

      if (allCorrect) {
        io.to(roomCode).emit("finalResult", {
          success: true,
          correctAnswer: room.puzzle.answer,
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
      io.to(roomCode).emit("playersUpdate", {
        players: getPublicPlayers(roomCode),
      });
      io.to(roomCode).emit(
        "lobbyMessage",
        "Bir oyuncu lobiden ayrıldı. Oyun resetlendi."
      );
    }

    broadcastRoomList();
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
      io.to(roomCode).emit("playersUpdate", {
        players: getPublicPlayers(roomCode),
      });
      io.to(roomCode).emit(
        "lobbyMessage",
        "Bir oyuncu ayrıldı. Oyun resetlendi."
      );
    }

    broadcastRoomList();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Sunucu çalışıyor, port:", PORT);
});
