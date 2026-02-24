"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const navLinks = [
    { href: "/product", label: "Products" },
    { href: "/product/categories", label: "Categories" },
    { href: "/product/modifiers", label: "Modifiers" },
    { href: "/product/inventory", label: "Inventory" },
];

export function ProductNav() {
    const pathname = usePathname();

    return (
        <div className="border-b bg-background">
            <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex w-max space-x-2 px-4 py-2">
                    {navLinks.map((link) => (
                        <Button
                            key={link.href}
                            variant={pathname === link.href ? "secondary" : "ghost"}
                            asChild
                            className="text-sm"
                        >
                            <Link href={link.href}>{link.label}</Link>
                        </Button>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}
