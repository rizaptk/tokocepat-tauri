"use client"

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
}

export function DateRangeFilter({
  className,
  date,
  setDate,
}: DateRangeFilterProps) {
    const [preset, setPreset] = React.useState<DateRangePreset>('last30');

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
                <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="last7">Last 7 Days</SelectItem>
                <SelectItem value="last30">Last 30 Days</SelectItem>
                <SelectItem value="lastMonth">Last Month</SelectItem>
                <SelectItem value="custom" disabled>Custom Range</SelectItem>
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
                  {format(date.from, "LLL dd, y")} -{" "}
                  {format(date.to, "LLL dd, y")}
                </>
              ) : (
                format(date.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date</span>
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
