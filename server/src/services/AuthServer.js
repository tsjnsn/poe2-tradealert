const express = require('express');
const fetch = require('node-fetch');
const session = require('express-session');

class AuthServer {
    constructor(discordBot) {
        this.app = express();
        this.discordBot = discordBot;
        
        // Add session support
        this.app.use(session({
            secret: process.env.SESSION_SECRET || 'dev-secret-key',
            resave: false,
            saveUninitialized: true,
            cookie: { secure: process.env.NODE_ENV === 'production' }
        }));

        // Parse JSON bodies
        this.app.use(express.json());

        // Add request logging in non-production
        if (process.env.NODE_ENV !== 'production') {
            this.app.use((req, res, next) => {
                console.log(`${req.method} ${req.path}`);
                next();
            });
        }

        // Add basic security headers
        this.app.use((req, res, next) => {
            res.set({
                'X-Content-Type-Options': 'nosniff',
                'X-Frame-Options': 'DENY',
                'X-XSS-Protection': '1; mode=block',
                'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
            });
            next();
        });

        // Health check endpoint for Cloud Run
        this.app.get('/_health', (req, res) => {
            const health = {
                uptime: process.uptime(),
                timestamp: Date.now(),
                discord: this.discordBot.isReady()
            };
            res.status(this.discordBot.isReady() ? 200 : 503).json(health);
        });
    }

    start() {
        // Auth endpoints
        this.app.get('/auth', (req, res) => {
            const clientId = process.env.DISCORD_CLIENT_ID;
            const callbackPort = req.query.callback_port;

            if (!callbackPort) {
                return res.status(400).send('No callback port provided');
            }

            // Store callback port in session for after Discord redirects back
            req.session.callback_port = callbackPort;

            // Redirect to Discord OAuth
            const redirectUri = `http://localhost:${process.env.PORT}/auth/callback`;
            const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=identify`;
            res.redirect(authUrl);
        });

        this.app.get('/auth/callback', async (req, res) => {
            const { code } = req.query;
            const clientCallbackPort = req.session.callback_port;
            
            if (!code) {
                return res.status(400).send('No code provided');
            }

            if (!clientCallbackPort) {
                return res.status(400).send('No callback port found in session');
            }

            try {
                // Exchange code for tokens (keeping client_secret secure)
                const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
                    method: 'POST',
                    body: new URLSearchParams({
                        client_id: process.env.DISCORD_CLIENT_ID,
                        client_secret: process.env.DISCORD_CLIENT_SECRET,
                        code,
                        grant_type: 'authorization_code',
                        redirect_uri: `http://localhost:${process.env.PORT}/auth/callback`,
                        scope: 'identify',
                    }),
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                });

                if (!tokenResponse.ok) {
                    throw new Error('Failed to exchange code for tokens');
                }

                const tokenData = await tokenResponse.json();

                // Get user info
                const userResponse = await fetch('https://discord.com/api/users/@me', {
                    headers: {
                        Authorization: `Bearer ${tokenData.access_token}`,
                    },
                });

                if (!userResponse.ok) {
                    throw new Error('Failed to get user info');
                }

                const userData = await userResponse.json();
                
                // Link user in bot
                await this.discordBot.linkUser(userData.id);

                // Clear session
                delete req.session.callback_port;

                // Redirect to client with tokens and user info
                const responseData = {
                    tokens: tokenData,
                    user: userData
                };
                
                const encodedData = Buffer.from(JSON.stringify(responseData)).toString('base64');
                res.redirect(`http://localhost:${clientCallbackPort}/auth/callback?data=${encodedData}`);
            } catch (error) {
                console.error('Auth error:', error);
                // Attempt to redirect back to client with error
                if (clientCallbackPort) {
                    const errorData = Buffer.from(JSON.stringify({ error: error.message })).toString('base64');
                    res.redirect(`http://localhost:${clientCallbackPort}/auth/callback?error=${errorData}`);
                } else {
                    res.status(500).send('Authentication failed');
                }
            }
        });

        // Add token refresh endpoint
        this.app.post('/auth/refresh', async (req, res) => {
            const { refresh_token } = req.body;
            if (!refresh_token) {
                return res.status(400).send('No refresh token provided');
            }

            try {
                const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
                    method: 'POST',
                    body: new URLSearchParams({
                        client_id: process.env.DISCORD_CLIENT_ID,
                        client_secret: process.env.DISCORD_CLIENT_SECRET,
                        grant_type: 'refresh_token',
                        refresh_token,
                    }),
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                });

                if (!tokenResponse.ok) {
                    return res.status(401).send('Invalid refresh token');
                }

                const tokenData = await tokenResponse.json();
                res.json(tokenData);
            } catch (error) {
                console.error('Token refresh error:', error);
                res.status(500).send('Failed to refresh token');
            }
        });

        // API endpoints
        this.app.post('/api/trade-alert', async (req, res) => {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).send('No access token provided');
            }

            const accessToken = authHeader.split(' ')[1];

            try {
                // Validate token and get user info
                const userResponse = await fetch('https://discord.com/api/users/@me', {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                });

                if (!userResponse.ok) {
                    return res.status(401).send('Invalid access token');
                }

                const userData = await userResponse.json();
                const userId = userData.id;

                if (!this.discordBot.isUserLinked(userId)) {
                    return res.status(403).send('Discord account not linked');
                }

                const { player, message } = req.body;
                if (!player || !message) {
                    return res.status(400).send('Missing required fields');
                }

                await this.discordBot.sendTradeAlert(userId, { player, message });
                res.status(200).send('Alert sent successfully');
            } catch (error) {
                console.error('Error processing trade alert:', error);
                res.status(500).send('Failed to process alert');
            }
        });

        // Start server
        const port = parseInt(process.env.PORT) || 5050;
        const server = this.app.listen(port, '0.0.0.0', () => {
            console.log(`Auth server listening on port ${port}`);
        });

        return server;
    }

    generateApiKey() {
        return Buffer.from(Math.random().toString(36) + Date.now().toString()).toString('base64');
    }
}

module.exports = AuthServer; 