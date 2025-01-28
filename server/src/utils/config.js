const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

function loadConfig() {
    // Load environment variables
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
    }

    // Validate required variables
    const requiredVars = [
        'DISCORD_CLIENT_ID',
        'DISCORD_CLIENT_SECRET',
        'DISCORD_BOT_TOKEN',
        'PORT',
        'REDIRECT_URI'
    ];

    const missingVars = requiredVars.filter(key => !process.env[key]);
    if (missingVars.length > 0) {
        throw new Error(
            'Missing required environment variables:\n' +
            missingVars.map(v => `  - ${v}`).join('\n') +
            '\nPlease set these in your .env file'
        );
    }

    return process.env;
}

module.exports = { loadConfig }; 