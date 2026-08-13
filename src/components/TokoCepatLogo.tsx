import { cn } from '@/lib/utils';

/**
 * The Start Orb — the Aurora Till's one licensed curve: a circular mark where
 * the aurora gradient closes, with Win7's faint glass gloss. Everything else
 * in the system is a rectangle; this is the exception on purpose.
 */
export function TokoCepatLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="relative flex size-7 shrink-0 items-center justify-center rounded-full">
        <span aria-hidden className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_32%_28%,#5ad2d6,#0a84ff_55%,#9671ee)]" />
        <span aria-hidden className="pointer-events-none absolute inset-0 rounded-full gloss-chrome" />
      </span>
      <h1 className="text-lg font-bold tracking-tight text-foreground">
        TokoCepat
      </h1>
    </div>
  );
}

export function StartOrb({ className }: { className?: string }) {
  return (
    <span className={cn("relative flex size-6 shrink-0 items-center justify-center rounded-full", className)}>
      <span aria-hidden className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_32%_28%,#5ad2d6,#0a84ff_55%,#9671ee)]" />
      <span aria-hidden className="pointer-events-none absolute inset-0 rounded-full gloss-chrome" />
    </span>
  );
}