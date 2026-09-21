const eur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const eurCents = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const fmtEur = (n: number) => eur.format(n);
export const fmtEurCents = (n: number) => eurCents.format(n);

const parse = (iso: string) => new Date(iso + "T00:00:00");

const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const longDay = new Intl.DateTimeFormat("pt-PT", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const monthYear = new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric" });

export const fmtShort = (iso: string) => {
  const d = parse(iso);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
};
export const fmtLong = (iso: string) => longDay.format(parse(iso));
export const fmtMonthYear = (iso: string) => monthYear.format(parse(iso));

/** "4–9 set" ou "28 set – 4 out" ou "19 set" */
export function fmtRange(start: string, end: string) {
  if (start === end) return fmtShort(start);
  const a = parse(start);
  const b = parse(end);
  if (a.getMonth() === b.getMonth()) {
    return `${a.getDate()}–${fmtShort(end)}`;
  }
  return `${fmtShort(start)} – ${fmtShort(end)}`;
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

export const pct = (ratio: number) => `${Math.round(ratio * 100)}%`;
