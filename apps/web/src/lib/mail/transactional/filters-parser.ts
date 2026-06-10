/**
 * Filters parser — Cmd-K command syntax for the transactional cockpit.
 *
 * Grammar (espace = AND, pas de OR en V1) :
 *   status:VALUE          → enum OutboxStatus, ou liste séparée par virgules
 *   to:EMAIL_OR_GLOB      → "user@x.y" | "*@bad.tld" | "fatima*"
 *   template:SLUG_OR_GLOB → "welcome" | "cart-*" | "order-*"
 *   source:SOURCE         → "api.contact" etc.
 *   after:DATE            → ISO "2026-05-01" | mot-clé "today"/"yesterday" |
 *                           offset "-7d" / "-1h" / "-30m"
 *   before:DATE           → idem
 *   attempts:OP_NUM       → ">3" | "<=2" | "=5" | "0"
 *   has:error             → flag booléen (hasError=true)
 *
 * Tout token qui ne matche pas la grammaire devient du **freetext**
 * (fallback recherche par destinataire/template).
 *
 * Cf. docs/emailing/admin-evolution/03-frontend/04-cmd-k-palette.md
 *    docs/emailing/admin-evolution/11-tests/01-jest-unit/filters-parser.test.spec.md
 */

// ── Types publics ───────────────────────────────────────────────────────

export const OUTBOX_STATUSES = [
  'pending',
  'sending',
  'sent',
  'delivered',
  'opened',
  'clicked',
  'failed',
  'bounced_soft',
  'bounced_permanent',
  'suppressed',
  'dlq',
] as const;
export type OutboxStatus = (typeof OUTBOX_STATUSES)[number];

export type FilterKey =
  | 'status'
  | 'to'
  | 'template'
  | 'source'
  | 'after'
  | 'before'
  | 'attempts'
  | 'has';

export type FilterOperator = '>' | '<' | '>=' | '<=' | '=';

export type ParsedFilter =
  | { key: 'status'; value: OutboxStatus[]; raw: string }
  | { key: 'to'; value: string; raw: string }
  | { key: 'template'; value: string; raw: string }
  | { key: 'source'; value: string; raw: string }
  | { key: 'after'; value: Date; raw: string }
  | { key: 'before'; value: Date; raw: string }
  | { key: 'attempts'; operator: FilterOperator; value: number; raw: string }
  | { key: 'has'; value: 'error'; raw: string };

export type ParseError = {
  /** Position du début du token dans l'input original (0-indexed). */
  position: number;
  /** Le token brut qui a échoué. */
  raw: string;
  /** Message d'erreur lisible. */
  message: string;
};

export type ParseResult = {
  filters: ParsedFilter[];
  /** Tokens libres concaténés (fallback recherche par destinataire). */
  freetext?: string;
  errors: ParseError[];
};

// ── Implémentation ──────────────────────────────────────────────────────

const KNOWN_KEYS: ReadonlySet<string> = new Set<FilterKey>([
  'status',
  'to',
  'template',
  'source',
  'after',
  'before',
  'attempts',
  'has',
]);

/**
 * Tokenize une string en respectant les guillemets doubles.
 * `'status:failed to:"a b@c"'` → ['status:failed', 'to:"a b@c"']
 * `'\:'` est un escape pour ':' littéral.
 */
function tokenize(input: string): { token: string; position: number }[] {
  const tokens: { token: string; position: number }[] = [];
  let current = '';
  let start = 0;
  let inQuote = false;
  let escaped = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]!;
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      current += ch;
      continue;
    }
    if (ch === '"') {
      inQuote = !inQuote;
      current += ch;
      continue;
    }
    if (ch === ' ' && !inQuote) {
      if (current.length > 0) {
        tokens.push({ token: current, position: start });
        current = '';
      }
      start = i + 1;
      continue;
    }
    current += ch;
  }
  if (current.length > 0) {
    tokens.push({ token: current, position: start });
  }
  return tokens;
}

/** Retire les guillemets enveloppants d'une value. */
function stripQuotes(value: string): string {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  return value;
}

