
'use client';

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, FileDown, FileText } from 'lucide-react';
import { useIsMobile } from '@/lib/ismobile-store';

export type DateRangePreset = 'today' | 'last7' | 'last30' | 'lastMonth';

interface DateRangeFilterProps {
  range: DateRangePreset;
  onRangeChange: (range: DateRangePreset) => void;
  onExportExcel: () => void;
  onExportPdf: () => void;
  hasData: boolean;
}

export function DateRangeFilter({ range, onRangeChange, onExportExcel, onExportPdf, hasData }: DateRangeFilterProps) {
  const { isMobile } = useIsMobile();

  const excelExportItem = (
    <DropdownMenuItem onSelect={onExportExcel} disabled={!hasData}>
      <FileDown className="mr-2 h-4 w-4" />
      Export to Excel
    </DropdownMenuItem>
  );

  const pdfExportItem = (
    <DropdownMenuItem onSelect={onExportPdf} disabled={!hasData}>
      <FileText className="mr-2 h-4 w-4" />
      Export to PDF
    </DropdownMenuItem>
  );

  if (isMobile) {
    return (
      <div className="md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Date Range</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={range} onValueChange={(value) => onRangeChange(value as DateRangePreset)}>
              <DropdownMenuRadioItem value="today">Today</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="last7">Last 7 Days</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="last30">Last 30 Days</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="lastMonth">Last Month</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            {excelExportItem}
            {pdfExportItem}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <div className="hidden md:flex items-center gap-2">
      <Button variant={range === 'today' ? 'default' : 'outline'} size="sm" onClick={() => onRangeChange('today')}>Today</Button>
      <Button variant={range === 'last7' ? 'default' : 'outline'} size="sm" onClick={() => onRangeChange('last7')}>Last 7 Days</Button>
      <Button variant={range === 'last30' ? 'default' : 'outline'} size="sm" onClick={() => onRangeChange('last30')}>Last 30 Days</Button>
      <Button variant={range === 'lastMonth' ? 'default' : 'outline'} size="sm" onClick={() => onRangeChange('lastMonth')}>Last Month</Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={!hasData}>
            <FileDown className="mr-2 h-4 w-4" />
            <span>Export</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onExportExcel}>
                <FileDown className="mr-2 h-4 w-4"/> Excel (.xlsx)
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onExportPdf}>
                <FileText className="mr-2 h-4 w-4"/> PDF (.pdf)
            </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
