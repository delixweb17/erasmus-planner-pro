import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, CornerUpLeft, Loader2, Plane, Receipt, SendHorizontal, SmilePlus, Ticket, Trash2, X } from "lucide-react";
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Loaded, PersonAvatar } from "@/components/bits";
import { useConfirm } from "@/components/Confirm";
import { Choice } from "@/components/forms";
import { REACTIONS, useChat, type Message } from "@/data/chat";
import { useData, useStore } from "@/data/store";
import type { AppData, Person } from "@/data/types";
import { fmtShort } from "@/lib/format";
import {
  KIND_LABEL,
  entityToken,
  mentionables,
  mentionedEntities,
  messageAboutTrip,
  normalize,
  parseMessage,
  personToken,
  plainText,
  resolveEntity,
  type EntityKind,
  type EntityRef,
  type ResolvedEntity,
} from "@/lib/mentions";
import { todayISO, toISODate } from "@/lib/semester";
import { cn } from "@/lib/utils";

interface ChatSearch {
  /** Viagem para filtrar as mensagens */
  trip?: string;
  /** Começar a escrever já a mencionar isto ("trip:t04", "expense:…") */
  about?: string;
}

export const Route = createFileRoute("/chat")({
  validateSearch: (s: Record<string, unknown>): ChatSearch => ({
    ...(typeof s["trip"] === "string" ? { trip: s["trip"] } : {}),
    ...(typeof s["about"] === "string" ? { about: s["about"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Chat — Erasmus em Pisa 27/28" },
      { name: "description", content: "Conversa do grupo, com menções a viagens, despesas, reservas e exames." },
    ],
  }),
  component: () => <Loaded>{() => <ChatPage />}</Loaded>,
});

const KIND_ICON: Record<EntityKind, typeof Plane> = {
  trip: Plane,
  expense: Receipt,
  booking: Ticket,
  exam: CalendarDays,
};

/** Para onde leva cada menção. */
function EntityLink({ entity, className, children }: { entity: ResolvedEntity; className?: string; children: ReactNode }) {
  if (entity.kind === "trip" || (entity.kind === "booking" && entity.tripId))
    return (
      <Link to="/viagens/$tripId" params={{ tripId: entity.tripId! }} className={className}>
        {children}
      </Link>
    );
  if (entity.kind === "expense")
    return (
      <Link to="/despesas" className={className}>
        {children}
      </Link>
    );
  return (
    <Link to="/calendario" className={className}>
      {children}
    </Link>
  );
}

function ChatPage() {
  const data = useData();
  const { activeProfile } = useStore();
  const chat = useChat();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const confirm = useConfirm();
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [actionsFor, setActionsFor] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const byId = useMemo(() => Object.fromEntries(data.people.map((p) => [p.id, p])), [data.people]);

  useEffect(() => {
    chat.setChatOpen(true);
    return () => chat.setChatOpen(false);
  }, [chat]);

  const tripFilter = search.trip ?? "";
  const visible = useMemo(
    () => (tripFilter ? chat.messages.filter((m) => !m.deleted && messageAboutTrip(m.body, tripFilter, data)) : chat.messages),
    [chat.messages, tripFilter, data],
  );

  // Fica colado ao fundo quando chegam mensagens (se já lá estava).
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [visible.length, chat.loading]);

  // Marca como lido quando se está a ver o fim da conversa.
  useEffect(() => {
    if (atBottom.current && document.visibilityState === "visible") chat.markRead();
  }, [chat, visible.length]);

  const byMessage = useMemo(() => Object.fromEntries(chat.messages.map((m) => [m.id, m])), [chat.messages]);

  return (
    <div className="fade-up flex h-[calc(100dvh-12.5rem)] flex-col lg:h-[calc(100dvh-5rem)]">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Grupo</p>
          <h1 className="text-3xl font-semibold">Chat</h1>
        </div>
        <div className="w-full sm:w-64">
          <Choice
            value={tripFilter}
            onChange={(v) =>
              void navigate({
                search: (s: ChatSearch): ChatSearch => ({ ...(s.about ? { about: s.about } : {}), ...(v ? { trip: v } : {}) }),
              })
            }
            options={[
              { value: "", label: "Todas as mensagens" },
              ...[...data.trips]
                .sort((a, b) => a.startDate.localeCompare(b.startDate))
                .map((t) => ({ value: t.id, label: `Sobre ${t.name}` })),
            ]}
          />
        </div>
      </div>

      <div
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          if (atBottom.current) chat.markRead();
        }}
        className="card-soft min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5"
        onClick={() => setActionsFor(null)}
      >
        {chat.loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : visible.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
            <p className="font-medium">{tripFilter ? "Ainda ninguém falou desta viagem." : "Ainda não há mensagens."}</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Escreve <span className="font-semibold text-foreground">#</span> para mencionar uma viagem, despesa, reserva
              ou exame, e <span className="font-semibold text-foreground">@</span> para chamar alguém.
            </p>
          </div>
        ) : (
          <>
            {chat.hasOlder && !tripFilter && (
              <div className="mb-3 flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    atBottom.current = false;
                    void chat.loadOlder();
                  }}
                  className="cursor-pointer rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-accent"
                >
                  Carregar mensagens antigas
                </button>
              </div>
            )}
            {visible.map((m, i) => {
              const prev = visible[i - 1];
              const day = toISODate(new Date(m.created_at));
              const newDay = !prev || toISODate(new Date(prev.created_at)) !== day;
              const grouped =
                !newDay &&
                prev?.author === m.author &&
                Date.parse(m.created_at) - Date.parse(prev.created_at) < 5 * 60_000 &&
                !m.reply_to;
              return (
                <Fragment key={m.id}>
                  {newDay && <DaySeparator iso={day} />}
                  <MessageRow
                    m={m}
                    me={activeProfile}
                    author={byId[m.author]}
                    grouped={grouped}
                    data={data}
                    byId={byId}
                    replied={m.reply_to ? byMessage[m.reply_to] : undefined}
                    reactions={chat.reactions.filter((r) => r.message_id === m.id)}
                    showActions={actionsFor === m.id}
                    onShowActions={() => setActionsFor((x) => (x === m.id ? null : m.id))}
                    onReact={(emoji) => {
                      setActionsFor(null);
                      void chat.toggleReaction(m.id, emoji);
                    }}
                    onReply={() => {
                      setActionsFor(null);
                      setReplyTo(m);
                    }}
                    onDelete={async () => {
                      setActionsFor(null);
                      if (
                        await confirm({
                          title: "Apagar esta mensagem?",
                          description: "Fica “Mensagem apagada” no lugar dela, para toda a gente.",
                          confirmLabel: "Apagar",
                          destructive: true,
                        })
                      )
                        void chat.remove(m.id);
                    }}
                    onJump={(id) => document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
                  />
                </Fragment>
              );
            })}
          </>
        )}
      </div>

      <Composer
        data={data}
        me={activeProfile}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        about={search.about}
        onAboutUsed={() =>
          void navigate({ search: (s: ChatSearch): ChatSearch => (s.trip ? { trip: s.trip } : {}), replace: true })
        }
        onSend={async (body) => {
          atBottom.current = true;
          const r = replyTo;
          setReplyTo(null);
          await chat.send(body, r?.id ?? null);
        }}
      />
    </div>
  );
}

