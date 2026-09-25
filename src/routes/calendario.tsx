import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock, MapPin, Plus } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { AvatarStack, EmptyState, Loaded, PersonAvatar, Section } from "@/components/bits";
import { ClassFormDialog, ExamFormDialog } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { useData, useStore } from "@/data/store";
import type { ClassSlot, Exam, PersonId, Trip } from "@/data/types";
import { fmtRange, fmtShort } from "@/lib/format";
import { PERIODS, WEEKDAY_LABEL, WEEKDAY_SHORT, classesOn, weekdayOf, periodForDate, toISODate, type PeriodKind } from "@/lib/semester";
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
const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

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
  const { trips, timetable, exams, people } = useData();
  const { activeProfile } = useStore();
  /** Horário de quem se está a ver: uma pessoa ou todos (null) */
  const [viewing, setViewing] = useState<PersonId | null>(activeProfile);
  const [dialog, setDialog] = useState<{ open: boolean; slot: ClassSlot | null; weekday: number }>({
    open: false,
    slot: null,
    weekday: 1,
  });
  const openClass = (slot: ClassSlot | null, weekday = 1) => setDialog({ open: true, slot, weekday });
  const [examDialog, setExamDialog] = useState<{ open: boolean; exam: Exam | null }>({ open: false, exam: null });
  const openExam = (exam: Exam | null) => setExamDialog({ open: true, exam });
  const visibleExams = (viewing ? exams.filter((e) => e.people.includes(viewing)) : exams)
    .slice()
    .sort((a, b) => (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")));

  const visible = viewing ? timetable.filter((c) => c.people.includes(viewing)) : timetable;
  const days = timetable.some((c) => c.weekday === 6) ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5];
  const byId = Object.fromEntries(people.map((p) => [p.id, p]));

  return (
    <>
      <PageHeader
        eyebrow="Setembro 2027 – Fevereiro 2028"
        title="Calendário"
        description={
          timetable.length > 0
            ? "Fundo azul: dias com aulas no horário. Verde: pausa. Vermelho: exames. As barras são viagens — toca para abrir."
            : "Fundo azul: aulas. Verde: pausa. Vermelho: exames. As barras são viagens — toca para abrir."
        }
      />

      {(timetable.length > 0 || exams.length > 0) && (
      <div className="fade-up mb-4 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs text-muted-foreground">Ver:</span>
        {[null, ...people.map((p) => p.id)].map((id) => (
          <button
            key={id ?? "todos"}
            type="button"
            onClick={() => setViewing(id)}
            className={cn(
              "flex cursor-pointer items-center gap-1.5 rounded-full border py-1 text-xs font-medium transition-colors",
              id ? "pl-1 pr-2.5" : "px-3",
              viewing === id
                ? "border-primary bg-primary/10 text-foreground"
                : "text-muted-foreground hover:bg-accent",
            )}
          >
            {id && <PersonAvatar person={byId[id]} size="sm" />}
            {id ? byId[id]?.name : "Todos"}
          </button>
        ))}
      </div>
      )}

      <Section
        title="Horário semanal"
        className="mb-10"
        action={
          timetable.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => openClass(null)}>
              <Plus /> Aula
            </Button>
          )
        }
      >
        {timetable.length === 0 ? (
          <EmptyState
            title="Ainda sem horário."
            hint="Põe aqui as vossas aulas. O calendário passa a mostrar só os dias com aulas, e uma viagem só conta como falta se apanhar aulas de quem vai."
            action={
              <Button variant="outline" size="sm" onClick={() => openClass(null)}>
                <Plus /> Primeira aula
              </Button>
            }
          />
        ) : (
          <>
            <div className={cn("grid gap-3", days.length === 6 ? "md:grid-cols-6" : "md:grid-cols-5")}>
              {days.map((wd) => {
                const slots = visible.filter((c) => c.weekday === wd).sort((a, b) => a.start.localeCompare(b.start));
                return (
                  <div key={wd} className="card-soft flex flex-col p-2.5">
                    <p className="eyebrow mb-2 px-1">{WEEKDAY_LABEL[wd]}</p>
                    <div className="flex flex-1 flex-col gap-2">
                      {slots.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => openClass(c)}
                          className="cursor-pointer rounded-lg border border-aulas/30 bg-aulas/10 p-2.5 text-left transition-colors hover:bg-aulas/15"
                        >
                          <p className="tabular text-[11px] font-semibold text-aulas">
                            {c.start}–{c.end}
                          </p>
                          <p className="mt-0.5 text-sm font-semibold leading-snug">{c.subject}</p>
                          {c.room && (
                            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                              <MapPin className="size-3 shrink-0" />
                              <span className="truncate">{c.room}</span>
                            </p>
                          )}
                          <div className="mt-2">
                            <AvatarStack people={c.people.map((id) => byId[id]).filter((p) => !!p)} />
                          </div>
                        </button>
                      ))}
                      {slots.length === 0 && (
                        <p className="px-1 pb-1 text-xs text-muted-foreground">Sem aulas</p>
                      )}
                      <button
                        type="button"
                        aria-label={`Adicionar aula à ${WEEKDAY_LABEL[wd]?.toLowerCase()}`}
                        onClick={() => openClass(null, wd)}
                        className="mt-auto flex cursor-pointer items-center justify-center rounded-lg border border-dashed py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Section>

      <Section
        title="Exames"
        className="mb-10"
        action={
          exams.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => openExam(null)}>
              <Plus /> Exame
            </Button>
          )
        }
      >
        {exams.length === 0 ? (
          <EmptyState
            title="Ainda sem exames marcados."
            hint="Marca o dia de cada exame. Enquanto não houver nenhum, qualquer viagem entre 7 jan e 11 fev conta como falta."
            action={
              <Button variant="outline" size="sm" onClick={() => openExam(null)}>
                <Plus /> Primeiro exame
              </Button>
            }
          />
        ) : visibleExams.length === 0 ? (
          <p className="card-soft px-4 py-3 text-sm text-muted-foreground">Sem exames para esta pessoa.</p>
        ) : (
          <ul className="card-soft divide-y">
            {visibleExams.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => openExam(e)}
                  className="flex w-full cursor-pointer items-center gap-4 px-4 py-3 text-left text-sm transition-colors hover:bg-accent/50"
                >
                  <span className="flex w-12 shrink-0 flex-col items-center rounded-lg border border-exames/30 bg-exames/10 py-1 text-exames">
                    <span className="text-[10px] font-semibold uppercase leading-tight">{WEEKDAY_SHORT[weekdayOf(e.date)]}</span>
                    <span className="tabular font-display text-lg font-semibold leading-tight">{Number(e.date.slice(8))}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{e.subject}</span>
                    <span className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                      <span>{fmtShort(e.date)}</span>
                      {e.time && (
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" /> {e.time}
                        </span>
                      )}
                      {e.room && (
                        <span className="flex items-center gap-1">
                          <MapPin className="size-3" /> {e.room}
                        </span>
                      )}
                    </span>
                  </span>
                  <AvatarStack people={e.people.map((id) => byId[id]).filter((p) => !!p)} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
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
          <Month
            key={`${y}-${m}`}
            year={y}
            month={m}
            trips={trips}
            timetable={visible}
            hasTimetable={timetable.length > 0}
            exams={visibleExams}
          />
        ))}
      </div>

      <ClassFormDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        slot={dialog.slot}
        defaultWeekday={dialog.weekday}
      />
      <ExamFormDialog
        open={examDialog.open}
        onOpenChange={(open) => setExamDialog((d) => ({ ...d, open }))}
        exam={examDialog.exam}
      />
    </>
  );
}

