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

/**
 * B — Stacked Transaction + Check (matches neon cards image).
 * Use for app icon (512), splash mark, or alternative orb.
 */
export function KastokoMarkB({ className, size = 40 }: { className?: string; size?: number }) {
  return (
    <span
      aria-hidden
      className={cn("relative flex shrink-0 items-center justify-center overflow-hidden rounded-[12px] border border-cyan-300/30", className)}
      style={{ width: size, height: size, background: "radial-gradient(120% 120% at 32% 28%, #5ad2d6 0%, #7b2cf0 45%, #0a84ff 100%)" }}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-[6%] h-[88%] w-[88%]" fill="none">
        <rect x="10" y="38" rx="7" width="68" height="38" fill="#1a1040" stroke="#7af8ff" strokeWidth="2.2" transform="rotate(-14 44 57)" />
        <rect x="14" y="30" rx="7" width="68" height="38" fill="#1e0f4a" stroke="#7af8ff" strokeWidth="2.4" transform="rotate(-12 48 49)" />
        <circle cx="28" cy="42" r="2.2" fill="#ff7ab6" />
        <circle cx="31.5" cy="42" r="2.2" fill="#ffd166" />
        <path d="M 28 60 L 38 70 L 62 38 L 56 32 L 38 56 L 32 50 Z" fill="url(#kastokoCheckB)" stroke="#7af8ff" strokeWidth="0.9" strokeLinejoin="round" />
        <defs>
          <linearGradient id="kastokoCheckB" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8ef9ff" />
            <stop offset="100%" stopColor="#0a84ff" />
          </linearGradient>
        </defs>
      </svg>
    </span>
  );
}
