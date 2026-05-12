/**
 * DELIV-CITIES — Importer pur du fixture sendit.
 *
 * Transforme un dump Django de la table `delivery_gateway.senditcity`
 * (forme `{ model, pk, fields: { city, name, arabic_name, price, delais } }`)
 * en un tableau d'objets `ImportedCity` prêts pour `bulkUpsertDeliveryCities`.
 *
 * **Pur** : aucune I/O, aucun appel DB — totalement testable unitairement.
 *
 * Règles métier (validées avec le PO)
 * ───────────────────────────────────
 *  - **Granularité = ville** (PAS zone). Le fixture sendit contient une ligne
 *    par *zone de pickup* à l'intérieur d'une ville (ex. "Casablanca - Al fida",
 *    "Casablanca - Abdelmoumen", … 71 zones pour Casablanca). Notre catalogue
 *    UI customer-facing ne montre que la ville — on agrège donc en lisant
 *    `fields.city` (et NON `fields.name`) comme source du nom canonique.
 *  - Slug stable ASCII : NFD-strip + lowercase + non-[a-z0-9]+ → '-'. Pas
 *    de fallback random — si la slugification donne une chaîne vide on
 *    drop le record (au lieu de créer un slug fragile).
 *  - **Dedup par slug** : on garde le record avec le `pk` Django LE PLUS
 *    PETIT (validé PO — le pk le plus petit = la source canonique historique
 *    côté Django, les pk plus élevés sont des doublons ajoutés plus tard).
 *  - **Prix en MAD entier** (PAS centimes) : on parse le string, replace
 *    ',' par '.', Math.round si décimal. Règle produit explicite : on
 *    n'affiche jamais MAD avec centimes côté UI.
 *  - ETA texte brut, libre : exemples du fixture sendit = "24h",
 *    "24h - 48h", "24h - 72h", "48h - 96h". On passe la valeur tel quel,
 *    l'UI normalise l'affichage (`24-48h` etc.).
 *  - source = 'sendit', externalRef = `sendit:${pk}` pour traçabilité.
 *  - Aliases & nameAr : overlay depuis la liste curatée
 *    `MOROCCAN_CITIES` (`data/moroccan-cities.ts`) — préserve les alias
 *    historiques (Casa, Mazagan, Fez, etc.) construits lors de CHA-231.
 *
 * Format de sortie : `ImportedCity` mappe 1-1 sur `DeliveryCityInsert`
 * (sans timestamps — défaut SQL `now()` côté DB). `id` = `dc_${slug}` pour
 * un import déterministe et idempotent.
 */
import { MOROCCAN_CITIES } from '../data/moroccan-cities';

// ─────────────────────────────────────────────────────────────────────────────
// Types externes (entrée du fixture Django)
// ─────────────────────────────────────────────────────────────────────────────

export interface SenditCityFields {
  city: string;
  name?: string;
  arabic_name?: string | null;
  price: string | number;
  delais: string;
}

export interface SenditCityRecord {
  model?: string;
  pk: number;
  fields: SenditCityFields;
}

// ─────────────────────────────────────────────────────────────────────────────
// Types internes (sortie de l'importer)
// ─────────────────────────────────────────────────────────────────────────────

export interface ImportedCity {
  id: string;
  slug: string;
  nameFr: string;
  nameAr: string | null;
  countryCode: 'MA';
  deliveryPriceMad: number;
  deliveryEta: string;
  isActive: true;
  source: 'sendit';
  externalRef: string;
  aliases: string[];
  metadata: Record<string, unknown>;
  position: number;
}

export interface ImportSummary {
  /** Nombre de records source rencontrés. */
  parsed: number;
  /** Nombre de villes uniques retenues. */
  unique: number;
  /** Nombre de records droppés (dedup + invalid). */
  dropped: number;
  /** Compteur des raisons de drop. */
  droppedReasons: Record<string, number>;
}

export interface ImportResult {
  cities: ImportedCity[];
  summary: ImportSummary;
}

// ─────────────────────────────────────────────────────────────────────────────
// Overlays (alias & nom AR curatés via MOROCCAN_CITIES)
// ─────────────────────────────────────────────────────────────────────────────

/** Map slug → liste d'alias héritée de la liste curatée historique. */
const ALIASES_OVERLAY: Record<string, ReadonlyArray<string>> = (() => {
  const out: Record<string, string[]> = {};
  for (const c of MOROCCAN_CITIES) {
    if (c.aliases && c.aliases.length > 0) {
      out[c.value] = [...c.aliases];
    }
  }
  return out;
})();

/** Map slug → libellé AR canonique de la liste curatée. */
const NAME_AR_OVERLAY: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const c of MOROCCAN_CITIES) {
    if (c.labelAr) out[c.value] = c.labelAr;
  }
  return out;
})();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers purs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Slugify ASCII — clé stable pour lookup et URL.
 * Exemples :
 *   "Casablanca"          → "casablanca"
 *   "Ighrem N'ougdal"     → "ighrem-nougdal"      (apostrophe → vide)
 *   "Aïn Sebaâ"           → "ain-sebaa"           (diacritiques retirés)
 *   "Tabounte Ouarzazate" → "tabounte-ouarzazate"
 *   "Béni Mellal"         → "beni-mellal"
 *   ""                    → ""                    (drop côté caller)
 */
