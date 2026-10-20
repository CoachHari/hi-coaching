-- H.I. – Coaching · Bewertungen der Testerinnen
-- In Supabase: SQL Editor → New query → alles einfügen → Run. Einmal ausführen genügt.
-- Testerinnen (ohne Login) dürfen Bewertungen nur abschicken. Lesen und löschen können nur freigeschaltete Trainer.

create table if not exists public.bewertungen (
  id uuid primary key default gen_random_uuid(),
  uebung text not null check (char_length(uebung) between 1 and 60),
  data jsonb not null check (pg_column_size(data) < 8000),
  created_at timestamptz not null default now()
);

alter table public.bewertungen enable row level security;

drop policy if exists "alle duerfen bewerten" on public.bewertungen;
create policy "alle duerfen bewerten" on public.bewertungen
  for insert to anon, authenticated with check (true);

drop policy if exists "trainer lesen bewertungen" on public.bewertungen;
create policy "trainer lesen bewertungen" on public.bewertungen
  for select to authenticated using (public.ist_trainer());

drop policy if exists "trainer loeschen bewertungen" on public.bewertungen;
create policy "trainer loeschen bewertungen" on public.bewertungen
  for delete to authenticated using (public.ist_trainer());

grant insert on public.bewertungen to anon, authenticated;
grant select, delete on public.bewertungen to authenticated;
