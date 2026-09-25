-- Erasmus Planner — dados partilhados na nuvem com login por pessoa.
-- Pode correr-se mais do que uma vez sem estragar nada.

-- Quem é quem: cada conta fica associada a uma das quatro pessoas da app.
create table if not exists public.members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  person_id text not null unique check (person_id in ('p1', 'p2', 'p3', 'p4')),
  created_at timestamptz not null default now()
);

-- Dados que o grupo todo vê e edita (viagens, despesas, reservas, horário, exames…).
-- kind: person | trip | expense | settlement | booking | class | exam | settings
create table if not exists public.shared_items (
  kind text not null,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (kind, id)
);

-- Poupança: cada pessoa só vê a sua. kind: saving | recurring
create table if not exists public.private_items (
  kind text not null,
  id text not null,
  person_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (kind, id)
);

-- Pessoa da conta com sessão iniciada (null se ainda não escolheu).
create or replace function public.my_person()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select person_id from public.members where user_id = auth.uid()
$$;

alter table public.members enable row level security;
alter table public.shared_items enable row level security;
alter table public.private_items enable row level security;

-- members: toda a gente com sessão vê que perfis já foram escolhidos; ninguém escreve diretamente.
drop policy if exists "members: ver" on public.members;
create policy "members: ver" on public.members
  for select to authenticated using (true);

-- shared_items: só quem já é membro do grupo.
drop policy if exists "shared: membros" on public.shared_items;
create policy "shared: membros" on public.shared_items
  for all to authenticated
  using (public.my_person() is not null)
  with check (public.my_person() is not null);

-- private_items: só a própria pessoa.
drop policy if exists "private: só o próprio" on public.private_items;
create policy "private: só o próprio" on public.private_items
  for all to authenticated
  using (person_id = public.my_person())
  with check (person_id = public.my_person());

-- Escolher o perfil (Pessoa 1–4). Cada perfil só pode ser escolhido uma vez.
create or replace function public.claim_person(p text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  existing text;
begin
  if auth.uid() is null then
    raise exception 'Sem sessão iniciada';
  end if;
  select person_id into existing from public.members where user_id = auth.uid();
  if existing is not null then
    return existing;
  end if;
  begin
    insert into public.members (user_id, person_id) values (auth.uid(), p);
  exception when unique_violation then
    raise exception 'Esse perfil já foi escolhido por outra pessoa';
  end;
  return p;
end;
$$;

-- Total poupado pelo grupo, sem revelar quanto tem cada um.
-- Soma os registos e os meses dos depósitos mensais que já entraram (até ao mês atual, hora de Itália).
create or replace function public.group_savings_total()
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  cur date := date_trunc('month', (now() at time zone 'Europe/Rome'))::date;
  total numeric;
begin
  if public.my_person() is null then
    raise exception 'Sem acesso';
  end if;
  select coalesce(sum(
    case
      when kind = 'saving' then (data ->> 'amount')::numeric
      else (data ->> 'amount')::numeric * greatest(0,
        (extract(year from least(to_date(data ->> 'endMonth', 'YYYY-MM'), cur)) * 12
          + extract(month from least(to_date(data ->> 'endMonth', 'YYYY-MM'), cur)))
        - (extract(year from to_date(data ->> 'startMonth', 'YYYY-MM')) * 12
          + extract(month from to_date(data ->> 'startMonth', 'YYYY-MM')))
        + 1)
    end), 0)
  into total
  from public.private_items;
  return total;
end;
$$;

revoke all on function public.claim_person(text) from public, anon;
revoke all on function public.group_savings_total() from public, anon;
revoke all on function public.my_person() from public, anon;
grant execute on function public.claim_person(text) to authenticated;
grant execute on function public.group_savings_total() to authenticated;
grant execute on function public.my_person() to authenticated;

grant select on public.members to authenticated;
grant select, insert, update, delete on public.shared_items to authenticated;
grant select, insert, update, delete on public.private_items to authenticated;

-- Atualizações em tempo real (o que um muda aparece logo aos outros).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shared_items'
    ) then
      alter publication supabase_realtime add table public.shared_items;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'private_items'
    ) then
      alter publication supabase_realtime add table public.private_items;
    end if;
  end if;
end;
$$;
