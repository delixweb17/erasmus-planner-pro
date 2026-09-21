import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { Loaded } from "@/components/bits";
import { useData } from "@/data/store";
import type { Trip } from "@/data/types";
import { fmtRange } from "@/lib/format";
import { PERIODS, periodForDate, toISODate, type PeriodKind } from "@/lib/semester";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/calendario")({
  head: () => ({
    meta: [
      { title: "Calendário do semestre — Erasmus em Pisa 27/28" },
      { name: "description", content: "Aulas, pausa e exames lado a lado com as viagens, de setembro de 2027 a fevereiro de 2028." },
      { property: "og:title", content: "Calendário do semestre — Erasmus em Pisa 27/28" },
      { property: "og:description", content: "Aulas, pausa e exames lado a lado com as viagens, de setembro de 2027 a fevereiro de 2028." },
    ],
  }),
  component: () => <Loaded>{() => <CalendarPage />}</Loaded>,
});

const MONTHS = [
  { y: 2027, m: 8 },
  { y: 2027, m: 9 },
  { y: 2027, m: 10 },
  { y: 2027, m: 11 },
  { y: 2028, m: 0 },
  { y: 2028, m: 1 },
];
const WEEKDAYS = ["S", "T", "Q", "Q", "S", "S", "D"];
const monthName = new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric" });

const PERIOD_BG: Record<PeriodKind, string> = {
  aulas: "bg-aulas/8",
  pausa: "bg-pausa/8",
  exames: "bg-exames/8",
};
const PERIOD_DOT: Record<PeriodKind, string> = {
  aulas: "bg-aulas",
  pausa: "bg-pausa",
  exames: "bg-exames",
};

function CalendarPage() {
  const { trips } = useData();
  return (
    <>
      <PageHeader
        eyebrow="Setembro 2027 – Fevereiro 2028"
        title="Calendário"
        description="Fundo azul: aulas. Verde: pausa. Vermelho: exames. As barras são viagens — toca para abrir."
      />
      <div className="fade-up mb-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
        {PERIODS.map((p) => (
          <span key={p.kind} className="flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-full", PERIOD_DOT[p.kind])} />
            {p.label} · {fmtRange(p.start, p.end)}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-5 rounded-sm bg-primary" /> Viagem
        </span>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {MONTHS.map(({ y, m }) => (
          <Month key={`${y}-${m}`} year={y} month={m} trips={trips} />
        ))}
      </div>
    </>
  );
}

function Month({ year, month, trips }: { year: number; month: number; trips: Trip[] }) {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7; // segunda = 0
  const cells: (string | null)[] = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => toISODate(new Date(year, month, i + 1))),
  ];

  return (
    <div className="card-soft overflow-hidden">
      <h2 className="border-b px-4 py-3 text-base font-semibold capitalize">{monthName.format(first)}</h2>
      <div className="grid grid-cols-7 px-2 pt-2 text-center text-[10px] font-semibold text-muted-foreground">
        {WEEKDAYS.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px p-2">
        {cells.map((iso, i) => {
          if (!iso) return <div key={i} />;
          const period = periodForDate(iso);
          const dayTrips = trips.filter((t) => iso >= t.startDate && iso <= t.endDate);
          const trip = dayTrips[0];
          const isStart = trip && (trip.startDate === iso || iso.endsWith("-01"));
          const isEnd = trip && trip.endDate === iso;
          const weekday = (i + 0) % 7;
          return (
            <div
              key={iso}
              className={cn(
                "relative flex h-14 flex-col rounded-md p-1 text-[11px]",
                period && PERIOD_BG[period],
              )}
            >
              <span className={cn("tabular leading-none", weekday >= 5 && "text-muted-foreground")}>
                {Number(iso.slice(-2))}
              </span>
              {trip && (
                <Link
                  to="/viagens/$tripId"
                  params={{ tripId: trip.id }}
                  title={trip.name}
                  className={cn(
                    "absolute inset-x-0 bottom-1 h-5 bg-primary text-primary-foreground transition-opacity hover:opacity-80",
                    trip.startDate === iso ? "ml-1 rounded-l-md" : "-ml-px",
                    isEnd ? "mr-1 rounded-r-md" : "-mr-px",
                  )}
                >
                  {isStart && (
                    <span className="block truncate px-1 text-[10px] font-semibold leading-5">
                      {trip.name}
                    </span>
                  )}
                </Link>
              )}
              {dayTrips.length > 1 && (
                <span className="absolute right-1 top-1 size-1.5 rounded-full bg-destructive" title="Mais do que uma viagem" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
