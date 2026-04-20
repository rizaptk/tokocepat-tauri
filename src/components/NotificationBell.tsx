import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Bell, AlertTriangle, Package, ArchiveX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';

type Notification = {
    id: string;
    type: 'low_stock' | 'out_of_stock' | 'void';
    title: string;
    description: string;
    timestamp: string;
};

export function NotificationBell() {
    const { products, productVariants, transactions, activeShift } = useStore();

    const notifications = useMemo((): Notification[] => {
        const notifs: Notification[] = [];

        // Low Stock
        const lowStockProducts = products.filter(p => p.track_stock && !p.has_variant && p.low_stock_alert != null && p.stock > 0 && p.stock <= p.low_stock_alert);
        lowStockProducts.forEach(p => {
            notifs.push({
                id: `low-${p.id}`,
                type: 'low_stock',
                title: 'Stok Menipis',
                description: `Sisa stok ${p.name} tinggal ${p.stock}.`,
                timestamp: new Date().toISOString(),
            });
        });

        const lowStockVariants = productVariants.filter(v => v.track_stock && v.low_stock_alert != null && v.stock > 0 && v.stock <= v.low_stock_alert);
        lowStockVariants.forEach(v => {
            const parent = products.find(p => p.id === v.product_id);
            notifs.push({
                id: `low-${v.id}`,
                type: 'low_stock',
                title: 'Stok Menipis',
                description: `Sisa stok ${parent?.name} (${v.name}) tinggal ${v.stock}.`,
                timestamp: new Date().toISOString(),
            });
        });

        // Out of Stock
        const outOfStockProducts = products.filter(p => p.track_stock && !p.has_variant && p.stock <= 0);
        outOfStockProducts.forEach(p => {
            notifs.push({
                id: `out-${p.id}`,
                type: 'out_of_stock',
                title: 'Stok Habis',
                description: `Stok ${p.name} telah kosong.`,
                timestamp: new Date().toISOString(),
            });
        });

        const outOfStockVariants = productVariants.filter(v => v.track_stock && v.stock <= 0);
        outOfStockVariants.forEach(v => {
            const parent = products.find(p => p.id === v.product_id);
            notifs.push({
                id: `out-${v.id}`,
                type: 'out_of_stock',
                title: 'Stok Habis',
                description: `Stok ${parent?.name} (${v.name}) telah kosong.`,
                timestamp: new Date().toISOString(),
            });
        });
        
        // Voided Transactions in current shift
        if (activeShift) {
            const voidedInShift = transactions.filter(tx => tx.shift_id === activeShift.id && tx.status === 'voided' && tx.voided_at);
            voidedInShift.forEach(tx => {
                notifs.push({
                    id: `void-${tx.id}`,
                    type: 'void',
                    title: 'Transaksi Void',
                    description: `Invoice ${tx.invoice_number} telah dibatalkan.`,
                    timestamp: tx.voided_at!,
                });
            });
        }

        return notifs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [products, productVariants, transactions, activeShift]);
    
    const notificationCount = notifications.length;

    const getIcon = (type: Notification['type']) => {
        switch(type) {
            case 'low_stock': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
            case 'out_of_stock': return <Package className="h-4 w-4 text-destructive" />;
            case 'void': return <ArchiveX className="h-4 w-4 text-muted-foreground" />;
            default: return null;
        }
    }

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="relative size-9">
                    <Bell className="h-4 w-4" />
                    {notificationCount > 0 && (
                        <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 justify-center rounded-full p-0 text-xs">
                            {notificationCount > 9 ? '9+' : notificationCount}
                        </Badge>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0">
                <div className="p-4 border-b">
                    <h4 className="font-medium leading-none">Notifikasi</h4>
                    <p className="text-sm text-muted-foreground">Pemberitahuan sistem terbaru.</p>
                </div>
                <ScrollArea className="h-80">
                   <div className="p-4 space-y-4">
                        {notificationCount > 0 ? (
                            notifications.map(notif => (
                                <div key={notif.id} className="grid grid-cols-[auto_1fr] items-start gap-3">
                                    <div className="flex items-center justify-center h-full pt-0.5">
                                        {getIcon(notif.type)}
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium leading-none">{notif.title}</p>
                                        <p className="text-sm text-muted-foreground">{notif.description}</p>
                                        <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(notif.timestamp), { addSuffix: true })}</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-8">Tidak ada notifikasi baru.</p>
                        )}
                   </div>
                </ScrollArea>
            </PopoverContent>
        </Popover>
    )
}
