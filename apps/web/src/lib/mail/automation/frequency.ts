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
import { and, eq, gte, sql } from 'drizzle-orm';
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
): Promise<{ blocked: boolean; lastRunAt?: Date }> {
  if (cooldownSeconds <= 0) return { blocked: false };
  const drizzle = requireDb();
  const threshold = new Date(Date.now() - cooldownSeconds * 1000);
  const rows = await drizzle
    .select({ triggeredAt: emailAutomationRun.triggeredAt })
    .from(emailAutomationRun)
    .where(
      and(
        eq(emailAutomationRun.automationId, automationId),
        eq(emailAutomationRun.recipientEmail, recipientEmail.toLowerCase()),
        gte(emailAutomationRun.triggeredAt, threshold),
      ),
    )
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
): Promise<{ blocked: boolean; todayCount?: number }> {
  if (!dailyCap || dailyCap <= 0) return { blocked: false };
  const drizzle = requireDb();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
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
 * Si `nextActionAt` tombe en dehors de [start, end] (heures locales du tz),
 * retourne la prochaine heure autorisée. Sinon retourne nextActionAt tel quel.
 *
 * Implementation : utilise Intl.DateTimeFormat pour récupérer l'heure
 * dans le tz cible. Simpliste mais portable (pas de dep date-fns-tz).
 */
export function applyQuietHours(
  nextActionAt: Date,
  config: Pick<FrequencyConfig, 'quietHoursEnabled' | 'quietHoursStart' | 'quietHoursEnd' | 'quietHoursTz'>,
): Date {
  if (!config.quietHoursEnabled) return nextActionAt;

  const [startH, startM] = config.quietHoursStart.split(':').map(Number);
  const [endH, endM] = config.quietHoursEnd.split(':').map(Number);
  if (startH === undefined || endH === undefined) return nextActionAt;

  // Hour in target tz
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: config.quietHoursTz,
    hour12: false,
    hour: 'numeric',
    minute: 'numeric',
  });
  const parts = fmt.formatToParts(nextActionAt);
  const hourPart = parts.find((p) => p.type === 'hour')?.value ?? '0';
  const minPart = parts.find((p) => p.type === 'minute')?.value ?? '0';
  const currentHour = parseInt(hourPart, 10);
  const currentMin = parseInt(minPart, 10);
  const currentMinutes = currentHour * 60 + currentMin;
  const startMinutes = (startH ?? 0) * 60 + (startM ?? 0);
  const endMinutes = (endH ?? 0) * 60 + (endM ?? 0);

  // Si in window → autorisé
  if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
    return nextActionAt;
  }

  // Sinon, décale au prochain start. On fait ça en utc-shift approximatif :
  // - si current < start → today à start
  // - si current >= end → tomorrow à start
  const result = new Date(nextActionAt);
  if (currentMinutes >= endMinutes) {
    result.setUTCDate(result.getUTCDate() + 1);
  }
  // Ajuste l'heure : on prend le shift entre current et target
  const targetMinutes = startMinutes;
  const deltaMinutes = targetMinutes - currentMinutes;
  result.setUTCMinutes(result.getUTCMinutes() + deltaMinutes);
  return result;
}
