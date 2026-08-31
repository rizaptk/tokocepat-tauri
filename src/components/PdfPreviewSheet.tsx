import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PdfPreviewSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    pdfBytes: Uint8Array | null;
    title: string;
    filename: string;
}

export function PdfPreviewSheet({ open, onOpenChange, pdfBytes, title }: PdfPreviewSheetProps) {
    const [url, setUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!pdfBytes || !open) {
            if (url) { URL.revokeObjectURL(url); setUrl(null); }
            return;
        }
        const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        setUrl(blobUrl);
        return () => { URL.revokeObjectURL(blobUrl); };
    }, [pdfBytes, open]);

    useEffect(() => {
        if (!open && url) { URL.revokeObjectURL(url); setUrl(null); }
    }, [open]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[66vw] w-[66vw] h-[80vh] p-0 flex flex-col resize overflow-auto bg-card [&>button]:hidden" aria-describedby={undefined}>
                <DialogHeader className="shrink-0 flex flex-row items-center justify-between gap-2 px-4 py-3 border-b">
                    <div className="min-w-0 flex-1">
                        <DialogTitle className="text-sm font-semibold truncate">{title}</DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground truncate">Pratinjau PDF — gunakan toolbar PDF untuk Simpan (Ctrl+S) atau Cetak (Ctrl+P)</DialogDescription>
                    </div>
                    <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={() => onOpenChange(false)} aria-label="Tutup">
                        <X className="size-4" />
                    </Button>
                </DialogHeader>
                <div className="flex-1 min-h-0 bg-muted/20 p-3 flex items-center justify-center">
                    {!url ? (
                        <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                            <Loader2 className="size-8 animate-spin" />
                        </div>
                    ) : (
                        <iframe
                            id="pdf-preview-iframe"
                            src={url}
                            title={title}
                            className="w-full h-full border rounded bg-white shadow-sm"
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
