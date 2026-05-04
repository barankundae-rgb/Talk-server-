const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.send('Talk Server is running!');
});

// Socket.io events
io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);

  // Listen for messages
  socket.on('send_message', (data) => {
    console.log('Message received:', data);
    // Broadcast message to all connected clients
    io.emit('receive_message', {
      id: socket.id,
      message: data.message,
      timestamp: new Date()
    });
  });

  // User typing
  socket.on('typing', (data) => {
    socket.broadcast.emit('user_typing', {
      id: socket.id,
      user: data.user
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    io.emit('user_left', {
      id: socket.id,
      message: 'A user has left the chat'
    });
  });

  // Join a room
  socket.on('join_room', (data) => {
    socket.join(data.room);
    console.log(`${socket.id} joined room: ${data.room}`);
    io.to(data.room).emit('user_joined', {
      id: socket.id,
      message: `A user joined the room`
    });
  });

  // Send message to specific room
  socket.on('room_message', (data) => {
    io.to(data.room).emit('receive_room_message', {
      id: socket.id,
      room: data.room,
      message: data.message,
      timestamp: new Date()
    });
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
