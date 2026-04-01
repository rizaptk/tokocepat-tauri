import { usePrinter } from "@/hooks/usePrinter";

/**
 * A headless component that manages the global print queue.
 * It should be mounted once in the main layout.
 */
export function PrintManager() {
    usePrinter();
    return null;
}
