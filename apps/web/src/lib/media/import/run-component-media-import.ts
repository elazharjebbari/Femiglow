/**
 * Import des images générées — exécution (disque + base).
 *
 * 1. Parcourt `<root>` et lit les `.alt.json` / `_alt.json`.
 * 2. Construit le plan (`buildImportPlan` : convention 05 §4.8 + registre).
 * 3. Pour chaque image : sha256, slug déterministe, ingestion via
 *    `lib/media/ingest.ts` (variants AVIF/WebP/JPEG, blurhash, flou,
 *    statut `ready`). Idempotent :
 *      - même slug + même empreinte → `skipped` (sauf `--force` : ré-optimisé) ;
 *      - fichier identique octet pour octet à un média déjà importé (copies
 *        de slides partagées entre variantes) → média réutilisé (`deduped`) ;
 *      - slug déjà pris par une AUTRE version du fichier → nouveau média au
 *        slug suffixé par l'empreinte : l'ancienne image, peut-être publiée,
 *        n'est jamais remplacée en place.
 * 4. Pour chaque dossier valide : `upsertDraftSet(source = 'import')`,
 *    jamais publié sauf `publish: true` (`publishSet`). Un brouillon ou un
 *    publié déjà identique n'est pas réécrit ; un brouillon saisi dans
 *    l'admin n'est remplacé qu'avec `force`.
 *
 * `dryRun` : aucune écriture (ni stockage ni base) ; les lectures servent à
 * prédire ce qui serait créé, ignoré ou dédoublonné.
 *
 * CLI : `scripts/import-component-media.ts`.
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.8
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  findMediaBySlug,
  findMediaBySourceChecksum,
} from '@/lib/db/queries/media';
import {
  listSetsByComponent,
  publishSet,
  upsertDraftSet,
  type MediaSetItemInput,
} from '@/lib/db/queries/component-media-sets';
import { getSiteComponentByKey } from '@/lib/db/queries/site-components';
import { findAdminByEmail, findAdminById } from '@/lib/db/queries/admin-users';
import type {
  ComponentMediaSetWithItems,
  MediaSetItemAlt,
  SiteComponent,
  VariantBreakpoint,
} from '@/lib/db/types';
import { findComponentSeed } from '@/lib/components/registry';
import { readMediaVariantPolicy } from '@/lib/components/media-variants/policy';
import { breakpointsForVariantPolicy } from '@/lib/media/pipeline/breakpoints';
import type { OptimizeImageInput } from '@/lib/media/pipeline/optimize-image';
import type { StorageAdapter } from '@/lib/media/storage';
import { ingestImageBuffer, mimeFromFilename, sha256Checksum } from '@/lib/media/ingest';
import {
  FOLDER_ALT_FILE,
  buildImportPlan,
  forkImportMediaSlug,
  libraryAltFor,
  type AltFileContent,
  type ImportIssue,
  type PlannedFile,
  type PlannedSet,
} from './component-media-import';

/* ──────────────────────────────────────────────────────────────────
 * Types
 * ────────────────────────────────────────────────────────────────── */

export interface ComponentMediaImportOptions {
  /** Racine de l'arborescence (`generated/`). */
  root: string;
  /** Ne traiter que ce composant. */
  componentKey?: string;
  /** Aucune écriture : rapport prévisionnel. */
  dryRun?: boolean;
  /** Publie les ensembles importés (sinon : brouillons). */
  publish?: boolean;
  /**
   * Ré-optimise les médias existants et remplace un brouillon saisi dans
   * l'admin. Ne remplace jamais un média par un fichier différent.
   */
  force?: boolean;
  /**
   * Admin auteur des médias et ensembles : id `admin_users` ou e-mail
   * (`null` = import système). Vérifié avant toute écriture
   * (`ImportActorError` s'il est mal formé ou inconnu).
   */
  actorId?: string | null;
  /** Stockage des variants (tests). Défaut : driver de l'application. */
  storage?: StorageAdapter;
  /** Surcharges d'optimisation (tests : formats réduits). */
  optimize?: { breakpoints?: VariantBreakpoint[]; formats?: OptimizeImageInput['formats'] };
  /** Journal de progression. */
  log?: (line: string) => void;
}

