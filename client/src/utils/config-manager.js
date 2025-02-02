import { filesystem, events } from '@neutralinojs/lib';

class ConfigManager {
    constructor() {
        if (!window.NL_PATH) {
            throw new Error('Neutralino environment not initialized');
        }
        
        // Normalize path separators for cross-platform compatibility
        this.configPath = `${window.NL_PATH.replace(/\\/g, '/')}/config.json`;
        
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

    async load() {
        try {
            await filesystem.getStats(this.configPath);
            const fileContent = await filesystem.readFile(this.configPath);
            const loadedConfig = JSON.parse(fileContent);
            this.config = this.deepMerge(this.defaults, loadedConfig);
        } catch (error) {
            if(error.code === 'NE_FS_NOPATHE') {
                console.log('Creating new config with defaults...');
                this.config = { ...this.defaults };
                await this.save();
            }
            console.error('Error loading config:', error);
            console.log('Using default configuration...');
            this.config = { ...this.defaults };
            await this.save();
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

    async save() {
        try {
            const configDir = this.configPath.substring(0, this.configPath.lastIndexOf('/'));
            
            await filesystem.createDirectory(configDir, { recursive: true });
            
            await filesystem.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
            await events.broadcast('configChanged', this.config);
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

    async validatePaths() {
        const parts = await filesystem.getPathParts(this.config.poe2.logPath);
        if(!parts.isFile) {
            throw new Error('POE2 log path must be a file');
        }
    }
}

export default new ConfigManager();