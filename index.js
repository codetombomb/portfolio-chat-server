const express = require("express");
const http = require("http");
const Server = require("socket.io").Server;
const cors = require('cors');
const app = express(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

let currentChatData = {
  rooms: []
};

io.on("connection", (socket) => {
  socket.on("initChat", () => {
    const renderMinutes = () => {
      let currentMins = today.getMinutes().toString();
      return currentMins.toString().length < 2
        ? ("0" + currentMins).slice(-2)
        : currentMins;
    };
    const days = ["Sun", "Mon", "Tues", "Wed", "Thurs", "Fri", "Sat"];
    const today = new Date();
    const newRoom = {
      roomId: socket.id,
      initialTime: `${days[today.getDay()]} ${Math.abs(today.getHours() > 12 ? today.getHours() - 12 : today.getHours())}:${renderMinutes()} ${today.getHours() >= 12 ? "PM" : "AM"}`,
      messages: []
    };
    currentChatData.rooms.push(newRoom);
    socket.emit("chatData", newRoom);
  });
  socket.on("sendMessage", (message, roomId) => {
    const chat = currentChatData.rooms.find(room => room.roomId === roomId)
    chat.messages.push(message)
    socket.to(roomId).emit("chatData", chat)
  })
  socket.on("disconnect", () => {
    const filterRooms = currentChatData.rooms.filter(({ roomId }) => {
      return roomId !== socket.id;
    });
    currentChatData.rooms = [...filterRooms];
    socket.emit("adminChats", currentChatData);
    console.log("disconnected");
  });
  socket.on("joinRoom", (room) => {
    socket.join(room);
  });
  socket.on("adminLogin", () => {
    socket.emit("adminChats", currentChatData.rooms)
  })
});
server.listen(process.env.PORT || 3001, () => console.log("Listening on port 3001"));