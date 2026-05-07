# 06 — Seed pipeline `docs/images/values/`

## Objectif

Ingérer les **50 PNG sources** de `docs/images/values/{home,journal,kit,maison,rituel}/`
en :
1. Créant un `Media` par fichier (avec slug stable, alt déduit du doc).
2. Optimisant via le pipeline existant (`optimizeImage`) → variants
   `avif`/`webp` aux breakpoints standards.
3. Stockant les variants via `getStorage()`.
4. Matchant chaque PNG avec un `siteComponent` du registre via une map
   curée (`IMAGE_TO_COMPONENT`).
5. Créant un `componentMediaBinding` (slot `primary` par défaut),
   `isActive=false` (sécurité) sauf si `autoActivate=true`.

## Map `IMAGE_TO_COMPONENT`

> Source de vérité : `apps/web/src/lib/components/seed-mapping.ts`.
> Construit en lisant `docs/images/03-inventaire-images.md` + le registre
> de composants.

```ts
export const IMAGE_TO_COMPONENT: Record<string, BindingHint> = {
  // ┌── home ───────────────────────────────────────────────
  'home/hero-home.png':    { componentKey: 'hero-home', slot: 'primary' },
  'home/og-home.png':      { componentKey: 'og-home', slot: 'primary' },
  'home/mains-ines.png':   { componentKey: 'avis-strip', slot: 'card-1' },
  'home/mains-salma.png':  { componentKey: 'avis-strip', slot: 'card-2' },
  'home/mains-yasmine.png':{ componentKey: 'avis-strip', slot: 'card-3' },

  // ┌── rituel ─────────────────────────────────────────────
  'rituel/hero-lifestyle.png':  { componentKey: 'hero-rituel', slot: 'primary' },
  'rituel/origine-sepia.png':   { componentKey: 'rituel-origine', slot: 'primary' },
  'rituel/portrait-salma.png':  { componentKey: 'interview-salma', slot: 'portrait' },
  'rituel/poster-video.png':    { componentKey: 'video-4-gestes', slot: 'poster' },
  'rituel/og-rituel.png':       { componentKey: 'og-rituel', slot: 'primary' },

  // ┌── kit ────────────────────────────────────────────────
  'kit/kit-principale.png':       { componentKey: 'hero-kit', slot: 'primary' },
  'kit/kit-base.png':             { componentKey: 'product-card-base', slot: 'primary' },
  'kit/kit-fortifiant.png':       { componentKey: 'product-card-fortifiant', slot: 'primary' },
  'kit/kit-lime.png':             { componentKey: 'product-card-lime', slot: 'primary' },
  'kit/kit-detail-mains.png':     { componentKey: 'kit-detail-mains', slot: 'primary' },
  'kit/og-kit.png':               { componentKey: 'og-kit', slot: 'primary' },
  'kit/hands-amal-avant.png':     { componentKey: 'hands-amal', slot: 'avant' },
  'kit/hands-amal-apres.png':     { componentKey: 'hands-amal', slot: 'apres' },
  'kit/hands-lina-avant.png':     { componentKey: 'hands-lina', slot: 'avant' },
  'kit/hands-lina-apres.png':     { componentKey: 'hands-lina', slot: 'apres' },
  'kit/hands-sara-avant.png':     { componentKey: 'hands-sara', slot: 'avant' },
  // sara-apres → fichier manquant, géré dans unmatched

  // ┌── maison ─────────────────────────────────────────────
  'maison/maison-hero.png':      { componentKey: 'hero-maison', slot: 'primary' },
  'maison/fondatrice-mains.png': { componentKey: 'fondatrice-portrait', slot: 'primary' },
  'maison/atelier-1.png':        { componentKey: 'atelier-gallery', slot: 'image-1' },
  'maison/atelier-2.png':        { componentKey: 'atelier-gallery', slot: 'image-2' },
  'maison/atelier-3.png':        { componentKey: 'atelier-gallery', slot: 'image-3' },
  'maison/og-maison.png':        { componentKey: 'og-maison', slot: 'primary' },

  // ┌── journal ────────────────────────────────────────────
  'journal/og-journal.png':              { componentKey: 'og-journal', slot: 'primary' },
  'journal/avril-soleil-bas.png':        { componentKey: 'article-avril-soleil-bas', slot: 'hero' },
  'journal/cinq-minutes-le-soir.png':    { componentKey: 'article-cinq-minutes-le-soir', slot: 'hero' },
  'journal/hiver-ongles-patience.png':   { componentKey: 'article-hiver-ongles-patience', slot: 'hero' },
  'journal/huile-d-argan-vraie.png':     { componentKey: 'article-huile-d-argan-vraie', slot: 'hero' },
  'journal/la-cuisine-comme-laboratoire.png': { componentKey: 'article-la-cuisine-comme-laboratoire', slot: 'hero' },
  'journal/la-maison-au-printemps.png':  { componentKey: 'article-la-maison-au-printemps', slot: 'hero' },
  'journal/la-poudre-de-kaolin.png':     { componentKey: 'article-la-poudre-de-kaolin', slot: 'hero' },
  'journal/la-table-comme-atelier.png':  { componentKey: 'article-la-table-comme-atelier', slot: 'hero' },
  'journal/matieres-d-ailleurs.png':     { componentKey: 'article-matieres-d-ailleurs', slot: 'hero' },
  'journal/pluie-de-mars.png':           { componentKey: 'article-pluie-de-mars', slot: 'hero' },
  'journal/ranger-son-rituel.png':       { componentKey: 'article-ranger-son-rituel', slot: 'hero' },
  'journal/visiter-l-atelier.png':       { componentKey: 'article-visiter-l-atelier', slot: 'hero' },
  'journal/voix-d-amal.png':             { componentKey: 'article-voix-d-amal', slot: 'hero' },
  'journal/voix-de-lina.png':            { componentKey: 'article-voix-de-lina', slot: 'hero' },
  'journal/voix-de-sara.png':            { componentKey: 'article-voix-de-sara', slot: 'hero' },
};
```