/** Parse une date acceptant ISO, mots-clés et offsets relatifs. */
function parseDate(raw: string, now: Date = new Date()): Date | null {
  const v = raw.toLowerCase().trim();

  if (v === 'today') {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (v === 'yesterday') {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (v === 'now') {
    return new Date(now);
  }

  // Offset relatif : -7d, -1h, -30m, -90s
  const offset = /^-(\d+)([smhd])$/.exec(v);
  if (offset) {
    const n = Number(offset[1]);
    const unit = offset[2]!;
    const multiplier =
      unit === 's' ? 1000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
    return new Date(now.getTime() - n * multiplier);
  }

  // ISO date / datetime
  const d = new Date(raw);
  return Number.isFinite(d.getTime()) ? d : null;
}

/** Parse `attempts:>3`, `attempts:<=2`, `attempts:0` etc. */
function parseAttemptsValue(
  raw: string,
): { operator: FilterOperator; value: number } | null {
  const m = /^(>=|<=|=|>|<)?\s*(\d+)$/.exec(raw.trim());
  if (!m) return null;
  const operator = (m[1] ?? '=') as FilterOperator;
  const value = Number(m[2]);
  if (!Number.isFinite(value) || value < 0) return null;
  return { operator, value };
}

/**
 * Parse les filtres depuis une string Cmd-K.
 *
 * @param input  La string saisie par l'admin
 * @param now    Référence temporelle (pour testabilité)
 */
export function parseFilters(input: string, now: Date = new Date()): ParseResult {
  const result: ParseResult = { filters: [], errors: [] };
  const freetextTokens: string[] = [];

  if (!input || !input.trim()) {
    return result;
  }

  const tokens = tokenize(input);

  for (const { token, position } of tokens) {
    // Détecter un pattern `key:value` (key sans `:` au début)
    const colonIdx = findUnescapedColon(token);
    if (colonIdx < 0 || colonIdx === 0) {
      freetextTokens.push(token);
      continue;
    }

    const key = token.slice(0, colonIdx).toLowerCase();
    const rawValue = stripQuotes(unescape(token.slice(colonIdx + 1)));

    if (!KNOWN_KEYS.has(key)) {
      freetextTokens.push(token);
      continue;
    }

    const filter = parseSingleFilter(key as FilterKey, rawValue, token, now);
    if ('error' in filter) {
      result.errors.push({ position, raw: token, message: filter.error });
    } else {
      result.filters.push(filter);
    }
  }

  if (freetextTokens.length > 0) {
    result.freetext = freetextTokens.join(' ');
  }

  return result;
}

/** Trouve la première occurrence de `:` non escapée. */
function findUnescapedColon(token: string): number {
  let escaped = false;
  for (let i = 0; i < token.length; i += 1) {
    const ch = token[i]!;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === ':') return i;
  }
  return -1;
}

/** Désescape `\X` → `X`. */
function unescape(s: string): string {
  return s.replace(/\\(.)/g, '$1');
}

function parseSingleFilter(
  key: FilterKey,
  rawValue: string,
  raw: string,
  now: Date,
): ParsedFilter | { error: string } {
  if (rawValue.length === 0) {
    // Messages alignés sur la spec F04 §6 (CKPT-03) — affichés tels quels
    // dans la section d'erreurs du cockpit.
    return { error: `Valeur manquante pour « ${key}: »` };
  }

  switch (key) {
    case 'status': {
      // Plusieurs statuts séparés par virgule
      const parts = rawValue.split(',').map((v) => v.trim().toLowerCase());
      const valid: OutboxStatus[] = [];
      for (const p of parts) {
        if ((OUTBOX_STATUSES as readonly string[]).includes(p)) {
          valid.push(p as OutboxStatus);
        } else {
          return { error: `Statut inconnu : « ${p} ». Valides : failed, dlq, delivered…` };
        }
      }
      if (valid.length === 0) {
        return { error: 'Aucun statut valide' };
      }
      return { key: 'status', value: valid, raw };
    }

    case 'to':
    case 'template':
    case 'source': {
      // Pas de validation stricte ; le caller (query builder) gère le glob.
      return { key, value: rawValue, raw };
    }

    case 'after':
    case 'before': {
      const d = parseDate(rawValue, now);
      if (!d) return { error: `Date invalide : « ${rawValue} ». Formats : 2026-05-01, today, -7d` };
      return { key, value: d, raw };
    }

    case 'attempts': {
      const parsed = parseAttemptsValue(rawValue);
      if (!parsed) return { error: `« ${rawValue} » ignoré — attendu : >N, <N, =N` };
      return { key: 'attempts', operator: parsed.operator, value: parsed.value, raw };
    }

    case 'has': {
      if (rawValue.toLowerCase() !== 'error') {
        return { error: `« has: » n'accepte que « error » (reçu : « ${rawValue} »)` };
      }
      return { key: 'has', value: 'error', raw };
    }
  }
}

/**
 * Sérialise un ParseResult en query-string `?status=failed&template=cart-*`.
 * Utile pour URL-sync depuis la palette.
 */
export function serializeFilters(filters: ParsedFilter[]): URLSearchParams {
  const params = new URLSearchParams();
  for (const f of filters) {
    switch (f.key) {
      case 'status':
        params.set('status', f.value.join(','));
        break;
      case 'after':
      case 'before':
        params.set(f.key, f.value.toISOString());
        break;
      case 'attempts':
        params.set('attempts', `${f.operator}${f.value}`);
        break;
      default:
        params.set(f.key, String(f.value));
    }
  }
  return params;
}

/** Re-parse depuis une URLSearchParams (utile au mount de la page). */
export function deserializeFilters(params: URLSearchParams, now: Date = new Date()): ParseResult {
  const segments: string[] = [];
  for (const [k, v] of params.entries()) {
    if (KNOWN_KEYS.has(k)) {
      // re-format en token Cmd-K (avec quotes si nécessaire pour valeur avec espaces)
      const needsQuote = /\s/.test(v);
      segments.push(`${k}:${needsQuote ? `"${v}"` : v}`);
    }
  }
  return parseFilters(segments.join(' '), now);
}
