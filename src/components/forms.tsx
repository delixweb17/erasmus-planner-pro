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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useData, useStore } from "@/data/store";
import type { Expense, ExpenseCategory, RecurringSaving, Trip, TripStatus } from "@/data/types";
import { NumberStepper, STATUS_LABEL, PersonAvatar } from "@/components/bits";
import { PISA } from "@/data/seed";
import { DatePicker } from "@/components/DatePicker";
import { PlaceSearch, searchPlaces, type Place } from "@/components/PlaceSearch";
import { Loader2, MapPin } from "lucide-react";
import { addMonths, lastMonthBefore } from "@/data/repository";
import { recurringMonths } from "@/lib/finance";
import { fmtEur } from "@/lib/format";
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

const NONE = "__none__";

/** Lista de escolha com o estilo da app (substitui o <select> nativo). */
export function Choice({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value === "" ? NONE : value} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value || NONE} value={o.value || NONE}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
  /** Nome do lugar escolhido no mapa; null = ainda não foi localizado */
  const [place, setPlace] = useState<string | null>(null);
  const [manualCoords, setManualCoords] = useState(false);
  const [locating, setLocating] = useState(false);
  /** O lugar veio da primeira cidade (e não de uma pesquisa): muda se as cidades mudarem */
  const [autoPlaced, setAutoPlaced] = useState(false);

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
      setPlace(trip.cities[0] ?? trip.name);
    } else {
      setForm((f) => ({
        ...f,
        name: "",
        cities: "",
        notes: "",
        lat: PISA.lat,
        lng: PISA.lng,
        participants: people.map((p) => p.id),
      }));
      setPlace(null);
    }
    setManualCoords(false);
    setAutoPlaced(false);
  }, [open, trip, people]);

  const choosePlace = (p: Place) => {
    setForm((f) => ({ ...f, lat: p.lat, lng: p.lng, cities: f.cities.trim() ? f.cities : p.name }));
    setPlace(p.label);
    setAutoPlaced(false);
  };

  /** Localiza a primeira cidade escrita, se ainda não houver lugar escolhido. */
  const locateFirstCity = async (): Promise<{ lat: number; lng: number } | null> => {
    const first = form.cities.split(",")[0]?.trim();
    if (!first) return null;
    setLocating(true);
    try {
      const [hit] = await searchPlaces(first);
      if (!hit) return null;
      setForm((f) => ({ ...f, lat: hit.lat, lng: hit.lng }));
      setPlace(hit.label);
      setAutoPlaced(true);
      return hit;
    } catch {
      return null;
    } finally {
      setLocating(false);
    }
  };

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
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
    let coords = { lat: Number(form.lat), lng: Number(form.lng) };
    if (place === null && !manualCoords) {
      const found = await locateFirstCity();
      if (found) coords = found;
      else toast.warning("Não encontrei a cidade no mapa — a viagem fica marcada em Pisa até a localizares.");
    }
    const payload = {
      name: form.name.trim(),
      cities: form.cities.split(",").map((c) => c.trim()).filter(Boolean),
      startDate: form.startDate,
      endDate: form.endDate,
      budgetPerPerson: Number(form.budgetPerPerson) || 0,
      participants: form.participants,
      status: form.status,
      lat: coords.lat,
      lng: coords.lng,
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
        <form onSubmit={submit} className="min-w-0 space-y-4">
          <Field label="Nome">
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Roma" />
          </Field>
          <Field label="Cidades" hint="Separadas por vírgulas.">
            <Input
              value={form.cities}
              onChange={(e) => {
                set("cities", e.target.value);
                if (autoPlaced) setPlace(null);
              }}
              onBlur={() => {
                if (place === null && !manualCoords) void locateFirstCity();
              }}
              placeholder="Roma, Tivoli"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Início">
              <DatePicker
                semester
                aria-label="Início"
                value={form.startDate}
                onChange={(v) => setForm((f) => ({ ...f, startDate: v, endDate: f.endDate < v ? v : f.endDate }))}
              />
            </Field>
            <Field label="Fim">
              <DatePicker semester aria-label="Fim" min={form.startDate} value={form.endDate} onChange={(v) => set("endDate", v)} />
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
              <Choice value={form.status} onChange={(v) => set("status", v as TripStatus)} options={(Object.keys(STATUS_LABEL) as TripStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))} />
            </Field>
          </div>
          <Field label="Quem vai">
            <PeoplePicker value={form.participants} onChange={(v) => set("participants", v)} />
          </Field>
          <Field label="No mapa">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                {locating ? (
                  <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                ) : (
                  <MapPin className={cn("size-4 shrink-0", place ? "text-primary" : "text-muted-foreground")} />
                )}
                <span className={cn("min-w-0 flex-1 truncate", !place && "text-muted-foreground")}>
                  {locating
                    ? "A localizar…"
                    : place ?? (manualCoords ? "Coordenadas à mão" : "Vai para a primeira cidade")}
                </span>
                <button
                  type="button"
                  className="shrink-0 cursor-pointer text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setManualCoords((m) => !m)}
                >
                  {manualCoords ? "Esconder coordenadas" : "Coordenadas"}
                </button>
              </div>
              <PlaceSearch onSelect={choosePlace} placeholder="Outro lugar? Procura aqui…" />
              {manualCoords && (
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    type="number"
                    step="0.0001"
                    aria-label="Latitude"
                    value={form.lat}
                    onChange={(e) => {
                      set("lat", Number(e.target.value));
                      setPlace(null);
                    }}
                  />
                  <Input
                    type="number"
                    step="0.0001"
                    aria-label="Longitude"
                    value={form.lng}
                    onChange={(e) => {
                      set("lng", Number(e.target.value));
                      setPlace(null);
                    }}
                  />
                </div>
              )}
            </div>
          </Field>
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
              <DatePicker aria-label="Data" value={form.date} onChange={(v) => set("date", v)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Viagem">
              <Choice value={form.tripId} onChange={(v) => onTripChange(v)} options={[{ value: "", label: "Sem viagem (geral)" }, ...trips.map((t) => ({ value: t.id, label: t.name }))]} />
            </Field>
            <Field label="Categoria">
              <Choice value={form.category} onChange={(v) => set("category", v as ExpenseCategory)} options={(Object.keys(CATEGORY_LABEL) as ExpenseCategory[]).map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))} />
            </Field>
          </div>
          <Field label="Quem pagou">
            <Choice value={form.paidBy} onChange={(v) => set("paidBy", v)} options={people.map((p) => ({ value: p.id, label: p.name }))} />
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
  defaultKind = "extra",
  editing,
  suggestedAmount = 0,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  personId: string;
  defaultKind?: "mensal" | "extra";
  /** Depósito mensal a editar */
  editing?: RecurringSaving | null;
  /** Valor por mês sugerido para chegar à meta */
  suggestedAmount?: number;
}) {
  const { addSavings, addRecurring, updateRecurring } = useStore();
  const data = useData();
  const current = todayISO().slice(0, 7);
  const deadlineMonth = lastMonthBefore(data.savingsDeadline);
  const blank = () => ({
    kind: editing ? ("mensal" as const) : defaultKind,
    amount: "",
    date: todayISO(),
    note: editing?.note ?? "",
    monthly: editing?.amount ?? Math.ceil(suggestedAmount / 10) * 10,
    startMonth: editing?.startMonth ?? current,
    endMonth: editing?.endMonth ?? (deadlineMonth >= current ? deadlineMonth : current),
  });
  const [form, setForm] = useState(blank);

  useEffect(() => {
    if (open) setForm(blank());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, personId, defaultKind, editing]);

  const firstOption = [addMonths(current, -12), editing?.startMonth ?? current].sort()[0]!;
  const lastOption = [addMonths(deadlineMonth, 6), editing?.endMonth ?? current].sort().at(-1)!;
  const monthOptions: string[] = [];
  for (let m = firstOption; m <= lastOption; m = addMonths(m, 1)) monthOptions.push(m);

  const months =
    form.endMonth >= form.startMonth
      ? recurringMonths({ id: "", personId, amount: 0, startMonth: form.startMonth, endMonth: form.endMonth }).length
      : 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const note = form.note.trim();
    if (form.kind === "mensal") {
      if (form.monthly <= 0) {
        toast.error("Indica quanto queres pôr por mês.");
        return;
      }
      if (form.endMonth < form.startMonth) {
        toast.error("O último mês tem de ser depois do primeiro.");
        return;
      }
      const r = {
        amount: form.monthly,
        startMonth: form.startMonth,
        endMonth: form.endMonth,
        ...(note ? { note } : {}),
      };
      if (editing) updateRecurring(editing.id, { ...r, note: note || undefined });
      else addRecurring({ personId, ...r });
      toast.success(editing ? "Depósito mensal atualizado." : "Depósito mensal criado.");
    } else {
      const amount = Number(form.amount.replace(",", "."));
      if (!amount) {
        toast.error("Indica um valor.");
        return;
      }
      addSavings({
        personId,
        amount: Math.round(amount * 100) / 100,
        date: form.date,
        kind: "extra",
        ...(note ? { note } : {}),
      });
      toast.success("Poupança registada.");
    }
    onOpenChange(false);
  };

  const monthSelect = (value: string, onChange: (v: string) => void) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {monthOptions.map((m) => (
          <SelectItem key={m} value={m}>
            {monthLabel(m)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {editing ? "Editar depósito mensal" : form.kind === "mensal" ? "Novo depósito mensal" : "Valor único"}
          </DialogTitle>
          <DialogDescription>
            {form.kind === "mensal"
              ? "Entra no dia 1 de cada mês, do primeiro ao último mês que escolheres."
              : "Entra já, uma vez. Valores negativos retiram do mealheiro."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {form.kind === "mensal" ? (
            <>
              <Field label="Valor por mês">
                <NumberStepper
                  step={10}
                  unit="€"
                  className="w-44"
                  aria-label="Valor por mês"
                  value={form.monthly}
                  onChange={(v) => setForm((f) => ({ ...f, monthly: v }))}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Primeiro mês">
                  {monthSelect(form.startMonth, (v) =>
                    setForm((f) => ({ ...f, startMonth: v, endMonth: f.endMonth < v ? v : f.endMonth })),
                  )}
                </Field>
                <Field label="Último mês">{monthSelect(form.endMonth, (v) => setForm((f) => ({ ...f, endMonth: v })))}</Field>
              </div>
              <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                {months > 0 && form.monthly > 0 ? (
                  <>
                    {months} {months === 1 ? "mês" : "meses"} × {fmtEur(form.monthly)} ={" "}
                    <span className="font-semibold text-foreground">{fmtEur(months * form.monthly)}</span> no total
                  </>
                ) : (
                  "Escolhe o valor e o período."
                )}
              </p>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Valor (€)">
                <Input
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="250"
                  autoFocus
                />
              </Field>
              <Field label="Data">
                <DatePicker aria-label="Data" value={form.date} onChange={(v) => setForm((f) => ({ ...f, date: v }))} />
              </Field>
            </div>
          )}
          <Field label="Nota">
            <Input
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder={form.kind === "mensal" ? "Ex.: parte do salário" : "Ex.: prenda de anos"}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">{editing ? "Guardar" : "Registar"}</Button>
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
