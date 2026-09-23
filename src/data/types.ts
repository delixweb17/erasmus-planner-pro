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
}

export interface AppData {
  version: 1;
  people: Person[];
  trips: Trip[];
  expenses: Expense[];
  savings: SavingsEntry[];
  settlements: Settlement[];
  bookings: Booking[];
  /** Valor mensal planeado por pessoa */
  monthlyPlan: Record<PersonId, number>;
  savingsGoal: number;
  savingsDeadline: string;
}
