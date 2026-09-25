import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import {
  BudgetBar,
  EmptyState,
  Loaded,
  PersonAvatar,
  Section,
  Stat,
  StatusBadge,
  TripPeriodBadges,
} from "@/components/bits";
import { CATEGORY_LABEL, ExpenseFormDialog, TripFormDialog } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { BookingsSection } from "@/components/Bookings";
import { useData, useStore } from "@/data/store";
import type { Expense } from "@/data/types";
import { tripCost } from "@/lib/finance";
import { fmtEur, fmtEurCents, fmtRange, fmtShort, pct } from "@/lib/format";
import { PERIOD_LABEL, WEEKDAY_SHORT, missedClasses, tripConflicts, tripDays, weekdayOf } from "@/lib/semester";

export const Route = createFileRoute("/viagens/$tripId")({
  head: () => ({
    meta: [
      { title: "Detalhe da viagem — Erasmus em Pisa 27/28" },
      { name: "description", content: "Orçamento, despesas e participantes de uma viagem do semestre." },
      { property: "og:title", content: "Detalhe da viagem — Erasmus em Pisa 27/28" },
      { property: "og:description", content: "Orçamento, despesas e participantes de uma viagem do semestre." },
    ],
  }),
  component: () => <Loaded>{() => <TripDetail />}</Loaded>,
});

