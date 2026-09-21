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
import type { AppData, Expense, Person, SavingsEntry, Settlement, Trip } from "./types";
import { repository } from "./repository";

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
  importData: (data: AppData) => void;
  resetData: () => Promise<void>;
}

interface StoreValue extends StoreActions {
  data: AppData | null;
  ready: boolean;
}

const StoreContext = createContext<StoreValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    repository.load().then((d) => {
      loaded.current = true;
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
        mutate((d) => ({ ...d, trips: [...d.trips, created] }));
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
      importData: (imported) => setData(imported),
      resetData: async () => {
        const seed = await repository.reset();
        setData(seed);
      },
    }),
    [mutate],
  );

  const value = useMemo<StoreValue>(
    () => ({ data, ready: data !== null, ...actions }),
    [data, actions],
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
