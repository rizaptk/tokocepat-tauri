import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/** Shared percentage / flat (Rp) discount amount editor. */
export function DiscountFields({ type, value, onChange }: {
    type?: 'percentage' | 'flat';
    value?: number;
    onChange: (patch: { discount_type: 'percentage' | 'flat'; discount_value: number }) => void;
}) {
    const t = type === 'flat' ? 'flat' : 'percentage';
    return (
        <div className="space-y-2">
            <Label>Jenis Diskon</Label>
            <div className="flex flex-wrap gap-2">
                {(['percentage', 'flat'] as const).map(k => (
                    <button
                        key={k}
                        type="button"
                        onClick={() => onChange({ discount_type: k, discount_value: value ?? 0 })}
                        aria-pressed={t === k}
                        className={cn(
                            'rounded-lg border px-3 py-1.5 text-sm font-medium',
                            t === k ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'
                        )}
                    >
                        {k === 'percentage' ? 'Persen' : 'Nominal (Rp)'}
                    </button>
                ))}
            </div>
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                    {t === 'percentage' ? '%' : 'Rp'}
                </span>
                <Input
                    type="number"
                    min={0}
                    value={value ?? 0}
                    onChange={(e) => onChange({ discount_type: t, discount_value: parseFloat(e.target.value) || 0 })}
                    className="pl-8"
                    placeholder={t === 'percentage' ? '10' : '10000'}
                />
            </div>
        </div>
    );
}