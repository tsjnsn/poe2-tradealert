const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const LogMonitor = require('../services/LogMonitor');
const { loadConfig } = require('../utils/config');

class WebServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.wss = new WebSocket.Server({ server: this.server });
        this.clients = new Set();

        // Load configuration
        const { logPath, botServerUrl, getDiscordTokens, setDiscordTokens, clearDiscordTokens, clientId, clientPort } = loadConfig();

        // Create monitor in web mode
        this.monitor = new LogMonitor(logPath, { webMode: true });

        // Serve static files
        this.app.use(express.static(path.join(__dirname)));
        this.app.use(express.json());

        // API routes
        this.app.get('/api/stats', (req, res) => {
            const stats = this.monitor.stats;
            const uptime = Math.floor((new Date() - stats.startTime) / 1000);
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = uptime % 60;

            res.json({
                uptime: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`,
                linesProcessed: stats.totalLinesProcessed,
                tradeMessages: stats.tradeMessagesFound,
                uniquePlayers: stats.players.size,
                connected: !!getDiscordTokens()
            });
        });

        this.app.post('/api/auth/logout', (req, res) => {
            clearDiscordTokens();
            res.json({ message: 'Logged out successfully' });
        });

        this.app.get('/api/auth/start', async (req, res) => {
            try {
                console.log('Starting auth with bot server:', `${botServerUrl}/auth`);
                const response = await fetch(`${botServerUrl}/auth?callback_port=${clientPort}`, {
                    method: 'GET'
                });

                const responseText = await response.text();
                console.log('Bot server response:', response.status, responseText);

                if (!response.ok) {
                    throw new Error(`Bot server returned ${response.status}: ${responseText}`);
                }

                let data;
                try {
                    data = JSON.parse(responseText);
                } catch (e) {
                    throw new Error('Invalid JSON response from bot server');
                }

                if (!data.url) {
                    throw new Error('No auth URL in response');
                }

                res.json({ authUrl: data.url });
            } catch (error) {
                console.error('Auth start error:', error);
                res.status(500).json({ 
                    error: 'Failed to start authentication',
                    details: error.message
                });
            }
        });

        this.app.get('/auth/callback', async (req, res) => {
            const { data } = req.query;
            
            try {
                if (!data) {
                    throw new Error('No data received from Discord');
                }

                // Decode the base64 data
                const decodedData = JSON.parse(Buffer.from(data, 'base64').toString());
                
                if (!decodedData.tokens) {
                    throw new Error('No tokens received from Discord');
                }

                setDiscordTokens(decodedData.tokens);

                // Send HTML that closes the window and shows success
                res.send(`
                    <html>
                        <body>
                            <script>
                                window.opener.postMessage('auth-success', '*');
                                window.close();
                            </script>
                            Authentication successful! You can close this window.
                        </body>
                    </html>
                `);
            } catch (error) {
                console.error('Auth callback error:', error);
                res.send(`
                    <html>
                        <body>
                            <script>
                                window.opener.postMessage('auth-error', '*');
                                window.close();
                            </script>
                            Authentication failed! You can close this window.
                        </body>
                    </html>
                `);
            }
        });

        this.app.post('/api/command', (req, res) => {
            const { command } = req.body;

            if (command.startsWith('/test-message')) {
                const tokens = getDiscordTokens();
                if (!tokens) {
                    res.json({ error: 'Not connected to Discord. Please authenticate first.' });
                    return;
                }

                // Extract custom message if provided
                const match = command.match(/^\/test-message\s*"([^"]+)"/);
                const message = match ? match[1] : 'Test Item listed for 5 divine in Standard';
                
                this.monitor.sendTradeAlert('TestTrader', `[INFO Client 1234] @From TestTrader: Hi, I would like to buy your ${message}`);
                res.json({ message: 'Test trade alert sent.' });
                return;
            }

            res.json({ error: 'Unknown command. Type /help for available commands.' });
        });

        // WebSocket handling
        this.wss.on('connection', (ws) => {
            this.clients.add(ws);
            ws.on('close', () => this.clients.delete(ws));
        });

        // Handle trade events
        this.monitor.on('trade', (tradeData) => {
            const message = {
                type: 'trade',
                player: tradeData.player,
                message: tradeData.message,
                error: tradeData.error
            };

            for (const client of this.clients) {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(message));
                }
            }
        });
    }

    start(port = 3000) {
        // Start the monitor
        this.monitor.start();

        // Start the web server
        this.server.listen(port, () => {
            console.log(`Web interface available at http://localhost:${port}`);
        });
    }

    stop() {
        this.monitor.stop();
        this.server.close();
    }
}

module.exports = { WebServer }; 