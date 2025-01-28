const express = require('express');
const http = require('http');
const path = require('path');
const LogMonitor = require('../services/LogMonitor');
const configManager = require('../utils/config-manager');
const fetch = require('node-fetch');

class WebServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.clients = new Set();

        // Validate configuration
        configManager.validate();

        // Create monitor in web mode
        this.monitor = new LogMonitor(configManager.get('poe2.logPath'), { webMode: true });

        // Serve static files
        this.app.use(express.static(path.join(__dirname)));
        this.app.use(express.json());

        // SSE endpoint for real-time updates
        this.app.get('/api/events', (req, res) => {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.flushHeaders();

            // Send an initial ping to establish connection
            res.write('event: ping\ndata: connected\n\n');

            // Add client to the set
            this.clients.add(res);

            // Remove client on connection close
            req.on('close', () => {
                this.clients.delete(res);
            });
        });

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
                connected: this.monitor.isConnected()
            });
        });

        this.app.post('/api/auth/logout', (req, res) => {
            this.monitor.clearAuth();
            res.json({ message: 'Logged out successfully' });
        });

        this.app.get('/api/auth/start', async (req, res) => {
            try {
                const botServerUrl = configManager.get('discord.botServerUrl');
                const clientPort = configManager.get('server.clientPort');
                
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

                this.monitor.setAuth(decodedData.tokens);

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
                if (!this.monitor.isConnected()) {
                    res.json({ error: 'Not connected to Discord. Please authenticate first.' });
                    return;
                }

                // Extract custom message if provided
                const match = command.match(/^\/test-message\s*"([^"]+)"/);
                const baseMessage = match ? match[1] : 'Hi, I would like to buy your Test Item listed for 5 divine in Standard';
                const clientId = Math.floor(Math.random() * 90000) + 10000; // Random 5-digit number
                const fullMessage = `[INFO Client ${clientId}] @From TestTrader: ${baseMessage}`;
                
                // Extract the clean message part (same as LogMonitor)
                const messageMatch = fullMessage.match(/\[INFO Client \d+\] (@From .+)/);
                const cleanMessage = messageMatch ? messageMatch[1] : fullMessage.trim();
                
                this.monitor.sendTradeAlert('TestTrader', cleanMessage);
                res.json({ message: 'Test trade alert sent.' });
                return;
            }

            res.json({ error: 'Unknown command. Type /help for available commands.' });
        });

        this.app.get('/api/config', (req, res) => {
            res.json(configManager.getAll());
        });

        this.app.post('/api/config', (req, res) => {
            const { key, value } = req.body;
            try {
                configManager.set(key, value);
                res.json({ success: true, config: configManager.getAll() });
            } catch (error) {
                res.status(400).json({ error: error.message });
            }
        });

        this.app.post('/api/config/reset', (req, res) => {
            configManager.reset();
            res.json(configManager.getAll());
        });

        // Handle trade events
        this.monitor.on('trade', (tradeData) => {
            const message = {
                type: 'trade',
                player: tradeData.player,
                message: tradeData.message,
                error: tradeData.error
            };

            this.broadcastEvent('trade', message);
        });

        // Handle config changes
        configManager.on('configChanged', (config) => {
            this.broadcastEvent('config', config);
        });
    }

    broadcastEvent(event, data) {
        const eventMessage = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        for (const client of this.clients) {
            client.write(eventMessage);
        }
    }

    start() {
        const port = configManager.get('server.clientPort');
        const host = configManager.get('server.host');

        // Start the monitor
        this.monitor.start();

        // Start the web server
        this.server.listen(port, host, () => {
            console.log(`Web interface available at http://${host}:${port}`);
        });
    }

    stop() {
        this.monitor.stop();
        // Close all SSE connections
        for (const client of this.clients) {
            client.end();
        }
        this.server.close();
    }
}

module.exports = { WebServer }; 