export class WebConsole {
    constructor(elementId = 'console') {
        this.consoleElement = document.getElementById(elementId);
        this.contentElement = document.getElementById('console-container');
        this.isVisible = false; // Start closed
        this.contentElement.style.display = 'none'; // Initially hide the content
        this.consoleElement.classList.add('collapsed'); // Add collapsed state
    }

    toggle() {
        this.isVisible = !this.isVisible;
        this.contentElement.style.display = this.isVisible ? 'block' : 'none';
        if (this.isVisible) {
            this.consoleElement.classList.remove('collapsed');
        } else {
            this.consoleElement.classList.add('collapsed');
        }
    }

    addMessage(text, type = 'system') {
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
        this.contentElement.appendChild(message);
        this.contentElement.scrollTop = this.contentElement.scrollHeight;
    }

    clear() {
        this.contentElement.innerHTML = '';
    }

    async handleCommand(command, monitor, configManager) {
        if (command === '/help') {
            const commands = {
                '/help': 'Show available commands',
                '/test-message': 'Send a test trade message',
                '/clear': 'Clear the console'
            };
            
            Object.entries(commands).forEach(([cmd, desc]) => {
                this.addMessage(`${cmd}: ${desc}`);
            });
            return;
        }
        
        if (command === '/clear') {
            this.clear();
            return;
        }
        
        if (command.startsWith('/test-message')) {
            if (!monitor.isConnected()) {
                this.addMessage('Not connected to Discord. Please authenticate first.', 'error');
                return;
            }
            
            const match = command.match(/^\/test-message\s*"([^"]+)"/);
            const message = match ? match[1] : 'Hi, I would like to buy your Test Item listed for 5 divine in Standard';
            
            monitor.sendTradeAlert('TestTrader', message);
            this.addMessage('Test trade alert sent.', 'system');
            return;
        }
        
        this.addMessage('Unknown command. Type /help for available commands.', 'error');
    }
} 