

import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Play, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"

interface PendingCartsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function PendingCartsDialog({ isOpen, onOpenChange }: PendingCartsDialogProps) {
  const { pendingCarts, resumeCart, deletePendingCart } = useStore();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };
  
  const handleResume = (id: string) => {
    resumeCart(id);
    onOpenChange(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pesanan Terparkir</DialogTitle>
          <DialogDescription>
            Lanjutkan pesanan yang diparkir atau hapus dari daftar.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-96 -mx-6 px-6">
            <div className="py-4 space-y-4">
                {pendingCarts.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                        <p>Tidak ada pesanan terparkir.</p>
                    </div>
                ) : (
                    pendingCarts.map(cart => (
                        <Card key={cart.id}>
                            <CardHeader className="p-4 pb-2">
                                <CardTitle>{cart.name}</CardTitle>
                                <CardDescription>
                                    {cart.itemCount} items &bull; Total: {formatCurrency(cart.total)}
                                </CardDescription>
                            </CardHeader>
                            <CardFooter className="flex justify-end gap-2">
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" size="sm">
                                            <Trash2 className="mr-2 h-4 w-4"/> Hapus
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Hapus Pesanan?</AlertDialogTitle>
                                            <AlertDialogDescription>Pesanan "{cart.name}" akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Batal</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => deletePendingCart(cart.id)}>Ya, Hapus</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                                <Button size="sm" onClick={() => handleResume(cart.id)}>
                                    <Play className="mr-2 h-4 w-4"/> Buka
                                </Button>
                            </CardFooter>
                        </Card>
                    ))
                )}
            </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
