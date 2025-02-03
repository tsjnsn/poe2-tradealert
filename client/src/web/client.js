// Initialize Neutralino
import Neutralino from '@neutralinojs/lib';
import { LogMonitor } from '../services/LogMonitor.js';
import ConfigManager from '../utils/config-manager.js';
import { WebConsole } from './console.js';
import '../styles/style.css'
import { Auth } from '../utils/auth.js';

let monitor;
let configManager;
let webConsole;

Neutralino.events.on('configChanged', ({ detail: config }) => {
    console.log('Restarting log monitor...');
    monitor.restart(config)
    updateConfigDisplay(config);
});

// Initialize when the document is ready
Neutralino.events.on('ready', async () => {
    console.log('Application ready event received');
    
    try {
        // Initialize web console
        webConsole = new WebConsole('console');
        
        console.log('Initializing config manager...');
        configManager = new ConfigManager();
        await configManager.load();
        console.log('Config manager initialized successfully');
        
        // Initialize auth with configManager
        const auth = new Auth(configManager);
        
        console.log('Creating log monitor instance...');
        monitor = new LogMonitor(configManager);
        console.log('Log monitor created successfully');
        
        console.log('Setting up event handlers...');
        setupEventHandlers(monitor);
        console.log('Event handlers setup complete');
        
        console.log('Initializing UI state...');
        updateStats();
        loadConfig();
        console.log('UI state initialized');
        
        console.log('Starting log monitor...');
        monitor.start();
        console.log('Log monitor started successfully');
    } catch (error) {
        console.error('Error during initialization:', error);
        throw error;
    }
});

function setupEventHandlers(monitor) {
    // Handle trade Neutralino.events
    Neutralino.events.on('trade', ({ detail: data }) => {
        handleTradeEvent(data);
    });
    
    // Handle config changes
    Neutralino.events.on('configChanged', ({ detail: config }) => {
        handleConfigEvent(config);
    });
    
    // Handle window close
    Neutralino.events.on('windowClose', async () => {
        monitor.stop();
        await Neutralino.events.exit();
    });
}

function handleTradeEvent(data) {
    const { player, message, error } = data;
    let messageText = error 
        ? `Error: ${error}`
        : `Trade request from ${player}: ${message}`;
        
    webConsole.addMessage(messageText, error ? 'error' : 'trade');
}

function handleConfigEvent(config) {
    console.log('Config event received:', config);
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
        const response = await fetch(`${botServerUrl}/auth?redirect_uri=${window.location.origin}/auth.html`);
        const data = await response.json();
        
        if (!data.url) {
            throw new Error('No auth URL in response');
        }
        
        try {
            // Open auth window
            await Neutralino.os.open(data.url);
        } catch (windowError) {
            throw new Error(`Failed to open authentication window: ${windowError.message}`);
        }
    } catch (error) {
        webConsole.addMessage('Error starting authentication: ' + error.message, 'error');
    }
}

async function logout() {
    monitor.clearAuth();
    webConsole.addMessage('Logged out successfully', 'system');
}

async function handleCommand(command) {
    await webConsole.handleCommand(command, monitor, configManager);
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
        webConsole.addMessage(`Updated ${key} = ${value}`, 'system');
    } catch (error) {
        webConsole.addMessage(`Error updating config: ${error.message}`, 'error');
    }
}

async function resetConfig() {
    configManager.reset();
    loadConfig();
    webConsole.addMessage('Configuration reset to defaults', 'system');
}

async function checkAuth() {
    try {
        const botServerUrl = configManager.get('discord.botServerUrl');
        const response = await fetch(`${botServerUrl}/auth/check`);
        const data = await response.json();
        
        if (data.authenticated) {
            const userResponse = await fetch(`${botServerUrl}/auth/user`);
            const userData = await userResponse.json();
            updateUserInfo(userData);
        } else {
            showLogin();
        }
    } catch (error) {
        webConsole.addMessage('Error checking authentication: ' + error.message, 'error');
    }
}

function toggleConsole() {
    if (webConsole) {
        webConsole.toggle();
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
    resetConfig,
    toggleConsole
});
