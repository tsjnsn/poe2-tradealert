// Initialize Neutralino
import { init, events, filesystem, os } from '@neutralinojs/lib';
import { LogMonitor } from '../services/LogMonitor.js';
import ConfigManager from '../utils/config-manager.js';

let monitor;
let configManager;

// Initialize when the document is ready
events.on('ready', async () => {
    // Initialize config and monitor
    configManager = new ConfigManager();
    await configManager.load();
    
    monitor = new LogMonitor(configManager.get('poe2.logPath'), { webMode: false });
    
    // Set up event handlers
    setupEventHandlers();
    
    // Initialize the UI state
    updateStats();
    loadConfig();
    
    // Start monitoring
    monitor.start();
});

function setupEventHandlers() {
    // Handle trade events
    monitor.on('trade', (data) => {
        handleTradeEvent(data);
    });
    
    // Handle config changes
    configManager.on('configChanged', (config) => {
        handleConfigEvent(config);
    });
    
    // Handle window close
    events.on('windowClose', () => {
        monitor.stop();
        events.exit();
    });
}

function handleTradeEvent(data) {
    const { player, message, error } = data;
    const consoleEl = document.getElementById('console');
    
    let messageText = error 
        ? `Error: ${error}`
        : `Trade request from ${player}: ${message}`;
        
    addMessage(messageText, error ? 'error' : 'trade');
}

function handleConfigEvent(config) {
    updateConfigDisplay(config);
}

async function updateStats() {
    const stats = monitor.stats;
    const uptime = Math.floor((new Date() - stats.startTime) / 1000);
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = uptime % 60;
    
    document.getElementById('uptime').textContent = 
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    document.getElementById('lines').textContent = stats.totalLinesProcessed.toLocaleString();
    document.getElementById('trades').textContent = stats.tradeMessagesFound.toLocaleString();
    document.getElementById('players').textContent = stats.players.size.toLocaleString();
    
    const authStatus = document.getElementById('auth-status');
    if (monitor.isConnected()) {
        authStatus.classList.remove('bg-red-50', 'text-red-900');
        authStatus.classList.add('bg-green-50', 'text-green-900');
        authStatus.querySelector('span').textContent = '🟢 Connected to Discord';
        authStatus.querySelector('button').classList.add('hidden');
        authStatus.querySelector('button:last-child').classList.remove('hidden');
    } else {
        authStatus.classList.remove('bg-green-50', 'text-green-900');
        authStatus.classList.add('bg-red-50', 'text-red-900');
        authStatus.querySelector('span').textContent = '🔴 Not connected to Discord';
        authStatus.querySelector('button').classList.remove('hidden');
        authStatus.querySelector('button:last-child').classList.add('hidden');
    }
}

async function authenticate() {
    try {
        const botServerUrl = configManager.get('discord.botServerUrl');
        const response = await fetch(`${botServerUrl}/auth`);
        const data = await response.json();
        
        if (!data.url) {
            throw new Error('No auth URL in response');
        }
        
        // Open auth window
        Neutralino.window.create(data.url, {
            title: 'Discord Authentication',
            width: 600,
            height: 800
        });
    } catch (error) {
        addMessage('Error starting authentication: ' + error.message, 'error');
    }
}

async function logout() {
    monitor.clearAuth();
    addMessage('Logged out successfully', 'system');
}

async function handleCommand(command) {
    if (command === '/help') {
        const commands = {
            '/help': 'Show available commands',
            '/test-message': 'Send a test trade message',
            '/clear': 'Clear the console'
        };
        
        Object.entries(commands).forEach(([cmd, desc]) => {
            addMessage(`${cmd}: ${desc}`);
        });
        return;
    }
    
    if (command === '/clear') {
        document.getElementById('console').innerHTML = '';
        return;
    }
    
    if (command.startsWith('/test-message')) {
        if (!monitor.isConnected()) {
            addMessage('Not connected to Discord. Please authenticate first.', 'error');
            return;
        }
        
        const match = command.match(/^\/test-message\s*"([^"]+)"/);
        const message = match ? match[1] : 'Hi, I would like to buy your Test Item listed for 5 divine in Standard';
        
        monitor.sendTradeAlert('TestTrader', message);
        addMessage('Test trade alert sent.', 'system');
        return;
    }
    
    addMessage('Unknown command. Type /help for available commands.', 'error');
}

function addMessage(text, type = 'system') {
    const console = document.getElementById('console');
    const message = document.createElement('div');
    
    let classes = 'py-1 px-2 rounded';
    switch(type) {
        case 'trade':
            classes += ' bg-blue-900/30';
            break;
        case 'error':
            classes += ' text-red-400';
            break;
        case 'system':
            classes += ' text-gray-400 italic';
            break;
    }
    
    message.className = classes;
    message.textContent = text;
    console.appendChild(message);
    console.scrollTop = console.scrollHeight;
}

async function loadConfig() {
    const config = configManager.getAll();
    updateConfigDisplay(config);
}

async function updateConfigDisplay(config) {
    const configFields = document.getElementById('config-fields');
    configFields.innerHTML = '';
    
    function renderConfigSection(obj, prefix = '') {
        Object.entries(obj).forEach(([key, value]) => {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            
            if (typeof value === 'object' && value !== null) {
                renderConfigSection(value, fullKey);
                return;
            }
            
            const field = document.createElement('div');
            field.className = 'mb-4';
            field.innerHTML = `
                <label class="block text-sm font-medium text-gray-700 mb-1">${fullKey}</label>
                <input type="text" value="${value}" 
                    class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    onchange="updateConfig('${fullKey}', this.value)">
            `;
            configFields.appendChild(field);
        });
    }
    
    renderConfigSection(config);
}

async function updateConfig(key, value) {
    try {
        configManager.set(key, value);
        addMessage(`Updated ${key} = ${value}`, 'system');
    } catch (error) {
        addMessage(`Error updating config: ${error.message}`, 'error');
    }
}

async function resetConfig() {
    configManager.reset();
    loadConfig();
    addMessage('Configuration reset to defaults', 'system');
}

async function checkAuth() {
    try {
        const botServerUrl = configManager.get('discord.botServerUrl');
        const response = await Neutralino.net.fetch(`${botServerUrl}/auth/check`);
        const data = await response.json();
        
        if (data.authenticated) {
            const userResponse = await Neutralino.net.fetch(`${botServerUrl}/auth/user`);
            const userData = await userResponse.json();
            updateUserInfo(userData);
        } else {
            showLogin();
        }
    } catch (error) {
        addMessage('Error checking authentication: ' + error.message, 'error');
    }
}

// Update stats every second
setInterval(updateStats, 1000);

// Export functions used in HTML
Object.assign(window, {
    authenticate,
    logout,
    handleCommand,
    updateConfig,
    resetConfig
}); 