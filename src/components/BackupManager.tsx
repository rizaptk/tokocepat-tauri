
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
            const isBackupConfigured = await hasBackupConfig();

            const { collection, getDocs, query, limit } = firesqlite;
            // Check for a core configuration document to determine if the DB is "empty"
            const configQuery = query(collection(db, 'store_config'), limit(1));
            const configSnapshot = await getDocs(configQuery);
            const isDbEmpty = configSnapshot.empty;

            if (isDbEmpty) {
                if (isBackupConfigured) {
                    setPromptState('needs_restore');
                } else {
                    setPromptState('needs_config');
                }
            } else {
                if (!isBackupConfigured) {
                    // DB has data but no backup configured. This can happen on first use.
                    setPromptState('needs_config');
                } else {
                    setPromptState('idle');
                }
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
                setPromptState('needs_config'); // Prompt to re-select file
            }
        });
    };
    
    const handleConfigure = () => {
        startConfigureTransition(async () => {
            const handle = await promptAndSetBackupFile();
            if (handle) {
                setPromptState('idle'); // Configuration is done, proceed to app.
                // We don't automatically restore here. If the DB was empty, the restore prompt will show on next reload.
            }
        });
    };

    return (
        <>
            <AlertDialog open={promptState === 'needs_config'}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Configure Auto-Backup</AlertDialogTitle>
                        <AlertDialogDescription>
                            To protect your data, please select a backup location. This is a one-time setup. If you have an existing backup file, you can restore it from the Settings page.
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
