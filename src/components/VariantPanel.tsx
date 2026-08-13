import { useState, useEffect, useMemo, useRef } from 'react';
import { formatIDR as formatCurrency } from "@/lib/format";
import { Product, ProductVariant } from '@/lib/types';
import { useStore } from '@/lib/store';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from './ui/separator';
import { useGlobalKeydown } from '@/hooks/use-global-keydown';

interface VariantPanelProps {
    item: Product | null;
    onOpenChange: (isOpen: boolean) => void;
    onConfirm: (selectedVariant: ProductVariant) => void;
}

export function VariantPanel({ item, onOpenChange, onConfirm }: VariantPanelProps) {
    const { productVariants } = useStore();
    const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
    const [isDesktop, setIsDesktop] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    const variantsForProduct = useMemo(() => {
        if (!item) return [];
        return productVariants.filter(v => v.product_id === item.id);
    }, [item, productVariants]);

    useEffect(() => {
        if (item) {
            // Pre-select the first variant if available
            if (variantsForProduct.length > 0) {
                setSelectedVariantId(variantsForProduct[0].id);
            }
        } else {
            setSelectedVariantId(null);
        }
    }, [item, variantsForProduct]);
    
    useEffect(() => {
        const mediaQuery = window.matchMedia("(min-width: 768px)");
        setIsDesktop(mediaQuery.matches);
        const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
    }, []);

    const selectedVariant = useMemo(() => {
        return variantsForProduct.find(v => v.id === selectedVariantId);
    }, [selectedVariantId, variantsForProduct]);

    const finalPrice = useMemo(() => {
        if (!item) return 0;
        const variantPrice = selectedVariant?.additional_price || 0;
        return item.price + variantPrice;
    }, [item, selectedVariant]);

    const handleConfirm = () => {
        if (selectedVariant) {
            onConfirm(selectedVariant);
        }
    };
    
    useGlobalKeydown({
        key: 'Enter',
        handler: handleConfirm,
        enabled: !!item && !!selectedVariant,
        bindTo: contentRef,
    });
    
    

    return (
        <Sheet open={!!item} onOpenChange={onOpenChange}>
            <SheetContent ref={contentRef} side={isDesktop ? 'right' : 'bottom'} className={isDesktop ? "w-[400px] sm:w-[540px] flex flex-col" : "h-auto flex flex-col"}>
                {item && (
                    <>
                        <SheetHeader>
                            <SheetTitle>Pilih Varian untuk {item.name}</SheetTitle>
                            <SheetDescription>Pilih salah satu varian di bawah. Harga dasar: {formatCurrency(item.price)}</SheetDescription>
                        </SheetHeader>
                        <ScrollArea className="flex-1 -mx-6 px-6">
                            <RadioGroup onValueChange={setSelectedVariantId} value={selectedVariantId || ''} className="py-4 space-y-2">
                                {variantsForProduct.map(variant => (
                                    <Label 
                                        key={variant.id} 
                                        htmlFor={variant.id} 
                                        className="flex items-center justify-between p-4 border rounded-lg has-checked:bg-accent has-checked:border-primary cursor-pointer"
                                    >
                                        <div className="flex items-center gap-4">
                                            <RadioGroupItem value={variant.id} id={variant.id} />
                                            <span>{variant.name}</span>
                                        </div>
                                        {variant.additional_price > 0 && <span className="text-sm font-medium">+{formatCurrency(variant.additional_price)}</span>}
                                    </Label>
                                ))}
                            </RadioGroup>
                        </ScrollArea>
                         <SheetFooter className="mt-auto">
                           <div className="w-full space-y-4">
                               <Separator />
                                <div className="flex justify-between items-center text-lg font-bold">
                                    <span>Total Harga</span>
                                    <span>{formatCurrency(finalPrice)}</span>
                                </div>
                                <Button onClick={handleConfirm} disabled={!selectedVariant} className="w-full" size="lg">
                                    Lanjut
                                </Button>
                           </div>
                        </SheetFooter>
                    </>
                )}
            </SheetContent>
        </Sheet>
    );
}
