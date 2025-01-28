const path = require('path');
const fs = require('fs');
const { resolvePath } = require('./paths');
const tokenStore = require('./tokenStore');
const configManager = require('./config-manager');

function loadConfig() {
    // Normalize paths based on OS
    const logPath = resolvePath(configManager.get('poe2.logPath'));
    console.log('Normalized log path:', logPath);

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

        const botServerUrl = configManager.get('discord.botServerUrl');
        const response = await fetch(`${botServerUrl}/auth/refresh`, {
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
        logPath: logPath,
        botServerUrl: configManager.get('discord.botServerUrl'),
        clientId: configManager.get('discord.clientId'),
        clientPort: configManager.get('server.clientPort'),
        getDiscordTokens,
        setDiscordTokens,
        clearDiscordTokens,
        refreshDiscordTokens
    };
}

module.exports = { loadConfig }; 