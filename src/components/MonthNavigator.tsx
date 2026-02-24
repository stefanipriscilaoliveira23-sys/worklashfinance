import { useState } from "react";
import { ChevronLeft, ChevronRight, CalendarRange } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Feb 2026 through Dec 2026
function generateMonths() {
  const months: { key: string; label: string }[] = [];
  for (let m = 1; m <= 11; m++) {
    const d = new Date(2026, m, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("pt-BR", { month: "short" }).replace(".", "");
    months.push({ key, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return months;
}

const MONTHS = generateMonths();

export function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export type DateFilter =
  | { type: "month"; key: string }
  | { type: "custom"; start: string; end: string };

export function getDateRange(filter: DateFilter): { start: string; end: string } {
  if (filter.type === "custom") return { start: filter.start, end: filter.end };
  const [year, month] = filter.key.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return {
    start: `${filter.key}-01`,
    end: `${filter.key}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function filterByDate(dateStr: string | null | undefined, filter: DateFilter): boolean {
  if (!dateStr) return false;
  if (filter.type === "month") return dateStr.substring(0, 7) === filter.key;
  return dateStr >= filter.start && dateStr <= filter.end;
}

interface MonthNavigatorProps {
  filter: DateFilter;
  onChange: (filter: DateFilter) => void;
}

export default function MonthNavigator({ filter, onChange }: MonthNavigatorProps) {
  const [customOpen, setCustomOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();

  const selectedMonth = filter.type === "month" ? filter.key : null;

  const applyCustom = () => {
    if (startDate && endDate) {
      onChange({
        type: "custom",
        start: format(startDate, "yyyy-MM-dd"),
        end: format(endDate, "yyyy-MM-dd"),
      });
      setCustomOpen(false);
    }
  };

  const customLabel = filter.type === "custom"
    ? `${format(new Date(filter.start + "T00:00:00"), "dd/MM")} - ${format(new Date(filter.end + "T00:00:00"), "dd/MM")}`
    : null;

  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      <button
        onClick={() => {
          const idx = MONTHS.findIndex(m => m.key === selectedMonth);
          if (idx > 0) onChange({ type: "month", key: MONTHS[idx - 1].key });
          else if (selectedMonth === null && MONTHS.length > 0) onChange({ type: "month", key: MONTHS[MONTHS.length - 1].key });
        }}
        disabled={selectedMonth === MONTHS[0]?.key}
        className="p-1.5 rounded hover:bg-secondary text-muted-foreground disabled:opacity-30 shrink-0"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {MONTHS.map(m => (
        <button
          key={m.key}
          onClick={() => onChange({ type: "month", key: m.key })}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors shrink-0 ${
            selectedMonth === m.key
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
          }`}
        >
          {m.label}
        </button>
      ))}

      <button
        onClick={() => {
          const idx = MONTHS.findIndex(m => m.key === selectedMonth);
          if (idx >= 0 && idx < MONTHS.length - 1) onChange({ type: "month", key: MONTHS[idx + 1].key });
        }}
        disabled={selectedMonth === MONTHS[MONTHS.length - 1]?.key || selectedMonth === null}
        className="p-1.5 rounded hover:bg-secondary text-muted-foreground disabled:opacity-30 shrink-0"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      <Popover open={customOpen} onOpenChange={setCustomOpen}>
        <PopoverTrigger asChild>
          <button
            className={`ml-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors shrink-0 flex items-center gap-1.5 ${
              filter.type === "custom"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50 border border-border"
            }`}
          >
            <CalendarRange className="h-3.5 w-3.5" />
            {customLabel ?? "Personalizado"}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-4 space-y-3" align="end">
          <p className="text-xs font-medium text-muted-foreground">Data inicial</p>
          <Calendar
            mode="single"
            selected={startDate}
            onSelect={setStartDate}
            className={cn("p-2 pointer-events-auto")}
            locale={ptBR}
          />
          <p className="text-xs font-medium text-muted-foreground">Data final</p>
          <Calendar
            mode="single"
            selected={endDate}
            onSelect={setEndDate}
            className={cn("p-2 pointer-events-auto")}
            locale={ptBR}
          />
          <Button size="sm" className="w-full" onClick={applyCustom} disabled={!startDate || !endDate}>
            Aplicar
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
