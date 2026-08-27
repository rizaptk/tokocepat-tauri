import { cn } from '@/lib/utils';

/**
 * Kastoko — Solusi Kelola Transaksi Cepat, Lengkap dan Handal
 * Rebrand of TokoCepat (v0.6.0). Keeps the Start Orb aurora mark.
 * - Splash: use <KastokoLogo withSlogan />
 * - Header/compact: <KastokoLogo />
 */
export function KastokoLogo({ className, withSlogan = false, sloganClassName }: { className?: string; withSlogan?: boolean; sloganClassName?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="relative flex size-7 shrink-0 items-center justify-center rounded-full">
        <span aria-hidden className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_32%_28%,#5ad2d6,#0a84ff_55%,#9671ee)]" />
        <span aria-hidden className="pointer-events-none absolute inset-0 rounded-full gloss-chrome" />
      </span>
      <div className="flex flex-col leading-none">
        <h1 className="text-lg font-bold tracking-tight text-foreground">
          <span className="font-extrabold">Kas</span><span className="font-semibold">toko</span>
        </h1>
        {withSlogan && (
          <span className={cn("text-[10px] font-medium tracking-wide text-muted-foreground", sloganClassName)}>
            Solusi Kelola Transaksi Cepat, Lengkap dan Handal
          </span>
        )}
      </div>
    </div>
  );
}

// Play Store short: Kelola Transaksi, Cepat Lengkap
export function KastokoShortSlogan() {
  return "Kelola Transaksi, Cepat Lengkap";
}

export function StartOrb({ className }: { className?: string }) {
  return (
    <span className={cn("relative flex size-6 shrink-0 items-center justify-center rounded-full", className)}>
      <span aria-hidden className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_32%_28%,#5ad2d6,#0a84ff_55%,#9671ee)]" />
      <span aria-hidden className="pointer-events-none absolute inset-0 rounded-full gloss-chrome" />
    </span>
  );
}
