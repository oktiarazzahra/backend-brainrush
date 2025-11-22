require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./src/app');
const connectDB = require('./src/config/db');

const PORT = process.env.PORT || 5000;

// Connect to database
connectDB();

// Create HTTP server
const server = http.createServer(app);

// Setup Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Store active games and their rooms
const activeGames = new Map();

io.on('connection', (socket) => {
  console.log('🔌 New client connected:', socket.id);

  // Join game room
  socket.on('join-game', ({ gameId, playerName, role }) => {
    socket.join(gameId);
    console.log(`👤 ${playerName} (${role}) joined game ${gameId}`);
    
    // Initialize game room if not exists
    if (!activeGames.has(gameId)) {
      activeGames.set(gameId, { players: [], host: null });
    }
    
    const game = activeGames.get(gameId);
    
    if (role === 'host') {
      game.host = socket.id;
    } else {
      game.players.push({ socketId: socket.id, playerName });
    }
    
    // Notify all players in the room
    io.to(gameId).emit('player-joined', {
      playerName,
      totalPlayers: game.players.length
    });
  });

  // Start game
  socket.on('start-game', ({ gameId }) => {
    console.log(`🎮 Game ${gameId} started`);
    io.to(gameId).emit('game-started');
  });

  // Next question
  socket.on('next-question', ({ gameId, questionIndex }) => {
    console.log(`➡️ Game ${gameId} moving to question ${questionIndex}`);
    io.to(gameId).emit('question-changed', { questionIndex });
  });

  // Player submitted answer
  socket.on('submit-answer', ({ gameId, playerName, questionId, isCorrect, score }) => {
    console.log(`✅ ${playerName} submitted answer for question ${questionId}`);
    io.to(gameId).emit('answer-submitted', {
      playerName,
      questionId,
      isCorrect,
      score
    });
  });

  // End game
  socket.on('end-game', ({ gameId, results }) => {
    console.log(`🏁 Game ${gameId} ended`);
    io.to(gameId).emit('game-ended', { results });
  });

  // Update leaderboard
  socket.on('update-leaderboard', ({ gameId, leaderboard }) => {
    io.to(gameId).emit('leaderboard-updated', { leaderboard });
  });

  // Player left
  socket.on('leave-game', ({ gameId, playerName }) => {
    socket.leave(gameId);
    console.log(`👋 ${playerName} left game ${gameId}`);
    
    const game = activeGames.get(gameId);
    if (game) {
      game.players = game.players.filter(p => p.socketId !== socket.id);
      io.to(gameId).emit('player-left', {
        playerName,
        totalPlayers: game.players.length
      });
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
    
    // Clean up from active games
    activeGames.forEach((game, gameId) => {
      const playerIndex = game.players.findIndex(p => p.socketId === socket.id);
      if (playerIndex !== -1) {
        const player = game.players[playerIndex];
        game.players.splice(playerIndex, 1);
        io.to(gameId).emit('player-left', {
          playerName: player.playerName,
          totalPlayers: game.players.length
        });
      }
      
      if (game.host === socket.id) {
        io.to(gameId).emit('host-disconnected');
        activeGames.delete(gameId);
      }
    });
  });
});

// Make io accessible to routes
app.set('io', io);

// Start server
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 API URL: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket ready`);
});
