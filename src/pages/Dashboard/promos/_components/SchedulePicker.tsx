import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toLocalInput, fromLocalInput } from '@/lib/promo-model';

export interface ScheduleValue {
    starts_at?: string;
    ends_at?: string;
}

const PRESETS = [
    { key: '1 Hari', ms: 24 * 60 * 60 * 1000 },
    { key: '1 Minggu', ms: 7 * 24 * 60 * 60 * 1000 },
    { key: '1 Bulan', ms: 30 * 24 * 60 * 60 * 1000 },
] as const;

/**
 * Mandatory validity window with quick presets (1 hari / 1 minggu / 1 bulan) plus
 * editable start & end datetime inputs.
 */
export function SchedulePicker({ value, onChange, label = 'Rentang Berlaku', required = true }: {
    value: ScheduleValue;
    onChange: (patch: Partial<ScheduleValue>) => void;
    label?: string;
    required?: boolean;
}) {
    const [mode, setMode] = useState<string>('custom');

    const invalid = !!(value.starts_at && value.ends_at && new Date(value.ends_at) <= new Date(value.starts_at));

    return (
        <div className="space-y-2">
            <Label>
                {label}
                {required && <span className="ml-0.5 text-destructive">*</span>}
            </Label>
            <div className="flex flex-wrap gap-1.5">
                {PRESETS.map(p => (
                    <button
                        key={p.key}
                        type="button"
                        onClick={() => {
                            const now = new Date();
                            onChange({ starts_at: now.toISOString(), ends_at: new Date(now.getTime() + p.ms).toISOString() });
                            setMode(p.key);
                        }}
                        className={cn(
                            'rounded-lg border px-2.5 py-1 text-xs font-semibold',
                            mode === p.key ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'
                        )}
                    >
                        Berlaku {p.key}
                    </button>
                ))}
                <button
                    type="button"
                    onClick={() => setMode('custom')}
                    className={cn(
                        'rounded-lg border px-2.5 py-1 text-xs font-semibold',
                        mode === 'custom' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'
                    )}
                >
                    Kustom
                </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Mulai</Label>
                    <Input
                        type="datetime-local"
                        value={toLocalInput(value.starts_at)}
                        onChange={(e) => { onChange({ starts_at: fromLocalInput(e.target.value) }); setMode('custom'); }}
                    />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Berakhir</Label>
                    <Input
                        type="datetime-local"
                        value={toLocalInput(value.ends_at)}
                        onChange={(e) => { onChange({ ends_at: fromLocalInput(e.target.value) }); setMode('custom'); }}
                    />
                </div>
            </div>
            {invalid && <p className="text-xs text-destructive">Tanggal berakhir harus setelah tanggal mulai.</p>}
        </div>
    );
}