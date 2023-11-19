const express = require("express");
const http = require("http");
const Server = require("socket.io").Server;
const cors = require("cors");
const app = express(cors());
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

let currentChatData = {
  rooms: [],
};

io.on("connection", (socket) => {
  socket.on("initChat", () => {
    console.log("init chat");
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
    fetch("http://127.0.0.1:5000/chats", config)
      .then(resp => resp.json())
      .then(data => {
        console.log({...newRoom, ...data})
        socket.emit("chatData", {...newRoom, ...data})
      })
  });

  socket.on("sendMessage", (message, roomId, currentChat) => {
    console.log("This is the room id: ", roomId);
    currentChat.messages.push(message);
    socket.emit("chatData", currentChat);
  });

  socket.on("disconnect", () => {
    const filterRooms = currentChatData.rooms.filter(({ roomId }) => {
      return roomId !== socket.id;
    });
    currentChatData.rooms = [...filterRooms];

    console.log("disconnected");
  });
  socket.on("joinRoom", (room) => {
    socket.join(room);
  });

  // socket.on("adminLogin", () => {
  //   socket.emit("rooms", Array.from(io.sockets.adapter.rooms))
  // });

  socket.on("getChats", () => {
    socket.emit("rooms", Array.from(io.sockets.adapter.rooms));
  });
});
server.listen(PORT, () => console.log(`Listening on port ${PORT}`));
