import Neutralino from '@neutralinojs/lib';

const AUTH_STORAGE_KEY = 'discord_auth';

export class Auth {
    constructor(configManager) {
        this.configManager = configManager;
        this.authData = null;
        Neutralino.events.on('auth-callback', async (ev) => {
            console.log('Authentication callback received:', ev);
            console.log('Authentication callback detail:', ev.detail);
            Neutralino.events.broadcast('console-message', `Received Discord auth details for ${JSON.stringify(ev.detail.user.global_name)}`);
            if (ev.detail.tokens) {
                await this.saveAuthData(ev.detail);
            } else {
                console.error('No access token received in authentication callback');
            }
        });
    }

    async saveAuthData(data) {
        try {
            this.authData = data;
            await Neutralino.storage.setData(AUTH_STORAGE_KEY, JSON.stringify(data));
        } catch (err) {
            console.error('Error saving discord details to storage:', err);
        }
    }

    async loadAuthData() {
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

    async getAuthData() {
        if (!this.authData) {
            await this.loadAuthData();
        }
        return this.authData;
    }
}
