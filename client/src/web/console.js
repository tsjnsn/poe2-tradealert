import Neutralino from '@neutralinojs/lib';

export class WebConsole {
    constructor(configManager) {
        this.configManager = configManager;
        this.consoleElement = document.getElementById('console');
        this.contentElement = document.getElementById('console-container');
        this.textArea = document.getElementById('console');
        this.isVisible = false; // Start closed
        this.contentElement.style.display = 'none'; // Initially hide the content
        this.consoleElement.classList.add('collapsed'); // Add collapsed state

        // Add event listener for console messages
        Neutralino.events.on('console-message', (ev) => {
            this.addMessage(ev.detail.message, 'system');
        });
    }

    toggle() {
        this.isVisible = !this.isVisible;
        this.contentElement.style.display = this.isVisible ? 'block' : 'none';
        if (this.isVisible) {
            this.consoleElement.classList.remove('collapsed');
        } else {
            this.consoleElement.classList.add('collapsed');
        }

        const toggleIcon = document.getElementById('console-toggle');
        toggleIcon.classList.toggle('rotate-180');
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
        this.textArea.appendChild(message);
        this.textArea.scrollTop = this.textArea.scrollHeight;
    }

    clear() {
        this.textArea.innerHTML = '';
    }

    async handleCommand(command) {
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
            const match = command.match(/^\/test-message\s*"([^"]+)"/);
            const message = match ? match[1] : 'Hi, I would like to buy your Test Item listed for 5 divine in Standard';
            
            Neutralino.events.broadcast('trade-alert', {
                player: 'TestTrader',
                message: message
            });
            this.addMessage('Test trade alert sent.', 'system');
            return;
        }
        
        this.addMessage('Unknown command. Type /help for available commands.', 'error');
    }
} 