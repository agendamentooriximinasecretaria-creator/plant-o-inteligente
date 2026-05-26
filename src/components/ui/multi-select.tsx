import * as React from "react";
import { useState, useMemo } from "react";
import { Check, ChevronDown, Search, X, CalendarDays, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";

export type Option = {
  label: string;
  value: string;
};

interface MultiSelectProps {
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
  emptyMessage?: string;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Selecione...",
  className,
  emptyMessage = "Nenhuma opção encontrada.",
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredOptions = useMemo(() => {
    return options.filter((option) =>
      option.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [options, searchTerm]);

  const toggleOption = (value: string) => {
    const newSelected = selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value];
    onChange(newSelected);
  };

  const selectAll = () => {
    const allValues = filteredOptions.map((opt) => opt.value);
    const newSelected = Array.from(new Set([...selected, ...allValues]));
    onChange(newSelected);
  };

  const clearSelection = () => {
    onChange([]);
  };

  const selectedLabels = useMemo(() => {
    return options
      .filter((opt) => selected.includes(opt.value))
      .map((opt) => opt.label);
  }, [options, selected]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex min-h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
        >
          <div className="flex flex-wrap gap-1 items-center overflow-hidden">
            {selected.length === 0 && (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            {selected.length > 0 && selected.length <= 2 && (
              selectedLabels.map((label) => (
                <Badge key={label} variant="secondary" className="font-normal">
                  {label}
                </Badge>
              ))
            )}
            {selected.length > 2 && (
              <Badge variant="secondary" className="font-normal">
                {selected.length} selecionados
              </Badge>
            )}
          </div>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="flex flex-col p-2 space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-8 py-1 text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-2.5"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
          <div className="flex justify-between gap-2 px-1">
            <button
              type="button"
              onClick={selectAll}
              className="text-[10px] uppercase font-bold text-primary hover:underline"
            >
              Selecionar todos
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="text-[10px] uppercase font-bold text-muted-foreground hover:underline"
            >
              Limpar
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto space-y-1">
            {filteredOptions.length === 0 ? (
              <p className="p-2 text-sm text-center text-muted-foreground">
                {emptyMessage}
              </p>
            ) : (
              filteredOptions.map((option) => (
                <div
                  key={option.value}
                  className={cn(
                    "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                    selected.includes(option.value) && "bg-accent/50"
                  )}
                  onClick={() => toggleOption(option.value)}
                >
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    {selected.includes(option.value) && (
                      <Check className="h-4 w-4" />
                    )}
                  </span>
                  {option.label}
                </div>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
