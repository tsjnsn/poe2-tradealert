import Neutralino from '@neutralinojs/lib';
import { createAuthServer } from './authServer';

async function getAvailablePort() {
    return await Neutralino.os.getAvailablePort();
}

async function waitForCallback() {
    const port = await getAvailablePort();
    let resolveCallback;
    let server;

    const serverPromise = new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            if (server) {
                server.stop();
            }
            reject(new Error('Authentication timed out'));
        }, 5 * 60 * 1000); // 5 minutes timeout

        createAuthServer(port, resolveCallback, timeoutId)
            .then((s) => {
                server = s;
                resolve({ port });
            })
            .catch(reject);
    });

    // Return both the port and a Promise that will resolve with the tokens
    return {
        port,
        tokensPromise: new Promise((resolve) => {
            resolveCallback = resolve;
        })
    };
}

export { waitForCallback };
