import { useState, useRef } from 'react';
import { TokoCepatLogo } from './TokoCepatLogo';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { CheckCircle2, ShieldCheck, Zap, CreditCard, ArrowLeft, Loader2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

const TERMS_CONDITIONS = [
  {
    title: 'Ketentuan Masa Uji Coba (Trial)',
    body: 'Dengan menyetujui, Anda mendapatkan akses penuh selama 30 hari kalender terhitung sejak aplikasi pertama kali digunakan pada perangkat ini.',
  },
  {
    title: 'Satu Uji Coba per Perangkat',
    body: 'Uji coba hanya dapat digunakan sekali per perangkat. Menghapus atau mengganti database tidak akan memperpanjang atau memulai ulang masa uji coba.',
  },
  {
    title: 'Tanpa Biaya & Tanpa Kewajiban',
    body: 'Masa uji coba tidak dipungut biaya dan tidak mengikat. Setelah masa uji coba berakhir Anda perlu membeli lisensi untuk terus menggunakan aplikasi.',
  },
  {
    title: 'Perlindungan Waktu Sistem',
    body: 'Aplikasi memantau akurasi jam perangkat. Memundurkan jam untuk memperpanjang uji coba dapat mengakibatkan status lisensi ditolak (tampered).',
  },
  {
    title: 'Layanan & Dukungan',
    body: 'Selama masa uji coba, fitur sinkronisasi jaringan mungkin dibatasi. Dukungan teknis diberikan sesuai kebijakan yang berlaku.',
  },
];

export function TrialConsent() {
  const [step, setStep] = useState<'terms' | 'declined'>('terms');
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [alreadyUsed, setAlreadyUsed] = useState(false);
  const submittingRef = useRef(false);

  const handleAgree = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsApplying(true);
    setApplyError(null);
    try {
      await invoke('start_trial');
      window.location.reload();
      return;
    } catch (e: any) {
      submittingRef.current = false;
      setIsApplying(false);
      const msg = String(e ?? '');
      if (msg.toLowerCase().includes('already used')) {
        setAlreadyUsed(true);
        setStep('declined');
      } else {
        setApplyError(msg);
      }
    }
  };

  const openPricing = () => {
    if (isApplying) return;
    invoke('open_pricing');
  };

  if (step === 'declined') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-muted/40 p-4">
        <div className="w-full max-w-md text-center bg-card p-8 rounded-lg shadow-lg">
          {alreadyUsed ? (
            <ShieldCheck className="mx-auto h-16 w-16 text-destructive mb-4" />
          ) : (
            <ShieldCheck className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
          )}
          <h1 className="text-2xl font-bold">
            {alreadyUsed ? 'Uji Coba Tidak Tersedia' : 'Belum Ada Lisensi Aktif'}
          </h1>
          <p className="text-muted-foreground mt-2 mb-6">
            {alreadyUsed
              ? 'Masa uji coba perangkat ini sudah pernah digunakan sebelumnya. Silakan beli lisensi untuk terus menggunakan TokoCepat.'
              : 'Aplikasi belum diaktivasi, sehingga beberapa fitur mungkin dibatasi. Pilih salah satu cara untuk mulai menggunakan TokoCepat.'}
          </p>

          <div className="space-y-3">
            {!alreadyUsed && (
              <Button className="w-full h-11" onClick={handleAgree} disabled={isApplying}>
                {isApplying ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="mr-2 h-4 w-4" />
                )}
                {isApplying ? 'Menerapkan Uji Coba...' : 'Gunakan Masa Uji Coba (30 Hari)'}
              </Button>
            )}
            <Button variant="outline" className="w-full h-11" onClick={openPricing} disabled={isApplying}>
              <CreditCard className="mr-2 h-4 w-4" /> Beli / Unduh Lisensi Penuh
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-lg rounded-xl border bg-card shadow-lg flex flex-col max-h-[90vh]">
        <div className="p-6 pb-4 text-center space-y-2 border-b">
          <div className="flex justify-center">
            <TokoCepatLogo />
          </div>
          <h1 className="text-xl font-bold">Persetujuan & Ketentuan Uji Coba</h1>
          <p className="text-sm text-muted-foreground">
            Sebelum memulai masa uji coba, mohon baca ketentuan berikut.
          </p>
        </div>

        <ScrollArea className="flex-1 min-h-0 px-6 py-4 space-y-4">
          <ul className="space-y-3">
            {TERMS_CONDITIONS.map((t) => (
              <li key={t.title} className="flex gap-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-primary mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">{t.title}</p>
                  <p className="text-sm text-muted-foreground">{t.body}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted-foreground pt-2 border-t">
            Dengan menekan &quot;Setuju & Mulai Uji Coba&quot;, Anda menyatakan telah membaca dan
            menyetujui ketentuan penggunaan di atas.
          </p>
        </ScrollArea>

        {applyError && (
          <p className="text-sm text-destructive bg-destructive/10 mx-6 px-3 py-2 rounded mb-2">
            {applyError}
          </p>
        )}

        <div className="p-6 pt-4 border-t space-y-2">
          <Button className="w-full h-11" onClick={handleAgree} disabled={isApplying}>
            {isApplying ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Zap className="mr-2 h-4 w-4" />
            )}
            {isApplying ? 'Menerapkan Uji Coba...' : 'Setuju & Mulai Uji Coba (30 Hari)'}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-10" onClick={() => { if (!isApplying) setStep('declined'); }} disabled={isApplying}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Tidak Sekarang
            </Button>
            <Button variant="outline" className="h-10" onClick={openPricing} disabled={isApplying}>
              <CreditCard className="mr-2 h-4 w-4" /> Beli Lisensi
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}