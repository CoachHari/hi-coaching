-- H.I. – Coaching · Datenbank für den Sync
-- In Supabase: SQL Editor → New query → alles einfügen → Run.
-- Unten bei "insert into public.trainer" steht die E-Mail-Adresse, mit der du dich anmeldest. Bei Bedarf ändern.

create table if not exists public.trainer (
  email text primary key,
  name text,
  created_at timestamptz not null default now()
);

create table if not exists public.einheiten (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

create table if not exists public.termine (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

create table if not exists public.kader (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

alter table public.trainer enable row level security;
alter table public.kader enable row level security;
alter table public.einheiten enable row level security;
alter table public.termine enable row level security;

-- Nur freigeschaltete Trainer-Adressen haben Zugriff
create or replace function public.ist_trainer() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.trainer where lower(email) = lower(auth.jwt() ->> 'email'));
$$;

drop policy if exists "trainer sieht sich selbst" on public.trainer;
create policy "trainer sieht sich selbst" on public.trainer
  for select to authenticated using (lower(email) = lower(auth.jwt() ->> 'email'));

drop policy if exists "trainer verwalten einheiten" on public.einheiten;
create policy "trainer verwalten einheiten" on public.einheiten
  for all to authenticated using (public.ist_trainer()) with check (public.ist_trainer());

drop policy if exists "trainer verwalten termine" on public.termine;
create policy "trainer verwalten termine" on public.termine
  for all to authenticated using (public.ist_trainer()) with check (public.ist_trainer());

drop policy if exists "trainer verwalten kader" on public.kader;
create policy "trainer verwalten kader" on public.kader
  for all to authenticated using (public.ist_trainer()) with check (public.ist_trainer());

grant select on public.trainer to authenticated;
grant select, insert, update, delete on public.kader to authenticated;
grant select, insert, update, delete on public.einheiten, public.termine to authenticated;

-- Freischalten: eine Zeile pro Trainer/in
insert into public.trainer (email, name) values
  ('04coach.hari@gmail.com', 'Haris')
on conflict (email) do nothing;

-- Bewertungen der Testerinnen: siehe bewertungen.sql
