// H.I. – Coaching · KI-Assistent
// Supabase Edge Function: prüft, ob die anfragende Person als Trainer freigeschaltet ist,
// zählt die Nutzung und leitet das Gespräch an die Claude-API weiter.
// Die Werkzeuge (Übungen suchen, Kader lesen, Einheit vorschlagen) führt die Website selbst aus.
// Secrets in Supabase: ANTHROPIC_API_KEY (Pflicht), optional ASSISTENT_MODEL, ASSISTENT_TAGESLIMIT, ASSISTENT_ORIGINS.
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = Deno.env.get("ASSISTENT_MODEL") ?? "claude-sonnet-5-5";
const LIMIT = Number(Deno.env.get("ASSISTENT_TAGESLIMIT") ?? "150");
const ORIGINS = (Deno.env.get("ASSISTENT_ORIGINS") ?? "https://coachhari.github.io,http://localhost:8765")
  .split(",").map((s) => s.trim()).filter(Boolean);

const LV = ["kinder", "u12", "jugend", "km"];
const REITER = ["aufwaermen", "passen", "technik", "rondo", "mitball", "gegenball", "umschalten", "abschluss", "athletik"];

const SYSTEM = `Du bist der persönliche Assistent von H.I. – Coaching (Coach Hari, FC Bergheim). Du hilfst dem Trainerteam beim Planen von Training.

So arbeitest du:
- Antworte auf Deutsch, kurz und praxisnah, in der Sprache eines Fußballtrainers. Keine langen Einleitungen.
- Die Übungsmappe ist deine Quelle. Suche Übungen immer mit dem Werkzeug uebungen_suchen und hole Details mit uebung_details, bevor du sie empfiehlst oder erklärst. Erfinde keine Übungen, die es in der Mappe nicht gibt. Wenn nichts passt, sag das und schlage vor, wie man eine vorhandene Übung anpasst.
- Wenn du eine Übung nennst, schreibe sie als [[ex:ID]] (z. B. [[ex:rk52]]). Die Website macht daraus einen Knopf zum Öffnen. Den Titel musst du nicht zusätzlich schreiben.
- Altersbereiche: kinder = Bambini – U9, u12 = U10 – U12, jugend = U13 – U16, km = U18 – Kampfmannschaft (Damen). Bei Kindern sprichst du von „Kindern“, sonst von „Spielerinnen“.
- Reiter der Mappe: aufwaermen, passen, technik, rondo, mitball (Mit Ball), gegenball (Gegen den Ball), umschalten, abschluss (Torabschluss), athletik.
- Jede Übung folgt den 5 Säulen von H.I. – Coaching: Lernziel, Spielbezug (Stufen 1–3), Progression (leichter/schwerer), Belastung, Coaching-Punkte. Nutze diese Begriffe, wenn du erklärst.
- Trainingseinheit: Aufwärmen, Hauptteil 1, Hauptteil 2, Schluss. Richtwerte: Kampfmannschaft 90 Minuten, U13–U16 75–90, U10–U12 75, Bambini–U9 60. Baue vom Einfachen zum Spielnahen auf, ein klares Thema pro Einheit, am Schluss ein Spiel. Plane Trinkpausen ein. Wenn du eine Einheit zusammenstellst, rufe am Ende einheit_vorschlagen auf, damit der Trainer sie mit einem Klick in den Planer übernehmen kann. Fasse danach in zwei bis drei Sätzen zusammen, warum die Einheit so aufgebaut ist.
- Der Trainer kann Übungen mit einem Herz als Favoriten markieren. Wenn er von „meinen Favoriten“ spricht, suche mit nur_favoriten = true. Treffer mit favorit = true sind Favoriten.
- Für Fragen zum Kader, zu Verletzten, Einsätzen oder Spielen nutze kader_abfragen, für Trainings- und Spieltermine termine_abfragen. Verletzungen sind vertraulich: nenne nur, was für die Frage nötig ist, und gib keine medizinischen Ratschläge oder Diagnosen. Bei Belastungsfragen nach Verletzungen verweise auf Ärztin oder Physio.
- Frag nur nach, wenn eine wichtige Angabe fehlt (z. B. Altersbereich). Sonst triff eine sinnvolle Annahme und nenne sie kurz.`;

