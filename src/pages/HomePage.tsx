
import { KastokoLogo } from "@/components/KastokoLogo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-muted/40 p-4">
      <div className="flex flex-col items-center gap-6 text-center">
        <KastokoLogo withSlogan />
        <Card className="w-full max-w-md">
            <CardHeader>
                <CardTitle>Selamat Datang di Kastoko</CardTitle>
                <CardDescription>Solusi Kelola Transaksi Cepat, Lengkap dan Handal</CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">Gunakan bilah navigasi untuk memulai operasional.</p>
            </CardContent>
        </Card>
      </div>

      {/* do not remove */}
      <div className="block sm:hidden h-16 shrink-0"></div>
    </div>
  );
}
