
'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, FileUp, AlertTriangle } from 'lucide-react';
import { Product, Transaction, Shift, StoreConfig, Category, RawIngredient, StockMovement, ProductVariant } from '@/lib/types';
import ReportView from './_components/ReportView';

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
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        setError(null);
        setReportData(null);

        try {
            const firesqlite = await import('firesqlite');
            const dbName = `report-db-${Date.now()}`;
            const wasmUrl = new URL('/wa-sqlite-async.wasm', window.location.origin).href;

            await firesqlite.initializeFirestoreSQLite(wasmUrl, dbName);
            const db = firesqlite.getFirestore();
            
            await firesqlite.importFullBinary(file);

            // Fetch all data from the temporary database
            const collections = ['products', 'transactions', 'shifts', 'store_config', 'categories', 'raw_ingredients', 'stock_movements', 'product_variants'];
            const dataPromises = collections.map(col => firesqlite.getDocs(firesqlite.collection(db, col)));
            const snapshots = await Promise.all(dataPromises);

            const fetchedData: ReportData = {
                products: snapshots[0].docs.map((d: any) => d.data()),
                transactions: snapshots[1].docs.map((d: any) => d.data()),
                shifts: snapshots[2].docs.map((d: any) => d.data()),
                storeConfig: snapshots[3].docs.length > 0 ? snapshots[3].docs[0].data() : null,
                categories: snapshots[4].docs.map((d: any) => d.data()),
                rawIngredients: snapshots[5].docs.map((d: any) => d.data()),
                stockMovements: snapshots[6].docs.map((d: any) => d.data()),
                productVariants: snapshots[7].docs.map((d: any) => d.data()),
            };

            setReportData(fetchedData);
        } catch (e: any) {
            console.error("Failed to load report from backup:", e);
            setError("Failed to load report. The file may be corrupted or not a valid backup.");
        } finally {
            setIsLoading(false);
            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleReset = () => {
        setReportData(null);
        setError(null);
        // We can directly trigger the file picker again.
        fileInputRef.current?.click();
    };

    if (isLoading) {
        return (
            <div className="flex h-full w-full items-center justify-center p-8">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <h2 className="text-xl font-semibold">Loading Report...</h2>
                    <p className="text-muted-foreground">Processing your backup file. This may take a moment.</p>
                </div>
            </div>
        );
    }

    if (reportData) {
        return <ReportView data={reportData} onReset={handleReset} />;
    }

    return (
        <div className="flex h-full w-full items-center justify-center p-4">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".db,.sqlite"
                hidden
            />
            <Card className="w-full max-w-lg text-center">
                <CardHeader>
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                        <FileUp className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="mt-4">Read-Only Report Viewer</CardTitle>
                    <CardDescription>Select a TokoCepat backup file (`.db`) to view its data in a read-only mode. No changes will be saved.</CardDescription>
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
                    <Button size="lg" className="w-full" onClick={() => fileInputRef.current?.click()}>
                        Select Backup File
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
