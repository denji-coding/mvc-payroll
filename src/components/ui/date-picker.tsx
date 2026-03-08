import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerProps {
  date: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  disabledDates?: (date: Date) => boolean;
}

export function DatePicker({
  date,
  onDateChange,
  placeholder = "Select date",
  disabled = false,
  className,
  disabledDates,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

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
        <Calendar
          mode="single"
          selected={date}
          defaultMonth={date}
          captionLayout="dropdown"
          fromYear={2000}
          toYear={2050}
          onSelect={(newDate) => {
            onDateChange(newDate);
            setOpen(false);
          }}
          disabled={disabledDates}
          className="p-3 pointer-events-auto"
        />
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
