import { WebSocketServer } from 'ws';

const port = 3001;
const wss = new WebSocketServer({ port });

wss.on('connection', function connection(ws) {
  console.log('Client connected to WebSocket server');
  
  ws.on('message', function message(data) {
    console.log('received: %s', data);
  });

  ws.send('something');
});

console.log(`WebSocket server is running on ws://localhost:${port}`);
