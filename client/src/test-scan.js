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

// Updated trade message regex (same as in LogMonitor)
const tradeRegex = /\[INFO Client \d+\] @From ([^:]+): (?:(?:Hi,? )?(?:I would like to |I want to |I'd like to )?(?:buy|purchase|wtb|wtt for|trade for)|(?:wtb|wts|wtt)|(?:buy|buying)) .+? (?:(?:listed for|price|for) .+? in \w+|\d+(?:\.\d+)? \w+ in \w+)(?:\s*\(stash tab.*?\)|$)/i;

// Stats to collect
const stats = {
    totalLines: 0,
    tradeMessages: 0,
    players: new Set(),
    startTime: null,
    endTime: null
};

console.log(`
🔍 Scanning log file for trade messages...
Path: ${logPath}
`);

try {
    // Read the entire file
    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.split('\n');
    stats.totalLines = lines.length;

    // Process each line
    lines.forEach((line, index) => {
        if (!line.trim()) return;

        // Try to parse timestamp
        const timestampMatch = line.match(/^(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2})/);
        if (timestampMatch) {
            const timestamp = new Date(timestampMatch[1]);
            if (!stats.startTime || timestamp < stats.startTime) {
                stats.startTime = timestamp;
            }
            if (!stats.endTime || timestamp > stats.endTime) {
                stats.endTime = timestamp;
            }
        }

        // Check for trade messages
        const match = line.match(tradeRegex);
        if (match) {
            stats.tradeMessages++;
            stats.players.add(match[1]);
            
            // Extract item and price if possible
            const itemMatch = line.match(/buy your ([^(].*?) (?:listed for|price) (.*?) in/i);
            const item = itemMatch ? itemMatch[1].trim() : 'unknown item';
            const price = itemMatch ? itemMatch[2].trim() : 'unknown price';

            console.log('\n🔔 Trade Message Found:');
            console.log('Timestamp:', timestampMatch ? timestampMatch[1] : 'unknown');
            console.log('Player:', match[1]);
            console.log('Item:', item);
            console.log('Price:', price);
            console.log('Full message:', line.trim());
            console.log('-'.repeat(80));
        }
    });

    // Print summary
    const duration = stats.endTime - stats.startTime;
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));

    console.log('\n📊 Scan Summary');
    console.log('-'.repeat(20));
    console.log('Total lines processed:', stats.totalLines.toLocaleString());
    console.log('Trade messages found:', stats.tradeMessages.toLocaleString());
    console.log('Unique players:', stats.players.size.toLocaleString());
    console.log('Log duration:', `${hours}h ${minutes}m`);
    console.log('Time range:', `${stats.startTime?.toLocaleString() || 'unknown'} to ${stats.endTime?.toLocaleString() || 'unknown'}`);

} catch (error) {
    if (error.code === 'ENOENT') {
        console.error('❌ Log file not found!');
        console.error('Path:', logPath);
        console.error('\nMake sure:');
        console.error('1. The log path in .env is correct');
        console.error('2. The game has been run at least once');
    } else {
        console.error('❌ Error scanning log file:', error);
    }
    process.exit(1);
} 