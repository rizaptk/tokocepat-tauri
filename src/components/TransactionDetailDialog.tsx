
"use client";

import { useState } from "react";
import { Transaction } from "@/lib/types";
import { useStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { voidTransaction } from "@/services/transactionService";
import { generateReceiptText, printReceipt } from "@/lib/receipt";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ReceiptText, Trash2, Printer, Clock } from "lucide-react";

interface TransactionDetailDialogProps {
    transaction: Transaction | null;
    onOpenChange: (isOpen: boolean) => void;
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(amount);
};

export function TransactionDetailDialog({ transaction, onOpenChange }: TransactionDetailDialogProps) {
    const { storeConfig, shifts } = useStore();
    const { toast } = useToast();
    const [voidReason, setVoidReason] = useState("");
    const [isVoidAlertOpen, setIsVoidAlertOpen] = useState(false);

    if (!transaction) return null;

    const shiftForTransaction = transaction.shift_id ? shifts.find(s => s.id === transaction.shift_id) : null;
    
    const handleVoidConfirm = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        if (!voidReason.trim()) {
            toast({ variant: 'destructive', title: 'Reason required', description: 'Please provide a reason for voiding.' });
            e.preventDefault();
            return;
        }
        try {
            await voidTransaction(transaction.id, voidReason);
            toast({ title: 'Transaction Voided', description: `Invoice ${transaction.invoice_number} has been successfully voided.` });
            setVoidReason("");
            setIsVoidAlertOpen(false);
            onOpenChange(false); // Close the main dialog
        } catch (error: any) {
            console.error("Failed to void transaction:", error);
            toast({ variant: "destructive", title: "Error", description: error.message || "Could not void the transaction." });
            e.preventDefault();
        }
    };

    const handlePrint = () => {
        if (storeConfig) {
            const receiptText = generateReceiptText(transaction, storeConfig);
            printReceipt(receiptText);
        } else {
            toast({ variant: "destructive", title: "Cannot Print", description: "Store configuration is missing." });
        }
    };

    return (
        <Dialog open={!!transaction} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md md:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <span>Invoice: {transaction.invoice_number}</span>
                         <Badge variant={transaction.status === 'voided' ? 'destructive' : 'secondary'}>{transaction.status.toUpperCase()}</Badge>
                    </DialogTitle>
                    <div className="text-sm text-muted-foreground">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                            <span>{format(new Date(transaction.created_at), 'PPPPp')}</span>
                            {shiftForTransaction && (
                                <span className="flex items-center gap-1.5 text-xs mt-1 sm:mt-0">
                                    <Clock className="h-3 w-3" />
                                    Shift: {format(new Date(shiftForTransaction.opened_at), 'p')}
                                </span>
                            )}
                        </div>
                    </div>
                </DialogHeader>
                <div className="py-4 space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                    {/* Items List */}
                    <div className="space-y-2">
                        <h4 className="font-semibold">Items</h4>
                        <div className="border rounded-md">
                           {transaction.items.map((item, index) => (
                               <div key={`${item.id}-${index}`} className="flex justify-between items-start p-3 border-b last:border-none">
                                   <div className="flex-1">
                                       <p className="font-medium">{item.product_snapshot.name}</p>
                                       {item.selected_modifiers_snapshot && item.selected_modifiers_snapshot.length > 0 && (
                                            <ul className="text-xs text-muted-foreground pl-4">
                                                {item.selected_modifiers_snapshot.map(mod => (
                                                    <li key={`${mod.groupId}-${mod.item.id}`}>- {mod.item.name}</li>
                                                ))}
                                            </ul>
                                        )}
                                       <p className="text-sm text-muted-foreground">{item.qty} x {formatCurrency(item.price_snapshot)}</p>
                                   </div>
                                   <p className="font-medium">{formatCurrency(item.subtotal)}</p>
                               </div>
                           ))}
                        </div>
                    </div>

                    {/* Financial Summary */}
                     <div className="space-y-2">
                        <h4 className="font-semibold">Summary</h4>
                         <div className="border rounded-lg p-4 space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-medium">{formatCurrency(transaction.subtotal)}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span className="font-medium">{formatCurrency(transaction.tax_amount)}</span></div>
                            <Separator/>
                            <div className="flex justify-between text-base font-bold"><span >Total</span><span>{formatCurrency(transaction.total)}</span></div>
                             <Separator/>
                            <div className="flex justify-between pt-2"><span className="text-muted-foreground">Cash Paid</span><span className="font-medium">{formatCurrency(transaction.cash_paid)}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Change</span><span className="font-medium">{formatCurrency(transaction.change)}</span></div>
                         </div>
                     </div>

                    {transaction.status === 'voided' && (
                        <div className="space-y-2">
                            <h4 className="font-semibold">Void Details</h4>
                            <div className="border rounded-lg p-4 space-y-2 text-sm bg-destructive/5">
                                <div className="flex justify-between"><span className="text-muted-foreground">Voided At</span><span className="font-medium">{transaction.voided_at ? format(new Date(transaction.voided_at), 'Pp') : 'N/A'}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Reason</span><span className="font-medium italic">{transaction.void_reason || 'N/A'}</span></div>
                            </div>
                        </div>
                    )}
                </div>
                <DialogFooter className="sm:justify-between gap-2">
                     {transaction.status !== 'voided' && (
                        <AlertDialog open={isVoidAlertOpen} onOpenChange={setIsVoidAlertOpen}>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" className="gap-2"><Trash2/> Void Transaction</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Void Invoice {transaction.invoice_number}?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This will reverse the sale, return items to stock, and cannot be undone.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <div className="py-4">
                                    <Label htmlFor="void-reason" className="mb-2 block">Reason for Voiding</Label>
                                    <Input id="void-reason" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="e.g., Customer canceled" />
                                </div>
                                <AlertDialogFooter>
                                    <AlertDialogCancel onClick={() => setVoidReason('')}>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleVoidConfirm}>Confirm Void</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                     )}
                     <div className="flex-1 flex justify-end gap-2">
                        <Button variant="outline" className="gap-2" onClick={handlePrint}><Printer/> Print</Button>
                        <Button onClick={() => onOpenChange(false)}>Close</Button>
                     </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
