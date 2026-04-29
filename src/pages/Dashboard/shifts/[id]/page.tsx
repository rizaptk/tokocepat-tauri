import { Link, useParams, useNavigate } from 'react-router-dom';
import { useStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { TokoCepatLogo } from '@/components/TokoCepatLogo';
import { ArrowLeft } from 'lucide-react';
import { parseISO, isValid } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { voidTransaction } from '@/services/transactionService';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn, formatDistanceShort } from '@/lib/utils';
import { exportShiftDetailsToPdf } from '@/lib/export';

// Helper to safely parse dates that might be in different formats
const getSafeDate = (dateInput: any): Date | null => {
    if (!dateInput) return null;
    if (dateInput instanceof Date) return dateInput;
    if (typeof dateInput === 'string') {
        const parsed = parseISO(dateInput);
        if (isValid(parsed)) return parsed;
    }
    const directDate = new Date(dateInput);
    if (isValid(directDate)) return directDate;
    
    return null;
};

export default function ShiftDetailsPage() {
    const params = useParams();
    const shiftId = params.id as string;
    const nav = useNavigate();
    
    const { shifts, transactions, storeConfig } = useStore();
    const { toast } = useToast();
    
    const shift = shifts.find(s => s.id === shiftId);
    const shiftTransactions = transactions.filter(t => t.shift_id === shiftId);

    const [voidReason, setVoidReason] = useState("");

    const handleVoid = async (transactionId: string, invoiceNumber: string) => {
        if (!voidReason.trim()) {
            toast({ variant: 'destructive', title: 'Alasan wajib diisi', description: 'Mohon berikan alasan pembatalan.' });
            return false;
        }
        try {
            await voidTransaction(transactionId, voidReason);
            toast({ title: 'Transaksi Batal', description: `Invoice ${invoiceNumber} berhasil dibatalkan.` });
            setVoidReason("");
            return true;
        } catch (error: any) {
            console.error("Failed to void transaction:", error);
            toast({ variant: "destructive", title: "Error", description: error.message || "Could not void the transaction." });
            return false;
        }
    };

    const handlePdfExport = () => {
        if (storeConfig && shift) {
            exportShiftDetailsToPdf(shift, shiftTransactions, storeConfig.store_name);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: 'Gagal ekspor PDF. Data toko atau sif tidak ditemukan.' });
        }
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
          style: 'currency',
          currency: 'IDR',
          minimumFractionDigits: 0,
        }).format(amount);
    };

    if (!shift) {
        return (
             <div className="flex min-h-screen w-full flex-col bg-muted/40">
                <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
                    <Link to="#" onClick={() => nav(-1)}>
                        <TokoCepatLogo />
                    </Link>
                </header>
                <main className="flex flex-1 items-center justify-center">
                    <Card className="w-full max-w-md">
                        <CardHeader>
                            <CardTitle>Sif Tidak Ditemukan</CardTitle>
                            <CardDescription>Data sif yang Anda cari tidak tersedia.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button asChild>
                                <Link to="/dashboard">Kembali ke Dashboard</Link>
                            </Button>
                        </CardContent>
                    </Card>
                </main>
             </div>
        )
    }

    const openedAt = getSafeDate(shift.opened_at);
    const closedAt = getSafeDate(shift.closed_at);
    const duration = (closedAt && openedAt) ? formatDistanceShort(closedAt, openedAt) : 'Masih aktif';
    const activeTransactions = shiftTransactions.filter(t => t.status === 'paid');
    const totalSales = activeTransactions.reduce((sum, t) => sum + t.total, 0);
    const transactionCount = activeTransactions.length;
    
    const totalVoid = shiftTransactions.filter(t => t.status === 'voided').reduce((sum, t) => sum + t.total, 0);
    const expectedCash = shift.opening_cash + totalSales;
    
    return (
         <div className="flex min-h-screen w-full flex-col bg-muted/40">
           <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 z-10">
                <Button variant="outline" size="icon" asChild>
                    <Link to="#" onClick={() => nav(-1)}>
                        <ArrowLeft />
                    </Link>
                </Button>
              <TokoCepatLogo />
           </header>
          <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 items-center">
            <div className="w-full max-w-4xl space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Ringkasan Sif</CardTitle>
                        <CardDescription>
                            ID Sif: {shift.id}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                                <p className="text-muted-foreground">Waktu Buka</p>
                                <p className="font-medium">{openedAt ? openedAt.toLocaleString() : '-'}</p>
                            </div>
                             <div>
                                <p className="text-muted-foreground">Waktu Tutup</p>
                                <p className="font-medium">{closedAt ? closedAt.toLocaleString() : '-'}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Durasi</p>
                                <p className="font-medium">{duration}</p>
                            </div>
                             <div>
                                <p className="text-muted-foreground">Transaksi</p>
                                <p className="font-medium">{transactionCount}</p>
                            </div>
                        </div>
                        <Separator />
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 pt-2">
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Kas Awal</span>
                                    <span className="font-medium">{formatCurrency(shift.opening_cash)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Total Penjualan</span>
                                    <span className="font-medium">{formatCurrency(totalSales)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Total Batal</span>
                                    <span className="font-medium text-destructive">{formatCurrency(totalVoid)}</span>
                                </div>
                            </div>
                             <div className="space-y-2 text-sm">
                                <div className="flex justify-between font-semibold">
                                    <span>Ekspektasi Kas</span>
                                    <span>{formatCurrency(expectedCash)}</span>
                                </div>
                                <div className="flex justify-between font-semibold">
                                    <span>Kas Aktual</span>
                                    <span>{formatCurrency(shift.declared_cash || 0)}</span>
                                </div>
                            </div>
                             <div className={`space-y-2 text-sm p-3 rounded-lg ${shift.variance !== 0 ? 'bg-destructive/10' : 'bg-green-500/10'}`}>
                                 <div className={`flex items-center h-full justify-between font-bold text-lg ${shift.variance !== 0 ? 'text-destructive' : 'text-green-600'}`}>
                                    <span>Selisih</span>
                                    <span>{formatCurrency(shift.variance || 0)}</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                 <Card>
                    <CardHeader>
                        <CardTitle>Daftar Transaksi</CardTitle>
                        <CardDescription>Semua transaksi yang tercatat pada sif ini.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Waktu</TableHead>
                                    <TableHead>Invoice #</TableHead>
                                    <TableHead>Item</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                    <TableHead className="text-right">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {shiftTransactions.map(tx => {
                                    const createdAtDate = getSafeDate(tx.created_at);
                                    return (
                                        <TableRow key={tx.id} className={cn(tx.status === 'voided' && 'bg-destructive/5 text-muted-foreground line-through hover:bg-destructive/10')}>
                                            <TableCell>{createdAtDate ? createdAtDate.toLocaleTimeString() : 'N/A'}</TableCell>
                                            <TableCell className="font-mono text-xs">{tx.invoice_number}</TableCell>
                                            <TableCell>{tx.items.reduce((acc, item) => acc + item.qty, 0)}</TableCell>
                                            <TableCell className="text-right font-medium">{formatCurrency(tx.total)}</TableCell>
                                            <TableCell className="text-right">
                                                {tx.status !== 'voided' && (
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive no-underline hover:bg-destructive/10">Void</Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Batalkan Transaksi {tx.invoice_number}?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    Tindakan ini tidak dapat dibatalkan. Stok akan dikembalikan secara otomatis.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <div className="py-4">
                                                                <Label htmlFor="void-reason" className="mb-2 block">Alasan Void</Label>
                                                                <Input id="void-reason" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Cth: Salah input, Pelanggan batal" />
                                                            </div>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel onClick={() => setVoidReason('')}>Batal</AlertDialogCancel>
                                                                <AlertDialogAction onClick={async (e) => {
                                                                    const success = await handleVoid(tx.id, tx.invoice_number);
                                                                    if (!success) {
                                                                        e.preventDefault(); // Prevent dialog from closing on failure
                                                                    }
                                                                }}>Konfirmasi Pembatalan</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <div className="flex gap-2 pt-4">
                    <Button variant="outline" onClick={handlePdfExport} disabled={!shift}>Ekspor PDF</Button>
                    <Button asChild>
                        <Link to="#" onClick={() => nav(-1)}>Selesai</Link>
                    </Button>
                </div>
            </div>
          </main>
        </div>
    )
}
