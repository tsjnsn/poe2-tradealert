import Neutralino from '@neutralinojs/lib';

const defaultBotServerUrl = import.meta.env.VITE_BOT_SERVER_URL || 'http://localhost:5050';
const defaultLogPathWindows = 'C:\\Program Files (x86)\\Grinding Gear Games\\Path of Exile 2\\logs\\Client.txt';
const defaultLogPathLinux = '/home/user/.local/share/Path of Exile 2/logs/Client.txt';
const defaultLogPathWSL = '/mnt/c/Program Files (x86)/Grinding Gear Games/Path of Exile 2/logs/Client.txt';
const defaultLogPathDarwin = '/Applications/Path of Exile 2/Contents/Resources/logs/Client.txt';

interface Config {
    discord: {
        botServerUrl: string;
    };
    poe2: {
        logPath: string;
    };
}

const fallbackConfig: Config = {
    discord: {
        botServerUrl: defaultBotServerUrl
    },
    poe2: {
        logPath: defaultLogPathWindows
    }
};

const getDefaultConfig = async (): Promise<Config> => ({
    discord: {
        botServerUrl: defaultBotServerUrl
    },
    poe2: {
        logPath: await (async () => {
            const osType = (await Neutralino.computer.getKernelInfo()).variant;
            if (osType === 'Windows') {
                return defaultLogPathWindows;
            } else if (osType === 'Darwin') {
                return defaultLogPathDarwin;
            } else { // assume WSL, sorry linux users
                return defaultLogPathWSL;
            }
        })()
    }
});

export default class ConfigManager {
    private config: Config;
    private configPath: string;
    private isInitialized: boolean;
    private defaultConfig: Config;
    
    constructor() {
        this.defaultConfig = fallbackConfig
        this.config = fallbackConfig;
        this.isInitialized = false;
        const basePath = window.NL_PATH || './';
        this.configPath = `${basePath.replace(/\\/g, '/')}/config.json`;
    }

    async load(): Promise<void> {
        this.defaultConfig = await getDefaultConfig();
        try {
            const stats = await Neutralino.filesystem.getStats(this.configPath);
            if(stats.isFile) {
                const fileContent = await Neutralino.filesystem.readFile(this.configPath);
                const loadedConfig = JSON.parse(fileContent);
                this.config = this.deepMerge(this.defaultConfig, loadedConfig);
            } else {
                this.config = { ...this.defaultConfig };
                await this.save();
            }
            this.isInitialized = true;
        } catch (error) {
            console.error('Error loading config:', error);
            console.log('Using default configuration...');
            this.config = { ...this.defaultConfig };
            await this.save();
            this.isInitialized = true;
        }
    }

    private deepMerge<T>(target: T, source: Partial<T>): T {
        const output = { ...target };
        if (this.isObject(target) && this.isObject(source)) {
            Object.keys(source).forEach(key => {
                const sourceValue = source[key as keyof typeof source];
                const targetValue = target[key as keyof typeof target];
                if (this.isObject(sourceValue) && key in target) {
                    output[key as keyof typeof output] = this.deepMerge(
                        targetValue,
                        sourceValue as any
                    );
                } else {
                    (output as Record<string, any>)[key] = sourceValue;
                }
            });
        }
        return output;
    }

    private isObject(item: any): item is Record<string, any> {
        return item && typeof item === 'object' && !Array.isArray(item);
    }

    async save(): Promise<void> {
        try {
            await Neutralino.filesystem.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
        } catch (error) {
            console.error('Error saving config:', error);
            throw error;
        }
    }

    get<K extends keyof Config>(key: K): Config[K];
    get<K extends keyof Config, SK extends keyof Config[K]>(key: K, subKey: SK): Config[K][SK];
    get(key: string, subKey?: string): any {
        if (!this.isInitialized) {
            throw new Error('ConfigManager not initialized. Call load() first.');
        }
        
        const parts = subKey ? [key, subKey] : key.split('.');
        let value: any = this.config;
        
        for (const part of parts) {
            if (value && typeof value === 'object' && part in value) {
                value = value[part];
            } else {
                return undefined;
            }
        }
        
        return value;
    }

    set(key: string, value: any): void {
        if (!this.isInitialized) {
            throw new Error('ConfigManager not initialized. Call load() first.');
        }
        
        const parts = key.split('.');
        let current: any = this.config;
        
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!(part in current)) {
                current[part] = {};
            }
            current = current[part];
        }
        
        current[parts[parts.length - 1]] = value;
    }

    getAll(): Config {
        if (!this.isInitialized) {
            throw new Error('ConfigManager not initialized. Call load() first.');
        }
        return { ...this.config };
    }

    reset(): void {
        this.config = { ...this.defaultConfig };
    }
} 