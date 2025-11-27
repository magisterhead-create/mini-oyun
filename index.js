const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head><meta charset="UTF-8"><title>Mini Oyun</title></head>
      <body style="font-family:sans-serif;padding:20px;">
        <h1>5üzeri3</h1>

        <input id="name" placeholder="İsim" />
        <br/><br/>

        <div 
          id="chat" 
          style="border:1px solid #ccc;width:300px;height:200px;overflow-y:auto;padding:10px;margin-bottom:10px;"
        ></div>

        <input id="msg" placeholder="Mesaj" />
        <button onclick="send()">Gönder</button>

        <script src="/socket.io/socket.io.js"></script>
        <script>
          const socket = io();

          function send() {
            const name = document.getElementById("name").value || "Anon";
            const msg = document.getElementById("msg").value;
            socket.emit("chat", { name, msg });
            document.getElementById("msg").value = "";
          }

          socket.on("chat", data => {
            const chat = document.getElementById("chat");
            const div = document.createElement("div");
            div.textContent = data.name + ": " + data.msg;
            chat.appendChild(div);
            chat.scrollTop = chat.scrollHeight;
          });
        </script>
      </body>
    </html>
  `);
});

io.on("connection", (socket) => {
  console.log("Bir kullanıcı bağlandı:", socket.id);

  socket.on("chat", (data) => {
    io.emit("chat", data);
  });

  socket.on("disconnect", () => {
    console.log("Bir kullanıcı ayrıldı:", socket.id);
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log("Sunucu çalışıyor → http://localhost:" + port);
});
