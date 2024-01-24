const express = require("express");
const http = require("http");
const Server = require("socket.io").Server;
const cors = require("cors");
const app = express(cors());
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;
const fetch = require("node-fetch");
const cron = require('node-cron');
const { io } = require("socket.io-client");
const { v4: uuidv4 } = require('uuid');
const serverIO = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  },
});

// const URL_BASE = "https://portfolio-api-ws.onrender.com"
const URL_BASE = "http://127.0.0.1:5000"

serverIO.on("connection", (socket) => {
  console.log("Connected!", Date.now())
  socket.on("initChat", () => {
    const newRoom = {
      visitor_id: "",
      admin_id: "",
      room_id: socket.id
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
        console.log(data)
        socket.join(data.room_id);
        socket.emit("chatData", { ...newRoom, ...data })
        socket.broadcast.emit("addAdminChat", data)
      })
      .catch(err => console.log(err))

    socket.emit("chatData", {
      room_id: socket.id
    })
  });

  socket.on("sendMessage", (message, roomId, currentChat, isAdmin) => {
    console.log("Sending message to: ", roomId)
    const newMessage = {
      content: message,
      sender_type: isAdmin ? "Admin" : "Visitor",
      chat_id: currentChat.id,
      visitor_id: currentChat.visitor_id,
      admin_id: currentChat.admin_id
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
    console.log("Joining room: ", room)
    socket.join(room);
    fetch(`${URL_BASE}/chats/${chatId}`)
      .then(resp => resp.json())
      .then(data => serverIO.sockets.in(room).emit("chatData", data))
  });

  socket.on("getChats", () => {
    console.log("Getting admin chats")
    fetch(`${URL_BASE}/chats`)
      .then(resp => resp.json())
      .then(rooms => socket.emit("rooms", rooms))
    console.log(Intl.DateTimeFormat().resolvedOptions().timeZone)
    socket.emit("chatData", {
      room_id: socket.id,
      chat_time_stamp: Intl.DateTimeFormat('en', { hour: "numeric", minute: "numeric", hour12: true }).format(new Date())
    })
  });

  socket.on("closeChat", (chat) => {
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
                is_active: chat.is_active
              }]
            })
          })
        }
      })
      .catch(err => console.log("This is the err", err))
  })

  socket.on("setActiveAdmin", (admin) => {
    console.log('Active Admin', admin)
    socket.broadcast.emit("activeAdmins", admin)
  })

  socket.on("removeActiveAdmin", (admin) => {
    socket.broadcast.emit("removeActiveAdmin", admin)
  })
  
  socket.on("typing", (data, roomId) => {
    console.log("typing", data.name, roomId)
    serverIO.sockets.in(roomId).emit("typing", data.name)
  })

  socket.on("stopped typing",(name) => {
    socket.broadcast.emit("stopped typing", name)
  })
});

server.listen(PORT, () => console.log(`Listening on port ${PORT}`));

const task = cron.schedule('*/10 * * * *', () => {
  io("https://portfolio-chat-server-rjvo.onrender.com")
  fetch(`${URL_BASE}/chats`)
    .then(resp => resp.json())
    .then(rooms => console.log("rooms", rooms))
});
task.start()
