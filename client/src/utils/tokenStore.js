const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { resolvePath } = require('./paths');

class TokenStore {
    constructor() {
        // Store tokens in user's config directory
        const configDir = process.env.APPDATA || 
            (process.platform === 'darwin' ? path.join(process.env.HOME, 'Library', 'Application Support') : 
            path.join(process.env.HOME, '.config'));
        
        this.configPath = path.join(configDir, 'poe2-tradealert');
        this.tokenPath = path.join(this.configPath, 'discord_tokens.json');
        this.encryptionKey = this.getEncryptionKey();
        
        // Ensure config directory exists
        if (!fs.existsSync(this.configPath)) {
            fs.mkdirSync(this.configPath, { recursive: true });
        }
    }

    // Get or create a stable encryption key
    getEncryptionKey() {
        const keyPath = path.join(this.configPath, '.key');
        try {
            if (fs.existsSync(keyPath)) {
                return fs.readFileSync(keyPath, 'utf8');
            } else {
                const key = crypto.randomBytes(32).toString('hex');
                fs.writeFileSync(keyPath, key, { mode: 0o600 });
                return key;
            }
        } catch (error) {
            console.error('Error managing encryption key:', error);
            return null;
        }
    }

    // Encrypt data
    encrypt(text) {
        if (!this.encryptionKey) return text;
        try {
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(this.encryptionKey, 'hex'), iv);
            let encrypted = cipher.update(text, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            return `${iv.toString('hex')}:${encrypted}`;
        } catch (error) {
            console.error('Encryption error:', error);
            return text;
        }
    }

    // Decrypt data
    decrypt(text) {
        if (!this.encryptionKey || !text.includes(':')) return text;
        try {
            const [ivHex, encrypted] = text.split(':');
            const iv = Buffer.from(ivHex, 'hex');
            const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(this.encryptionKey, 'hex'), iv);
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        } catch (error) {
            console.error('Decryption error:', error);
            return text;
        }
    }

    // Load tokens from disk
    loadTokens() {
        try {
            if (!fs.existsSync(this.tokenPath)) {
                return null;
            }
            const encrypted = fs.readFileSync(this.tokenPath, 'utf8');
            const decrypted = this.decrypt(encrypted);
            return JSON.parse(decrypted);
        } catch (error) {
            console.error('Error loading tokens:', error);
            return null;
        }
    }

    // Save tokens to disk
    saveTokens(tokens) {
        try {
            const data = JSON.stringify(tokens);
            const encrypted = this.encrypt(data);
            fs.writeFileSync(this.tokenPath, encrypted, { mode: 0o600 });
            return true;
        } catch (error) {
            console.error('Error saving tokens:', error);
            return false;
        }
    }

    // Clear stored tokens
    clearTokens() {
        try {
            if (fs.existsSync(this.tokenPath)) {
                fs.unlinkSync(this.tokenPath);
            }
            return true;
        } catch (error) {
            console.error('Error clearing tokens:', error);
            return false;
        }
    }
}

module.exports = new TokenStore(); 