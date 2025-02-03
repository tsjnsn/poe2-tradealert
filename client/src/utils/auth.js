import Neutralino from '@neutralinojs/lib';

export class Auth {
    constructor(configManager) {
        this.configManager = configManager;
        Neutralino.events.on('auth-callback', (data) => {
            this.configManager.set('discord.accessToken', data.accessToken);
        });
    }
}
