import Neutralino from '@neutralinojs/lib';

class ConfigManager {
    constructor() {
        this.config = {};
        this.defaults = {};
        this.configPath = '';
        this.isInitialized = false;
        
        const basePath = window.NL_PATH || './';
        this.configPath = `${basePath.replace(/\\/g, '/')}/config.json`;
    }

    async load() {
        this.defaults = await getDefaultConfig();
        try {
            await Neutralino.filesystem.getStats(this.configPath);
            const fileContent = await Neutralino.filesystem.readFile(this.configPath);
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
            
            // Ensure the directory exists, create if it doesn't
            try {
                await Neutralino.filesystem.createDirectory(configDir, { recursive: true });
            } catch (dirError) {
                if (dirError.code !== 'NE_FS_DIRCRER') { // Ignore if directory already exists
                    throw dirError;
                }
            }
            
            await Neutralino.filesystem.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
            await Neutralino.events.broadcast('configChanged', this.config);
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
                // Create a deep copy of the default value before setting it
                const clonedValue = JSON.parse(JSON.stringify(defaultValue));
                this.set(key, clonedValue);
                return clonedValue;
            }
        }
        return value;
    }

    mergeSet(key, value) {
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
        console.log('Resetting config to defaults...');
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
        const parts = await Neutralino.filesystem.getPathParts(this.config.poe2.logPath);
        if(!parts.isFile) {
            throw new Error('POE2 log path must be a file');
        }
    }
}

async function getDefaultConfig() {
    const osInfo = await Neutralino.computer.getOSInfo();
    const isWindows = osInfo.name === 'Windows';

    const poe2LogPath = isWindows ? 
        'C:\\Program Files (x86)\\Grinding Gear Games\\Path of Exile 2\\logs\\Client.txt' :
        '/mnt/c/Program Files (x86)/Grinding Gear Games/Path of Exile 2/logs/Client.txt';

    return {
        discord: {
            clientId: '1333582185478885489',
            botServerUrl: 'http://localhost:5050'
        },
        poe2: {
            logPath: poe2LogPath
        },
        server: {
            clientPort: 1240,
            host: 'localhost'
        }
    };
}

export default ConfigManager;