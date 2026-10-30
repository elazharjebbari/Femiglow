/**
 * Import des images générées — analyse de l'arborescence et validation
 * contre le registre (module pur : aucun accès disque ni base).
 *
 * Convention (05 §4.8, identique à `docs/hero-media-par-angle/generated/`) :
 *
 *   <root>/<componentKey>/<slot>/<variant>/<locale>/<nn>-<slug>[.mobile].(png|jpg|jpeg|webp)
 *   <root>/<componentKey>/<slot>/<variant>/<locale>/<nn>-<slug>.alt.json   {"fr","ar","en"}
 *   <root>/<componentKey>/<slot>/<variant>/<locale>/_alt.json              alts du dossier
 *
 *  - `variant` : `default` → (`default`, `*`) ; `angle-<k>` → (`angle`, k) ;
 *    `ab-<expKey>-<arm>` → (`ab:<expKey>`, arm) — `expKey` peut contenir des
 *    tirets : il est reconnu d'après les dimensions `ab:` déclarées.
 *  - `locale` : `fr` | `ar` | `en`, ou `_all` → `*` avec `crossLocale = true`.
 *  - `nn` : position 1-based sur deux chiffres, contiguë depuis `01`.
 *  - `.mobile` : recadrage 3:4 du fichier de même `nn` et même slug.
 *  - À la racine, les entrées commençant par `_` ou `.` sont ignorées
 *    (`_work/`, `_log.csv`) ; les fichiers cachés le sont partout.
 *
 * Un dossier (= un ensemble) contenant une erreur n'est pas importé ; les
 * autres le sont. Les avertissements (alt manquant…) n'empêchent rien.
 *
 * L'exécution (lecture disque, ingestion, brouillons) est dans
 * `run-component-media-import.ts`.
 */
import { createHash } from 'node:crypto';
import { LOCALES } from '@/i18n.config';
import { normalizeSlug } from '@/lib/db/queries/media';
import type { MediaSetItemAlt } from '@/lib/db/types';
import {
  SITE_COMPONENT_REGISTRY,
  type MediaVariantPolicy,
  type SiteComponentSeed,
} from '@/lib/components/registry';
import {
  AB_DIMENSION_PREFIX,
  DEFAULT_DIMENSION,
  WILDCARD,
  isValidVariantKey,
} from '@/lib/components/media-variants/dimensions';
import { findSlotPolicy, slotMaxItems } from '@/lib/components/media-variants/policy';

/* ──────────────────────────────────────────────────────────────────
 * Types
 * ────────────────────────────────────────────────────────────────── */

export type ImportIssueSeverity = 'error' | 'warning';

export interface ImportIssue {
  severity: ImportIssueSeverity;
  /** Code stable (`component.unknown`, `positions.not_contiguous`…). */
  code: string;
  /** Chemin relatif à la racine (fichier ou dossier) concerné. */
  path: string;
  message: string;
}

/** Contenu d'un fichier d'alt, déjà lu par l'appelant. */
export type AltFileContent = { ok: true; value: unknown } | { ok: false; error: string };

export interface PlannedFile {
  /** Chemin relatif à la racine (séparateur `/`). */
  relPath: string;
  /** Slug déterministe du média (cf. `buildImportMediaSlug`). */
  mediaSlug: string;
}

export interface PlannedItem {
  /** Position 1-based (`nn`). */
  position: number;
  /** Slug du fichier (partie après `nn-`). */
  slug: string;
  desktop: PlannedFile;
  mobile: PlannedFile | null;
  alt: MediaSetItemAlt;
  altSource: 'file' | 'folder' | 'none';
}

export interface PlannedSet {
  componentKey: string;
  slot: string;
  variantDim: string;
  variantKey: string;
  locale: string;
  crossLocale: boolean;
  /** Dossier relatif `<component>/<slot>/<variant>/<locale>`. */
  folder: string;
  items: PlannedItem[];
}

export interface ImportPlan {
  sets: PlannedSet[];
  issues: ImportIssue[];
  /** Fichiers ignorés volontairement (racine `_*`, fichiers cachés, autre composant). */
  ignored: string[];
}

