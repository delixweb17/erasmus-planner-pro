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
  Exam,
  Expense,
  Person,
  RecurringSaving,
  SavingsEntry,
  Settlement,
  Trip,
} from "./types";
import { toast } from "sonner";
import { migrate, repository } from "./repository";
import { createSeedData, defaultBookings } from "./seed";
import { useAuth } from "./auth";
import {
  applyRemote,
  diff,
  fetchGroupTotal,
  initialOps,
  loadCloud,
  pushOps,
  subscribeCloud,
} from "./cloud";
import { canCloseAccounts, closeAccounts, savingsByPerson } from "@/lib/finance";
import { todayISO } from "@/lib/semester";

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
  /** Passa as contas abertas (já quites) para o histórico */
  closeAccounts: () => void;
  /** Apaga de vez uma despesa já fechada (não mexe nos saldos) */
  removeClosedExpense: (id: string) => void;
  /** Apaga de vez todas as contas fechadas */
  clearClosed: () => void;
  setSavingsGoal: (goal: number) => void;
  addRecurring: (r: Omit<RecurringSaving, "id">) => void;
  updateRecurring: (id: string, patch: Partial<RecurringSaving>) => void;
  removeRecurring: (id: string) => void;
  addClass: (c: Omit<ClassSlot, "id">) => void;
  updateClass: (id: string, patch: Partial<ClassSlot>) => void;
  removeClass: (id: string) => void;
  addExam: (e: Omit<Exam, "id">) => void;
  updateExam: (id: string, patch: Partial<Exam>) => void;
  removeExam: (id: string) => void;
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
  /** Pessoa com sessão iniciada */
  activeProfile: string | null;
  /** Total poupado pelo grupo (vem do servidor, sem revelar quanto tem cada um) */
  groupSavingsTotal: number;
}

const StoreContext = createContext<StoreValue | null>(null);

const MIGRATED_KEY = "erasmus-pisa:migrated";

