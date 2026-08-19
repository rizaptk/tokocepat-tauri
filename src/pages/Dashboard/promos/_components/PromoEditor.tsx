import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Percent, TicketPercent } from "lucide-react";
import { DiskonForm } from './DiskonForm';
import { VoucherForm } from './VoucherForm';
import { Promotion } from '@/lib/types';

export type PromoEditorTab = 'diskon' | 'voucher';

interface PromoEditorProps {
    draft: Promotion;
    isNew: boolean;
    onChange: (d: Promotion) => void;
    onCancel: () => void;
    onSave: () => void;
    isSaving: boolean;
    products: { id: string; name: string }[];
    categories: { id: string; name: string }[];
    selectedProductIds: Set<string>;
    selectedCategoryIds: Set<string>;
    onClearScope: () => void;
    activeTab: PromoEditorTab;
    onTabChange: (tab: PromoEditorTab) => void;
    existingCodes: string[];
}

/** Right-panel editor mirroring ProductEditor: Diskon | Voucher tabs. */
export const PromoEditor = ({ draft, isNew, onChange, onCancel, onSave, isSaving, products, categories, selectedProductIds, selectedCategoryIds, onClearScope, activeTab, onTabChange, existingCodes }: PromoEditorProps) => {
    const common = {
        draft,
        isNew,
        onChange,
        onCancel,
        onSave,
        isSaving,
        products,
        categories,
        selectedProductIds,
        selectedCategoryIds,
        onClearScope,
    };

    return (
        <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as PromoEditorTab)} layoutId="promo-editor-tabs" className="h-full flex flex-col min-h-0">
            <div className="px-3 py-2 grid grid-cols-1 shrink-0 border-b border-border/60">
                <TabsList className="grid w-full grid-cols-2 min-w-96">
                    <TabsTrigger value="diskon"><Percent className="w-3.5 h-3.5 mr-2 text-primary" />Diskon</TabsTrigger>
                    <TabsTrigger value="voucher"><TicketPercent className="w-3.5 h-3.5 mr-2 text-destructive" />Voucher</TabsTrigger>
                </TabsList>
            </div>
            <TabsContent value="diskon" className="grid grid-cols-1 w-full mt-0 overflow-x-auto min-h-0">
                <DiskonForm {...common} />
            </TabsContent>
            <TabsContent value="voucher" className="grid grid-cols-1 w-full mt-0 overflow-x-auto min-h-0">
                <VoucherForm {...common} existingCodes={existingCodes} />
            </TabsContent>
        </Tabs>
    );
};