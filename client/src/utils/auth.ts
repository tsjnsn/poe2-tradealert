import Neutralino from '@neutralinojs/lib';
import type ConfigManager from './config-manager';

const AUTH_STORAGE_KEY = 'discord_auth';

export interface AuthTokens {
    access_token: string;
    refresh_token: string;
    expires_in: number;
}

export interface DiscordUser {
    id: string;
    username: string;
    global_name?: string;
    discriminator: string;
    avatar?: string;
}

export interface AuthData {
    tokens: AuthTokens;
    user?: DiscordUser;
}

export class Auth {
    private configManager: ConfigManager;
    private authData: AuthData | null;

    constructor(configManager: ConfigManager) {
        this.configManager = configManager;
        this.authData = null;
        Neutralino.events.on('auth-callback', async (ev: { detail: AuthData }) => {
            Neutralino.debug.log('Authentication callback received: ' + JSON.stringify(ev), 'INFO');
            Neutralino.debug.log('Authentication callback detail: ' + JSON.stringify(ev.detail), 'INFO');
            Neutralino.events.broadcast('console-message', {
                message: `Received Discord auth details for ${ev.detail.user?.global_name ?? 'Unknown User'}`
            });
            if (ev.detail.tokens) {
                await this.saveAuthData(ev.detail);
            } else {
                const errorMessage = 'No access token received in authentication callback';
                Neutralino.debug.log(errorMessage, 'ERROR');
                window.consoleAddMessage?.({
                    text: errorMessage,
                    type: 'error'
                });
            }
        });
    }

    async saveAuthData(data: AuthData | null): Promise<void> {
        try {
            this.authData = data;
            if (data) {
                await Neutralino.storage.setData(AUTH_STORAGE_KEY, JSON.stringify(data));
                Neutralino.debug.log('Auth data saved successfully', 'INFO');
            } else {
                await Neutralino.storage.setData(AUTH_STORAGE_KEY, '');
                Neutralino.debug.log('Auth data cleared successfully', 'INFO');
            }
        } catch (err) {
            const errorMessage = `Error saving discord details to storage: ${err instanceof Error ? err.message : 'Unknown error'}`;
            Neutralino.debug.log(errorMessage, 'ERROR');
            window.consoleAddMessage?.({
                text: errorMessage,
                type: 'error'
            });
            throw err;
        }
    }

    async loadAuthData(): Promise<void> {
        try {
            if ((await Neutralino.storage.getKeys()).includes(AUTH_STORAGE_KEY)) {
                const authData = await Neutralino.storage.getData(AUTH_STORAGE_KEY);
                this.authData = JSON.parse(authData);
                Neutralino.debug.log('Auth data loaded successfully', 'INFO');
            } else {
                this.authData = null;
                Neutralino.debug.log('No discord details found in storage', 'WARN');
            }
        } catch (err) {
            const errorMessage = `Error getting discord details from storage: ${err instanceof Error ? err.message : 'Unknown error'}`;
            Neutralino.debug.log(errorMessage, 'ERROR');
            window.consoleAddMessage?.({
                text: errorMessage,
                type: 'error'
            });
            this.authData = null;
        }
    }

    async getAuthData(): Promise<AuthData | null> {
        if (!this.authData) {
            await this.loadAuthData();
        }
        return this.authData;
    }
}
