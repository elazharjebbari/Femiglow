# 10 — Critères d'acceptation et non-régression

Checklist exhaustive pour valider chaque phase et garantir l'absence de régression. À utiliser en revue de PR et en smoke test post-déploiement.

## 1. Critères globaux (toute phase)

Avant merge :

- [ ] `pnpm typecheck` clean.
- [ ] `pnpm lint` clean.
- [ ] `pnpm vitest run` 100 % vert (zéro échec, hors fails pré-existants documentés).
- [ ] `pnpm playwright test --grep '@seo'` 100 % vert.
- [ ] Couverture `lib/seo/**` ≥ 90 % branches.
- [ ] Couverture `components/admin/seo/**` ≥ 85 % branches.
- [ ] Pas de nouvel `eslint-disable` non commenté.
- [ ] Pas de `console.log` oublié.
- [ ] Pas de `TODO` non lié à un ticket.
- [ ] Commits suivant la convention `feat(seo)` ou `fix(seo)` avec message clair.

## 2. Phase 0 — Hot patches

### 2.1 Acceptation

- [ ] `/commander` retourne `<title>Commander — FemiGlow</title>`.
- [ ] `/commander` contient `<meta name="robots" content="noindex,follow">` ou équivalent (selon serialization Next).
- [ ] `/commander` contient `<link rel="canonical" href="https://femiglow.ma/commander">` (ou path relatif).
- [ ] `/merci` retourne `<title>Merci pour votre commande — FemiGlow</title>`.
- [ ] `/merci` contient `<meta name="robots" content="noindex,nofollow">`.
- [ ] `SeoBulkActionBar` ouvre `BulkDeleteConfirmDialog` sur clic « Supprimer N items ».
- [ ] La modale désactive le bouton de confirmation tant que la saisie ne correspond pas exactement au nombre attendu.
- [ ] Après confirmation, l'API delete est appelée et le toast success s'affiche.
- [ ] La modale est fermable via `Esc` et bouton « Annuler ».

### 2.2 Non-régression

- [ ] Les autres routes commerce conservent leur metadata existant.
- [ ] Le panier `/panier` continue d'avoir son `robots: noindex` existant.
- [ ] Les actions SEO non-delete (publish, unpublish) ne déclenchent pas la modale.
- [ ] Tests existants `SeoBulkActionBar.test.tsx` continuent de passer.

### 2.3 Smoke test post-déploiement

```bash
curl -s https://femiglow.ma/commander | grep -i '<title>'
curl -s https://femiglow.ma/merci | grep -i '<title>'
```

Résultat attendu : titres distincts et corrects.

---

## 3. Phase 1 — Sitemap freshness

### 3.1 Acceptation

- [ ] `app/sitemap.ts` retourne pour chaque article un `lastModified` égal à `article.updatedAt` (date réelle).
- [ ] `app/sitemap.ts` retourne pour chaque legal page un `lastModified` égal à `page.updatedAt`.
- [ ] Les routes statiques (`/`, `/kit`, `/rituel`, `/journal`, `/maison`, `/contact`) ont un `lastModified` égal à `NEXT_PUBLIC_BUILD_DATE` (constant entre déploiements identiques).
- [ ] `next.config.js` expose `NEXT_PUBLIC_BUILD_DATE` au build.
- [ ] Le fichier XML retourné par `/sitemap.xml` est valide (XSD W3C).
- [ ] Le nombre de URLs dans le sitemap correspond au nombre attendu (statiques + articles publiés + legal indexables).

### 3.2 Non-régression

- [ ] L'ordre des routes dans le sitemap est stable (déterminisme).
- [ ] Aucune URL non publiée ne fuit dans le sitemap.
- [ ] `priority` et `changeFrequency` des routes existantes inchangées.

### 3.3 Smoke test

```bash
curl -s https://femiglow.ma/sitemap.xml | grep -c '<url>'
# Doit matcher le nombre de pages publiées + statiques

curl -s https://femiglow.ma/sitemap.xml | xmllint --noout -
# Doit retourner 0 (valide XML)
```

