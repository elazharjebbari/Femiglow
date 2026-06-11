/**
 * Frequency control : cooldown, quiet hours, daily cap (M5.5.7).
 *
 * Trois mécanismes :
 *  - cooldown   : intervalle min entre 2 runs pour le même user/automation
 *  - quietHours : pas d'envoi en dehors [start, end] du timezone configuré
 *  - dailyCap   : nombre max de runs par jour pour l'automation entière
 *
 * Toutes les checks renvoient `null` = autorisé, ou un string raison = skip.
 */
import 'server-only';
import { and, eq, gte, ne, sql } from 'drizzle-orm';
import { db as getDb } from '@/lib/db/client';
import { emailAutomationRun } from '@/lib/db/schema-emails';

function requireDb() {
  const drizzle = getDb();
  if (!drizzle) throw new Error('Database not configured');
  return drizzle;
}

export type FrequencyConfig = {
  cooldownSeconds: number;
  quietHoursEnabled: boolean;
  quietHoursStart: string; // HH:mm
  quietHoursEnd: string;   // HH:mm
  quietHoursTz: string;
  dailyCap: number | null;
};

// ── Cooldown ─────────────────────────────────────────────────────────────

export async function checkCooldown(
  automationId: string,
  recipientEmail: string,
  cooldownSeconds: number,
  opts: { excludeRunId?: string; now?: Date } = {},
): Promise<{ blocked: boolean; lastRunAt?: Date }> {
  if (cooldownSeconds <= 0) return { blocked: false };
  const drizzle = requireDb();
  const now = opts.now ?? new Date();
  const threshold = new Date(now.getTime() - cooldownSeconds * 1000);
  const conditions = [
    eq(emailAutomationRun.automationId, automationId),
    eq(emailAutomationRun.recipientEmail, recipientEmail.toLowerCase()),
    gte(emailAutomationRun.triggeredAt, threshold),
  ];
  // Quand le contrôle s'exécute DANS le chemin d'un run (send path), ce run
  // a lui-même un triggeredAt dans la fenêtre : il faut l'exclure pour ne pas
  // s'auto-bloquer. Le cooldown vise un ENVOI ANTÉRIEUR au même destinataire.
  if (opts.excludeRunId) {
    conditions.push(ne(emailAutomationRun.id, opts.excludeRunId));
  }
  const rows = await drizzle
    .select({ triggeredAt: emailAutomationRun.triggeredAt })
    .from(emailAutomationRun)
    .where(and(...conditions))
    .limit(1);
  if (rows.length > 0 && rows[0]?.triggeredAt) {
    return { blocked: true, lastRunAt: rows[0].triggeredAt };
  }
  return { blocked: false };
}

// ── Daily cap ────────────────────────────────────────────────────────────

export async function checkDailyCap(
  automationId: string,
  dailyCap: number | null,
  opts: { tz?: string; now?: Date } = {},
): Promise<{ blocked: boolean; todayCount?: number }> {
  if (!dailyCap || dailyCap <= 0) return { blocked: false };
  const drizzle = requireDb();
  // Le « jour » du cap est calé sur minuit du tz configuré (Africa/Casablanca par
  // défaut), PAS minuit du serveur (UTC en prod) : un run à 00:30 Casablanca
  // compte dans le NOUVEAU jour. Ancien bug : `new Date().setHours(0,0,0,0)`
  // utilisait l'heure locale du process (UTC) → reset à la mauvaise heure.
  const tz = opts.tz ?? 'Africa/Casablanca';
  const now = opts.now ?? new Date();
  const startOfDay = startOfDayInTz(now, tz);
  const [row] = await drizzle
    .select({ n: sql<number>`count(*)::int` })
    .from(emailAutomationRun)
    .where(
      and(
        eq(emailAutomationRun.automationId, automationId),
        gte(emailAutomationRun.triggeredAt, startOfDay),
      ),
    );
  const todayCount = row?.n ?? 0;
  return { blocked: todayCount >= dailyCap, todayCount };
}

// ── Quiet hours ──────────────────────────────────────────────────────────

/**
 * Composantes wall-clock (heures locales) d'un instant dans un tz donné.
 * Utilise `Intl.DateTimeFormat` (base de fuseaux IANA → DST/Ramadan corrects).
 */
type WallClock = { year: number; month: number; day: number; hour: number; minute: number };

function wallClockInTz(at: Date, tz: string): WallClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  let hour = get('hour');
  if (hour === 24) hour = 0; // certains runtimes rendent minuit comme "24"
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour,
    minute: get('minute'),
  };
}

