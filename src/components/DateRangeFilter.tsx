import * as React from "react"
import { endOfDay, startOfDay, subDays, startOfMonth, endOfMonth, subMonths, format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type DateRangePreset = 'today' | 'last7' | 'last30' | 'lastMonth' | 'custom';

interface DateRangeFilterProps extends React.HTMLAttributes<HTMLDivElement> {
    date: DateRange | undefined;
    setDate: (date: DateRange | undefined) => void;
    preset?: DateRangePreset;
}

export function DateRangeFilter({
  className,
  date,
  setDate,
  preset: p = 'today',
}: DateRangeFilterProps) {
    const [preset, setPreset] = React.useState<DateRangePreset>(p);

    const handlePresetChange = (value: string) => {
        const newPreset = value as DateRangePreset;
        if (newPreset === 'custom') return; // Custom is set automatically
        setPreset(newPreset);
        
        const now = new Date();
        let newDate: DateRange | undefined;
        switch(newPreset) {
            case 'today':
                newDate = { from: startOfDay(now), to: endOfDay(now) };
                break;
            case 'last7':
                newDate = { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
                break;
            case 'last30':
                newDate = { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
                break;
            case 'lastMonth':
                 const lastMonthDate = subMonths(now, 1);
                newDate = { from: startOfMonth(lastMonthDate), to: endOfMonth(lastMonthDate) };
                break;
            default:
                newDate = undefined;
        }
        setDate(newDate);
    }
    
    const handleDateSelect = (newDate: DateRange | undefined) => {
        setDate(newDate);
        setPreset('custom'); // When a date is manually picked, it becomes a custom range
    }

  return (
    <div className={cn("grid gap-2 sm:flex sm:items-center", className)}>
        <Select value={preset} onValueChange={handlePresetChange}>
            <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Pilih periode" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="today">Hari Ini</SelectItem>
                <SelectItem value="last7">7 Hari Terakhir</SelectItem>
                <SelectItem value="last30">30 Hari Terakhir</SelectItem>
                <SelectItem value="lastMonth">Bulan Lalu</SelectItem>
                <SelectItem value="custom" disabled>Rentang Kustom</SelectItem>
            </SelectContent>
        </Select>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-full sm:w-[260px] justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "dd MMM yyyy")} -{" "}
                  {format(date.to, "dd MMM yyyy")}
                </>
              ) : (
                format(date.from, "dd MMM yyyy")
              )
            ) : (
              <span>Pilih tanggal</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={handleDateSelect}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
