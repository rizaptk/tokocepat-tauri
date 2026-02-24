"use client";

import { useDbStore } from "@/lib/db-store";
import { useEffect } from "react";

export function DbProvider({ children }: { children: React.ReactNode }) {
    const initializeDb = useDbStore((state) => state.initialize);
    const isInitialized = useDbStore((state) => state.isInitialized);

    useEffect(() => {
        if (!isInitialized) {
            initializeDb();
        }
    }, [initializeDb, isInitialized]);

    return <>{children}</>;
}
