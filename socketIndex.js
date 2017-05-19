/**
 * Created by volodya on 5/19/2017.
 */
const net = require('net');
const server = net.createServer((c) => {
    // 'connection' listener
    console.log('client connected');
    c.on('end', () => {
        console.log('client disconnected');
    });
    c.write('vodioolo socket server reached\r\n');
    c.pipe(c);
});
server.on('error', (err) => {
    throw err;
});
server.listen(3101, () => {
    console.log('socket server @ http://localhost:3101');
});