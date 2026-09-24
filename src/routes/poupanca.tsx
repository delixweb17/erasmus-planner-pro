import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Repeat, Trash2 } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { BudgetBar, EmptyState, Loaded, PersonAvatar, Section, Stat } from "@/components/bits";
import { ProfilePicker, SavingsFormDialog, monthLabel } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { useData, useStore } from "@/data/store";
import {
  allSavings,
  recurringMonths,
  requiredPerMonth,
  savedInMonth,
  savingsByPerson,
  totalBudgetPerPerson,
  upcomingRecurring,
} from "@/lib/finance";
import type { RecurringSaving } from "@/data/types";
import { fmtEur, fmtEurCents, fmtLong, fmtShort } from "@/lib/format";
import { daysBetween, todayISO } from "@/lib/semester";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/poupanca")({
  head: () => ({
    meta: [
      { title: "Poupança — Erasmus em Pisa 27/28" },
      { name: "description", content: "A tua poupança privada e o total do grupo até aos 3000 € por pessoa, a atingir até 1 de setembro de 2027." },
      { property: "og:title", content: "Poupança — Erasmus em Pisa 27/28" },
      { property: "og:description", content: "A tua poupança privada e o total do grupo até aos 3000 € por pessoa, a atingir até 1 de setembro de 2027." },
    ],
  }),
  component: () => <Loaded>{() => <SavingsPage />}</Loaded>,
});

