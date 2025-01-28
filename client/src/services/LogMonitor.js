const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const { execSync } = require('child_process');
const { resolvePath } = require('../utils/paths');
const fetch = require('node-fetch');

class LogMonitor extends EventEmitter {
    constructor(logPath, options = {}) {
        super();
        this.logPath = this.initializePath(logPath);
        this.watcher = null;
        this.lastPosition = null;
        this.webMode = options.webMode || false;
        this.authPrompted = false;
        
        // Statistics
        this.stats = {
            totalBytesRead: 0,
            totalLinesProcessed: 0,
            tradeMessagesFound: 0,
            players: new Set(),
            startTime: new Date(),
            lastUpdate: new Date()
        };

        // Only set up stats interval if not in web mode
        if (!this.webMode) {
            setInterval(() => this.updateStats(), 1000);
        }
    }

    moveCursorToStats() {
        process.stdout.write('\x1B[s'); // Save cursor
        process.stdout.write('\x1B[H'); // Move to top
    }

    restoreCursor() {
        process.stdout.write('\x1B[u'); // Restore cursor
    }

    clearLine() {
        process.stdout.write('\x1B[2K'); // Clear entire line
    }

    formatBytes(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }

    updateStats() {
        if (this.webMode) return; // Skip console output in web mode
        
        const now = new Date();
        const uptime = Math.floor((now - this.stats.startTime) / 1000);
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = uptime % 60;
        const linesPerSec = (this.stats.totalLinesProcessed / uptime).toFixed(2);

        // Check Discord auth status
        const { getDiscordTokens, botServerUrl } = require('../utils/config').loadConfig();
        const tokens = getDiscordTokens();
        const authStatus = tokens ? '🟢 Connected to Discord' : '🔴 Not connected to Discord';
        const authHelp = tokens ? '' : `  Click to connect or visit ${botServerUrl}/auth`;

        // If not authenticated and not already prompted, emit event to open auth URL
        if (!tokens && !this.authPrompted) {
            this.emit('openAuth');
            this.authPrompted = true;
        } else if (tokens && this.authPrompted) {
            // Reset the flag if we have tokens
            this.authPrompted = false;
        }

        // Save cursor and move to stats region
        this.moveCursorToStats();

        // Clear each line before writing
        const stats = [
            '📊 Monitor Statistics (Press Ctrl+C to stop)',
            '-'.repeat(50),
            `⏱️  Uptime: ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`,
            `📝 Lines processed: ${this.stats.totalLinesProcessed.toLocaleString()}`,
            `💾 Data processed: ${this.formatBytes(this.stats.totalBytesRead)}`,
            `💬 Trade messages: ${this.stats.tradeMessagesFound.toLocaleString()}`,
            `👥 Unique players: ${this.stats.players.size.toLocaleString()}`,
            `⚡ Processing rate: ${linesPerSec} lines/sec`,
            `🔄 Last update: ${now.toLocaleTimeString()}`,
            `${authStatus}${authHelp}`,
            '-'.repeat(50),
            ''
        ];

        // Write each line
        stats.forEach(line => {
            this.clearLine();
            console.log(line);
        });

        // Restore cursor position
        this.restoreCursor();
        this.stats.lastUpdate = now;
    }

    isWSL() {
        try {
            const release = fs.readFileSync('/proc/version', 'utf8').toLowerCase();
            return release.includes('microsoft') || release.includes('wsl');
        } catch {
            return false;
        }
    }

    convertWindowsPathToWSL(windowsPath) {
        try {
            // Remove quotes if present
            windowsPath = windowsPath.replace(/^"(.*)"$/, '$1');
            
            // Convert backslashes to forward slashes
            windowsPath = windowsPath.replace(/\\/g, '/');
            
            // Convert C: to /mnt/c
            windowsPath = windowsPath.replace(/^([A-Za-z]):/, (_, drive) => `/mnt/${drive.toLowerCase()}`);
            
            // For more complex paths, use wslpath
            try {
                return execSync(`wslpath "${windowsPath}"`, { encoding: 'utf8' }).trim();
            } catch {
                return windowsPath;
            }
        } catch (error) {
            console.error('Error converting Windows path to WSL:', error);
            return windowsPath;
        }
    }

    initializePath(logPath) {
        // Resolve and normalize the path (quietly)
        console.log('Initializing log file path...');
        const resolvedPath = resolvePath(logPath);
        console.log('Using log file:', resolvedPath);

        // Create the logs directory if it doesn't exist
        const logsDir = path.dirname(resolvedPath);
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }

        // Create an empty log file if it doesn't exist
        if (!fs.existsSync(resolvedPath)) {
            fs.writeFileSync(resolvedPath, '', 'utf8');
        }

