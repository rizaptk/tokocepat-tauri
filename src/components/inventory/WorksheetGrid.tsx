import { memo } from 'react';
import { cn } from '@/lib/utils';
import { useStore } from '@/lib/store';
import type { WorksheetItem } from '@/lib/types';
import { computePhysicalQty } from '@/services/stockService';
import { normalizeProductUoms } from '@/lib/uom';
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

const ColumnClass = {
    no: "flex items-center justify-center shrink-0 w-10 text-xs text-muted-foreground border-r border-border/50",
    name: "flex items-center gap-2 flex-1 min-w-0 px-2 border-r border-border/50",
    brand: "hidden sm:flex items-center text-sm text-muted-foreground truncate w-28 shrink-0 px-2 border-l border-border/50",
    category: "hidden md:flex items-center text-sm text-muted-foreground truncate w-28 shrink-0 px-2 border-l border-border/50",
    stok: "flex items-center justify-end shrink-0 text-right tabular-nums w-20 border-l border-border/50 px-2",
    aksi: "flex items-center justify-center shrink-0 w-28 border-l border-border/50 px-1",
    jumlah: "flex items-center justify-center shrink-0 w-44 border-l border-border/50 px-1 gap-1",
    stokFisik: "flex items-center justify-end shrink-0 text-right tabular-nums font-semibold w-16 border-l border-border/50 px-2",
    keterangan: "flex items-center shrink-0 w-40 border-l border-border/50 px-1 hidden md:flex",
};

const Row = memo(({ index, style, data }: any) => {
    const { items, readOnly, onItemUpdate, onItemRemove, products, categories } = data as Props & { products: any[]; categories: any[]; onItemUpdate: any; onItemRemove: any };
    const item = items[index];
    if (!item) return null;
    const physical = computePhysicalQty(item);
    const prod = products.find((p: any) => p.id === item.product_id);
    const brand = prod?.brand || '—';
    const cat = categories.find((c: any) => c.id === prod?.category_id)?.name || '—';
    const uoms = prod ? normalizeProductUoms(prod as any).uoms || [] : [];
    const hasMultiUom = uoms.length > 1;
    return (
        <div style={style} className="flex items-center border-b border-border/50 bg-card text-sm hover:bg-accent h-9">
            <div className={ColumnClass.no}>{index + 1}</div>
            <div className={ColumnClass.name}><span className="text-sm font-normal truncate">{item.product_name_snapshot}</span>{item.variant_name_snapshot && <span className="text-xs text-muted-foreground">({item.variant_name_snapshot})</span>}</div>
            <div className={ColumnClass.brand}>{brand}</div>
            <div className={ColumnClass.category}>{cat}</div>
            <div className={ColumnClass.stok}><span className="font-bold text-sm tabular-nums">{item.system_qty}</span></div>
            <div className={ColumnClass.aksi}>
                {readOnly ? <Badge variant="secondary" className={cn('text-xs', item.action==='tambah' ? 'bg-green-100 text-green-800' : item.action==='kurang' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800')}>{item.action}</Badge>
                    : <Select value={item.action} onValueChange={(v) => onItemUpdate(item.id, { action: v as any })}><SelectTrigger className="h-7 text-xs w-full"><SelectValue /></SelectTrigger><SelectContent>{ACTION_OPTS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>}
            </div>
            <div className={ColumnClass.jumlah}>
                {readOnly ? <span className="text-sm tabular-nums">{item.qty} {item.uom_name}</span>
                    : <>
                        <Input type="number" min={0} value={String(item.qty)} onChange={e => onItemUpdate(item.id, { qty: Math.max(0, parseInt(e.target.value) || 0) })} className="h-7 flex-1 text-center text-sm" />
                        {hasMultiUom ? (
                            <Select value={item.uom_id} onValueChange={v => {
                                const u = uoms.find((x: any) => x.id === v);
                                if (u) onItemUpdate(item.id, { uom_id: u.id, uom_name: u.name, uom_factor: u.factor } as any);
                            }}><SelectTrigger className="h-7 w-16 text-xs"><SelectValue /></SelectTrigger><SelectContent>{uoms.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent></Select>
                        ) : <span className="text-xs text-muted-foreground w-8 text-center">{item.uom_name}</span>}
                    </>}
            </div>
            <div className={ColumnClass.stokFisik}><span className={cn("tabular-nums", physical > item.system_qty ? "text-success" : physical < item.system_qty ? "text-destructive" : "")}>{physical}</span></div>
            <div className={ColumnClass.keterangan}>
                {readOnly ? <span className="text-xs text-muted-foreground truncate block w-full">{item.notes || '-'}</span>
                    : <Input value={item.notes || ''} onChange={e => onItemUpdate(item.id, { notes: e.target.value })} placeholder="Catatan" className="h-7 text-xs" />}
            </div>
            <div className="w-10 shrink-0 flex justify-center border-l border-border/50">
                {!readOnly && <Button variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => onItemRemove(item.id)}><Trash2 className="size-4" /></Button>}
            </div>
        </div>
    );
});
Row.displayName='WorksheetRow';

export function WorksheetGrid({ items, readOnly, onItemUpdate, onItemRemove }: Props) {
    const { products, categories } = useStore();
    if (items.length === 0) {
        return <div className="h-full flex items-center justify-center text-sm text-muted-foreground p-8">{readOnly ? 'Tidak ada item' : 'Cari produk di atas untuk menambah ke worksheet'}</div>;
    }
    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center bg-card border rounded-t-lg h-8 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <div className={ColumnClass.no}>No</div>
                <div className={ColumnClass.name}>Produk</div>
                <div className={ColumnClass.brand}>Merek</div>
                <div className={ColumnClass.category}>Kategori</div>
                <div className={ColumnClass.stok}>Stok</div>
                <div className={ColumnClass.aksi}>Aksi</div>
                <div className={ColumnClass.jumlah}>Jumlah</div>
                <div className={ColumnClass.stokFisik}>Stok Fisik</div>
                <div className={ColumnClass.keterangan}>Keterangan</div>
                <div className="w-10 shrink-0 border-l border-border/50" />
            </div>
            <div className="flex-1 min-h-0 border-x border-b rounded-b-lg overflow-hidden bg-card">
                <AutoSizer>{({ height, width }) => (
                    <List height={height} width={width} itemCount={items.length} itemSize={36} itemData={{ items, readOnly, onItemUpdate, onItemRemove, products, categories }}>{Row as any}</List>
                )}</AutoSizer>
            </div>
        </div>
    );
}
