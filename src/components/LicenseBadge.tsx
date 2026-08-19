import { useLicense } from "@/hooks/useLicense";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Zap, ShieldCheck, ShieldAlert, Loader2, Clock, CreditCard } from "lucide-react";

/**
 * Compact license status indicator. Optimized for small header spaces and
 * dashboard summary cards: shows a short status label (Trial / Lisensi Aktif /
 * not-active states) with a link to the license management page.
 */
export function LicenseBadge({ size = "compact" }: { size?: "compact" | "full" }) {
  const { status, licenseDetails } = useLicense();
  const isTrial = licenseDetails?.isTrial === true;

  if (status === 'LOADING') {
    return (
      <Badge variant="outline" className="gap-1.5 text-[10px] font-medium text-muted-foreground h-6">
        <Loader2 className="size-3 animate-spin" /> Lisensi
      </Badge>
    );
  }

  // Active (valid) states — include trial.
  if (status === 'VALID' || status === 'EXPIRES_SOON') {
    const isLifetime = licenseDetails?.expiresAt === 'Never';
    const detail = isTrial
      ? `Trial berakhir ${new Date(licenseDetails.expiresAt).toLocaleDateString('id-ID')}`
      : isLifetime
        ? 'Selamanya'
        : `Berakhir ${new Date(licenseDetails.expiresAt).toLocaleDateString('id-ID')}`;

    if (size === 'full') {
      return (
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="gap-1.5 text-[11px] py-1">
            {isTrial ? <Zap className="size-3.5 text-primary" /> : <ShieldCheck className="size-3.5 text-success" />}
            {isTrial ? 'Masa Trial Aktif' : 'Lisensi Aktif'}
          </Badge>
          <span className="text-xs text-muted-foreground hidden sm:inline">{detail}</span>
          <Link to="/license" className="text-xs font-medium text-primary hover:underline">Kelola &rarr;</Link>
        </div>
      );
    }

    return (
      <Link to="/license">
        <Badge variant={isTrial ? 'secondary' : 'default'} className="gap-1.5 text-[10px] font-medium h-6">
          {isTrial ? <Zap className="size-3 text-primary" /> : <ShieldCheck className="size-3 text-success" />}
          {isTrial ? 'Trial' : 'Lisensi Aktif'}
        </Badge>
      </Link>
    );
  }

  // Not active — show a warning badge rather than nothing at all.
  const labelMap: Record<string, string> = {
    EXPIRED: 'Lisensi Kedaluwarsa',
    INVALID: 'Lisensi Tidak Valid',
    TAMPERED: 'Jam Sistem Salah',
    CLONED: 'Perangkat Berbeda',
    NOT_FOUND: 'Belum Aktivasi',
  };
  const label = labelMap[status] || 'Perlu Aktivasi';

  return (
    <Link to="/license" title={label}>
      <Badge variant="destructive" className="gap-1.5 text-[10px] font-medium h-6">
        {status === 'EXPIRED' || status === 'INVALID' ? <ShieldAlert className="size-3" /> : status === 'NOT_FOUND' ? <CreditCard className="size-3" /> : status === 'TAMPERED' ? <Clock className="size-3" /> : <ShieldAlert className="size-3" />}
        {label}
      </Badge>
    </Link>
  );
}