const TOOLS = [
  {
    name: "uebungen_suchen",
    description: "Durchsucht die Übungsmappe nach Stichworten, optional gefiltert nach Altersbereich und Reiter. Liefert eine kurze Liste mit ID, Titel, Schwerpunkt, Organisation und Lernziel.",
    input_schema: {
      type: "object",
      properties: {
        suchbegriffe: { type: "string", description: "Stichworte, z. B. 'Pressing Umschalten 4 gegen 2'. Leer lassen, um alle Übungen des Filters zu bekommen." },
        altersbereich: { type: "string", enum: LV },
        reiter: { type: "string", enum: REITER },
        anzahl: { type: "integer", minimum: 1, maximum: 25, description: "Höchstens so viele Treffer (Standard 10)." },
        nur_favoriten: { type: "boolean", description: "true = nur Übungen, die der Trainer mit dem Herz als Favorit markiert hat." },
      },
    },
  },
  {
    name: "uebung_details",
    description: "Liefert alle Inhalte einer Übung: Lernziel, Organisation, Ablauf, Stufen, Coaching-Punkte, Belastung, leichter/schwerer und die Anpassung für den Altersbereich.",
    input_schema: {
      type: "object",
      properties: { id: { type: "string" }, altersbereich: { type: "string", enum: LV } },
      required: ["id"],
    },
  },
  {
    name: "kader_abfragen",
    description: "Liefert den aktuellen Kader der Damenmannschaft (Nummer, Name, Position, Status spielbereit/angeschlagen/verletzt, voraussichtliche Rückkehr) sowie Einsätze, Tore, Vorlagen und die letzten Spiele.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "termine_abfragen",
    description: "Liefert Trainings-, Spiel- und sonstige Termine aus dem Kalender in einem Zeitraum.",
    input_schema: {
      type: "object",
      properties: {
        von: { type: "string", description: "Datum JJJJ-MM-TT, Standard heute" },
        bis: { type: "string", description: "Datum JJJJ-MM-TT, Standard in 21 Tagen" },
      },
    },
  },
  {
    name: "einheit_vorschlagen",
    description: "Zeigt dem Trainer einen fertigen Einheiten-Vorschlag mit dem Knopf 'Im Planer öffnen'. Nur Übungs-IDs aus der Mappe verwenden. Eigene Punkte (z. B. Trinkpause, Auslaufen) als titel ohne id.",
    input_schema: {
      type: "object",
      properties: {
        thema: { type: "string" },
        datum: { type: "string", description: "JJJJ-MM-TT" },
        uhrzeit: { type: "string", description: "HH:MM" },
        altersbereich: { type: "string", enum: LV },
        teilnehmer: { type: "integer" },
        abschnitte: {
          type: "object",
          properties: Object.fromEntries(["aufw", "h1", "h2", "schluss"].map((k) => [k, {
            type: "object",
            properties: {
              notiz: { type: "string", description: "Kurzer Coaching-Schwerpunkt für diesen Abschnitt" },
              punkte: {
                type: "array",
                items: {
                  type: "object",
                  properties: { id: { type: "string" }, titel: { type: "string" }, minuten: { type: "integer", minimum: 1, maximum: 60 } },
                  required: ["minuten"],
                },
              },
            },
            required: ["punkte"],
          }])),
          required: ["aufw", "h1", "schluss"],
        },
      },
      required: ["thema", "altersbereich", "abschnitte"],
    },
    cache_control: { type: "ephemeral" },
  },
];

