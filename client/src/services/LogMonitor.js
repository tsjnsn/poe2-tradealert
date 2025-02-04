import Neutralino from '@neutralinojs/lib';

export class LogMonitor {
    constructor(configManager, auth, options = {}) {
        this.configManager = configManager;
        this.auth = auth;
        this.logPath = configManager.get('poe2.logPath');
        this.botServerUrl = configManager.get('discord.botServerUrl') || 'http://localhost:5050';
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

    async restart() {
        this.stop();
        this.lastPosition = 0;
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
}
