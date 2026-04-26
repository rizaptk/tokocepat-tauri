import { useStore } from "@/lib/store"
import { useMemo } from "react";
import DefaultCashierPage from "./DefaultCashierPage";
import ClassicCashierPage from "./ClassicCashierPage";


export default function CashierPage() {
    const {customAccess} = useStore();
    const Page = useMemo(() => {
        if (!customAccess?.cashier_layout || customAccess.cashier_layout === 'default') {
            return DefaultCashierPage;
        }
        return ClassicCashierPage;
    },[customAccess])

    return (
        <Page/>
    )
}