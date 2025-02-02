import { loadConfig } from './utils/config.js';
import DiscordBot from './services/DiscordBot.js';
import AuthServer from './services/AuthServer.js';

// Track connections for graceful shutdown
const connections = new Set();

async function main() {
    // Load and validate configuration
    loadConfig();

    // Initialize services
    const discordBot = new DiscordBot();
    const authServer = new AuthServer(discordBot);

    // Start Discord bot
    await discordBot.start();

    // Start auth server and get the HTTP server instance
    const server = authServer.start();

    // Track connections for graceful shutdown
    server.on('connection', (connection) => {
        connections.add(connection);
        connection.on('close', () => connections.delete(connection));
    });

    // Graceful shutdown handler
    async function shutdown(signal) {
        console.log(`\n${signal} received. Starting graceful shutdown...`);

        // Stop accepting new connections
        server.close(() => console.log('HTTP server closed'));

        // Close existing connections
        for (const connection of connections) {
            connection.end();
        }

        // Disconnect Discord bot
        await discordBot.stop();

        console.log('Graceful shutdown completed');
        process.exit(0);
    }

    // Handle shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM')); // Cloud Run sends SIGTERM
    process.on('SIGINT', () => shutdown('SIGINT'));   // Ctrl+C locally
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
}); 