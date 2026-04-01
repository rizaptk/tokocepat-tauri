
import { useDbStore } from './db-store';
import { getLicenseData } from '@/services/dataService';
import { generateDeviceFingerprint } from './security';
import { toast } from '@/hooks/use-toast';

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
    delete: (key: IDBValidKey): Promise<void> => {
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
                tx.objectStore('store').delete(key);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            };
        });
    },
};

const FILE_HANDLE_KEY = 'db-backup-file-handle';
const LAST_BACKUP_KEY = 'db-last-backup-timestamp';
const LAST_BACKUP_SIGNATURE_KEY = 'db-last-backup-signature';

let fileHandle: FileSystemFileHandle | null = null;

async function verifyPermission(handle: FileSystemFileHandle, withWrite: boolean): Promise<boolean> {
    const opts: FileSystemHandlePermissionDescriptor = withWrite ? { mode: 'readwrite' } : { mode: 'read' };
    if ((await handle.queryPermission(opts)) === 'granted') {
        return true;
    }
    
    // requestPermission must be triggered by user gesture. 
    // If this is called from a background sync, it will fail/throw.
    const status = await (handle as any).requestPermission(opts);
    return status === 'granted';
}

export async function hasBackupConfig(): Promise<boolean> {
    const handle = await idbKeyval.get<FileSystemFileHandle>(FILE_HANDLE_KEY);
    return !!handle;
}

export async function clearBackupConfig(): Promise<void> {
    await Promise.all([
        idbKeyval.delete(FILE_HANDLE_KEY),
        idbKeyval.delete(LAST_BACKUP_KEY),
        idbKeyval.delete(LAST_BACKUP_SIGNATURE_KEY),
    ]);
    fileHandle = null; // Also clear the in-memory handle
    console.log("Backup configuration cleared.");
}

export async function getBackupFileHandle(requestWrite: boolean = false): Promise<FileSystemFileHandle | null> {
    if (fileHandle) {
        if (await verifyPermission(fileHandle, requestWrite)) {
            return fileHandle;
        }
    }
    const handleFromDb = await idbKeyval.get<FileSystemFileHandle>(FILE_HANDLE_KEY);
    if (handleFromDb) {
        if (await verifyPermission(handleFromDb, requestWrite)) {
            fileHandle = handleFromDb;
            return fileHandle;
        }
    }
    return null;
}

export async function promptAndSetBackupFile(): Promise<FileSystemFileHandle | null> {
    try {
        if (!window.showSaveFilePicker || !window.showDirectoryPicker) {
            alert('Your browser does not support the File System Access API. Please use a modern browser like Chrome or Edge for this feature.');
            return null;
        }

        // const dir = await window.showDirectoryPicker();
        // const handle = await dir.getFileHandle('tokoc_backup.db', { create: true });
        
        
        const handle = await window.showSaveFilePicker({
            suggestedName: `tokoc_backup_${crypto.randomUUID().slice(0, 4)}.db`,
            types: [{
                description: 'Database Files',
                accept: { 'application/octet-stream': ['.db'] },
            }],
        });
        handle.requestPermission({ mode: 'readwrite' });
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

export async function performBackup(firesqlite: any, _: boolean = false): Promise<boolean> {
    
    const handle = await getBackupFileHandle(true);
    if (!handle || !firesqlite) {
        console.warn('Backup skipped: No backup file handle or database instance.');
        return false;
    }

    try {
        const binaryData = await firesqlite.getDatabaseBackup();
        const writableStream = await handle.createWritable({ keepExistingData: false });
        
        await writableStream.write(binaryData);
        await writableStream.close();
        
        const localSignature = await getLicenseData();
        if (localSignature?.deviceId) {
            await idbKeyval.set(LAST_BACKUP_SIGNATURE_KEY, localSignature.deviceId);
        }
        
        await idbKeyval.set(LAST_BACKUP_KEY, new Date().toISOString());
        return true;
    } catch (error: any) {
        console.warn(`Backup failed. Reason: ${error.name} - ${error.message}`);
        return false;
    }
}

// The new safe restore function
export async function performRestore(): Promise<boolean> {
    const { firesqlite, initialize } = useDbStore.getState();
    const handle = await getBackupFileHandle();
    if (!handle || !firesqlite) {
        toast({ variant: "destructive", title: "Restore Failed", description: "Backup location or database not ready." });
        return false;
    }

    try {
        const file = await handle.getFile();
        await firesqlite.importFullBinary(file);
        
        // Short delay to allow DB to settle after import
        await new Promise(res => setTimeout(res, 100));

        // Security check: Verify device ID after restore
        const restoredLicenseData = await getLicenseData();
        const currentDeviceId = await generateDeviceFingerprint();

        if (restoredLicenseData && restoredLicenseData.deviceId && restoredLicenseData.deviceId !== currentDeviceId) {
            toast({
                variant: 'destructive',
                title: 'Restore Aborted',
                description: "This backup belongs to another device and cannot be used here. The database has been reset.",
                duration: 10000,
            });
            // Re-initialize the DB to wipe the invalid data
            await initialize(); 
            return false;
        }

        toast({ title: 'Restore Complete', description: 'The application will now reload.' });
        return true;

    } catch (error) {
        console.error('Restore from backup failed:', error);
        toast({ variant: "destructive", title: "Restore Failed", description: "The backup file may be corrupted." });
        return false;
    }
}

// This function provides metadata about the backup for UI purposes
export async function getBackupMetadata(): Promise<{ lastBackup: string | undefined, signature: string | undefined }> {
    const [lastBackup, signature] = await Promise.all([
        idbKeyval.get<string>(LAST_BACKUP_KEY),
        idbKeyval.get<string>(LAST_BACKUP_SIGNATURE_KEY),
    ]);
    return { lastBackup, signature };
}
