import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/lib/store';
import { buildNotifications, NotificationType, AppNotification } from '@/lib/notifications';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Bell, AlertTriangle, Package, ArchiveX, Clock, CheckCheck, X, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

const GROUP_ORDER: NotificationType[] = ['low_stock', 'out_of_stock', 'void', 'promo_expiry'];
const GROUP_LABEL: Record<NotificationType, string> = {
    low_stock: 'Stok Menipis',
    out_of_stock: 'Stok Habis',
    void: 'Transaksi Void',
    promo_expiry: 'Promo & Voucher',
};

function getIcon(type: NotificationType) {
    switch (type) {
        case 'low_stock': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
        case 'out_of_stock': return <Package className="h-4 w-4 text-destructive" />;
        case 'void': return <ArchiveX className="h-4 w-4 text-muted-foreground" />;
        case 'promo_expiry': return <Clock className="h-4 w-4 text-primary" />;
        default: return null;
    }
}

export function NotificationBell() {
    const navigate = useNavigate();
    const {
        products, productVariants, transactions, activeShift, promos,
        readNotificationIds, markAsRead, markAllNotificationsRead,
        dismissedNotificationIds, dismissNotification,
    } = useStore();

    const notifications = useMemo(() => buildNotifications({
        products,
        productVariants,
        transactions,
        activeShiftId: activeShift?.id,
        promos,
        readNotificationIds,
        dismissedNotificationIds,
    }), [products, productVariants, transactions, activeShift, promos, readNotificationIds, dismissedNotificationIds]);

    const groups = useMemo(() => GROUP_ORDER
        .map(type => ({ type, items: notifications.filter(n => n.type === type) }))
        .filter(g => g.items.length > 0), [notifications]);

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const [expanded, setExpanded] = useState<Set<NotificationType>>(new Set());
    const toggleExpanded = (type: NotificationType) =>
        setExpanded(prev => {
            const next = new Set(prev);
            if (next.has(type)) next.delete(type); else next.add(type);
            return next;
        });

    const handleOpen = (notif: AppNotification) => {
        if (!notif.isRead) markAsRead(notif.id);
        navigate(notif.route);
    };

    const handleMarkAll = () => {
        const unread = notifications.filter(n => !n.isRead).map(n => n.id);
        if (unread.length > 0) markAllNotificationsRead(unread);
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="relative size-9" aria-label="Notifikasi">
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                        <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 justify-center rounded-full p-0 text-xs">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </Badge>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[22rem] p-0">
                <div className="flex items-center justify-between p-4 border-b">
                    <div>
                        <h4 className="font-medium leading-none">Notifikasi</h4>
                        <p className="text-sm text-muted-foreground">Pemberitahuan sistem terbaru.</p>
                    </div>
                    {unreadCount > 0 && (
                        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={handleMarkAll}>
                            <CheckCheck className="h-3.5 w-3.5" />
                            Tandai semua dibaca
                        </Button>
                    )}
                </div>
                <ScrollArea className="h-80">
                    {groups.length > 0 ? (
                        <div className="p-2 space-y-2">
                            {groups.map(group => {
                                const isExpanded = expanded.has(group.type);
                                const visible = isExpanded ? group.items : group.items.slice(0, 3);
                                return (
                                    <div key={group.type} className="rounded-lg border">
                                        <div className="flex items-center gap-2 px-3 py-2">
                                            {getIcon(group.type)}
                                            <span className="text-sm font-medium">{GROUP_LABEL[group.type]}</span>
                                            <Badge variant="secondary" className="ml-auto">{group.items.length}</Badge>
                                        </div>
                                        <div className="px-1 pb-1 space-y-0.5">
                                            {visible.map(notif => (
                                                <div
                                                    key={notif.id}
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={() => handleOpen(notif)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpen(notif); }
                                                    }}
                                                    className={cn(
                                                        'group grid cursor-pointer grid-cols-[auto_1fr_auto] items-start gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/70',
                                                        notif.isRead ? 'opacity-60' : 'bg-info/10'
                                                    )}
                                                >
                                                    <div className="pt-0.5">
                                                        <span className={cn('block h-2 w-2 rounded-full', notif.isRead ? 'bg-transparent' : 'bg-info')} />
                                                    </div>
                                                    <div className="min-w-0 space-y-0.5">
                                                        <p className="truncate text-sm font-medium leading-none">{notif.description}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {formatDistanceToNow(new Date(notif.timestamp), { addSuffix: true })}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                dismissNotification(notif.id);
                                                            }}
                                                            title="Sembunyikan"
                                                            aria-label="Sembunyikan notifikasi"
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                            {group.items.length > 3 && (
                                                <button
                                                    type="button"
                                                    className="flex w-full items-center justify-center gap-1 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                                                    onClick={() => toggleExpanded(group.type)}
                                                >
                                                    <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', isExpanded && 'rotate-180')} />
                                                    {isExpanded ? 'Tutup' : `${group.items.length - 3} lainnya`}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada notifikasi baru.</p>
                    )}
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}
