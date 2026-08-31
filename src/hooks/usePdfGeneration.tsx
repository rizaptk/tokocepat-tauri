import { useState, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UsePdfGenerationOptions {
    title?: string;
}

interface UsePdfGenerationReturn {
    open: boolean;
    previewOpen: boolean;
    pdfBytes: Uint8Array | null;
    isGenerating: boolean;
    elapsedMs: number;
    pageCount: number | null;
    title: string;
    filename: string;
    setTitle: (t: string) => void;
    setFilename: (f: string) => void;
    setPageCount: (n: number) => void;
    start: (label?: string) => void;
    finish: (bytes: Uint8Array) => void;
    fail: (err: unknown) => void;
    cancel: () => void;
    setPreviewOpen: (v: boolean) => void;
    setOpen: (v: boolean) => void;
}

export function usePdfGeneration(opts: UsePdfGenerationOptions = {}): UsePdfGenerationReturn {
    const [open, setOpen] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [elapsedMs, setElapsedMs] = useState(0);
    const [pageCount, setPageCount] = useState<number | null>(null);
    const [title, setTitle] = useState(opts.title || 'Pratinjau PDF');
    const [filename, setFilename] = useState('document.pdf');
    const cancelledRef = useRef(false);
    const startedAtRef = useRef(0);
    const timerRef = useRef<number | null>(null);

    const start = useCallback((label?: string) => {
        cancelledRef.current = false;
        startedAtRef.current = performance.now();
        setIsGenerating(true);
        setElapsedMs(0);
        setPageCount(null);
        if (label) setTitle(label);
        setOpen(true);
        setPreviewOpen(false);
        setPdfBytes(null);
        if (timerRef.current) window.clearInterval(timerRef.current);
        timerRef.current = window.setInterval(() => {
            setElapsedMs(Math.round(performance.now() - startedAtRef.current));
        }, 100);
    }, []);

    const finish = useCallback((bytes: Uint8Array) => {
        if (cancelledRef.current) return;
        if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
        setIsGenerating(false);
        setPdfBytes(bytes);
        setPreviewOpen(true);
        setOpen(false);
    }, []);

    const fail = useCallback((err: unknown) => {
        if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
        cancelledRef.current = true;
        setIsGenerating(false);
        setOpen(false);
        setPreviewOpen(false);
        setPdfBytes(null);
        console.error('[PDF] generation failed', err);
    }, []);

    const cancel = useCallback(() => {
        cancelledRef.current = true;
        if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
        setIsGenerating(false);
        setOpen(false);
        setPreviewOpen(false);
        setPdfBytes(null);
    }, []);

    return {
        open,
        previewOpen,
        pdfBytes,
        isGenerating,
        elapsedMs,
        pageCount,
        title,
        filename,
        setTitle,
        setFilename,
        setPageCount,
        start,
        finish,
        fail,
        cancel,
        setPreviewOpen,
        setOpen,
    };
}

export function PdfGeneratingOverlay({
    open,
    onCancel,
    title,
    elapsedMs,
    pageCount,
}: {
    open: boolean;
    onCancel: () => void;
    title: string;
    elapsedMs: number;
    pageCount: number | null;
}) {
    const seconds = (elapsedMs / 1000).toFixed(1);
    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
            <DialogContent className="max-w-md p-0 overflow-hidden [&>button]:hidden" aria-describedby={undefined}>
                <div className="flex flex-col items-center justify-center gap-4 px-8 py-10 text-center">
                    <div className="relative">
                        <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center">
                            <FileText className="size-7 text-primary" />
                        </div>
                        <Loader2 className="size-6 animate-spin text-primary absolute -bottom-1 -right-1 bg-card rounded-full p-0.5" />
                    </div>
                    <div className="space-y-1.5">
                        <DialogTitle className="text-base font-semibold">Membuat PDF</DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground">
                            {title} sedang diproses. Harap tunggu…
                        </DialogDescription>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
                        <span className="inline-flex items-center gap-1.5">
                            <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                            {seconds}s
                        </span>
                        {pageCount !== null && (
                            <span className="inline-flex items-center gap-1.5">
                                <FileText className="size-3" />
                                {pageCount} halaman
                            </span>
                        )}
                    </div>
                    <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary/60 animate-pulse w-2/3" />
                    </div>
                    <Button variant="ghost" size="sm" onClick={onCancel} className="text-muted-foreground">
                        Batal
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
