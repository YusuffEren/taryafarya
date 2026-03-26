const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

const GAME_PASSWORD = '1903';

let waitingPlayer = null;
let roomCounter = 0;

io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  // Password check
  socket.on('login', (data, callback) => {
    if (data.password === GAME_PASSWORD) {
      socket.authenticated = true;
      let autoSelectObj = null;
      if (waitingPlayer && waitingPlayer.character) {
        autoSelectObj = {
          charToPick: waitingPlayer.character === 'judy' ? 'nick' : 'judy',
          nameToPick: waitingPlayer.playerName === 'Fatmanur' ? 'Yusuf Eren' : 'Fatmanur'
        };
      }
      callback({ success: true, autoSelect: autoSelectObj });
    } else {
      callback({ success: false, message: 'Wrong password!' });
    }
  });

  // Character selection & matchmaking
  socket.on('selectCharacter', (data) => {
    if (!socket.authenticated) return;

    socket.playerName = data.playerName;   // 'Fatmanur' or 'Yusuf Eren'
    socket.character = data.character;     // 'judy' or 'nick'

    if (!waitingPlayer) {
      waitingPlayer = socket;
      socket.emit('waiting', { message: 'Rakip bekleniyor...' });
      
      socket.broadcast.emit('autoSelect', {
        charToPick: data.character === 'judy' ? 'nick' : 'judy',
        nameToPick: data.playerName === 'Fatmanur' ? 'Yusuf Eren' : 'Fatmanur'
      });
    } else {
      const p1 = waitingPlayer;
      const p2 = socket;
      waitingPlayer = null;

      const roomId = `room_${++roomCounter}`;
      p1.join(roomId); p2.join(roomId);
      p1.roomId = roomId; p2.roomId = roomId;

      const initialWind = (Math.random() - 0.5) * 0.08;

      p1.emit('gameStart', {
        role: 'player1',
        wind: initialWind,
        turnIndex: 0,
        myName: p1.playerName,
        myChar: p1.character,
        oppName: p2.playerName,
        oppChar: p2.character
      });
      p2.emit('gameStart', {
        role: 'player2',
        wind: initialWind,
        turnIndex: 0,
        myName: p2.playerName,
        myChar: p2.character,
        oppName: p1.playerName,
        oppChar: p1.character
      });

      console.log(`Room ${roomId}: ${p1.playerName}(${p1.character}) vs ${p2.playerName}(${p2.character})`);
    }
  });

  socket.on('fire', (data) => {
    socket.to(socket.roomId).emit('opponentFired', data);
  });

  socket.on('usePower', (data) => {
    socket.to(socket.roomId).emit('opponentUsedPower', data);
  });

  socket.on('shotResult', (data) => {
    socket.to(socket.roomId).emit('shotResult', data);
  });

  socket.on('endTurn', (data) => {
    const newWind = (Math.random() - 0.5) * 0.08;
    io.to(socket.roomId).emit('newTurn', { turnIndex: data.nextTurn, wind: newWind });
  });

  socket.on('disconnect', () => {
    console.log('Disconnected:', socket.id);
    if (waitingPlayer === socket) waitingPlayer = null;
    if (socket.roomId) socket.to(socket.roomId).emit('opponentLeft');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Zootopia Artillery server on port ${PORT}`);
});
