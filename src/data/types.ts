export type PersonId = string;
export type TripId = string;

export interface Person {
  id: PersonId;
  name: string;
  /** Cor do avatar (índice de 0 a 3) */
  color: number;
}

export type TripStatus = "ideia" | "planeada" | "reservada" | "concluida";

export interface Trip {
  id: TripId;
  name: string;
  cities: string[];
  /** ISO date yyyy-mm-dd */
  startDate: string;
  endDate: string;
  budgetPerPerson: number;
  participants: PersonId[];
  status: TripStatus;
  lat: number;
  lng: number;
  notes?: string;
}

export type ExpenseCategory =
  | "transporte"
  | "alojamento"
  | "comida"
  | "atividades"
  | "outros";

export interface Expense {
  id: string;
  tripId: TripId | null;
  description: string;
  amount: number;
  paidBy: PersonId;
  splitBetween: PersonId[];
  date: string;
  category: ExpenseCategory;
  /** Data em que as contas desta despesa ficaram fechadas (já não conta para os saldos) */
  closedAt?: string | undefined;
}

export interface SavingsEntry {
  id: string;
  personId: PersonId;
  amount: number;
  date: string;
  note?: string;
  /** "mensal" = depósito do mês (yyyy-mm em `month`), "extra" = pontual */
  kind?: "mensal" | "extra";
  month?: string;
  /** Preenchido nas entradas geradas a partir de um depósito mensal */
  recurringId?: string;
}

/** Valor que entra no dia 1 de cada mês, de `startMonth` a `endMonth` (yyyy-mm, inclusive). */
export interface RecurringSaving {
  id: string;
  personId: PersonId;
  amount: number;
  startMonth: string;
  endMonth: string;
  note?: string | undefined;
}

export type BookingCategory = "transporte" | "alojamento" | "atividade" | "outro";
export type BookingStatus = "pendente" | "reservado" | "pago";

export interface Booking {
  id: string;
  tripId: TripId;
  category: BookingCategory;
  title: string;
  provider?: string;
  link?: string;
  /** Custo total do grupo */
  estimated: number;
  actual?: number;
  status: BookingStatus;
  responsible?: PersonId;
  date?: string;
  notes?: string;
}

export interface Settlement {
  id: string;
  from: PersonId;
  to: PersonId;
  amount: number;
  date: string;
  /** Data em que este acerto ficou fechado (já não conta para os saldos) */
  closedAt?: string | undefined;
}

/** Aula do horário semanal (repete-se todas as semanas no período de aulas). */
export interface ClassSlot {
  id: string;
  subject: string;
  /** 1 = segunda … 6 = sábado */
  weekday: number;
  /** "HH:MM" */
  start: string;
  end: string;
  room?: string | undefined;
  /** Quem tem esta aula */
  people: PersonId[];
}

/** Exame com data marcada. */
export interface Exam {
  id: string;
  subject: string;
  /** ISO yyyy-mm-dd */
  date: string;
  /** "HH:MM" */
  time?: string | undefined;
  room?: string | undefined;
  people: PersonId[];
}

export interface AppData {
  version: 1;
  people: Person[];
  trips: Trip[];
  expenses: Expense[];
  savings: SavingsEntry[];
  settlements: Settlement[];
  bookings: Booking[];
  /** Depósitos mensais; as entradas de cada mês são calculadas, não guardadas */
  recurring: RecurringSaving[];
  /** Horário semanal da universidade */
  timetable: ClassSlot[];
  /** Datas dos exames */
  exams: Exam[];
  savingsGoal: number;
  savingsDeadline: string;
}
