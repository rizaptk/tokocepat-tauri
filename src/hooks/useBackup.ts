
import { useEffect, useRef } from 'react';
import { useDbStore } from '@/lib/db-store';
import { performBackup, hasBackupConfig } from '@/lib/backupService';
import { getLicenseData } from '@/services/dataService';

const BACKUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function useAutoBackup() {
    const { firesqlite, db, isInitialized } = useDbStore();
    const backupIntervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!isInitialized || !firesqlite || !db) return;
        
        const backup = async () => {
            if (!firesqlite || !db) return;
            
            // --- Safety Check: Ensure the local database is not empty before backing up ---
            // This prevents overwriting a valid backup with a fresh/empty database after a browser reset.
            // We check for store_config as a proxy for a configured database.
            try {
                const configDoc = await firesqlite.getDoc(firesqlite.doc(db, 'store_config', 'main'));
                if (!configDoc.exists()) {
                    console.warn("Auto-backup skipped: Local database appears to be uninitialized. This is a safeguard to prevent overwriting a valid backup.");
                    return;
                }
            } catch (e) {
                console.error("Auto-backup check failed:", e);
                return; // Don't proceed if we can't even check the DB state
            }
            
            // Proceed with the backup
            const success = await performBackup(firesqlite);
            if (success) {
                // Silently successful
                console.log("Auto-backup completed successfully in background.");
            } else {
                console.error("Auto-backup failed in background.");
            }
        };

        const initializeBackupProcess = async () => {
            // Only licensed users with a configured backup location should have auto-backup running.
            const license = await getLicenseData();
            const backupConfigured = await hasBackupConfig();
            
            if (license && backupConfigured) {
                // --- Periodic Backup ---
                if (backupIntervalRef.current) {
                    clearInterval(backupIntervalRef.current);
                }
                backupIntervalRef.current = setInterval(backup, BACKUP_INTERVAL_MS);
                console.log("Auto-backup service started for licensed user.");
            } else {
                 if (backupIntervalRef.current) {
                    clearInterval(backupIntervalRef.current);
                }
                 console.log("Auto-backup service not started: User is not licensed or backup is not configured.");
            }
        };

        initializeBackupProcess();

        return () => {
            if (backupIntervalRef.current) {
                clearInterval(backupIntervalRef.current);
            }
        };
    }, [isInitialized, firesqlite, db]);
}
