const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 3101 });
console.log('SocketServer listening to localhost:3101');

wss.on('connection', function connection(ws) {
    ws.on('message', function incoming(message) {
        const messageObj = JSON.parse(message);
        console.log('received: %s', message);
    });

    ws.send('vidooloo');
});