---

## 4. Phase 2 — Media picker OG

### 4.1 Acceptation

- [ ] `OgImagePicker` affiche 3 radios (none, media, template) si flag dynamic actif.
- [ ] `OgImagePicker` affiche 2 radios (none, media) si flag dynamic inactif.
- [ ] La sélection « media » ouvre `MediaPickerDialog` au clic « Parcourir ».
- [ ] La sélection d'une image met à jour `value.mediaId` et affiche l'aperçu.
- [ ] La sélection « template » expose template/eyebrow/theme.
- [ ] Le preview Facebook reflète immédiatement le choix (image custom ou template).
- [ ] L'éditeur SEO peut sauvegarder un override avec `ogImageMediaId` non null.
- [ ] L'éditeur SEO peut sauvegarder un override avec `ogImageTemplate` défini.
- [ ] Recharger la page après save → la valeur persiste.
- [ ] A11y : `@axe-core/playwright` 0 violations sur `/admin/seo/new` et `/admin/seo/[id]`.

### 4.2 Non-régression

- [ ] Tous les overrides existants en DB restent éditables (rétro-compat : ancien input `ogImageMediaId` géré par le mode `media`).
- [ ] Les tests existants `SeoOverrideEditor.test.tsx` passent.
- [ ] Le preview Facebook fonctionne toujours si `ogImageMediaId` est null (fallback settings).

### 4.3 Smoke test

```
1. /admin/seo/new
2. Saisir scope=product, targetKey=test-smoke
3. Sélectionner mode media, ouvrir picker, choisir une image
4. Save -> success toast
5. Recharger la page -> l'image est sélectionnée
6. Publier -> success
7. /api/_debug/seo?route=/test-smoke -> ogImage.url non null
8. Cleanup : supprimer l'override de test
```

---

## 5. Phase 3 — Audit log panel

### 5.1 Acceptation

- [ ] `/admin/seo/audit-log` accessible et liste les 20 derniers events scope SEO.
- [ ] Chaque event affiche date locale, actor, action, target.
- [ ] Filtre action (`publish`, `unpublish`, `delete`, `update`, `create`) fonctionne et persiste dans l'URL (`?action=publish`).
- [ ] Filtre actor fonctionne.
- [ ] Pagination cursor « Charger plus » charge les 20 suivants.
- [ ] État vide affiche le message conforme microcopy.
- [ ] Lien depuis `/admin/seo` (liste overrides) vers `/admin/seo/audit-log` présent.

### 5.2 Non-régression

- [ ] `auditEvents` table inchangée structurellement.
- [ ] Aucun nouvel event créé par le panel lui-même (lecture seule).
- [ ] Permissions admin requises (401 sans session).

### 5.3 Smoke test

```
1. Connecté admin, publier un override (depuis /admin/seo/<id>)
2. Naviguer /admin/seo/audit-log
3. Vérifier que l'event "publish" apparaît en tête de liste
4. Filtrer par action=publish -> seuls les publishes
5. Cliquer "Charger plus" -> 20 supplémentaires chargés
```

---

## 6. Phase 4 — OG image dynamique

### 6.1 Acceptation

- [ ] `/api/og/marketing?title=Test` retourne `200 OK`, `Content-Type: image/png`, image 1200×630.
- [ ] `/api/og/article?title=Test&eyebrow=Journal` retourne idem.
- [ ] `/api/og/product?title=Le%20Kit&theme=sauge` retourne idem avec teinte sauge.
- [ ] `/api/og/default` retourne template par défaut.
- [ ] Query param manquant ou invalide retourne `400 Bad Request`.
- [ ] Header `Cache-Control` contient `public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000`.
- [ ] Taille de l'image générée ≤ 200 KB (PNG compressé).
- [ ] Polices Inter et Cormorant Garamond rendues correctement (visuel).
- [ ] Latence P95 cache miss ≤ 800 ms en local, ≤ 1 s en edge.
- [ ] Latence P95 cache hit ≤ 50 ms.
- [ ] Feature flag `NEXT_PUBLIC_SEO_OG_DYNAMIC=false` désactive complètement la route (404) ou la garde silencieuse selon implementation — à décider en phase 4.