function TripDetail() {
  const { tripId } = Route.useParams();
  const { trips, expenses, people, timetable } = useData();
  const { removeTrip, removeExpense } = useStore();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | undefined>();

  const trip = trips.find((t) => t.id === tripId);
  if (!trip) {
    return (
      <EmptyState
        title="Viagem não encontrada."
        action={
          <Button asChild variant="outline">
            <Link to="/viagens">Voltar às viagens</Link>
          </Button>
        }
      />
    );
  }

  const cost = tripCost(trip, expenses);
  const tripExpenses = expenses
    .filter((e) => e.tripId === trip.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const participants = people.filter((p) => trip.participants.includes(p.id));
  const byId = Object.fromEntries(people.map((p) => [p.id, p]));
  const conflicts = tripConflicts(trip, timetable);
  const missed = missedClasses(trip, timetable);
  const days = tripDays(trip);
  const remaining = cost.budgetTotal - cost.spentTotal;

  const byCategory = Object.entries(
    tripExpenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + e.amount;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  const onDelete = () => {
    if (!confirm(`Apagar a viagem "${trip.name}"? As despesas passam a gerais.`)) return;
    removeTrip(trip.id);
    toast.success("Viagem apagada.");
    navigate({ to: "/viagens" });
  };

  return (
    <>
      <Link to="/viagens" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Viagens
      </Link>
      <PageHeader
        eyebrow={`${fmtRange(trip.startDate, trip.endDate)} · ${days} ${days === 1 ? "dia" : "dias"}`}
        title={trip.name}
        description={trip.cities.join(" · ")}
        actions={
          <>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil /> Editar
            </Button>
            <Button variant="ghost" size="icon" aria-label="Apagar viagem" onClick={onDelete}>
              <Trash2 />
            </Button>
          </>
        }
      />

      <div className="fade-up mb-6 flex flex-wrap items-center gap-2">
        <StatusBadge status={trip.status} />
        <TripPeriodBadges trip={trip} />
        {conflicts.length > 0 && (
          <span className="text-xs text-muted-foreground">
            Sobrepõe {conflicts.map((k) => PERIOD_LABEL[k].toLowerCase()).join(" e ")} — confirmem faltas.
          </span>
        )}
        {missed.length > 0 && (
          <p className="basis-full text-xs text-muted-foreground">
            Faltas a {missed.length} {missed.length === 1 ? "aula" : "aulas"}:{" "}
            {missed
              .map((m) => `${m.slot.subject} (${WEEKDAY_SHORT[weekdayOf(m.date)]} ${fmtShort(m.date)}, ${m.slot.start})`)
              .join(" · ")}
          </p>
        )}
      </div>

      <div className="fade-up grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Orçamento / pessoa" value={fmtEur(trip.budgetPerPerson)} hint={`${fmtEur(cost.budgetTotal)} no total`} />
        <Stat label="Gasto / pessoa" value={fmtEur(cost.spentPerPerson)} hint={`${fmtEur(cost.spentTotal)} no total · ${pct(cost.ratio)}`} />
        <Stat
          label={remaining >= 0 ? "Margem restante" : "Acima do orçamento"}
          value={fmtEur(Math.abs(remaining))}
          hint={remaining >= 0 ? `${fmtEur(remaining / Math.max(participants.length, 1))} por pessoa` : "É preciso ajustar"}
          className={remaining < 0 ? "border-destructive/40" : undefined}
        />
        <Stat label="Participantes" value={participants.length} hint={participants.map((p) => p.name).join(", ")} />
      </div>

      <div className="mt-4 card-soft p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Execução do orçamento</span>
          <span className="tabular text-muted-foreground">{pct(cost.ratio)}</span>
        </div>
        <BudgetBar ratio={cost.ratio} className="mt-2" />
      </div>

      <BookingsSection trip={trip} />

      <div className="mt-10 grid gap-10 lg:grid-cols-[1.5fr_1fr]">
        <Section
          title="Despesas"
          action={
            <Button size="sm" onClick={() => { setEditingExpense(undefined); setExpenseOpen(true); }}>
              <Plus /> Despesa
            </Button>
          }
        >
          {tripExpenses.length === 0 ? (
            <EmptyState title="Ainda não há despesas." hint="Regista bilhetes, alojamento e refeições à medida que forem pagos." />
          ) : (
            <ul className="card-soft divide-y">
              {tripExpenses.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                  <PersonAvatar person={byId[e.paidBy]} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{e.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtShort(e.date)} · {CATEGORY_LABEL[e.category]} · {byId[e.paidBy]?.name} pagou · dividido por {e.splitBetween.length}
                    </p>
                  </div>
                  <span className="tabular text-sm font-semibold">{fmtEurCents(e.amount)}</span>
                  <button
                    type="button"
                    aria-label="Editar despesa"
                    className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-accent"
                    onClick={() => { setEditingExpense(e); setExpenseOpen(true); }}
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Apagar despesa"
                    className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                    onClick={() => { removeExpense(e.id); toast.success("Despesa apagada."); }}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <div className="space-y-10">
          <Section title="Custo por pessoa">
            <div className="card-soft space-y-3 p-5">
              {participants.map((p) => {
                const v = cost.perPerson[p.id] ?? 0;
                return (
                  <div key={p.id}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <PersonAvatar person={p} size="sm" /> {p.name}
                      </span>
                      <span className="tabular">
                        <span className="font-semibold">{fmtEur(v)}</span>
                        <span className="text-muted-foreground"> / {fmtEur(trip.budgetPerPerson)}</span>
                      </span>
                    </div>
                    <BudgetBar ratio={trip.budgetPerPerson ? v / trip.budgetPerPerson : 0} thin className="mt-1.5" />
                  </div>
                );
              })}
            </div>
          </Section>

          {byCategory.length > 0 && (
            <Section title="Por categoria">
              <div className="card-soft divide-y">
                {byCategory.map(([cat, v]) => (
                  <div key={cat} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span>{CATEGORY_LABEL[cat as keyof typeof CATEGORY_LABEL]}</span>
                    <span className="tabular font-semibold">{fmtEur(v)}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {trip.notes && (
            <Section title="Notas">
              <p className="card-soft whitespace-pre-wrap p-5 text-sm text-muted-foreground">{trip.notes}</p>
            </Section>
          )}
        </div>
      </div>

      <TripFormDialog open={editOpen} onOpenChange={setEditOpen} trip={trip} />
      <ExpenseFormDialog open={expenseOpen} onOpenChange={setExpenseOpen} expense={editingExpense} defaultTripId={trip.id} />
    </>
  );
}
