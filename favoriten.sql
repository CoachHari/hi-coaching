-- H.I. – Coaching · Favoriten pro Trainer (Herz bei jeder Übung)
-- In Supabase: SQL Editor → New query → alles einfügen → Run. Setzt supabase.sql voraus (Funktion ist_trainer).
-- Ohne diese Tabelle funktionieren die Favoriten trotzdem, dann aber nur auf dem jeweiligen Gerät.

create table if not exists public.favoriten (
  email text primary key default lower(auth.jwt() ->> 'email'),
  ids jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.favoriten enable row level security;

drop policy if exists "eigene favoriten" on public.favoriten;
create policy "eigene favoriten" on public.favoriten
  for all to authenticated
  using (public.ist_trainer() and email = lower(auth.jwt() ->> 'email'))
  with check (public.ist_trainer() and email = lower(auth.jwt() ->> 'email'));

grant select, insert, update, delete on public.favoriten to authenticated;
