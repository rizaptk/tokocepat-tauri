import { useEffect, useRef, useState, useMemo } from "react";
import { Search, X, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type SearchDropdownOption = {
  id: string;
  label: string;
  subLabel?: string;
  data?: any;
};

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSelect: (opt: SearchDropdownOption) => void;
  options: SearchDropdownOption[];
  placeholder?: string;
  emptyText?: string;
  maxVisible?: number;
  autoFocus?: boolean;
  onBlurClear?: boolean;
  multiple?: boolean;
  selectedIds?: string[];
  onBarcodeScan?: (barcode: string) => void;
};

export function SearchDropdown({
  value,
  onChange,
  onSelect,
  options,
  placeholder = "Cari...",
  emptyText = "Tidak ditemukan",
  maxVisible = 8,
  autoFocus,
  multiple,
  selectedIds,
  onBarcodeScan,
}: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [lastInputTime, setLastInputTime] = useState(0);

  const filtered = useMemo(() => {
    if (!value.trim()) return options.slice(0, maxVisible);
    const q = value.toLowerCase();
    return options.filter(o => {
      if (o.label.toLowerCase().includes(q) || o.subLabel?.toLowerCase().includes(q) || o.id.toLowerCase().includes(q)) return true;
      const d: any = o.data;
      if (d?.phone && String(d.phone).toLowerCase().includes(q)) return true;
      if (d?.barcode && String(d.barcode).toLowerCase().includes(q)) return true;
      return false;
    }).slice(0, maxVisible);
  }, [options, value, maxVisible]);

  useEffect(() => { setActive(0); }, [filtered]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (!open || filtered.length === 0) return;
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, filtered.length]);

  const select = (opt: SearchDropdownOption) => {
    onSelect(opt);
    if (!multiple) setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      if (filtered.length) { setOpen(true); e.preventDefault(); }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(i => (i + 1) % filtered.length);
      setOpen(true);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(i => (i - 1 + filtered.length) % filtered.length);
      setOpen(true);
    } else if (e.key === "Enter") {
      const term = value.trim();
      if (!term) return;
      // barcode fast-input detection (mirrors ProductSearchBar)
      const now = Date.now();
      const isBarcode = onBarcodeScan && (now - lastInputTime < 100 || term.length > 5);
      if (isBarcode) {
        e.preventDefault();
        onBarcodeScan(term);
        onChange("");
        setOpen(false);
        return;
      }
      if (open && filtered[active]) {
        e.preventDefault();
        select(filtered[active]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          ref={inputRef}
          value={value}
          onChange={e => { setLastInputTime(Date.now()); onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="pl-8 pr-8 h-8 bg-card"
          role="combobox"
          aria-expanded={open}
          aria-controls="search-dropdown-list"
          aria-autocomplete="list"
          aria-activedescendant={open && filtered[active] ? `sd-opt-${filtered[active].id}` : undefined}
          autoFocus={autoFocus}
        />
        {value && (
          <button
            type="button"
            onClick={() => { onChange(""); setOpen(false); inputRef.current?.focus(); }}
            className="absolute right-1 top-1/2 -translate-y-1/2 grid size-6 place-items-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Hapus pencarian"
            tabIndex={-1}
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      {open && (
        <div
          ref={listRef}
          id="search-dropdown-list"
          role="listbox"
          className="absolute top-full left-0 z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-56 overflow-auto p-1"
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">{emptyText}</div>
          ) : (
            filtered.map((opt, idx) => {
              const isSelected = multiple && selectedIds?.includes(opt.id);
              return (
                <div
                  key={opt.id}
                  id={`sd-opt-${opt.id}`}
                  role="option"
                  aria-selected={multiple ? !!isSelected : idx === active}
                  data-idx={idx}
                  onMouseEnter={() => setActive(idx)}
                  onMouseDown={e => { e.preventDefault(); select(opt); }}
                  className={cn(
                    "flex cursor-pointer items-center justify-between rounded-sm px-2 py-1.5 text-sm gap-2",
                    idx === active ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                  )}
                >
                  {multiple && <Check className={cn("size-3.5 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />}
                  <span className="truncate font-medium flex-1">{opt.label}</span>
                  {opt.subLabel && <span className="ml-2 shrink-0 text-xs text-muted-foreground truncate max-w-[40%]">{opt.subLabel}</span>}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
