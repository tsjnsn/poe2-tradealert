import Neutralino from '@neutralinojs/lib';

// Simple EventEmitter implementation for browser
class EventEmitter {
    constructor() {
        this.events = {};
    }

    on(event, listener) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(listener);
        return () => this.off(event, listener);
    }

    off(event, listener) {
        if (!this.events[event]) return;
        this.events[event] = this.events[event].filter(l => l !== listener);
    }

    emit(event, ...args) {
        if (!this.events[event]) return;
        this.events[event].forEach(listener => listener(...args));
    }
}

export class LogMonitor extends EventEmitter {
    constructor(logPath, options = {}) {
        super();
        this.logPath = logPath;
        this.webMode = options.webMode || false;
        this.botServerUrl = options.botServerUrl || 'http://localhost:5050';
        this.discordTokens = null;
        this.watchInterval = null;
        this.lastPosition = 0;
        this.stats = this.createStats();
    }

    createStats() {
        return {
            startTime: new Date(),
            totalLinesProcessed: 0,
            tradeMessagesFound: 0,
            players: new Set()
        };
    }

    async start() {
        if (this.watchInterval) return;
        
        try {
            await Neutralino.filesystem.getStats(this.logPath);
            const stats = await Neutralino.filesystem.getStats(this.logPath);
            this.lastPosition = stats.size;
            
            // Simple interval-based watching
            this.watchInterval = setInterval(() => this.checkLog(), 100);
        } catch (error) {
            console.error('Failed to start monitoring:', error);
            this.emit('error', error);
        }
    }

    stop() {
        if (this.watchInterval) {
            clearInterval(this.watchInterval);
            this.watchInterval = null;
        }
    }

    async checkLog() {
        try {
            const stats = await Neutralino.filesystem.getStats(this.logPath);
            if (stats.size > this.lastPosition) {
                const data = await Neutralino.filesystem.readFile(this.logPath, {
                    position: this.lastPosition,
                    length: stats.size - this.lastPosition
                });
                this.lastPosition = stats.size;
                this.processLines(data);
            }
        } catch (error) {
            console.error('Error checking log:', error);
            this.emit('error', error);
            this.stop();
        }
    }

    processLines(data) {
        data.split('\n').forEach(line => {
            if (line.trim()) {
                this.stats.totalLinesProcessed++;
                this.processLine(line);
            }
        });
    }

    async restart(newConfig = {}) {
        this.stop();
        Object.assign(this, newConfig);
        this.lastPosition = 0;
        this.stats = this.createStats();
        await this.start();
    }

    processLine(line) {
        // Look for trade messages
        const match = line.match(/\[INFO Client \d+\] (@From ([^:]+): .+)/);
        if (match) {
            const [, message, player] = match;
            this.stats.tradeMessagesFound++;
            this.stats.players.add(player);
            this.sendTradeAlert(player, message);
        }
    }

    async sendTradeAlert(player, message) {
        const tokens = this.getDiscordTokens();
        
        if (!tokens) {
            if (!this.webMode) {
                console.log('No Discord tokens available. Trade alert will only be shown locally.');
                console.log(`Trade request from ${player}: ${message}`);
            }
            this.emit('trade', { player, message, error: 'Not connected to Discord' });
            return;
        }

        try {
            const response = await Neutralino.net.fetch(`${this.botServerUrl}/api/trade-alert`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${tokens.access_token}`
                },
                body: JSON.stringify({ player, message })
            });

            if (response.status === 401) {
                console.log('Token expired, attempting refresh...');
                try {
                    await this.refreshDiscordTokens();
                    console.log('Token refreshed successfully, retrying alert...');
                    return this.sendTradeAlert(player, message);
                } catch (refreshError) {
                    console.log('Token refresh failed:', refreshError);
                    this.emit('trade', { player, message, error: 'Discord session expired' });
                    return;
                }
            }

            const data = await response.json();
            
            if (!response.ok) {
                if (data.error === 'Cannot send messages to this user') {
                    const error = 'Cannot send Discord DMs. Please enable DMs from server members in your Discord privacy settings.';
                    this.emit('trade', { player, message, error });
                    return;
                }
                throw new Error(data.error || 'Failed to send trade alert');
            }

            console.log('Trade alert sent successfully');
            this.emit('trade', { player, message });
            
        } catch (error) {
            console.log('Error sending trade alert:', error);
            this.emit('trade', { player, message, error: error.message });
        }
    }

    async refreshDiscordTokens() {
        if (!this.discordTokens?.refresh_token) {
            throw new Error('No refresh token available');
        }

        const response = await Neutralino.net.fetch(`${this.botServerUrl}/api/auth/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                refresh_token: this.discordTokens.refresh_token
            })
        });

        if (!response.ok) {
            throw new Error('Failed to refresh token');
        }

        const tokens = await response.json();
        this.setAuth(tokens);
        return tokens;
    }

    async setAuth(tokens) {
        this.discordTokens = tokens;
        this.isDiscordConnected = !!tokens;
        try {
            // Store tokens securely using Neutralino storage
            await Neutralino.storage.setData('discord_tokens', JSON.stringify(tokens));
        } catch (error) {
            console.error('Failed to store auth tokens:', error);
            throw new Error('Failed to save authentication data');
        }
    }

    async clearAuth() {
        this.discordTokens = null;
        this.isDiscordConnected = false;
        try {
            await Neutralino.storage.removeData('discord_tokens');
        } catch (error) {
            console.error('Failed to clear auth tokens:', error);
        }
    }

    getDiscordTokens() {
        if (!this.discordTokens) {
            try {
                const stored = Neutralino.storage.getData('discord_tokens');
                if (stored) {
                    this.discordTokens = JSON.parse(stored);
                    this.isDiscordConnected = true;
                }
            } catch (error) {
                console.error('Failed to retrieve auth tokens:', error);
                return null;
            }
        }
        return this.discordTokens;
    }

    isConnected() {
        return this.isDiscordConnected;
    }
}