export interface BuildImportPlanInput {
  /** Tous les fichiers sous la racine, chemins relatifs (séparateur `/`). */
  files: readonly string[];
  /** Contenu des `.alt.json` / `_alt.json`, indexé par chemin relatif. */
  altFiles?: Readonly<Record<string, AltFileContent>>;
  /** Ne retenir que ce composant (les autres sont ignorés). */
  componentKey?: string;
  /** Registre (injectable pour les tests). Défaut : `SITE_COMPONENT_REGISTRY`. */
  registry?: readonly SiteComponentSeed[];
}

/* ──────────────────────────────────────────────────────────────────
 * Segments de chemin
 * ────────────────────────────────────────────────────────────────── */

/** Dossier de langue « toutes langues » (images sans texte). */
export const ALL_LOCALES_DIR = '_all';

/** Fichier d'alts commun à un dossier. */
export const FOLDER_ALT_FILE = '_alt.json';

const IMAGE_FILE = /^(\d{2})-([^.]+)(\.mobile)?\.(png|jpe?g|webp)$/i;
const ALT_FILE = /^(\d{2})-([^.]+)\.alt\.json$/i;
const ALT_MAX_LENGTH = 300;
const MEDIA_SLUG_MAX = 80;

export interface ParsedVariant {
  variantDim: string;
  variantKey: string;
}

/**
 * Traduit un dossier de variante en (dimension, clé). `policy` sert à
 * reconnaître `expKey` dans `ab-<expKey>-<arm>` (tirets autorisés) ;
 * sans dimension `ab:` correspondante, on coupe au dernier tiret.
 * Renvoie `null` si le nom ne suit pas la convention.
 */
export function parseVariantDir(
  dir: string,
  policy?: Pick<MediaVariantPolicy, 'dimensions'> | null,
): ParsedVariant | null {
  if (dir === 'default') return { variantDim: DEFAULT_DIMENSION, variantKey: WILDCARD };
  if (dir.startsWith('angle-') && dir.length > 'angle-'.length) {
    return { variantDim: 'angle', variantKey: dir.slice('angle-'.length) };
  }
  if (dir.startsWith('ab-')) {
    const rest = dir.slice('ab-'.length);
    const declared = (policy?.dimensions ?? [])
      .filter((d) => d.startsWith(AB_DIMENSION_PREFIX))
      .map((d) => d.slice(AB_DIMENSION_PREFIX.length))
      .filter((expKey) => rest.startsWith(`${expKey}-`) && rest.length > expKey.length + 1)
      .sort((a, b) => b.length - a.length);
    const expKey = declared[0];
    if (expKey) {
      return { variantDim: `${AB_DIMENSION_PREFIX}${expKey}`, variantKey: rest.slice(expKey.length + 1) };
    }
    const cut = rest.lastIndexOf('-');
    if (cut > 0 && cut < rest.length - 1) {
      return { variantDim: `${AB_DIMENSION_PREFIX}${rest.slice(0, cut)}`, variantKey: rest.slice(cut + 1) };
    }
  }
  return null;
}

/** Traduit un dossier de langue ; `null` si inconnu. */
export function parseLocaleDir(dir: string): { locale: string; crossLocale: boolean } | null {
  if (dir === ALL_LOCALES_DIR) return { locale: WILDCARD, crossLocale: true };
  if ((LOCALES as readonly string[]).includes(dir)) return { locale: dir, crossLocale: false };
  return null;
}

/**
 * Slug déterministe d'un média importé :
 * `cmv-<component>-<slot>-<variant>-<locale>-<nn>-<slug>[-mobile]`
 * (`_all` → `all`), normalisé par `normalizeSlug`. Au-delà de 80
 * caractères (limite de `normalizeSlug`), on tronque et on suffixe par une
 * empreinte du slug complet pour rester unique et stable.
 */
