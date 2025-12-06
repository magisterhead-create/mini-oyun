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

    // 🔹 Arka plandaki cinayet dosyası (AI prompt için kullanılacak)
    caseFile: `
KURBAN
- Ad: Ahmet Yılmaz
- Meslek: Şehirde tanınan bir iş insanı, restoranın da düzenli müşterisi.
- Ölüm: Restoranın arka bölümünde, yaklaşık 22:30 sularında bıçaklanarak öldürülmüş halde bulunuyor.
- Önceki günlerde garsonla servis ve bahşiş konusu yüzünden tartıştığı biliniyor.

OLAY YERİ
- Olay, restoranın personel koridoru ile mutfak kapısının kesiştiği dar bir alanda gerçekleşmiş.
- Güvenlik kamerası bu noktayı kör bir açıyla görüyor, tam cinayet anı net değil.
- Kan izleri, kurbanın saldırı anında çok kısa bir direnç gösterdiğini düşündürüyor.

ZAMAN ÇİZELGESİ (KISA)
- 21:50: Kurban restorana geliyor.
- 22:05: Garson ile masa seçimi ve servis konusunda kısa bir tartışma yaşanıyor.
- 22:20: Kurban telefonla biriyle konuşurken sinirli tavırlar sergiliyor.
- 22:28–22:32: Personel ifadelerine göre garson, "arka tarafa depoya bakmaya gittiğini" söylüyor.
- 22:35: Kurban, tuvalete gitmek üzere masadan ayrılıyor ve bir daha dönmüyor.
- 22:45: Kurban, arka koridorda yaralı halde bulunuyor; birkaç dakika içinde hayatını kaybediyor.

DİĞER PERSONEL İFADELERİ (ÖZET)
- Şef: O sırada mutfakta servis hazırladığını, garsonun birkaç dakika mutfaktan kaybolduğunu söylüyor.
- Ortak: İşin başında olduğunu, kurbanla aralarında ciddi bir sorun olmadığını iddia ediyor, garsonun son günlerde gergin olduğunu belirtiyor.
`,

    // 🔹 Şüpheliler (AI'nin “canlandıracağı” karakterler)
    suspects: [
      {
        id: "waiter",
        name: "Mehmet Kaya",
        roleLabel: "Garson",
        persona:
          "Gergin ama kendini kurtarmaya çalışan, alt-orta gelirli bir çalışan. İşine muhtaç, otoriteden çekiniyor.",
        facts: [
          "Kurbanla daha önce bahşiş ve yoğunlukta çalışma temposu yüzünden tartışmaya girdi.",
          "Olay saatine yakın birkaç dakikalığına ortadan kaybolduğunu kabul ediyor ama sebep olarak 'depo kontrolü' diyor.",
          "Kamera kayıtlarında mutfak kapısının yanında telaşlı bir şekilde bir şeylerle uğraşırken görülüyor."
        ],
        secrets: [
          "Son haftalarda ciddi borçları var ve gizli şekilde ek para arayışında.",
          "Kurbanla son tartışmaları, küfürleşmeye varacak kadar ağır geçti.",
          "Olay günü gerçekten kurbanla arka tarafta karşılaşıyor."
        ],
        attitude: `
Başta her şeyi inkar etmeye çalış, olayı basite indir ve "ben sadece işimi yapıyordum" tonunda konuş.
Polis olay saatine, kamera görüntülerine ve tartışmalara sıkı sıkıya vurgu yaparsa 
yavaş yavaş çelişkiye düş ve küçük detayları itiraf etmeye başla.
Kendini asla doğrudan "katil" olarak ilan etme ama baskı arttığında çok sinirlendiğini kabul edebilirsin.
        `
      },
      {
        id: "chef",
        name: "Hakan Demir",
        roleLabel: "Şef",
        persona:
          "İşkolik, detaycı, stresli ama kendine güvenen baş aşçı. Restoranın başarısını kendine mal ediyor.",
        facts: [
          "Olay anında mutfakta olduğunu söylüyor.",
          "Garsonun kısa süreliğine ortadan kaybolduğunu fark etti.",
          "Kurbanla aralarında doğrudan bir problem yok."
        ],
        secrets: [
          "Restoran ortağıyla gizli gerilimler yaşıyor; maliyetler ve menü konusunda kavgalılar.",
          "Garsonun hatalarını zaman zaman sert şekilde eleştiriyor."
        ],
        attitude: `
Çoğunlukla kendinden emin ve soğukkanlı ol.
Garsonu hafifçe suçlayıcı konuş, ama asıl derdinin "mutfağın düzeni" olduğunu vurgula.
Polis çok derine inmedikçe kendi özel problemlerini açma.
        `
      }
    ],

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
    roles: ["ajan", "güvenlik"], // ⭐ Bu case'in rollerini belirtiyoruz
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
//   sharedBoard, interrogations,
//   players: { socketId: {...} }
// }
const rooms = {};

