import Neutralino from '@neutralinojs/lib';

export class LogMonitor {
    constructor(configManager, options = {}) {
        this.configManager = configManager;
        this.logPath = configManager.get('poe2.logPath');
        this.botServerUrl = configManager.get('discord.botServerUrl') || 'http://localhost:5050';
        this.watchInterval = null;
        this.lastPosition = 0;
        this.stats = this.createStats();
    }

    isConnected() {
        return this.configManager.get('discord.accessToken') !== null;
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
            
            // Start the interval
            this.watchInterval = setInterval(() => this.checkLog(), 100);
        } catch (error) {
            console.error('Failed to start monitoring:', error);
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
        const tokens = {
            access_token: this.configManager.get('discord.accessToken'),
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
                    return;
                }
            }

            const data = await response.json();
            
            if (!response.ok) {
                if (data.error === 'Cannot send messages to this user') {
                    const error = 'Cannot send Discord DMs. Please enable DMs from server members in your Discord privacy settings.';
                    console.error({ player, message, error });
                    return;
                }
                throw new Error(data.error || 'Failed to send trade alert');
            }

            console.log('Trade alert sent successfully');
            
        } catch (error) {
            console.log('Error sending trade alert:', error);
        }
    }

    async refreshDiscordTokens() {
        // TODO: Implement refresh
        throw new Error('Token refresh not implemented');
    }
}
