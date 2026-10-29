import { flushPersistentStorage } from './persistentStorage';

const UPDATE_AVAILABLE_EVENT = 'progressappupdateavailable';

let registration = null;
let waitingWorker = null;
let updateAvailable = false;

const announceUpdateAvailable = (worker) => {
    if (!worker || !navigator.serviceWorker.controller) return;
    waitingWorker = worker;
    updateAvailable = true;
    window.dispatchEvent(new CustomEvent(UPDATE_AVAILABLE_EVENT));
};

const watchRegistration = (serviceWorkerRegistration) => {
    registration = serviceWorkerRegistration;
    announceUpdateAvailable(registration.waiting);
    registration.addEventListener('updatefound', () => {
        const installingWorker = registration.installing;
        if (!installingWorker) return;

        const handleStateChange = () => {
            if (installingWorker.state === 'installed') {
                announceUpdateAvailable(registration.waiting);
            }
        };
        installingWorker.addEventListener('statechange', handleStateChange);
        handleStateChange();
    });
};

const waitForInstall = (worker) => new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
        worker.removeEventListener('statechange', handleStateChange);
        reject(new Error('The update check timed out. Try again when you have a stable connection.'));
    }, 60000);

    const finish = (available) => {
        window.clearTimeout(timeout);
        worker.removeEventListener('statechange', handleStateChange);
        resolve(available);
    };

    const handleStateChange = () => {
        if (worker.state === 'installed') finish(Boolean(registration?.waiting));
        else if (worker.state === 'redundant') finish(false);
    };

    worker.addEventListener('statechange', handleStateChange);
    handleStateChange();
});

export const initializeAppUpdates = async () => {
    if (!('serviceWorker' in navigator)) return null;
    const serviceWorkerRegistration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    watchRegistration(serviceWorkerRegistration);
    return serviceWorkerRegistration;
};

export const checkForAppUpdate = async () => {
    if (!('serviceWorker' in navigator)) {
        throw new Error('This browser does not support app updates.');
    }

    registration = registration || await navigator.serviceWorker.getRegistration('/');
    if (!registration) {
        throw new Error('Update support is not ready yet. Reload the page and try again.');
    }

    await registration.update();
    let updateWorker = registration.waiting;
    if (!updateWorker && registration.installing) {
        await waitForInstall(registration.installing);
        updateWorker = registration.waiting;
    }

    if (updateWorker && navigator.serviceWorker.controller) {
        announceUpdateAvailable(updateWorker);
        return true;
    }
    return false;
};

export const hasAvailableAppUpdate = () => updateAvailable;

export const subscribeToAppUpdates = (callback) => {
    window.addEventListener(UPDATE_AVAILABLE_EVENT, callback);
    return () => window.removeEventListener(UPDATE_AVAILABLE_EVENT, callback);
};

export const applyAvailableAppUpdate = async () => {
    const worker = waitingWorker || registration?.waiting;
    if (!worker) throw new Error('No app update is waiting to be installed.');

    await flushPersistentStorage();
    const activated = new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => {
            worker.removeEventListener('statechange', handleStateChange);
            reject(new Error('The update could not be activated. Please try again.'));
        }, 20000);

        const handleStateChange = () => {
            if (worker.state === 'activated') {
                window.clearTimeout(timeout);
                worker.removeEventListener('statechange', handleStateChange);
                resolve();
            } else if (worker.state === 'redundant') {
                window.clearTimeout(timeout);
                worker.removeEventListener('statechange', handleStateChange);
                reject(new Error('The update was interrupted. Please try again.'));
            }
        };

        worker.addEventListener('statechange', handleStateChange);
        handleStateChange();
    });

    worker.postMessage({ type: 'SKIP_WAITING' });
    await activated;
    updateAvailable = false;
    waitingWorker = null;
    window.location.reload();
};
