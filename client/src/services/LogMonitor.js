import Neutralino from '@neutralinojs/lib';

export class LogMonitor {
    constructor(configManager, auth, options = {}) {
        this.configManager = configManager;
        this.auth = auth;
        this.watchInterval = null;
        this.lastPosition = 0;
        this.stats = this.createStats();
        this.error = null;

        Neutralino.events.on('trade-alert', (ev) => {
            this.sendTradeAlert(ev.detail.player, ev.detail.message);
        });
    }

    createStats() {
        return {
            startTime: new Date(),
            totalLinesProcessed: 0,
            tradeMessagesFound: 0,
            players: new Set()
        };
    }

    loadConfig() {
        this.logPath = this.configManager.get('poe2.logPath');
        this.botServerUrl = this.configManager.get('discord.botServerUrl') || 'http://localhost:5050';
    }

    async start() {
        this.loadConfig();
        this.stats = this.createStats();
        if (this.watchInterval) return;
        
        try {
            if (!this.logPath) {
                throw new Error('Log path is not configured');
            }

            await Neutralino.filesystem.getStats(this.logPath);
            const stats = await Neutralino.filesystem.getStats(this.logPath);
            this.lastPosition = stats.size;
            
            this.watchInterval = setInterval(() => this.checkLog(), 1000);
            this.error = null;
            await Neutralino.events.broadcast('monitor-status', { status: 'active', error: null });
            
        } catch (error) {
            console.error('Failed to start monitoring:', error.message);
            await Neutralino.events.broadcast('monitor-status', { 
                status: 'error', 
                error: this.error
            });
            throw error;
        }
    }

    stop() {
        if (this.watchInterval) {
            clearInterval(this.watchInterval);
            this.watchInterval = null;
            Neutralino.events.broadcast('monitor-status', { status: 'inactive', error: null });
        }
    }

    async checkLog() {
        try {
            const stats = await Neutralino.filesystem.getStats(this.logPath);
            if (stats.size > this.lastPosition) {
                const data = await Neutralino.filesystem.readFile(this.logPath, {
                    pos: this.lastPosition,
                    size: stats.size - this.lastPosition
                });
                this.lastPosition = stats.size;
                this.processLines(data);
            }
        } catch (error) {
            console.error('Error checking log:', error);
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

    async restart() {
        this.stop();
        this.lastPosition = 0;
        await this.start();
    }

    processLine(line) {
        // Look for trade messages
        const match = line.match(/\[.+\] (@From ([^:]+): .+)/);
        if (match) {
            const [, message, player] = match;
            this.stats.tradeMessagesFound++;
            if (this.stats.players.has(player)) {
                this.sendTradeAlert(player, message);
                return;
            }

            // Check that the message is a trade message
            if (message.includes('buy your') || message.includes('listed for') || message.includes('offer')) {
                this.stats.players.add(player);
                this.sendTradeAlert(player, message);
            }
        }
    }

    async sendTradeAlert(player, message) {
        const tokens = (await this.auth.getAuthData()).tokens;

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
                Neutralino.events.broadcast('auth-refresh');
                const refreshHandler = () => {
                    console.log('Token refreshed, retrying alert...');
                    this.sendTradeAlert(player, message);
                    Neutralino.events.off('discord-tokens-refreshed', refreshHandler);
                };

                Neutralino.events.on('discord-tokens-refreshed', refreshHandler);
                return;
            }
            
            if (response.status !== 200) {
                throw new Error(`Unexpected status code: ${response.status}`);
            }

            console.log('Trade alert sent successfully');
            
        } catch (error) {
            console.log('Error sending trade alert:', error);
        }
    }
}