export type ImportMediaStatus =
  | 'created'
  | 'reprocessed'
  | 'skipped'
  | 'deduped'
  | 'would_create'
  | 'would_reprocess';

export interface ImportMediaEntry {
  relPath: string;
  /** Slug réellement utilisé (peut différer du slug déterministe : dédoublonnage, fork). */
  slug: string;
  mediaId: string | null;
  status: ImportMediaStatus;
  sourceChecksum: string;
  reason?: string;
}

export type ImportSetAction =
  | 'created'
  | 'updated'
  | 'unchanged'
  | 'published'
  | 'would_create'
  | 'would_update'
  | 'would_publish'
  | 'error';

export interface ImportSetEntry {
  folder: string;
  componentKey: string;
  slot: string;
  variantDim: string;
  variantKey: string;
  locale: string;
  crossLocale: boolean;
  items: number;
  action: ImportSetAction;
  /** Statut de l'ensemble à l'issue de l'import. */
  status: 'draft' | 'published' | null;
  setId: string | null;
  version: number | null;
  error?: string;
}

export interface ComponentMediaImportReport {
  root: string;
  componentKey: string | null;
  dryRun: boolean;
  publish: boolean;
  force: boolean;
  startedAt: string;
  durationMs: number;
  summary: {
    files: number;
    sets: number;
    mediaCreated: number;
    mediaReprocessed: number;
    mediaSkipped: number;
    mediaDeduped: number;
    setsCreated: number;
    setsUpdated: number;
    setsUnchanged: number;
    setsPublished: number;
    errors: number;
    warnings: number;
  };
  created: ImportMediaEntry[];
  reprocessed: ImportMediaEntry[];
  skipped: ImportMediaEntry[];
  errors: ImportIssue[];
  warnings: ImportIssue[];
  ignored: string[];
  sets: ImportSetEntry[];
}

/* ──────────────────────────────────────────────────────────────────
 * Lecture de l'arborescence
 * ────────────────────────────────────────────────────────────────── */

/**
 * Liste les fichiers sous `root` (chemins relatifs, séparateur `/`). Les
 * dossiers cachés et, à la racine, les entrées `_*` (`_work/` : masters
 * bruts) ne sont pas parcourus : ils sont rapportés tels quels.
 */
export async function scanImportRoot(root: string): Promise<{ files: string[]; skippedDirs: string[] }> {
  const files: string[] = [];
  const skippedDirs: string[] = [];
  async function walk(dir: string, rel: string, depth: number): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const relPath = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (e.name.startsWith('.') || (depth === 0 && e.name.startsWith('_'))) {
          skippedDirs.push(`${relPath}/`);
          continue;
        }
        await walk(path.join(dir, e.name), relPath, depth + 1);
      } else if (e.isFile()) {
        files.push(relPath);
      }
    }
  }
  await walk(root, '', 0);
  return { files: files.sort(), skippedDirs: skippedDirs.sort() };
}