### 6.2 Non-régression

- [ ] Les OG images statiques `/og/*.svg` continuent d'être servies si `ogImageMediaId` null et template non utilisé.
- [ ] Le fallback dans `resolveOgImageForRoute` retourne le SVG si `flag=false`.
- [ ] Aucune page existante ne perd son OG image actuel.

### 6.3 Smoke test

```bash
curl -I "https://femiglow.ma/api/og/product?title=Le%20Kit&v=2026-05"
# Status 200, Content-Type image/png

# Tester via Facebook Debugger
# https://developers.facebook.com/tools/debug/?q=https://femiglow.ma/kit
```

---

## 7. Phase 5 — Scope component branché

### 7.1 Acceptation

- [ ] `resolvePageWithComponents('product', 'le-kit', [{componentKey: 'kit-hero'}])` retourne metadata fusionné.
- [ ] Avec flag `false`, le metadata de `/kit` est strictement identique au snapshot pré-phase.
- [ ] Avec flag `true` et aucun override composant, idem identique au snapshot.
- [ ] Avec flag `true` et override composant publié, le title du composant écrase celui du produit (champs configurés en `overridableFields`).
- [ ] Publication d'un override `scope=component` déclenche `revalidateTag` sur la page parente correspondante.
- [ ] `getActiveComponentOverrides` exécute **une seule requête SQL** quel que soit le nombre de composants.
- [ ] L'endpoint `/api/_debug/seo?route=/kit` retourne `componentOverrides` listant les composants résolus.

### 7.2 Non-régression critique

