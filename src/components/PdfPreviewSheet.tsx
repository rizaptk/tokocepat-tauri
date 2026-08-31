import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Download, Printer, Loader2, X } from 'lucide-react';

interface PdfPreviewSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    pdfBytes: Uint8Array | null;
    title: string;
    filename: string;
}

export function PdfPreviewSheet({ open, onOpenChange, pdfBytes, title, filename }: PdfPreviewSheetProps) {
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

    // cleanup on close
    useEffect(() => {
        if (!open && url) { URL.revokeObjectURL(url); setUrl(null); }
    }, [open]);

    const handleDownload = () => {
        if (!url) return;
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
    };

    const handlePrint = () => {
        if (!url) return;
        const iframe = document.getElementById('pdf-preview-iframe') as HTMLIFrameElement | null;
        iframe?.contentWindow?.print();
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-screen h-screen max-w-none inset-0 p-0 flex flex-col bg-background [&>button:first-of-type]:hidden">
                <SheetHeader className="shrink-0 flex flex-row items-center justify-between gap-2 px-4 py-3 border-b bg-card">
                    <div className="min-w-0">
                        <SheetTitle className="text-base truncate">{title}</SheetTitle>
                        <SheetDescription className="text-xs truncate">{filename}</SheetDescription>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                        <Button variant="outline" size="sm" className="h-8" onClick={handleDownload} disabled={!url}>
                            <Download className="size-4 mr-1.5" />Download
                        </Button>
                        <Button size="sm" className="h-8" onClick={handlePrint} disabled={!url}>
                            <Printer className="size-4 mr-1.5" />Cetak
                        </Button>
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => onOpenChange(false)}>
                            <X className="size-4" />
                        </Button>
                    </div>
                </SheetHeader>
                <div className="flex-1 min-h-0 bg-muted/30 p-2">
                    {!url ? (
                        <div className="h-full flex items-center justify-center text-muted-foreground">
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
            </SheetContent>
        </Sheet>
    );
}
