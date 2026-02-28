// A simple key-value store using IndexedDB for storing the file handle
const idbKeyval = {
    get: <T>(key: IDBValidKey): Promise<T | undefined> => {
        return new Promise((resolve, reject) => {
            if (typeof window === 'undefined' || !window.indexedDB) return resolve(undefined);
            const request = indexedDB.open('tokoc-keyval', 1);
            request.onupgradeneeded = () => {
                if (!request.result.objectStoreNames.contains('store')) {
                    request.result.createObjectStore('store');
                }
            };
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                try {
                    const tx = request.result.transaction('store', 'readonly');
                    const store = tx.objectStore('store');
                    const getRequest = store.get(key);
                    getRequest.onsuccess = (e) => resolve((e.target as any).result);
                    getRequest.onerror = () => reject(getRequest.error);
                } catch (e) {
                    resolve(undefined);
                }
            };
        });
    },
    set: (key: IDBValidKey, value: any): Promise<void> => {
        return new Promise((resolve, reject) => {
            if (typeof window === 'undefined' || !window.indexedDB) return resolve();
            const request = indexedDB.open('tokoc-keyval', 1);
            request.onupgradeneeded = () => {
                 if (!request.result.objectStoreNames.contains('store')) {
                    request.result.createObjectStore('store');
                }
            };
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const tx = request.result.transaction('store', 'readwrite');
                tx.objectStore('store').put(value, key);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            };
        });
    },
};

const FILE_HANDLE_KEY = 'db-backup-file-handle';
const LAST_BACKUP_KEY = 'db-last-backup-timestamp';

let fileHandle: FileSystemFileHandle | null = null;

async function verifyPermission(handle: FileSystemFileHandle, withWrite: boolean): Promise<boolean> {
    const opts: FileSystemHandlePermissionDescriptor = withWrite ? { mode: 'readwrite' } : { mode: 'read' };
    if ((await handle.queryPermission(opts)) === 'granted') {
        return true;
    }
    if ((await handle.requestPermission(opts)) === 'granted') {
        return true;
    }
    return false;
}

export async function hasBackupConfig(): Promise<boolean> {
    const handle = await idbKeyval.get<FileSystemFileHandle>(FILE_HANDLE_KEY);
    return !!handle;
}

export async function getBackupFileHandle(): Promise<FileSystemFileHandle | null> {
    if (fileHandle) return fileHandle;
    const handleFromDb = await idbKeyval.get<FileSystemFileHandle>(FILE_HANDLE_KEY);
    if (handleFromDb) {
        if (await verifyPermission(handleFromDb, true)) {
            fileHandle = handleFromDb;
            return fileHandle;
        }
    }
    return null;
}

export async function promptAndSetBackupFile(): Promise<FileSystemFileHandle | null> {
    try {
        if (!window.showSaveFilePicker) {
            alert('Your browser does not support the File System Access API. Please use a modern browser like Chrome or Edge for this feature.');
            return null;
        }
        const handle = await window.showSaveFilePicker({
            suggestedName: 'tokoc_backup.db',
            types: [{
                description: 'Database Files',
                accept: { 'application/octet-stream': ['.db'] },
            }],
        });
        await idbKeyval.set(FILE_HANDLE_KEY, handle);
        fileHandle = handle;
        return handle;
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
            console.log('User cancelled file selection.');
        } else {
            console.error('Error selecting backup file:', error);
        }
        return null;
    }
}

export async function performBackup(firesqlite: any): Promise<boolean> {
    const handle = await getBackupFileHandle();
    if (!handle || !firesqlite) return false;

    try {
        const binaryData = await firesqlite.getBinaryBackup();
        const writable = await handle.createWritable();
        await writable.write(binaryData);
        await writable.close();
        await idbKeyval.set(LAST_BACKUP_KEY, new Date().toISOString());
        console.log('Auto backup successful.');
        return true;
    } catch (error) {
        console.error('Auto backup failed:', error);
        return false;
    }
}

export async function performRestore(firesqlite: any): Promise<boolean> {
    const handle = await getBackupFileHandle();
    if (!handle || !firesqlite) return false;

    try {
        const file = await handle.getFile();
        await firesqlite.importFullBinary(file);
        console.log('Restore from backup successful.');
        return true;
    } catch (error) {
        console.error('Restore from backup failed:', error);
        return false;
    }
}

export async function getLastBackupTimestamp(): Promise<string | null> {
    return await idbKeyval.get<string>(LAST_BACKUP_KEY) || null;
}
