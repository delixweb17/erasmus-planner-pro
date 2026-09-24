import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { BudgetBar, EmptyState, Loaded, NumberStepper, PersonAvatar, Section, Stat } from "@/components/bits";
import { ProfilePicker, SavingsFormDialog, monthLabel } from "@/components/forms";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useData, useStore } from "@/data/store";
import { requiredPerMonth, savedInMonth, savingsByPerson, totalBudgetPerPerson } from "@/lib/finance";
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
  const { people, savings: entries, savingsGoal, savingsDeadline, trips, monthlyPlan } = data;
  const { removeSavings, activeProfile, setActiveProfile, setMonthlyPlan, setAutoSavings } = useStore();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"mensal" | "extra">("mensal");

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
      actions={
        me && (
          <Button onClick={() => { setKind("mensal"); setOpen(true); }}>
            <Plus /> Registar mês
          </Button>
        )
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
  const plan = monthlyPlan[me.id] ?? 0;
  const auto = data.autoSavings[me.id];
  const history = entries.filter((e) => e.personId === me.id).sort((a, b) => b.date.localeCompare(a.date));

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
        <Stat tone="primary" label="A tua poupança" value={fmtEur(mine)} hint={remaining > 0 ? `Faltam ${fmtEur(remaining)}` : "Meta atingida"} />
        <Stat label="Precisas por mês" value={remaining > 0 ? fmtEur(perMonth) : "—"} hint="para chegar a tempo" />
        <Stat
          label={`Este mês (${monthLabel(thisMonth)})`}
          value={fmtEur(thisMonthSaved)}
          hint={thisMonthSaved >= perMonth ? "No ritmo certo" : `Faltam ${fmtEur(perMonth - thisMonthSaved)} este mês`}
        />
      </div>

      <div className="mt-4 card-soft p-5">
        <BudgetBar ratio={savingsGoal > 0 ? mine / savingsGoal : 0} className="[&>div]:bg-success" />
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground">Depósito mensal</p>
            <NumberStepper
              step={10}
              unit="€"
              className="w-40"
              aria-label="Depósito mensal"
              value={plan}
              placeholder={String(Math.ceil(perMonth))}
              onChange={(v) => setMonthlyPlan(me.id, v)}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm">
            <Switch
              checked={!!auto}
              disabled={plan <= 0}
              onCheckedChange={(on) => setAutoSavings(me.id, on ? thisMonth : null)}
            />
            Entra sozinho todos os meses
          </label>
          <p className="basis-full text-xs text-muted-foreground">
            {auto
              ? `Desde ${monthLabel(auto.startMonth)}, entram ${fmtEur(plan)} no dia 1 de cada mês sem teres de registar. `
              : "Liga para não teres de registar o mesmo valor todos os meses. "}
            {plan > 0 &&
              (plan >= perMonth
                ? `Com ${fmtEur(plan)}/mês chegas à meta a tempo.`
                : `Com ${fmtEur(plan)}/mês ficas ${fmtEur(perMonth - plan)}/mês abaixo do necessário.`)}
          </p>
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => { setKind("extra"); setOpen(true); }}>
            <Plus /> Extra
          </Button>
        </div>
      </div>

      <Section title="O teu histórico" className="mt-10">
        {history.length === 0 ? (
          <EmptyState title="Ainda sem registos." hint="Regista o depósito de cada mês e os extras que forem aparecendo." />
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
                <button
                  type="button"
                  aria-label="Apagar registo"
                  className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                  onClick={() => removeSavings(s.id)}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {group}

      <SavingsFormDialog open={open} onOpenChange={setOpen} personId={me.id} defaultKind={kind} />
    </>
  );
}
