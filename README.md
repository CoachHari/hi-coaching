# H.I. – Coaching · FC Bergheim

Übungsmappe mit animierten Skizzen, Trainingsplanung mit PDF-Export und Trainingskalender.
Läuft als Website über GitHub Pages und lässt sich am Handy und PC wie eine App installieren.

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` | Die komplette App |
| `config.js` | Zugangsdaten für den Sync (Supabase-URL und anon-Key) |
| `sync.js` | Anmeldung und Synchronisation über Supabase |
| `sw.js` | Offline-Speicher, damit die App auch ohne Empfang startet |
| `manifest.webmanifest`, `icon-*.png` | App-Name und App-Symbol |
| `supabase.sql` | Einmalig in Supabase ausführen: Tabellen und Zugriffsregeln |

## Einrichtung Sync (einmalig)

1. In Supabase: **SQL Editor → New query**, den Inhalt von `supabase.sql` einfügen, unten die eigene E-Mail-Adresse eintragen, **Run**.
2. **Authentication → Email Templates → Magic Link**: Im Text `{{ .Token }}` ergänzen, damit der Anmeldecode in der E-Mail steht.
3. **Authentication → URL Configuration**: Site URL und Redirect URL auf die Adresse der GitHub-Pages-Seite setzen.
4. Die Werte aus **Project Settings → API** (Project URL, anon public key) in `config.js` eintragen.

## Weitere Trainer freischalten

In Supabase im **SQL Editor**:

```sql
insert into public.trainer (email, name) values ('name@beispiel.at', 'Vorname');
```

Danach kann sich diese Person mit ihrer E-Mail-Adresse anmelden und sieht dieselben Einheiten und Termine.

## Neue Version veröffentlichen

Geänderte Dateien hochladen und in `sw.js` die `VERSION` hochzählen (z. B. `hi-coaching-v2`), damit installierte Apps die neue Version laden.
