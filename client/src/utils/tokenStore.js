import { Neutralino } from '@neutralinojs/lib';
import { resolvePath } from './paths';

class TokenStore {
    constructor() {
        this.configPath = null;
        this.tokenPath = null;
        this.encryptionKey = null;
        this.init();
    }

    async init() {
        this.configPath = await Neutralino.filesystem.getPath('config');
        this.tokenPath = await Neutralino.filesystem.join(this.configPath, 'discord_tokens.json');
        this.encryptionKey = await this.getEncryptionKey();
        
        // Ensure config directory exists
        try {
            await Neutralino.filesystem.readDirectory(this.configPath);
        } catch {
            await Neutralino.filesystem.createDirectory(this.configPath);
        }
    }

    // Get or create a stable encryption key
    async getEncryptionKey() {
        const keyPath = await Neutralino.filesystem.join(this.configPath, '.key');
        try {
            const exists = await Neutralino.filesystem.getStats(keyPath);
            if (exists) {
                return await Neutralino.filesystem.readFile(keyPath);
            } else {
                const key = await Neutralino.crypto.generateKey();
                await Neutralino.filesystem.writeFile(keyPath, key);
                return key;
            }
        } catch (error) {
            console.error('Error managing encryption key:', error);
            return null;
        }
    }

    // Encrypt data
    async encrypt(text) {
        if (!this.encryptionKey) return text;
        try {
            const encrypted = await Neutralino.crypto.encrypt(text, this.encryptionKey);
            return encrypted;
        } catch (error) {
            console.error('Encryption error:', error);
            return text;
        }
    }

    // Decrypt data
    async decrypt(text) {
        if (!this.encryptionKey) return text;
        try {
            const decrypted = await Neutralino.crypto.decrypt(text, this.encryptionKey);
            return decrypted;
        } catch (error) {
            console.error('Decryption error:', error);
            return text;
        }
    }

    // Load tokens from disk
    async loadTokens() {
        try {
            const exists = await Neutralino.filesystem.getStats(this.tokenPath);
            if (!exists) {
                return null;
            }
            const encrypted = await Neutralino.filesystem.readFile(this.tokenPath);
            const decrypted = await this.decrypt(encrypted);
            return JSON.parse(decrypted);
        } catch (error) {
            console.error('Error loading tokens:', error);
            return null;
        }
    }

    // Save tokens to disk
    async saveTokens(tokens) {
        try {
            const data = JSON.stringify(tokens);
            const encrypted = await this.encrypt(data);
            await Neutralino.filesystem.writeFile(this.tokenPath, encrypted);
            return true;
        } catch (error) {
            console.error('Error saving tokens:', error);
            return false;
        }
    }

    // Clear stored tokens
    async clearTokens() {
        try {
            const exists = await Neutralino.filesystem.getStats(this.tokenPath);
            if (exists) {
                await Neutralino.filesystem.removeFile(this.tokenPath);
            }
            return true;
        } catch (error) {
            console.error('Error clearing tokens:', error);
            return false;
        }
    }
}

export default new TokenStore();
