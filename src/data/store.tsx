import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  AppData,
  Booking,
  ClassSlot,
  Expense,
  Person,
  RecurringSaving,
  SavingsEntry,
  Settlement,
  Trip,
} from "./types";
import { migrate, repository } from "./repository";
import { defaultBookings } from "./seed";

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

interface StoreActions {
  updatePerson: (id: string, patch: Partial<Person>) => void;
  addTrip: (trip: Omit<Trip, "id">) => Trip;
  updateTrip: (id: string, patch: Partial<Trip>) => void;
  removeTrip: (id: string) => void;
  addExpense: (expense: Omit<Expense, "id">) => void;
  updateExpense: (id: string, patch: Partial<Expense>) => void;
  removeExpense: (id: string) => void;
  addSavings: (entry: Omit<SavingsEntry, "id">) => void;
  removeSavings: (id: string) => void;
  addSettlement: (s: Omit<Settlement, "id">) => void;
  removeSettlement: (id: string) => void;
  setSavingsGoal: (goal: number) => void;
  addRecurring: (r: Omit<RecurringSaving, "id">) => void;
  updateRecurring: (id: string, patch: Partial<RecurringSaving>) => void;
  removeRecurring: (id: string) => void;
  addClass: (c: Omit<ClassSlot, "id">) => void;
  updateClass: (id: string, patch: Partial<ClassSlot>) => void;
  removeClass: (id: string) => void;
  addBooking: (b: Omit<Booking, "id">) => void;
  updateBooking: (id: string, patch: Partial<Booking>) => void;
  removeBooking: (id: string) => void;
  setActiveProfile: (id: string | null) => void;
  importData: (data: AppData) => void;
  resetData: () => Promise<void>;
}

interface StoreValue extends StoreActions {
  data: AppData | null;
  ready: boolean;
  activeProfile: string | null;
}

const StoreContext = createContext<StoreValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const loaded = useRef(false);
  const [activeProfile, setActive] = useState<string | null>(null);

  useEffect(() => {
    repository.load().then((d) => {
      loaded.current = true;
      setActive(repository.getActiveProfile());
      setData(d);
    });
  }, []);

  useEffect(() => {
    if (data && loaded.current) void repository.save(data);
  }, [data]);

  const mutate = useCallback((fn: (d: AppData) => AppData) => {
    setData((prev) => (prev ? fn(prev) : prev));
  }, []);

  const actions = useMemo<StoreActions>(
    () => ({
      updatePerson: (id, patch) =>
        mutate((d) => ({
          ...d,
          people: d.people.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),
      addTrip: (trip) => {
        const created = { ...trip, id: newId() };
        mutate((d) => ({
          ...d,
          trips: [...d.trips, created],
          bookings: [...d.bookings, ...defaultBookings(created, () => newId())],
        }));
        return created;
      },
      updateTrip: (id, patch) =>
        mutate((d) => ({
          ...d,
          trips: d.trips.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),
      removeTrip: (id) =>
        mutate((d) => ({
          ...d,
          trips: d.trips.filter((t) => t.id !== id),
          bookings: d.bookings.filter((b) => b.tripId !== id),
          expenses: d.expenses.map((e) => (e.tripId === id ? { ...e, tripId: null } : e)),
        })),
      addExpense: (expense) =>
        mutate((d) => ({ ...d, expenses: [...d.expenses, { ...expense, id: newId() }] })),
      updateExpense: (id, patch) =>
        mutate((d) => ({
          ...d,
          expenses: d.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        })),
      removeExpense: (id) =>
        mutate((d) => ({ ...d, expenses: d.expenses.filter((e) => e.id !== id) })),
      addSavings: (entry) =>
        mutate((d) => ({ ...d, savings: [...d.savings, { ...entry, id: newId() }] })),
      removeSavings: (id) =>
        mutate((d) => ({ ...d, savings: d.savings.filter((s) => s.id !== id) })),
      addSettlement: (s) =>
        mutate((d) => ({ ...d, settlements: [...d.settlements, { ...s, id: newId() }] })),
      removeSettlement: (id) =>
        mutate((d) => ({ ...d, settlements: d.settlements.filter((s) => s.id !== id) })),
      setSavingsGoal: (goal) => mutate((d) => ({ ...d, savingsGoal: goal })),
      addRecurring: (r) =>
        mutate((d) => ({ ...d, recurring: [...d.recurring, { ...r, id: newId() }] })),
      updateRecurring: (id, patch) =>
        mutate((d) => ({
          ...d,
          recurring: d.recurring.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        })),
      removeRecurring: (id) =>
        mutate((d) => ({ ...d, recurring: d.recurring.filter((r) => r.id !== id) })),
      addClass: (c) => mutate((d) => ({ ...d, timetable: [...d.timetable, { ...c, id: newId() }] })),
      updateClass: (id, patch) =>
        mutate((d) => ({
          ...d,
          timetable: d.timetable.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),
      removeClass: (id) => mutate((d) => ({ ...d, timetable: d.timetable.filter((c) => c.id !== id) })),
      addBooking: (b) => mutate((d) => ({ ...d, bookings: [...d.bookings, { ...b, id: newId() }] })),
      updateBooking: (id, patch) =>
        mutate((d) => ({ ...d, bookings: d.bookings.map((b) => (b.id === id ? { ...b, ...patch } : b)) })),
      removeBooking: (id) => mutate((d) => ({ ...d, bookings: d.bookings.filter((b) => b.id !== id) })),
      setActiveProfile: (id) => {
        repository.setActiveProfile(id);
        setActive(id);
      },
      importData: (imported) => setData(migrate(imported)),
      resetData: async () => {
        const seed = await repository.reset();
        setData(seed);
      },
    }),
    [mutate],
  );

  const value = useMemo<StoreValue>(
    () => ({ data, ready: data !== null, activeProfile, ...actions }),
    [data, actions, activeProfile],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore tem de ser usado dentro de DataProvider");
  return ctx;
}

/** Devolve os dados já carregados (usar apenas dentro de <Loaded />). */
export function useData(): AppData {
  const { data } = useStore();
  if (!data) throw new Error("Dados ainda não carregados");
  return data;
}
