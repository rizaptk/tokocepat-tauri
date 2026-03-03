
import { useEffect, useRef } from 'react';
import { useDbStore } from '@/lib/db-store';
import { performBackup, hasBackupConfig } from '@/lib/backupService';
import { getLicenseData } from '@/services/dataService';

export function useAutoBackup() {
    const { firesqlite, db, isInitialized } = useDbStore();
    const backupInProgress = useRef(false);

    useEffect(() => {
        if (!isInitialized || !firesqlite || !db) return;
        
        const backup = async (isFinal: boolean = false) => {
            if (backupInProgress.current) return;
            backupInProgress.current = true;

            try {
                // Safety Check 1: Ensure user is licensed and backup is configured
                const license = await getLicenseData();
                const backupConfigured = await hasBackupConfig();
                if (!license || !backupConfigured) {
                    backupInProgress.current = false;
                    return; // Silently exit if not licensed or configured
                }
                
                // Safety Check 2: Ensure the DB is not empty before backing up
                const configDoc = await firesqlite.getDoc(firesqlite.doc(db, 'store_config', 'main'));
                if (!configDoc.exists()) {
                    backupInProgress.current = false;
                    return;
                }

                const success = await performBackup(firesqlite, isFinal);
                if (!success) {
                    console.warn("[Auto-Backup] Background backup failed or was not required.");
                }
            } catch (error) {
                console.error("[Auto-Backup] Error during backup process:", error);
            } finally {
                backupInProgress.current = false;
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                backup();
            }
        };

        const handlePageHide = () => {
            // This is a best-effort save, as complex async operations may be terminated.
            backup(true);
        };
        
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Only add the pagehide listener in production to avoid dev server loops
        if (process.env.NODE_ENV === 'production') {
            window.addEventListener('pagehide', handlePageHide);
        }

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (process.env.NODE_ENV === 'production') {
                window.removeEventListener('pagehide', handlePageHide);
            }
        };
    }, [isInitialized, firesqlite, db]);
}
