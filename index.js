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
const serverIO = new Server(server, {
  cors: {
    origin: "*",
  },
});

const strftime = require("strftime")
const URL_BASE = "https://portfolio-api-ws.onrender.com"
// const URL_BASE = "http://127.0.0.1:5000"

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
        if(resp.ok){
          return resp.json()
        }
      })
      .then(data => {
        console.log(data)
        socket.emit("chatData", {...newRoom, ...data})
      })
      .catch(err => console.log(err))

      socket.emit("chatData", {
        room_id: socket.id,
        chat_time_stamp: strftime(`%a %-I:%M%p`)
    })
  });

  socket.on("sendMessage", (message, roomId, currentChat, isAdmin) => {
    console.log("Sending message to: ",roomId)
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
        if(resp.ok){
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

    socket.emit("chatData", {
      room_id: socket.id,
      chat_time_stamp: strftime(`%a %-I:%M%p`)
  })
  });

  socket.on("closeChat", (chat) => { 
    const fetchUrl = `${URL_BASE}/chats/${chat.id}`
    const config = {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({is_active: false})
    }
    fetch(fetchUrl, config)
    .then(resp => {
      if(resp.ok){
        return resp.json()
      }
    })
    .then(data => {
     console.log("This is the data", data)
    })
    .catch(err => console.log("This is the err", err))
  })
});

server.listen(PORT, () => console.log(`Listening on port ${PORT}`));

const task = cron.schedule('*/10 * * * *', () =>  {
  io("https://portfolio-chat-server-rjvo.onrender.com")
  fetch(`${URL_BASE}/chats`)
  .then(resp => resp.json())
  .then(rooms => console.log("rooms", rooms))
});
task.start()
