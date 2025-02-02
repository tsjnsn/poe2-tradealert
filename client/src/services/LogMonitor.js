import { filesystem, os } from '@neutralinojs/lib';
import { Neutralino } from '@neutralinojs/lib';

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
        this.botServerUrl = options.botServerUrl || 'http://localhost:3000';
        this.discordTokens = null;
        this.watching = false;
        this.lastPosition = 0;
        this.stats = {
            startTime: new Date(),
            totalLinesProcessed: 0,
            tradeMessagesFound: 0,
            players: new Set()
        };
    }

    async start() {
        if (this.watching) return;
        
        try {
            // Ensure log file exists
            const exists = await filesystem.getStats(this.logPath);
            if (!exists) {
                throw new Error('Log file not found');
            }
            
            // Get initial file size
            const stats = await filesystem.getStats(this.logPath);
            this.lastPosition = stats.size;
            
            // Start watching
            this.watching = true;
            this.watchLog();
            
        } catch (error) {
            console.error('Failed to start monitoring:', error);
            this.emit('error', error);
        }
    }

    stop() {
        this.watching = false;
    }

    async watchLog() {
        while (this.watching) {
            try {
                const stats = await Neutralino.filesystem.getStats(this.logPath);
                if (stats.size > this.lastPosition) {
                    const data = await Neutralino.filesystem.readFile(this.logPath, {
                        position: this.lastPosition,
                        length: stats.size - this.lastPosition
                    });
                    this.lastPosition = stats.size;
                    
                    // Process new lines
                    const lines = data.split('\n');
                    for (const line of lines) {
                        if (!line.trim()) continue;
                        
                        this.stats.totalLinesProcessed++;
                        this.processLine(line);
                    }
                }
                
                // Wait before next check
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                console.error('Error watching log:', error);
                this.emit('error', error);
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
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
            const response = await fetch(`${this.botServerUrl}/api/trade-alert`, {
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

        const response = await fetch(`${this.botServerUrl}/api/auth/refresh`, {
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

    setAuth(tokens) {
        this.discordTokens = tokens;
        // Store tokens securely using Neutralino storage
        Neutralino.storage.setData('discord_tokens', JSON.stringify(tokens));
    }

    clearAuth() {
        this.discordTokens = null;
        Neutralino.storage.removeData('discord_tokens');
    }

    getDiscordTokens() {
        if (!this.discordTokens) {
            const stored = Neutralino.storage.getData('discord_tokens');
            if (stored) {
                this.discordTokens = JSON.parse(stored);
            }
        }
        return this.discordTokens;
    }

    isConnected() {
        return !!this.getDiscordTokens();
    }
} 