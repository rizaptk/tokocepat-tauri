import { useStore } from '@/lib/store';
import { Transaction } from '@/lib/types';
import { ScrollArea } from './ui/scroll-area';
import { ReceiptText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface TransactionDisplayProps {
    onSelectTransaction: (transaction: Transaction) => void;
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
};


export function TransactionDisplay({ onSelectTransaction }: TransactionDisplayProps) {
    const { transactions, activeShift } = useStore();
    const shiftTransactions = transactions.filter(t => t.shift_id === activeShift?.id);

    if (shiftTransactions.length === 0) {
        return (
            <div className="py-6 px-6 flex-1 flex">
                <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center bg-card border rounded-lg">
                    <ReceiptText className="h-16 w-16 text-muted-foreground" />
                    <h3 className="text-xl font-semibold">No Transactions Yet</h3>
                    <p className="text-muted-foreground">No transactions have been made in this shift.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 min-h-0 px-4">
            <ScrollArea className="h-full min-h-0 border border-border bg-card rounded-lg">
                <div className="flex flex-col divide-y divide-border/40">
                    {shiftTransactions.map(tx => (
                        <div
                            key={tx.id}
                            className={cn(
                                "flex items-center py-3 px-5 gap-3 cursor-pointer hover:bg-accent",
                                tx.status === 'voided' && 'opacity-50'
                            )}
                            onClick={() => onSelectTransaction(tx)}
                        >
                            <div className="flex-1">
                                <p className="font-semibold text-sm">{tx.invoice_number}</p>
                                <p className="text-xs text-muted-foreground">
                                    {(() => {
                                        const date = new Date(tx.created_at);
                                        if (isNaN(date.getTime())) return 'Invalid Date';
                                        return format(date, 'p');
                                    })()}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="font-bold text-sm">{formatCurrency(tx.total)}</p>
                                <p className={cn(
                                    "text-xs font-semibold",
                                    tx.status === 'paid' ? 'text-green-600' : 'text-destructive'
                                )}>
                                    {tx.status.toUpperCase()}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}
