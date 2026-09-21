import type { AppData, Expense, Person, PersonId, Settlement, Trip } from "@/data/types";

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Quota de cada pessoa numa despesa. */
export function shareOf(expense: Expense, personId: PersonId) {
  if (!expense.splitBetween.includes(personId) || expense.splitBetween.length === 0) return 0;
  return expense.amount / expense.splitBetween.length;
}

/** Saldo líquido por pessoa: positivo = tem a receber, negativo = deve. */
export function netBalances(
  people: Person[],
  expenses: Expense[],
  settlements: Settlement[],
): Record<PersonId, number> {
  const net: Record<PersonId, number> = {};
  for (const p of people) net[p.id] = 0;
  for (const e of expenses) {
    if (net[e.paidBy] === undefined) continue;
    net[e.paidBy] = (net[e.paidBy] ?? 0) + e.amount;
    for (const pid of e.splitBetween) {
      if (net[pid] !== undefined) net[pid] = (net[pid] ?? 0) - shareOf(e, pid);
    }
  }
  for (const s of settlements) {
    if (net[s.from] !== undefined) net[s.from] = (net[s.from] ?? 0) + s.amount;
    if (net[s.to] !== undefined) net[s.to] = (net[s.to] ?? 0) - s.amount;
  }
  for (const k of Object.keys(net)) net[k] = round2(net[k] ?? 0);
  return net;
}

export interface Transfer {
  from: PersonId;
  to: PersonId;
  amount: number;
}

/** Simplifica dívidas: número mínimo (aproximado) de transferências. */
export function simplifyDebts(net: Record<PersonId, number>): Transfer[] {
  const debtors = Object.entries(net)
    .filter(([, v]) => v < -0.005)
    .map(([id, v]) => ({ id, amount: -v }))
    .sort((a, b) => b.amount - a.amount);
  const creditors = Object.entries(net)
    .filter(([, v]) => v > 0.005)
    .map(([id, v]) => ({ id, amount: v }))
    .sort((a, b) => b.amount - a.amount);

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i]!;
    const c = creditors[j]!;
    const amount = Math.min(d.amount, c.amount);
    if (amount > 0.005) transfers.push({ from: d.id, to: c.id, amount: round2(amount) });
    d.amount -= amount;
    c.amount -= amount;
    if (d.amount < 0.005) i++;
    if (c.amount < 0.005) j++;
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

export function savingsByPerson(data: AppData): Record<PersonId, number> {
  const out: Record<PersonId, number> = {};
  for (const p of data.people) out[p.id] = 0;
  for (const s of data.savings)
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
