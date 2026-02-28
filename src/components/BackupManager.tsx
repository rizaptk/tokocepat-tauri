
'use client';

import { useEffect, useState, useTransition } from 'react';
import { useDbStore } from '@/lib/db-store';
import { hasBackupConfig, performRestore, promptAndSetBackupFile } from '@/lib/backupService';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useAutoBackup } from '@/hooks/useBackup';
import { Loader2 } from 'lucide-react';

export function BackupManager() {
    useAutoBackup(); // This hook will now manage the periodic backups.
    
    const { db, firesqlite, isInitialized } = useDbStore();
    const [promptState, setPromptState] = useState<'idle' | 'checking' | 'needs_config' | 'needs_restore'>('checking');
    const [isRestoring, startRestoreTransition] = useTransition();
    const [isConfiguring, startConfigureTransition] = useTransition();

    useEffect(() => {
        if (!isInitialized || !db || !firesqlite) return;

        const checkDbState = async () => {
            const { collection, getDocs, query, limit, doc, getDoc } = firesqlite;

            // 1. Check for an active license in the database.
            const licenseDocRef = doc(db, 'app_state', 'license');
            const licenseDocSnap = await getDoc(licenseDocRef);
            const isLicensed = licenseDocSnap.exists();

            // 2. Check if a backup location has already been configured.
            const isBackupConfigured = await hasBackupConfig();

            // 3. Check if the core database appears to be empty.
            const configQuery = query(collection(db, 'store_config'), limit(1));
            const configSnapshot = await getDocs(configQuery);
            const isDbEmpty = configSnapshot.empty;

            // --- Determine the correct state based on the checks ---

            if (isDbEmpty && isBackupConfigured) {
                // HIGHEST PRIORITY: The database was cleared, but a backup exists.
                // This is the data recovery scenario.
                setPromptState('needs_restore');
            } else if (isLicensed && !isBackupConfigured) {
                // The user is licensed but hasn't configured a backup.
                // This is the ideal time to prompt them.
                setPromptState('needs_config');
            } else {
                // This covers:
                // - New, unlicensed users (let them explore first).
                // - Licensed and configured users (normal operation).
                setPromptState('idle');
            }
        };

        checkDbState();
    }, [isInitialized, db, firesqlite]);

    const handleRestore = () => {
        startRestoreTransition(async () => {
            const success = await performRestore(firesqlite);
            if (success) {
                window.location.reload();
            } else {
                alert('Restore failed. The backup file might be corrupted or permissions were denied.');
                setPromptState('needs_config'); // Prompt to re-select file if restore fails
            }
        });
    };
    
    const handleConfigure = () => {
        startConfigureTransition(async () => {
            const handle = await promptAndSetBackupFile();
            if (handle) {
                setPromptState('idle'); // Configuration is done, proceed to app.
            }
            // If they cancel, the prompt will reappear on the next load (if they are licensed).
        });
    };

    return (
        <>
            <AlertDialog open={promptState === 'needs_config'}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Configure Auto-Backup</AlertDialogTitle>
                        <AlertDialogDescription>
                            To protect your data, please select a backup location. Your data will be saved automatically. This is a one-time setup.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <Button onClick={handleConfigure} disabled={isConfiguring}>
                            {isConfiguring ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                            Select Backup Location
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={promptState === 'needs_restore'}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Restore Data?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Your local database is empty, but a backup file was found. Would you like to restore your data from this backup?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                         <AlertDialogCancel onClick={() => setPromptState('idle')}>Start Fresh</AlertDialogCancel>
                        <Button onClick={handleRestore} disabled={isRestoring}>
                            {isRestoring ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                            Restore Data
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
