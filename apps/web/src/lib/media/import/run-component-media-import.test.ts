/**
 * Tests d'intégration — import des images générées contre le memoryStore,
 * avec de vraies petites images PNG (sharp) écrites dans un dossier
 * temporaire et un stockage mémoire.
 *
 * Couvre : passage à blanc sans écriture, création des médias (variants,
 * flou, empreinte) et des brouillons `source = 'import'`, dédoublonnage des
 * copies octet pour octet, second passage idempotent, `--publish`, fichier
 * modifié (nouveau média, l'ancien intact), brouillon admin protégé
 * (sauf `--force`), dossier invalide isolé, composant non synchronisé.
 */
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { memoryStore, resetMemoryStore } from '@/lib/db/client';
import { findMediaById, findMediaBySlug } from '@/lib/db/queries/media';
import { listVariants } from '@/lib/db/queries/media-variants';
import {
  listPublishedSetsWithMedia,
  listSetHistory,
  listSetsByComponent,
  upsertDraftSet,
} from '@/lib/db/queries/component-media-sets';
import { upsertSiteComponentFromSeed } from '@/lib/db/queries/site-components';
import { findComponentSeed } from '@/lib/components/registry';
import type { StorageAdapter } from '@/lib/media/storage';
import { createAdmin } from '@/lib/db/queries/admin-users';
import {
  ImportActorError,
  runComponentMediaImport,
  sameSetContent,
  type ComponentMediaImportOptions,
} from './run-component-media-import';

const KIT = 'kit-hero-produit';
const ALT = { fr: 'Ongles brillants', ar: 'أظافر لامعة', en: 'Shiny nails' };

function memStorage(): StorageAdapter & { files: Map<string, Buffer> } {
  const files = new Map<string, Buffer>();
  return {
    driver: 'local',
    files,
    async put({ key, body }) {
      files.set(key, body);
      return { key, url: `mem://${key}`, sizeBytes: body.byteLength };
    },
    async delete(key) {
      files.delete(key);
    },
    publicUrl(key) {
      return `mem://${key}`;
    },
    async get(key) {
      const f = files.get(key);
      if (!f) throw new Error(`absent: ${key}`);
      return f;
    },
  };
}

/** PNG uni, couleur = contenu (deux couleurs → deux empreintes). */
async function png(color: string, width = 24, height = 30): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: color } }).png().toBuffer();
}

let root: string;
let storage: ReturnType<typeof memStorage>;
let componentId: string;

async function put(rel: string, body: Buffer | string): Promise<void> {
  const abs = path.join(root, rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, body);
}

/**
 * Arborescence type :
 *  - primary/angle-e/_all : 1 image + mobile + alt ;
 *  - secondary/angle-e/_all : 01 propre à l'angle, 02 = copie de default/01 ;
 *  - secondary/default/_all : 01 + mobile, alts via `_alt.json` global ;
 *  - primary/angle-z/_all : clé d'angle invalide (erreur isolée) ;
 *  - _work/ : masters bruts, ignorés.
 */
async function buildTree(): Promise<void> {
  const kitInHand = await png('#d0b090');
  const kitInHandMobile = await png('#d0b091', 24, 32);
  await put(`${KIT}/primary/angle-e/_all/01-fini-salon.png`, await png('#f0c0c0'));
  await put(`${KIT}/primary/angle-e/_all/01-fini-salon.mobile.png`, await png('#f0c0c1', 24, 32));
  await put(`${KIT}/primary/angle-e/_all/01-fini-salon.alt.json`, JSON.stringify(ALT));

  await put(`${KIT}/secondary/angle-e/_all/01-salon-vs-maison.png`, await png('#a0a0f0'));
  await put(`${KIT}/secondary/angle-e/_all/01-salon-vs-maison.alt.json`, JSON.stringify(ALT));
  await put(`${KIT}/secondary/angle-e/_all/02-kit-en-main.png`, kitInHand);
  await put(`${KIT}/secondary/angle-e/_all/02-kit-en-main.mobile.png`, kitInHandMobile);
  await put(`${KIT}/secondary/angle-e/_all/02-kit-en-main.alt.json`, JSON.stringify(ALT));

  await put(`${KIT}/secondary/default/_all/01-kit-en-main.png`, kitInHand);
  await put(`${KIT}/secondary/default/_all/01-kit-en-main.mobile.png`, kitInHandMobile);
  await put(`${KIT}/secondary/default/_all/_alt.json`, JSON.stringify({ fr: 'Kit en main', en: 'Kit in hand', ar: 'الكيت في اليد' }));

  await put(`${KIT}/primary/angle-z/_all/01-x.png`, await png('#000000'));
  await put('_work/HP-1/master.png', await png('#ffffff'));
  await put('_log.csv', 'id,file\n');
}

