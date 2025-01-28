const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class ConfigManager extends EventEmitter {
    constructor() {
        super();
        this.configPath = path.join(process.cwd(), 'config.json');
        this.defaults = {
            discord: {
                clientId: '1333582185478885489',
                botServerUrl: 'http://localhost:5050'
            },
            poe2: {
                logPath: 'C:\\Program Files (x86)\\Grinding Gear Games\\Path of Exile 2\\logs\\Client.txt'
            },
            server: {
                clientPort: 3000,
                host: 'localhost'
            },
            debug: {
                enabled: false,
                logLevel: 'info'
            }
        };
        this.config = null;
        this.load();
    }

    load() {
        try {
            if (fs.existsSync(this.configPath)) {
                const fileContent = fs.readFileSync(this.configPath, 'utf8');
                const loadedConfig = JSON.parse(fileContent);
                // Deep merge with defaults to ensure all required fields exist
                this.config = this.deepMerge(this.defaults, loadedConfig);
            } else {
                console.log('No config file found, creating with defaults...');
                this.config = { ...this.defaults };
                this.save();
            }
        } catch (error) {
            console.error('Error loading config:', error);
            console.log('Using default configuration...');
            this.config = { ...this.defaults };
            this.save();
        }
    }

    deepMerge(target, source) {
        const output = { ...target };
        if (this.isObject(target) && this.isObject(source)) {
            Object.keys(source).forEach(key => {
                if (this.isObject(source[key])) {
                    if (!(key in target)) {
                        Object.assign(output, { [key]: source[key] });
                    } else {
                        output[key] = this.deepMerge(target[key], source[key]);
                    }
                } else {
                    Object.assign(output, { [key]: source[key] });
                }
            });
        }
        return output;
    }

    isObject(item) {
        return item && typeof item === 'object' && !Array.isArray(item);
    }

    save() {
        try {
            const configDir = path.dirname(this.configPath);
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
            this.emit('configChanged', this.config);
        } catch (error) {
            console.error('Error saving config:', error);
            throw new Error(`Failed to save config: ${error.message}`);
        }
    }

    get(key) {
        const value = key.split('.').reduce((obj, k) => obj && obj[k], this.config);
        if (value === undefined) {
            const defaultValue = key.split('.').reduce((obj, k) => obj && obj[k], this.defaults);
            if (defaultValue !== undefined) {
                this.set(key, defaultValue);
                return defaultValue;
            }
        }
        return value;
    }

    set(key, value) {
        const keys = key.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((obj, k) => {
            if (!(k in obj)) obj[k] = {};
            return obj[k];
        }, this.config);
        
        if (target[lastKey] !== value) {
            target[lastKey] = value;
            this.save();
        }
    }

    getAll() {
        return { ...this.config };
    }

    reset() {
        this.config = { ...this.defaults };
        this.save();
    }

    validate() {
        const required = [
            'discord.clientId',
            'discord.botServerUrl',
            'poe2.logPath',
            'server.clientPort'
        ];

        const missing = required.filter(key => !this.get(key));
        if (missing.length > 0) {
            throw new Error(`Missing required config values: ${missing.join(', ')}`);
        }

        return true;
    }
}

module.exports = new ConfigManager(); 