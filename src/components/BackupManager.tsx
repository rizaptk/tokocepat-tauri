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
            const productsQuery = query(collection(db, 'products'), limit(1));
            const productsSnapshot = await getDocs(productsQuery);
            const isDbEmpty = productsSnapshot.empty;

            if (isDbEmpty) {
                if (isBackupConfigured) {
                    setPromptState('needs_restore');
                } else {
                    setPromptState('needs_config');
                }
            } else {
                if (!isBackupConfigured) {
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
                const { collection, getDocs, query, limit } = firesqlite;
                const isDbEmpty = (await getDocs(query(collection(db, 'products'), limit(1)))).empty;
                if (isDbEmpty) {
                    setPromptState('needs_restore');
                } else {
                    setPromptState('idle');
                }
            } else {
                // User cancelled. We keep showing the prompt until they configure it.
                // alert('Auto-backup is not configured. Your data may be lost if browser data is cleared.');
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
                            To protect your data from being cleared by the browser, please select a backup location on your device. This file will be used to automatically save your data.
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
                            Your local database appears to be empty, but a backup file was found. Would you like to restore your data from this backup?
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
