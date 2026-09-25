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
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "./auth";
import { newId, useStore } from "./store";
import { supabase } from "./supabase";
import type { PersonId } from "./types";
import { mentionsPerson, plainText } from "@/lib/mentions";

export interface Message {
  id: string;
  author: PersonId;
  body: string;
  reply_to: string | null;
  created_at: string;
  deleted: boolean;
  /** Ainda a caminho do servidor */
  pending?: boolean;
}

export interface Reaction {
  message_id: string;
  person_id: PersonId;
  emoji: string;
}

export const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🎉"];

const PAGE = 100;

interface ChatValue {
  messages: Message[];
  reactions: Reaction[];
  loading: boolean;
  hasOlder: boolean;
  unread: number;
  /** Quando cada pessoa leu pela última vez */
  reads: Record<PersonId, string>;
  send: (body: string, replyTo: string | null) => Promise<void>;
  remove: (id: string) => Promise<void>;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  loadOlder: () => Promise<void>;
  markRead: () => void;
  /** A página do chat está aberta (não mostra avisos de mensagens novas) */
  setChatOpen: (open: boolean) => void;
}

const ChatContext = createContext<ChatValue | null>(null);

const byTime = (a: Message, b: Message) => a.created_at.localeCompare(b.created_at);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { personId } = useAuth();
  const { data } = useStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [reads, setReads] = useState<Record<PersonId, string>>({});
  const [loading, setLoading] = useState(true);
  const [hasOlder, setHasOlder] = useState(false);
  const chatOpen = useRef(false);
  const navigate = useNavigate();
  const dataRef = useRef(data);
  dataRef.current = data;

  const upsertMessage = useCallback((m: Message) => {
    setMessages((list) => {
      const i = list.findIndex((x) => x.id === m.id);
      if (i === -1) return [...list, m].sort(byTime);
      const next = [...list];
      next[i] = { ...m, pending: false };
      return next.sort(byTime);
    });
  }, []);

  const loadReactions = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return [];
    const { data: rows, error } = await supabase()
      .from("message_reactions")
      .select("message_id,person_id,emoji")
      .in("message_id", ids);
    if (error) throw error;
    return rows as Reaction[];
  }, []);

  // Carrega as últimas mensagens, as reações e o "lido até".
  useEffect(() => {
    if (!personId) return;
    let cancelled = false;
    (async () => {
      const db = supabase();
      const [msgs, rds] = await Promise.all([
        db.from("messages").select("*").order("created_at", { ascending: false }).limit(PAGE),
        db.from("chat_reads").select("person_id,last_read_at"),
      ]);
      if (msgs.error) throw msgs.error;
      const list = (msgs.data as Message[]).sort(byTime);
      const reacts = await loadReactions(list.map((m) => m.id));
      if (cancelled) return;
      setMessages(list);
      setReactions(reacts);
      setHasOlder(list.length === PAGE);
      setReads(
        Object.fromEntries(((rds.data ?? []) as { person_id: string; last_read_at: string }[]).map((r) => [r.person_id, r.last_read_at])),
      );
      setLoading(false);
    })().catch((e: unknown) => {
      console.error(e);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [personId, loadReactions]);

  // Tempo real: mensagens, reações e leituras dos outros.
  useEffect(() => {
    if (!personId) return;
    const db = supabase();
    const channel = db
      .channel("erasmus-chat")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, (payload) => {
        if (payload.eventType === "DELETE") return;
        const m = payload.new as Message;
        const isNew = payload.eventType === "INSERT";
        upsertMessage(m);
        if (isNew && m.author !== personId && !chatOpen.current && document.visibilityState === "visible") {
          const name = dataRef.current?.people.find((p) => p.id === m.author)?.name ?? "Alguém";
          const text = plainText(m.body, dataRef.current);
          toast(mentionsPerson(m.body, personId) ? `${name} mencionou-te` : name, {
            description: text.length > 90 ? `${text.slice(0, 90)}…` : text,
            action: { label: "Abrir", onClick: () => void navigate({ to: "/chat" }) },
          });
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const r = payload.new as Reaction;
          setReactions((list) =>
            list.some((x) => x.message_id === r.message_id && x.person_id === r.person_id && x.emoji === r.emoji)
              ? list
              : [...list, r],
          );
        } else if (payload.eventType === "DELETE") {
          const r = payload.old as Partial<Reaction>;
          setReactions((list) =>
            list.filter((x) => !(x.message_id === r.message_id && x.person_id === r.person_id && x.emoji === r.emoji)),
          );
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_reads" }, (payload) => {
        const r = payload.new as { person_id?: string; last_read_at?: string };
        if (r?.person_id && r.last_read_at) setReads((x) => ({ ...x, [r.person_id!]: r.last_read_at! }));
      })
      .subscribe();
    return () => {
      void db.removeChannel(channel);
    };
  }, [personId, upsertMessage, navigate]);

  const send = useCallback(
    async (body: string, replyTo: string | null) => {
      if (!personId) return;
      const text = body.trim();
      if (!text) return;
      const optimistic: Message = {
        id: newId(),
        author: personId,
        body: text,
        reply_to: replyTo,
        created_at: new Date().toISOString(),
        deleted: false,
        pending: true,
      };
      upsertMessage(optimistic);
      const { data: row, error } = await supabase()
        .from("messages")
        .insert({ id: optimistic.id, body: text, reply_to: replyTo })
        .select("*")
        .single();
      if (error) {
        setMessages((list) => list.filter((m) => m.id !== optimistic.id));
        toast.error("A mensagem não foi enviada. Tenta outra vez.");
        throw error;
      }
      upsertMessage(row as Message);
    },
    [personId, upsertMessage],
  );

  const remove = useCallback(async (id: string) => {
    const before = messages.find((m) => m.id === id);
    setMessages((list) => list.map((m) => (m.id === id ? { ...m, deleted: true, body: "" } : m)));
    const { error } = await supabase().from("messages").update({ deleted: true, body: "" }).eq("id", id);
    if (error) {
      if (before) upsertMessage(before);
      toast.error("Não consegui apagar a mensagem.");
    }
  }, [messages, upsertMessage]);

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!personId) return;
      const mine = reactions.some((r) => r.message_id === messageId && r.person_id === personId && r.emoji === emoji);
      const row = { message_id: messageId, person_id: personId, emoji };
      setReactions((list) =>
        mine
          ? list.filter((r) => !(r.message_id === messageId && r.person_id === personId && r.emoji === emoji))
          : [...list, row],
      );
      const db = supabase().from("message_reactions");
      const { error } = mine
        ? await db.delete().eq("message_id", messageId).eq("person_id", personId).eq("emoji", emoji)
        : await db.insert({ message_id: messageId, emoji });
      if (error && !/duplicate/i.test(error.message)) {
        setReactions((list) =>
          mine ? [...list, row] : list.filter((r) => !(r.message_id === messageId && r.person_id === personId && r.emoji === emoji)),
        );
        toast.error("Não consegui guardar a reação.");
      }
    },
    [personId, reactions],
  );

  const loadOlder = useCallback(async () => {
    const oldest = messages[0];
    if (!oldest) return;
    const { data: rows, error } = await supabase()
      .from("messages")
      .select("*")
      .lt("created_at", oldest.created_at)
      .order("created_at", { ascending: false })
      .limit(PAGE);
    if (error) {
      toast.error("Não consegui carregar mensagens antigas.");
      return;
    }
    const older = rows as Message[];
    const reacts = await loadReactions(older.map((m) => m.id)).catch(() => []);
    setMessages((list) => [...older.filter((o) => !list.some((m) => m.id === o.id)), ...list].sort(byTime));
    setReactions((list) => [...list, ...reacts]);
    setHasOlder(older.length === PAGE);
  }, [messages, loadReactions]);

  // "Lido até": só se escreve quando há mesmo mensagens novas.
  const lastWrite = useRef("");
  const markRead = useCallback(() => {
    if (!personId) return;
    const newest = messages.at(-1)?.created_at;
    if (!newest || newest <= (reads[personId] ?? "") || newest === lastWrite.current) return;
    lastWrite.current = newest;
    const now = new Date(Math.max(Date.now(), Date.parse(newest))).toISOString();
    setReads((r) => ({ ...r, [personId]: now }));
    void supabase()
      .from("chat_reads")
      .upsert({ person_id: personId, last_read_at: now })
      .then(({ error }) => error && console.error(error));
  }, [personId, messages, reads]);

  const unread = useMemo(() => {
    if (!personId) return 0;
    const since = reads[personId] ?? "";
    return messages.filter((m) => m.author !== personId && !m.deleted && m.created_at > since).length;
  }, [messages, reads, personId]);

  const value: ChatValue = {
    messages,
    reactions,
    loading,
    hasOlder,
    unread,
    reads,
    send,
    remove,
    toggleReaction,
    loadOlder,
    markRead,
    setChatOpen: (open) => {
      chatOpen.current = open;
    },
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat tem de ser usado dentro de ChatProvider");
  return ctx;
}
