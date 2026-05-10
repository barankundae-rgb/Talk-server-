const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Secure CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:3000', 'http://localhost:5173'];

const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.send('Talk Server is running!');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is healthy' });
});

// Utility function for data validation
const isValidMessage = (message) => {
  return message && typeof message === 'string' && message.trim().length > 0;
};

const isValidRoom = (room) => {
  return room && typeof room === 'string' && room.trim().length > 0;
};

const isValidUser = (user) => {
  return user && typeof user === 'string' && user.trim().length > 0;
};

// Socket.io events
io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);

  // Listen for messages (global broadcast)
  socket.on('send_message', (data) => {
    try {
      if (!data || !isValidMessage(data.message)) {
        socket.emit('error', { message: 'Invalid message format' });
        return;
      }

      console.log('Message received:', data.message);
      
      // Broadcast message to all connected clients
      io.emit('receive_message', {
        id: socket.id,
        message: data.message.trim(),
        timestamp: new Date().toISOString(),
        user: data.user || 'Anonymous'
      });
    } catch (error) {
      console.error('Error processing message:', error);
      socket.emit('error', { message: 'Server error processing message' });
    }
  });

  // User typing indicator
  socket.on('typing', (data) => {
    try {
      if (!data || !isValidUser(data.user)) {
        return;
      }

      socket.broadcast.emit('user_typing', {
        id: socket.id,
        user: data.user
      });
    } catch (error) {
      console.error('Error processing typing event:', error);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    io.emit('user_left', {
      id: socket.id,
      message: 'A user has left the chat',
      timestamp: new Date().toISOString()
    });
  });

  // Join a room
  socket.on('join_room', (data) => {
    try {
      if (!data || !isValidRoom(data.room)) {
        socket.emit('error', { message: 'Invalid room name' });
        return;
      }

      socket.join(data.room);
      console.log(`${socket.id} joined room: ${data.room}`);
      
      io.to(data.room).emit('user_joined', {
        id: socket.id,
        room: data.room,
        message: 'A user joined the room',
        timestamp: new Date().toISOString(),
        user: data.user || 'Anonymous'
      });
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Server error joining room' });
    }
  });

  // Send message to specific room
  socket.on('room_message', (data) => {
    try {
      if (!data || !isValidRoom(data.room) || !isValidMessage(data.message)) {
        socket.emit('error', { message: 'Invalid room or message' });
        return;
      }

      io.to(data.room).emit('receive_room_message', {
        id: socket.id,
        room: data.room,
        message: data.message.trim(),
        timestamp: new Date().toISOString(),
        user: data.user || 'Anonymous'
      });
    } catch (error) {
      console.error('Error sending room message:', error);
      socket.emit('error', { message: 'Server error sending message' });
    }
  });

  // Error handling
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

// Server error handling
server.on('error', (error) => {
  console.error('Server error:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
