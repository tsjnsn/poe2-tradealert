declare module '../services/LogMonitor' {
  interface LogMonitorStats {
    startTime: Date;
    totalLinesProcessed: number;
    tradeMessagesFound: number;
    players: Set<string>;
  }

  export class LogMonitor {
    constructor(configManager: ConfigManager, auth: Auth);
    stats: LogMonitorStats;
    start(): void;
    stop(): void;
    restart(config: any): void;
  }
}

declare module '../utils/config-manager' {
  export default class ConfigManager {
    constructor();
    load(): Promise<void>;
    get(key: string): any;
    set(key: string, value: any): void;
    getAll(): Record<string, any>;
    reset(): void;
    validate(): boolean;
    validatePaths(): Promise<void>;
  }
}

declare module '../utils/auth' {
  interface AuthTokens {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }

  interface AuthData {
    tokens: AuthTokens;
    user?: {
      id: string;
      username: string;
      discriminator: string;
      avatar?: string;
    };
  }

  export class Auth {
    constructor(configManager: ConfigManager);
    loadAuthData(): Promise<void>;
    getAuthData(): Promise<AuthData | null>;
    saveAuthData(data: AuthData | null): Promise<void>;
  }
} 