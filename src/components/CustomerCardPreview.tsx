import { useEffect, useRef } from 'react';
import { Customer, CustomerGroup } from '@/lib/types';
import { useStore } from '@/lib/store';

function formatCardId(id: string) {
  // cust-a1b2c3d4 -> CUST A1B2 C3D4
  const clean = id.replace(/^cust-/, '').toUpperCase();
  const spaced = clean.replace(/(.{4})/g, '$1 ').trim();
  return `CUST ${spaced}`;
}

export function CustomerCardPreview({ customer, group }: { customer: Customer; group?: CustomerGroup }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const storeConfig = useStore(s => s.storeConfig);
  const storeName = storeConfig?.store_name || 'Kastoko';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // @ts-ignore
        const bwipjs = (await import('bwip-js')).default;
        if (!canvasRef.current || cancelled) return;
        bwipjs.toCanvas(canvasRef.current, {
          bcid: 'code128',
          text: customer.id,
          scale: 3,
          height: 10,
          includetext: false,
          backgroundcolor: 'FFFFFF',
        });
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [customer.id]);

  const groupColor = (group as any)?.color || (group?.rank === 3 ? '#f59e0b' : group?.rank === 2 ? '#94a3b8' : group?.rank === 1 ? '#38bdf8' : '#64748b');
  const topDays = customer.topDays ?? group?.topDays ?? 0;

  return (
    <div className="flex justify-center p-2">
      <div
        className="relative w-[360px] h-[226px] rounded-[16px] overflow-hidden shadow-xl border border-white/10 flex flex-col justify-between p-5 text-white"
        style={{
          background: `linear-gradient(135deg, #0f172a 0%, #1e293b 45%, ${groupColor}22 100%), linear-gradient(135deg, #0f172a, #334155)`,
        }}
      >
        {/* accent stripe */}
        <div className="absolute top-0 left-0 right-0 h-[4px]" style={{ background: groupColor }} />
        {/* subtle grid */}
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(white 1px, transparent 1px)', backgroundSize: '14px 14px' }} />

        {/* header */}
        <div className="relative flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] tracking-[0.18em] font-semibold opacity-70">KASTOKO MEMBER</span>
            <span className="text-[11px] font-medium opacity-90">{storeName}</span>
          </div>
          <span className="rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide text-white" style={{ background: groupColor }}>
            {group ? group.name.toUpperCase() : 'UMUM'}
          </span>
        </div>

        {/* chip + contactless */}
        <div className="relative flex items-center gap-3 -mt-1">
          <div className="w-[38px] h-[28px] rounded-[4px] bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-600 shadow-inner flex flex-col justify-between p-[4px]">
            <div className="h-[1px] bg-black/20" />
            <div className="flex gap-[3px] flex-1 py-[2px]">
              <div className="flex-1 border border-black/20 rounded-[1px]" />
              <div className="flex-1 border border-black/20 rounded-[1px]" />
            </div>
            <div className="h-[1px] bg-black/20" />
          </div>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="opacity-80">
            <path d="M6 9a3 3 0 0 1 3-3M9 15a3 3 0 0 1-3-3M15 9a3 3 0 0 0-3-3M12 15a3 3 0 0 0 3-3M7.5 12h9" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <span className="ml-auto text-[9px] opacity-60 font-mono">{customer.id}</span>
        </div>

        {/* name + formatted id */}
        <div className="relative space-y-1">
          <p className="text-[15px] font-bold tracking-[0.12em] uppercase drop-shadow-sm">{customer.name}</p>
          <p className="text-[11px] font-mono tracking-[0.22em] opacity-90">{formatCardId(customer.id)}</p>
        </div>

        {/* barcode */}
        <div className="relative bg-white rounded-[6px] p-1.5 flex flex-col items-center">
          <canvas ref={canvasRef} className="w-full h-[38px]" />
          <span className="text-[7px] font-mono tracking-[0.18em] text-black/60 -mt-1">{customer.id}</span>
        </div>

        {/* footer */}
        <div className="relative flex justify-between text-[8px] opacity-70 font-medium">
          <span>{customer.phone || '—'}</span>
          <span>Member {new Date(customer.created_at).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })} · {topDays === 0 ? 'COD' : `TOP ${topDays} hari`}</span>
        </div>
      </div>
    </div>
  );
}
