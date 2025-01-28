const { loadConfig } = require('./utils/config');

// Load configuration (ignoring Discord-related validation)
try {
    loadConfig();
} catch (error) {
    // Ignore missing Discord credentials in test mode
    if (!error.message.includes('Missing required environment variables')) {
        throw error;
    }
}

const LogMonitor = require('./services/LogMonitor');

// Create and start log monitor
const logMonitor = new LogMonitor(process.env.POE2_LOG_PATH);

// Listen for trade events
logMonitor.on('trade', (tradeData) => {
    console.log('\n🔔 Trade Alert Detected:');
    console.log('Player:', tradeData.player);
    console.log('Message:', tradeData.message);
    console.log('-'.repeat(50));
});

// Start monitoring
logMonitor.start();

console.log(`
🔍 Log Monitor Test Mode
------------------------
Monitoring: ${logMonitor.logPath}
Press Ctrl+C to stop

To test, you can:
1. Manually append test messages to the log file
2. Use the test-message.js script to simulate trade messages
`);

// Handle shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down log monitor...');
    logMonitor.stop();
    process.exit(0);
}); 