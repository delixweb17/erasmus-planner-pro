import { useEffect, useState } from "react";
import { BedDouble, ExternalLink, Pencil, Plus, Ticket, Train, Package, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Choice, Field } from "@/components/forms";
import { DatePicker } from "@/components/DatePicker";
import { BudgetBar, PersonAvatar, Section } from "@/components/bits";
import { useData, useStore } from "@/data/store";
import type { Booking, BookingCategory, BookingStatus, Trip } from "@/data/types";
import { bookingTotals } from "@/lib/finance";
import { fmtEur, fmtShort } from "@/lib/format";
import { cn } from "@/lib/utils";

export const BOOKING_CATEGORY: Record<BookingCategory, string> = {
  transporte: "Transporte",
  alojamento: "Alojamento",
  atividade: "Atividade / bilhetes",
  outro: "Outro",
};
const ICON = { transporte: Train, alojamento: BedDouble, atividade: Ticket, outro: Package };
export const BOOKING_STATUS: Record<BookingStatus, string> = {
  pendente: "Por reservar",
  reservado: "Reservado",
  pago: "Pago",
};
const NEXT: Record<BookingStatus, BookingStatus> = { pendente: "reservado", reservado: "pago", pago: "pendente" };

export function BookingsSection({ trip }: { trip: Trip }) {
  const { bookings, people } = useData();
  const { updateBooking, removeBooking } = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Booking | undefined>();
  const list = bookings.filter((b) => b.tripId === trip.id);
  const t = bookingTotals(list);
  const budgetTotal = trip.budgetPerPerson * Math.max(trip.participants.length, 1);
  const byId = Object.fromEntries(people.map((p) => [p.id, p]));

  return (
    <Section
      title="Reservas e logística"
      className="mt-10"
      action={
        <Button size="sm" variant="outline" onClick={() => { setEditing(undefined); setOpen(true); }}>
          <Plus /> Reserva
        </Button>
      }
    >
      <div className="card-soft p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-medium">{t.done} de {t.total} tratadas</span>
          <span className="tabular text-muted-foreground">
            {fmtEur(t.committed)} em reservas · {fmtEur(t.paid)} pago · orçamento {fmtEur(budgetTotal)}
          </span>
        </div>
        <BudgetBar ratio={budgetTotal > 0 ? t.committed / budgetTotal : 0} thin className="mt-2" />
      </div>
      <ul className="card-soft mt-3 divide-y">
        {list.map((b) => {
          const Icon = ICON[b.category];
          const who = b.responsible ? byId[b.responsible] : undefined;
          return (
            <li key={b.id} className="flex items-center gap-3 px-4 py-3">
              <Icon className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {b.title}
                  {b.link && (
                    <a href={b.link} target="_blank" rel="noreferrer" className="ml-1.5 inline-flex text-primary" aria-label="Abrir link">
                      <ExternalLink className="size-3.5" />
                    </a>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {[BOOKING_CATEGORY[b.category], b.provider, b.date && fmtShort(b.date), who && `trata ${who.name}`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              {who && <PersonAvatar person={who} size="sm" />}
              <span className="tabular w-16 text-right text-sm font-semibold">
                {b.actual ?? b.estimated ? fmtEur(b.actual ?? b.estimated) : "—"}
              </span>
              <button
                type="button"
                title="Mudar estado"
                onClick={() => updateBooking(b.id, { status: NEXT[b.status] })}
                className={cn(
                  "cursor-pointer rounded-full border px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap",
                  b.status === "pago" && "border-success/50 bg-success/15 text-foreground",
                  b.status === "reservado" && "border-primary/50 bg-primary/10 text-foreground",
                  b.status === "pendente" && "text-muted-foreground",
                )}
              >
                {BOOKING_STATUS[b.status]}
              </button>
              <button type="button" aria-label="Editar reserva" className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-accent" onClick={() => { setEditing(b); setOpen(true); }}>
                <Pencil className="size-3.5" />
              </button>
              <button type="button" aria-label="Apagar reserva" className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive" onClick={() => { removeBooking(b.id); toast.success("Reserva apagada."); }}>
                <Trash2 className="size-3.5" />
              </button>
            </li>
          );
        })}
        {list.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">Sem reservas.</li>}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">Toca no estado para avançar: Por reservar → Reservado → Pago. Bilhetes em PDF: guarda o link (ex.: Google Drive).</p>
      <BookingFormDialog open={open} onOpenChange={setOpen} trip={trip} booking={editing} />
    </Section>
  );
}

function BookingFormDialog({ open, onOpenChange, trip, booking }: { open: boolean; onOpenChange: (o: boolean) => void; trip: Trip; booking?: Booking | undefined }) {
  const { people } = useData();
  const { addBooking, updateBooking } = useStore();
  const empty = { category: "atividade" as BookingCategory, title: "", provider: "", link: "", estimated: "", actual: "", status: "pendente" as BookingStatus, responsible: "", date: "", notes: "" };
  const [f, setF] = useState(empty);
  useEffect(() => {
    if (!open) return;
    setF(
      booking
        ? {
            category: booking.category,
            title: booking.title,
            provider: booking.provider ?? "",
            link: booking.link ?? "",
            estimated: booking.estimated ? String(booking.estimated) : "",
            actual: booking.actual != null ? String(booking.actual) : "",
            status: booking.status,
            responsible: booking.responsible ?? "",
            date: booking.date ?? "",
            notes: booking.notes ?? "",
          }
        : { ...empty, date: trip.startDate },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, booking, trip.startDate]);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const num = (v: string) => Number(v.replace(",", ".")) || 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.title.trim()) { toast.error("Dá um nome à reserva."); return; }
    const payload: Omit<Booking, "id"> = {
      tripId: trip.id,
      category: f.category,
      title: f.title.trim(),
      estimated: num(f.estimated),
      status: f.status,
      ...(f.actual.trim() ? { actual: num(f.actual) } : {}),
      ...(f.provider.trim() ? { provider: f.provider.trim() } : {}),
      ...(f.link.trim() ? { link: f.link.trim() } : {}),
      ...(f.responsible ? { responsible: f.responsible } : {}),
      ...(f.date ? { date: f.date } : {}),
      ...(f.notes.trim() ? { notes: f.notes.trim() } : {}),
    };
    if (booking) {
      updateBooking(booking.id, { ...payload, actual: payload.actual, provider: payload.provider, link: payload.link, responsible: payload.responsible, date: payload.date, notes: payload.notes } as Partial<Booking>);
      toast.success("Reserva atualizada.");
    } else {
      addBooking(payload);
      toast.success("Reserva adicionada.");
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{booking ? "Editar reserva" : "Nova reserva"}</DialogTitle>
          <DialogDescription>Valores para o grupo todo, em euros.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <Choice value={f.category} onChange={(v) => set("category", v as BookingCategory)} options={(Object.keys(BOOKING_CATEGORY) as BookingCategory[]).map((c) => ({ value: c, label: BOOKING_CATEGORY[c] }))} />
            </Field>
            <Field label="Estado">
              <Choice value={f.status} onChange={(v) => set("status", v as BookingStatus)} options={(Object.keys(BOOKING_STATUS) as BookingStatus[]).map((c) => ({ value: c, label: BOOKING_STATUS[c] }))} />
            </Field>
          </div>
          <Field label="Nome">
            <Input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Ex.: Galleria Borghese" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fornecedor"><Input value={f.provider} onChange={(e) => set("provider", e.target.value)} placeholder="Ryanair, Booking…" /></Field>
            <Field label="Data"><DatePicker clearable placeholder="Sem data" aria-label="Data" value={f.date} onChange={(v) => set("date", v)} /></Field>
          </div>
          <Field label="Link (reserva, bilhete em PDF, Drive)"><Input value={f.link} onChange={(e) => set("link", e.target.value)} placeholder="https://…" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Custo previsto (€)"><Input inputMode="decimal" value={f.estimated} onChange={(e) => set("estimated", e.target.value)} /></Field>
            <Field label="Custo real (€)"><Input inputMode="decimal" value={f.actual} onChange={(e) => set("actual", e.target.value)} /></Field>
          </div>
          <Field label="Quem trata">
            <Choice value={f.responsible} onChange={(v) => set("responsible", v)} options={[{ value: "", label: "Ninguém ainda" }, ...people.map((p) => ({ value: p.id, label: p.name }))]} />
          </Field>
          <Field label="Notas"><Textarea rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit">{booking ? "Guardar" : "Adicionar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
