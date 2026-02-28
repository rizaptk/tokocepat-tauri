import { useEffect, useRef } from 'react';
import { useDbStore } from '@/lib/db-store';
import { performBackup } from '@/lib/backupService';
import { useToast } from './use-toast';

const BACKUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function useAutoBackup() {
    const { firesqlite, isInitialized } = useDbStore();
    const { toast } = useToast();
    const backupIntervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!isInitialized || !firesqlite) return;

        const backup = async () => {
            const success = await performBackup(firesqlite);
            if (success) {
                // Silently successful, maybe a subtle toast in the future
            } else {
                // This might be too noisy. We should only show this if manually triggered.
                // toast({
                //     variant: 'destructive',
                //     title: 'Auto-Backup Failed',
                //     description: 'Could not save data to your backup file. Please check permissions in settings.'
                // });
                console.error("Auto-backup failed in background.");
            }
        };

        // --- Periodic Backup ---
        if (backupIntervalRef.current) {
            clearInterval(backupIntervalRef.current);
        }
        backupIntervalRef.current = setInterval(backup, BACKUP_INTERVAL_MS);

        // --- Backup on Tab Close ---
        const handleBeforeUnload = () => {
            // Modern browsers do not allow async operations here, and alert() is blocked.
            // Our periodic backup is the primary strategy. This is a best-effort attempt for browsers that might allow it.
            if (navigator.sendBeacon) {
                // Beacon API is a potential future enhancement but requires a server endpoint.
            } else {
                // For now, we rely on the interval.
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            if (backupIntervalRef.current) {
                clearInterval(backupIntervalRef.current);
            }
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [isInitialized, firesqlite, toast]);
}