function cors(origin: string) {
  const ok = ORIGINS.includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin : ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const clip = (s: unknown, n: number) => String(s ?? "").replace(/[\u0000-\u001f]/g, " ").slice(0, n);

function validMessages(m: unknown): m is Array<{ role: string; content: unknown }> {
  if (!Array.isArray(m) || m.length === 0 || m.length > 80) return false;
  return m.every((x) => x && (x.role === "user" || x.role === "assistant") && (typeof x.content === "string" || Array.isArray(x.content)));
}

Deno.serve(async (req) => {
  const h = cors(req.headers.get("origin") ?? "");
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...h, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return json({ fehler: "Nur POST ist erlaubt." }, 405);

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json({ fehler: "Der Assistent ist noch nicht eingerichtet: In Supabase fehlt das Secret ANTHROPIC_API_KEY." }, 500);

  // Anmeldung prüfen
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const apikey = req.headers.get("apikey") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!jwt || !apikey) return json({ fehler: "Bitte zuerst anmelden." }, 401);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, apikey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: who, error: whoErr } = await sb.auth.getUser(jwt);
  if (whoErr || !who?.user) return json({ fehler: "Die Anmeldung ist abgelaufen. Bitte neu anmelden." }, 401);
  const { data: tr, error: trErr } = await sb.from("trainer").select("email").limit(1);
  if (trErr || !tr?.length) return json({ fehler: "Diese E-Mail-Adresse ist nicht als Trainer freigeschaltet." }, 403);

  // Tageslimit (pro Person, Zählung über die eigene Nutzungstabelle)
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const { count } = await sb.from("assistent_nutzung").select("id", { count: "exact", head: true }).gte("created_at", start.toISOString());
  if ((count ?? 0) >= LIMIT) return json({ fehler: `Das Tageslimit von ${LIMIT} Anfragen ist erreicht. Morgen geht es weiter.` }, 429);

  // Anfrage prüfen
  let body: { messages?: unknown; kontext?: Record<string, unknown> };
  try {
    const raw = await req.text();
    if (raw.length > 400_000) return json({ fehler: "Das Gespräch ist zu lang. Bitte ein neues Gespräch beginnen." }, 413);
    body = JSON.parse(raw);
  } catch {
    return json({ fehler: "Ungültige Anfrage." }, 400);
  }
  if (!validMessages(body.messages)) return json({ fehler: "Ungültiges Gespräch." }, 400);
  const k = body.kontext ?? {};
  const kontext = [
    `Heute ist ${clip(k.heute, 40)}.`,
    k.altersbereich ? `In der Mappe ist gerade der Altersbereich ${clip(k.altersbereich, 20)} gewählt.` : "",
    k.ansicht ? `Der Trainer ist gerade in der Ansicht „${clip(k.ansicht, 30)}“.` : "",
    k.name ? `Du sprichst mit ${clip(k.name, 40)}.` : "",
  ].filter(Boolean).join(" ");

  // Claude-API
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 3000,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }, { type: "text", text: kontext }],
      tools: TOOLS,
      messages: body.messages,
    }),
  });
  const out = await res.json().catch(() => null);
  if (!res.ok || !out) {
    const msg = out?.error?.message ?? `HTTP ${res.status}`;
    console.error("Claude-API:", msg);
    const hint = res.status === 401 ? "Der API-Schlüssel ist ungültig." : res.status === 429 ? "Die Claude-API ist gerade ausgelastet oder das Ausgabenlimit ist erreicht." : "Die Claude-API hat nicht geantwortet.";
    return json({ fehler: hint + " Bitte später noch einmal versuchen." }, 502);
  }

  const u = out.usage ?? {};
  await sb.from("assistent_nutzung").insert({
    model: out.model ?? MODEL,
    input_tokens: u.input_tokens ?? 0,
    output_tokens: u.output_tokens ?? 0,
    cache_read_tokens: u.cache_read_input_tokens ?? 0,
    cache_write_tokens: u.cache_creation_input_tokens ?? 0,
  });

  return json({ content: out.content, stop_reason: out.stop_reason });
});