function run(overrides: Partial<ComponentMediaImportOptions> = {}) {
  return runComponentMediaImport({
    root,
    componentKey: KIT,
    storage,
    optimize: { breakpoints: ['sm'], formats: ['webp'] },
    ...overrides,
  });
}

async function setsByFolder() {
  const sets = await listSetsByComponent(componentId);
  return sets;
}

beforeEach(async () => {
  resetMemoryStore();
  storage = memStorage();
  root = await mkdtemp(path.join(os.tmpdir(), 'cmv-import-'));
  componentId = (await upsertSiteComponentFromSeed(findComponentSeed(KIT)!)).id;
  await buildTree();
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('runComponentMediaImport', () => {
  it('--dry-run : n’écrit rien, annonce créations et dédoublonnage', async () => {
    const report = await run({ dryRun: true });
    expect(memoryStore().media.size).toBe(0);
    expect(storage.files.size).toBe(0);
    expect(await listSetsByComponent(componentId)).toEqual([]);

    // 7 fichiers image valides dont 2 copies (kit en main desktop + mobile).
    expect(report.summary).toMatchObject({ files: 7, mediaCreated: 5, mediaDeduped: 2, sets: 3 });
    expect(report.sets.map((s) => s.action)).toEqual(['would_create', 'would_create', 'would_create']);
    expect(report.errors.map((e) => e.code)).toEqual(['variant.key_invalid']);
    expect(report.ignored).toEqual(expect.arrayContaining(['_work/', '_log.csv']));
  });

  it('crée médias (ready, variants, flou, empreinte) et brouillons import, sans publier', async () => {
    const report = await run();
    expect(report.summary).toMatchObject({
      files: 7,
      mediaCreated: 5,
      mediaDeduped: 2,
      setsCreated: 3,
      setsPublished: 0,
    });
    expect(report.errors.map((e) => e.code)).toEqual(['variant.key_invalid']);

    const primary = await findMediaBySlug('cmv-kit-hero-produit-primary-angle-e-all-01-fini-salon');
    expect(primary).toMatchObject({ status: 'ready', alt: ALT.fr, originalMime: 'image/png' });
    expect(primary?.blurDataUrl).toMatch(/^data:image\/webp;base64,/);
    expect(primary?.overrides.sourceChecksum).toMatch(/^sha256-[0-9a-f]{64}$/);
    expect(await listVariants(primary!.id)).toHaveLength(1);

    // Copie octet pour octet : un seul média, créé par le premier dossier
    // rencontré (ordre lexical : angle-e avant default), réutilisé ensuite.
    expect(await findMediaBySlug('cmv-kit-hero-produit-secondary-angle-e-all-02-kit-en-main')).not.toBeNull();
    expect(await findMediaBySlug('cmv-kit-hero-produit-secondary-default-all-01-kit-en-main')).toBeNull();
    expect(report.skipped.filter((s) => s.status === 'deduped').map((s) => s.relPath)).toEqual([
      `${KIT}/secondary/default/_all/01-kit-en-main.png`,
      `${KIT}/secondary/default/_all/01-kit-en-main.mobile.png`,
    ]);

    const sets = await setsByFolder();
    expect(sets).toHaveLength(3);
    expect(sets.every((s) => s.status === 'draft' && s.source === 'import' && s.crossLocale && s.locale === '*')).toBe(true);
    expect(await listPublishedSetsWithMedia(componentId)).toEqual([]);

    const angleSecondary = sets.find((s) => s.slot === 'secondary' && s.variantKey === 'e')!;
    const defaultSecondary = sets.find((s) => s.slot === 'secondary' && s.variantDim === 'default')!;
    expect(angleSecondary.items).toHaveLength(2);
    expect(angleSecondary.items[0]?.mobileMediaId).toBeNull();
    expect(angleSecondary.items[1]?.mediaId).toBe(defaultSecondary.items[0]?.mediaId);
    expect(angleSecondary.items[1]?.mobileMediaId).toBe(defaultSecondary.items[0]?.mobileMediaId);
    expect(angleSecondary.items[1]?.alt).toEqual(ALT);
    expect(defaultSecondary.items[0]?.alt).toEqual({ fr: 'Kit en main', en: 'Kit in hand', ar: 'الكيت في اليد' });
    const mobile = await findMediaById(defaultSecondary.items[0]!.mobileMediaId!);
    expect(mobile?.slug).toBe('cmv-kit-hero-produit-secondary-angle-e-all-02-kit-en-main-mobile');
  });

  it('second passage idempotent : tout est ignoré, aucun ensemble réécrit', async () => {
    await run();
    const mediaCount = memoryStore().media.size;
    const before = await setsByFolder();
    const historyBefore = await Promise.all(before.map((s) => listSetHistory(s)));

    const report = await run();
    expect(report.summary).toMatchObject({
      mediaCreated: 0,
      mediaReprocessed: 0,
      mediaSkipped: 5,
      mediaDeduped: 2,
      setsCreated: 0,
      setsUpdated: 0,
      setsUnchanged: 3,
    });
    expect(memoryStore().media.size).toBe(mediaCount);
    const after = await setsByFolder();
    expect(after.map((s) => [s.id, s.version, s.updatedAt])).toEqual(before.map((s) => [s.id, s.version, s.updatedAt]));
    expect(await Promise.all(after.map((s) => listSetHistory(s)))).toEqual(historyBefore);
  });

  it('--force ré-optimise les médias existants sans en créer', async () => {
    await run();
    const mediaCount = memoryStore().media.size;
    const report = await run({ force: true });
    expect(report.summary).toMatchObject({ mediaCreated: 0, mediaReprocessed: 5, mediaDeduped: 2, setsUnchanged: 3 });
    expect(memoryStore().media.size).toBe(mediaCount);
  });

  it('--publish publie les ensembles ; relancé, il ne change plus rien', async () => {
    await run();
    const report = await run({ publish: true });
    expect(report.summary).toMatchObject({ setsPublished: 3, setsCreated: 0 });
    expect(report.sets.filter((s) => s.action !== 'error').every((s) => s.action === 'published' && s.status === 'published')).toBe(true);
    const published = await listPublishedSetsWithMedia(componentId);
    expect(published).toHaveLength(3);

    const again = await run({ publish: true });
    expect(again.summary).toMatchObject({ setsPublished: 0, setsUnchanged: 3, setsCreated: 0 });
    expect((await setsByFolder()).filter((s) => s.status === 'draft')).toEqual([]);
  });

  it('--publish dès le premier passage', async () => {
    const report = await run({ publish: true });
    expect(report.summary).toMatchObject({ setsCreated: 3, setsPublished: 3 });
    expect(await listPublishedSetsWithMedia(componentId)).toHaveLength(3);
  });

  it('fichier modifié : nouveau média (slug suffixé), l’ancien reste intact et publié', async () => {
    await run({ publish: true });
    const oldMedia = await findMediaBySlug('cmv-kit-hero-produit-primary-angle-e-all-01-fini-salon');
    await put(`${KIT}/primary/angle-e/_all/01-fini-salon.png`, await png('#10a010'));

    const report = await run();
    const changed = report.created.find((c) => c.relPath.endsWith('01-fini-salon.png'))!;
    expect(changed.slug).toMatch(/^cmv-kit-hero-produit-primary-angle-e-all-01-fini-salon-[0-9a-f]{8}$/);
    expect(changed.reason).toMatch(/fichier modifié/);
    expect(await findMediaById(oldMedia!.id)).toMatchObject({
      slug: oldMedia!.slug,
      overrides: { sourceChecksum: oldMedia!.overrides.sourceChecksum },
    });

    const primarySets = (await setsByFolder()).filter((s) => s.slot === 'primary');
    const draft = primarySets.find((s) => s.status === 'draft')!;
    const live = primarySets.find((s) => s.status === 'published')!;
    expect(draft.items[0]?.mediaId).toBe(changed.mediaId);
    expect(live.items[0]?.mediaId).toBe(oldMedia!.id);
    expect(report.summary).toMatchObject({ setsCreated: 1, setsUnchanged: 2 });

    // Relancé : le média forké est retrouvé, plus rien ne bouge.
    const again = await run();
    expect(again.summary).toMatchObject({ mediaCreated: 0, setsUnchanged: 3 });
  });

  it('protège un brouillon saisi dans l’admin, sauf --force', async () => {
    await run({ publish: true });
    const live = (await setsByFolder()).find((s) => s.slot === 'primary')!;
    await upsertDraftSet({
      componentId,
      slot: 'primary',
      variantDim: 'angle',
      variantKey: 'e',
      locale: '*',
      crossLocale: true,
      items: [{ mediaId: live.items[0]!.mediaId, alt: { fr: 'Retouché dans l’admin' } }],
      authorId: null,
    });

    const report = await run();
    expect(report.errors.map((e) => e.code)).toContain('set.admin_draft_exists');
    const primaryEntry = report.sets.find((s) => s.slot === 'primary')!;
    expect(primaryEntry.action).toBe('error');
    const draft = (await setsByFolder()).find((s) => s.slot === 'primary' && s.status === 'draft')!;
    expect(draft.items[0]?.alt).toEqual({ fr: 'Retouché dans l’admin' });

    const forced = await run({ force: true });
    expect(forced.sets.find((s) => s.slot === 'primary')?.action).toBe('updated');
    const replaced = (await setsByFolder()).find((s) => s.slot === 'primary' && s.status === 'draft')!;
    expect(replaced.items[0]?.alt).toEqual(ALT);
    expect(replaced.source).toBe('import');
  });

  it('--force sur un média partagé : les breakpoints s’ajoutent, ne se remplacent pas', async () => {
    // Premier import avec une politique « miniature » (autre composant fictif).
    await run({ optimize: { breakpoints: ['xs'], formats: ['webp'] } });
    const shared = await findMediaBySlug('cmv-kit-hero-produit-secondary-angle-e-all-02-kit-en-main');
    expect(shared?.overrides.breakpoints).toEqual(['xs']);

    await run({ force: true, optimize: { breakpoints: ['md'], formats: ['webp'] } });
    const after = await findMediaById(shared!.id);
    expect(after?.overrides.breakpoints).toEqual(['xs', 'md']);
    const bps = new Set((await listVariants(shared!.id)).map((v) => v.breakpoint));
    expect(bps).toEqual(new Set(['xs', 'md']));
  });

  it('--actor : id ou e-mail d’un admin existant → auteur des médias et ensembles', async () => {
    const admin = await createAdmin({ email: 'ops@femiglow.test', passwordHash: 'x', name: 'Ops' });
    await run({ actorId: admin.id });
    const media = await findMediaBySlug('cmv-kit-hero-produit-primary-angle-e-all-01-fini-salon');
    expect(media?.createdBy).toBe(admin.id);
    expect((await setsByFolder()).every((s) => s.authorId === admin.id)).toBe(true);

    resetMemoryStore();
    componentId = (await upsertSiteComponentFromSeed(findComponentSeed(KIT)!)).id;
    const again = await createAdmin({ email: 'ops@femiglow.test', passwordHash: 'x', name: 'Ops' });
    await run({ actorId: 'OPS@femiglow.test' });
    expect((await findMediaBySlug('cmv-kit-hero-produit-primary-angle-e-all-01-fini-salon'))?.createdBy).toBe(again.id);
  });

  it('--actor invalide ou inconnu : refus avant toute écriture (y compris à blanc)', async () => {
    await expect(run({ actorId: 'u_inexistant' })).rejects.toThrow(ImportActorError);
    await expect(run({ actorId: 'u_inexistant' })).rejects.toThrow(/admin introuvable/);
    await expect(run({ actorId: 'pas un id' })).rejects.toThrow(/format invalide/);
    await expect(run({ actorId: 'personne@femiglow.test' })).rejects.toThrow(/aucun admin/);
    await expect(run({ actorId: 'u_inexistant', dryRun: true })).rejects.toThrow(ImportActorError);
    expect(memoryStore().media.size).toBe(0);
    expect(storage.files.size).toBe(0);
    expect(await listSetsByComponent(componentId)).toEqual([]);
  });

  it('composant absent de la base : erreur par ensemble, aucun média créé', async () => {
    resetMemoryStore();
    const report = await run();
    expect(report.sets.every((s) => s.action === 'error')).toBe(true);
    expect(report.errors.filter((e) => e.code === 'component.not_synced')).toHaveLength(3);
    expect(memoryStore().media.size).toBe(0);
  });

  it('racine introuvable : lève une erreur', async () => {
    await expect(run({ root: path.join(root, 'absent') })).rejects.toThrow(/racine introuvable/);
  });
});

describe('sameSetContent', () => {
  const base = {
    crossLocale: true,
    items: [
      { position: 0, mediaId: 'a', mobileMediaId: 'am', alt: { fr: 'A', en: 'A' } },
      { position: 1, mediaId: 'b', mobileMediaId: null, alt: {} },
    ],
  } as unknown as Parameters<typeof sameSetContent>[0];

  it('compare médias, mobiles, alts (ordre des clés indifférent) et crossLocale', () => {
    const desired = [
      { mediaId: 'a', mobileMediaId: 'am', alt: { en: 'A', fr: 'A' } },
      { mediaId: 'b', alt: {} },
    ];
    expect(sameSetContent(base, desired, true)).toBe(true);
    expect(sameSetContent(base, desired, false)).toBe(false);
    expect(sameSetContent(base, [desired[0]!], true)).toBe(false);
    expect(sameSetContent(base, [{ ...desired[0]!, mobileMediaId: null }, desired[1]!], true)).toBe(false);
    expect(sameSetContent(base, [{ ...desired[0]!, alt: { fr: 'B' } }, desired[1]!], true)).toBe(false);
  });
});
