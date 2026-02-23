"use client";

import Link from "next/link";
import { Barcode, LayoutDashboard, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TokoCepatLogo } from "@/components/TokoCepatLogo";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type HeaderProps = {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
};

export function Header({ searchTerm, setSearchTerm }: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
      <TokoCepatLogo />
      <div className="flex flex-1 items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search products..."
            className="pl-8 sm:w-[300px] md:w-[200px] lg:w-[300px]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon" className="h-9 w-9">
              <Barcode className="h-4 w-4" />
              <span className="sr-only">Scan Barcode</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Barcode Scanner</DialogTitle>
              <DialogDescription>
                This feature is for demonstration purposes. In a real app, this would open the device's camera to scan product barcodes.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center gap-4 py-8">
              <Barcode className="h-24 w-24 text-muted-foreground" />
              <p className="text-muted-foreground">Ready to scan</p>
            </div>
          </DialogContent>
        </Dialog>

        <Button asChild variant="outline" size="icon" className="h-9 w-9">
          <Link href="/dashboard">
            <LayoutDashboard className="h-4 w-4" />
            <span className="sr-only">Dashboard</span>
          </Link>
        </Button>
      </div>
    </header>
  );
}
