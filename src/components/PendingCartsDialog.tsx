
"use client";

import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
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
          <DialogTitle>Parked Carts</DialogTitle>
          <DialogDescription>
            Resume a previously parked cart or delete it.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-96 -mx-6 px-6">
            <div className="py-4 space-y-4">
                {pendingCarts.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                        <p>No carts are parked.</p>
                    </div>
                ) : (
                    pendingCarts.map(cart => (
                        <Card key={cart.id}>
                            <CardHeader>
                                <CardTitle>{cart.name}</CardTitle>
                                <CardDescription>
                                    {cart.itemCount} items &bull; Total: {formatCurrency(cart.total)}
                                </CardDescription>
                            </CardHeader>
                            <CardFooter className="flex justify-end gap-2">
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" size="sm">
                                            <Trash2 className="mr-2 h-4 w-4"/> Delete
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                            <AlertDialogDescription>This will permanently delete "{cart.name}". This action cannot be undone.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => deletePendingCart(cart.id)}>Confirm Delete</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                                <Button size="sm" onClick={() => handleResume(cart.id)}>
                                    <Play className="mr-2 h-4 w-4"/> Resume
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
