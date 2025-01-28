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

function isWindowsPath(inputPath) {
    return /^[A-Za-z]:\\/.test(inputPath) || /^"[A-Za-z]:\\/.test(inputPath);
}

function convertWindowsPathToWSL(windowsPath) {
    try {
        // Remove quotes if present
        windowsPath = windowsPath.replace(/^"(.*)"$/, '$1');
        
        // If it's not a Windows path, return as is
        if (!isWindowsPath(windowsPath)) {
            return windowsPath;
        }

        // Convert backslashes to forward slashes for wslpath
        const normalizedPath = windowsPath.replace(/\\/g, '/');
        
        // Use wslpath for conversion
        try {
            return execSync(`wslpath -a "${normalizedPath}"`, { encoding: 'utf8' }).trim();
        } catch (error) {
            console.error('Error using wslpath:', error);
            // Fallback: manual conversion
            return normalizedPath.replace(/^([A-Za-z]):/, (_, drive) => `/mnt/${drive.toLowerCase()}`);
        }
    } catch (error) {
        console.error('Error converting Windows path:', error);
        return windowsPath;
    }
}

function resolvePath(inputPath) {
    if (!inputPath) return inputPath;

    // Remove quotes
    inputPath = inputPath.replace(/^"(.*)"$/, '$1');

    // Replace environment variables
    inputPath = inputPath.replace(/%([^%]+)%/g, (_, n) => process.env[n] || '');
    inputPath = inputPath.replace(/~/, process.env.HOME || '');

    // If we're in WSL and this is a Windows path, convert it
    if (isWSL() && isWindowsPath(inputPath)) {
        console.log('Converting Windows path to WSL:', inputPath);
        const wslPath = convertWindowsPathToWSL(inputPath);
        console.log('Converted path:', wslPath);
        return wslPath;
    }

    // For non-Windows paths or when not in WSL, just normalize
    return path.normalize(inputPath);
}

module.exports = { resolvePath }; 