export function buildImportMediaSlug(parts: {
  componentKey: string;
  slot: string;
  variantDir: string;
  localeDir: string;
  position: string;
  slug: string;
  mobile: boolean;
}): string {
  const segments = [
    'cmv',
    parts.componentKey,
    parts.slot,
    parts.variantDir,
    parts.localeDir === ALL_LOCALES_DIR ? 'all' : parts.localeDir,
    parts.position,
    parts.slug,
    ...(parts.mobile ? ['mobile'] : []),
  ].map((s) => normalizeSlug(s));
  const full = segments.filter(Boolean).join('-');
  if (full.length <= MEDIA_SLUG_MAX) return normalizeSlug(full);
  const hash = createHash('sha256').update(full).digest('hex').slice(0, 8);
  const head = full.slice(0, MEDIA_SLUG_MAX - hash.length - 1).replace(/-+$/, '');
  return normalizeSlug(`${head}-${hash}`);
}

/**
 * Slug d'un média dont le fichier a changé alors que le slug déterministe
 * est déjà pris par l'ancienne version (peut-être publiée) : on ne la
 * remplace jamais en place, on crée un nouveau média suffixé par
 * l'empreinte du nouveau contenu (stable d'un passage à l'autre).
 */
export function forkImportMediaSlug(slug: string, sourceChecksum: string): string {
  const hex = sourceChecksum.replace(/^sha256-/, '').slice(0, 8);
  const head = slug.slice(0, MEDIA_SLUG_MAX - hex.length - 1).replace(/-+$/, '');
  return normalizeSlug(`${head}-${hex}`);
}

/* ──────────────────────────────────────────────────────────────────
 * Alts
 * ────────────────────────────────────────────────────────────────── */

const ALT_LOCALES = LOCALES as readonly string[];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** Vrai si l'objet ne contient que des clés de langue (`{fr, ar, en}`). */
function isLocaleMap(value: Record<string, unknown>): boolean {
  const keys = Object.keys(value);
  return keys.length > 0 && keys.every((k) => ALT_LOCALES.includes(k));
}

/**
 * Nettoie un objet d'alts : garde `fr` / `ar` / `en` non vides (≤ 300
 * caractères, espaces rognés). Les clés inconnues et valeurs invalides
 * sont signalées en avertissement.
 */
export function sanitizeAlt(
  value: unknown,
  relPath: string,
  issues: ImportIssue[],
): MediaSetItemAlt {
  const out: MediaSetItemAlt = {};
  if (!isPlainObject(value)) {
    issues.push({
      severity: 'error',
      code: 'alt.invalid',
      path: relPath,
      message: 'Le fichier d’alt doit être un objet {"fr": "…", "ar": "…", "en": "…"}',
    });
    return out;
  }
  for (const [lang, text] of Object.entries(value)) {
    if (!ALT_LOCALES.includes(lang)) {
      issues.push({
        severity: 'warning',
        code: 'alt.locale_unknown',
        path: relPath,
        message: `Langue d’alt inconnue ignorée : ${lang}`,
      });
      continue;
    }
    if (typeof text !== 'string' || text.trim().length === 0) {
      issues.push({
        severity: 'warning',
        code: 'alt.empty',
        path: relPath,
        message: `Alt ${lang} vide ou non textuel, ignoré`,
      });
      continue;
    }
    if (text.trim().length > ALT_MAX_LENGTH) {
      issues.push({
        severity: 'error',
        code: 'alt.too_long',
        path: relPath,
        message: `Alt ${lang} trop long (${ALT_MAX_LENGTH} caractères au maximum)`,
      });
      continue;
    }
    out[lang as keyof MediaSetItemAlt] = text.trim();
  }
  return out;
}

/* ──────────────────────────────────────────────────────────────────
 * Plan
 * ────────────────────────────────────────────────────────────────── */

interface ImageEntry {
  relPath: string;
  nn: string;
  slug: string;
  mobile: boolean;
}

interface FolderBucket {
  componentKey: string;
  slotDir: string;
  variantDir: string;
  localeDir: string;
  images: ImageEntry[];
  altFiles: Map<string, string>; // `<nn>-<slug>` → relPath
  folderAlt: string | null;
}

function err(issues: ImportIssue[], code: string, path: string, message: string): void {
  issues.push({ severity: 'error', code, path, message });
}

function warn(issues: ImportIssue[], code: string, path: string, message: string): void {
  issues.push({ severity: 'warning', code, path, message });
}

function hasError(issues: readonly ImportIssue[], from: number): boolean {
  return issues.slice(from).some((i) => i.severity === 'error');
}