Les `og-*` sont des composants "virtuels" qui décrivent les images
Open Graph (consommées par `metadata.openGraph.images` du layout).

## Slug et collisions

```ts
slug = `${pageGroup}-${basenameWithoutExt}`
     = ex: 'home-hero-home', 'kit-hands-amal-avant'
```

Si un media avec ce slug existe déjà :
- `force=false` (défaut) → skip + count `imported=0`
- `force=true` → soft-delete l'ancien, ré-upload, regen variants

## Pipeline complet (pseudo-code)

```ts
async function seedFromDocs(opts: { force; autoActivate; pageGroup? }): Promise<SeedResult> {
  await ensureRegistrySynced();              // upsert siteComponents depuis registry.ts
  await ensureAnimationsSeeded();            // upsert componentAnimations
  const files = scanDocsValues(opts.pageGroup);
  const result = { imported: 0, skipped: 0, matched: 0, unmatched: 0, ... };

  for (const file of files) {
    const slug = buildSlug(file);
    const existing = await findMediaBySlug(slug);

    if (existing && !opts.force) {
      // déjà ingéré
    } else {
      const buffer = await fs.readFile(file.absolutePath);
      const validated = await validateUpload(buffer, 'image');
      const media = await createMedia({
        slug,
        kind: 'image',
        source: 'upload',
        originalUrl: '',          // rempli par optimize
        originalFilename: file.basename,
        originalSizeBytes: validated.sizeBytes,
        originalMime: validated.mime,
        alt: deriveAlt(file),     // depuis 03-inventaire-images.md (lookup)
        qualityProfile: derivQualityProfile(file),  // hero|inline|thumb
        loadingStrategy: 'viewport',
        status: 'processing',
      });
      const optimizeResult = await optimizeImage({
        mediaId: media.id,
        buffer,
        mime: validated.mime,
      });
      // crée variants dans la DB
      for (const v of optimizeResult.variants) {
        await createVariant(v);
      }
      await updateMedia(media.id, {
        originalUrl: optimizeResult.originalUrl,
        originalWidth: optimizeResult.width,
        originalHeight: optimizeResult.height,
        blurhash: optimizeResult.blurhash,
        palette: optimizeResult.palette,
        phash: optimizeResult.phash,
        status: 'ready',
      });
      result.imported += 1;
    }

    // Bind to component
    const hint = IMAGE_TO_COMPONENT[file.relativePath];
    if (!hint) { result.unmatched += 1; continue; }
    const component = await findComponentByKey(hint.componentKey);
    if (!component) { result.unmatched += 1; continue; }
    await upsertBinding({
      componentId: component.id,
      slot: hint.slot,
      mediaId: existing?.id ?? media.id,
      isActive: opts.autoActivate ?? false,
      priority: component.defaultLoadingStrategy === 'eager',
      loadingStrategy: component.defaultLoadingStrategy,
      fetchPriority: component.defaultFetchPriority,
    });
    result.matched += 1;
    result.bindingsCreated += 1;
  }

  await auditTrackingChange({
    action: 'seed',
    resource: 'component_media_binding',
    resourceId: 'docs-images-values',
    actorId: session.adminId,
    meta: result,
  });

  return result;
}
```

## Dérivation `alt` depuis le doc

`docs/images/03-inventaire-images.md` contient pour chaque image une
section "Doit incarner". On parse ce markdown au build et on génère
`apps/web/src/lib/components/seed-alt.ts` (TS const), un map
`relativePath → altShort`.

Exemple :
```ts
export const IMAGE_ALT_HINTS: Record<string, string> = {
  'home/hero-home.png': 'Une main au calme posée sur du lin beige, l\'autre approche un pot ambré',
  // ...
};
```

Si pas de hint, `alt` reste vide (admin doit le compléter).

## CLI alternatif

Pour CI / dev local, on expose un script :

```bash
pnpm --filter @femiglow/web seed:components --force --auto-activate
```

Qui appelle la même fonction que la route admin (sans HTTP), via
`scripts/seed-components.ts`.

## Idempotence

| Cas                              | Comportement                                  |
|----------------------------------|-----------------------------------------------|
| Re-run sans `force`              | `imported=0`, `bindingsUpdated` pour conf     |
| Re-run avec `force`              | Re-upload + variants regénérées               |
| Fichier supprimé de docs/        | Media reste (audit), binding reste, admin doit unbind manuellement |
| Nouveau fichier ajouté           | Ingéré, binding créé si dans la map           |
| Composant sans slot dans le code | Binding créé en DB mais aucune UI ne l'utilise — admin warning |