function Month({
  year,
  month,
  trips,
  timetable,
  hasTimetable,
  exams,
}: {
  year: number;
  month: number;
  trips: Trip[];
  timetable: ClassSlot[];
  hasTimetable: boolean;
  exams: Exam[];
}) {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7; // segunda = 0
  const cells: (string | null)[] = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => toISODate(new Date(year, month, i + 1))),
  ];

  return (
    <div className="card-soft overflow-hidden">
      <h2 className="border-b px-4 py-3 text-base font-semibold">
        {MONTH_NAMES[month]} {year}
      </h2>
      <div className="grid grid-cols-7 px-2 pt-2 text-center text-[10px] font-semibold text-muted-foreground">
        {WEEKDAYS.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px p-2">
        {cells.map((iso, i) => {
          if (!iso) return <div key={i} />;
          const classes = classesOn(iso, timetable);
          const dayExams = exams.filter((e) => e.date === iso);
          // Com horário, o fundo azul só aparece nos dias em que há mesmo aulas.
          const period = periodForDate(iso) === "aulas" && hasTimetable && classes.length === 0 ? null : periodForDate(iso);
          const dayTrips = trips.filter((t) => iso >= t.startDate && iso <= t.endDate);
          const trip = dayTrips[0];
          const weekday = i % 7;
          const isStart = trip && (trip.startDate === iso || weekday === 0);
          const isEnd = trip && trip.endDate === iso;
          return (
            <div
              key={iso}
              title={
                classes.length || dayExams.length
                  ? [
                      ...dayExams.map((e) => `Exame${e.time ? ` ${e.time}` : ""}: ${e.subject}`),
                      ...classes.map((c) => `${c.start} ${c.subject}`),
                    ].join("\n")
                  : undefined
              }
              className={cn(
                "relative flex h-14 flex-col rounded-md p-1 text-[11px]",
                period && PERIOD_BG[period],
                classes.length > 0 && "bg-aulas/15",
                dayExams.length > 0 && "bg-exames/25 ring-1 ring-inset ring-exames/60",
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