/**
 * Construit le plan d'import : ensembles valides (un par dossier
 * `<component>/<slot>/<variant>/<locale>`), problèmes, fichiers ignorés.
 * Déterministe (tri lexical des chemins).
 */
export function buildImportPlan(input: BuildImportPlanInput): ImportPlan {
  const registry = input.registry ?? SITE_COMPONENT_REGISTRY;
  const altFiles = input.altFiles ?? {};
  const issues: ImportIssue[] = [];
  const ignored: string[] = [];
  const buckets = new Map<string, FolderBucket>();
  const reportedComponents = new Set<string>();

  const files = [...input.files].map((f) => f.replace(/\\/g, '/').replace(/^\.?\/+/, '')).sort();

  if (input.componentKey && !registry.some((c) => c.key === input.componentKey)) {
    err(issues, 'component.unknown', input.componentKey, `Composant inconnu du registre : ${input.componentKey}`);
  }

  for (const relPath of files) {
    const parts = relPath.split('/').filter(Boolean);
    const [componentKey] = parts;
    if (!componentKey) continue;
    // Racine : `_work/`, `_log.csv`, `.gitignore`… ne sont pas des composants.
    if (componentKey.startsWith('_') || componentKey.startsWith('.') || parts.length === 1) {
      ignored.push(relPath);
      continue;
    }
    if (parts.some((p) => p.startsWith('.'))) {
      ignored.push(relPath);
      continue;
    }
    if (input.componentKey && componentKey !== input.componentKey) {
      ignored.push(relPath);
      continue;
    }

    const seed = registry.find((c) => c.key === componentKey);
    if (!seed) {
      if (!reportedComponents.has(componentKey)) {
        reportedComponents.add(componentKey);
        err(issues, 'component.unknown', componentKey, `Composant inconnu du registre : ${componentKey}`);
      }
      continue;
    }
    if (!seed.mediaVariants) {
      if (!reportedComponents.has(componentKey)) {
        reportedComponents.add(componentKey);
        err(
          issues,
          'component.no_media_variants',
          componentKey,
          `Le composant ${componentKey} ne déclare pas de politique « médias par audience » (mediaVariants)`,
        );
      }
      continue;
    }
    if (parts.length !== 5) {
      err(
        issues,
        'path.depth',
        relPath,
        'Chemin hors convention : attendu <composant>/<slot>/<variante>/<langue>/<nn>-<slug>[.mobile].png',
      );
      continue;
    }

    const [, slotDir, variantDir, localeDir, filename] = parts as [string, string, string, string, string];
    const folder = `${componentKey}/${slotDir}/${variantDir}/${localeDir}`;
    let bucket = buckets.get(folder);
    if (!bucket) {
      bucket = { componentKey, slotDir, variantDir, localeDir, images: [], altFiles: new Map(), folderAlt: null };
      buckets.set(folder, bucket);
    }

    if (filename === FOLDER_ALT_FILE) {
      bucket.folderAlt = relPath;
      continue;
    }
    const altMatch = ALT_FILE.exec(filename);
    if (altMatch) {
      bucket.altFiles.set(`${altMatch[1]}-${altMatch[2]!.toLowerCase()}`, relPath);
      continue;
    }
    const imgMatch = IMAGE_FILE.exec(filename);
    if (!imgMatch) {
      warn(issues, 'file.unrecognized', relPath, 'Fichier hors convention ignoré');
      continue;
    }
    bucket.images.push({
      relPath,
      nn: imgMatch[1]!,
      slug: imgMatch[2]!.toLowerCase(),
      mobile: !!imgMatch[3],
    });
  }

  const sets: PlannedSet[] = [];
  for (const [folder, bucket] of [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const planned = planFolder(folder, bucket, registry, altFiles, issues);
    if (planned) sets.push(planned);
  }

  return { sets, issues, ignored };
}

function planFolder(
  folder: string,
  bucket: FolderBucket,
  registry: readonly SiteComponentSeed[],
  altFiles: Readonly<Record<string, AltFileContent>>,
  issues: ImportIssue[],
): PlannedSet | null {
  const mark = issues.length;
  const seed = registry.find((c) => c.key === bucket.componentKey)!;
  const policy = seed.mediaVariants!;

  // Slot, variante, langue.
  const slotPolicy = findSlotPolicy(policy, bucket.slotDir);
  if (!slotPolicy) {
    err(issues, 'slot.unknown', folder, `Slot non déclaré pour ${bucket.componentKey} : ${bucket.slotDir}`);
  }
  const variant = parseVariantDir(bucket.variantDir, policy);
  if (!variant) {
    err(
      issues,
      'variant.invalid',
      folder,
      `Variante hors convention : ${bucket.variantDir} (default | angle-<clé> | ab-<expérience>-<bras>)`,
    );
  } else if (variant.variantDim !== DEFAULT_DIMENSION && !policy.dimensions.includes(variant.variantDim)) {
    err(
      issues,
      'variant.dimension_unknown',
      folder,
      `Dimension non déclarée par ${bucket.componentKey} : ${variant.variantDim}`,
    );
  } else if (!isValidVariantKey(variant.variantDim, variant.variantKey)) {
    err(issues, 'variant.key_invalid', folder, `Clé invalide pour ${variant.variantDim} : ${variant.variantKey}`);
  }
  const locale = parseLocaleDir(bucket.localeDir);
  if (!locale) {
    err(
      issues,
      'locale.invalid',
      folder,
      `Langue hors convention : ${bucket.localeDir} (${[...ALT_LOCALES, ALL_LOCALES_DIR].join(' | ')})`,
    );
  }

  // Appariement desktop / mobile par (nn, slug).
  const byPosition = new Map<string, { desktop: ImageEntry[]; mobile: ImageEntry[] }>();
  for (const img of bucket.images) {
    const entry = byPosition.get(img.nn) ?? { desktop: [], mobile: [] };
    (img.mobile ? entry.mobile : entry.desktop).push(img);
    byPosition.set(img.nn, entry);
  }

  if (bucket.images.length === 0) {
    err(issues, 'folder.empty', folder, 'Aucune image dans ce dossier');
  }

  const pairs: Array<{ nn: string; desktop: ImageEntry; mobile: ImageEntry | null }> = [];
  for (const [nn, entry] of [...byPosition.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (entry.desktop.length > 1) {
      err(
        issues,
        'position.duplicate',
        folder,
        `Plusieurs images en position ${nn} : ${entry.desktop.map((d) => d.relPath).join(', ')}`,
      );
      continue;
    }
    const desktop = entry.desktop[0];
    for (const m of entry.mobile) {
      if (!desktop || m.slug !== desktop.slug) {
        err(issues, 'mobile.orphan', m.relPath, `Version mobile sans image desktop ${nn}-${m.slug}`);
      }
    }
    if (entry.mobile.filter((m) => desktop && m.slug === desktop.slug).length > 1) {
      err(issues, 'mobile.duplicate', folder, `Plusieurs versions mobiles en position ${nn}`);
    }
    if (!desktop) continue;
    const mobile = entry.mobile.find((m) => m.slug === desktop.slug) ?? null;
    pairs.push({ nn, desktop, mobile });
  }

  // Positions contiguës depuis 01, nombre d'items selon le slot.
  const positions = [...byPosition.keys()].map((nn) => Number.parseInt(nn, 10)).sort((a, b) => a - b);
  if (positions.some((p, i) => p !== i + 1)) {
    err(
      issues,
      'positions.not_contiguous',
      folder,
      `Positions non contiguës depuis 01 : ${positions.map((p) => String(p).padStart(2, '0')).join(', ')}`,
    );
  }
  if (slotPolicy) {
    const max = slotMaxItems(slotPolicy);
    if (slotPolicy.kind === 'single' && byPosition.size > 1) {
      err(issues, 'slot.single_multiple', folder, `Le slot ${slotPolicy.key} n'accepte qu'une image`);
    } else if (byPosition.size > max) {
      err(issues, 'slot.too_many', folder, `Maximum ${max} images pour le slot ${slotPolicy.key} (${byPosition.size})`);
    }
  }

  // Alts : fichier de l'image > entrée du `_alt.json` > `_alt.json` global.
  let folderAltByKey: Map<string, unknown> | null = null;
  let folderAltGlobal: unknown = null;
  if (bucket.folderAlt) {
    const content = altFiles[bucket.folderAlt];
    if (!content) {
      err(issues, 'alt.unreadable', bucket.folderAlt, 'Fichier d’alt non lu');
    } else if (!content.ok) {
      err(issues, 'alt.invalid_json', bucket.folderAlt, `JSON invalide : ${content.error}`);
    } else if (!isPlainObject(content.value)) {
      err(issues, 'alt.invalid', bucket.folderAlt, '_alt.json doit être un objet');
    } else if (isLocaleMap(content.value)) {
      folderAltGlobal = content.value;
    } else {
      folderAltByKey = new Map(Object.entries(content.value).map(([k, v]) => [k.toLowerCase(), v]));
    }
  }

  const usedAltFiles = new Set<string>();
  const items: PlannedItem[] = [];
  for (const pair of pairs) {
    const key = `${pair.nn}-${pair.desktop.slug}`;
    let alt: MediaSetItemAlt = {};
    let altSource: PlannedItem['altSource'] = 'none';
    const altPath = bucket.altFiles.get(key);
    if (altPath) {
      usedAltFiles.add(key);
      const content = altFiles[altPath];
      if (!content) {
        err(issues, 'alt.unreadable', altPath, 'Fichier d’alt non lu');
      } else if (!content.ok) {
        err(issues, 'alt.invalid_json', altPath, `JSON invalide : ${content.error}`);
      } else {
        alt = sanitizeAlt(content.value, altPath, issues);
        altSource = 'file';
      }
    } else if (folderAltByKey && (folderAltByKey.has(key) || folderAltByKey.has(pair.nn))) {
      alt = sanitizeAlt(folderAltByKey.get(key) ?? folderAltByKey.get(pair.nn), bucket.folderAlt!, issues);
      altSource = 'folder';
    } else if (folderAltGlobal) {
      alt = sanitizeAlt(folderAltGlobal, bucket.folderAlt!, issues);
      altSource = 'folder';
    }
    const missing = ALT_LOCALES.filter((l) => !alt[l as keyof MediaSetItemAlt]);
    if (missing.length === ALT_LOCALES.length) {
      warn(issues, 'alt.missing', pair.desktop.relPath, 'Aucun texte alternatif (fr/ar/en) : à compléter dans l’admin');
    } else if (missing.length > 0) {
      warn(issues, 'alt.partial', pair.desktop.relPath, `Alt manquant pour : ${missing.join(', ')}`);
    }

    const slugParts = {
      componentKey: bucket.componentKey,
      slot: bucket.slotDir,
      variantDir: bucket.variantDir,
      localeDir: bucket.localeDir,
      position: pair.nn,
      slug: pair.desktop.slug,
    };
    items.push({
      position: Number.parseInt(pair.nn, 10),
      slug: pair.desktop.slug,
      desktop: {
        relPath: pair.desktop.relPath,
        mediaSlug: buildImportMediaSlug({ ...slugParts, mobile: false }),
      },
      mobile: pair.mobile
        ? { relPath: pair.mobile.relPath, mediaSlug: buildImportMediaSlug({ ...slugParts, mobile: true }) }
        : null,
      alt,
      altSource,
    });
  }
  for (const [key, altPath] of bucket.altFiles) {
    if (!usedAltFiles.has(key)) warn(issues, 'alt.orphan', altPath, 'Fichier d’alt sans image correspondante');
  }

  if (hasError(issues, mark) || !variant || !locale || !slotPolicy) return null;
  return {
    componentKey: bucket.componentKey,
    slot: slotPolicy.key,
    variantDim: variant.variantDim,
    variantKey: variant.variantKey,
    locale: locale.locale,
    crossLocale: locale.crossLocale,
    folder,
    items: items.sort((a, b) => a.position - b.position),
  };
}

/** Texte de la médiathèque (`media.alt`) : FR, sinon EN, sinon AR, sinon le slug lisible. */
export function libraryAltFor(alt: MediaSetItemAlt, slug: string): string {
  return alt.fr ?? alt.en ?? alt.ar ?? slug.replace(/-/g, ' ');
}

/** Vrai si le plan contient au moins une erreur. */
export function planHasErrors(plan: Pick<ImportPlan, 'issues'>): boolean {
  return plan.issues.some((i) => i.severity === 'error');
}
