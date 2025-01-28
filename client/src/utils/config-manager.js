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
                clientPort: 3000
            },
            debug: {
                enabled: false
            }
        };
        this.config = null;
        this.load();
    }

    load() {
        try {
            if (fs.existsSync(this.configPath)) {
                const fileContent = fs.readFileSync(this.configPath, 'utf8');
                this.config = JSON.parse(fileContent);
            } else {
                this.config = { ...this.defaults };
                this.save();
            }
        } catch (error) {
            console.error('Error loading config:', error);
            this.config = { ...this.defaults };
            this.save();
        }
    }

    save() {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
            this.emit('configChanged', this.config);
        } catch (error) {
            console.error('Error saving config:', error);
        }
    }

    get(key) {
        return key.split('.').reduce((obj, k) => obj && obj[k], this.config);
    }

    set(key, value) {
        const keys = key.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((obj, k) => {
            if (!(k in obj)) obj[k] = {};
            return obj[k];
        }, this.config);
        target[lastKey] = value;
        this.save();
    }

    getAll() {
        return { ...this.config };
    }

    reset() {
        this.config = { ...this.defaults };
        this.save();
    }
}

module.exports = new ConfigManager(); 