/**
 * Convertit une wall-clock locale (tz) en l'instant UTC correspondant.
 *
 * Le piège : l'offset du tz dépend de l'instant lui-même (DST/Ramadan). On part
 * d'une estimation UTC naïve, on mesure l'offset que le tz applique à cet
 * instant, on corrige, puis on re-mesure une fois (suffit pour absorber un saut
 * de DST à la frontière). Résultat : 08:00 wall-clock reste 08:00 wall-clock
 * quel que soit l'offset effectif du jour.
 */
function wallClockToUtc(wc: WallClock, tz: string): Date {
  const asUtcGuess = Date.UTC(wc.year, wc.month - 1, wc.day, wc.hour, wc.minute, 0, 0);
  let instant = new Date(asUtcGuess);
  for (let i = 0; i < 2; i++) {
    const seen = wallClockInTz(instant, tz);
    const seenAsUtc = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute, 0, 0);
    // offset = (heure locale vue) − (instant UTC) ; on retire cet offset du but.
    const offsetMs = seenAsUtc - instant.getTime();
    const corrected = asUtcGuess - offsetMs;
    if (corrected === instant.getTime()) break;
    instant = new Date(corrected);
  }
  return instant;
}

/**
 * Minuit (00:00 wall-clock) du jour local de `at` dans `tz`, exprimé en instant
 * UTC. Sert de borne basse au compteur du daily cap (reset à minuit Casablanca).
 */
function startOfDayInTz(at: Date, tz: string): Date {
  const wc = wallClockInTz(at, tz);
  return wallClockToUtc({ ...wc, hour: 0, minute: 0 }, tz);
}

function parseHm(hm: string): { h: number; m: number } | null {
  const parts = hm.split(':');
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
}

/**
 * Quiet hours = fenêtre AUTORISÉE [start, end[ en heure WALL-CLOCK locale du tz.
 * Si `nextActionAt` tombe HORS de cette fenêtre, on le DIFFÈRE au prochain
 * `start` local (08:00 par défaut) ; sinon on le retourne inchangé.
 *
 * Propriétés garanties :
 *  - calcul en heure locale réelle du tz (DST/Ramadan/UTC+1 corrects), PAS en UTC ;
 *  - fenêtre enjambant minuit gérée (ex. 22:00→08:00) ;
 *  - déterministe (aucun `Date.now()` caché) ;
 *  - jamais antérieur à l'entrée (le différé va toujours vers l'avant) ;
 *  - garde-fous : disabled / HH:mm invalide / fenêtre vide (start==end) → no-op sûr.
 */
export function applyQuietHours(
  nextActionAt: Date,
  config: Pick<FrequencyConfig, 'quietHoursEnabled' | 'quietHoursStart' | 'quietHoursEnd' | 'quietHoursTz'>,
): Date {
  if (!config.quietHoursEnabled) return nextActionAt;

  const start = parseHm(config.quietHoursStart);
  const end = parseHm(config.quietHoursEnd);
  if (!start || !end) return nextActionAt; // saisie invalide → ne bloque jamais

  const startMinutes = start.h * 60 + start.m;
  const endMinutes = end.h * 60 + end.m;
  // Fenêtre vide (start == end) : aucune heure n'est dans la fenêtre, mais on
  // refuse de boucler / tout différer → no-op sûr (cohérent avec "pas de réglage").
  if (startMinutes === endMinutes) return nextActionAt;

  const tz = config.quietHoursTz;
  const wc = wallClockInTz(nextActionAt, tz);
  const currentMinutes = wc.hour * 60 + wc.minute;

  // La fenêtre autorisée peut enjamber minuit (start > end) : dans ce cas
  // "in window" = current >= start OU current < end.
  const inWindow =
    startMinutes < endMinutes
      ? currentMinutes >= startMinutes && currentMinutes < endMinutes
      : currentMinutes >= startMinutes || currentMinutes < endMinutes;
  if (inWindow) return nextActionAt;

  // Hors fenêtre → prochaine occurrence du `start` local.
  //  - si on est AVANT le start du jour (current < start) → start aujourd'hui ;
  //  - sinon (current >= end, on a dépassé la fenêtre) → start demain.
  // On exprime le but en wall-clock locale puis on le reconvertit en instant UTC
  // (la reconversion absorbe l'offset tz/DST du jour cible).
  const targetWc: WallClock = { ...wc, hour: start.h, minute: start.m };
  if (currentMinutes >= startMinutes) {
    // current est après start (donc >= end, hors fenêtre côté nuit) → demain.
    const tomorrow = new Date(Date.UTC(wc.year, wc.month - 1, wc.day) + 24 * 60 * 60_000);
    targetWc.year = tomorrow.getUTCFullYear();
    targetWc.month = tomorrow.getUTCMonth() + 1;
    targetWc.day = tomorrow.getUTCDate();
  }

  const result = wallClockToUtc(targetWc, tz);
  // Filet anti-régression : un différé ne va JAMAIS vers le passé.
  return result.getTime() >= nextActionAt.getTime() ? result : nextActionAt;
}
