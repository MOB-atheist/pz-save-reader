"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

type MultiSelectProps = {
  id?: string;
  label: string;
  options: string[];
  selected: string[];
  onSelectionChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
};

export function MultiSelect({
  id,
  label,
  options,
  selected,
  onSelectionChange,
  placeholder = "Select…",
  className,
  triggerClassName,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const toggle = (value: string) => {
    const next = selected.includes(value)
      ? selected.filter((s) => s !== value)
      : [...selected, value];
    onSelectionChange(next);
  };

  const displayLabel =
    selected.length === 0
      ? placeholder
      : `${label} (${selected.length})`;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <label
        htmlFor={id}
        className="text-sm text-muted-foreground whitespace-nowrap"
      >
        {label}
      </label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "min-w-[140px] justify-between font-normal h-10",
              triggerClassName
            )}
          >
            <span className="truncate">{displayLabel}</span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-2" align="start">
          <div className="max-h-[240px] overflow-y-auto space-y-1">
            {options.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2 px-2">—</p>
            ) : (
              options.map((option) => (
                <label
                  key={option}
                  className={cn(
                    "flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer",
                    "hover:bg-muted/60"
                  )}
                >
                  <Checkbox
                    checked={selected.includes(option)}
                    onCheckedChange={() => toggle(option)}
                  />
                  <span className="truncate">{option}</span>
                </label>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
