import * as React from "react";
import { format, setMonth, setYear } from "date-fns";
import { CalendarIcon, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const YEARS = Array.from({ length: 81 }, (_, i) => 1960 + i);

interface DatePickerProps {
  date: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  disabledDates?: (date: Date) => boolean;
  /** Highlights dates (e.g. already applied leave) with a marker */
  markedDates?: (date: Date) => boolean;
  /** Legend text shown below the calendar when markedDates is provided */
  markedLabel?: string;
}

export function DatePicker({
  date,
  onDateChange,
  placeholder = "Select date",
  disabled = false,
  className,
  disabledDates,
  markedDates,
  markedLabel = "Leave already applied",
}: DatePickerProps) {
  const [calendarDate, setCalendarDate] = React.useState<Date>(date || new Date());
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (date) setCalendarDate(date);
  }, [date]);

  const handleSelect = (newDate: Date | undefined) => {
    onDateChange(newDate);
    setOpen(false);
  };

  const handleMonthChange = (month: string) => {
    setCalendarDate(setMonth(calendarDate, parseInt(month)));
  };

  const handleYearChange = (year: string) => {
    setCalendarDate(setYear(calendarDate, parseInt(year)));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal overflow-hidden",
            !date && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
          <span className="truncate">
            {date ? format(date, "MMM d, yyyy") : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto overflow-hidden p-0" align="start">
        <div className="flex items-center justify-between gap-1 px-3 py-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => setCalendarDate(setMonth(calendarDate, calendarDate.getMonth() - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1">
            <Select
              value={calendarDate.getMonth().toString()}
              onValueChange={handleMonthChange}
            >
              <SelectTrigger className="h-7 border-0 bg-transparent px-2 text-sm font-medium shadow-none focus:ring-0 gap-0.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {MONTHS.map((month, index) => (
                  <SelectItem key={month} value={index.toString()}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={calendarDate.getFullYear().toString()}
              onValueChange={handleYearChange}
            >
              <SelectTrigger className="h-7 border-0 bg-transparent px-2 text-sm font-medium shadow-none focus:ring-0 gap-0.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {YEARS.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => setCalendarDate(setMonth(calendarDate, calendarDate.getMonth() + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleSelect}
          month={calendarDate}
          onMonthChange={setCalendarDate}
          disabled={disabledDates}
          modifiers={markedDates ? { applied: markedDates } : undefined}
          modifiersClassNames={
            markedDates
              ? {
                  applied:
                    "relative font-semibold text-primary after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-primary",
                }
              : undefined
          }
          classNames={{
            caption: "hidden",
            nav: "hidden",
          }}
          className="p-2 pt-1 pointer-events-auto"
        />
        {markedDates && (
          <div className="flex items-center gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            {markedLabel}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function DateInput({
  value,
  onChange,
  placeholder = "Select date",
  disabled = false,
  className,
}: DateInputProps) {
  const date = value ? new Date(value + "T00:00:00") : undefined;

  const handleDateChange = (newDate: Date | undefined) => {
    if (newDate) {
      onChange(format(newDate, "yyyy-MM-dd"));
    } else {
      onChange("");
    }
  };

  return (
    <DatePicker
      date={date}
      onDateChange={handleDateChange}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
    />
  );
}
