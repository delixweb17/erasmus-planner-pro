import { useState } from "react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { CalendarDays, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useStore } from "@/data/store";
import { PERIODS, classesOn, toISODate } from "@/lib/semester";
import { cn } from "@/lib/utils";

const parse = (iso: string) => new Date(iso + "T00:00:00");

const periodRange = (kind: "aulas" | "exames") =>
  PERIODS.filter((p) => p.kind === kind).map((p) => ({ from: parse(p.start), to: parse(p.end) }));

const dot = "after:absolute after:bottom-0.5 after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full";

/**
 * Campo de data com calendário no estilo da app (substitui o `<input type="date">` do browser).
 * Valor em ISO yyyy-mm-dd; "" = sem data (só com `clearable`).
 */
export function DatePicker({
  value,
  onChange,
  placeholder = "Escolher data",
  clearable,
  min,
  semester,
  className,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  clearable?: boolean;
  /** Primeiro dia permitido (ISO) */
  min?: string | undefined;
  /** Marca os dias de aulas e exames */
  semester?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const timetable = useStore().data?.timetable ?? [];
  // Com horário, só se marcam os dias em que há mesmo aulas.
  const aulas =
    timetable.length > 0 ? (d: Date) => classesOn(toISODate(d), timetable).length > 0 : periodRange("aulas");
  const selected = value ? parse(value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn("relative", className)}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={ariaLabel}
            className={cn(
              "flex h-9 w-full cursor-pointer items-center gap-2 rounded-md border border-input bg-transparent px-3 text-left text-sm shadow-sm transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring data-[state=open]:ring-1 data-[state=open]:ring-ring",
              clearable && value && "pr-8",
            )}
          >
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
            <span className={cn("truncate tabular", !value && "text-muted-foreground")}>
              {selected ? format(selected, "d MMM yyyy", { locale: pt }) : placeholder}
            </span>
          </button>
        </PopoverTrigger>
        {clearable && value && (
          <button
            type="button"
            aria-label="Limpar data"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => onChange("")}
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      <PopoverContent className="w-auto rounded-xl p-0" align="start">
        <Calendar
          mode="single"
          locale={pt}
          weekStartsOn={1}
          selected={selected}
          defaultMonth={selected ?? (min ? parse(min) : new Date())}
          {...(min ? { disabled: { before: parse(min) } } : {})}
          onSelect={(d) => {
            if (!d) return;
            onChange(toISODate(d));
            setOpen(false);
          }}
          className="rounded-xl [--cell-size:2.25rem]"
          classNames={{ caption_label: "select-none text-sm font-semibold capitalize" }}
          {...(semester
            ? {
                modifiers: { aulas, exames: periodRange("exames") },
                modifiersClassNames: {
                  aulas: cn(dot, "after:bg-aulas"),
                  exames: cn(dot, "after:bg-exames"),
                },
              }
            : {})}
        />
        {semester && (
          <div className="flex gap-4 border-t px-4 py-2.5 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-aulas" /> Aulas
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-exames" /> Exames
            </span>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
