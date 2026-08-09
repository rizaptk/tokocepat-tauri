import { useMemo } from "react";
import ClassicCashierPage from "./ClassicCashierPage";

export default function CashierPage() {
    const Page = useMemo(() => ClassicCashierPage, []);

    return (
        <Page/>
    )
}