import type { ClassSlot, PersonId, Trip } from "@/data/types";

export type PeriodKind = "aulas" | "pausa" | "exames";

export interface Period {
  kind: PeriodKind;
  label: string;
  start: string;
  end: string;
}

export const SEMESTER_START = "2027-09-01";
export const SEMESTER_END = "2028-02-29";

export const PERIODS: Period[] = [
  { kind: "aulas", label: "Aulas", start: "2027-09-15", end: "2027-12-07" },
  { kind: "pausa", label: "Pausa de Natal", start: "2027-12-08", end: "2028-01-06" },
  { kind: "exames", label: "Exames", start: "2028-01-07", end: "2028-02-11" },
];

export const PERIOD_LABEL: Record<PeriodKind, string> = {
  aulas: "Aulas",
  pausa: "Pausa",
  exames: "Exames",
};

export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart <= bEnd && bStart <= aEnd;
}

export function periodForDate(date: string): PeriodKind | null {
  const p = PERIODS.find((p) => date >= p.start && date <= p.end);
  return p?.kind ?? null;
}

/** Períodos com que a viagem se sobrepõe (por ordem). */
export function tripPeriods(trip: Pick<Trip, "startDate" | "endDate">): PeriodKind[] {
  return PERIODS.filter((p) => overlaps(trip.startDate, trip.endDate, p.start, p.end)).map(
    (p) => p.kind,
  );
}

export const WEEKDAY_LABEL = ["", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
export const WEEKDAY_SHORT = ["", "seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

/** Dia da semana de uma data ISO: 1 = segunda … 7 = domingo. */
export const weekdayOf = (iso: string) => {
  const d = new Date(iso + "T00:00:00").getDay();
  return d === 0 ? 7 : d;
};

/** Aulas do horário num dia (só dentro do período de aulas); `people` filtra por quem as tem. */
export function classesOn(iso: string, timetable: ClassSlot[], people?: PersonId[]) {
  if (periodForDate(iso) !== "aulas") return [];
  const wd = weekdayOf(iso);
  return timetable
    .filter((c) => c.weekday === wd && (!people || c.people.some((p) => people.includes(p))))
    .sort((a, b) => a.start.localeCompare(b.start));
}

/** Aulas que os participantes perdem durante a viagem. */
export function missedClasses(
  trip: Pick<Trip, "startDate" | "endDate" | "participants">,
  timetable: ClassSlot[],
) {
  const out: { date: string; slot: ClassSlot }[] = [];
  const d = new Date(trip.startDate + "T00:00:00");
  for (let iso = trip.startDate; iso <= trip.endDate; ) {
    for (const slot of classesOn(iso, timetable, trip.participants)) out.push({ date: iso, slot });
    d.setDate(d.getDate() + 1);
    iso = toISODate(d);
  }
  return out;
}

/**
 * Períodos em que a viagem faz faltar (aulas ou exames).
 * Com horário preenchido, "aulas" só conta se a viagem apanhar aulas de quem vai.
 */
export function tripConflicts(
  trip: Pick<Trip, "startDate" | "endDate" | "participants">,
  timetable: ClassSlot[] = [],
) {
  const kinds = tripPeriods(trip).filter((k) => k === "aulas" || k === "exames");
  if (timetable.length === 0) return kinds;
  return kinds.filter((k) => k !== "aulas" || missedClasses(trip, timetable).length > 0);
}

export function tripDays(trip: Pick<Trip, "startDate" | "endDate">) {
  const a = new Date(trip.startDate + "T00:00:00");
  const b = new Date(trip.endDate + "T00:00:00");
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
}

export function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO() {
  return toISODate(new Date());
}

export function daysBetween(fromISO: string, toISO: string) {
  const a = new Date(fromISO + "T00:00:00");
  const b = new Date(toISO + "T00:00:00");
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}
