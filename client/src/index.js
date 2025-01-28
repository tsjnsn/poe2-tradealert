const { WebServer } = require('./web/server');

const server = new WebServer();
server.start();

// Handle shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down...');
    server.stop();
    process.exit(0);
}); 