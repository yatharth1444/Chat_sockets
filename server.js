const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static("public"));

const users = new Map(); // socket.id -> userName
const userStatus = new Map(); // userName -> status
const messageHistory = []; // To persist messages

io.on("connection", (socket) => {
  console.log("A user is now connected");

  socket.on("join", (userName) => {
    users.set(socket.id, userName);
    userStatus.set(userName, "online");
    socket.userName = userName;

    io.emit("userJoined", userName);
    io.emit("userList", Array.from(users.values()));
    io.emit("statusUpdate", Object.fromEntries(userStatus));
    socket.emit("chatHistory", messageHistory);
  });

  socket.on("chatMessage", (data) => {
    const timestampedMsg = {
      ...data,
      timestamp: new Date().toLocaleTimeString(),
    };
    messageHistory.push(timestampedMsg);
    io.emit("chatMessage", timestampedMsg);
  });

  socket.on("typing", (userName) => {
    socket.broadcast.emit("typing", userName);
  });

  socket.on("stopTyping", (userName) => {
    socket.broadcast.emit("stopTyping", userName);
  });

  socket.on("privateMessage", ({ toUser, message }) => {
    const recipientSocket = [...users.entries()].find(
      ([, name]) => name === toUser
    )?.[0];
    if (recipientSocket) {
      const privateMsg = {
        from: socket.userName,
        to: toUser,
        message,
        timestamp: new Date().toLocaleTimeString(),
      };
      io.to(recipientSocket).emit("privateMessage", privateMsg);
      socket.emit("privateMessage", privateMsg); // Also show to sender
    }
  });

  socket.on("disconnect", () => {
    const user = users.get(socket.id);
    if (user) {
      users.delete(socket.id);
      userStatus.set(user, "offline");
      io.emit("userLeft", user);
      io.emit("userList", Array.from(users.values()));
      io.emit("statusUpdate", Object.fromEntries(userStatus));
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is now running on http://localhost:${PORT}`);
});
