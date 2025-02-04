const { loadConfig } = require('./utils/config.js');
const DiscordBot = require('./services/DiscordBot.js');
const AuthServer = require('./services/AuthServer.js');

// Singleton instances for Cloud Functions
let discordBot;
let authServer;
let isInitialized = false;

// Initialize services if not already initialized
async function initialize() {
    if (!isInitialized) {
        loadConfig();
        discordBot = new DiscordBot();
        authServer = new AuthServer(discordBot);
        await discordBot.start();
        isInitialized = true;
    }
    return { discordBot, authServer };
}

// Cloud Functions entry point
exports.tradealert = async (req, res) => {
    const { authServer } = await initialize();
    return authServer.app(req, res);
};

// Traditional server entry point
if (require.main === module) {
    // Track connections for graceful shutdown
    const connections = new Set();

    async function main() {
        const { authServer } = await initialize();
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
} 