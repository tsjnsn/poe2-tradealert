const http = require('http');
const { parse } = require('url');

async function getAvailablePort() {
    return new Promise((resolve, reject) => {
        const server = http.createServer();
        server.listen(0, () => {
            const { port } = server.address();
            server.close(() => resolve(port));
        });
        server.on('error', reject);
    });
}

async function waitForCallback() {
    const port = await getAvailablePort();
    let resolveCallback;
    
    const serverPromise = new Promise((resolve, reject) => {
        const server = http.createServer(async (req, res) => {
            try {
                const { pathname, query } = parse(req.url, true);

                // Ignore favicon requests
                if (pathname === '/favicon.ico') {
                    res.writeHead(404);
                    res.end();
                    return;
                }

                // Only handle /auth/callback path
                if (pathname !== '/auth/callback') {
                    res.writeHead(404);
                    res.end('Not found');
                    return;
                }
                
                // Handle error response
                if (query.error) {
                    const errorData = JSON.parse(Buffer.from(query.error, 'base64').toString());
                    res.writeHead(400, { 'Content-Type': 'text/html' });
                    res.end(`
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <title>Authentication Failed</title>
                            <style>
                                body {
                                    font-family: -apple-system, system-ui, sans-serif;
                                    text-align: center;
                                    padding: 2rem;
                                }
                                .error { color: #dc3545; }
                            </style>
                        </head>
                        <body>
                            <h3 class="error">Authentication failed</h3>
                            <p>${errorData.error}</p>
                            <script>setTimeout(window.close, 3000);</script>
                        </body>
                        </html>
                    `);
                    reject(new Error(errorData.error));
                    server.close();
                    return;
                }

                // Handle successful response
                if (!query.data) {
                    res.writeHead(400, { 'Content-Type': 'text/html' });
                    res.end(`
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <title>Authentication Failed</title>
                            <style>
                                body {
                                    font-family: -apple-system, system-ui, sans-serif;
                                    text-align: center;
                                    padding: 2rem;
                                }
                                .error { color: #dc3545; }
                            </style>
                        </head>
                        <body>
                            <h3 class="error">Authentication failed</h3>
                            <p>No response data received</p>
                            <script>setTimeout(window.close, 3000);</script>
                        </body>
                        </html>
                    `);
                    reject(new Error('No response data received'));
                    server.close();
                    return;
                }

                // Parse response data
                const responseData = JSON.parse(Buffer.from(query.data, 'base64').toString());

                // Send success response
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Authentication Complete</title>
                        <style>
                            body {
                                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                                text-align: center;
                                padding: 2rem;
                                background: #f7f9fc;
                                color: #333;
                                line-height: 1.6;
                                margin: 0;
                                min-height: 100vh;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                            }
                            .container {
                                background: white;
                                padding: 2.5rem 3rem;
                                border-radius: 12px;
                                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                                max-width: 400px;
                                width: 100%;
                            }
                            .success-icon {
                                width: 48px;
                                height: 48px;
                                margin: 0 auto 1rem;
                            }
                            .success-icon svg {
                                width: 100%;
                                height: 100%;
                            }
                            h3 {
                                color: #34d399;
                                margin: 0 0 1rem 0;
                                font-size: 1.5rem;
                                font-weight: 600;
                            }
                            .username {
                                font-size: 1.25rem;
                                font-weight: 500;
                                color: #4b5563;
                                margin: 1rem 0;
                                padding: 0.5rem 1rem;
                                background: #f3f4f6;
                                border-radius: 6px;
                                display: inline-block;
                            }
                            p {
                                color: #6b7280;
                                margin: 0.5rem 0;
                            }
                            .fade-out {
                                animation: fadeOut 0.5s ease-in-out 1.5s forwards;
                            }
                            @keyframes fadeOut {
                                from { opacity: 1; }
                                to { opacity: 0; }
                            }
                        </style>
                    </head>
                    <body>
                        <div class="container fade-out">
                            <div class="success-icon">
                                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="12" cy="12" r="10" fill="#34d399"/>
                                    <path d="M8 12l3 3 5-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </div>
                            <h3>Authentication Complete</h3>
                            <div class="username">${responseData.user.username}</div>
                            <p>Your Discord account has been successfully linked.</p>
                            <p style="font-size: 0.9rem; margin-top: 1rem;">This window will close automatically...</p>
                        </div>
                        <script>setTimeout(window.close, 2000);</script>
                    </body>
                    </html>
                `);

                // Save tokens and resolve
                resolveCallback(responseData.tokens);
                server.close();
            } catch (error) {
                reject(error);
                server.close();
            }
        });

        // Start listening
        server.listen(port, 'localhost', () => {
            resolve({ port });
        });

        // Set a timeout
        setTimeout(() => {
            server.close();
            reject(new Error('Authentication timed out'));
        }, 5 * 60 * 1000); // 5 minutes timeout
    });

    // Return both the port and a Promise that will resolve with the tokens
    return {
        port,
        tokensPromise: new Promise((resolve) => {
            resolveCallback = resolve;
        })
    };
}

module.exports = { waitForCallback }; 