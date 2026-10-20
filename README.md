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

Synchronisiert Trainingseinheiten, Kalender, Kader, Spiele und Matchplan zwischen allen Geräten.

1. Auf supabase.com ein kostenloses Konto und ein Projekt anlegen (Region: Frankfurt).
2. In Supabase: **SQL Editor → New query**, den Inhalt von `supabase.sql` einfügen und auf **Run** klicken. Die E-Mail-Adresse in der letzten Zeile ist die, mit der du dich anmeldest.
3. Anmeldung läuft über den Link in der E-Mail (ohne eigenen Mailserver lässt Supabase den E-Mail-Text nicht ändern).
4. **Authentication → URL Configuration**: Site URL und Redirect URL auf `https://coachhari.github.io/hi-coaching/` setzen.
5. Die Werte aus **Project Settings → API** (Project URL und anon public key) in `config.js` eintragen.
6. Auf jedem Gerät oben auf **Anmelden für Sync** tippen. Beim ersten Anmelden werden die Daten, die bisher nur auf dem Gerät lagen, hochgeladen. Beim Kader gilt: Ist online schon ein Kader vorhanden, wird dieser übernommen. Der bisherige Kader des Geräts wird vorher als Sicherung im Browser abgelegt.

## Weitere Trainer freischalten

In Supabase im **SQL Editor**:

```sql
insert into public.trainer (email, name) values ('name@beispiel.at', 'Vorname');
```

Danach kann sich diese Person mit ihrer E-Mail-Adresse anmelden und sieht dieselben Einheiten und Termine.

## Neue Version veröffentlichen

Geänderte Dateien hochladen und in `sw.js` die `VERSION` hochzählen (z. B. `hi-coaching-v2`), damit installierte Apps die neue Version laden.