function SavingsPage() {
  const data = useData();
  const { people, savingsGoal, savingsDeadline, trips } = data;
  const { removeSavings, removeRecurring, activeProfile, setActiveProfile } = useStore();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"mensal" | "extra">("extra");
  const [editing, setEditing] = useState<RecurringSaving | null>(null);
  const openDialog = (k: "mensal" | "extra", r: RecurringSaving | null = null) => {
    setKind(k);
    setEditing(r);
    setOpen(true);
  };

  const me = people.find((p) => p.id === activeProfile);
  const today = todayISO();
  const saved = savingsByPerson(data);
  const total = Object.values(saved).reduce((s, v) => s + v, 0);
  const target = savingsGoal * people.length;
  const days = daysBetween(today, savingsDeadline);
  const budgetNeeded = totalBudgetPerPerson(trips);

  const header = (
    <PageHeader
      eyebrow={`Meta: ${fmtEur(savingsGoal)} por pessoa até ${fmtLong(savingsDeadline)}`}
      title="Poupança"
      description={
        savingsGoal - budgetNeeded >= 0
          ? `As viagens somam ${fmtEur(budgetNeeded)} por pessoa. A meta deixa ${fmtEur(savingsGoal - budgetNeeded)} de folga para o dia a dia.`
          : `As viagens somam ${fmtEur(budgetNeeded)} por pessoa — ${fmtEur(budgetNeeded - savingsGoal)} acima da meta.`
      }
    />
  );

  const group = (
    <Section title="O grupo" className="mt-10">
      <div className="card-soft p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Em conjunto, sem mostrar quem tem quanto</span>
          <span className="tabular text-muted-foreground">{target > 0 ? Math.round((total / target) * 100) : 0}% de {fmtEur(target)}</span>
        </div>
        <BudgetBar ratio={target > 0 ? total / target : 0} className="mt-2 [&>div]:bg-success" />
        <p className="mt-2 text-xs text-muted-foreground">
          {days > 0 ? `${days} dias até ${fmtShort(savingsDeadline)}` : "O prazo já passou"}
        </p>
      </div>
    </Section>
  );

  if (!me) {
    return (
      <>
        {header}
        <ProfilePicker />
        {group}
      </>
    );
  }

  const mine = saved[me.id] ?? 0;
  const remaining = Math.max(0, savingsGoal - mine);
  const perMonth = requiredPerMonth(mine, savingsGoal, today, savingsDeadline);
  const thisMonth = today.slice(0, 7);
  const thisMonthSaved = savedInMonth(data, me.id, thisMonth);
  const plans = data.recurring
    .filter((r) => r.personId === me.id)
    .sort((a, b) => a.startMonth.localeCompare(b.startMonth));
  const projected = mine + upcomingRecurring(data, me.id);
  const history = allSavings(data)
    .filter((e) => e.personId === me.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      {header}

      <div className="fade-up mb-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <PersonAvatar person={me} size="sm" />
        <span>A ver como <span className="font-medium text-foreground">{me.name}</span></span>
        <button type="button" className="cursor-pointer text-primary hover:underline" onClick={() => setActiveProfile(null)}>
          Não és tu? Trocar
        </button>
      </div>

      <div className="fade-up grid gap-4 sm:grid-cols-3">
        <Stat
          tone="primary"
          label="A tua poupança"
          value={fmtEur(mine)}
          hint={remaining > 0 ? `Faltam ${fmtEur(remaining)} para os ${fmtEur(savingsGoal)}` : "Meta atingida"}
        >
          <BudgetBar
            ratio={savingsGoal > 0 ? mine / savingsGoal : 0}
            thin
            className="mt-3 bg-primary-foreground/20 [&>div]:bg-primary-foreground"
          />
        </Stat>
        <Stat label="Precisas por mês" value={remaining > 0 ? fmtEur(perMonth) : "—"} hint="para chegar a tempo" />
        <Stat
          label={`Este mês (${monthLabel(thisMonth)})`}
          value={fmtEur(thisMonthSaved)}
          hint={thisMonthSaved >= perMonth ? "No ritmo certo" : `Faltam ${fmtEur(perMonth - thisMonthSaved)} este mês`}
        />
      </div>

      <Section
        title="Depósitos mensais"
        className="mt-10"
        action={
          plans.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => openDialog("mensal")}>
              <Plus /> Depósito mensal
            </Button>
          )
        }
      >
        {plans.length === 0 ? (
          <EmptyState
            title="Sem depósitos mensais."
            hint="Escolhe um valor e um período: entra sozinho no dia 1 de cada mês, sem teres de registar."
            action={
              <Button variant="outline" size="sm" onClick={() => openDialog("mensal")}>
                <Plus /> Depósito mensal
              </Button>
            }
          />
        ) : (
          <div className="card-soft">
            <ul className="divide-y">
              {plans.map((r) => {
                const total = recurringMonths(r).length;
                const done = recurringMonths(r, r.startMonth, thisMonth).length;
                return (
                  <li key={r.id} className="flex items-center gap-4 px-4 py-3 text-sm">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-success/15 text-success">
                      <Repeat className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        <span className="tabular">{fmtEur(r.amount)}</span>
                        <span className="font-normal text-muted-foreground"> por mês</span>
                        {r.note && <span className="font-normal text-muted-foreground"> · {r.note}</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {monthLabel(r.startMonth)} → {monthLabel(r.endMonth)} ·{" "}
                        {done >= total ? "concluído" : `${done} de ${total} meses`}
                      </p>
                      <BudgetBar ratio={total > 0 ? done / total : 0} thin className="mt-2 max-w-60 [&>div]:bg-success" />
                    </div>
                    <span className="tabular hidden text-right text-xs text-muted-foreground sm:block">
                      <span className="block text-sm font-semibold text-foreground">{fmtEur(r.amount * total)}</span>
                      no total
                    </span>
                    <div className="flex shrink-0 gap-0.5">
                      <button
                        type="button"
                        aria-label="Editar depósito mensal"
                        className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                        onClick={() => openDialog("mensal", r)}
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Apagar depósito mensal"
                        className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                        onClick={() => {
                          if (
                            done === 0 ||
                            confirm(
                              `Apagar este depósito mensal? Os ${fmtEur(r.amount * done)} que já entraram também saem da tua poupança. Para parar sem apagar, edita o último mês.`,
                            )
                          )
                            removeRecurring(r.id);
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="border-t px-4 py-3 text-xs text-muted-foreground">
              Com estes depósitos chegas a {fmtShort(savingsDeadline)} com{" "}
              <span className="font-semibold text-foreground">{fmtEur(projected)}</span>
              {projected >= savingsGoal
                ? " — a meta fica garantida."
                : ` — faltam ${fmtEur(savingsGoal - projected)} para a meta.`}
            </p>
          </div>
        )}
      </Section>

      <Section
        title="O teu histórico"
        className="mt-10"
        action={
          history.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => openDialog("extra")}>
              <Plus /> Valor único
            </Button>
          )
        }
      >
        {history.length === 0 ? (
          <EmptyState
            title="Ainda sem registos."
            hint="Os valores únicos e os meses dos depósitos mensais aparecem aqui."
            action={
              <Button variant="outline" size="sm" onClick={() => openDialog("extra")}>
                <Plus /> Valor único
              </Button>
            }
          />
        ) : (
          <ul className="card-soft divide-y">
            {history.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="w-28 text-xs text-muted-foreground">
                  {s.kind === "mensal" && s.month ? monthLabel(s.month) : fmtShort(s.date)}
                </span>
                <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
                  {s.kind === "mensal" ? "Mensal" : "Extra"}
                </span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{s.note}</span>
                <span className={cn("tabular font-semibold", s.amount < 0 && "text-destructive")}>
                  {s.amount > 0 ? "+" : ""}
                  {fmtEurCents(s.amount)}
                </span>
                {s.recurringId ? (
                  <span title="Vem de um depósito mensal" className="p-1.5 text-muted-foreground/60">
                    <Repeat className="size-3.5" />
                  </span>
                ) : (
                  <button
                    type="button"
                    aria-label="Apagar registo"
                    className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                    onClick={() => removeSavings(s.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {group}

      <SavingsFormDialog
        open={open}
        onOpenChange={setOpen}
        personId={me.id}
        defaultKind={kind}
        editing={editing}
        suggestedAmount={perMonth}
      />
    </>
  );
}
