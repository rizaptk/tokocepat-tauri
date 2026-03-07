'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, FileUp, AlertTriangle, RefreshCw } from 'lucide-react';
import { Product, Transaction, Shift, StoreConfig, Category, RawIngredient, StockMovement, ProductVariant } from '@/lib/types';
import ReportView from './_components/ReportView';

// Simple key-value store using IndexedDB
const idbKeyval = {
    get: <T>(key: IDBValidKey): Promise<T | undefined> => {
        return new Promise((resolve, reject) => {
            if (typeof window === 'undefined' || !window.indexedDB) return resolve(undefined);
            const request = indexedDB.open('tokoc-report-keyval', 1);
            request.onupgradeneeded = () => {
                if (!request.result.objectStoreNames.contains('store')) {
                    request.result.createObjectStore('store');
                }
            };
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                try {
                    const tx = request.result.transaction('store', 'readonly');
                    const getRequest = tx.objectStore('store').get(key);
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
            const request = indexedDB.open('tokoc-report-keyval', 1);
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
            const request = indexedDB.open('tokoc-report-keyval', 1);
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

const REPORT_FILE_HANDLE_KEY = 'report-backup-file-handle';
const POLLING_INTERVAL = 10000; // 10 seconds

type ReportData = {
    products: Product[];
    transactions: Transaction[];
    shifts: Shift[];
    storeConfig: StoreConfig | null;
    categories: Category[];
    rawIngredients: RawIngredient[];
    stockMovements: StockMovement[];
    productVariants: ProductVariant[];
}

export default function ReportPage() {
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(null);
    const [lastModified, setLastModified] = useState<number | null>(null);
    const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false);

    const loadDataFromHandle = useCallback(async (handle: FileSystemFileHandle, isUpdate = false) => {
        if (!isUpdate) setIsLoading(true);
        setError(null);
        
        try {
            const file = await handle.getFile();
            setLastModified(file.lastModified);
            
            const firesqlite = await import('firesqlite');
            const dbName = `report-db-${Date.now()}`;
            const wasmUrl = new URL('/wa-sqlite-async.wasm', window.location.origin).href;

            await firesqlite.initializeFirestoreSQLite(wasmUrl, dbName);
            const db = firesqlite.getFirestore();
            
            await firesqlite.importFullBinary(file);

            const collections = ['products', 'transactions', 'shifts', 'store_config', 'categories', 'raw_ingredients', 'stock_movements', 'product_variants'];
            const dataPromises = collections.map(col => firesqlite.getDocs(firesqlite.collection(db, col)));
            const snapshots = await Promise.all(dataPromises);

            const fetchedData: ReportData = {
                products: snapshots[0]?.docs.map((d: any) => d.data()) || [],
                transactions: snapshots[1]?.docs.map((d: any) => d.data()) || [],
                shifts: snapshots[2]?.docs.map((d: any) => d.data()) || [],
                storeConfig: snapshots[3]?.docs.length > 0 ? snapshots[3].docs[0].data() : null,
                categories: snapshots[4]?.docs.map((d: any) => d.data()) || [],
                rawIngredients: snapshots[5]?.docs.map((d: any) => d.data()) || [],
                stockMovements: snapshots[6]?.docs.map((d: any) => d.data()) || [],
                productVariants: snapshots[7]?.docs.map((d: any) => d.data()) || [],
            };

            setReportData(fetchedData);
        } catch (e: any) {
            console.error("Failed to load report from handle:", e);
            setError("Failed to load report. The file may be corrupted or not a valid backup.");
            setFileHandle(null); // Clear handle on error
            await idbKeyval.delete(REPORT_FILE_HANDLE_KEY);
        } finally {
            if (!isUpdate) setIsLoading(false);
        }
    }, []);

    // Effect to check for stored file handle on initial load
    useEffect(() => {
        const checkForStoredHandle = async () => {
            try {
                const handle = await idbKeyval.get<FileSystemFileHandle>(REPORT_FILE_HANDLE_KEY);
                if (handle) {
                    const permission = await handle.queryPermission({ mode: 'read' });
                    if (permission === 'granted') {
                        setFileHandle(handle);
                        await loadDataFromHandle(handle);
                    } else {
                        // Permission may have been revoked, prompt user to re-select
                        console.warn('Permission for file handle not granted. Please re-select the file.');
                        setIsLoading(false);
                    }
                } else {
                    setIsLoading(false);
                }
            } catch (e) {
                console.error("Error checking for stored handle:", e);
                setIsLoading(false);
            }
        };
        checkForStoredHandle();
    }, [loadDataFromHandle]);

    // Effect for polling for file updates
    useEffect(() => {
        if (!fileHandle) return;

        const intervalId = setInterval(async () => {
            setIsCheckingForUpdates(true);
            try {
                const file = await fileHandle.getFile();
                if (file.lastModified > (lastModified || 0)) {
                    console.log("Backup file has changed. Refreshing report...");
                    await loadDataFromHandle(fileHandle, true);
                }
            } catch (e) {
                console.error("Error checking for file updates:", e);
                // Handle might be stale, e.g. file moved/deleted
                setFileHandle(null);
                setReportData(null);
                await idbKeyval.delete(REPORT_FILE_HANDLE_KEY);
            } finally {
                setIsCheckingForUpdates(false);
            }
        }, POLLING_INTERVAL);

        return () => clearInterval(intervalId);
    }, [fileHandle, lastModified, loadDataFromHandle]);

    const handleFileSelect = async () => {
        try {
            if (!window.showOpenFilePicker) {
                alert('Your browser does not support this feature. Please use a modern browser like Chrome or Edge.');
                return;
            }
            const [handle] = await window.showOpenFilePicker({
                types: [{ description: 'Database Files', accept: { 'application/octet-stream': ['.db'] } }],
                multiple: false
            });
            await idbKeyval.set(REPORT_FILE_HANDLE_KEY, handle);
            setFileHandle(handle);
            await loadDataFromHandle(handle);
        } catch (e: any) {
            if (e.name !== 'AbortError') {
                console.error("Error picking file:", e);
                setError("Could not select the file.");
            }
        }
    };

    const handleReset = async () => {
        setReportData(null);
        setError(null);
        setFileHandle(null);
        setLastModified(null);
        await idbKeyval.delete(REPORT_FILE_HANDLE_KEY);
        // After reset, we want to prompt the user to pick a file again.
        await handleFileSelect();
    };

    if (isLoading) {
        return (
            <div className="flex h-full w-full items-center justify-center p-8">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <h2 className="text-xl font-semibold">Loading Report...</h2>
                    <p className="text-muted-foreground">Checking for stored backup file.</p>
                </div>
            </div>
        );
    }

    if (reportData && fileHandle) {
        return <ReportView data={reportData} onReset={handleReset} />;
    }

    return (
        <div className="flex h-full w-full items-center justify-center p-4">
            <Card className="w-full max-w-lg text-center">
                <CardHeader>
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                        <FileUp className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="mt-4">Read-Only Report Viewer</CardTitle>
                    <CardDescription>Select a TokoCepat backup file (`.db`) to view its data in a read-only mode. This page will remember your file choice and auto-refresh if the file is updated.</CardDescription>
                </CardHeader>
                <CardContent>
                     {error && (
                        <div className="mb-4 text-left p-3 bg-destructive/10 border border-destructive/50 rounded-lg text-sm text-destructive">
                             <div className="flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 mt-0.5" />
                                <div>
                                    <p className="font-bold">Error Loading File</p>
                                    <p>{error}</p>
                                </div>
                            </div>
                        </div>
                    )}
                    <Button size="lg" className="w-full" onClick={handleFileSelect}>
                        Select Backup File
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