- [ ] **Snapshot `/kit` metadata strictement inchangé** quand `NEXT_PUBLIC_SEO_COMPONENT_OVERRIDES=false`.
- [ ] **Snapshot JSON-LD `/kit` strictement inchangé** dans tous les cas (le composant n'écrase pas structuredData par défaut).
- [ ] Test Playwright existant `e2e/seo/json-ld.spec.ts` passe.
- [ ] Pages autres que `/kit` non encore branchées au composant scope conservent leur metadata.

### 7.3 Smoke test

```bash
# Flag OFF
NEXT_PUBLIC_SEO_COMPONENT_OVERRIDES=false pnpm --filter web build
curl -s http://localhost:3000/kit | grep -E '<title>|name="description"' > /tmp/kit-off.txt

# Flag ON sans override
NEXT_PUBLIC_SEO_COMPONENT_OVERRIDES=true pnpm --filter web build
curl -s http://localhost:3000/kit | grep -E '<title>|name="description"' > /tmp/kit-on.txt

diff /tmp/kit-off.txt /tmp/kit-on.txt
# Doit être vide

# Avec override composant : voir runbook §5.6
```

---

## 8. Phase 6 — Backlog

Critères à formaliser au moment de l'implémentation. Modèle :

### 8.1 F-09 Cache-Control HTML

- [ ] Réponse HTML `/` contient `Cache-Control: public, max-age=60, s-maxage=600, stale-while-revalidate=86400`.
- [ ] Réponse admin `/admin/*` conserve `Cache-Control: no-store, max-age=0`.
- [ ] Réponse API conserve son header existant.

### 8.2 F-10 Canonical normalisation

- [ ] `/kit/` (avec slash) redirige 301 vers `/kit`.
- [ ] `/kit?utm_source=email` redirige 301 vers `/kit` (sauf en mode tracking-first).
- [ ] Aucun loop de redirect.

### 8.3 F-11 UI hreflang

- [ ] L'éditeur SEO expose une section « Alternates par locale ».
- [ ] La saisie persiste et est exposée dans `Metadata.alternates.languages`.

### 8.4 F-12 Sitemap viewer

- [ ] `/admin/seo/settings` affiche une section read-only listant les URLs du sitemap et leurs `lastModified`.

### 8.5 F-13 Snapshot diff

- [ ] Sélection de 2 snapshots dans `SeoHistoryPanel` affiche un diff JSON colorisé.
- [ ] Le diff est exportable en CSV ou texte brut.

---

## 9. Critères de non-régression globaux

### 9.1 Métadonnées critiques

Pour chaque route ci-dessous, **avant** et **après** chaque phase, les valeurs doivent être stables (sauf si la phase modifie explicitement la route) :

| Route | Title | Description | OG image | Canonical |
|---|---|---|---|---|
| `/` | Home FemiGlow | desc home | OG static or override | `/` |
| `/kit` | Kit override | desc kit | OG product | `/kit` |
| `/rituel` | Rituel override | desc rituel | OG marketing | `/rituel` |
| `/journal` | Journal | desc journal | OG marketing | `/journal` |
| `/journal/[slug]` | Article title | Article excerpt | Article featured | `/journal/<slug>` |
| `/maison` | Maison | desc maison | OG static | `/maison` |
| `/contact` | Contact | desc contact | OG static | `/contact` |
| `/commander` (post phase 0) | Commander — FemiGlow | desc commander | OG static | `/commander` |
| `/merci` (post phase 0) | Merci pour votre commande — FemiGlow | desc merci | OG static | `/merci` |
| `/panier` | (existant) | (existant) | (existant) | `/panier` |

### 9.2 JSON-LD

- [ ] `/kit` contient `Product` JSON-LD valide (Rich Results Test green).
- [ ] `/kit` contient `FAQPage` JSON-LD valide.
- [ ] `/rituel` contient `HowTo` JSON-LD valide.
- [ ] `/journal` contient `Blog` + `BlogPosting[]`.
- [ ] `/journal/<slug>` contient `BlogPosting` + `BreadcrumbList`.
- [ ] `/maison` contient `LocalBusiness` + `Organization`.
- [ ] `/contact` contient `ContactPoint`.
- [ ] Layout root contient `Organization` + `WebSite`.

### 9.3 Sitemap et robots

- [ ] `/sitemap.xml` retourne toutes les routes publiées attendues.
- [ ] `/robots.txt` contient les disallow attendus (`/api/`, `/admin/`, `/panier`, `/commander`, `/merci`).
- [ ] `/robots.txt` exclut explicitement GPTBot, CCBot, ClaudeBot, Google-Extended.
- [ ] `/robots.txt` référence `sitemap.xml` et `host`.

### 9.4 Headers HTTP

- [ ] `/admin/*` retourne `x-robots-tag: noindex, nofollow`.
- [ ] `/_next/static/*` retourne `Cache-Control: public, max-age=31536000, immutable`.
- [ ] `/_next/image/*` retourne `Cache-Control: public, max-age=86400, stale-while-revalidate=604800`.
- [ ] `/api/og/*` (post phase 4) retourne `Cache-Control` documenté.

### 9.5 Comportement admin

- [ ] L'éditeur SEO ne perd pas l'état dirty si on rafraîchit la page (alerte navigateur si modifications non sauvegardées).
- [ ] Le linter répond < 500 ms en moyenne.
- [ ] Les previews SERP/Facebook/Twitter restent affichés à droite (desktop) ou en accordéon (mobile).
- [ ] La restauration depuis snapshot crée un nouvel `auditEvent` et un nouveau snapshot.

## 10. Sign-off

Une phase est considérée comme close quand :

1. Toutes les cases à cocher de sa section sont validées.
2. Une revue de PR a été effectuée (ou auto-revue documentée si solo).
3. Les smoke tests post-déploiement sont passés.
4. Aucune alerte d'erreur 5xx dans les 24 h suivant le déploiement.

Le plan global est considéré comme livré quand :

- Phases 0 à 5 closes.
- Couverture de tests atteinte (`07-tests-strategy.md` §6).
- KPIs `02-vision-objectifs.md` §2 mesurés et conformes.
- Documentation à jour (ce dossier + README projet si pertinent).
- Audit log SEO accessible et alimenté en prod.
