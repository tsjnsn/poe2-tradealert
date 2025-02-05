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
            console.log('Authentication callback received:', ev);
            console.log('Authentication callback detail:', ev.detail);
            Neutralino.events.broadcast('console-message', {
                message: `Received Discord auth details for ${ev.detail.user?.global_name ?? 'Unknown User'}`
            });
            if (ev.detail.tokens) {
                await this.saveAuthData(ev.detail);
            } else {
                console.error('No access token received in authentication callback');
            }
        });
    }

    async saveAuthData(data: AuthData | null): Promise<void> {
        try {
            this.authData = data;
            if (data) {
                await Neutralino.storage.setData(AUTH_STORAGE_KEY, JSON.stringify(data));
            } else {
                await Neutralino.storage.setData(AUTH_STORAGE_KEY, '');
            }
        } catch (err) {
            console.error('Error saving discord details to storage:', err);
            throw err;
        }
    }

    async loadAuthData(): Promise<void> {
        try {
            if ((await Neutralino.storage.getKeys()).includes(AUTH_STORAGE_KEY)) {
                const authData = await Neutralino.storage.getData(AUTH_STORAGE_KEY);
                this.authData = JSON.parse(authData);
            } else {
                this.authData = null;
                console.warn('No discord details found in storage');
            }
        } catch (err) {
            console.error('Error getting discord details from storage:', err);
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