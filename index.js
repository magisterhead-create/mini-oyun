// index.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// public klasörünü statik olarak sun
app.use(express.static("public"));

// --------- VAKALAR (CASES) --------- //

const cases = {
  restaurant_murder: {
    id: "restaurant_murder",
    title: "Restoran Cinayeti",
    answer: "garson",
    roles: ["dedektif", "polis"],
    phases: [
      "1. İpucu: Kurbanın telefonunda, olaydan kısa süre önce bir restoran garsonuyla yapılan mesajlaşmalar bulunuyor.",
      "2. İpucu: Olay anında, diğer personel ifade verirken garsonun kısa bir süre ortadan kaybolduğunu söylüyor.",
      "3. İpucu: Güvenlik kamerası kayıtlarında, garsonun olay saatine yakın bir zamanda mutfak kapısının yanında telaşla bir şeyi saklamaya çalıştığı görülüyor."
    ],
    finalQuestion: "Katil kim? (cevabı tek kelime olarak yaz)"
  },
  bank_heist: {
    id: "bank_heist",
    title: "Banka Soygunu",
    answer: "kasiyer",
    roles: ["ajan", "güvenlik"],   // ⭐ Bu case'in rollerini belirtiyoruz
    phases: [
      "1. İpucu: Banka kameralarında şüpheli bir kişi görülüyor.",
      "2. İpucu: Soygun sırasında güvenlik sistemine müdahale edilmiş.",
      "3. İpucu: Kasadaki para izi ajanlara göre içeriden biri."
    ],
    finalQuestion: "Soyguncu kim?"
  }
};

// --------- ODA YAPISI --------- //

const MAX_PLAYERS = 4;

// rooms: roomCode -> {
//   hostId, roomName, password, currentPhase, currentCaseId, puzzle,
//   players: { socketId: {...} }
// }
const rooms = {};

// --------- HELPERS --------- //

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

function getRoomStatus(room) {
  if (!room) return "LOBBY";
  return room.currentPhase === 0 ? "LOBBY" : "INGAME";
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
    isHost: p.id === room.hostId,
    inVoice: !!p.inVoice,
    listenOnly: !!p.listenOnly
  }));
}

function allPlayersReadyForPhase(roomCode, phase) {
  const room = rooms[roomCode];
  if (!room) return false;
  const arr = Object.values(room.players);
  if (arr.length < 1) return false;
  return arr.every((p) => p.readyPhase === phase);
}

