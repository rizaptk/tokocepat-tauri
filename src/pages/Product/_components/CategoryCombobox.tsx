import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import type { Category } from "@/lib/types";

interface CategoryComboboxProps {
    categories: Category[];
    value?: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

export const CategoryCombobox = ({ categories, value, onChange, placeholder = "Pilih kategori" }: CategoryComboboxProps) => {
    const [open, setOpen] = useState(false);
    const selected = categories.find(c => c.id === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between font-normal"
                >
                    {selected ? selected.name : placeholder}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start">
                <Command>
                    <CommandInput placeholder="Cari kategori..." />
                    <CommandList>
                        <CommandEmpty>Kategori tidak ditemukan.</CommandEmpty>
                        <CommandGroup>
                            {categories.map(cat => (
                                <CommandItem
                                    key={cat.id}
                                    value={cat.name}
                                    onSelect={() => {
                                        onChange(cat.id);
                                        setOpen(false);
                                    }}
                                >
                                    <Check className={cn("mr-2 h-4 w-4", value === cat.id ? "opacity-100" : "opacity-0")} />
                                    {cat.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};
