import { KastokoLogo, StartOrb as KastokoStartOrb } from './KastokoLogo';

/**
 * @deprecated Use KastokoLogo from './KastokoLogo' — kept for backward compat.
 * Renders Kastoko (rebrand v0.6.0: Solusi Kelola Transaksi Cepat, Lengkap dan Handal)
 */
export function TokoCepatLogo({ className }: { className?: string }) {
  return <KastokoLogo className={className} />;
}

export const StartOrb = KastokoStartOrb;
export { KastokoLogo };