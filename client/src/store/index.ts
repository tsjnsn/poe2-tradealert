import { createStore } from 'solid-js/store';
import { LogMonitor } from '../services/LogMonitor';
import { Auth } from '../utils/auth';
import ConfigManager from '../utils/config-manager';

interface AppState {
  monitor: LogMonitor | null;
  configManager: ConfigManager | null;
  auth: Auth | null;
  stats: {
    uptime: string;
    linesProcessed: number;
    tradeMessages: number;
    uniquePlayers: number;
  };
  isInitialized: boolean;
}

const initialState: AppState = {
  monitor: null,
  configManager: null,
  auth: null,
  stats: {
    uptime: '00:00:00',
    linesProcessed: 0,
    tradeMessages: 0,
    uniquePlayers: 0
  },
  isInitialized: false
};

export const [state, setState] = createStore(initialState);

export const updateStats = () => {
  if (!state.monitor) return;

  const stats = state.monitor.stats;
  const uptime = Math.floor((new Date().getTime() - stats.startTime.getTime()) / 1000);
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = uptime % 60;

  setState('stats', {
    uptime: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`,
    linesProcessed: stats.totalLinesProcessed,
    tradeMessages: stats.tradeMessagesFound,
    uniquePlayers: stats.players.size
  });
}; 