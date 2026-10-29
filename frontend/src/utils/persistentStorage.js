const DATABASE_NAME = 'progress-workspace';
const DATABASE_VERSION = 1;
const STORE_NAME = 'entries';
const APP_QUOTA_BYTES = 100 * 1024 * 1024;
const LOCAL_STORAGE_QUOTA_BYTES = 5 * 1024 * 1024;
const STORAGE_CHANGE_EVENT = 'progress-storage-change';
const STORAGE_ERROR_EVENT = 'progress-storage-error';

let database = null;
let nativeStorage = null;
let storageMode = 'localStorage';
let storageError = '';
let values = new Map();
let persistedValues = new Map();
let valueVersions = new Map();
let usedBytes = 0;
let writeQueue = Promise.resolve();
let storageChannel = null;

const valueSize = (key, value) => (key.length + value.length) * 2;

const mapSize = (entries) => {
    let total = 0;
    for (const [key, value] of entries) total += valueSize(key, value);
    return total;
};

const dispatchStorageChange = (key = null, oldValue = null, newValue = null) => {
    window.dispatchEvent(new CustomEvent(STORAGE_CHANGE_EVENT));
    if (storageChannel) storageChannel.postMessage({ key, oldValue, newValue });
};

const reportStorageError = (error) => {
    storageError = error?.message || 'Could not save data to this device.';
    console.error('Progress persistent storage failed:', error);
    window.dispatchEvent(new CustomEvent(STORAGE_ERROR_EVENT, {
        detail: { message: storageError },
    }));
};

const clearStorageError = () => {
    if (!storageError) return;
    storageError = '';
    window.dispatchEvent(new CustomEvent(STORAGE_CHANGE_EVENT));
};

const openDatabase = () => new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open app storage.'));
    request.onblocked = () => reject(new Error('App storage is blocked by another open tab.'));
});

const getAllEntries = (db) => new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly')
        .objectStore(STORE_NAME)
        .getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not read app storage.'));
});

const persistOperation = (operation) => {
    writeQueue = writeQueue
        .then(() => new Promise((resolve, reject) => {
            const transaction = database.transaction(STORE_NAME, 'readwrite');
            transaction.oncomplete = resolve;
            transaction.onerror = () => reject(transaction.error || new Error('Could not save app data.'));
            transaction.onabort = () => reject(transaction.error || new Error('Saving app data was interrupted.'));
            operation.write(transaction.objectStore(STORE_NAME));
        }))
        .then(() => {
            if ('persistedValue' in operation) {
                persistedValues.set(operation.key, operation.persistedValue);
            } else if (operation.key !== undefined) {
                persistedValues.delete(operation.key);
            } else if (operation.clearsStore) {
                persistedValues.clear();
            }
            clearStorageError();
        })
        .catch((error) => {
            if (operation.key !== undefined
                && valueVersions.get(operation.key) === operation.version) {
                const persistedValue = persistedValues.get(operation.key);
                if (persistedValue === undefined) values.delete(operation.key);
                else values.set(operation.key, persistedValue);
                usedBytes = mapSize(values);
            } else if (operation.clearsStore && operation.version === valueVersions.get('*')) {
                values = new Map(persistedValues);
                usedBytes = mapSize(values);
            }
            reportStorageError(error);
            window.dispatchEvent(new CustomEvent(STORAGE_CHANGE_EVENT));
        });
};

const storageFacade = {
    get length() {
        return values.size;
    },
    key(index) {
        return [...values.keys()][Number(index)] ?? null;
    },
    getItem(key) {
        const value = values.get(String(key));
        return value === undefined ? null : value;
    },
    setItem(key, value) {
        const normalizedKey = String(key);
        const normalizedValue = String(value);
        if (storageMode !== 'indexedDB') {
            nativeStorage.setItem(normalizedKey, normalizedValue);
            values.set(normalizedKey, normalizedValue);
            usedBytes = mapSize(values);
            dispatchStorageChange(normalizedKey, null, normalizedValue);
            return;
        }

        const previousValue = values.get(normalizedKey);
        const nextSize = usedBytes
            - (previousValue === undefined ? 0 : valueSize(normalizedKey, previousValue))
            + valueSize(normalizedKey, normalizedValue);
        if (nextSize > APP_QUOTA_BYTES) {
            const error = new DOMException('Progress app storage is limited to 100MB.', 'QuotaExceededError');
            reportStorageError(error);
            throw error;
        }

        values.set(normalizedKey, normalizedValue);
        usedBytes = nextSize;
        const version = (valueVersions.get(normalizedKey) || 0) + 1;
        valueVersions.set(normalizedKey, version);
        persistOperation({
            key: normalizedKey,
            version,
            persistedValue: normalizedValue,
            write: (objectStore) => objectStore.put({ key: normalizedKey, value: normalizedValue }),
        });
        dispatchStorageChange(normalizedKey, previousValue ?? null, normalizedValue);
    },
    removeItem(key) {
        const normalizedKey = String(key);
        const previousValue = values.get(normalizedKey);
        if (storageMode !== 'indexedDB') {
            nativeStorage.removeItem(normalizedKey);
            values.delete(normalizedKey);
            usedBytes = mapSize(values);
            dispatchStorageChange(normalizedKey, previousValue ?? null, null);
            return;
        }

        values.delete(normalizedKey);
        usedBytes -= previousValue === undefined ? 0 : valueSize(normalizedKey, previousValue);
        const version = (valueVersions.get(normalizedKey) || 0) + 1;
        valueVersions.set(normalizedKey, version);
        persistOperation({
            key: normalizedKey,
            version,
            write: (objectStore) => objectStore.delete(normalizedKey),
        });
        dispatchStorageChange(normalizedKey, previousValue ?? null, null);
    },
    clear() {
        if (storageMode !== 'indexedDB') {
            nativeStorage.clear();
            values.clear();
            usedBytes = 0;
            dispatchStorageChange();
            return;
        }

        values.clear();
        usedBytes = 0;
        const version = (valueVersions.get('*') || 0) + 1;
        valueVersions.set('*', version);
        persistOperation({
            clearsStore: true,
            version,
            write: (objectStore) => objectStore.clear(),
        });
        dispatchStorageChange();
    },
};

