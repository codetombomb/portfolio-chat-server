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

const strftime = require("strftime")
const URL_BASE = "http://127.0.0.1:5000"


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
    fetch(`${URL_BASE}/chats`, config)
      .then(resp => {
        if(resp.ok){
          return resp.json()
        }
      })
      .then(data => {
        socket.emit("chatData", {...newRoom, ...data})
      })
      .catch(err => console.log(err))

      socket.emit("chatData", {
        room_id: socket.id,
        chat_time_stamp: strftime(`%a %-I:%M%p`)
    })
  });

  socket.on("sendMessage", (message, roomId, currentChat, isAdmin, chatId) => {
    // console.log("This is the room id: ", roomId);
    // POST new message

    // content=content,
    // sender_type=sender_type,
    // chat_id=chat_id,
    // visitor_id=visitor_id,
    // admin_id=admin_id,

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
         socket.emit("chatData", currentChat)
      })
      .catch(err => console.log(err))
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

  socket.on("closeChat", (chat) => {
    console.log(chat)
    const config = {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({is_active: false})
    }
    fetch(`${URL_BASE}/chats/${chat.id}`, config)
    .then(resp => {
      if(resp.ok){
        return resp.json()
      }
    })
    .then(data => {
     console.log(data)
    })
    .catch(err => console.log(err))
  })
});
server.listen(PORT, () => console.log(`Listening on port ${PORT}`));
