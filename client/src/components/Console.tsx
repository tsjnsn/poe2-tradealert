import { Component, createSignal, onMount } from 'solid-js';
import Neutralino from '@neutralinojs/lib';

interface ConsoleMessage {
  text: string;
  type?: 'default' | 'error' | 'success' | 'info' | 'trade' | 'system';
}

// Create the signal outside the component to make it accessible
const [isExpanded, setIsExpanded] = createSignal(false);
export { isExpanded }; // Export the signal

export const Console: Component = () => {
  const [messages, setMessages] = createSignal<ConsoleMessage[]>([
    { text: 'Welcome to POE2 Trade Monitor', type: 'info' },
    { text: 'Type /help for available commands', type: 'info' }
  ]);
  const [command, setCommand] = createSignal('');

  const toggleConsole = () => {
    setIsExpanded(!isExpanded());
  };

  const handleTestMessage = () => {
    const message = 'Hi, I would like to buy your Test Item listed for 5 divine in Standard';
    
    Neutralino.events.broadcast('trade-alert', {
      player: 'TestTrader',
      message: message
    });
    addMessage({ text: 'Test trade alert sent.', type: 'system' });
  };

  const handleCommandInput = async (e: KeyboardEvent) => {
    if (e.key === 'Enter' && command().trim()) {
      const cmd = command().trim();
      
      if (cmd === '/help') {
        addMessage({ text: 'Available commands:', type: 'info' });
        addMessage({ text: '/help - Show this help message', type: 'info' });
        addMessage({ text: '/clear - Clear console', type: 'info' });
        addMessage({ text: '/test-message - Send a test trade message', type: 'info' });
      } else if (cmd === '/clear') {
        setMessages([]);
      } else if (cmd === '/test-message') {
        handleTestMessage();
      } else {
        addMessage({ text: 'Unknown command. Type /help for available commands.', type: 'error' });
      }
      
      setCommand('');
    }
  };

  const addMessage = (message: ConsoleMessage) => {
    const formattedMessage = {
      ...message,
      text: `[${new Date().toLocaleTimeString()}] ${message.text}`
    };
    setMessages(prev => [...prev, formattedMessage]);
    if (message.type === 'system') {
      Neutralino.debug.log(message.text, 'INFO');
    }
  };

  // Expose the addMessage function to the window for external use
  onMount(() => {
    (window as any).consoleAddMessage = addMessage;

    // Listen for console messages from Neutralino
    Neutralino.events.on('console-message', ({ detail }) => {
      addMessage({ text: detail.message, type: 'system' });
    });
  });

  return (
    <div class="fixed bottom-0 left-0 right-0 bg-[#0f1420] border-t border-gray-800 transition-transform duration-300" 
      style={{ transform: isExpanded() ? 'translateY(0)' : 'translateY(calc(100% - 40px))' }}>
      <div class="container mx-auto max-w-3xl">
        <div class="flex items-center justify-between px-4 py-2 border-b border-gray-800 cursor-pointer" onClick={toggleConsole}>
          <h3 class="text-gray-300 font-medium">Console</h3>
          <button class="text-gray-400 hover:text-gray-300 transition-colors">
            <svg
              class="w-4 h-4"
              style={{ transform: isExpanded() ? 'rotate(180deg)' : 'rotate(0deg)' }}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clip-rule="evenodd"
              />
            </svg>
          </button>
        </div>
        <div
          id="console-container"
          class="h-[300px]"
        >
          <div
            id="console"
            class="text-gray-300 p-4 h-[240px] overflow-y-auto font-mono text-sm"
          >
            {messages().map((msg, index) => (
              <div
                class={`py-1 px-2 rounded ${
                  msg.type === 'error'
                    ? 'text-red-400'
                    : msg.type === 'success'
                    ? 'text-green-400'
                    : msg.type === 'info'
                    ? 'text-gray-500'
                    : msg.type === 'trade'
                    ? 'bg-blue-900/30'
                    : msg.type === 'system'
                    ? 'text-gray-500 italic'
                    : 'text-gray-300'
                }`}
              >
                {msg.text}
              </div>
            ))}
          </div>
          <div class="p-4 pt-0">
            <input
              type="text"
              value={command()}
              onInput={(e) => setCommand(e.currentTarget.value)}
              onKeyDown={handleCommandInput}
              placeholder="Enter command..."
              class="w-full px-4 py-2 bg-[#1a1f2e] text-gray-300 rounded-md border border-gray-800 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>
        </div>
      </div>
    </div>
  );
}; 
