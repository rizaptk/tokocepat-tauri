
'use client';

import { useEffect, useState, useTransition } from 'react';
import { useDbStore } from '@/lib/db-store';
import { hasBackupConfig, performRestore, promptAndSetBackupFile, getBackupMetadata } from '@/lib/backupService';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useAutoBackup } from '@/hooks/useBackup';
import { Loader2 } from 'lucide-react';
import { getLicenseData } from '@/services/dataService';
import { toast } from '@/hooks/use-toast';
import { performBackup } from '@/lib/backupService';

type PromptState = 'idle' | 'checking' | 'needs_config' | 'needs_restore' | 'data_conflict';

export function BackupManager() {
    useAutoBackup();
    
    const { isInitialized, firesqlite, db } = useDbStore();
    const [promptState, setPromptState] = useState<PromptState>('checking');
    const [isRestoring, startRestoreTransition] = useTransition();
    const [isConfiguring, startConfigureTransition] = useTransition();

    useEffect(() => {
        if (!isInitialized || !db || !firesqlite) return;

        const checkDbState = async () => {
            const { getDocs, collection, query, limit } = firesqlite;
            
            // 1. Check for local license data and its signature (deviceId)
            const localLicense = await getLicenseData();
            const localDbDeviceId = localLicense?.deviceId;

            // 2. Check if a backup file has been configured
            const isBackupConfigured = await hasBackupConfig();
            
            // 3. Get metadata from the last backup (signature)
            const backupMeta = await getBackupMetadata();
            const backupDeviceId = backupMeta.signature;

            // 4. Check if the local database is effectively empty
            const configQuery = query(collection(db, 'store_config'), limit(1));
            const configSnapshot = await getDocs(configQuery);
            const isDbEmpty = configSnapshot.empty;

            // --- Determine state based on checks ---

            if (isDbEmpty && isBackupConfigured) {
                // Highest priority: DB is empty, but a backup location exists. Recover data.
                setPromptState('needs_restore');
            } else if (localDbDeviceId && backupDeviceId && localDbDeviceId !== backupDeviceId && isBackupConfigured) {
                // Data has diverged. Local DB was signed by one device, backup by another.
                setPromptState('data_conflict');
            } else if (localLicense && !isBackupConfigured) {
                // User is licensed but has not configured backup yet.
                setPromptState('needs_config');
            } else {
                setPromptState('idle');
            }
        };

        checkDbState();
    }, [isInitialized, db, firesqlite]);

    const handleRestore = () => {
        startRestoreTransition(async () => {
            const success = await performRestore();
            if (success) {
                // The page will reload after a short delay for the toast to be seen.
                setTimeout(() => window.location.reload(), 1500);
            } else {
                // Restore failed, prompt user to maybe re-select file location
                setPromptState('needs_config'); 
            }
        });
    };

    const handleOverwriteBackup = () => {
        // This is a "force push". We overwrite the old backup with the current local data.
        startRestoreTransition(async () => {
            toast({ title: "Overwriting Backup", description: "Saving current local data to the backup location." });
            const success = await performBackup(firesqlite, true);
            if(success) {
                toast({ title: "Backup Overwritten", description: "Your local data is now the primary backup."});
            } else {
                toast({ variant: "destructive", title: "Failed to Overwrite", description: "Please check file permissions and try again." });
            }
            setPromptState('idle'); // Resolve conflict
        });
    };
    
    const handleConfigure = () => {
        startConfigureTransition(async () => {
            const handle = await promptAndSetBackupFile();
            if (handle) {
                toast({ title: "Backup Location Set", description: "Auto-backup is now configured."});
                setPromptState('idle');
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
                            To protect your data, please select a backup location. Your data will be saved automatically. This is a one-time setup for this device.
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
             <AlertDialog open={promptState === 'data_conflict'}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Data Conflict Detected</AlertDialogTitle>
                        <AlertDialogDescription>
                            The data on this device is different from your backup file. This can happen if you used the app on another device. Please choose which version to keep. This choice cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <Button variant="destructive" onClick={handleOverwriteBackup} disabled={isRestoring}>
                            {isRestoring ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                            Keep This Device's Data
                        </Button>
                        <Button onClick={handleRestore} disabled={isRestoring}>
                            {isRestoring ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                            Restore from Backup
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
