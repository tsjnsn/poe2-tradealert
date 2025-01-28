const { loadConfig } = require('./utils/config');
const { resolvePath } = require('./utils/paths');
const fs = require('fs');
const path = require('path');

// Load configuration (ignoring Discord-related validation)
try {
    loadConfig();
} catch (error) {
    // Ignore missing Discord credentials in test mode
    if (!error.message.includes('Missing required environment variables')) {
        throw error;
    }
}

// Resolve the log path
const logPath = resolvePath(process.env.POE2_LOG_PATH);

// Sample trade messages with actual log format
const sampleMessages = [
    '[INFO Client 26596] @From Boomtard: Hi, I would like to buy your Surefooted Sigil, Jade Amulet listed for 14 exalted in Standard (stash tab "~price 14 exalted"; position: left 9, top 11)',
    '[INFO Client 26597] @From TraderPro123: Hi, I would like to buy your 6-link Astral Plate listed for 10 divine in Standard (stash tab "~price 10 divine")',
    '[INFO Client 26598] @From CraftMaster: Hi, I would like to buy your Level 4 Enlighten listed for 5 divine in Standard',
    '[INFO Client 26599] @From ItemSeeker: wtb your 1000 chaos orbs listed for 5 divine in Standard (stash tab "Bulk")',
    '[INFO Client 26600] @From QuickBuyer: wtb Headhunter 50 divine in Standard',
    '[INFO Client 26601] @From GemTrader: I want to buy your Awakened Multistrike Support price 8 divine in Standard',
    '[INFO Client 26602] @From BulkSeller: Hi I would like to purchase your 2000 Orb of Alteration for 2 divine in Standard',
    '[INFO Client 26603] @From MapBuyer: wtt for your Crimson Temple Map listed for 10c in Standard',
    '[INFO Client 26604] @From CasualTrader: buying your Aegis Aurora 3.5 divine in Standard'
];

// Get random message
const message = sampleMessages[Math.floor(Math.random() * sampleMessages.length)];

// Add timestamp in POE2 format
const now = new Date();
const timestamp = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
const processId = Math.floor(Math.random() * 90000000) + 10000000;
const sessionId = Math.random().toString(16).slice(2, 10);
const logMessage = `${timestamp} ${processId} ${sessionId} ${message}\n`;

// Append to log file
try {
    fs.appendFileSync(logPath, logMessage);
    console.log('✅ Added test message to log:');
    console.log(logMessage);
} catch (error) {
    console.error('❌ Error writing to log file:', error);
    console.error('Path:', logPath);
    console.log('\nMake sure:');
    console.log('1. The log directory exists');
    console.log('2. You have write permissions');
    console.log('3. The POE2_LOG_PATH in .env is correct');
    process.exit(1);
} 