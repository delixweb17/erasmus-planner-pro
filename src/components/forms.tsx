import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useData, useStore } from "@/data/store";
import type { Expense, ExpenseCategory, Trip, TripStatus } from "@/data/types";
import { STATUS_LABEL, PersonAvatar } from "@/components/bits";
import { PISA } from "@/data/seed";
import { todayISO } from "@/lib/semester";
import { cn } from "@/lib/utils";

export const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  transporte: "Transporte",
  alojamento: "Alojamento",
  comida: "Comida",
  atividades: "Atividades",
  outros: "Outros",
};

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function PeoplePicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const { people } = useData();
  return (
    <div className="flex flex-wrap gap-2">
      {people.map((p) => {
        const on = value.includes(p.id);
        return (
          <button
            type="button"
            key={p.id}
            onClick={() => onChange(on ? value.filter((v) => v !== p.id) : [...value, p.id])}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm transition-colors",
              on ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground opacity-70",
            )}
          >
            <PersonAvatar person={p} size="sm" />
            {p.name}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Viagem ---------- */

interface TripFormProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  trip?: Trip | undefined;
}

export function TripFormDialog({ open, onOpenChange, trip }: TripFormProps) {
  const { addTrip, updateTrip } = useStore();
  const { people } = useData();
  const [form, setForm] = useState({
    name: "",
    cities: "",
    startDate: "2027-09-15",
    endDate: "2027-09-16",
    budgetPerPerson: 100,
    participants: people.map((p) => p.id),
    status: "planeada" as TripStatus,
    lat: PISA.lat,
    lng: PISA.lng,
    notes: "",
  });

  useEffect(() => {
    if (!open) return;
    if (trip) {
      setForm({
        name: trip.name,
        cities: trip.cities.join(", "),
        startDate: trip.startDate,
        endDate: trip.endDate,
        budgetPerPerson: trip.budgetPerPerson,
        participants: trip.participants,
        status: trip.status,
        lat: trip.lat,
        lng: trip.lng,
        notes: trip.notes ?? "",
      });
    } else {
      setForm((f) => ({ ...f, name: "", cities: "", notes: "", participants: people.map((p) => p.id) }));
    }
  }, [open, trip, people]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Dá um nome à viagem.");
      return;
    }
    if (form.endDate < form.startDate) {
      toast.error("A data de fim é anterior à de início.");
      return;
    }
    if (form.participants.length === 0) {
      toast.error("Escolhe pelo menos uma pessoa.");
      return;
    }
    const payload = {
      name: form.name.trim(),
      cities: form.cities.split(",").map((c) => c.trim()).filter(Boolean),
      startDate: form.startDate,
      endDate: form.endDate,
      budgetPerPerson: Number(form.budgetPerPerson) || 0,
      participants: form.participants,
      status: form.status,
      lat: Number(form.lat),
      lng: Number(form.lng),
      ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
    };
    if (trip) {
      updateTrip(trip.id, payload);
      toast.success("Viagem atualizada.");
    } else {
      addTrip(payload);
      toast.success("Viagem adicionada.");
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {trip ? "Editar viagem" : "Nova viagem"}
          </DialogTitle>
          <DialogDescription>Orçamento por pessoa, em euros.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nome">
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Roma" />
          </Field>
          <Field label="Cidades" hint="Separadas por vírgulas.">
            <Input value={form.cities} onChange={(e) => set("cities", e.target.value)} placeholder="Roma, Tivoli" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Início">
              <Input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
            </Field>
            <Field label="Fim">
              <Input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Orçamento / pessoa (€)">
              <Input
                type="number"
                min={0}
                step={5}
                value={form.budgetPerPerson}
                onChange={(e) => set("budgetPerPerson", Number(e.target.value))}
              />
            </Field>
            <Field label="Estado">
              <select className={selectClass} value={form.status} onChange={(e) => set("status", e.target.value as TripStatus)}>
                {(Object.keys(STATUS_LABEL) as TripStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Quem vai">
            <PeoplePicker value={form.participants} onChange={(v) => set("participants", v)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude">
              <Input type="number" step="0.0001" value={form.lat} onChange={(e) => set("lat", Number(e.target.value))} />
            </Field>
            <Field label="Longitude">
              <Input type="number" step="0.0001" value={form.lng} onChange={(e) => set("lng", Number(e.target.value))} />
            </Field>
          </div>
          <Field label="Notas">
            <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">{trip ? "Guardar" : "Adicionar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Despesa ---------- */

interface ExpenseFormProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  expense?: Expense | undefined;
  defaultTripId?: string | null | undefined;
}

export function ExpenseFormDialog({ open, onOpenChange, expense, defaultTripId = null }: ExpenseFormProps) {
  const { addExpense, updateExpense } = useStore();
  const { people, trips } = useData();
  const [form, setForm] = useState({
    description: "",
    amount: "",
    paidBy: people[0]?.id ?? "",
    splitBetween: people.map((p) => p.id),
    tripId: defaultTripId ?? "",
    date: todayISO(),
    category: "outros" as ExpenseCategory,
  });

  useEffect(() => {
    if (!open) return;
    if (expense) {
      setForm({
        description: expense.description,
        amount: String(expense.amount),
        paidBy: expense.paidBy,
        splitBetween: expense.splitBetween,
        tripId: expense.tripId ?? "",
        date: expense.date,
        category: expense.category,
      });
    } else {
      const trip = trips.find((t) => t.id === defaultTripId);
      setForm({
        description: "",
        amount: "",
        paidBy: people[0]?.id ?? "",
        splitBetween: trip ? trip.participants : people.map((p) => p.id),
        tripId: defaultTripId ?? "",
        date: trip ? trip.startDate : todayISO(),
        category: "outros",
      });
    }
  }, [open, expense, defaultTripId, people, trips]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onTripChange = (id: string) => {
    const trip = trips.find((t) => t.id === id);
    setForm((f) => ({
      ...f,
      tripId: id,
      splitBetween: trip ? trip.participants : f.splitBetween,
      date: trip && (f.date < trip.startDate || f.date > trip.endDate) ? trip.startDate : f.date,
    }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(form.amount.replace(",", "."));
    if (!form.description.trim()) {
      toast.error("Descreve a despesa.");
      return;
    }
    if (!amount || amount <= 0) {
      toast.error("Indica um valor válido.");
      return;
    }
    if (form.splitBetween.length === 0) {
      toast.error("Escolhe quem divide.");
      return;
    }
    const payload = {
      description: form.description.trim(),
      amount: Math.round(amount * 100) / 100,
      paidBy: form.paidBy,
      splitBetween: form.splitBetween,
      tripId: form.tripId || null,
      date: form.date,
      category: form.category,
    };
    if (expense) {
      updateExpense(expense.id, payload);
      toast.success("Despesa atualizada.");
    } else {
      addExpense(payload);
      toast.success("Despesa registada.");
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {expense ? "Editar despesa" : "Nova despesa"}
          </DialogTitle>
          <DialogDescription>Quem pagou, quanto, e entre quem se divide.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Descrição">
            <Input value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Ex.: Comboio Pisa → Roma" autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor total (€)">
              <Input inputMode="decimal" value={form.amount} onChange={(e) => set("amount", e.target.value)} placeholder="0,00" />
            </Field>
            <Field label="Data">
              <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Viagem">
              <select className={selectClass} value={form.tripId} onChange={(e) => onTripChange(e.target.value)}>
                <option value="">Sem viagem (geral)</option>
                {trips.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Categoria">
              <select className={selectClass} value={form.category} onChange={(e) => set("category", e.target.value as ExpenseCategory)}>
                {(Object.keys(CATEGORY_LABEL) as ExpenseCategory[]).map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Quem pagou">
            <select className={selectClass} value={form.paidBy} onChange={(e) => set("paidBy", e.target.value)}>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Dividir entre">
            <PeoplePicker value={form.splitBetween} onChange={(v) => set("splitBetween", v)} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">{expense ? "Guardar" : "Registar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Poupança ---------- */

const MONTHS_PT = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
export const monthLabel = (ym: string) => {
  const [y, m] = ym.split("-");
  return `${MONTHS_PT[Number(m) - 1]} ${y}`;
};

export function SavingsFormDialog({
  open,
  onOpenChange,
  personId,
  defaultKind = "mensal",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  personId: string;
  defaultKind?: "mensal" | "extra";
}) {
  const { addSavings } = useStore();
  const data = useData();
  const plan = data.monthlyPlan[personId] ?? 0;
  const blank = () => ({
    kind: defaultKind,
    amount: defaultKind === "mensal" && plan ? String(plan) : "",
    date: todayISO(),
    month: todayISO().slice(0, 7),
    note: "",
  });
  const [form, setForm] = useState(blank);

  useEffect(() => {
    if (open) setForm(blank());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, personId, defaultKind]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(form.amount.replace(",", "."));
    if (!amount) {
      toast.error("Indica um valor.");
      return;
    }
    if (
      form.kind === "mensal" &&
      data.savings.some((s) => s.personId === personId && s.kind === "mensal" && s.month === form.month) &&
      !confirm(`Já registaste o depósito de ${monthLabel(form.month)}. Adicionar outro?`)
    )
      return;
    addSavings({
      personId,
      amount: Math.round(amount * 100) / 100,
      date: form.kind === "mensal" ? `${form.month}-01` : form.date,
      kind: form.kind,
      ...(form.kind === "mensal" ? { month: form.month } : {}),
      ...(form.note.trim() ? { note: form.note.trim() } : {}),
    });
    toast.success("Poupança registada.");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Registar poupança</DialogTitle>
          <DialogDescription>Valores negativos retiram do mealheiro.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-1 rounded-lg border p-1">
            {(["mensal", "extra"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setForm((f) => ({ ...f, kind: k }))}
                className={cn(
                  "cursor-pointer rounded-md py-1.5 text-sm font-medium",
                  form.kind === k ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {k === "mensal" ? "Depósito do mês" : "Extra pontual"}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor (€)">
              <Input inputMode="decimal" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="250" autoFocus />
            </Field>
            {form.kind === "mensal" ? (
              <Field label="Mês">
                <Input type="month" value={form.month} onChange={(e) => setForm((f) => ({ ...f, month: e.target.value }))} />
              </Field>
            ) : (
              <Field label="Data">
                <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
              </Field>
            )}
          </div>
          <Field label="Nota">
            <Input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="Ex.: salário de agosto" />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">Registar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Perfil ativo ---------- */

export function ProfilePicker({ title = "Quem está a usar este dispositivo?" }: { title?: string }) {
  const { people } = useData();
  const { setActiveProfile, activeProfile } = useStore();
  return (
    <div className="card-soft p-6">
      <p className="font-display text-xl font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        A tua poupança só aparece neste dispositivo depois de escolheres quem és. Os outros veem apenas o total do grupo.
      </p>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {people.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setActiveProfile(p.id)}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent",
              activeProfile === p.id && "border-primary bg-primary/10",
            )}
          >
            <PersonAvatar person={p} />
            <span className="font-medium">{p.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