export function slugifyCity(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // diacritiques combinants
    .toLowerCase()
    .replace(/['\u2019\u2018]/g, '') // apostrophes droite + courbes
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

/**
 * Parse un prix sendit (string ou number) en entier MAD positif.
 * Retourne `null` si non parsable. Math.round si décimal.
 *
 * Exemples valides :
 *   "45"      → 45
 *   "29"      → 29
 *   "29.5"    → 30
 *   "29,5"    → 30
 *   45        → 45
 *   "45 MAD"  → 45        (extrait préfixe numérique via Number coerce)
 *   "abc"     → null
 *   -5        → 0          (clamp >= 0)
 */
export function parsePriceMad(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.max(0, Math.round(raw));
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    // Tolère "45 MAD" ou "45 dh" : on extrait le premier nombre.
    const match = trimmed.match(/-?\d+(?:[.,]\d+)?/);
    if (!match) return null;
    const n = Number(match[0].replace(',', '.'));
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.round(n));
  }
  return null;
}

/**
 * Strip un suffixe de zone d'un libellé AR pickup-zone sendit.
 *   "الدار البيضاء - الفداء"     → "الدار البيضاء"
 *   "الدار البيضاء — عبد المومن" → "الدار البيضاء"
 *   "الدار البيضاء"              → "الدار البيضاء"     (no-op)
 *
 * On split sur les séparateurs " - " (hyphen-minus) et " — " (em-dash)
 * — pas sur les hyphens nus pour ne pas casser des noms composés
 * légitimes.
 */
export function stripArabicZoneSuffix(raw: string): string {
  const head = raw.split(/\s[-—]\s/u)[0] ?? raw;
  return head.trim();
}

/**
 * Normalise une ETA texte. On accepte les variantes courantes du fixture
 * sendit et on les ramène à un format compact :
 *   "24h"          → "24h"
 *   "24h - 48h"    → "24h - 48h"
 *   "  24H  "      → "24h"
 * Retourne null si chaîne vide.
 */
export function normalizeEta(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!trimmed) return null;
  return trimmed;
}

// ─────────────────────────────────────────────────────────────────────────────
// API principale
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse un fixture sendit et retourne les villes uniques prêtes à upsert,
 * accompagnées d'un résumé pour observabilité (logs admin).
 *
 * @param raw - Le tableau Django (peut être passé tel quel après `JSON.parse`).
 */
export function parseSenditFixture(raw: unknown): ImportResult {
  if (!Array.isArray(raw)) {
    return {
      cities: [],
      summary: {
        parsed: 0,
        unique: 0,
        dropped: 0,
        droppedReasons: { not_array: 1 },
      },
    };
  }

  const reasons: Record<string, number> = {};
  const seen = new Map<string, ImportedCity>();
  let parsed = 0;

  // Tri par pk ASC : la première occurrence d'un slug = le pk le plus petit,
  // donc gagnant (règle métier validée).
  const sorted = [...raw].sort((a, b) => {
    const ap = Number((a as SenditCityRecord | null)?.pk ?? Number.MAX_SAFE_INTEGER);
    const bp = Number((b as SenditCityRecord | null)?.pk ?? Number.MAX_SAFE_INTEGER);
    return ap - bp;
  });

  for (const entry of sorted) {
    parsed++;
    const rec = entry as SenditCityRecord | null;

    if (!rec || typeof rec !== 'object' || !rec.fields) {
      reasons.missing_fields = (reasons.missing_fields ?? 0) + 1;
      continue;
    }

    const fields = rec.fields;
    // Source canonique = `fields.city` UNIQUEMENT. `fields.name` contient le
    // nom de la zone de pickup ("Casablanca - Al fida") qui ferait exploser
    // la granularité à 500 lignes au lieu des ~430 villes attendues.
    const rawName = typeof fields.city === 'string' ? fields.city : '';
    if (!rawName.trim()) {
      reasons.missing_name = (reasons.missing_name ?? 0) + 1;
      continue;
    }

    const nameFr = rawName.trim();
    const slug = slugifyCity(nameFr);
    if (!slug) {
      reasons.empty_slug = (reasons.empty_slug ?? 0) + 1;
      continue;
    }

    const priceMad = parsePriceMad(fields.price);
    if (priceMad === null) {
      reasons.invalid_price = (reasons.invalid_price ?? 0) + 1;
      continue;
    }

    const eta = normalizeEta(fields.delais);
    if (!eta) {
      reasons.missing_eta = (reasons.missing_eta ?? 0) + 1;
      continue;
    }

    // Premier rencontré → gagnant (tri ASC sur pk).
    if (seen.has(slug)) {
      reasons.duplicate_slug = (reasons.duplicate_slug ?? 0) + 1;
      continue;
    }

    // AR raw du fixture contient aussi le suffixe zone, ex.
    // "الدار البيضاء - الفداء". On strip → "الدار البيضاء".
    const nameArRaw =
      typeof fields.arabic_name === 'string'
        ? stripArabicZoneSuffix(fields.arabic_name)
        : '';
    const nameAr = nameArRaw || NAME_AR_OVERLAY[slug] || null;
    const aliasesOverlay = ALIASES_OVERLAY[slug];

    const city: ImportedCity = {
      id: `dc_${slug}`,
      slug,
      nameFr,
      nameAr,
      countryCode: 'MA',
      deliveryPriceMad: priceMad,
      deliveryEta: eta,
      isActive: true,
      source: 'sendit',
      externalRef: typeof rec.pk === 'number' ? `sendit:${rec.pk}` : 'sendit:?',
      aliases: aliasesOverlay ? [...aliasesOverlay] : [],
      metadata: {},
      position: 0,
    };

    seen.set(slug, city);
  }

  const cities = Array.from(seen.values()).sort((a, b) =>
    a.nameFr.localeCompare(b.nameFr, 'fr'),
  );

  return {
    cities,
    summary: {
      parsed,
      unique: cities.length,
      dropped: parsed - cities.length,
      droppedReasons: reasons,
    },
  };
}
