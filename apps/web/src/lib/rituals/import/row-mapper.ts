/**
 * Mapping d'une row brute (CSV / JSON) vers un payload de soumission ritual.
 * Cf. docs/reviews-wall/execution/15-import-templates-formats.md § 8-9
 */
import { RITUAL_TAG_CATALOG, RITUAL_CITY_CATALOG } from '@/lib/schemas/rituals';
import type { RitualSignal } from '@/lib/db/types';

export interface MappedRow {
  productKey: string;
  body: string;
  wouldRecommend: RitualSignal;
  ritualTags: string[];
  authorFirstName: string | null;
  authorCity: string | null;
  initiatedSince: string | null;
  isAnonymous: boolean;
  language: 'fr' | 'ar';
}

export interface MapResult {
  row: MappedRow | null;
  errors: Array<{ field: string; code: string; message: string }>;
  warnings: Array<{ field: string; code: string; message: string }>;
}

const SIGNAL_SYNONYMS: Record<string, RitualSignal> = {
  oui: 'oui',
  yes: 'oui',
  'oui, sans hésiter': 'oui',
  recommanderait: 'oui',
  '1': 'oui',
  true: 'oui',
  hesite: 'hesite',
  hésite: 'hesite',
  "j'hésite": 'hesite',
  'j’hésite': 'hesite',
  maybe: 'hesite',
  non: 'non',
  no: 'non',
  'pas pour moi': 'non',
  '0': 'non',
  false: 'non',
};

function normalizeSignal(raw: string | null | undefined): RitualSignal | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  return SIGNAL_SYNONYMS[key] ?? null;
}

function normalizeTags(raw: string | unknown): {
  tags: string[];
  warnings: Array<{ field: string; code: string; message: string }>;
} {
  const warnings: Array<{ field: string; code: string; message: string }> = [];
  let candidates: string[] = [];
  if (Array.isArray(raw)) {
    candidates = raw.map((v) => String(v).trim()).filter(Boolean);
  } else if (typeof raw === 'string' && raw.length > 0) {
    candidates = raw.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  }
  const accepted: string[] = [];
  for (const candidate of candidates) {
    const slug = candidate.toLowerCase().replace(/\s+/g, '-');
    if ((RITUAL_TAG_CATALOG as readonly string[]).includes(slug)) {
      accepted.push(slug);
    } else {
      warnings.push({
        field: 'ritualTags',
        code: 'tag_unknown',
        message: `Tag inconnu ignoré : "${candidate}"`,
      });
    }
  }
  if (accepted.length > 3) {
    warnings.push({
      field: 'ritualTags',
      code: 'tags_truncated',
      message: `Plus de 3 tags fournis, tronqué aux 3 premiers.`,
    });
  }
  return { tags: accepted.slice(0, 3), warnings };
}

function normalizeCity(raw: string | null | undefined): {
  city: string | null;
  warning?: { field: string; code: string; message: string };
} {
  if (!raw) return { city: null };
  const trimmed = raw.trim();
  if (!trimmed) return { city: null };
  const match = RITUAL_CITY_CATALOG.find(
    (c) => c.toLowerCase() === trimmed.toLowerCase(),
  );
  if (match) return { city: match };
  return {
    city: 'Autre',
    warning: {
      field: 'authorCity',
      code: 'city_unknown',
      message: `Ville inconnue mappée sur « Autre » : "${trimmed}"`,
    },
  };
}

function normalizeInitiatedSince(raw: unknown): {
  value: string | null;
  warning?: { field: string; code: string; message: string };
} {
  if (typeof raw !== 'string' || !raw.trim()) return { value: null };
  const t = raw.trim();
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(t)) return { value: t };
  // YYYY-MM-DD → YYYY-MM
  const m1 = t.match(/^(\d{4})-(\d{2})-\d{2}/);
  if (m1) {
    return {
      value: `${m1[1]}-${m1[2]}`,
      warning: {
        field: 'initiatedSince',
        code: 'date_normalized',
        message: `Date normalisée (jour ignoré) : ${m1[1]}-${m1[2]}`,
      },
    };
  }
  // MM/YYYY
  const m2 = t.match(/^(\d{1,2})\/(\d{4})$/);
  if (m2) {
    const month = m2[1]!.padStart(2, '0');
    return {
      value: `${m2[2]}-${month}`,
      warning: {
        field: 'initiatedSince',
        code: 'date_normalized',
        message: `Date normalisée : ${m2[2]}-${month}`,
      },
    };
  }
  return {
    value: null,
    warning: {
      field: 'initiatedSince',
      code: 'date_invalid',
      message: `Date non reconnue : "${t}"`,
    },
  };
}

function parseBoolean(raw: unknown): boolean {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number') return raw !== 0;
  if (typeof raw === 'string') {
    const v = raw.trim().toLowerCase();
    return v === 'true' || v === '1' || v === 'oui' || v === 'yes';
  }
  return false;
}

export interface MapOptions {
  defaultProductKey?: string;
  defaultLanguage?: 'fr' | 'ar';
}

export function mapImportRow(
  raw: Record<string, unknown>,
  options: MapOptions = {},
): MapResult {
  const errors: MapResult['errors'] = [];
  const warnings: MapResult['warnings'] = [];

  const body = typeof raw.body === 'string' ? raw.body.trim() : '';
  if (!body) {
    errors.push({ field: 'body', code: 'body_required', message: 'body manquant' });
  } else if (body.length < 50) {
    errors.push({
      field: 'body',
      code: 'body_too_short',
      message: 'body trop court (< 50 caractères)',
    });
  } else if (body.length > 600) {
    errors.push({
      field: 'body',
      code: 'body_too_long',
      message: 'body trop long (> 600 caractères)',
    });
  }

  const signal = normalizeSignal(
    typeof raw.wouldRecommend === 'string' ? raw.wouldRecommend : null,
  );
  if (!signal) {
    errors.push({
      field: 'wouldRecommend',
      code: 'signal_required',
      message: 'wouldRecommend manquant ou non reconnu',
    });
  }

  if (errors.length > 0) {
    return { row: null, errors, warnings };
  }

  const { tags, warnings: tagWarnings } = normalizeTags(raw.ritualTags);
  warnings.push(...tagWarnings);

  const cityResult = normalizeCity(
    typeof raw.authorCity === 'string' ? raw.authorCity : null,
  );
  if (cityResult.warning) warnings.push(cityResult.warning);

  const dateResult = normalizeInitiatedSince(raw.initiatedSince);
  if (dateResult.warning) warnings.push(dateResult.warning);

  const authorFirstName =
    typeof raw.authorFirstName === 'string' && raw.authorFirstName.trim().length > 0
      ? raw.authorFirstName.trim().slice(0, 30)
      : null;

  const language: 'fr' | 'ar' =
    raw.language === 'ar' ? 'ar' : options.defaultLanguage ?? 'fr';

  return {
    row: {
      productKey:
        (typeof raw.productKey === 'string' && raw.productKey) ||
        options.defaultProductKey ||
        'pack-femiglow',
      body,
      wouldRecommend: signal!,
      ritualTags: tags,
      authorFirstName,
      authorCity: cityResult.city,
      initiatedSince: dateResult.value,
      isAnonymous: parseBoolean(raw.isAnonymous),
      language,
    },
    errors: [],
    warnings,
  };
}
