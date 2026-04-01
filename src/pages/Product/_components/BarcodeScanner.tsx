'use client';

import { useZxing } from 'react-zxing';

export const BarcodeScanner = ({ onScanSuccess }: { onScanSuccess: (text: string) => void }) => {
    const { ref } = useZxing({
        onDecodeResult(result) {
            onScanSuccess(result.getText());
        },
    });

    return (
        <div className="flex flex-col items-center justify-center gap-4 py-4">
            <div className="relative w-full max-w-sm aspect-square bg-muted rounded-lg overflow-hidden">
                <video ref={ref} className="w-full h-full object-cover" />
                <div className="absolute inset-0 border-4 border-primary/50 rounded-lg pointer-events-none" />
            </div>
            <p className="text-sm text-muted-foreground">Arahkan kamera ke barcode</p>
        </div>
    );
};
