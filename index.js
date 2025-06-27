const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { wordBank } = require('./words/Word');
// const { getThreeWords } = require('./words/Word');
const PORT = process.env.PORT || 3000;

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

let rooms = {};

function getThreeWords() {
 
  return wordBank.sort(() => 0.5 - Math.random()).slice(0, 3);
}

function startRound(roomId) {
  const room = rooms[roomId];
  if (!room || room.players.length < 2) return;
  //console.log(getThreeWords());
  
  room.words = getThreeWords();
  room.selectedWord = '';
  const drawer = room.players[room.currentTurn];
  const guesser = room.players[1 - room.currentTurn];

  io.to(drawer).emit('your_turn', { words: room.words });
  io.to(guesser).emit('wait_turn', { words: room.words });
}

io.on('connection', (socket) => {
  console.log('🔌 Connected:', socket.id);

  socket.on('join_room', ({ roomId }) => {
    socket.join(roomId);
    if (!rooms[roomId]) {
      rooms[roomId] = { players: [], currentTurn: 0, selectedWord: '', words: [] };
    }

    const room = rooms[roomId];

    if (!room.players.includes(socket.id) && room.players.length < 2) {
      room.players.push(socket.id);
    }

    if (room.players.length === 2) {
      io.to(roomId).emit('both_joined');
      startRound(roomId);
    }
  });

  socket.on('word_selected', ({ word, roomId }) => {
    if (rooms[roomId]) {
      rooms[roomId].selectedWord = word;
    }
  });

  socket.on('drawing_data', ({ roomId, data }) => {
    socket.to(roomId).emit('receive_drawing', data);
  });

  socket.on('make_guess', ({ roomId, guess }) => {
    const room = rooms[roomId];
    if (!room) return;

    const correct = guess === room.selectedWord;
    io.to(roomId).emit('guess_result', { correct, answer: room.selectedWord });

    // Start new round after 2 seconds
    setTimeout(() => {
      room.currentTurn = 1 - room.currentTurn;
      startRound(roomId);
    }, 2000);
  });

  socket.on('disconnect', () => {
    console.log('❌ Disconnected:', socket.id);
    for (const roomId in rooms) {
      const room = rooms[roomId];
      room.players = room.players.filter(id => id !== socket.id);
      if (room.players.length < 2) {
        delete rooms[roomId];
        console.log(`🧹 Deleted room ${roomId}`);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log('🚀 Server listening on port 5000');
});
