const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function isWSL() {
    try {
        const release = fs.readFileSync('/proc/version', 'utf8').toLowerCase();
        return release.includes('microsoft') || release.includes('wsl');
    } catch {
        return false;
    }
}

function convertWindowsPathToWSL(windowsPath) {
    try {
        // Remove quotes if present
        windowsPath = windowsPath.replace(/^"(.*)"$/, '$1');
        
        // Convert backslashes to forward slashes
        windowsPath = windowsPath.replace(/\\/g, '/');
        
        // Convert C: to /mnt/c
        windowsPath = windowsPath.replace(/^([A-Za-z]):/, (_, drive) => `/mnt/${drive.toLowerCase()}`);
        
        // For more complex paths, use wslpath
        try {
            return execSync(`wslpath "${windowsPath}"`, { encoding: 'utf8' }).trim();
        } catch {
            return windowsPath;
        }
    } catch (error) {
        return windowsPath;
    }
}

function resolvePath(inputPath) {
    if (!inputPath) return inputPath;

    // Replace environment variables
    inputPath = inputPath.replace(/%([^%]+)%/g, (_, n) => process.env[n] || '');
    inputPath = inputPath.replace(/~/, process.env.HOME || '');

    // Convert to absolute path
    inputPath = path.resolve(inputPath);

    // Convert to WSL path if needed
    if (isWSL() && /^[A-Za-z]:\\/.test(inputPath)) {
        return convertWindowsPathToWSL(inputPath);
    }

    return inputPath;
}

module.exports = { resolvePath }; 