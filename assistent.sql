-- H.I. – Coaching · KI-Assistent: Nutzung zählen (für das Tageslimit und den Überblick über die Kosten)
-- In Supabase: SQL Editor → New query → alles einfügen → Run. Setzt supabase.sql voraus (Funktion ist_trainer).

create table if not exists public.assistent_nutzung (
  id bigint generated always as identity primary key,
  email text not null default lower(auth.jwt() ->> 'email'),
  created_at timestamptz not null default now(),
  model text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,
  cache_write_tokens integer not null default 0
);

alter table public.assistent_nutzung enable row level security;

drop policy if exists "trainer sieht eigene nutzung" on public.assistent_nutzung;
create policy "trainer sieht eigene nutzung" on public.assistent_nutzung
  for select to authenticated using (public.ist_trainer() and email = lower(auth.jwt() ->> 'email'));

drop policy if exists "trainer schreibt eigene nutzung" on public.assistent_nutzung;
create policy "trainer schreibt eigene nutzung" on public.assistent_nutzung
  for insert to authenticated with check (public.ist_trainer() and email = lower(auth.jwt() ->> 'email'));

grant select, insert on public.assistent_nutzung to authenticated;

-- Überblick: Anfragen und Tokens pro Tag und Person
-- select email, created_at::date as tag, count(*) as anfragen, sum(input_tokens) as eingabe, sum(output_tokens) as ausgabe
-- from public.assistent_nutzung group by 1, 2 order by 2 desc;
