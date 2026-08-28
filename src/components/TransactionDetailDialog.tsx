import React, { useState, useMemo } from "react";
import { Transaction } from "@/lib/types";
import { useStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { voidTransaction, isVoidBlockedByPiutang } from "@/services/transactionService";
import { format } from "date-fns";
import { id } from "date-fns/locale"; // Added Indonesian locale

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Trash2, Printer, Clock } from "lucide-react";
import { usePrintStore } from "@/lib/print-store";
import { ScrollArea } from "./ui/scroll-area";
import { formatIDR as formatCurrency } from "@/lib/format";

interface TransactionDetailDialogProps {
    transaction: Transaction | null;
    onOpenChange: (isOpen: boolean) => void;
}

function TransactionDetailDialog({ transaction, onOpenChange }: TransactionDetailDialogProps) {
    const { shifts, transactions } = useStore();
    const { addToQueue } = usePrintStore();
    const { toast } = useToast();
    const [voidReason, setVoidReason] = useState("");
    const [isVoidAlertOpen, setIsVoidAlertOpen] = useState(false);

    if (!transaction) return null;

    const shiftForTransaction = transaction.shift_id ? shifts.find(s => s.id === transaction.shift_id) : null;
    const voidBlock = useMemo(() => isVoidBlockedByPiutang(transaction as any), [transaction, transactions]);
    const anyTx = transaction as any;
    const isGrosir = !!anyTx.is_wholesale;
    const sisa = (transaction.total || 0) - (transaction.cash_paid || 0);
    const dueDateStr = anyTx.due_date ? format(new Date(anyTx.due_date), 'PPP', { locale: id }) : null;
    const overdueDays = anyTx.due_date ? Math.max(0, Math.floor((Date.now() - new Date(anyTx.due_date).getTime()) / (1000*60*60*24))) : 0;
    
    const handleVoidConfirm = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        if (voidBlock.blocked) {
            toast({ variant: 'destructive', title: 'Void diblokir', description: voidBlock.reason });
            e.preventDefault();
            return;
        }
        if (!voidReason.trim()) {
            toast({ variant: 'destructive', title: 'Alasan wajib diisi', description: 'Silakan masukkan alasan pembatalan.' });
            e.preventDefault();
            return;
        }
        try {
            await voidTransaction(transaction.id, voidReason);
            toast({ title: 'Transaksi Di-void', description: `Invoice ${transaction.invoice_number} berhasil dibatalkan.` });
            setVoidReason("");
            setIsVoidAlertOpen(false);
            onOpenChange(false);
        } catch (error: any) {
            console.error("Gagal void transaksi:", error);
            toast({ variant: "destructive", title: "Error", description: error.message || "Gagal membatalkan transaksi." });
            e.preventDefault();
        }
    };

    const handlePrint = () => {
        if (transaction) {
            addToQueue(transaction);
        } else {
            toast({ variant: "destructive", title: "Gagal Cetak", description: "Data transaksi tidak ditemukan." });
        }
    };

    return (
        <Dialog open={!!transaction} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md md:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <span>No. Invoice: {transaction.invoice_number}</span>
                         <Badge variant={transaction.status === 'voided' ? 'destructive' : isGrosir && (anyTx.payment_status !== 'lunas') ? (anyTx.payment_status === 'piutang' ? 'destructive' : 'secondary') : 'secondary'}>
                            {transaction.status === 'voided' ? 'VOID' : isGrosir ? (anyTx.payment_status === 'piutang' ? 'PIUTANG' : anyTx.payment_status === 'lunas_sebagian' ? 'CICILAN' : 'LUNAS') : 'LUNAS'}
                         </Badge>
                    </DialogTitle>
                    <div className="text-sm text-muted-foreground">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                            <span>{format(new Date(transaction.created_at), 'PPPPp', { locale: id })}</span>
                            {shiftForTransaction && (
                                <span className="flex items-center gap-1.5 text-xs mt-1 sm:mt-0">
                                    <Clock className="h-3 w-3" />
                                    Shift: {format(new Date(shiftForTransaction.opened_at), 'p')}
                                </span>
                            )}
                        </div>
                    </div>
                </DialogHeader>
                <div className="py-4 max-h-[60vh] pr-2">
                    <ScrollArea className="h-full">
                        <div className="space-y-6">

                            {/* Daftar Produk */}
                            <div className="space-y-2">
                                <h4 className="font-semibold text-sm">Daftar Item</h4>
                                <div className="border rounded-md">
                                {transaction.items.map((item, index) => (
                                    <div key={`${item.id}-${index}`} className="flex justify-between items-start p-3 border-b last:border-none">
                                        <div className="flex-1">
                                            <p className="font-medium text-sm">{item.product_snapshot.name} {item.is_free_item && <Badge variant="secondary" className="ml-1">GRATIS</Badge>}</p>
                                            <p className="text-xs text-muted-foreground">{item.qty} x {formatCurrency(item.price_snapshot)}</p>
                                        </div>
                                        <p className="font-medium text-sm">{formatCurrency((item.subtotal || 0) - (item.discount_amount || 0))}</p>
                                    </div>
                                ))}
                                </div>
                            </div>

                            {/* Ringkasan Pembayaran */}
                            <div className="space-y-2">
                                <h4 className="font-semibold text-sm">Ringkasan</h4>
                                <div className="border rounded-lg p-4 space-y-2 text-sm">
                                    <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-medium">{formatCurrency(transaction.subtotal)}</span></div>
                                    {transaction.discount_total ? (
                                        <div className="flex justify-between text-success dark:text-success-foreground"><span className="text-muted-foreground">Diskon</span><span className="font-medium">-{formatCurrency(transaction.discount_total)}</span></div>
                                    ) : null}
                                    <div className="flex justify-between"><span className="text-muted-foreground">Pajak</span><span className="font-medium">{formatCurrency(transaction.tax_amount)}</span></div>
                                    <Separator/>
                                    <div className="flex justify-between text-base font-bold"><span>Total</span><span>{formatCurrency(transaction.total)}</span></div>
                                    <Separator/>
                                    <div className="flex justify-between pt-2"><span className="text-muted-foreground">Tunai</span><span className="font-medium">{formatCurrency(transaction.cash_paid)}</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">Kembali</span><span className="font-medium">{formatCurrency(transaction.change)}</span></div>
                                </div>
                            </div>

                            {isGrosir && (
                                <div className="space-y-2">
                                    <h4 className="font-semibold text-sm flex items-center gap-2">Grosir <Badge variant="outline">{anyTx.customer_group_snapshot || '—'}</Badge> <Badge variant={anyTx.payment_status === 'piutang' ? 'destructive' : anyTx.payment_status === 'lunas_sebagian' ? 'secondary' : 'secondary'}>{anyTx.payment_status === 'piutang' ? 'PIUTANG' : anyTx.payment_status === 'lunas_sebagian' ? 'CICILAN' : 'LUNAS'}</Badge></h4>
                                    <div className="border rounded-lg p-4 space-y-2 text-sm bg-amber-50/50 dark:bg-amber-950/20">
                                        <div className="flex justify-between"><span className="text-muted-foreground">Pelanggan</span><span className="font-medium">{anyTx.customer_name_snapshot || '—'} <span className="text-xs text-muted-foreground">({anyTx.customer_id || '-'})</span></span></div>
                                        <div className="flex justify-between"><span className="text-muted-foreground">TOP</span><span className="font-medium">{anyTx.term_days != null ? `${anyTx.term_days} hari` : '-'}</span></div>
                                        <div className="flex justify-between"><span className="text-muted-foreground">Jatuh Tempo</span><span className="font-medium">{dueDateStr || '-'} {overdueDays > 0 && <Badge variant="destructive" className="ml-1">+{overdueDays}h lewat</Badge>}</span></div>
                                        <div className="flex justify-between"><span className="text-muted-foreground">Sisa Piutang</span><span className={`font-bold ${sisa > 0.5 ? 'text-destructive' : 'text-muted-foreground'}`}>{formatCurrency(sisa)}</span></div>
                                        {voidBlock.blocked && <p className="text-xs text-destructive">Void diblokir: {voidBlock.reason}</p>}
                                    </div>
                                </div>
                            )}

                            {transaction.status === 'voided' && (
                                <div className="space-y-2">
                                    <h4 className="font-semibold text-sm">Detail Void</h4>
                                    <div className="border rounded-lg p-4 space-y-2 text-sm bg-destructive/5">
                                        <div className="flex justify-between"><span className="text-muted-foreground">Waktu Void</span><span className="font-medium">{transaction.voided_at ? format(new Date(transaction.voided_at), 'Pp', { locale: id }) : '-'}</span></div>
                                        <div className="flex justify-between"><span className="text-muted-foreground">Alasan</span><span className="font-medium italic">{transaction.void_reason || '-'}</span></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>
                <DialogFooter className="sm:justify-between gap-2">
                     {transaction.status !== 'voided' && (
                        <AlertDialog open={isVoidAlertOpen} onOpenChange={setIsVoidAlertOpen}>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" className="gap-2" disabled={voidBlock.blocked} title={voidBlock.reason || ''}><Trash2 className="h-4 w-4"/> Void Transaksi</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Void Invoice {transaction.invoice_number}?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        {voidBlock.blocked ? `Void diblokir: ${voidBlock.reason}` : 'Tindakan ini akan membatalkan penjualan, mengembalikan stok, dan tidak dapat dibatalkan.'}
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <div className="py-4">
                                    <Label htmlFor="void-reason" className="mb-2 block text-sm">Alasan Pembatalan</Label>
                                    <Input id="void-reason" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Contoh: Kesalahan input/Batal" disabled={voidBlock.blocked} />
                                    {voidBlock.blocked && <p className="text-xs text-destructive mt-2">{voidBlock.reason} — lunasi piutang pelanggan di menu Piutang.</p>}
                                </div>
                                <AlertDialogFooter>
                                    <AlertDialogCancel onClick={() => setVoidReason('')}>Batal</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleVoidConfirm} disabled={voidBlock.blocked}>Konfirmasi Void</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                     )}
                     <div className="flex-1 flex justify-end gap-2">
                        <Button variant="outline" className="gap-2" onClick={handlePrint}><Printer className="h-4 w-4"/> Cetak</Button>
                        <Button onClick={() => onOpenChange(false)}>Tutup</Button>
                     </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default React.memo(TransactionDetailDialog);