import Neutralino from 'neutralino';

function isWSL() {
    return Neutralino.os.getEnv('WSL_DISTRO_NAME') !== null;
}

function isWindowsPath(path) {
    return /^[a-zA-Z]:[\\/]/.test(path);
}

function convertWindowsPathToWSL(windowsPath) {
    // Convert C:\path\to\file to /mnt/c/path/to/file
    const driveLetter = windowsPath[0].toLowerCase();
    const unixPath = windowsPath.slice(3).replace(/\\/g, '/');
    return `/mnt/${driveLetter}${unixPath}`;
}

function resolvePath(inputPath) {
    if (!inputPath) return inputPath;

    // Remove quotes
    inputPath = inputPath.replace(/^"(.*)"$/, '$1');

    // Replace environment variables
    inputPath = inputPath.replace(/%([^%]+)%/g, (_, n) => Neutralino.os.getEnv(n) || '');
    inputPath = inputPath.replace(/~/, Neutralino.os.getEnv('HOME') || Neutralino.os.getEnv('USERPROFILE') || '');

    // If we're in WSL and this is a Windows path, convert it
    // Only do WSL conversion if we're actually in WSL
    if (isWSL() && isWindowsPath(inputPath)) {
        console.log('Converting Windows path to WSL:', inputPath);
        const wslPath = convertWindowsPathToWSL(inputPath);
        console.log('Converted path:', wslPath);
        return wslPath;
    }

    // For Windows paths on Windows, ensure proper backslash usage
    if (Neutralino.os.getPlatform() === 'win32' && isWindowsPath(inputPath)) {
        return Neutralino.filesystem.normalize(inputPath);
    }

    // For non-Windows paths or when not in WSL, just normalize using the appropriate separator
    return Neutralino.filesystem.normalize(inputPath);
}

export { resolvePath, isWSL, isWindowsPath }; 