import { cn } from '@/lib/utils';

/**
 * Kastoko — Solusi Kelola Transaksi Cepat, Lengkap dan Handal
 * Rebrand of TokoCepat (v0.6.0). Keeps the Start Orb aurora mark.
 * - Splash: use <KastokoLogo withSlogan />
 * - Header/compact: <KastokoLogo />
 */
export function KastokoMark({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <span
      aria-hidden
      className={cn("relative flex shrink-0 items-center justify-center overflow-hidden rounded-[8px]", className)}
      style={{
        width: size,
        height: size,
        background: "linear-gradient(135deg, #0a84ff 0%, #5a3bff 55%, #7b2cf0 100%)",
        boxShadow: "0 1px 6px rgba(10,132,255,0.35)",
      }}
    >
      <svg viewBox="0 0 100 100" className="h-[78%] w-[78%]" fill="none">
        {/* receipt */}
        <rect x="18" y="14" rx="6" width="48" height="56" fill="white" />
        <path d="M 58 14 L 66 22 L 58 22 Z" fill="#dff6ff" stroke="#bfefff" strokeWidth="0.6" />
        <path d="M 18 70 L 21 68 L 24 70 L 27 68 L 30 70 L 33 68 L 36 70 L 39 68 L 42 70 L 45 68 L 48 70 L 51 68 L 54 70 L 57 68 L 60 70 L 63 68 L 66 70 L 66 71.5 L 18 71.5 Z" fill="white" />
        <rect x="24" y="26" rx="1.8" width="30" height="3.2" fill="#0a84ff" opacity="0.14" />
        <rect x="24" y="32" rx="1.8" width="26" height="3.2" fill="#0a84ff" opacity="0.14" />
        <rect x="24" y="38" rx="1.8" width="32" height="3.2" fill="#0a84ff" opacity="0.14" />
        <rect x="24" y="48" width="40" height="0.7" rx="0.35" fill="#0a84ff" opacity="0.18" />
        {/* check badge */}
        <circle cx="62" cy="60" r="14.5" fill="#08122e" />
        <circle cx="62" cy="60" r="13" fill="none" stroke="#7af8ff" strokeWidth="1.2" />
        <circle cx="62" cy="60" r="11.5" fill="url(#kastokoMarkCheck)" />
        <path d="M 54 60.5 L 59 65.5 L 70 54" fill="none" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        <defs>
          <linearGradient id="kastokoMarkCheck" x1="15%" y1="10%" x2="85%" y2="90%">
            <stop offset="0%" stopColor="#7af8ff" />
            <stop offset="100%" stopColor="#0a84ff" />
          </linearGradient>
        </defs>
      </svg>
    </span>
  );
}

export function KastokoLogo({ className, withSlogan = false, sloganClassName }: { className?: string; withSlogan?: boolean; sloganClassName?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <KastokoMark size={28} />
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
  // kept for compat — now renders the same KastokoMark (square) so every orb is replaced
  return <KastokoMark className={className} size={24} />;
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
      <svg viewBox="0 0 100 100" className="absolute inset-[3%] h-[94%] w-[94%]" fill="none">
        {/* maximized stack — 72% width */}
        <rect x="8" y="36" rx="7" width="74" height="40" fill="#1a1040" stroke="#7af8ff" strokeWidth="2.6" strokeLinejoin="round" transform="rotate(-12 45 56)" />
        <rect x="10" y="28" rx="7" width="74" height="40" fill="#1e0f4a" stroke="#7af8ff" strokeWidth="2.8" strokeLinejoin="round" transform="rotate(-10 47 48)" />
        <circle cx="26" cy="40" r="2.1" fill="#ff7ab6" />
        <circle cx="29.2" cy="40" r="2.1" fill="#ffd166" />
        {/* shrunk check ~72% — small for 16px legibility */}
        <path d="M 30.5 60.5 L 37 67 L 60 42 L 56 38 L 37 54.5 L 33.5 51 Z" fill="url(#kastokoCheckB)" stroke="#7af8ff" strokeWidth="0.85" strokeLinejoin="round" />
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
