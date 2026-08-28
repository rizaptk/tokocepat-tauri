import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { Transaction, TransactionItem } from '@/lib/types';
import { findTransactionByInvoice, getReturnsByOriginalTx, voidTransaction, isVoidBlockedByPiutang } from '@/services/transactionService';
import { useLoadTransactions } from '@/hooks/useLoadTransaction';
import { useGlobalBarcodeScanner } from '@/hooks/use-global-barcode-scanner';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Search, ArrowLeft, Undo2, Minus, Plus, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { formatIDR } from "@/lib/format";

// Stable identity for a purchased line across original + return transactions.
// Uses name too so different variants of the same parent product stay separate.
const itemKey = (it: TransactionItem) => `${it.product_snapshot.id}::${it.product_snapshot.name}`;

interface ReturnDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export default function ReturnDialog({ open, onOpenChange }: ReturnDialogProps) {
    const { activeShift, storeConfig, createReturn } = useStore();
    const { toast } = useToast();

    const [invoiceInput, setInvoiceInput] = useState('');
    const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
    const [priorReturns, setPriorReturns] = useState<Transaction[]>([]);
    const [returnQty, setReturnQty] = useState<Record<string, number>>({});
    const [reason, setReason] = useState('');
    const [conditionOk, setConditionOk] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLookingUp, setIsLookingUp] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);
    const { transactions: recentTransactions } = useLoadTransactions();

    // Autofocus the invoice field whenever the dialog opens / phase resets.
    useEffect(() => {
        if (open) {
            const t = setTimeout(() => inputRef.current?.focus(), 120);
            return () => clearTimeout(t);
        }
    }, [open, selectedTx]);

    // Reset state when closed.
    useEffect(() => {
        if (!open) {
            setSelectedTx(null);
            setPriorReturns([]);
            setReturnQty({});
            setReason('');
            setConditionOk(false);
            setError(null);
            setInvoiceInput('');
        }
    }, [open]);

    // Candidate history: paid sale transactions within the default 30-day window.
    const candidateTransactions = useMemo(() => {
        const term = invoiceInput.trim().toLowerCase();
        return recentTransactions
            .filter(tx => tx.status === 'paid' && tx.transaction_type !== 'return')
            .filter(tx => !term || tx.invoice_number.toLowerCase().includes(term))
            .slice(0, 50)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [recentTransactions, invoiceInput]);

    // Per-line return data for the selected ticket (purchased / already / remaining / qty).
    const lines = useMemo(() => {
        if (!selectedTx) return [];
        const grouped = new Map<string, { item: TransactionItem; purchased: number }>();
        selectedTx.items.forEach(it => {
            const k = itemKey(it);
            const cur = grouped.get(k);
            if (cur) cur.purchased += it.qty;
            else grouped.set(k, { item: it, purchased: it.qty });
        });

        const returned: Record<string, number> = {};
        priorReturns.forEach(rtx => rtx.items.forEach(it => {
            const k = itemKey(it);
            returned[k] = (returned[k] || 0) + Math.abs(it.qty);
        }));

        return Array.from(grouped.entries()).map(([k, { item, purchased }]) => {
            const already = returned[k] || 0;
            const remaining = Math.max(0, purchased - already);
            const qty = Math.min(returnQty[k] || 0, remaining);
            return { key: k, item, purchased, already, remaining, qty };
        });
    }, [selectedTx, priorReturns, returnQty]);

    const isFullReturn = useMemo(() =>
        !!selectedTx && lines.length > 0 && lines.every(l => l.remaining > 0 && l.qty === l.remaining),
    [selectedTx, lines]);

    // Suggest void ONLY when every line is returned on the SAME shift and nothing
    // was returned before (voiding would otherwise double-restock prior returns).
    // Also blocked if transaction is piutang or customer has other piutang.
    const voidBlock = useMemo(() => selectedTx ? isVoidBlockedByPiutang(selectedTx as any) : { blocked: false } as any, [selectedTx]);
    const canSuggestVoid = useMemo(() =>
        isFullReturn && !!activeShift && selectedTx?.shift_id === activeShift.id && priorReturns.length === 0 && !voidBlock.blocked,
    [isFullReturn, activeShift, selectedTx, priorReturns, voidBlock]);

    const refundSummary = useMemo(() => {
        let subtotal = 0;
        let tax = 0;
        if (!storeConfig) return { subtotal: 0, tax: 0, total: 0 };
        lines.forEach(l => {
            if (l.qty <= 0) return;
            const lineTotal = (l.item.price_snapshot - (l.item.unit_discount || 0)) * l.qty;
            subtotal += lineTotal;
            const { tax_settings, tax_rate } = storeConfig;
            let rate = tax_rate;
            if (tax_settings) {
                if (l.item.product_snapshot.category_id) {
                    const override = tax_settings.category_overrides.find(co => co.category_id === l.item.product_snapshot.category_id);
                    if (override && typeof override.tax_rate === 'number') rate = override.tax_rate;
                } else {
                    rate = tax_settings.default_rate;
                }
            }
            tax += lineTotal * rate;
        });
        return { subtotal, tax, total: subtotal + tax };
    }, [lines, storeConfig]);

    const openTicket = useCallback(async (tx: Transaction) => {
        setError(null);
        setInvoiceInput(tx.invoice_number);
        setSelectedTx(tx);
        setReturnQty({});
        setReason('');
        setConditionOk(false);
        try {
            const returns = await getReturnsByOriginalTx(tx.id);
            setPriorReturns(returns);
        } catch {
            setPriorReturns([]);
        }
    }, []);

    const handleLookup = useCallback(async (value?: string) => {
        const term = (value ?? invoiceInput).trim();
        if (!term) return;
        setIsLookingUp(true);
        setError(null);
        try {
            const tx = await findTransactionByInvoice(term);
            if (!tx || tx.status !== 'paid' || tx.transaction_type === 'return') {
                setError('Transaksi tidak ditemukan atau tidak valid untuk retur.');
                return;
            }
            await openTicket(tx);
        } catch (e: any) {
            setError(e.message || 'Gagal mencari transaksi.');
        } finally {
            setIsLookingUp(false);
        }
    }, [invoiceInput, openTicket]);

    // Scan handling: with a ticket open, a product barcode bumps that line's
    // return qty (in-context); otherwise the scan is treated as an invoice.
    useGlobalBarcodeScanner({
        enabled: open && !!activeShift,
        onScan: (code) => {
            if (selectedTx) {
                const match = selectedTx.items.find(it =>
                    it.product_snapshot.barcode && it.product_snapshot.barcode === code
                );
                if (match) {
                    const k = itemKey(match);
                    const line = lines.find(l => l.key === k);
                    if (line && line.qty < line.remaining) {
                        setReturnQty(prev => ({ ...prev, [k]: (prev[k] || 0) + 1 }));
                    } else {
                        toast({ title: 'Jumlah maksimum', description: 'Jumlah retur melebihi yang dibeli.' });
                    }
                } else {
                    toast({ variant: 'destructive', title: 'Barcode tidak cocok', description: 'Produk tidak ada pada transaksi ini.' });
                }
            } else {
                setInvoiceInput(code);
                handleLookup(code);
            }
        },
    });

    const setLineQty = (key: string, qty: number) => {
        setReturnQty(prev => ({ ...prev, [key]: Math.max(0, qty) }));
    };

    const handleVoidInstead = async () => {
        if (!selectedTx || !reason.trim() || isSubmitting) return;
        const block = isVoidBlockedByPiutang(selectedTx as any);
        if (block.blocked) { toast({ variant: 'destructive', title: 'Void diblokir', description: block.reason }); return; }
        setIsSubmitting(true);
        try {
            await voidTransaction(selectedTx.id, reason);
            toast({ title: 'Transaksi Dibatalkan', description: `Invoice ${selectedTx.invoice_number} berhasil di-void.` });
            onOpenChange(false);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Gagal Void', description: e.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleConfirm = async () => {
        if (!selectedTx || !activeShift || !storeConfig || isSubmitting) return;

        const returnLines = lines
            .filter(l => l.qty > 0)
            .map(l => ({ item: l.item, qty: l.qty }));

        if (returnLines.length === 0) {
            setError('Pilih setidaknya satu item untuk di-retur.');
            return;
        }
        if (!reason.trim()) {
            setError('Alasan retur wajib diisi.');
            return;
        }
        if (!conditionOk) {
            setError('Pastikan barang dalam kondisi baik untuk diproses retur.');
            return;
        }

        setIsSubmitting(true);
        setError(null);
        try {
            const returnTx = await createReturn({
                originalTx: selectedTx,
                returnLines,
                reason,
                conditionOk,
            });
            if (returnTx) {
                toast({
                    title: 'Retur Berhasil',
                    description: `Refund ${formatIDR(Math.abs(returnTx.total))} dari ${selectedTx.invoice_number}. Struk retur tercetak.`,
                });
                onOpenChange(false);
            }
        } catch (e: any) {
            setError(e.message || 'Retur gagal diproses.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const hasAnyReturn = lines.some(l => l.qty > 0);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col p-0 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
                    <div className="flex items-center gap-2">
                        {selectedTx && (
                            <Button variant="ghost" size="icon" aria-label="Kembali ke daftar transaksi" onClick={() => { setSelectedTx(null); setError(null); }}>
                                <ArrowLeft className="size-4" />
                            </Button>
                        )}
                        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                            <Undo2 className="size-5 text-primary" /> Retur & Void
                        </h2>
                    </div>
                    {selectedTx && <Badge variant="outline" className="font-mono">{selectedTx.invoice_number}</Badge>}
                </div>

                <div className="flex-1 overflow-auto p-5 space-y-6">
                    {!selectedTx ? (
                        <>
                            <div className="space-y-3">
                                <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                                    No. Struk / Invoice
                                </Label>
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        ref={inputRef}
                                        className="h-10 pl-9 pr-12 font-mono font-medium tracking-wide"
                                        placeholder="INV-MMDD-XXXX — scan struk atau ketik"
                                        value={invoiceInput}
                                        onChange={(e) => setInvoiceInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                                        autoFocus
                                    />
                                    {isLookingUp && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {isLookingUp ? 'Mencari transaksi…' : 'Tekan Enter atau scan barcode struk untuk mencari.'}
                                </p>
                            </div>

                            {error && <p className="text-sm font-medium text-destructive">{error}</p>}

                            <div className="space-y-3">
                                <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                                    Riwayat Transaksi (30 hari terakhir)
                                </Label>
                                <div className="border rounded-lg overflow-hidden max-h-[45vh] overflow-y-auto">
                                    <Table>
                                        <TableHeader className="sticky top-0 z-10 border-b border-border bg-card">
                                            <TableRow className="hover:bg-transparent">
                                                <TableHead className="w-40">Waktu</TableHead>
                                                <TableHead>Invoice</TableHead>
                                                <TableHead className="w-32 text-right">Total</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {candidateTransactions.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">Tidak ada transaksi yang cocok.</TableCell>
                                                </TableRow>
                                            ) : (
                                                candidateTransactions.map(tx => (
                                                    <TableRow key={tx.id} className="cursor-pointer hover:bg-accent" onClick={() => openTicket(tx)}>
                                                        <TableCell className="whitespace-nowrap text-muted-foreground">{format(new Date(tx.created_at), 'dd MMM yyyy, HH:mm')}</TableCell>
                                                        <TableCell className="font-mono font-bold">{tx.invoice_number}</TableCell>
                                                        <TableCell className="text-right font-bold tabular-nums">{formatIDR(tx.total)}</TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="border rounded-lg overflow-hidden">
                                <div className="px-4 py-2.5 bg-muted/50 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                    Barang yang dikembalikan · scan barcode / atur jumlah
                                </div>
                                <div className="divide-y divide-border/60">
                                    {lines.map(l => (
                                        <div key={l.key} className="px-4 py-3.5 flex items-center gap-3">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{l.item.product_snapshot.name}</p>
                                                <p className="text-xs text-muted-foreground tabular-nums">
                                                    {formatIDR(l.item.price_snapshot)}
                                                    {(l.item.unit_discount || 0) > 0 ? ` → net ${formatIDR(Math.max(0, l.item.price_snapshot - (l.item.unit_discount || 0)))} setelah diskon` : ''}
                                                    {' · beli ' + l.purchased + ' · sudah ' + l.already + ' · sisa ' + l.remaining}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <Button variant="outline" size="icon" className="size-7" aria-label={`Kurangi jumlah retur ${l.item.product_snapshot?.name || ''}`} onClick={() => setLineQty(l.key, l.qty - 1)} disabled={l.qty <= 0}>
                                                    <Minus className="size-3" />
                                                </Button>
                                                <span className="w-8 text-center font-bold tabular-nums">{l.qty}</span>
                                                <Button variant="outline" size="icon" className="size-7" aria-label={`Tambah jumlah retur ${l.item.product_snapshot?.name || ''}`} onClick={() => setLineQty(l.key, l.qty + 1)} disabled={l.qty >= l.remaining}>
                                                    <Plus className="size-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {canSuggestVoid && (
                                <div className="rounded-lg border border-warning bg-warning/10 p-4 space-y-3">
                                    <p className="text-sm font-semibold">
                                        Semua item transaksi ini dikembalikan pada sif yang sama dan belum pernah di-retur.
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        Disarankan <span className="font-semibold">membatalkan transaksi (Void)</span> daripada membuat retur terpisah.
                                    </p>
                                    <Button variant="destructive" className="w-full" onClick={handleVoidInstead} disabled={!reason.trim() || isSubmitting}>
                                        <XCircle className="mr-2 size-4" /> Batalkan Transaksi (Void)
                                    </Button>
                                </div>
                            )}
                            {selectedTx && voidBlock.blocked && (
                                <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                                    Void diblokir: {voidBlock.reason} — lunasi piutang di menu Piutang terlebih dahulu.
                                </div>
                            )}

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="retur-reason">Alasan Retur/Void *</Label>
                                    <Input
                                        id="retur-reason"
                                        placeholder="cth. salah ukuran / rusak / void — salah input"
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                    />
                                </div>
                                <label className="flex items-start gap-2 text-sm cursor-pointer">
                                    <Checkbox checked={conditionOk} onCheckedChange={(v) => setConditionOk(v === true)} />
                                    <span className="text-muted-foreground">
                                        Barang dalam <span className="font-semibold text-foreground">kondisi baik</span> dan dapat dijual kembali.
                                    </span>
                                </label>
                            </div>

                            {error && <p className="text-sm font-medium text-destructive">{error}</p>}

                            <div className="bg-muted/40 rounded-lg p-5 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Kembali Subtotal</span>
                                    <span className="tabular-nums">{formatIDR(refundSummary.subtotal)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Pajak</span>
                                    <span className="tabular-nums">{formatIDR(refundSummary.tax)}</span>
                                </div>
                                <div className="flex justify-between font-black text-lg border-t pt-2">
                                    <span>Total Refund (Kas Sif)</span>
                                    <span className="tabular-nums text-destructive">{formatIDR(refundSummary.total)}</span>
                                </div>
                            </div>

                            <Button className="w-full h-12 font-semibold" onClick={handleConfirm} disabled={isSubmitting || !hasAnyReturn}>
                                <CheckCircle2 className="mr-2 size-5" />
                                {isSubmitting ? 'Memproses...' : `Buat Retur & Refund ${formatIDR(refundSummary.total)}`}
                            </Button>
                            <Button variant="outline" className="w-full h-10 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={handleVoidInstead} disabled={!reason.trim() || isSubmitting || !selectedTx || voidBlock.blocked} title={voidBlock.blocked ? voidBlock.reason : ''}>
                                <XCircle className="mr-2 size-4" /> Void Transaksi {selectedTx ? `(${selectedTx.invoice_number})` : ''}
                            </Button>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}