        return resolvedPath;
    }

    start() {
        if (!this.webMode) {
            // Clear screen and set up display regions only in console mode
            process.stdout.write('\x1B[2J\x1B[H');
            console.log('Monitoring:', this.logPath);
            console.log('\nTrade messages will appear below:\n');
        }
        
        // Create watcher
        this.watcher = chokidar.watch(this.logPath, {
            persistent: true,
            usePolling: true,
            interval: 100,
            awaitWriteFinish: {
                stabilityThreshold: 100,
                pollInterval: 100
            },
            ignoreInitial: true
        });

        // Initialize last position
        try {
            const stats = fs.statSync(this.logPath);
            this.lastPosition = stats.size;
            if (!this.webMode) {
                this.updateStats();
            }
        } catch (error) {
            console.error('Error accessing log file:', error);
            return;
        }

        // Watch for changes
        this.watcher.on('change', (path) => {
            this.processNewLines();
        });

        this.watcher.on('error', (error) => {
            console.error('Watch error:', error);
        });
    }

    async sendTradeAlert(player, message) {
        const { getDiscordTokens, setDiscordTokens, refreshDiscordTokens, botServerUrl } = require('../utils/config').loadConfig();
        const tokens = getDiscordTokens();
        
        if (!tokens) {
            if (!this.webMode) {
                console.log('No Discord tokens available. Trade alert will only be shown locally.');
                console.log(`Trade request from ${player}: ${message}`);
            }
            this.emit('trade', { player, message, error: 'Not connected to Discord' });
            return;
        }

        try {
            console.log(`Sending trade alert to ${botServerUrl}/api/trade-alert`);
            const response = await fetch(`${botServerUrl}/api/trade-alert`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${tokens.access_token}`
                },
                body: JSON.stringify({ player, message })
            });

            const responseText = await response.text();
            console.log('API Response:', response.status, responseText);

            let errorData;
            try {
                errorData = responseText ? JSON.parse(responseText) : {};
            } catch (e) {
                errorData = { error: responseText };
            }

            if (response.status === 401) {
                console.log('Token expired, attempting refresh...');
                try {
                    await refreshDiscordTokens();
                    console.log('Token refreshed successfully, retrying alert...');
                    return this.sendTradeAlert(player, message);
                } catch (refreshError) {
                    console.log('Token refresh failed:', refreshError);
                    if (!this.webMode) {
                        console.log('Discord session expired. Please re-authenticate.');
                    }
                    this.emit('trade', { player, message, error: 'Discord session expired' });
                    return;
                }
            }

            if (!response.ok) {
                if (errorData.error === 'Cannot send messages to this user') {
                    const error = 'Cannot send Discord DMs. Please enable DMs from server members in your Discord privacy settings.';
                    if (!this.webMode) {
                        console.log(error);
                        console.log(`Trade request from ${player}: ${message}`);
                    }
                    this.emit('trade', { player, message, error });
                    return;
                }
                throw new Error(errorData.error || 'Failed to send trade alert');
            }

            console.log('Trade alert sent successfully');
            // Success case
            this.emit('trade', { player, message });
        } catch (error) {
            console.log('Error sending trade alert:', error);
            if (!this.webMode) {
                console.log('Error sending trade alert. Message will only be shown locally:');
                console.log(`Trade request from ${player}: ${message}`);
            }
            this.emit('trade', { player, message, error: error.message });
        }
    }

    async sendTestMessage() {
        const testMessage = '[INFO Client 1234] @From TestTrader: Hi, I would like to buy your Test Item listed for 5 divine in Standard';
        if (!this.webMode) {
            console.log('\n📨 Sending test trade alert...');
        }
        await this.sendTradeAlert('TestTrader', testMessage);
    }

    processNewLines() {
        try {
            if (this.lastPosition === null) return;

            const stats = fs.statSync(this.logPath);
            
            if (stats.size < this.lastPosition) {
                console.log('File was truncated or replaced, starting from beginning');
                this.lastPosition = 0;
            }

            if (stats.size > this.lastPosition) {
                const buffer = Buffer.alloc(stats.size - this.lastPosition);
                const fd = fs.openSync(this.logPath, 'r');
                fs.readSync(fd, buffer, 0, buffer.length, this.lastPosition);
                fs.closeSync(fd);
                
                const newContent = buffer.toString('utf8');
                this.lastPosition = stats.size;
                this.stats.totalBytesRead += buffer.length;

                // Updated trade message regex to handle more variations
                const tradeRegex = /\[INFO Client \d+\] @From ([^:]+): (?:(?:Hi,? )?(?:I would like to |I want to |I'd like to )?(?:buy|purchase|wtb|wtt for|trade for)|(?:wtb|wts|wtt)|(?:buy|buying)) .+? (?:(?:listed for|price|for) .+? in \w+|\d+(?:\.\d+)? \w+ in \w+)(?:\s*\(stash tab.*?\)|$)/i;
                const lines = newContent.split('\n');
                this.stats.totalLinesProcessed += lines.length;

                for (const line of lines) {
                    const match = line.match(tradeRegex);
                    if (match) {
                        this.stats.tradeMessagesFound++;
                        this.stats.players.add(match[1]);
                        
                        // Send trade alert to bot server
                        this.sendTradeAlert(match[1], line.trim());
                    }
                }
            }
        } catch (error) {
            console.error('Error processing log file:', error);
            console.error('Full path:', path.resolve(this.logPath));
        }
    }

    stop() {
        if (this.watcher) {
            this.watcher.close();
        }
    }
}

module.exports = LogMonitor; 