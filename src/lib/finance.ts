import type {
  AppData,
  Expense,
  Person,
  PersonId,
  RecurringSaving,
  SavingsEntry,
  Settlement,
  Trip,
} from "@/data/types";
import { addMonths, lastMonthBefore, monthOf } from "@/data/repository";

export const round2 = (n: number) => Math.round(n * 100) / 100;

const toCents = (euros: number) => Math.round(euros * 100);

/** Diferenças até este valor (em cêntimos) não pedem transferência nem aparecem como dívida. */
export const SETTLED_CENTS = 4;

/** Um saldo que já não vale uma transferência. */
export const isSettled = (euros: number) => Math.abs(toCents(euros)) <= SETTLED_CENTS;

/**
 * Parte de cada pessoa numa despesa, em cêntimos: todos pagam o mesmo, arredondado para baixo.
 * Os cêntimos que sobram ficam por conta de quem pagou (é a parte dele se entrar na divisão;
 * se não entrar, simplesmente não os recebe). Assim nunca ficam cêntimos por acertar.
 */
export function splitCents(expense: Pick<Expense, "amount" | "paidBy" | "splitBetween">): Record<PersonId, number> {
  const people = [...new Set(expense.splitBetween)];
  const out: Record<PersonId, number> = {};
  if (people.length === 0) return out;
  const total = toCents(expense.amount);
  const base = Math.floor(total / people.length);
  for (const pid of people) out[pid] = base;
  if (people.includes(expense.paidBy)) out[expense.paidBy] = total - base * (people.length - 1);
  return out;
}

/** Quota de cada pessoa numa despesa (em euros, ao cêntimo). */
export function shareOf(expense: Expense, personId: PersonId) {
  return (splitCents(expense)[personId] ?? 0) / 100;
}

/** Saldo líquido por pessoa: positivo = tem a receber, negativo = deve. Contas feitas em cêntimos. */
export function netBalances(
  people: Person[],
  expenses: Expense[],
  settlements: Settlement[],
): Record<PersonId, number> {
  const net: Record<PersonId, number> = {};
  for (const p of people) net[p.id] = 0;
  for (const e of expenses) {
    // Contas fechadas já não contam.
    if (e.closedAt || net[e.paidBy] === undefined) continue;
    const shares = splitCents(e);
    // O que não é de ninguém do grupo (pessoa que já não existe) fica com quem pagou.
    let assigned = 0;
    for (const [pid, cents] of Object.entries(shares)) {
      if (net[pid] === undefined) continue;
      net[pid] = (net[pid] ?? 0) - cents;
      assigned += cents;
    }
    net[e.paidBy] = (net[e.paidBy] ?? 0) + assigned;
  }
  for (const s of settlements) {
    if (s.closedAt || net[s.from] === undefined || net[s.to] === undefined) continue;
    net[s.from] = (net[s.from] ?? 0) + toCents(s.amount);
    net[s.to] = (net[s.to] ?? 0) - toCents(s.amount);
  }
  for (const k of Object.keys(net)) net[k] = (net[k] ?? 0) / 100;
  return net;
}

/** Toda a gente quite nas contas abertas, e há acertos feitos (ou seja, alguém pagou alguma coisa). */
export function canCloseAccounts(d: Pick<AppData, "people" | "expenses" | "settlements">) {
  const hasOpen = d.expenses.some((e) => !e.closedAt) || d.settlements.some((s) => !s.closedAt);
  if (!hasOpen) return false;
  return Object.values(netBalances(d.people, d.expenses, d.settlements)).every(isSettled);
}

/** Passa as despesas e acertos abertos para o histórico ("contas fechadas"). */
export function closeAccounts<T extends Pick<AppData, "expenses" | "settlements">>(d: T, date: string): T {
  return {
    ...d,
    expenses: d.expenses.map((e) => (e.closedAt ? e : { ...e, closedAt: date })),
    settlements: d.settlements.map((s) => (s.closedAt ? s : { ...s, closedAt: date })),
  };
}

export interface Transfer {
  from: PersonId;
  to: PersonId;
  amount: number;
}

/** Simplifica dívidas: número mínimo (aproximado) de transferências, ao cêntimo. */
export function simplifyDebts(net: Record<PersonId, number>): Transfer[] {
  const debtors = Object.entries(net)
    .map(([id, v]) => ({ id, cents: -toCents(v) }))
    .filter((d) => d.cents > SETTLED_CENTS)
    .sort((a, b) => b.cents - a.cents);
  const creditors = Object.entries(net)
    .map(([id, v]) => ({ id, cents: toCents(v) }))
    .filter((c) => c.cents > SETTLED_CENTS)
    .sort((a, b) => b.cents - a.cents);

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i]!;
    const c = creditors[j]!;
    const cents = Math.min(d.cents, c.cents);
    if (cents > SETTLED_CENTS) transfers.push({ from: d.id, to: c.id, amount: cents / 100 });
    d.cents -= cents;
    c.cents -= cents;
    if (d.cents <= SETTLED_CENTS) i++;
    if (c.cents <= SETTLED_CENTS) j++;
  }
  return transfers;
}

