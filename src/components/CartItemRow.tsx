import { motion } from 'framer-motion';
import { useStore } from '@/lib/store';
import { CartItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { Trash2, Minus, Plus } from 'lucide-react';
import { useIsMobile } from '@/lib/ismobile-store';
import { formatIDR as formatCurrency } from '@/lib/format';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

interface CartItemRowProps {
    item: CartItem;
    onEditItem?: (item: CartItem) => void;
    isReadOnly?: boolean;
}

export const CartItemRow = ({ item, onEditItem, isReadOnly = false }: CartItemRowProps) => {
    const reducedMotion = usePrefersReducedMotion();
    const removeFromCart = useStore((state) => state.removeFromCart);
    const updateQuantity = useStore((state) => state.updateQuantity);
    const { isMobile } = useIsMobile();

    return (
        <motion.div
            layout
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, x: '-100%', transition: { duration: 0.1 } }}
            className="relative overflow-hidden"
        >
            {/* Accent flash layer */}
            <motion.div
                initial={{ opacity: 0.6 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="absolute inset-0 bg-green-600 pointer-events-none z-10"
            />

            {isMobile && !isReadOnly && (
                <div className="absolute right-0 flex items-center justify-center bg-destructive px-6 py-0.5 rounded-md">
                    <Trash2 className="size-4 text-destructive-foreground" />
                </div>
            )}

            <motion.div
                drag={isMobile && !isReadOnly && !reducedMotion ? "x" : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={{ left: 0.5, right: 0 }}
                onDragEnd={(_, info) => {
                    if (isMobile && !isReadOnly && info.offset.x < -100) {
                        removeFromCart(item.cartItemId);
                    }
                }}
                className={cn(
                    "flex items-start gap-3 p-4 relative z-10",
                    onEditItem && item.has_variant && !isReadOnly && "cursor-pointer hover:bg-accent"
                )}
                onClick={() => onEditItem && !isReadOnly && onEditItem(item)}
            >
                <div className="flex-1 space-y-1">
                    <p className="font-medium leading-tight mt-1">{item.name} {item.brand && <span className="text-muted-foreground font-normal">· {item.brand}</span>} {item.selectedVariant ? `(${item.selectedVariant.name})` : ''}</p>
                    <p className="text-sm text-muted-foreground md:hidden">
                        {item.quantity} x {formatCurrency(item.price)}
                    </p>
                </div>
                <div className="hidden md:flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full opacity-40 hover:opacity-100"
                        aria-label={`Kurangi jumlah ${item.name}`}
                        onClick={() => updateQuantity(item.cartItemId, Math.max(1, item.quantity - 1))}
                        disabled={item.quantity <= 1 || isReadOnly}
                    >
                        <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center font-medium text-sm">{item.quantity}</span>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 rounded-full opacity-40 hover:opacity-100" 
                        aria-label={`Tambah jumlah ${item.name}`}
                        onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                        disabled={isReadOnly}
                    >
                        <Plus className="h-3 w-3" />
                    </Button>
                </div>
                <div className="w-24 text-right">
                    <p className="font-semibold mt-1">{formatCurrency(item.price * item.quantity)}</p>
                </div>
                <div className="hidden md:block" onClick={(e) => e.stopPropagation()}>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive rounded-full" 
                        aria-label={`Hapus ${item.name}`}
                        onClick={() => removeFromCart(item.cartItemId)}
                        disabled={isReadOnly}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </motion.div>
        </motion.div>
    );
};
