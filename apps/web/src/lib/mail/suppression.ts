/**
 * Suppression list check — must be invoked before any send.
 *
 * Sources of truth: `email_suppression` table (canonical) + Listmonk blocklist
 * (mirrored bi-directionally by `femiglow-cron-email-suppression-sync`).
 *
 * ── Allowlist interne (R-009) ──────────────────────────────────────────────
 * La suppression protège les destinataires CLIENTS (RGPD : un client qui se
 * désinscrit ou dont l'adresse hard-bounce ne doit plus rien recevoir). Mais
 * elle s'appliquait AUSSI aux adresses INTERNES de l'équipe (notification d'un
 * nouveau lead chat envoyée à `info@femiglow-maroc.com`). Conséquence du bug :
 * si une adresse interne atterrit un jour dans `email_suppression` (un seul
 * bounce temporaire suffit), TOUTES les notifications internes sont
 * silencieusement bloquées — l'équipe cesse de recevoir les leads sans aucun
 * signal. Perte totale et invisible d'un canal critique.
 *
 * Mécanisme retenu : une allowlist d'adresses/domaines internes qui
 * COURT-CIRCUITE la suppression — une adresse interne n'est JAMAIS considérée
 * suppressée, quel que soit l'état de la table. C'est une propriété du
 * DESTINATAIRE (boîte de l'équipe), donc le filtre vit ici, en amont du lookup
 * DB, et profite à tous les call-sites sans qu'ils aient à le savoir.
 *
 * Configuration : `MAIL_INTERNAL_ALLOWLIST` (CSV). Une entrée commençant par
 * `@` est un domaine entier (`@femiglow-maroc.com` ⇒ toute adresse de ce
 * domaine), sinon c'est une adresse exacte. Des valeurs par défaut couvrent
 * les boîtes internes connues du projet, de sorte que le garde-fou est actif
 * même sans configuration explicite (fail-safe pour les notifications équipe).
 */
import { eq, inArray } from 'drizzle-orm';
import { db as getDb } from '@/lib/db/client';
import { emailSuppression, type EmailSuppressionInsert } from '@/lib/db/schema-emails';

function normalize(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Adresses/domaines internes par défaut — boîtes de l'équipe vers lesquelles
 * partent les notifications opérationnelles (leads chat, alertes). Jamais
 * suppressibles. `info@` = destinataire réel des notifications lead
 * (`MAIL_REPLY_TO` / catalog `lead-notification`) ; `@femiglow-maroc.com` =
 * domaine interne (admin, no-reply, unsubscribe…). Surclassable/étendable via
 * `MAIL_INTERNAL_ALLOWLIST`.
 */
const DEFAULT_INTERNAL_ALLOWLIST = [
  'info@femiglow-maroc.com',
  '@femiglow-maroc.com',
] as const;

type InternalAllowlist = { addresses: Set<string>; domains: Set<string> };

let _allowlistCache: { raw: string | undefined; parsed: InternalAllowlist } | null = null;

/**
 * Parse l'allowlist (défauts + `MAIL_INTERNAL_ALLOWLIST`). Mémoïsé par valeur
 * d'env pour rester réactif aux changements d'env entre tests sans relire/CSV
 * à chaque appel en prod.
 */
function getInternalAllowlist(): InternalAllowlist {
  const raw = process.env.MAIL_INTERNAL_ALLOWLIST;
  if (_allowlistCache && _allowlistCache.raw === raw) return _allowlistCache.parsed;

  const addresses = new Set<string>();
  const domains = new Set<string>();
  const entries = [
    ...DEFAULT_INTERNAL_ALLOWLIST,
    ...(raw ? raw.split(',') : []),
  ];
  for (const entry of entries) {
    const e = normalize(entry);
    if (!e) continue;
    if (e.startsWith('@')) {
      domains.add(e.slice(1));
    } else {
      addresses.add(e);
      // Une entrée adresse implique aussi de connaître son domaine ? Non :
      // une adresse interne précise ne doit pas ouvrir tout son domaine. On
      // reste strict — seules les entrées `@domaine` élargissent au domaine.
    }
  }
  const parsed = { addresses, domains };
  _allowlistCache = { raw, parsed };
  return parsed;
}

/**
 * `true` si l'adresse appartient à l'allowlist interne (adresse exacte ou
 * domaine listé). Ces adresses ne sont JAMAIS suppressibles (R-009).
 * Exposé pour la traçabilité (logs/tests) et la réutilisation côté send.
 */
export function isInternalAddress(email: string): boolean {
  const normalized = normalize(email);
  const at = normalized.lastIndexOf('@');
  if (at < 0) return false;
  const { addresses, domains } = getInternalAllowlist();
  if (addresses.has(normalized)) return true;
  const domain = normalized.slice(at + 1);
  return domains.has(domain);
}

function requireDb() {
  const drizzle = getDb();
  if (!drizzle) {
    throw new Error('Database not configured (DATABASE_URL missing)');
  }
  return drizzle;
}

export async function isSuppressed(email: string): Promise<boolean> {
  // R-009 — court-circuit allowlist interne : une adresse de l'équipe n'est
  // JAMAIS suppressée, même si elle figure dans `email_suppression` (un bounce
  // ne doit pas couper les notifications internes). Court-circuit AVANT le
  // lookup DB pour garantir l'envoi quoi qu'il arrive.
  if (isInternalAddress(email)) return false;

  const drizzle = requireDb();
  const normalized = normalize(email);
  const rows = await drizzle
    .select({ email: emailSuppression.email })
    .from(emailSuppression)
    .where(eq(emailSuppression.email, normalized))
    .limit(1);
  return rows.length > 0;
}

export async function findSuppressed(emails: string[]): Promise<Set<string>> {
  const normalized = emails.map(normalize);
  if (normalized.length === 0) return new Set();
  const drizzle = requireDb();
  const rows = await drizzle
    .select({ email: emailSuppression.email })
    .from(emailSuppression)
    .where(inArray(emailSuppression.email, normalized));
  return new Set(rows.map((r: { email: string }) => r.email));
}

export async function addSuppression(input: EmailSuppressionInsert): Promise<void> {
  const drizzle = requireDb();
  await drizzle
    .insert(emailSuppression)
    .values({ ...input, email: normalize(input.email) })
    .onConflictDoNothing();
}
