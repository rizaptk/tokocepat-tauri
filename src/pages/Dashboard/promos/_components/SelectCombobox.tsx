import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

interface SelectItem {
    id: string;
    name: string;
}

export function MultiSelect({ items, selected, onChange, placeholder }: {
    items: SelectItem[];
    selected: string[];
    onChange: (ids: string[]) => void;
    placeholder: string;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');

    const toggle = (id: string) => {
        onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
    };

    const filtered = useMemo(() => {
        const q = query.toLowerCase();
        return q ? items.filter(i => i.name.toLowerCase().includes(q)) : items;
    }, [items, query]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button type="button" variant="outline" role="combobox" className="w-full justify-start font-normal text-left min-h-9 h-auto flex-wrap gap-1 py-1.5">
                    {selected.length === 0 ? (
                        <span className="text-muted-foreground">{placeholder}</span>
                    ) : (
                        selected.slice(0, 3).map(id => {
                            const item = items.find(i => i.id === id);
                            return <Badge key={id} variant="secondary" className="font-normal">{item?.name || id}</Badge>;
                        })
                    )}
                    {selected.length > 3 && <Badge variant="outline">+{selected.length - 3}</Badge>}
                    <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="start">
                <Command>
                    <CommandInput placeholder="Cari..." value={query} onValueChange={setQuery} />
                    <CommandList>
                        <CommandEmpty>Tidak ditemukan.</CommandEmpty>
                        <CommandGroup className="max-h-56 overflow-auto">
                            {filtered.map(item => (
                                <CommandItem key={item.id} value={item.name} onSelect={() => toggle(item.id)}>
                                    <Check className={cn("mr-2 h-4 w-4", selected.includes(item.id) ? "opacity-100" : "opacity-0")} />
                                    {item.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

export function SingleSelect({ items, value, onChange, placeholder }: {
    items: SelectItem[];
    value: string;
    onChange: (id: string) => void;
    placeholder: string;
}) {
    const [open, setOpen] = useState(false);
    const selected = items.find(i => i.id === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button type="button" variant="outline" role="combobox" className="w-full justify-between font-normal">
                    {selected ? selected.name : <span className="text-muted-foreground">{placeholder}</span>}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="start">
                <Command>
                    <CommandInput placeholder="Cari..." />
                    <CommandList>
                        <CommandEmpty>Tidak ditemukan.</CommandEmpty>
                        <CommandGroup className="max-h-56 overflow-auto">
                            {items.map(item => (
                                <CommandItem key={item.id} value={item.name} onSelect={() => { onChange(item.id); setOpen(false); }}>
                                    <Check className={cn("mr-2 h-4 w-4", value === item.id ? "opacity-100" : "opacity-0")} />
                                    {item.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}