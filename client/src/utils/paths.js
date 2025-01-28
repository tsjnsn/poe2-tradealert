const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function isWSL() {
    try {
        // First check if we're on Windows
        if (process.platform === 'win32') {
            return false;
        }

        // Only check /proc/version if we're on Linux
        if (process.platform === 'linux') {
            const release = fs.readFileSync('/proc/version', 'utf8').toLowerCase();
            return release.includes('microsoft') || release.includes('wsl');
        }

        return false;
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
        
        // Use wslpath for conversion only if we're actually in WSL
        if (isWSL()) {
            try {
                return execSync(`wslpath -a "${normalizedPath}"`, { encoding: 'utf8' }).trim();
            } catch (error) {
                console.error('Error using wslpath:', error);
                // Fallback: manual conversion
                return normalizedPath.replace(/^([A-Za-z]):/, (_, drive) => `/mnt/${drive.toLowerCase()}`);
            }
        }

        // If we're on Windows, keep the Windows path
        return windowsPath;
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
    inputPath = inputPath.replace(/~/, process.env.HOME || process.env.USERPROFILE || '');

    // If we're in WSL and this is a Windows path, convert it
    // Only do WSL conversion if we're actually in WSL
    if (isWSL() && isWindowsPath(inputPath)) {
        console.log('Converting Windows path to WSL:', inputPath);
        const wslPath = convertWindowsPathToWSL(inputPath);
        console.log('Converted path:', wslPath);
        return wslPath;
    }

    // For Windows paths on Windows, ensure proper backslash usage
    if (process.platform === 'win32' && isWindowsPath(inputPath)) {
        return path.win32.normalize(inputPath);
    }

    // For non-Windows paths or when not in WSL, just normalize using the appropriate separator
    return path.normalize(inputPath);
}

module.exports = { resolvePath, isWSL, isWindowsPath }; 