export interface TripCost {
  spentTotal: number;
  budgetTotal: number;
  /** custo médio por participante */
  spentPerPerson: number;
  budgetPerPerson: number;
  ratio: number;
  perPerson: Record<PersonId, number>;
}

export function tripCost(trip: Trip, expenses: Expense[]): TripCost {
  const tripExpenses = expenses.filter((e) => e.tripId === trip.id);
  const spentTotal = round2(tripExpenses.reduce((s, e) => s + e.amount, 0));
  const n = Math.max(trip.participants.length, 1);
  const budgetTotal = trip.budgetPerPerson * n;
  const perPerson: Record<PersonId, number> = {};
  for (const pid of trip.participants) {
    perPerson[pid] = round2(tripExpenses.reduce((s, e) => s + shareOf(e, pid), 0));
  }
  const spentPerPerson = round2(spentTotal / n);
  return {
    spentTotal,
    budgetTotal,
    spentPerPerson,
    budgetPerPerson: trip.budgetPerPerson,
    ratio: budgetTotal > 0 ? spentTotal / budgetTotal : 0,
    perPerson,
  };
}

/** Meses de um depósito mensal entre `from` e `to` (inclusive, yyyy-mm). */
export function recurringMonths(r: RecurringSaving, from = r.startMonth, to = r.endMonth) {
  const out: string[] = [];
  let m = from > r.startMonth ? from : r.startMonth;
  const last = to < r.endMonth ? to : r.endMonth;
  while (m <= last) {
    out.push(m);
    m = addMonths(m, 1);
  }
  return out;
}

/** Registos guardados + meses dos depósitos mensais que já entraram (até ao mês atual). */
export function allSavings(data: AppData, now = new Date()): SavingsEntry[] {
  const current = monthOf(now);
  const generated = data.recurring.flatMap((r) =>
    recurringMonths(r, r.startMonth, current).map(
      (m): SavingsEntry => ({
        id: `${r.id}:${m}`,
        personId: r.personId,
        amount: r.amount,
        date: `${m}-01`,
        kind: "mensal",
        month: m,
        note: r.note ?? "Depósito mensal",
        recurringId: r.id,
      }),
    ),
  );
  return [...data.savings, ...generated];
}

/** Quanto os depósitos mensais de uma pessoa ainda vão juntar até ao prazo (meses depois do atual). */
export function upcomingRecurring(data: AppData, personId: PersonId, now = new Date()) {
  const from = addMonths(monthOf(now), 1);
  const to = lastMonthBefore(data.savingsDeadline);
  return round2(
    data.recurring
      .filter((r) => r.personId === personId)
      .reduce((s, r) => s + r.amount * recurringMonths(r, from, to).length, 0),
  );
}

export function savingsByPerson(data: AppData): Record<PersonId, number> {
  const out: Record<PersonId, number> = {};
  for (const p of data.people) out[p.id] = 0;
  for (const s of allSavings(data))
    if (out[s.personId] !== undefined) out[s.personId] = (out[s.personId] ?? 0) + s.amount;
  for (const k of Object.keys(out)) out[k] = round2(out[k] ?? 0);
  return out;
}

export function monthsUntil(fromISO: string, toISO: string) {
  const a = new Date(fromISO + "T00:00:00");
  const b = new Date(toISO + "T00:00:00");
  const months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  const frac = (b.getDate() - a.getDate()) / 30;
  return Math.max(0, months + frac);
}

export function totalBudgetPerPerson(trips: Trip[], personId?: PersonId) {
  return trips
    .filter((t) => !personId || t.participants.includes(personId))
    .reduce((s, t) => s + t.budgetPerPerson, 0);
}

/** Soma dos depósitos de uma pessoa num mês (yyyy-mm). */
export function savedInMonth(data: AppData, personId: PersonId, month: string) {
  return round2(
    allSavings(data)
      .filter((s) => s.personId === personId && (s.month ?? s.date.slice(0, 7)) === month)
      .reduce((a, s) => a + s.amount, 0),
  );
}

/** Quanto falta por mês (incluindo o atual) para chegar à meta no prazo. */
export function requiredPerMonth(saved: number, goal: number, todayISO: string, deadlineISO: string) {
  const a = new Date(todayISO + "T00:00:00");
  const b = new Date(deadlineISO + "T00:00:00");
  const monthsLeft = Math.max(1, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()));
  return round2(Math.max(0, goal - saved) / monthsLeft);
}

export function bookingTotals(bookings: { estimated: number; actual?: number; status: string }[]) {
  const committed = bookings.reduce((s, b) => s + (b.actual ?? b.estimated), 0);
  const paid = bookings.filter((b) => b.status === "pago").reduce((s, b) => s + (b.actual ?? b.estimated), 0);
  const done = bookings.filter((b) => b.status !== "pendente").length;
  return { committed: round2(committed), paid: round2(paid), done, total: bookings.length };
}
