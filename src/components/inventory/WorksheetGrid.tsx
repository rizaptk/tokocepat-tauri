import { memo } from 'react';
import { cn } from '@/lib/utils';
import { useStore } from '@/lib/store';
import type { WorksheetItem } from '@/lib/types';
import { computePhysicalQty } from '@/services/stockService';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

const ACTION_OPTS = [{ value: 'tambah', label: 'Tambah' }, { value: 'kurang', label: 'Kurang' }, { value: 'koreksi', label: 'Koreksi' }] as const;

interface Props {
    items: WorksheetItem[];
    readOnly: boolean;
    onItemUpdate: (id: string, data: Partial<WorksheetItem>) => void;
    onItemRemove: (id: string) => void;
}

const Row = memo(({ index, style, data }: any) => {
    const { items, readOnly, onItemUpdate, onItemRemove } = data as Props & { onItemUpdate: any; onItemRemove: any };
    const item = items[index];
    if (!item) return null;
    const physical = computePhysicalQty(item);
    const products = (window as any).__products_cache as any[] | undefined;
    return (
        <div style={style} className="flex items-center border-b border-border/40 text-sm">
            <div className="w-10 shrink-0 text-center text-xs text-muted-foreground tabular-nums">{index + 1}</div>
            <div className="flex-1 min-w-0 px-2 truncate">
                <div className="truncate font-medium text-sm">{item.product_name_snapshot}</div>
                {item.variant_name_snapshot && <div className="text-xs text-muted-foreground truncate">({item.variant_name_snapshot})</div>}
            </div>
            <div className="w-[120px] shrink-0 px-1">
                {readOnly ? <Badge variant="secondary" className={cn('text-xs', item.action==='tambah' ? 'bg-green-100 text-green-800' : item.action==='kurang' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800')}>{item.action}</Badge>
                    : <Select value={item.action} onValueChange={(v) => onItemUpdate(item.id, { action: v as any })}><SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger><SelectContent>{ACTION_OPTS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>}
            </div>
            <div className="w-[90px] shrink-0 px-1">
                {readOnly ? <span className="text-sm tabular-nums">{item.qty}</span>
                    : <Input type="number" min={0} value={String(item.qty)} onChange={e => onItemUpdate(item.id, { qty: Math.max(0, parseInt(e.target.value) || 0) })} className="h-7 text-center text-sm" />}
            </div>
            <div className="w-[100px] shrink-0 text-center tabular-nums font-medium text-sm">{physical}</div>
            <div className="flex-1 min-w-0 px-1 hidden md:block">
                {readOnly ? <span className="text-xs text-muted-foreground truncate block">{item.notes || '-'}</span>
                    : <Textarea value={item.notes || ''} onChange={e => onItemUpdate(item.id, { notes: e.target.value })} placeholder="Catatan" className="h-7 text-xs p-1.5 min-h-0" rows={1} />}
            </div>
            <div className="w-12 shrink-0 flex justify-center">
                {!readOnly && <Button variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => onItemRemove(item.id)}><Trash2 className="size-4" /></Button>}
            </div>
        </div>
    );
});
Row.displayName='WorksheetRow';

export function WorksheetGrid({ items, readOnly, onItemUpdate, onItemRemove }: Props) {
    if (items.length === 0) {
        return <div className="h-full flex items-center justify-center text-sm text-muted-foreground p-8">{readOnly ? 'Tidak ada item' : 'Cari produk di atas untuk menambah ke worksheet'}</div>;
    }
    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center bg-muted/50 border-y text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <div className="w-10 shrink-0 text-center py-2">No</div>
                <div className="flex-1 px-2 py-2">Produk</div>
                <div className="w-[120px] shrink-0 px-1 py-2 text-center">Aksi</div>
                <div className="w-[90px] shrink-0 px-1 py-2 text-center">Jumlah</div>
                <div className="w-[100px] shrink-0 py-2 text-center">Stok Fisik</div>
                <div className="flex-1 px-1 py-2 hidden md:block">Keterangan</div>
                <div className="w-12 shrink-0" />
            </div>
            <div className="flex-1 min-h-0">
                <AutoSizer>{({ height, width }) => (
                    <List height={height} width={width} itemCount={items.length} itemSize={44} itemData={{ items, readOnly, onItemUpdate, onItemRemove }}>{Row as any}</List>
                )}</AutoSizer>
            </div>
        </div>
    );
}