async function readAltFiles(root: string, files: readonly string[]): Promise<Record<string, AltFileContent>> {
  const out: Record<string, AltFileContent> = {};
  for (const rel of files) {
    const base = rel.slice(rel.lastIndexOf('/') + 1);
    if (!base.endsWith('.alt.json') && base !== FOLDER_ALT_FILE) continue;
    try {
      const text = await fs.readFile(path.join(root, rel), 'utf8');
      out[rel] = { ok: true, value: JSON.parse(text) as unknown };
    } catch (e) {
      out[rel] = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
  return out;
}

/* ──────────────────────────────────────────────────────────────────
 * Comparaison d'ensembles (idempotence)
 * ────────────────────────────────────────────────────────────────── */

function canonicalAlt(alt: MediaSetItemAlt | null | undefined): string {
  const entries = Object.entries(alt ?? {})
    .filter(([, v]) => typeof v === 'string' && v.trim().length > 0)
    .map(([k, v]) => [k, (v as string).trim()] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
}

/** Vrai si l'ensemble existant porte déjà exactement ces items. */
export function sameSetContent(
  existing: Pick<ComponentMediaSetWithItems, 'crossLocale' | 'items'>,
  desired: readonly MediaSetItemInput[],
  crossLocale: boolean,
): boolean {
  if (existing.crossLocale !== crossLocale) return false;
  const items = [...existing.items].sort((a, b) => a.position - b.position);
  if (items.length !== desired.length) return false;
  return items.every((item, i) => {
    const want = desired[i]!;
    return (
      item.mediaId === want.mediaId &&
      (item.mobileMediaId ?? null) === (want.mobileMediaId ?? null) &&
      canonicalAlt(item.alt) === canonicalAlt(want.alt)
    );
  });
}

/* ──────────────────────────────────────────────────────────────────
 * Exécution
 * ────────────────────────────────────────────────────────────────── */

function emptyReport(opts: ComponentMediaImportOptions, startedAt: Date): ComponentMediaImportReport {
  return {
    root: opts.root,
    componentKey: opts.componentKey ?? null,
    dryRun: !!opts.dryRun,
    publish: !!opts.publish,
    force: !!opts.force,
    startedAt: startedAt.toISOString(),
    durationMs: 0,
    summary: {
      files: 0,
      sets: 0,
      mediaCreated: 0,
      mediaReprocessed: 0,
      mediaSkipped: 0,
      mediaDeduped: 0,
      setsCreated: 0,
      setsUpdated: 0,
      setsUnchanged: 0,
      setsPublished: 0,
      errors: 0,
      warnings: 0,
    },
    created: [],
    reprocessed: [],
    skipped: [],
    errors: [],
    warnings: [],
    ignored: [],
    sets: [],
  };
}

/** Préfixe des identifiants fictifs d'un passage à blanc. */
const DRY_RUN_ID_PREFIX = 'dry-run:';

interface ResolvedTarget {
  /** Slug à ingérer. */
  slug: string;
  /** Média existant retenu (dédoublonnage ou slug déjà importé). */
  existingId: string | null;
  deduped: boolean;
  forked: boolean;
}

/**
 * Choisit le média cible d'un fichier (sans rien écrire) :
 * slug déterministe → empreinte connue ailleurs (dédoublonnage) → fork si
 * le slug est pris par une autre version du fichier.
 */
async function resolveTarget(
  file: PlannedFile,
  checksum: string,
  runByChecksum: Map<string, { id: string; slug: string }>,
): Promise<ResolvedTarget> {
  const bySlug = await findMediaBySlug(file.mediaSlug);
  if (bySlug) {
    const stored = bySlug.overrides?.sourceChecksum;
    if (!stored || stored === checksum) {
      return { slug: bySlug.slug, existingId: bySlug.id, deduped: false, forked: false };
    }
    const forkSlug = forkImportMediaSlug(file.mediaSlug, checksum);
    const fork = await findMediaBySlug(forkSlug);
    return { slug: forkSlug, existingId: fork?.id ?? null, deduped: false, forked: true };
  }
  const seen = runByChecksum.get(checksum) ?? (await findMediaBySourceChecksum(checksum));
  if (seen) return { slug: seen.slug, existingId: seen.id, deduped: true, forked: false };
  return { slug: file.mediaSlug, existingId: null, deduped: false, forked: false };
}

/** `--actor` mal formé ou inconnu : l'import refuse de démarrer. */
export class ImportActorError extends Error {
  code = 'import.actor_invalid';
}

const ACTOR_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const ACTOR_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Résout `--actor` (id ou e-mail d'un admin) en id `admin_users`, AVANT
 * toute écriture : un auteur inexistant ferait échouer la FK `created_by`
 * au premier média créé, en laissant un import à moitié fait.
 */
export async function resolveImportActor(actor: string | null | undefined): Promise<string | null> {
  if (actor === null || actor === undefined) return null;
  const value = actor.trim();
  if (ACTOR_EMAIL_PATTERN.test(value)) {
    const admin = await findAdminByEmail(value);
    if (!admin) throw new ImportActorError(`--actor : aucun admin avec l'e-mail ${value}`);
    return admin.id;
  }
  if (!ACTOR_ID_PATTERN.test(value)) {
    throw new ImportActorError(`--actor : format invalide « ${actor} » (id admin ou e-mail attendu)`);
  }
  const admin = await findAdminById(value);
  if (!admin) throw new ImportActorError(`--actor : admin introuvable (${value})`);
  return admin.id;
}

/**
 * Exécute l'import. Ne lève que si la racine est illisible ou si `actorId`
 * est invalide (`ImportActorError`), avant toute écriture.
 */
export async function runComponentMediaImport(
  opts: ComponentMediaImportOptions,
): Promise<ComponentMediaImportReport> {
  const startedAt = new Date();
  const report = emptyReport(opts, startedAt);
  const log = opts.log ?? (() => {});
  const dryRun = !!opts.dryRun;

  const stat = await fs.stat(opts.root).catch(() => null);
  if (!stat?.isDirectory()) throw new Error(`import: racine introuvable ou non dossier : ${opts.root}`);
  const actorId = await resolveImportActor(opts.actorId);

  const { files, skippedDirs } = await scanImportRoot(opts.root);
  const altFiles = await readAltFiles(opts.root, files);
  const plan = buildImportPlan({
    files,
    altFiles,
    ...(opts.componentKey ? { componentKey: opts.componentKey } : {}),
  });
  report.ignored = [...skippedDirs, ...plan.ignored];
  for (const issue of plan.issues) (issue.severity === 'error' ? report.errors : report.warnings).push(issue);
  report.summary.sets = plan.sets.length;

  const runByChecksum = new Map<string, { id: string; slug: string }>();
  const processedIds = new Set<string>();
  const componentCache = new Map<string, SiteComponent | null>();

  async function importFile(
    set: PlannedSet,
    file: PlannedFile,
    alt: MediaSetItemAlt,
    itemSlug: string,
  ): Promise<ImportMediaEntry> {
    report.summary.files += 1;
    const absolute = path.join(opts.root, file.relPath);
    const buffer = await fs.readFile(absolute);
    const checksum = sha256Checksum(buffer);
    const target = await resolveTarget(file, checksum, runByChecksum);
    const reason = target.deduped
      ? 'identique à un média déjà importé'
      : target.forked
        ? 'fichier modifié : nouveau média (l’ancien reste en place)'
        : undefined;
    const base = { relPath: file.relPath, slug: target.slug, sourceChecksum: checksum, ...(reason ? { reason } : {}) };

    // Déjà traité dans ce passage (copie octet pour octet) : rien à refaire.
    if (target.existingId && processedIds.has(target.existingId)) {
      const mediaId = target.existingId.startsWith(DRY_RUN_ID_PREFIX) ? null : target.existingId;
      return { ...base, mediaId, status: target.deduped ? 'deduped' : 'skipped' };
    }

    if (dryRun) {
      if (!target.existingId) {
        // Identifiant fictif : les copies suivantes du même fichier sont
        // annoncées comme dédoublonnées, comme lors du passage réel.
        const placeholder = `${DRY_RUN_ID_PREFIX}${target.slug}`;
        processedIds.add(placeholder);
        runByChecksum.set(checksum, { id: placeholder, slug: target.slug });
        return { ...base, mediaId: null, status: 'would_create' };
      }
      processedIds.add(target.existingId);
      runByChecksum.set(checksum, { id: target.existingId, slug: target.slug });
      if (opts.force) return { ...base, mediaId: target.existingId, status: 'would_reprocess' };
      return { ...base, mediaId: target.existingId, status: target.deduped ? 'deduped' : 'skipped' };
    }

    const seed = findComponentSeed(set.componentKey);
    const result = await ingestImageBuffer({
      buffer,
      filename: path.basename(file.relPath),
      slug: target.slug,
      alt: libraryAltFor(alt, itemSlug),
      mime: mimeFromFilename(file.relPath),
      breakpoints: opts.optimize?.breakpoints ?? breakpointsForVariantPolicy(seed?.variantPolicy),
      // Média possiblement partagé (dédoublonnage) entre composants aux
      // politiques différentes : `--force` étend les breakpoints, ne les
      // remplace jamais (cf. `IngestImageInput.breakpointsMode`).
      breakpointsMode: 'union',
      ...(opts.optimize?.formats ? { optimize: { formats: opts.optimize.formats } } : {}),
      // Un média dédoublonné a l'empreinte de sa propre source : identique.
      sourceChecksum: checksum,
      force: !!opts.force,
      actorId,
      ...(opts.storage ? { storage: opts.storage } : {}),
    });
    if (result.status === 'checksum_mismatch') {
      // Impossible en pratique (le fork porte l'empreinte) : on refuse.
      throw new Error(`le média ${target.slug} existe avec un autre contenu`);
    }
    processedIds.add(result.media.id);
    runByChecksum.set(checksum, { id: result.media.id, slug: result.media.slug });
    const status: ImportMediaStatus =
      result.status === 'skipped' && target.deduped ? 'deduped' : result.status;
    return { ...base, slug: result.media.slug, mediaId: result.media.id, status };
  }

  function record(entry: ImportMediaEntry): void {
    switch (entry.status) {
      case 'created':
      case 'would_create':
        report.created.push(entry);
        report.summary.mediaCreated += 1;
        break;
      case 'reprocessed':
      case 'would_reprocess':
        report.reprocessed.push(entry);
        report.summary.mediaReprocessed += 1;
        break;
      case 'deduped':
        report.skipped.push(entry);
        report.summary.mediaDeduped += 1;
        break;
      default:
        report.skipped.push(entry);
        report.summary.mediaSkipped += 1;
    }
    log(`[import] ${entry.status.padEnd(15)} ${entry.relPath} → ${entry.slug}${entry.reason ? ` (${entry.reason})` : ''}`);
  }

  async function componentRow(key: string): Promise<SiteComponent | null> {
    if (!componentCache.has(key)) componentCache.set(key, await getSiteComponentByKey(key));
    return componentCache.get(key) ?? null;
  }

  for (const set of plan.sets) {
    const entry: ImportSetEntry = {
      folder: set.folder,
      componentKey: set.componentKey,
      slot: set.slot,
      variantDim: set.variantDim,
      variantKey: set.variantKey,
      locale: set.locale,
      crossLocale: set.crossLocale,
      items: set.items.length,
      action: 'error',
      status: null,
      setId: null,
      version: null,
    };
    report.sets.push(entry);
    const fail = (code: string, message: string, at: string = set.folder): void => {
      entry.action = 'error';
      entry.error = message;
      report.errors.push({ severity: 'error', code, path: at, message });
    };

    const component = await componentRow(set.componentKey);
    if (!component) {
      fail('component.not_synced', `Composant ${set.componentKey} absent de la base : synchroniser le registre`);
      continue;
    }
    if (!readMediaVariantPolicy(component.metadata)) {
      fail('policy.not_synced', `Politique mediaVariants absente en base pour ${set.componentKey} : synchroniser le registre`);
      continue;
    }

    // 1. Médias.
    const desired: MediaSetItemInput[] = [];
    let mediaFailed = false;
    let unresolved = false;
    for (const item of set.items) {
      const resolved: { desktop: ImportMediaEntry | null; mobile: ImportMediaEntry | null } = {
        desktop: null,
        mobile: null,
      };
      for (const kind of ['desktop', 'mobile'] as const) {
        const file = item[kind];
        if (!file) continue;
        try {
          const media = await importFile(set, file, item.alt, item.slug);
          record(media);
          resolved[kind] = media;
        } catch (e) {
          mediaFailed = true;
          fail('media.ingest_failed', e instanceof Error ? e.message : String(e), file.relPath);
        }
      }
      if (!resolved.desktop?.mediaId || (item.mobile && !resolved.mobile?.mediaId)) unresolved = true;
      desired.push({
        mediaId: resolved.desktop?.mediaId ?? '',
        mobileMediaId: resolved.mobile?.mediaId ?? null,
        alt: item.alt,
      });
    }
    if (mediaFailed) {
      entry.error = 'Ensemble non importé : au moins une image a échoué';
      continue;
    }

    // 2. Ensemble (brouillon, éventuellement publié).
    try {
      const existing = (await listSetsByComponent(component.id)).filter(
        (s) =>
          s.slot === set.slot &&
          s.variantDim === set.variantDim &&
          s.variantKey === set.variantKey &&
          s.locale === set.locale,
      );
      const draft = existing.find((s) => s.status === 'draft') ?? null;
      const published = existing.find((s) => s.status === 'published') ?? null;
      const draftSame = !unresolved && !!draft && sameSetContent(draft, desired, set.crossLocale);
      const publishedSame = !unresolved && !!published && sameSetContent(published, desired, set.crossLocale);

      if (draft && !draftSame && draft.source !== 'import' && !opts.force) {
        fail(
          'set.admin_draft_exists',
          'Un brouillon saisi dans l’admin existe pour cet ensemble : le publier ou l’abandonner, ou relancer avec --force',
        );
        continue;
      }

      if (dryRun) {
        if (draftSame) {
          entry.action = opts.publish ? 'would_publish' : 'unchanged';
          Object.assign(entry, { setId: draft!.id, version: draft!.version, status: 'draft' });
        } else if (!draft && publishedSame) {
          entry.action = 'unchanged';
          Object.assign(entry, { setId: published!.id, version: published!.version, status: 'published' });
        } else {
          entry.action = opts.publish ? 'would_publish' : draft ? 'would_update' : 'would_create';
          entry.setId = draft?.id ?? null;
          entry.status = opts.publish ? 'published' : 'draft';
        }
        continue;
      }

      let target: ComponentMediaSetWithItems;
      if (draftSame) {
        target = draft!;
        entry.action = 'unchanged';
        report.summary.setsUnchanged += 1;
      } else if (!draft && publishedSame) {
        Object.assign(entry, {
          action: 'unchanged',
          setId: published!.id,
          version: published!.version,
          status: 'published',
        });
        report.summary.setsUnchanged += 1;
        log(`[import] set unchanged   ${set.folder} (publié v${published!.version})`);
        continue;
      } else {
        target = await upsertDraftSet({
          componentId: component.id,
          slot: set.slot,
          variantDim: set.variantDim,
          variantKey: set.variantKey,
          locale: set.locale,
          crossLocale: set.crossLocale,
          items: desired,
          source: 'import',
          notes: `import:${set.folder}`,
          authorId: actorId,
          ...(draft ? { expectedUpdatedAt: draft.updatedAt } : {}),
        });
        entry.action = draft ? 'updated' : 'created';
        if (draft) report.summary.setsUpdated += 1;
        else report.summary.setsCreated += 1;
      }
      Object.assign(entry, { setId: target.id, version: target.version, status: 'draft' });

      if (opts.publish) {
        const live = await publishSet({ setId: target.id, actorId });
        Object.assign(entry, { action: 'published', setId: live.id, version: live.version, status: 'published' });
        report.summary.setsPublished += 1;
      }
      log(`[import] set ${entry.action.padEnd(9)} ${set.folder} (${entry.status} v${entry.version})`);
    } catch (e) {
      fail('set.write_failed', e instanceof Error ? e.message : String(e));
    }
  }

  report.summary.errors = report.errors.length;
  report.summary.warnings = report.warnings.length;
  report.durationMs = Date.now() - startedAt.getTime();
  return report;
}