function DaySeparator({ iso }: { iso: string }) {
  const today = todayISO();
  const yesterday = toISODate(new Date(Date.now() - 86_400_000));
  const label = iso === today ? "Hoje" : iso === yesterday ? "Ontem" : fmtShort(iso);
  return (
    <div className="my-4 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      {label}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

const time = (iso: string) => new Date(iso).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });

function MessageRow({
  m,
  me,
  author,
  grouped,
  data,
  byId,
  replied,
  reactions,
  showActions,
  onShowActions,
  onReact,
  onReply,
  onDelete,
  onJump,
}: {
  m: Message;
  me: string | null;
  author: Person | undefined;
  grouped: boolean;
  data: AppData;
  byId: Record<string, Person>;
  replied: Message | undefined;
  reactions: { person_id: string; emoji: string }[];
  showActions: boolean;
  onShowActions: () => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onDelete: () => void;
  onJump: (id: string) => void;
}) {
  const mine = m.author === me;
  const mentionsMe = !!me && !mine && m.body.includes(personToken(me));
  const entities = m.deleted ? [] : mentionedEntities(m.body).slice(0, 3);
  const grouped2 = Object.entries(
    reactions.reduce<Record<string, string[]>>((acc, r) => {
      (acc[r.emoji] ??= []).push(r.person_id);
      return acc;
    }, {}),
  );

  return (
    <div
      id={`msg-${m.id}`}
      className={cn("group/msg flex gap-2", mine ? "flex-row-reverse" : "flex-row", grouped ? "mt-0.5" : "mt-3")}
    >
      {!mine && <div className="w-8 shrink-0">{!grouped && <PersonAvatar person={author} size="sm" />}</div>}
      <div className={cn("flex min-w-0 max-w-[85%] flex-col sm:max-w-[70%]", mine ? "items-end" : "items-start")}>
        {!grouped && (
          <p className={cn("mb-0.5 px-1 text-[11px] text-muted-foreground", mine && "text-right")}>
            {!mine && <span className="font-semibold text-foreground">{author?.name ?? m.author}</span>} {time(m.created_at)}
          </p>
        )}

        <div className={cn("relative flex max-w-full items-center gap-1", mine ? "flex-row-reverse" : "flex-row")}>
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (!m.deleted) onShowActions();
            }}
            className={cn(
              "min-w-0 rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
              m.deleted
                ? "border border-dashed italic text-muted-foreground"
                : mine
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground",
              mentionsMe && "ring-2 ring-primary/60",
              m.pending && "opacity-60",
            )}
          >
            {replied && !m.deleted && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onJump(replied.id);
                }}
                className={cn(
                  "mb-1 block w-full cursor-pointer truncate rounded-lg border-l-2 px-2 py-1 text-left text-xs",
                  mine ? "border-primary-foreground/60 bg-primary-foreground/15" : "border-primary/60 bg-background/60",
                )}
              >
                <span className="font-semibold">{byId[replied.author]?.name}</span>{" "}
                {replied.deleted ? "Mensagem apagada" : plainText(replied.body, data)}
              </button>
            )}
            {m.deleted ? "Mensagem apagada" : <MessageBody body={m.body} data={data} byId={byId} mine={mine} />}
          </div>

          {!m.deleted && (
            <div
              className={cn(
                // No telemóvel só aparecem depois de tocar na mensagem; no computador ao passar o rato.
                "shrink-0 items-center gap-0.5 transition-opacity sm:flex sm:opacity-0 sm:group-hover/msg:opacity-100",
                showActions ? "flex sm:opacity-100" : "hidden",
              )}
            >
              <ReactionPicker onPick={onReact} />
              <IconButton label="Responder" onClick={onReply}>
                <CornerUpLeft className="size-3.5" />
              </IconButton>
              {mine && (
                <IconButton label="Apagar mensagem" onClick={onDelete} danger>
                  <Trash2 className="size-3.5" />
                </IconButton>
              )}
            </div>
          )}
        </div>

        {entities.length > 0 && (
          <div className="mt-1.5 flex w-full flex-col gap-1.5">
            {entities.map((ref) => (
              <EntityCard key={`${ref.kind}:${ref.id}`} refr={ref} data={data} label={labelFor(m.body, ref)} />
            ))}
          </div>
        )}

        {grouped2.length > 0 && (
          <div className={cn("mt-1 flex flex-wrap gap-1", mine && "justify-end")}>
            {grouped2.map(([emoji, people]) => {
              const reacted = !!me && people.includes(me);
              return (
                <button
                  key={emoji}
                  type="button"
                  title={people.map((p) => byId[p]?.name ?? p).join(", ")}
                  onClick={() => onReact(emoji)}
                  className={cn(
                    "flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors",
                    reacted ? "border-primary/50 bg-primary/10" : "hover:bg-accent",
                  )}
                >
                  <span>{emoji}</span>
                  <span className="tabular text-muted-foreground">{people.length}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "cursor-pointer rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent",
        danger ? "hover:text-destructive" : "hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ReactionPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <IconButton label="Reagir" onClick={() => setOpen((o) => !o)}>
        <SmilePlus className="size-3.5" />
      </IconButton>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-full left-1/2 z-20 mb-1 flex -translate-x-1/2 gap-0.5 rounded-full border bg-popover p-1 shadow-md"
        >
          {REACTIONS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                setOpen(false);
                onPick(e);
              }}
              className="cursor-pointer rounded-full px-1.5 py-1 text-base transition-transform hover:scale-125"
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function labelFor(body: string, ref: EntityRef) {
  for (const s of parseMessage(body)) if (s.type === "entity" && s.kind === ref.kind && s.id === ref.id) return s.label;
  return "";
}

function MessageBody({
  body,
  data,
  byId,
  mine,
}: {
  body: string;
  data: AppData;
  byId: Record<string, Person>;
  mine: boolean;
}) {
  return (
    <p className="whitespace-pre-wrap break-words">
      {parseMessage(body).map((s, i) => {
        if (s.type === "text") return <Fragment key={i}>{s.text}</Fragment>;
        if (s.type === "person")
          return (
            <span key={i} className={cn("font-semibold", mine ? "underline decoration-primary-foreground/40" : "text-primary")}>
              @{byId[s.id]?.name ?? s.id}
            </span>
          );
        const entity = resolveEntity(data, s);
        if (!entity)
          return (
            <span key={i} className="line-through opacity-70">
              #{s.label}
            </span>
          );
        return (
          <EntityLink
            key={i}
            entity={entity}
            className={cn("font-semibold hover:underline", mine ? "underline decoration-primary-foreground/40" : "text-primary")}
          >
            #{entity.title}
          </EntityLink>
        );
      })}
    </p>
  );
}

function EntityCard({ refr, data, label }: { refr: EntityRef; data: AppData; label: string }) {
  const entity = resolveEntity(data, refr);
  const Icon = KIND_ICON[refr.kind];
  if (!entity)
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-dashed px-3 py-2 text-xs text-muted-foreground">
        <Icon className="size-4 shrink-0" />
        <span className="truncate">
          {KIND_LABEL[refr.kind]} “{label}” já foi apagada
        </span>
      </div>
    );
  return (
    <EntityLink
      entity={entity}
      className="flex items-center gap-2.5 rounded-xl border bg-card px-3 py-2 text-left transition-colors hover:bg-accent/50"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {KIND_LABEL[refr.kind]}
        </span>
        <span className="block truncate text-sm font-semibold">{entity.title}</span>
        <span className="block truncate text-xs text-muted-foreground">{entity.subtitle}</span>
      </span>
    </EntityLink>
  );
}

/* ---------- Caixa de escrita com menções ---------- */

interface Suggestion {
  key: string;
  trigger: "#" | "@";
  label: string;
  subtitle: string;
  group: string;
  token: string;
  icon: ReactNode;
}

function Composer({
  data,
  me,
  replyTo,
  onCancelReply,
  about,
  onAboutUsed,
  onSend,
}: {
  data: AppData;
  me: string | null;
  replyTo: Message | null;
  onCancelReply: () => void;
  about: string | undefined;
  onAboutUsed: () => void;
  onSend: (body: string) => Promise<void>;
}) {
  const [text, setText] = useState("");
  /** O que está no texto como "#Roma" e o que vai no lugar dele ao enviar */
  const [mentions, setMentions] = useState<{ display: string; token: string }[]>([]);
  const [query, setQuery] = useState<{ trigger: "#" | "@"; q: string; start: number } | null>(null);
  const [active, setActive] = useState(0);
  const [sending, setSending] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  /** Onde pôr o cursor depois de o texto mudar (logo a seguir ao render, antes de se escrever mais) */
  const pendingCaret = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || pendingCaret.current === null) return;
    el.focus();
    el.setSelectionRange(pendingCaret.current, pendingCaret.current);
    pendingCaret.current = null;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const insertMention = (s: Pick<Suggestion, "trigger" | "label" | "token">, start: number, end: number) => {
    const display = `${s.trigger}${s.label}`;
    const current = ref.current?.value ?? text;
    pendingCaret.current = start + display.length + 1;
    setText(`${current.slice(0, start)}${display} ${current.slice(end)}`);
    setMentions((m) => [...m, { display, token: s.token }]);
    setQuery(null);
  };

  // "Falar sobre isto": começa já com a menção.
  useEffect(() => {
    if (!about) return;
    const [kind, id] = about.split(":") as [EntityKind, string];
    const entity = resolveEntity(data, { kind, id });
    if (entity) {
      const display = `#${entity.title}`;
      pendingCaret.current = display.length + 1;
      setText(`${display} `);
      setMentions([{ display, token: entityToken(kind, id, entity.title) }]);
    }
    onAboutUsed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [about]);

  useEffect(() => {
    if (replyTo) ref.current?.focus();
  }, [replyTo]);

  const suggestions = useMemo<Suggestion[]>(() => {
    if (!query) return [];
    const q = normalize(query.q);
    if (query.trigger === "@")
      return data.people
        .filter((p) => p.id !== me && normalize(p.name).includes(q))
        .map((p) => ({
          key: p.id,
          trigger: "@",
          label: p.name,
          subtitle: "",
          group: "Pessoas",
          token: personToken(p.id),
          icon: <PersonAvatar person={p} size="sm" />,
        }));
    return mentionables(data)
      .filter((e) => normalize(e.title).includes(q))
      .slice(0, 8)
      .map((e) => {
        const Icon = KIND_ICON[e.kind];
        return {
          key: `${e.kind}:${e.id}`,
          trigger: "#",
          label: e.title,
          subtitle: e.subtitle,
          group: KIND_LABEL[e.kind],
          token: entityToken(e.kind, e.id, e.title),
          icon: <Icon className="size-4 text-primary" />,
        };
      });
  }, [query, data, me]);

  const detect = (value: string, caret: number) => {
    const before = value.slice(0, caret);
    const m = /(^|\s)([#@])([^\s#@]{0,30})$/.exec(before);
    if (m) {
      setQuery({ trigger: m[2] as "#" | "@", q: m[3] ?? "", start: caret - (m[3]?.length ?? 0) - 1 });
      setActive(0);
    } else setQuery(null);
  };

  const submit = async () => {
    let body = text.trim();
    if (!body || sending) return;
    for (const { display, token } of mentions) body = body.replace(display, token);
    setSending(true);
    try {
      await onSend(body);
      pendingCaret.current = 0;
      setText("");
      setMentions([]);
    } catch {
      /* o aviso já foi mostrado */
    } finally {
      setSending(false);
      ref.current?.focus();
    }
  };

  return (
    <div className="relative mt-3">
      {suggestions.length > 0 && query && (
        <ul className="absolute bottom-full left-0 z-30 mb-2 max-h-72 w-full overflow-y-auto rounded-xl border bg-popover py-1 shadow-lg sm:w-96">
          {suggestions.map((s, i) => (
            <li key={s.key}>
              {(i === 0 || suggestions[i - 1]!.group !== s.group) && (
                <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {s.group}
                </p>
              )}
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(s, query.start, query.start + 1 + query.q.length);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2.5 px-3 py-1.5 text-left text-sm",
                  i === active && "bg-accent",
                )}
              >
                {s.icon}
                <span className="min-w-0">
                  <span className="block truncate font-medium">{s.label}</span>
                  {s.subtitle && <span className="block truncate text-xs text-muted-foreground">{s.subtitle}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {replyTo && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border-l-2 border-primary bg-muted px-3 py-1.5 text-xs">
          <CornerUpLeft className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">
            A responder a <span className="font-semibold">{data.people.find((p) => p.id === replyTo.author)?.name}</span>:{" "}
            <span className="text-muted-foreground">{plainText(replyTo.body, data)}</span>
          </span>
          <button type="button" aria-label="Cancelar resposta" onClick={onCancelReply} className="cursor-pointer rounded p-0.5 hover:bg-accent">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2 rounded-xl border bg-card p-1.5 shadow-sm focus-within:ring-1 focus-within:ring-ring">
        <textarea
          ref={ref}
          value={text}
          rows={1}
          placeholder="Mensagem… (# viagens e despesas, @ pessoas)"
          aria-label="Mensagem"
          onChange={(e) => {
            setText(e.target.value);
            detect(e.target.value, e.target.selectionStart);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
          }}
          onClick={(e) => detect(e.currentTarget.value, e.currentTarget.selectionStart)}
          onKeyDown={(e) => {
            if (query && suggestions.length > 0) {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => (i + (e.key === "ArrowDown" ? 1 : suggestions.length - 1)) % suggestions.length);
                return;
              }
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                insertMention(suggestions[active]!, query.start, query.start + 1 + query.q.length);
                return;
              }
              if (e.key === "Escape") {
                setQuery(null);
                return;
              }
            }
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          type="button"
          aria-label="Enviar"
          disabled={!text.trim() || sending}
          onClick={() => void submit()}
          className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sending ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
        </button>
      </div>
    </div>
  );
}
