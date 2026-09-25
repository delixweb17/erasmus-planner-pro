-- Erasmus Planner — chat do grupo (mensagens, reações e o que cada um já leu).
-- Precisa da migração anterior (members / my_person). Pode correr-se mais do que uma vez.

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  author text not null default public.my_person(),
  body text not null,
  reply_to uuid references public.messages (id) on delete set null,
  created_at timestamptz not null default now(),
  deleted boolean not null default false,
  constraint messages_body_len check (deleted or char_length(body) between 1 and 4000)
);
create index if not exists messages_created_at_idx on public.messages (created_at desc);

create table if not exists public.message_reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  person_id text not null default public.my_person(),
  emoji text not null check (char_length(emoji) <= 16),
  created_at timestamptz not null default now(),
  primary key (message_id, person_id, emoji)
);

create table if not exists public.chat_reads (
  person_id text primary key,
  last_read_at timestamptz not null default now()
);

alter table public.messages enable row level security;
alter table public.message_reactions enable row level security;
alter table public.chat_reads enable row level security;

-- Mensagens: o grupo lê tudo; cada um só escreve em seu nome e só altera (apaga) as suas.
drop policy if exists "messages: ler" on public.messages;
create policy "messages: ler" on public.messages
  for select to authenticated using (public.my_person() is not null);
drop policy if exists "messages: escrever" on public.messages;
create policy "messages: escrever" on public.messages
  for insert to authenticated with check (author = public.my_person());
drop policy if exists "messages: alterar as minhas" on public.messages;
create policy "messages: alterar as minhas" on public.messages
  for update to authenticated
  using (author = public.my_person())
  with check (author = public.my_person());

-- Reações: o grupo vê todas; cada um põe e tira as suas.
drop policy if exists "reactions: ler" on public.message_reactions;
create policy "reactions: ler" on public.message_reactions
  for select to authenticated using (public.my_person() is not null);
drop policy if exists "reactions: pôr" on public.message_reactions;
create policy "reactions: pôr" on public.message_reactions
  for insert to authenticated with check (person_id = public.my_person());
drop policy if exists "reactions: tirar" on public.message_reactions;
create policy "reactions: tirar" on public.message_reactions
  for delete to authenticated using (person_id = public.my_person());

-- Lido até: o grupo vê (para "visto por"), cada um atualiza o seu.
drop policy if exists "reads: ler" on public.chat_reads;
create policy "reads: ler" on public.chat_reads
  for select to authenticated using (public.my_person() is not null);
drop policy if exists "reads: o meu" on public.chat_reads;
create policy "reads: o meu" on public.chat_reads
  for all to authenticated
  using (person_id = public.my_person())
  with check (person_id = public.my_person());

-- Só se pode alterar se a mensagem foi apagada (não se edita o texto nem o autor/data).
create or replace function public.messages_guard()
returns trigger
language plpgsql
as $$
begin
  if new.author <> old.author or new.created_at <> old.created_at or new.reply_to is distinct from old.reply_to then
    raise exception 'Não se pode alterar esta mensagem';
  end if;
  if new.body <> old.body and not new.deleted then
    raise exception 'Não se pode editar o texto de uma mensagem';
  end if;
  return new;
end;
$$;
drop trigger if exists messages_guard on public.messages;
create trigger messages_guard before update on public.messages
  for each row execute function public.messages_guard();

grant select, insert, update on public.messages to authenticated;
grant select, insert, delete on public.message_reactions to authenticated;
grant select, insert, update on public.chat_reads to authenticated;

-- Tempo real.
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['messages', 'message_reactions'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end;
$$;