const installStorageChannel = () => {
    if (!('BroadcastChannel' in window)) return;
    storageChannel = new BroadcastChannel('progress-workspace-storage');
    storageChannel.onmessage = ({ data }) => {
        if (!data || typeof data.key !== 'string') return;
        if (data.newValue === null) {
            values.delete(data.key);
        } else {
            values.set(data.key, data.newValue);
        }
        usedBytes = mapSize(values);
        window.dispatchEvent(new CustomEvent(STORAGE_CHANGE_EVENT));
        window.dispatchEvent(new StorageEvent('storage', {
            key: data.key,
            oldValue: data.oldValue,
            newValue: data.newValue,
            url: window.location.href,
        }));
    };
};

const installStorageFacade = () => {
    Object.defineProperty(window, 'localStorage', {
        configurable: true,
        enumerable: true,
        value: storageFacade,
    });
};

export const initializePersistentStorage = async () => {
    nativeStorage = window.localStorage;
    try {
        if (!window.indexedDB) throw new Error('This browser does not support IndexedDB.');
        database = await openDatabase();
        database.onversionchange = () => database.close();

        const storedEntries = await getAllEntries(database);
        values = new Map(storedEntries.map(({ key, value }) => [key, value]));

        const legacyEntries = [];
        for (let index = 0; index < nativeStorage.length; index += 1) {
            const key = nativeStorage.key(index);
            if (key !== null && !values.has(key)) {
                const value = nativeStorage.getItem(key);
                if (value !== null) {
                    values.set(key, value);
                    legacyEntries.push({ key, value });
                }
            }
        }

        if (legacyEntries.length) {
            const transaction = database.transaction(STORE_NAME, 'readwrite');
            const complete = new Promise((resolve, reject) => {
                transaction.oncomplete = resolve;
                transaction.onerror = () => reject(transaction.error || new Error('Could not migrate saved app data.'));
                transaction.onabort = () => reject(transaction.error || new Error('Migrating saved app data was interrupted.'));
            });
            const store = transaction.objectStore(STORE_NAME);
            legacyEntries.forEach((entry) => store.put(entry));
            await complete;
        }

        persistedValues = new Map(values);
        usedBytes = mapSize(values);
        storageMode = 'indexedDB';
        installStorageFacade();
        installStorageChannel();
        window.dispatchEvent(new CustomEvent(STORAGE_CHANGE_EVENT));
    } catch (error) {
        storageMode = 'localStorage';
        values = new Map();
        for (let index = 0; index < nativeStorage.length; index += 1) {
            const key = nativeStorage.key(index);
            if (key !== null) values.set(key, nativeStorage.getItem(key));
        }
        persistedValues = new Map(values);
        usedBytes = mapSize(values);
        reportStorageError(error);
        installStorageFacade();
    }

    return getPersistentStorageInfo();
};

export const getPersistentStorageInfo = () => {
    const quotaBytes = storageMode === 'indexedDB' ? APP_QUOTA_BYTES : LOCAL_STORAGE_QUOTA_BYTES;
    const usedText = usedBytes >= 1024 * 1024
        ? `${(usedBytes / (1024 * 1024)).toFixed(1)}MB`
        : `${Math.round(usedBytes / 1024)}KB`;

    return {
        percent: usedBytes ? Math.max(1, Math.min(100, Math.round((usedBytes / quotaBytes) * 100))) : 0,
        usedText,
        quotaText: storageMode === 'indexedDB' ? '100MB' : '5.0MB',
        backend: storageMode,
        warning: storageError,
    };
};

export const flushPersistentStorage = async () => {
    await writeQueue;
    if (storageError) throw new Error(storageError);
};

export const PERSISTENT_STORAGE_CHANGE_EVENT = STORAGE_CHANGE_EVENT;
export const PERSISTENT_STORAGE_ERROR_EVENT = STORAGE_ERROR_EVENT;
