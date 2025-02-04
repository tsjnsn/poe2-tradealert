const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

class AuthServer {
    constructor(discordBot) {
        this.app = express();
        this.discordBot = discordBot;
        this.port = process.env.PORT || 5050;
        
        // Enable CORS - Reflect requesting origin
        this.app.use(cors({
            origin: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
            allowedHeaders: '*',
            credentials: true
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
            const redirectUri = req.query.redirect_uri;

            if (!redirectUri) {
                return res.status(400).json({ error: 'No redirect URI provided' });
            }

            // Generate a state parameter to validate the callback
            const state = Buffer.from(JSON.stringify({ redirect_uri: redirectUri, NL_TOKEN: req.query.NL_TOKEN })).toString('base64');
            const botServerRedirectUri = `http://localhost:${process.env.PORT}/auth/callback`;
            // Return auth URL instead of redirecting
            const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(botServerRedirectUri)}&response_type=code&scope=identify%20bot&permissions=8192&state=${state}`;
            res.json({ url: authUrl });
        });

        this.app.get('/auth/callback', async (req, res) => {
            console.log('Received auth callback request');
            const { code, state } = req.query;
            console.log('Query parameters:', { code: !!code, state: !!state });
            
            let clientRedirectUri;
            let NL_TOKEN;
            try {
                console.log('Decoding state parameter');
                const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
                clientRedirectUri = stateData.redirect_uri;
                NL_TOKEN = stateData.NL_TOKEN;
                console.log('Decoded redirect URI:', clientRedirectUri);
                console.log('Decoded NL_TOKEN:', NL_TOKEN);
            } catch (error) {
                console.error('Failed to parse state:', error);
                return res.status(400).send('Invalid state parameter. Please close this window and try again.');
            }
            
            const handleError = (message) => {
                console.error('Auth error:', message);
                if (clientRedirectUri) {
                    console.log('Redirecting to client with error');
                    const errorData = Buffer.from(JSON.stringify({ error: message })).toString('base64');
                    return res.redirect(`${clientRedirectUri}?error=${errorData}`);
                } else {
                    return res.status(400).send(`Authentication error: ${message}. Please close this window and try again.`);
                }
            };
            
            if (!code) {
                console.log('No authorization code provided');
                return handleError('No authorization code provided');
            }

            if (!clientRedirectUri) {
                console.log('No redirect URI found in state');
                return handleError('No redirect URI found in state');
            }

            try {
                console.log('Exchanging code for tokens');
                const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
                    method: 'POST',
                    body: new URLSearchParams({
                        client_id: process.env.DISCORD_CLIENT_ID,
                        client_secret: process.env.DISCORD_CLIENT_SECRET,
                        code,
                        grant_type: 'authorization_code',
                        redirect_uri: `http://localhost:${process.env.PORT}/auth/callback`,
                        scope: 'identify bot',
                    }),
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                });

                if (!tokenResponse.ok) {
                    const errorText = await tokenResponse.text();
                    console.error('Token exchange failed:', errorText);
                    return handleError('Failed to exchange code for tokens');
                }

                const tokenData = await tokenResponse.json();
                console.log('Successfully obtained tokens');

                console.log('Fetching user info');
                const userResponse = await fetch('https://discord.com/api/users/@me', {
                    headers: {
                        Authorization: `Bearer ${tokenData.access_token}`,
                    },
                });

                if (!userResponse.ok) {
                    const errorText = await userResponse.text();
                    console.error('User info fetch failed:', errorText);
                    return handleError('Failed to get user info');
                }

                const userData = await userResponse.json();
                console.log('Successfully fetched user info:', { id: userData.id, username: userData.username });
                
                console.log('Linking user in bot');
                await this.discordBot.linkUser(userData.id);
                console.log('User linked successfully');

                console.log('Preparing response data');
                const responseData = {
                    tokens: tokenData,
                    user: userData
                };
                
                const encodedData = Buffer.from(JSON.stringify(responseData)).toString('base64');
                const redirectUri = `${clientRedirectUri}?data=${encodedData}&connectToken=${NL_TOKEN}`;
                console.log('Redirecting to client with auth data');
                res.redirect(redirectUri);
            } catch (error) {
                console.error('Auth error:', error);
                return handleError(error.message);
            }
        });

        // Token refresh endpoint
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

        // Trade alert endpoint
        this.app.post('/api/trade-alert', async (req, res) => {
            try {
                const authHeader = req.headers.authorization;
                if (!authHeader) {
                    return res.status(401).send('No authorization header');
                }

                const accessToken = authHeader.split(' ')[1];
                const userResponse = await fetch('https://discord.com/api/users/@me', {
                    headers: {
                        Authorization: `Bearer ${accessToken}`
                    }
                });

                if (!userResponse.ok) {
                    return res.status(401).send('Invalid Discord token');
                }

                const userData = await userResponse.json();
                const userId = userData.id;

                // Re-link user if they have valid tokens but aren't linked
                if (!this.discordBot.isUserLinked(userId)) {
                    await this.discordBot.linkUser(userId);
                }

                const { player, message } = req.body;
                if (!player || !message) {
                    return res.status(400).send('Missing required fields');
                }

                await this.discordBot.sendTradeAlert(userId, { player, message });
                res.status(200).send('Alert sent successfully');
            } catch (error) {
                console.error('Trade alert error:', error);
                res.status(500).send('Internal server error');
            }
        });

        // Start server
        const server = this.app.listen(this.port, () => {
            console.log(`Auth server listening on port ${this.port}`);
        });

        return server;
    }
}


module.exports = AuthServer; 