// --------- HELPERS --------- //

// Cevap karşılaştırma ve sorgu analizi için normalize
function normalize(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
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
        : cases[room.currentCaseId]?.title || null;

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

/**
 * Şüpheliye verilecek cevabı üretir.
 * Şimdilik rule-based; ileride OpenAI entegrasyonu ile değiştirilebilir.
 *
 * @param {Object} params
 * @param {Object} params.caseData - seçili vaka objesi
 * @param {Object} params.suspect - seçilen şüpheli objesi
 * @param {string} params.question - polisin sorusu
 * @param {Array}  params.history - önceki soru-cevaplar [{from, text}, ...]
 */
function mockSuspectReply({ caseData, suspect, question, history }) {
  const qOriginal = (question || "").trim();
  const q = normalize(qOriginal);
  const h = Array.isArray(history) ? history : [];

  const caseTitle = caseData?.title || "bu olay";
  const suspectName = suspect?.name || "Ben";

  // 1) Olayla alakasız, saçma sorular → tersle
  const isAboutCase =
    q.includes("cinayet") ||
    q.includes("olay") ||
    q.includes("gece") ||
    q.includes("restoran") ||
    q.includes("banka") ||
    q.includes("soygun") ||
    q.includes("kurban") ||
    q.includes("saat") ||
    q.includes("nerede") ||
    q.includes("neredeydin") ||
    q.includes("ifade") ||
    q.includes("sorgu") ||
    q.includes("koridor") ||
    q.includes("mutfak");

  if (!isAboutCase) {
    const last3 = h.slice(-3).filter((m) => m.from === "player");
    if (last3.length >= 2) {
      return `Bak, buraya ${caseTitle} hakkında ifade vermeye geldim. Bu tarz sorulara cevap vermeyeceğim.`;
    }
    return "Olayla ilgili bir şey sorarsan yardımcı olurum. Bu soru davayla pek alakalı değil.";
  }

  // 2) Kimlik / rol
  if (
    q.includes("kimsin") ||
    q.includes("ismin") ||
    q.includes("adın") ||
    q.includes("adiniz") ||
    q.includes("gorevin") ||
    q.includes("görevin") ||
    q.includes("rolun") ||
    q.includes("rolün") ||
    q.includes("ne iş")
  ) {
    const roleLabel = suspect?.roleLabel || "olaydaki şüphelilerden biriyim";
    return `${suspectName}. ${roleLabel}. Senden önce de birkaç kere ifade verdim zaten.`;
  }

  // 3) "Olay gecesi / o saatte neredeydin" soruları
  if (
    q.includes("neredeydin") ||
    (q.includes("nerede") && q.includes("saat")) ||
    q.includes("olay gecesi") ||
    q.includes("olay sirasinda") ||
    q.includes("olay sırasında")
  ) {
    if (caseData.id === "restaurant_murder") {
      if (suspect.id === "waiter") {
        return "Olayın olduğu saatlerde salonla mutfak arasında gidip geliyordum. Rezervasyonlu masalara servis yetiştirmeye çalışıyordum.";
      } else if (suspect.id === "chef") {
        return "Ben mutfaktaydım. Siparişler üst üste geliyordu, servis saatlerinde mutfaktan pek çıkmam.";
      }
    }

    return "O saatte tam olarak yerimi hatırlamıyorum ama bütün gece buradaydım, binadan çıkmadım.";
  }

  // 4) Kurbanla ilişkisi
  if (
    q.includes("kurbanla") ||
    q.includes("magdurla") ||
    q.includes("mağdurla") ||
    q.includes("ilişkin") ||
    q.includes("aranizdaki iliski") ||
    q.includes("aranızdaki ilişki")
  ) {
    return "Onu yıllardır tanırım ama öyle çok yakın sayılmayız. Aramızda büyük bir düşmanlık da yoktu, en azından benim açımdan.";
  }

  // 5) Motivasyon / para / tehdit
  if (
    q.includes("neden") ||
    q.includes("niye") ||
    q.includes("motivasyon") ||
    q.includes("sebep") ||
    q.includes("para") ||
    q.includes("borc") ||
    q.includes("borç") ||
    q.includes("tehdit")
  ) {
    return "Bakın, benim bu işten çıkarım yok. Para için böyle bir şeye kalkışacak biri değilim. Üstüme yıkmaya çalışan biri varsa da bunu bulmanız gerekiyor.";
  }

  // 6) Sıkıştırma / yalan yakalama
  const playerPressed =
    q.includes("yalan") ||
    q.includes("dogruyu soyle") ||
    q.includes("doğruyu söyle") ||
    q.includes("itiraf") ||
    q.includes("sakladigin") ||
    q.includes("sakladığın");

  if (playerPressed) {
    const suspectRepliesCount = h.filter((m) => m.from === "suspect").length;
    if (suspectRepliesCount >= 3) {
      return "Tamam, bazı şeyleri ilk başta söylemedim. Ama bu beni katil yapmaz. Detayları anlatırım, ama önce avukatım gelsin.";
    }
    return "Sinirlerinize hâkim olun, memur bey. Sana anlattıklarım zaten resmi ifadede de var.";
  }

  // 7) Genel fallback
  return `Sorunu tam anlamadım ama ${caseTitle} gecesi olanları zaten detaylı anlattım. Ne bilmek istiyorsan daha açık sor, ben de bildiğimi söyleyeyim.`;
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
      sharedBoard: "", // ⭐ ortak tahta metni
      interrogations: {}, // key: `${playerId}:${suspectId}` -> mesaj listesi
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
        roles: c.roles,
        suspects: (c.suspects || []).map((s) => ({
          id: s.id,
          name: s.name,
          roleLabel: s.roleLabel
        }))
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

    // Şimdilik dört rolü destekliyoruz
    const allowedRoles = ["dedektif", "polis", "ajan", "güvenlik"];
    if (!allowedRoles.includes(role)) {
      return;
    }

    // Rol başka biri tarafından alınmış mı?
    const used = Object.values(room.players).some(
      (p) => p.role === role && p.id !== socket.id
    );
    if (used) {
      socket.emit(
        "roleError",
        "Bu rol zaten alınmış. Diğer rolü seçmeyi dene."
      );
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
      roles: c.roles,
      suspects: (c.suspects || []).map((s) => ({
        id: s.id,
        name: s.name,
        roleLabel: s.roleLabel
      }))
    });

    // Oyuncu listesi güncelle
    io.to(roomCode).emit("playersUpdate", {
      players: getPublicPlayers(roomCode)
    });

    sendSystemMessage(roomCode, `Vaka değiştirildi: ${c.title}`);
    broadcastRoomList();
  });

  // 🔻 POLİS SORGU EVENTİ
  socket.on("policeInterrogate", async ({ suspectId, question, history }) => {
    const roomCode = socket.data?.roomCode;
    if (!roomCode || !rooms[roomCode]) return;

    const room = rooms[roomCode];
    const player = room.players[socket.id];
    if (!player) return;

    // Sadece polis sorgu yapabilsin
    if (player.role !== "polis") {
      return;
    }

    const c = room.puzzle;
    if (!c || !c.suspects) return;

    const suspect = c.suspects.find((s) => s.id === suspectId);
    if (!suspect) return;

    const q = (question || "").trim();
    if (!q) return;

    const answerText = mockSuspectReply({
      caseData: c,
      suspect,
      question: q,
      history: history || []
    });

    // İleride istersen room.interrogations içinde de biriktirebilirsin

    socket.emit("interrogationReply", {
      suspectId,
      answer: answerText
    });
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
      socket.emit(
        "lobbyMessage",
        "Oyunu başlatmadan önce bir vaka seçmelisin."
      );
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
      const allCorrect = arr.every(
        (p) => normalize(p.answer) === correct
      );

      if (allCorrect) {
        io.to(roomCode).emit("finalResult", {
          success: true,
          correctAnswer: room.puzzle.answer
        });
        sendSystemMessage(
          roomCode,
          "Tebrikler! Tüm oyuncular doğru cevabı buldu."
        );
      } else {
        io.to(roomCode).emit("finalResult", { success: false });
        sendSystemMessage(
          roomCode,
          "Cevaplar yanlış. Tekrar deneyebilirsiniz."
        );
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
      io.to(peerId).emit("voiceNewPeer", {
        peerId: socket.id,
        polite: false
      });
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
