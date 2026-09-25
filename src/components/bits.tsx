import type { ReactNode } from "react";
import type { Person, Trip, TripStatus } from "@/data/types";
import { useCallback } from "react";
import { useStore } from "@/data/store";
import { PERIOD_LABEL, tripConflicts, tripPeriods, type PeriodKind } from "@/lib/semester";
import { initials, pct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AlertTriangle, Minus, Plus } from "lucide-react";

/* ---------- Pessoas ---------- */

const AVATAR_COLORS = [
  "bg-primary/15 text-primary",
  "bg-success/15 text-success",
  "bg-aulas/15 text-aulas",
  "bg-chart-5/15 text-chart-5",
];

export function PersonAvatar({
  person,
  size = "md",
  className,
}: {
  person: Person | undefined;
  size?: "sm" | "md" | "lg";
  className?: string | undefined;
}) {
  if (!person) return null;
  return (
    <span
      title={person.name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-2 ring-background",
        AVATAR_COLORS[person.color % AVATAR_COLORS.length],
        size === "sm" && "size-6 text-[10px]",
        size === "md" && "size-8 text-xs",
        size === "lg" && "size-12 text-base",
        className,
      )}
    >
      {initials(person.name) || "?"}
    </span>
  );
}

export function AvatarStack({ people, size = "sm" }: { people: Person[]; size?: "sm" | "md" }) {
  return (
    <span className="flex -space-x-1.5">
      {people.map((p) => (
        <PersonAvatar key={p.id} person={p} size={size} />
      ))}
    </span>
  );
}

/* ---------- Períodos do semestre ---------- */

const PERIOD_CLASS: Record<PeriodKind, string> = {
  aulas: "bg-aulas/12 text-aulas border-aulas/30",
  pausa: "bg-pausa/12 text-pausa border-pausa/30",
  exames: "bg-exames/12 text-exames border-exames/30",
};

export function PeriodBadge({
  kind,
  className,
  warn = kind !== "pausa",
}: {
  kind: PeriodKind;
  className?: string;
  /** Mostra o aviso (a viagem faz faltar) */
  warn?: boolean;
}) {
  const conflict = warn;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        PERIOD_CLASS[kind],
        className,
      )}
    >
      {conflict && <AlertTriangle className="size-3" />}
      {PERIOD_LABEL[kind]}
    </span>
  );
}

export function TripPeriodBadges({ trip }: { trip: Pick<Trip, "startDate" | "endDate" | "participants"> }) {
  const periods = tripPeriods(trip);
  const conflicts = useTripConflicts()(trip);
  if (periods.length === 0)
    return (
      <span className="inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
        Antes das aulas
      </span>
    );
  return (
    <span className="flex flex-wrap gap-1">
      {periods.map((k) => (
        <PeriodBadge key={k} kind={k} warn={(conflicts as PeriodKind[]).includes(k)} />
      ))}
    </span>
  );
}

/** Devolve uma função que diz em que períodos (aulas/exames) uma viagem faz faltar, tendo em conta o horário. */
export function useTripConflicts() {
  const data = useStore().data;
  const timetable = data?.timetable;
  const exams = data?.exams;
  return useCallback(
    (trip: Pick<Trip, "startDate" | "endDate" | "participants">) =>
      tripConflicts(trip, timetable ?? [], exams ?? []),
    [timetable, exams],
  );
}

/* ---------- Estado da viagem ---------- */

export const STATUS_LABEL: Record<TripStatus, string> = {
  ideia: "Ideia",
  planeada: "Planeada",
  reservada: "Reservada",
  concluida: "Concluída",
};

const STATUS_CLASS: Record<TripStatus, string> = {
  ideia: "text-muted-foreground border-border",
  planeada: "text-foreground border-border",
  reservada: "text-primary border-primary/40 bg-primary/8",
  concluida: "text-success border-success/40 bg-success/8",
};

export function StatusBadge({ status }: { status: TripStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        STATUS_CLASS[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

/* ---------- Barra orçamento ---------- */

export function BudgetBar({
  ratio,
  className,
  thin,
}: {
  ratio: number;
  className?: string;
  thin?: boolean;
}) {
  const clamped = Math.min(ratio, 1);
  const tone =
    ratio > 1 ? "bg-destructive" : ratio > 0.85 ? "bg-warning" : ratio > 0 ? "bg-success" : "bg-muted-foreground/30";
  return (
    <div
      className={cn("w-full overflow-hidden rounded-full bg-muted", thin ? "h-1.5" : "h-2.5", className)}
      role="progressbar"
      aria-valuenow={Math.round(ratio * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={pct(ratio)}
    >
      <div
        className={cn("h-full rounded-full transition-all duration-700", tone)}
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  );
}

/* ---------- Cartões ---------- */

export function Stat({
  label,
  value,
  hint,
  className,
  tone,
  children,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  className?: string | undefined;
  tone?: "default" | "primary";
  children?: ReactNode;
}) {
  return (
    <div className={cn("card-soft p-5", tone === "primary" && "bg-primary text-primary-foreground border-primary", className)}>
      <p className={cn("eyebrow", tone === "primary" && "text-primary-foreground/70")}>{label}</p>
      <p className="tabular mt-2 font-display text-3xl font-semibold">{value}</p>
      {hint && (
        <p className={cn("mt-1 text-xs text-muted-foreground", tone === "primary" && "text-primary-foreground/75")}>
          {hint}
        </p>
      )}
      {children}
    </div>
  );
}

export function Section({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("fade-up", className)}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="card-soft flex flex-col items-center justify-center gap-2 border-dashed px-6 py-12 text-center shadow-none">
      <p className="font-medium">{title}</p>
      {hint && <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* ---------- Loader dos dados ---------- */

export function Loaded({ children }: { children: (ready: true) => ReactNode }) {
  const { ready } = useStore();
  if (!ready) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-9 w-56 animate-pulse rounded-lg bg-muted" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }
  return <>{children(true)}</>;
}

/* ---------- Campo numérico com − / + ---------- */

export function NumberStepper({
  value,
  onChange,
  step = 1,
  min = 0,
  placeholder,
  unit,
  className,
  "aria-label": ariaLabel,
}: {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  placeholder?: string;
  unit?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const change = (delta: number) => onChange(Math.max(min, (value || 0) + delta));
  const btn =
    "flex h-full w-9 shrink-0 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-3.5";
  return (
    <div
      className={cn(
        "flex h-9 items-stretch overflow-hidden rounded-md border border-input bg-transparent shadow-sm transition-colors focus-within:ring-1 focus-within:ring-ring",
        className,
      )}
    >
      <button type="button" className={cn(btn, "border-r border-input")} onClick={() => change(-step)} disabled={(value || 0) <= min} aria-label="Diminuir">
        <Minus />
      </button>
      <div className="flex min-w-0 flex-1 items-center justify-center gap-1 px-2">
        <input
          type="number"
          inputMode="decimal"
          min={min}
          step={step}
          aria-label={ariaLabel}
          value={value || ""}
          placeholder={placeholder}
          onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
          className="w-full min-w-0 bg-transparent text-center text-sm font-semibold tabular-nums outline-none placeholder:font-normal placeholder:text-muted-foreground [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>
      <button type="button" className={cn(btn, "border-l border-input")} onClick={() => change(step)} aria-label="Aumentar">
        <Plus />
      </button>
    </div>
  );
}
