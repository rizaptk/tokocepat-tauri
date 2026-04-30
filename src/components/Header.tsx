import { Link, useNavigate } from "react-router-dom";
import { LogOut, ParkingSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TokoCepatLogo } from "@/components/TokoCepatLogo";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useStore } from "@/lib/store";
import { useState, useMemo, useCallback, useEffect } from "react";
import { Label } from "./ui/label";
import { PendingCartsDialog } from "./PendingCartsDialog";
import { ThemeToggle } from "./ThemeButtons";
import { NotificationBell } from "./NotificationBell";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";

export function Header() {
  const navigate = useNavigate();
  const [declaredCash, setDeclaredCash] = useState(0);
  const [isPendingCartDialogOpen, setIsPendingCartDialogOpen] = useState(false);
  const activeShift = useStore((state) => state.activeShift);
  const transactions = useStore((state) => state.transactions);
  const pendingCarts = useStore(state => state.pendingCarts);
  const closeShift = useStore((state) => state.closeShift);
  const cash = useCurrencyFormat();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };
  
  const { shiftRevenue, expectedCash } = useMemo(() => {
    const activeShiftTransactions = activeShift ? transactions.filter(t => t.shift_id === activeShift.id && t.status === 'paid') : [];
    const revenue = activeShiftTransactions.reduce((sum, t) => sum + t.total, 0);
    return { shiftRevenue: revenue, expectedCash: activeShift ? activeShift.opening_cash + revenue : 0 };
  }, [activeShift, transactions]);
  
  useEffect(() => {
    setDeclaredCash(parseInt(cash.raw));
  }, [cash.raw])
  
  const handleCloseShift = useCallback(() => {
    closeShift(declaredCash);
    // setDeclaredCash(0);
    cash.setRaw('0');
    navigate('/dashboard');
  }, [closeShift, declaredCash, navigate]);


  return (
    <>
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-4 bg-transparent px-4 md:px-6">
      <Link to="/">
        <TokoCepatLogo />
      </Link>
      
      <div className="flex items-center gap-2">
        
         {pendingCarts.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setIsPendingCartDialogOpen(true)}>
                <ParkingSquare className="mr-2 h-4 w-4"/> Parked ({pendingCarts.length})
            </Button>
        )}
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                    <LogOut className="mr-2 h-4 w-4"/> Tutup Sif
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Tutup Sif</AlertDialogTitle>
                <AlertDialogDescription>
                    Hitung total uang di laci dan masukkan jumlah akhirnya. Tindakan ini tidak dapat dibatalkan.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-4">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Kas Awal</span>
                        <span className="font-medium">{formatCurrency(activeShift?.opening_cash || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Total Penjualan</span>
                        <span className="font-medium">{formatCurrency(shiftRevenue)}</span>
                    </div>
                    <div className="flex justify-between items-center font-semibold text-base">
                        <span>Ekspektasi Kas</span>
                        <span>{formatCurrency(expectedCash)}</span>
                    </div>
                    <div>
                        <Label htmlFor="declared-cash">Kas Aktual (Uang di Laci)</Label>
                        <div className="relative mt-1">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">Rp</span>
                            <Input 
                                id="declared-cash"
                                type="text"
                                inputMode="numeric" 
                                placeholder="Masukkan jumlah uang tunai" 
                                value={cash.value}
                                onChange={cash.onChange}
                                className="pl-10 text-lg" 
                                autoFocus
                            />
                        </div>
                    </div>
                    {declaredCash > 0 && (
                        <div className="flex justify-between items-center font-semibold text-base">
                            <span>Selisih</span>
                            <span className={`font-medium ${declaredCash - expectedCash !== 0 ? 'text-destructive' : 'text-green-600'}`}>{formatCurrency(declaredCash - expectedCash)}</span>
                        </div>
                    )}
                </div>
                <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={handleCloseShift} disabled={declaredCash <= 0}>Konfirmasi & Tutup Sif</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
            </AlertDialog>
            <NotificationBell />
            <ThemeToggle />
        </div>


    </header>
    <PendingCartsDialog isOpen={isPendingCartDialogOpen} onOpenChange={setIsPendingCartDialogOpen} />
    </>
  );
}
