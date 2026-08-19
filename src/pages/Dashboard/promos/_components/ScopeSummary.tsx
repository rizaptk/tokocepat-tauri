import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

/**
 * Read-only summary of the scope chosen from the left-panel checkboxes. The
 * left-panel selection is the SINGLE source of scope for both Diskon and Voucher.
 */
export function ScopeSummary({ selectedProductIds, selectedCategoryIds, onClear, hint, emptyHint }: {
    selectedProductIds: Set<string>;
    selectedCategoryIds: Set<string>;
    onClear?: () => void;
    hint?: string;
    emptyHint?: string;
}) {
    const count = selectedProductIds.size + selectedCategoryIds.size;
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <Label>Sasaran Produk/Kategori</Label>
                {count > 0 && onClear && (
                    <button type="button" onClick={onClear} className="text-xs font-medium text-muted-foreground hover:text-foreground">
                        Bersihkan
                    </button>
                )}
            </div>
            {count > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                    {selectedProductIds.size > 0 && <Badge variant="secondary">{selectedProductIds.size} produk</Badge>}
                    {selectedCategoryIds.size > 0 && <Badge variant="secondary">{selectedCategoryIds.size} kategori</Badge>}
                </div>
            ) : (
                <p className="text-xs text-muted-foreground">{emptyHint}</p>
            )}
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
    );
}