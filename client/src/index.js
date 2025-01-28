const { loadConfig } = require('./utils/config');
const LogMonitor = require('./services/LogMonitor');
const { waitForCallback } = require('./utils/auth');

// Load configuration
const { logPath, botServerUrl, getDiscordTokens, setDiscordTokens, clearDiscordTokens } = loadConfig();

// Create and start monitor
const monitor = new LogMonitor(logPath);

// Handle keyboard input
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding('utf8');

process.stdin.on('data', (key) => {
    // Ctrl+C to exit
    if (key === '\u0003') {
        console.log('\nShutting down...');
        monitor.stop();
        process.exit(0);
    }
    
    // 'c' to clear tokens
    if (key === 'c') {
        clearDiscordTokens();
        console.log('\nDiscord tokens cleared. You will need to re-authenticate.');
        monitor.authPrompted = false; // Allow re-auth prompt
    }
});

// Handle auth URL opening
monitor.on('openAuth', async () => {
    try {
        // Start temporary server and wait for callback
        console.log('Starting authentication flow...');
        
        // Start the callback server
        const { port, tokensPromise } = await waitForCallback();
        
        // Open auth URL
        const authUrl = `${botServerUrl}/auth?callback_port=${port}`;
        console.log('Opening Discord authentication...');
        const open = await import('open');
        await open.default(authUrl);

        // Wait for tokens with timeout
        const tokens = await Promise.race([
            tokensPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Authentication timed out')), 5 * 60 * 1000))
        ]);

        if (!tokens) {
            throw new Error('No tokens received from auth callback');
        }

        // Save tokens and update status
        setDiscordTokens(tokens);
        console.log('Authentication successful!');
        monitor.authPrompted = false;
    } catch (error) {
        if (error.message === 'Authentication timed out') {
            console.error('Authentication timed out. Please try again.');
        } else {
            console.error('Error during authentication:', error);
        }
        // Reset auth prompted flag to allow retry
        monitor.authPrompted = false;
    }
});

// Listen for trade events (for local display)
monitor.on('trade', (tradeData) => {
    console.log('\n🔔 Trade Alert Detected:');
    console.log('Player:', tradeData.player);
    console.log('Message:', tradeData.message);
    console.log('-'.repeat(50));
});

// Start monitoring
monitor.start();

// Handle shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down...');
    monitor.stop();
    process.exit(0);
}); 