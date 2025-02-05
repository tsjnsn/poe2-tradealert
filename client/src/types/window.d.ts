interface ConsoleMessage {
  text: string;
  type?: 'default' | 'error' | 'success' | 'info';
}

declare global {
  interface Window {
    consoleAddMessage: (message: ConsoleMessage) => void;
    handleCommand: (command: string) => void;
    updateAuthStatus: (status: boolean) => void;
    NL_TOKEN: string;
  }
} 