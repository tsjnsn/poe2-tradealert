import Neutralino from '@neutralinojs/lib';
import { LogMonitor } from './LogMonitor';
import ConfigManager from '../utils/config-manager';
import { Auth } from '../utils/auth';
import { state, setState, updateStats } from '../store';

class AppInitializer {
  private static instance: AppInitializer;

  private constructor() {}

  public static getInstance(): AppInitializer {
    if (!AppInitializer.instance) {
      AppInitializer.instance = new AppInitializer();
    }
    return AppInitializer.instance;
  }

  public async initialize(): Promise<void> {
    try {
      console.log('Initializing application...');
      await this.setupNeutralino();
      await this.initializeServices();
      await this.setupEventHandlers();
      this.startMonitoring();
      setState('isInitialized', true);
      console.log('Application initialized successfully');
    } catch (error) {
      console.error('Error during initialization:', error);
      throw error;
    }
  }

  private async setupNeutralino(): Promise<void> {
    console.log('Setting up Neutralino...');
    await Neutralino.init();
    await Neutralino.storage.setData('ping', 'pong');
  }

  private async initializeServices(): Promise<void> {
    console.log('Initializing services...');
    
    // Initialize ConfigManager
    const configManager = new ConfigManager();
    await configManager.load();
    setState('configManager', configManager);

    // Initialize Auth
    const auth = new Auth(configManager);
    await auth.loadAuthData();
    setState('auth', auth);

    // Initialize LogMonitor
    const monitor = new LogMonitor(configManager, auth);
    setState('monitor', monitor);
  }

  private async setupEventHandlers(): Promise<void> {
    console.log('Setting up event handlers...');

    // Handle trade events
    Neutralino.events.on('trade', ({ detail: data }) => {
      this.handleTradeEvent(data);
    });

    // Handle config changes
    Neutralino.events.on('configChanged', ({ detail: config }) => {
      this.handleConfigEvent(config);
    });

    // Handle window close
    Neutralino.events.on('windowClose', async () => {
      if (state.monitor) {
        state.monitor.stop();
      }
      await Neutralino.events.exit();
    });

    // Handle auth refresh
    Neutralino.events.on('auth-refresh', async () => {
      await this.handleAuthRefresh();
    });

    // Start stats update interval
    setInterval(updateStats, 1000);
  }

  private async handleTradeEvent(data: { player: string; message: string; error?: string }): Promise<void> {
    const { player, message, error } = data;
    const messageText = error 
      ? `Error: ${error}`
      : `Trade request from ${player}: ${message}`;
    
    window.consoleAddMessage?.({
      text: messageText,
      type: error ? 'error' : 'default'
    });
  }

  private async handleConfigEvent(config: any): Promise<void> {
    console.log('Config event received:', config);
    if (state.monitor) {
      console.log('Restarting log monitor...');
      state.monitor.restart(config);
    }
  }

  private async handleAuthRefresh(): Promise<void> {
    if (!state.auth || !state.configManager) return;

    try {
      const botServerUrl = state.configManager.get('discord.botServerUrl');
      const authData = await state.auth.getAuthData();
      if (!authData?.tokens?.refresh_token) return;

      const response = await fetch(`${botServerUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refresh_token: authData.tokens.refresh_token })
      });

      const data = await response.json();
      if (data.tokens) {
        await state.auth.saveAuthData(data);
        window.consoleAddMessage?.({
          text: 'Authentication refreshed successfully',
          type: 'success'
        });
        Neutralino.events.broadcast('discord-tokens-refreshed');
      } else {
        window.consoleAddMessage?.({
          text: 'Failed to refresh authentication automatically - please re-authenticate',
          type: 'error'
        });
      }
    } catch (error) {
      if (state.auth) {
        await state.auth.saveAuthData(null);
      }
      window.consoleAddMessage?.({
        text: `Error refreshing authentication: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'error'
      });
    }
  }

  private startMonitoring(): void {
    console.log('Starting monitoring...');
    if (state.monitor) {
      state.monitor.start();
    }
  }
}

export const appInitializer = AppInitializer.getInstance(); 