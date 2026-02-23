import { CartDisplay } from "./CartDisplay";

export function Cart() {
    return (
        <aside className="hidden md:flex h-full max-h-screen w-full max-w-sm flex-col border-l bg-background">
            <CartDisplay />
        </aside>
    );
}
