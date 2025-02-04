interface ConsoleMessage {
  text: string;
  type?: 'default' | 'error' | 'success' | 'info';
}

interface NeutralinoEvent<T = any> {
  detail: T;
}

declare global {
  interface Window {
    consoleAddMessage?: (message: ConsoleMessage) => void;
    handleCommand?: (command: string) => void;
    updateAuthStatus?: (status: boolean) => void;
    NL_TOKEN?: string;
  }

  // Neutralino events
  interface NeutralinoEvents {
    on(event: string, callback: (event: NeutralinoEvent) => void): void;
    broadcast(event: string, data?: any): void;
    exit(): Promise<void>;
  }

  // Neutralino storage
  interface NeutralinoStorage {
    setData(key: string, data: any): Promise<void>;
    getData(key: string): Promise<any>;
  }

  // Neutralino OS
  interface NeutralinoOS {
    open(url: string): Promise<void>;
  }

  // Main Neutralino namespace
  interface Neutralino {
    init(): Promise<void>;
    events: NeutralinoEvents;
    storage: NeutralinoStorage;
    os: NeutralinoOS;
  }

  declare const Neutralino: Neutralino;
} 