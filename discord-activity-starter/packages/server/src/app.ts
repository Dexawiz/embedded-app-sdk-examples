import path from 'node:path';
import dotenv from 'dotenv';
import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import { fetchAndRetry } from './utils';

dotenv.config({ path: '../../.env' });

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const port = Number(process.env.PORT) || 3001;

app.use(express.json());

let playbackState = {
  isPlaying: false,
  time: 0,
  offsetSeconds: 0,
  song: 'miska'
};

function broadcast(data: any) {
  const message = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
}

wss.on('connection', (ws) => {
  console.log('Client connected');

  // Отправляем текущее состояние новому клиенту
  ws.send(JSON.stringify({
    type: 'STATE',
    payload: playbackState
  }));


	ws.on('message', (message) => {
		const data = JSON.parse(message.toString());
		const now = Date.now();

		if (data.type === 'PLAY') {
			// Если уже играет, игнорируем, чтобы не "прыгало" время
			if (playbackState.isPlaying) return;

			playbackState.time = now - (playbackState.offsetSeconds * 1000);
			playbackState.isPlaying = true;
			broadcast({ type: 'STATE', payload: playbackState });
		}

		if (data.type === 'PAUSE') {
			if (!playbackState.isPlaying) return;

			playbackState.offsetSeconds = (now - playbackState.time) / 1000;
			playbackState.isPlaying = false;
			broadcast({ type: 'STATE', payload: playbackState });
		}

		if (data.type === 'STOP') {
			playbackState.isPlaying = false;
			playbackState.time = 0;
			playbackState.offsetSeconds = 0;
			broadcast({ type: 'STATE', payload: playbackState });
		}

		// НОВОЕ: Обработка перемотки
		if (data.type === 'SEEK') {
			playbackState.offsetSeconds = data.time;
			// Если музыка играет, пересчитываем точку старта относительно нового времени
			if (playbackState.isPlaying) {
				playbackState.time = now - (data.time * 1000);
			}
			broadcast({ type: 'STATE', payload: playbackState });
		}
	});



});

server.listen(port, () => {
  console.log(`Server running on ${port}`);
});