export function DataProvider({ children }: { children: ReactNode }) {
  const { userId, personId, pendingName, clearPendingName } = useAuth();
  const [data, setDataState] = useState<AppData | null>(null);
  const dataRef = useRef<AppData | null>(null);
  const [groupTotal, setGroupTotal] = useState<number | null>(null);

  const setData = useCallback((d: AppData) => {
    dataRef.current = d;
    setDataState(d);
  }, []);

  const refreshTotal = useCallback(() => {
    fetchGroupTotal().then(setGroupTotal, (e: unknown) => console.error(e));
  }, []);

  /** Carrega tudo da nuvem; na primeira vez envia o que houver neste dispositivo. */
  const load = useCallback(async () => {
    if (!userId || !personId) return;
    let cloud = await loadCloud();
    const migratedKey = `${MIGRATED_KEY}:${personId}`;
    let alreadyMigrated = false;
    try {
      alreadyMigrated = localStorage.getItem(migratedKey) === "1";
    } catch {
      /* sem localStorage */
    }
    if (!cloud || !alreadyMigrated) {
      const local = repository.loadSnapshot();
      const ops = initialOps(local ?? createSeedData(), personId, !!cloud);
      if (ops.length) await pushOps(ops, userId);
      try {
        localStorage.setItem(migratedKey, "1");
      } catch {
        /* sem localStorage */
      }
      cloud = await loadCloud();
    }
    if (cloud) setData(cloud);
    refreshTotal();
  }, [userId, personId, setData, refreshTotal]);

  useEffect(() => {
    load().catch((e: unknown) => {
      console.error(e);
      toast.error("Não consegui carregar os dados. Verifica a ligação e recarrega a página.");
    });
  }, [load]);

  // Alterações dos outros em tempo real.
  useEffect(() => {
    if (!userId || !data) return;
    return subscribeCloud(userId, (table, change) => {
      if (dataRef.current) setData(applyRemote(dataRef.current, table, change));
    });
    // Subscreve uma vez, quando os dados chegam.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, data !== null]);

  // Ao voltar à app depois de algum tempo, recarrega (apanha o que possa ter falhado).
  useEffect(() => {
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 30_000) void load().catch(console.error);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [load]);

  const mutate = useCallback(
    (fn: (d: AppData) => AppData) => {
      const prev = dataRef.current;
      if (!prev || !userId) return;
      const next = fn(prev);
      if (next === prev) return;
      setData(next);
      // Só a própria poupança pode ser escrita (o servidor recusa as outras).
      const ops = diff(prev, next).filter((o) => o.table !== "private_items" || o.action === "delete" || o.person_id === personId);
      pushOps(ops, userId)
        .then(() => {
          if (ops.some((o) => o.table === "private_items")) refreshTotal();
        })
        .catch((e: unknown) => {
          console.error(e);
          toast.error("Não consegui guardar na nuvem. A recarregar os dados…");
          void load().catch(console.error);
        });
    },
    [userId, personId, setData, refreshTotal, load],
  );

  // Nome escrito ao escolher o perfil.
  useEffect(() => {
    if (!data || !pendingName || !personId) return;
    mutate((d) => ({ ...d, people: d.people.map((p) => (p.id === personId ? { ...p, name: pendingName } : p)) }));
    clearPendingName();
  }, [data, pendingName, personId, mutate, clearPendingName]);

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
      // Quando o acerto deixa toda a gente quite, as contas fecham sozinhas.
      addSettlement: (s) =>
        mutate((d) => {
          const next = { ...d, settlements: [...d.settlements, { ...s, id: newId() }] };
          return canCloseAccounts(next) ? closeAccounts(next, s.date) : next;
        }),
      closeAccounts: () => mutate((d) => (canCloseAccounts(d) ? closeAccounts(d, todayISO()) : d)),
      removeClosedExpense: (id) =>
        mutate((d) => {
          const closedAt = d.expenses.find((e) => e.id === id)?.closedAt;
          if (!closedAt) return d;
          const expenses = d.expenses.filter((e) => e.id !== id);
          // Sem despesas desse fecho, os acertos dele já não servem para nada.
          const orphan = !expenses.some((e) => e.closedAt === closedAt);
          return {
            ...d,
            expenses,
            settlements: orphan ? d.settlements.filter((s) => s.closedAt !== closedAt) : d.settlements,
          };
        }),
      clearClosed: () =>
        mutate((d) => ({
          ...d,
          expenses: d.expenses.filter((e) => !e.closedAt),
          settlements: d.settlements.filter((s) => !s.closedAt),
        })),
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
      addExam: (e) => mutate((d) => ({ ...d, exams: [...d.exams, { ...e, id: newId() }] })),
      updateExam: (id, patch) =>
        mutate((d) => ({ ...d, exams: d.exams.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),
      removeExam: (id) => mutate((d) => ({ ...d, exams: d.exams.filter((e) => e.id !== id) })),
      addBooking: (b) => mutate((d) => ({ ...d, bookings: [...d.bookings, { ...b, id: newId() }] })),
      updateBooking: (id, patch) =>
        mutate((d) => ({ ...d, bookings: d.bookings.map((b) => (b.id === id ? { ...b, ...patch } : b)) })),
      removeBooking: (id) => mutate((d) => ({ ...d, bookings: d.bookings.filter((b) => b.id !== id) })),
      // O perfil está ligado à conta; para trocar, sai-se da conta.
      setActiveProfile: () => {},
      // Só a própria poupança entra (a dos outros é privada e fica como está).
      importData: (imported) =>
        mutate(() => {
          const m = migrate(imported);
          return {
            ...m,
            savings: m.savings.filter((x) => x.personId === personId),
            recurring: m.recurring.filter((x) => x.personId === personId),
          };
        }),
      resetData: async () => mutate(() => createSeedData()),
    }),
    [mutate, personId],
  );

  const value = useMemo<StoreValue>(() => {
    const localTotal = data ? Object.values(savingsByPerson(data)).reduce((a, v) => a + v, 0) : 0;
    return {
      data,
      ready: data !== null,
      activeProfile: personId,
      groupSavingsTotal: groupTotal ?? localTotal,
      ...actions,
    };
  }, [data, actions, personId, groupTotal]);

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
