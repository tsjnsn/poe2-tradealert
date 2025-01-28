const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { resolvePath } = require('./paths');
const tokenStore = require('./tokenStore');

function loadConfig() {
    // Load environment variables
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
    }

    // Validate required variables
    const requiredVars = [
        'POE2_LOG_PATH',
        'BOT_SERVER_URL'
    ];

    const missingVars = requiredVars.filter(key => !process.env[key]);
    if (missingVars.length > 0) {
        throw new Error(
            'Missing required environment variables:\n' +
            missingVars.map(v => `  - ${v}`).join('\n') +
            '\nPlease set these in your .env file'
        );
    }

    // Normalize paths based on OS
    if (process.env.POE2_LOG_PATH) {
        process.env.POE2_LOG_PATH = process.env.POE2_LOG_PATH
            .replace('%APPDATA%', process.env.APPDATA || '')
            .replace('~', process.env.HOME || '');
    }

    // Normalize bot server URL (remove trailing slash)
    if (process.env.BOT_SERVER_URL) {
        process.env.BOT_SERVER_URL = process.env.BOT_SERVER_URL.replace(/\/$/, '');
    }

    // Load tokens from disk
    let discordTokens = tokenStore.loadTokens();

    function getDiscordTokens() {
        return discordTokens;
    }

    function setDiscordTokens(tokens) {
        discordTokens = tokens;
        // Save tokens to disk
        tokenStore.saveTokens(tokens);
    }

    function clearDiscordTokens() {
        discordTokens = null;
        tokenStore.clearTokens();
    }

    async function refreshDiscordTokens() {
        if (!discordTokens?.refresh_token) {
            throw new Error('No refresh token available');
        }

        const response = await fetch(`${process.env.BOT_SERVER_URL}/auth/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                refresh_token: discordTokens.refresh_token
            })
        });

        if (!response.ok) {
            // Clear invalid tokens
            discordTokens = null;
            tokenStore.clearTokens();
            throw new Error('Failed to refresh token');
        }

        const newTokens = await response.json();
        setDiscordTokens(newTokens);
        return newTokens;
    }

    return {
        logPath: resolvePath(process.env.POE2_LOG_PATH),
        botServerUrl: process.env.BOT_SERVER_URL,
        getDiscordTokens,
        setDiscordTokens,
        clearDiscordTokens,
        refreshDiscordTokens
    };
}

module.exports = { loadConfig }; 