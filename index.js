require('dotenv').config()

const express = require("express");
const http = require("http");
const Server = require("socket.io").Server;
const cors = require("cors");
const app = express();
app.use(cors())
const server = http.createServer(app);
const fetch = require("node-fetch");
const cron = require('node-cron');
const { io } = require("socket.io-client");
const { v4: uuidv4 } = require('uuid');

const PORT = process.env.PORT;

const URL_BASE = process.env.URL_BASE

const serverIO = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN,
    methods: ["GET", "POST"]
  },
});


serverIO.on("connection", (socket) => {
  socket.on("initChat", (adminData, created_at) => {
    const newRoom = {
      visitor_id: "",
      admin_id: adminData.id,
      room_id: socket.id,
      created_at
    }

    const config = {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(newRoom)
    }
    fetch(`${URL_BASE}/chats`, config)
      .then(resp => {
        if (resp.ok) {
          return resp.json()
        }
      })
      .then(data => {
        socket.join(data.room_id);
        socket.emit("chatData", { ...newRoom, ...data })
        socket.broadcast.emit("addAdminChat", data)
      })
      .catch(err => console.log(err))

    socket.emit("chatData", {
        visitor_id: null,
        admin_id: null,
        room_id: socket.id,
        id: null,
        messages: [],
        is_active: true
    })
  });

  socket.on("sendMessage", (message, roomId, currentChat, isAdmin, timeSent) => {
    const newMessage = {
      content: message,
      sender_type: isAdmin ? "Admin" : "Visitor",
      chat_id: currentChat.id,
      visitor_id: currentChat.visitor_id,
      admin_id: currentChat.admin_id,
      created_at: timeSent
    }

    const config = {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(newMessage)
    }

    fetch(`${URL_BASE}/messages`, config)
      .then(resp => {
        if (resp.ok) {
          return resp.json()
        }
      })
      .then(data => {
        currentChat.messages.push(data)
        serverIO.sockets.in(roomId).emit("chatData", currentChat)
      })
      .catch(err => console.log(err))
  });

  socket.on("joinRoom", (room, chatId) => {
    socket.join(room);
    fetch(`${URL_BASE}/chats/${chatId}`)
      .then(resp => resp.json())
      .then(data => serverIO.sockets.in(room).emit("chatData", data))
  });

  socket.on("getChats", () => {
    fetch(`${URL_BASE}/chats`)
      .then(resp => resp.json())
      .then(rooms => socket.emit("rooms", rooms))
    socket.emit("chatData", {
      room_id: socket.id
    })
  });

  socket.on("closeChat", (chat, timeClosed) => {
    socket.leave(chat.room_id)
    const fetchUrl = `${URL_BASE}/chats/${chat.id}`
    const config = {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ is_active: false })
    }
    fetch(fetchUrl, config)
      .then(resp => {
        if (resp.ok) {
          return resp.json().then(data => {
            serverIO.sockets.in(chat.room_id).emit("endChat", {
              ...data, messages: [...data.messages, {
                admin_id: chat.admin_id,
                content: `Chat has ended`,
                id: uuidv4(),
                sender_type: "ChatStatus",
                visitor_id: chat.visitor_id,
                is_active: chat.is_active,
                created_at: timeClosed
              }]
            })
          })
        }
      })
      .catch(err => console.log("This is the err", err))
  })

  socket.on("setActiveAdmin", (admin) => {
    socket.broadcast.emit("activeAdmins", admin)
  })

  socket.on("removeActiveAdmin", (admin) => {
    socket.broadcast.emit("removeActiveAdmin", admin)
  })
  
  socket.on("typing", (data, roomId) => {
    serverIO.sockets.in(roomId).emit("typing", data.name)
  })

  socket.on("stopped typing",(name, roomId) => {
    serverIO.sockets.in(roomId).emit("stopped typing", name)
  })

  socket.on("currentAdmin", (admin) => {
    const allSockets = serverIO.sockets.sockets
    const socketIds = Array.from(allSockets.keys());

    const fetchUrl = `${URL_BASE}/chatroom-update`
    const config = {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({rooms: socketIds, admin_name: admin.name})
      
    }
    fetch(fetchUrl, config)
      .then(resp => resp.json())
      .then(data => {
        data.forEach(chat => {
          serverIO.sockets.in(chat.room_id).emit("chatData", chat.messages)
        })
      })
    socket.broadcast.emit("currentAdmin", admin)
  })
});

server.listen(PORT, () => console.log(`Listening on port ${PORT}`));

const task = cron.schedule('*/10 * * * *', () => {
  io("https://chat-server-7uc0.onrender.com")
  fetch(`${URL_BASE}/chats`)
    .then(resp => resp.json())
    .then(rooms => console.log("Keeping it alive!"))
});
task.start()
