const { Client, GatewayIntentBits } = require('discord.js');

class DiscordBot {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.DirectMessages,
            ]
        });
        this.userMap = new Map(); // Store Discord user IDs
        this.ready = false;

        // Handle Discord connection events
        this.client.on('ready', () => {
            console.log(`Logged in as ${this.client.user.tag}`);
            this.ready = true;
        });

        this.client.on('disconnect', () => {
            console.log('Discord bot disconnected');
            this.ready = false;
        });

        this.client.on('error', error => {
            console.error('Discord bot error:', error);
            this.ready = false;
        });

        // Attempt to reconnect on errors
        this.client.on('shardError', error => {
            console.error('A websocket connection encountered an error:', error);
            this.ready = false;
        });
    }

    async start() {
        try {
            await this.client.login(process.env.DISCORD_BOT_TOKEN);
        } catch (error) {
            console.error('Failed to start Discord bot:', error);
            throw error; // Let the main process handle the error
        }
    }

    async sendTradeAlert(userId, tradeData) {
        if (!this.ready) {
            throw new Error('Discord bot not ready');
        }

        try {
            const user = await this.client.users.fetch(userId);
            if (user) {
                // Extract the actual message without the @From prefix
                const messageMatch = tradeData.message.match(/@From [^:]+: (.+)/);
                const cleanMessage = messageMatch ? messageMatch[1] : tradeData.message;
                const message = `> ${cleanMessage}\n> -# @${tradeData.player}`;
                await user.send(message);
            }
        } catch (error) {
            console.error('Error sending trade alert:', error);
            throw error;
        }
    }

    async linkUser(discordId) {
        if (!this.ready) {
            throw new Error('Discord bot not ready');
        }

        try {
            const user = await this.client.users.fetch(discordId);
            if (user) {
                this.userMap.set(discordId, true);
                return true;
            }
        } catch (error) {
            console.error('Error linking user:', error);
        }
        return false;
    }

    isUserLinked(discordId) {
        return this.userMap.has(discordId);
    }

    isReady() {
        return this.ready && this.client.ws.status === 0;
    }

    async stop() {
        this.ready = false;
        if (this.client) {
            await this.client.destroy();
        }
    }
}

module.exports = DiscordBot; 