function allLobbyReady(roomCode) {
  const room = rooms[roomCode];
  if (!room) return false;
  const arr = Object.values(room.players);
  if (arr.length < 1) return false;
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

function sendRoomList(targetSocket = null) {
  const list = Object.entries(rooms).map(([code, room]) => {
    const currentPlayers = Object.keys(room.players).length;
    const caseTitle =
      room.puzzle && room.puzzle.title
        ? room.puzzle.title
        : (cases[room.currentCaseId]?.title || null);

    return {
      roomCode: code,
      name: room.roomName || `Oda ${code}`,
      isPrivate: !!room.password,
      currentPlayers,
      maxPlayers: MAX_PLAYERS,
      status: getRoomStatus(room),
      caseTitle
    };
  });

  const payload = { rooms: list };
  if (targetSocket) {
    targetSocket.emit("roomList", payload);
  } else {
    io.emit("roomList", payload);
  }
}

function broadcastRoomList() {
  sendRoomList(null);
}

function sendSystemMessage(roomCode, text) {
  io.to(roomCode).emit("chatMessage", {
    from: "Sistem",
    text,
    time: Date.now(),
    isSystem: true
  });
}

// --------- SOCKET.IO --------- //

io.on("connection", (socket) => {
  console.log("Bir kullanıcı bağlandı:", socket.id);
  socket.emit("welcome", { id: socket.id });

  // Oda kurma
  socket.on("createRoom", ({ name, roomName, password, deviceId }) => {
    const roomCode = generateRoomCode();

    rooms[roomCode] = {
  hostId: socket.id,
  roomName: roomName || `Oda ${roomCode}`,
  password: password ? password : null,
  currentPhase: 0,
  currentCaseId: null,
  puzzle: null,
  sharedBoard: "",    // ⭐ ortak tahta metni
  players: {}
};


    rooms[roomCode].players[socket.id] = {
  deviceId: deviceId || null,
  id: socket.id,
  name: name || "Anonim",
  role: null,
  readyPhase: 0,
  lobbyReady: false,
  answer: null,
  inVoice: false,
  listenOnly: false
};


    socket.join(roomCode);
    socket.data.roomCode = roomCode;

    socket.emit("roomCreated", { roomCode });
    socket.emit("joinSuccess", { role: null, roomCode, isHost: true });
    io.to(roomCode).emit("playersUpdate", {
      players: getPublicPlayers(roomCode)
    });

    sendSystemMessage(roomCode, `${name || "Bir oyuncu"} odayı oluşturdu.`);
    broadcastRoomList();
  });
  // Ortak tahta güncelleme
socket.on("updateSharedBoard", ({ content }) => {
  const roomCode = socket.data?.roomCode;
  if (!roomCode || !rooms[roomCode]) return;

  const room = rooms[roomCode];
  if (!room.players[socket.id]) return;

  room.sharedBoard = (content || "").slice(0, 5000); // güvenlik için limit

  io.to(roomCode).emit("sharedBoardUpdated", {
    content: room.sharedBoard
  });
});


  // Oda listesi isteği
  socket.on("getRoomList", () => {
    sendRoomList(socket);
  });

  // Odaya katılma
  socket.on("joinRoom", ({ name, roomCode, password, deviceId }) => {
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

    // Aynı odada aynı cihazdan ikinci sekmeyi engelle
    if (deviceId) {
      const alreadyInRoom = Object.values(room.players).some(
        (p) => p.deviceId && p.deviceId === deviceId
      );
      if (alreadyInRoom) {
        socket.emit(
          "joinError",
          "Bu tarayıcı zaten bu odaya bağlı. Aynı odada birden fazla sekme kullanamazsın."
        );
        return;
      }
    }

    // Şifre kontrolü
    if (room.password) {
      if (!password) {
        socket.emit("joinError", "Bu odaya katılmak için şifre girmelisin.");
        return;
      }
      if (password !== room.password) {
        socket.emit("joinError", "Şifre hatalı.");
        return;
      }
    }

    room.players[socket.id] = {
  id: socket.id,
  deviceId: deviceId || null,
  name: name || "Anonim",
  role: null,
  readyPhase: 0,
  lobbyReady: false,
  answer: null,
  inVoice: false,
  listenOnly: false
};


    socket.join(roomCode);
    socket.data.roomCode = roomCode;

    socket.emit("joinSuccess", {
      role: null,
      roomCode,
      isHost: socket.id === room.hostId
    });

    io.to(roomCode).emit("playersUpdate", {
      players: getPublicPlayers(roomCode)
    });
    // Eğer odada daha önce vaka seçilmişse, yeni gelen oyuncuya bildir
if (room.currentCaseId && room.puzzle) {
  const c = room.puzzle;
  socket.emit("caseSelected", {
    caseId: room.currentCaseId,
    title: c.title,
    roles: c.roles
  });
}
    // Eğer ortak tahta doluysa yeni gelene gönder
if (room.sharedBoard) {
  socket.emit("sharedBoardUpdated", {
    content: room.sharedBoard
  });
}


    sendSystemMessage(roomCode, `${name || "Bir oyuncu"} odaya katıldı.`);
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
      players: getPublicPlayers(roomCode)
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
      players: getPublicPlayers(roomCode)
    });
  });

  // Vaka seçimi (sadece host)
  socket.on("selectCase", ({ caseId }) => {
  const roomCode = socket.data?.roomCode;
  if (!roomCode || !rooms[roomCode]) return;

  const room = rooms[roomCode];
  if (socket.id !== room.hostId) return;

  const c = cases[caseId];
  if (!c) return;

  // Case'i değiştir
  room.currentCaseId = caseId;
  room.puzzle = c;

  // Tüm oyuncuların rolünü sıfırla
  Object.values(room.players).forEach((p) => {
    p.role = null;
  });

  // Odaya duyur
  io.to(roomCode).emit("caseSelected", {
    caseId,
    title: c.title,
    roles: c.roles
  });

  // Oyuncu listesi güncelle
  io.to(roomCode).emit("playersUpdate", {
    players: getPublicPlayers(roomCode)
  });

  sendSystemMessage(roomCode, `Vaka değiştirildi: ${c.title}`);
  broadcastRoomList();
});


  // Host oyunu başlat
  socket.on("startGame", () => {
  const roomCode = socket.data?.roomCode;
  if (!roomCode || !rooms[roomCode]) return;

  const room = rooms[roomCode];

  // Host değilse izin yok
  if (socket.id !== room.hostId) return;

  // 1) CASE SEÇİLMİŞ Mİ?
  if (!room.currentCaseId || !room.puzzle) {
    socket.emit("lobbyMessage", "Oyunu başlatmadan önce bir vaka seçmelisin.");
    return;
  }

  // 2) TÜM OYUNCULAR ROL SEÇİP HAZIR OLMUŞ MU?
  if (!allLobbyReady(roomCode)) {
    socket.emit(
      "lobbyMessage",
      "Tüm oyuncular hem rol seçmiş hem de hazır olmuş olmalı."
    );
    return;
  }

  // 3) OYUNU BAŞLAT
  room.currentPhase = 1;
  room.sharedBoard = "";
io.to(roomCode).emit("sharedBoardUpdated", { content: room.sharedBoard });
  io.to(roomCode).emit("gameStarting");
  sendSystemMessage(roomCode, "Oyun başlatılıyor...");

  setTimeout(() => {
    broadcastPhase(roomCode);
    broadcastRoomList();
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
      players: getPublicPlayers(roomCode)
    });

    if (phase === room.currentPhase && allPlayersReadyForPhase(roomCode, phase)) {
      if (room.currentPhase < 3) {
        room.currentPhase += 1;
        broadcastPhase(roomCode);
      } else if (room.currentPhase === 3) {
        room.currentPhase = 4;
        broadcastPhase(roomCode);
      }
      broadcastRoomList();
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
    if (!arr.length) return;

    if (arr.every((p) => p.answer !== null)) {
      const correct = normalize(room.puzzle.answer);
      const allCorrect = arr.every((p) => normalize(p.answer) === correct);

      if (allCorrect) {
        io.to(roomCode).emit("finalResult", {
          success: true,
          correctAnswer: room.puzzle.answer
        });
        sendSystemMessage(roomCode, "Tebrikler! Tüm oyuncular doğru cevabı buldu.");
      } else {
        io.to(roomCode).emit("finalResult", { success: false });
        sendSystemMessage(roomCode, "Cevaplar yanlış. Tekrar deneyebilirsiniz.");
        arr.forEach((p) => (p.answer = null));
      }
    }
  });

  // Lobby chat
  socket.on("sendChat", ({ message }) => {
    const roomCode = socket.data?.roomCode;
    if (!roomCode || !rooms[roomCode]) return;
    const room = rooms[roomCode];
    const player = room.players[socket.id];
    if (!player) return;

    const text = (message || "").trim();
    if (!text) return;

    io.to(roomCode).emit("chatMessage", {
      from: player.name,
      text,
      time: Date.now(),
      isSystem: false
    });
  });

  // Ping test
  socket.on("pingCheck", ({ sentAt }) => {
    socket.emit("pongCheck", { sentAt });
  });

  // Host oyuncu atma (kick)
  socket.on("kickPlayer", ({ targetId }) => {
    const roomCode = socket.data?.roomCode;
    if (!roomCode || !rooms[roomCode]) return;

    const room = rooms[roomCode];

    // Sadece host kullanabilsin
    if (socket.id !== room.hostId) return;

    const target = room.players[targetId];
    if (!target) return;

    // Host kendini atamasın
    if (targetId === room.hostId) return;

    const targetName = target.name || "Bir oyuncu";

    delete room.players[targetId];

    const targetSocket = io.sockets.sockets.get(targetId);
    if (targetSocket) {
      targetSocket.leave(roomCode);
      targetSocket.data.roomCode = null;
      targetSocket.emit("kicked", {
        reason: "Host seni odadan attı."
      });
    }

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
        players: getPublicPlayers(roomCode)
      });
      io.to(roomCode).emit(
        "lobbyMessage",
        `${targetName} odadan atıldı. Oyun resetlendi.`
      );
      sendSystemMessage(
        roomCode,
        `${targetName} host tarafından odadan atıldı.`
      );
    }

    broadcastRoomList();
  });

  // ---------- VOICE / WEBRTC SIGNALING ---------- //

  // Ses kanalına katıl
  socket.on("joinVoice", ({ listenOnly } = {}) => {
  const roomCode = socket.data?.roomCode;
  if (!roomCode || !rooms[roomCode]) return;

  const room = rooms[roomCode];
  const player = room.players[socket.id];
  if (!player) return;

  const voiceRoom = roomCode + "_voice";
  socket.join(voiceRoom);

  // voice durumunu güncelle
  player.inVoice = true;
  player.listenOnly = !!listenOnly;

  const roomSet = io.sockets.adapter.rooms.get(voiceRoom) || new Set();

  roomSet.forEach((peerId) => {
    if (peerId === socket.id) return;
    socket.emit("voiceNewPeer", { peerId, polite: true });
    io.to(peerId).emit("voiceNewPeer", { peerId: socket.id, polite: false });
  });

  // Oyuncu listesini güncelle (🎧 ikonları için)
  io.to(roomCode).emit("playersUpdate", {
    players: getPublicPlayers(roomCode)
  });

  // Chat'e sistem mesajı
  const nick = player.name || "Bir oyuncu";
  const modeText = listenOnly ? " (sadece dinleyici olarak)" : "";
  sendSystemMessage(roomCode, `${nick} sesli sohbete katıldı${modeText}.`);
});

  // Ses kanalından ayrıl
  socket.on("leaveVoice", () => {
  const roomCode = socket.data?.roomCode;
  if (!roomCode || !rooms[roomCode]) return;

  const room = rooms[roomCode];
  const player = room.players[socket.id];
  const voiceRoom = roomCode + "_voice";

  socket.leave(voiceRoom);
  io.to(voiceRoom).emit("voicePeerLeft", { peerId: socket.id });

  if (player) {
    player.inVoice = false;
    player.listenOnly = false;

    io.to(roomCode).emit("playersUpdate", {
      players: getPublicPlayers(roomCode)
    });

    const nick = player.name || "Bir oyuncu";
    sendSystemMessage(roomCode, `${nick} sesli sohbetten ayrıldı.`);
  }
});

  // WebRTC offer/answer/candidate relay
  socket.on("voiceOffer", ({ to, description }) => {
    io.to(to).emit("voiceOffer", { from: socket.id, description });
  });

  socket.on("voiceAnswer", ({ to, description }) => {
    io.to(to).emit("voiceAnswer", { from: socket.id, description });
  });

  socket.on("voiceIceCandidate", ({ to, candidate }) => {
    io.to(to).emit("voiceIceCandidate", { from: socket.id, candidate });
  });

  // Odayı isteyerek terk etme (ana menüye dön)
  socket.on("leaveRoom", () => {
    const roomCode = socket.data?.roomCode;
    if (!roomCode || !rooms[roomCode]) return;

    const room = rooms[roomCode];
    const player = room.players[socket.id];
    const playerName = player?.name || "Bir oyuncu";
    const wasHost = socket.id === room.hostId;

    delete room.players[socket.id];
    socket.leave(roomCode);
    socket.data.roomCode = null;

    // Voice odasından da çıkar
    const voiceRoom = roomCode + "_voice";
    socket.leave(voiceRoom);
    io.to(voiceRoom).emit("voicePeerLeft", { peerId: socket.id });

    if (Object.keys(room.players).length === 0) {
      delete rooms[roomCode];
    } else {
      // host çıktıysa yeni host ata
      if (wasHost) {
        const remainingIds = Object.keys(room.players);
        if (remainingIds.length > 0) {
          room.hostId = remainingIds[0];
          const newHost = room.players[room.hostId];
          sendSystemMessage(
            roomCode,
            `${newHost.name} yeni host oldu.`
          );
        }
      }

      room.currentPhase = 0;
      Object.values(room.players).forEach((p) => {
        p.readyPhase = 0;
        p.lobbyReady = false;
        p.answer = null;
      });
      io.to(roomCode).emit("playersUpdate", {
        players: getPublicPlayers(roomCode)
      });
      io.to(roomCode).emit(
        "lobbyMessage",
        "Bir oyuncu lobiden ayrıldı. Oyun resetlendi."
      );
      sendSystemMessage(
        roomCode,
        `${playerName} odadan ayrıldı. Oyun resetlendi.`
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
    const player = room.players[socket.id];
    const playerName = player?.name || "Bir oyuncu";
    const wasHost = socket.id === room.hostId;

    delete room.players[socket.id];

    // Voice odasından da düşmüş kabul
    const voiceRoom = roomCode + "_voice";
    io.to(voiceRoom).emit("voicePeerLeft", { peerId: socket.id });

    if (Object.keys(room.players).length === 0) {
      delete rooms[roomCode];
    } else {
      if (wasHost) {
        const remainingIds = Object.keys(room.players);
        if (remainingIds.length > 0) {
          room.hostId = remainingIds[0];
          const newHost = room.players[room.hostId];
          sendSystemMessage(
            roomCode,
            `${newHost.name} yeni host oldu.`
          );
        }
      }

      room.currentPhase = 0;
      Object.values(room.players).forEach((p) => {
        p.readyPhase = 0;
        p.lobbyReady = false;
        p.answer = null;
      });
      io.to(roomCode).emit("playersUpdate", {
        players: getPublicPlayers(roomCode)
      });
      io.to(roomCode).emit(
        "lobbyMessage",
        "Bir oyuncu ayrıldı. Oyun resetlendi."
      );
      sendSystemMessage(
        roomCode,
        `${playerName} bağlantıyı kaybetti. Oyun resetlendi.`
      );
    }
    broadcastRoomList();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Sunucu çalışıyor, port:", PORT);
});
