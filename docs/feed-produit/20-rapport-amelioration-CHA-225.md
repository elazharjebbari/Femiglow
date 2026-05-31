# Rapport d'amélioration — Feed produit Kolenda-driven (post-livraison `/kit` + `/feed.xml`)

> Audit du `2026-05-07` après livraison du **feed produit** : module
> `lib/products/feed/`, composant `<ProductFeedSection/>`, endpoint public
> `/feed.xml` Google Merchant, page admin `/admin/products/feed`.
> 37 tests Vitest verts + 10 specs Playwright écrites + 5 tests MSW
> stricts. Aucun warning lint/typecheck nouveau.
>
> **Hors scope explicite : Stripe / paiement.** Le checkout n'est pas
> abordé ici. Tous les tests e2e qui touchent au tunnel d'achat
> s'arrêtent **au panier** (route `/panier`).

L'objectif n'est pas de tout corriger d'un coup mais d'avoir une **vue
claire des dettes** et des extensions naturelles. Chaque item est tagué
par effort et risque, et la section « Tests » est volontairement
exhaustive : c'est le levier le plus rentable pour fiabiliser cette
brique en vue de l'open-up multi-produits.

---

## 1. Trous fonctionnels (critique → important)

### 1.1 Le builder est mono-produit (`buildKitProductFeed`) — DETTE STRUCTURELLE

`apps/web/src/lib/products/feed/kit-feed.ts` est hardcodé sur **le
kit**. Lorsqu'on lancera un second SKU (recharge Paste, recharge
Powder, polissoir seul…), il faudra :
- Soit dupliquer la fonction par SKU (`buildPasteRefillFeed`, etc.) :
  duplique le code copywriting et les principes Kolenda.
- Soit factoriser un `buildProductFeed(product, content, opts)`
  paramétrable par template de copy + builder de steps.

`merchant-xml.ts` doit aussi accepter un `<channel>` avec **N items**
(actuellement il assume 1 item). C'est une mini-refacto mais elle est
inévitable pour le scaling.

**À faire** :
- Extraire un type `ProductFeedTemplate` (kicker, lead, steps[], claims[],
  socialProof…) et un registre `feedTemplates: Record<ProductSlug,
  ProductFeedTemplate>`.
- `merchantFeedXml(channel: { items: ProductFeed[] })` au lieu de
  `merchantFeedXml(feed: ProductFeed)`.
- Endpoint `/feed.xml` boucle sur tous les produits `published`.
- Tests : ajouter un fixture multi-produits.
- Effort : **1 j**. Risque : **moyen** (rupture API publique du
  builder + signature).

### 1.2 Pas de balisage **Schema.org Product/Offer/AggregateRating** sur `/kit`

Le feed XML est destiné aux régies (Google Merchant, Facebook Catalog).
Mais Google Search lit le HTML de `/kit` directement et a besoin de
JSON-LD pour les **Rich Results** (étoiles dans les SERP, prix, dispo).

Aujourd'hui : **aucun** `<script type="application/ld+json">` produit
sur `/kit`. La metadata Open Graph est OK mais Schema.org n'est pas
posé.

**À faire** :
- Composant `<ProductJsonLd feed={feed}/>` qui injecte
  `@type: Product` + `offers: Offer` + `aggregateRating: AggregateRating`
  + `review: [...]`.
- Inséré dans `layout` ou directement dans `app/(marketing)/kit/page.tsx`.
- Tests : valider via Vitest snapshot du JSON-LD ; valider via Playwright
  que `head > script[type="application/ld+json"]` parse.
- Effort : **0,5 j**. Risque : **faible**. Bénéfice SEO : **très élevé**.

### 1.3 Image SVG inadéquate pour Google Merchant

Le `imageUrl` actuel pointe sur `kit-principale.svg`. Google Merchant
**rejette les SVG** dans les feeds — accepte uniquement JPG, PNG, GIF,
BMP, TIFF. À publier en prod, les items seront refusés.

**À faire** :
- Générer un PNG variant (`kit-principale.png`, 1200×1200, fond crème).
- `buildKitProductFeed` priorise `imagePngUrl` sur `imageSvgUrl` pour le
  feed.
- Le rendu HTML peut continuer à utiliser le SVG (vectoriel, plus net).
- Tests : asserter que `feed.imageUrl` se termine par `.png|.jpg|.gif`,
  jamais `.svg`.
- Effort : **0,2 j** (export Figma + un test). Risque : **faible**.

### 1.4 Le `revalidateTag` n'est pas posé après modification produit

Si l'admin change `priceCents` sur `/admin/products/[id]`, le
`/feed.xml` continue à servir l'ancien prix pendant `revalidate=1800`
(30 min). Pour un commerçant qui ajuste un prix de promo, c'est **30
minutes de discordance** entre le prix admin et le prix feed.

**À faire** :
- Tag le cache : `unstable_cache(..., ['product-feed'], { tags: ['product-feed'] })`.
- Sur `POST/PATCH /api/admin/products/[id]`, appeler
  `revalidateTag('product-feed')` + `revalidatePath('/kit')` +
  `revalidatePath('/feed.xml')`.
- Test MSW : update produit → 2e fetch `/feed.xml` reflète le nouveau
  prix.
- Effort : **0,3 j**. Risque : **faible**.

### 1.5 Pas de variantes / `g:item_group_id`

Spec Google Merchant : produits déclinés (taille, couleur) doivent
partager un `<g:item_group_id>`. Aujourd'hui le kit n'a qu'une variante
mais on prévoit déjà 2 finitions (mat / brillant). Il faudra
`<g:item_group_id>kit-femiglow</g:item_group_id>` + `<g:size>` ou
`<g:custom_label_2>finish:matte</g:custom_label_2>`.

**À faire** :
- Étendre `ProductFeed` avec `variantGroupId?: string`,
  `variantAttributes?: { size?, color?, finish? }`.
- `merchantFeedXml` les sérialise s'ils sont définis.
- Tests : ajouter un fixture variant + assertion XML.
- Effort : **0,4 j**. Risque : **faible**.

### 1.6 Pas de feed multilangue

`<g:language>` est codé `fr-MA`. Quand on activera AR-MA (un sous-domaine
ou un préfixe `/ar`), il faudra :
- Soit un feed unique avec `<g:content_language>` répété.
- Soit `feed.xml` (FR) + `feed-ar.xml` (AR) à la racine — c'est la
  recommandation officielle Google.

**À faire** :
- Route paramétrée `app/feed.[locale].xml/route.ts` ou
  `app/[locale]/feed.xml/route.ts`.
- Tests : 2 endpoints avec namespaces / langues différents.
- Effort : **0,5 j**. Risque : **moyen** (couplage avec i18n routing).

### 1.7 Témoignages + rating injectés en dur

Dans `kit-feed.ts`, on a `rating: 4.8`, `reviewsCount: 287`. Ces
chiffres sont littéraux. La table `review` (si elle existe) ou
`feedback` n'est jamais agrégée. Conséquence : les chiffres sont
**figés** et ne reflètent pas l'évolution business.

**À faire** :
- `lib/products/reviews.ts` → `getProductReviewStats(productId)`
  retourne `{ rating, reviewsCount }` calculés depuis la DB.
- Le builder lit ce stat au lieu de la valeur littérale.
- Fallback gracieux si pas de reviews encore (cache rating démarrage).
- Tests : MSW mock du repo reviews.
- Effort : **0,5 j**. Risque : **faible** (fallback déjà préparé).

### 1.8 Pas de `g:sale_price_effective_date`

Quand `promoPriceCents` est défini, on émet `<g:sale_price>` mais sans
fenêtre. Google peut retirer le prix promo à n'importe quel moment.
La best practice : `<g:sale_price_effective_date>2026-05-01T00:00-0000/2026-05-31T23:59-0000</g:sale_price_effective_date>`.

**À faire** :
- Étendre `Product` schema : `promoStartsAt`, `promoEndsAt`.
- `merchantFeedXml` formate la fenêtre ISO 8601.
- Test : promo sans fenêtre → pas d'élément ; avec fenêtre → format
  correct.
- Effort : **0,3 j**. Risque : **faible**.

### 1.9 Pas de header `Last-Modified` ni `ETag` sur `/feed.xml`

Les bots Merchant respectent `If-Modified-Since` / `If-None-Match`. En
posant ces headers on évite d'envoyer 1 KB de XML à chaque crawl quand
rien n'a changé.

**À faire** :
- `Last-Modified: <feed.lastBuildDate RFC 7231>` dans la réponse.
- `ETag: W/"<sha1(xml)>"` calculé sur le body.
- Si `request.headers.get('if-none-match') === etag` → 304.
- Tests MSW : 2 hits, le 2e renvoie 304 quand `If-None-Match` matche.
- Effort : **0,3 j**. Risque : **faible**.

### 1.10 Pas de logging structuré sur `/feed.xml`

Aucun log sur les hits du feed. On ne sait pas combien de fois Google
Merchant fetche, ni si des bots abusifs hit la route.

**À faire** :
- `logger.info({ event: 'feed.served', userAgent, ip, ms })` à chaque
  réponse.
- Compteur Prometheus `feed_requests_total{status}` (si on a déjà
  prometheus exporter).
- Effort : **0,2 j**. Risque : **nul**.

### 1.11 Pas de monitoring d'erreur sur `/feed.xml`

Si `cms.getKitPageContent()` rejette, ou si `buildKitPublicProduct()`
plante, on retombe sur le default Next.js 500. Aucune alerte Sentry.

**À faire** :
- `try/catch` global dans le route handler. Sentry capture + 503 +
  `Retry-After: 60`.
- Test MSW : mock du repo qui throw → response 503 + body explicite.
- Effort : **0,2 j**. Risque : **faible**.

---

## 2. Qualité de code

### 2.1 `siteOrigin()` dupliqué entre builder et XML

Les deux modules importent leur propre helper d'origine. À factoriser
dans `lib/url/site-origin.ts` (existe peut-être déjà — à vérifier).
Bonus : test centralisé du fallback (`http://localhost:3000`).

**À faire** :
- Extraire le helper, importer aux 2 endroits.
- Effort : **0,1 j**. Risque : **nul**.

### 2.2 Pas de validation Zod sur `ProductFeed`

Le contrat est garanti uniquement par TypeScript — au runtime, rien
n'empêche un consumer (admin preview, route XML) de recevoir un objet
mal formé si le builder a un bug.

**À faire** :
- `productFeedSchema = z.object({...})` dans `feed/types.ts`.
- `buildKitProductFeed` valide via `productFeedSchema.parse(...)` en
  mode dev (skip en prod pour la perf).
- Test : assertion d'un cas dégradé (rating négatif, etc.) → throw.
- Effort : **0,3 j**. Risque : **faible**.

### 2.3 `merchantFeedXml` pas de snapshot golden

Si quelqu'un casse l'ordre des balises ou ajoute un champ par
mégarde, on n'a pas de garde-fou pixel-perfect.

**À faire** :
- `expect(xml).toMatchInlineSnapshot()` ou snapshot file dédié dans
  `__snapshots__/`.
- Volontairement strict sur la structure ; faciliter l'update via
  `--update`.
- Effort : **0,1 j**. Risque : **nul**.

### 2.4 `ProductFeedSection` accepte `anchorId: string`

Aujourd'hui `anchorId` peut être n'importe quelle string. Sur l'admin
preview on passe `'admin-product-feed'`, sur `/kit` on garde
`'product-feed'`. Une typo silencieuse casserait les liens d'ancres.

**À faire** :
- `type FeedAnchorId = 'product-feed' | 'admin-product-feed'`.
- Effort : **0,05 j**. Risque : **nul**.

### 2.5 Pas d'index barrel pour `lib/products/feed`

Le `index.ts` existe (Phase 2) mais re-vérifier qu'il exporte bien
**tout** ce qui est consommé en externe (`buildKitProductFeed`,
`merchantFeedXml`, `escapeXml`, `formatMerchantPrice`, `ProductFeed`,
`ProductFeedHero`, etc.). Faciliter les imports `from '@/lib/products/feed'`.

**À faire** :
- Audit des consumers, normaliser les imports.
- Effort : **0,1 j**. Risque : **nul**.

---

## 3. Sécurité & observabilité

### 3.1 Pas de rate limit sur `/feed.xml`

L'endpoint est public, sans auth. Un crawler abusif peut hammer.
Le cache HTTP atténue (304) mais pas la 1re requête de chaque cache
miss.

**À faire** :
- Middleware `rate-limit-by-ip` (1 hit/sec/IP, burst 10).
- Whitelist Googlebot par CIDR (cf. liste officielle Google).
- Effort : **0,3 j**. Risque : **faible**.

### 3.2 Pas d'audit admin pour `/admin/products/feed`

Quand l'admin charge la preview ou télécharge le feed, pas de log dans
`audit_log`. Pour la conformité « qui a vu quoi », c'est un trou.

**À faire** :
- `audit({ actor: session.email, action: 'feed.preview.viewed' })` au
  GET.
- `audit({ ..., action: 'feed.xml.downloaded' })` au click téléchargement
  (via API route dédiée).
- Effort : **0,2 j**. Risque : **faible**.

### 3.3 Pas de signature du feed

Bonus avancé : posera un header `X-Feed-Signature: sha256=<hex>` calculé
avec une clé secrète. Permet à Google Merchant (ou n'importe quel
intégrateur) de vérifier que le payload n'a pas été altéré par un MITM.

**À faire** :
- ENV `FEED_SIGNING_SECRET`.
- Header signature.
- Effort : **0,3 j**. Risque : **faible**. Priorité : **basse** (Google
  utilise HTTPS, MITM peu plausible).

---

## 4. UX admin

### 4.1 Pas de copy-to-clipboard sur les blocs JSON / XML

L'admin doit aujourd'hui sélectionner manuellement les payloads. Un
bouton « Copier » sur chaque `<pre>` est trivial à ajouter.

**À faire** :
- Composant `<CopyButton text={…}/>` (s'il existe déjà, le réutiliser ;
  sinon `navigator.clipboard.writeText`).
- Effort : **0,1 j**. Risque : **nul**.

### 4.2 Pas de "Comparer avec la prod"

L'admin preview affiche le feed local. Pour valider qu'un déploiement
s'est bien propagé, on aimerait un bouton « Comparer avec la prod »
qui fait `fetch(PROD_URL + '/feed.xml')` et affiche un diff.

**À faire** :
- Server action qui fetch le feed prod (par ENV `PROD_FEED_URL`).
- Composant `<XmlDiff a={localXml} b={prodXml}/>` (lib `diff`).
- Effort : **0,5 j**. Risque : **moyen** (diff lib + ENV management).

### 4.3 Pas de bouton "Forcer revalidation"

Quand l'admin pousse une modification produit, il aimerait pouvoir
invalider le cache du feed sans attendre 30 min. Bouton + server
action `revalidateTag('product-feed')`.

**À faire** :
- Server action `revalidateProductFeed()`.
- Bouton dans header `/admin/products/feed`.
- Toast de confirmation.
- Effort : **0,3 j**. Risque : **faible**.

### 4.4 Pas de toggle preview mobile / desktop

`ProductFeedSection` est responsive mais on ne peut pas le **vérifier**
depuis l'admin preview sans ouvrir devtools. Un toggle radio
`Mobile | Tablet | Desktop` qui change la `max-width` de l'iframe
preview serait pédagogique pour la fondatrice.

**À faire** :
- Wrap preview dans un container avec switcher de width.
- Effort : **0,3 j**. Risque : **faible**.

### 4.5 Pas de stats de validation Google Merchant

Idéalement, l'admin voit « 1 item ✓ valide » ou « 1 item ✗ erreur :
image_link manque ». On peut faire un linter local qui simule la
validation Merchant.

**À faire** :
- `validateMerchantFeed(feed) → { errors: string[], warnings: string[] }`.
- Section dans `/admin/products/feed` qui rend le résultat.
- Effort : **0,5 j**. Risque : **faible**. Bénéfice : **élevé** (évite
  3-4 allers-retours avec Google Merchant Center pour debug).

---

## 5. Tests — la section principale (fiabilité + robustesse)

> L'objectif : avoir une suite **multi-niveaux** qui couvre la pyramide
> classique. Aujourd'hui on a 37 unit + 5 MSW + 10 Playwright. La cible
> est ~80 unit + 12 MSW + 18 Playwright (3 navigateurs × principaux
> parcours).

### 5.1 Tests unitaires Vitest — extensions

#### 5.1.1 Property-based testing (`fast-check`) sur `escapeXml`

Aujourd'hui : 1 test sur les 5 caractères XML. Devrait être **fuzz** :
- 1000 strings aléatoires Unicode → output ne contient jamais
  `<`, `>`, `&`, `"`, `'` non-encodés.
- Idempotence : `escape(escape(s)) !== escape(s)` (volontaire — escape
  est non-idempotent par design).

```ts
import fc from 'fast-check';
it('escapes 5 XML chars on any string', () => {
  fc.assert(fc.property(fc.string(), (s) => {
    const escaped = escapeXml(s);
    expect(escaped).not.toMatch(/[<>"'&](?!amp;|lt;|gt;|quot;|apos;)/);
  }));
});
```

#### 5.1.2 Snapshot test du XML complet

Capture l'output entier dans un fichier `__snapshots__/merchant.xml.snap`.
Toute modification structurelle nécessite `--update-snapshot` explicite
+ review. **Garde-fou critique** contre les régressions silencieuses
sur le feed exposé aux régies.

#### 5.1.3 Tests de devises supplémentaires

`formatMerchantPrice` n'est testé qu'avec MAD/EUR/USD. Ajouter :
- GBP, JPY (sans décimales), KRW (sans décimales), TND (3 décimales).
- Edge case prix = 0 (`0.00 MAD`), prix négatif (doit throw).
- Edge case `Number.MAX_SAFE_INTEGER` cents.

#### 5.1.4 Tests CDATA fuzz

Aujourd'hui : 1 test sur `]]>` simple. Ajouter :
- `]]><script>...]]><script>` (multiple injections).
- `]` seul, `]]`, `]]]`, `]]]]>`.
- Caractères de contrôle (U+0000..U+001F) — Google Merchant rejette.

#### 5.1.5 Tests fallback origin

`siteOrigin()` quand `NEXT_PUBLIC_SITE_URL` est :
- `undefined` → fallback `http://localhost:3000`.
- `''` (string vide) → fallback.
- `'invalid-not-a-url'` → throw clair.
- Avec/sans trailing slash → normalisé.

#### 5.1.6 Tests fallback testimonials

Quand `mockKitPageContent.handsTestimonials = []` :
- Le builder ne plante pas.
- `feed.socialProof.quote` est un string par défaut neutre.
- `feed.socialProof.authorLabel` est `''` ou un placeholder.

#### 5.1.7 Tests sourcing témoignage déterministe

Aujourd'hui : on prend le plus court. Mais si **deux** témoignages ont
la même longueur ?
- Doit être déterministe (priorité par index, par auteur, peu importe
  mais stable).
- Test : 2 témoignages identiques en longueur → toujours le même choisi.

#### 5.1.8 Tests `out_of_stock` n'inclut pas `g:sale_price`

Cas combiné `inStock=false` + `promoPriceCents=28000`. Doit produire
`<g:availability>out of stock</g:availability>` **et** ne pas inclure
`<g:sale_price>` (Google Merchant ignore le sale price si l'item
n'est pas in-stock).

#### 5.1.9 Test purity strict

100 itérations de `buildKitProductFeed` doivent produire le même
résultat byte-pour-byte (sauf `lastBuildDate` qui est dans
`merchantFeedXml`, pas dans le builder).

```ts
it('is byte-identical across 100 calls', () => {
  const first = buildKitProductFeed(product, content);
  for (let i = 0; i < 100; i++) {
    expect(buildKitProductFeed(product, content)).toEqual(first);
  }
});
```

### 5.2 Tests composant Vitest — extensions

#### 5.2.1 Test `prefers-reduced-motion`

Mock `window.matchMedia('(prefers-reduced-motion: reduce)')` et vérifier
que les pastilles n'animent pas (si on ajoute des animations).

#### 5.2.2 Test focus management & tab order

```ts
it('walks h2 → liste gestes → CTA → microcopy en Tab', async () => {
  renderSection();
  const user = userEvent.setup();
  await user.tab();
  // Vérifier que l'élément focusé est bien dans l'ordre attendu.
});
```

#### 5.2.3 Test sans social proof

Si `feed.socialProof` est `null` (futur — produit sans avis encore) :
- Le composant rend sans la `<figure>`.
- Pas de blank space anormal.

#### 5.2.4 Test long copy

Forcer `feed.hero.title = 'Lorem ipsum '.repeat(20)` et vérifier que :
- `text-wrap: balance` ne casse pas le layout.
- Pas d'overflow horizontal.
- Hauteur du h2 reste raisonnable.

#### 5.2.5 Test image fallback

Mock `<img onError>` pour simuler 404 et vérifier qu'un placeholder ou
alt text est affiché. (Suppose qu'on ajoute la gestion d'erreur image.)

#### 5.2.6 Test interaction CTA

```ts
it('AddToCartButton dispatch un event quand clické', async () => {
  const user = userEvent.setup();
  renderSection();
  const cta = screen.getByRole('button', { name: /composer/i });
  await user.click(cta);
  // Vérifier que le toast confirme l'ajout, ou que le store cart a +1.
});
```

#### 5.2.7 Test traduction (futur AR-MA)

Quand on aura un prop `locale: 'fr-MA' | 'ar-MA'`, vérifier le rendu
RTL + traductions. **À ajouter quand l'i18n sera en place — placeholder
pour ne pas oublier**.

#### 5.2.8 Test accents accessibility

`bg-sauge-soft text-sauge-dark ring-1 ring-sauge-dark/15` — vérifier
le **ratio de contraste** sage soft / sage dark (≥ 4.5:1 WCAG AA). Via
`color-contrast-checker` ou axe-core lui-même (qui le calcule).

### 5.3 Tests MSW — extensions

> MSW est en mode strict (`onUnhandledRequest: 'error'`) — c'est déjà
> fort. Mais on peut élargir la couverture.

#### 5.3.1 Test cache header sur 2 hits

```ts
it('respecte max-age sur 2 hits successifs', async () => {
  const r1 = await GET();
  expect(r1.headers.get('cache-control')).toContain('max-age=300');
  const r2 = await GET();
  // Si on simule le timer, le 2e devrait toujours être valide.
});
```

#### 5.3.2 Test fallback CMS down

Mock `cms.getKitPageContent()` qui rejette → response **503** +
`Retry-After: 60` + body explicite (HTML ou XML d'erreur).

#### 5.3.3 Test concurrence

100 calls parallèles à `GET()` → toutes doivent répondre 200, body
identique, sans race condition.

```ts
it('handles 100 concurrent requests', async () => {
  const responses = await Promise.all(Array.from({ length: 100 }, GET));
  const bodies = await Promise.all(responses.map((r) => r.text()));
  responses.forEach((r) => expect(r.status).toBe(200));
  expect(new Set(bodies).size).toBe(1);  // tous identiques
});
```

#### 5.3.4 Test ENV indéfini → fallback raisonnable

`process.env.NEXT_PUBLIC_SITE_URL = undefined` → response 200 avec
`<g:link>` qui contient `localhost:3000` (fallback).

#### 5.3.5 Test `revalidateTag('product-feed')`

```ts
it('refetch après revalidateTag', async () => {
  const cms = vi.mocked(getKitPageContent);
  cms.mockResolvedValueOnce({ ...content, productPriceCents: 32000 });
  await GET();  // hit 1, cache prix 320

  cms.mockResolvedValueOnce({ ...content, productPriceCents: 28000 });
  await revalidateTag('product-feed');
  const r = await GET();
  expect(await r.text()).toContain('280.00 MAD');
});
```

#### 5.3.6 Test sécurité header

`x-content-type-options: nosniff` toujours présent — déjà testé.
Ajouter :
- `referrer-policy: no-referrer` (recommandé pour bots).
- `cross-origin-resource-policy: cross-origin` (autoriser fetch
  cross-origin par Google Merchant).

#### 5.3.7 Test body strict UTF-8

```ts
it('body est UTF-8 sans BOM, sans char perdu', async () => {
  const res = await GET();
  const buffer = await res.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  // Pas de BOM (EF BB BF).
  expect(bytes[0]).not.toBe(0xEF);
  // Décodable en UTF-8.
  expect(() => new TextDecoder('utf-8', { fatal: true }).decode(bytes)).not.toThrow();
});
```

#### 5.3.8 Test 304 sur `If-None-Match` (après 1.9)

```ts
it('renvoie 304 quand If-None-Match matche', async () => {
  const r1 = await GET();
  const etag = r1.headers.get('etag');
  const r2 = await GET(new Request('/feed.xml', { headers: { 'if-none-match': etag } }));
  expect(r2.status).toBe(304);
  expect((await r2.text())).toBe('');
});
```

### 5.4 Tests Playwright E2E — extensions (priorité haute)

#### 5.4.1 Storage state pour skip login répété

**P1 du rapport CHA-225 chat**, à appliquer au feed aussi. Un seul login
admin au début de la suite, dump dans `e2e/.auth/admin.json`, réutilisé
par tous les tests via `test.use({ storageState: 'e2e/.auth/admin.json' })`.

```ts
// playwright.config.ts
projects: [
  { name: 'setup', testMatch: /global\.setup\.ts/ },
  {
    name: 'admin',
    dependencies: ['setup'],
    use: { storageState: 'e2e/.auth/admin.json' },
  },
];
```

**Bénéfice** : suite 10× plus rapide, 0 flake sur rate-limit auth.

#### 5.4.2 Tests cross-browser (Chromium + Firefox + WebKit)

```ts
projects: [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit',   use: { ...devices['Desktop Safari'] } },
];
```

Chaque spec tourne 3× (sauf si `@chromium-only` tag). Détecte les
régressions WebKit (font-rendering, CSS Grid, JIT).

#### 5.4.3 Tests cross-viewport (Mobile / Tablet / Desktop)

Pour `/kit#product-feed` :
- Mobile 375×812 — pastilles centrées, CTA full-width.
- Tablet 768×1024 — 2 colonnes.
- Desktop 1280×800 — 4 colonnes côte à côte.

#### 5.4.4 Test parcours visiteur complet **stoppé au panier** (sans Stripe)

```ts
test('visiteur arrive sur /kit, ajoute au panier, atterrit sur /panier avec 1 kit', async ({ page }) => {
  await page.goto('/kit#product-feed');
  await page.getByRole('button', { name: /composer mon rituel/i }).click();
  // Vérifier toast.
  await expect(page.getByText(/ajouté au panier/i)).toBeVisible();
  // Naviguer vers panier.
  await page.goto('/panier');
  await expect(page.getByText('Le kit FemiGlow')).toBeVisible();
  await expect(page.getByText(/320,?00\s*MAD/)).toBeVisible();
  // STOP ICI — pas de checkout (Stripe hors scope).
});
```

#### 5.4.5 Test admin → preview → download fichier valide

```ts
test('admin peut télécharger feed.xml et le fichier est un RSS valide', async ({ page }) => {
  await page.goto('/admin/products/feed');
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('admin-feed-download').click();
  const download = await downloadPromise;
  const path = await download.path();
  const xml = await readFile(path!, 'utf-8');
  expect(xml).toMatch(/^<\?xml version="1\.0"/);
  expect(xml).toContain('xmlns:g="http://base.google.com/ns/1.0"');
});
```

#### 5.4.6 Test SEO Schema.org sur `/kit` (après 1.2)

```ts
test('/kit expose un JSON-LD Product valide', async ({ page }) => {
  await page.goto('/kit');
  const jsonLd = await page.locator('script[type="application/ld+json"]').textContent();
  const parsed = JSON.parse(jsonLd!);
  expect(parsed['@type']).toBe('Product');
  expect(parsed.offers).toBeDefined();
  expect(parsed.offers.priceCurrency).toBe('MAD');
});
```

#### 5.4.7 Test a11y E2E avec @axe-core/playwright

```ts
import AxeBuilder from '@axe-core/playwright';

test('/kit n\'a aucune violation axe', async ({ page }) => {
  await page.goto('/kit');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
```

À étendre sur `/admin/products/feed`.

#### 5.4.8 Test perf budget via Playwright + Lighthouse CI

Budgets cibles (`lighthouserc.json`) sur `/kit` :
- LCP ≤ 2.5s
- CLS ≤ 0.1
- TBT ≤ 200ms
- Performance score ≥ 90

À intégrer dans CI (GitHub Actions, optionnel — pas bloquant).

#### 5.4.9 Test screenshot golden (visual regression)

```ts
test('section feed match le golden', async ({ page }) => {
  await page.goto('/kit#product-feed');
  const section = page.getByTestId('product-feed-section');
  await expect(section).toHaveScreenshot('product-feed-section.png', {
    maxDiffPixels: 100,
  });
});
```

Lance avec `--update-snapshots` pour rafraîchir. Détecte toute dérive
visuelle imprévue (changement Tailwind, polices, etc.).

#### 5.4.10 Test bouton "Forcer revalidation" admin (après 4.3)

```ts
test('admin peut forcer revalidation et /feed.xml est mis à jour', async ({ page, request }) => {
  const before = await (await request.get('/feed.xml')).text();
  // Modifier prix produit via API admin (ou DB seed).
  await page.goto('/admin/products/feed');
  await page.getByRole('button', { name: /forcer revalidation/i }).click();
  await expect(page.getByText(/cache invalidé/i)).toBeVisible();
  const after = await (await request.get('/feed.xml')).text();
  expect(before).not.toBe(after);
});
```

### 5.5 Architecture des tests — recommandations

#### 5.5.1 Helper `buildFeedFixture(overrides?)`

Aujourd'hui : 4 tests files répètent
`buildKitProductFeed(mockKitPageContent.product, mockKitPageContent)`.
Factoriser :

```ts
// src/test/fixtures/feed.ts
export function buildFeedFixture(overrides?: Partial<Product>): ProductFeed {
  const product = { ...mockKitPageContent.product, ...overrides };
  return buildKitProductFeed(product, mockKitPageContent);
}
```

#### 5.5.2 Helper Drizzle mock partagé (cf. point 2.3 du rapport CHA-225 chat)

Le rapport CHA-225 du chat propose `src/test/db/chainable.ts`. À
réutiliser pour les tests feed quand on intégrera la lecture DB.

#### 5.5.3 Activer `vitest --coverage`

Cible **80% statements** sur `lib/products/feed/**` et
`components/sections/ProductFeedSection.tsx`. Script
`bun run test:coverage` (ou `pnpm` selon runner).

```js
// vitest.config.ts
coverage: {
  provider: 'v8',
  include: ['src/lib/products/feed/**', 'src/components/sections/ProductFeedSection*.tsx'],
  thresholds: { statements: 80, branches: 70, functions: 80, lines: 80 },
}
```

#### 5.5.4 CI matrix

Sur GitHub Actions / Vercel :
- Job `unit` (vitest run) — < 30 s.
- Job `integration` (vitest avec MSW strict) — < 60 s.
- Job `e2e:chromium` (playwright chromium uniquement, smoke) — < 5 min.
- Job `e2e:full` (3 navigateurs, 3 viewports) — < 15 min, déclenché
  manuellement ou sur PR sur `main`.

#### 5.5.5 Test data builder pattern

Pour les tests qui ont besoin de varier 1-2 champs :

```ts
const product = aProduct().withPriceCents(28000).withInStock(false).build();
```

Plus lisible que `{ ...mockKitPageContent.product, priceCents: 28000, inStock: false }`.

---

## 6. Performance / scalabilité

### 6.1 `unstable_cache` pas branché sur `cms.getKitPageContent()`

Aujourd'hui le route handler `/feed.xml` appelle directement le repo,
qui lit la DB. Avec `unstable_cache` taggé `product-feed`, on tombe
à ~2ms en cache hit.

**À faire** :
- Wrapper dans le route handler.
- Tag invalidation cf. 1.4.
- Effort : **0,2 j**. Risque : **faible**.

### 6.2 Pas de pré-rendu statique

Si on passe en `export const dynamic = 'force-static'` + `revalidate =
1800`, le 1er hit sert un fichier statique généré au build. Latence
réseau seulement, pas de Node runtime.

**À faire** :
- Tester compatibilité avec les helpers existants.
- Tests : `bun run build` puis curl `/feed.xml` sur le bundle.
- Effort : **0,3 j**. Risque : **moyen** (peut casser si Vercel KV pas
  configuré).

### 6.3 Lazy load images dans `ProductFeedSection`

Si on ajoute des `<img>` (ex : photo packshot du kit), elles doivent
avoir `loading="lazy"` + `decoding="async"` + `width`/`height` (CLS).

**À faire** :
- Audit du composant.
- Effort : **0,1 j**. Risque : **nul**.

### 6.4 Stream RSC sur `/kit`

Si `/kit` est lent (DB reads en série), utiliser `<Suspense>` autour de
`<ProductFeedSectionBound>` pour ne pas bloquer le LCP du hero.

**À faire** :
- Wrapper Suspense + skeleton.
- Effort : **0,3 j**. Risque : **faible**.

---

## 7. Documentation

### 7.1 Pas de doc dédiée au feed produit

Créer `docs/feed-produit/01-architecture.md` avec :
- Le pipeline `Product (DB) + KitPageContent (CMS) → buildKitProductFeed
  → ProductFeed → merchantFeedXml → /feed.xml`.
- Le mapping Kolenda principle → champ feed (ex : Pricing #2 →
  `feed.hero.pricePrefix`, Ecom #14 → `feed.socialProof`).
- Diagramme Mermaid du flux.

### 7.2 ADR `adr-feed-format.md`

Justifier le choix RSS 2.0 + namespace `g:` (vs Atom, vs CSV, vs JSON).
Référence : [Google Merchant feed spec](https://support.google.com/merchants/answer/7052112).

### 7.3 Runbook « Brancher Google Merchant Center »

Étapes pas-à-pas pour la fondatrice :
1. Créer compte Merchant Center.
2. Vérifier le domaine `femiglow.ma`.
3. « Produits → Flux → Ajouter un flux de produits » → URL
   `https://femiglow.ma/feed.xml`.
4. Fréquence : « Quotidienne ».
5. Premier scan ; vérifier l'onglet « Diagnostic » pour les erreurs.

---

## 8. Synthèse priorisée

| #    | Item                                                          | Effort | Risque | Priorité |
|------|---------------------------------------------------------------|--------|--------|----------|
| 1.2  | Schema.org Product/Offer JSON-LD sur `/kit`                   | 0,5 j  | faible | **P0**   |
| 1.3  | Image PNG variant pour Merchant (rejet SVG)                   | 0,2 j  | faible | **P0**   |
| 1.4  | `revalidateTag('product-feed')` sur édition produit           | 0,3 j  | faible | **P0**   |
| 5.4.1| Storage state Playwright (auth réutilisable)                  | 0,3 j  | faible | **P0**   |
| 5.1.2| Snapshot test du XML complet                                  | 0,1 j  | nul    | **P0**   |
| 1.7  | Reviews/rating depuis la DB au lieu des littéraux             | 0,5 j  | faible | **P1**   |
| 1.10 | Logging structuré sur `/feed.xml`                             | 0,2 j  | nul    | **P1**   |
| 1.11 | Try/catch + Sentry + 503 sur erreur                           | 0,2 j  | faible | **P1**   |
| 1.9  | `Last-Modified` + `ETag` + 304                                | 0,3 j  | faible | **P1**   |
| 5.4.4| Test e2e parcours visiteur → panier (stop avant Stripe)       | 0,5 j  | moyen  | **P1**   |
| 5.4.5| Test e2e download `feed.xml` valide                           | 0,2 j  | faible | **P1**   |
| 5.4.7| Test a11y axe-core E2E                                        | 0,3 j  | faible | **P1**   |
| 5.4.9| Visual regression (screenshot golden)                         | 0,3 j  | faible | **P1**   |
| 4.3  | Bouton « Forcer revalidation » admin                          | 0,3 j  | faible | **P1**   |
| 6.1  | `unstable_cache` sur le builder                               | 0,2 j  | faible | **P1**   |
| 5.1.1| Property-based testing `escapeXml` (fast-check)               | 0,2 j  | nul    | **P2**   |
| 5.1.3| Tests devises supplémentaires                                 | 0,1 j  | nul    | **P2**   |
| 5.1.4| Tests CDATA fuzz                                              | 0,2 j  | nul    | **P2**   |
| 5.4.2| Tests cross-browser (Chromium + Firefox + WebKit)             | 0,3 j  | faible | **P2**   |
| 5.4.3| Tests cross-viewport (mobile / tablet / desktop)              | 0,3 j  | faible | **P2**   |
| 1.1  | Multi-produits : `buildAllProductsFeed`                       | 1 j    | moyen  | **P2**   |
| 1.5  | Variantes (`g:item_group_id`)                                 | 0,4 j  | faible | **P2**   |
| 4.1  | Copy-to-clipboard JSON / XML                                  | 0,1 j  | nul    | **P2**   |
| 4.5  | Linter local Merchant + warnings dans admin                   | 0,5 j  | faible | **P2**   |
| 2.2  | Validation Zod du contrat `ProductFeed`                       | 0,3 j  | faible | **P2**   |
| 5.5.3| Activer coverage report (cible 80%)                           | 0,2 j  | nul    | **P2**   |
| 1.6  | Feed multilangue (`fr-MA` + `ar-MA`)                          | 0,5 j  | moyen  | **P3**   |
| 1.8  | `g:sale_price_effective_date`                                 | 0,3 j  | faible | **P3**   |
| 3.1  | Rate limit `/feed.xml` (whitelist Googlebot)                  | 0,3 j  | faible | **P3**   |
| 3.2  | Audit log admin preview / download                            | 0,2 j  | faible | **P3**   |
| 4.2  | « Comparer avec la prod » (XML diff)                          | 0,5 j  | moyen  | **P3**   |
| 4.4  | Toggle preview mobile/desktop admin                           | 0,3 j  | faible | **P3**   |
| 5.4.8| Lighthouse CI / perf budget                                   | 0,3 j  | faible | **P3**   |
| 7.1  | Doc `01-architecture.md` feed produit                         | 0,5 j  | nul    | **P3**   |
| 7.2  | ADR `adr-feed-format.md`                                      | 0,2 j  | nul    | **P3**   |
| 7.3  | Runbook Google Merchant Center                                | 0,3 j  | nul    | **P3**   |

**Total dette identifiée** : ~12 j-homme cumulés.
- P0 (bloquant valeur business) : **1,4 j**
- P1 (gros bénéfice rapide) : **3,3 j**
- P2 (extensions naturelles) : **3,9 j**
- P3 (nice-to-have, doc) : **3,4 j**

---

## 9. Recommandation de séquencement

### Sprint 1 (3 j) — Fondations Merchant + tests fiables
1. **1.3** Image PNG (0,2 j)
2. **1.2** JSON-LD Schema.org (0,5 j)
3. **1.4** `revalidateTag` (0,3 j)
4. **5.1.2** Snapshot XML (0,1 j)
5. **5.4.1** Playwright storage state (0,3 j)
6. **1.10** Logging structuré (0,2 j)
7. **1.11** Sentry + 503 (0,2 j)
8. **1.9** ETag + 304 (0,3 j)
9. **5.4.5** Test download e2e (0,2 j)
10. **5.4.7** Test a11y axe-core (0,3 j)
11. **6.1** unstable_cache (0,2 j)
12. **4.3** Bouton revalidation admin (0,3 j)

À l'issue : feed industriel-grade, prêt pour Google Merchant en prod.

### Sprint 2 (3 j) — Extensions tests + scaling
1. **1.7** Reviews depuis DB (0,5 j)
2. **5.4.4** Test e2e visiteur → panier (0,5 j)
3. **5.4.9** Visual regression (0,3 j)
4. **5.4.2** Cross-browser (0,3 j)
5. **5.4.3** Cross-viewport (0,3 j)
6. **5.1.1** Property-based escapeXml (0,2 j)
7. **5.1.4** CDATA fuzz (0,2 j)
8. **5.5.3** Coverage report (0,2 j)
9. **2.2** Zod validation (0,3 j)
10. **4.1** Copy-to-clipboard (0,1 j)
11. **4.5** Linter Merchant (0,5 j)

### Sprint 3+ (étalé) — Multi-produits + i18n + doc
1. **1.1** `buildAllProductsFeed` (1 j) — quand le 2e SKU arrive
2. **1.5** Variantes (0,4 j) — quand on aura mat/brillant
3. **1.6** Feed multilangue (0,5 j) — quand AR-MA sera active
4. **7.1, 7.2, 7.3** Doc complète (1 j cumulé)

---

## 10. Hors scope (pour mémoire)

Ces items sont **explicitement écartés** de ce plan, soit parce qu'ils
sont dépendants de Stripe (paiement), soit parce qu'ils relèvent d'un
autre périmètre (chat, leads).

- **Tunnel checkout & Stripe** — `/checkout/*`, webhooks Stripe,
  attribution `chat_session.converted_at` après paiement. Cf. rapport
  CHA-225 du chat (1.1) pour la dette d'attribution.
- **Test e2e parcours achat complet** — bloqué par Stripe ; on
  s'arrête au panier (5.4.4).
- **`order.paid` → `revalidateTag('product-feed')`** — déclencher
  l'invalidation du feed après une vente (utile pour le KPI
  conversions, mais Stripe-dépendant).
- **Reviews UGC** — système de reviews user-generated avec
  modération admin ; pour l'instant on injecte des littéraux
  (cf. 1.7). Plus tard.

---

## 11. Critères d'acceptation par phase

### Sprint 1 — Définition de « done »
- [ ] `bun run test` : 100% pass (pas de skip).
- [ ] `bun run typecheck` : 0 nouvelle erreur sur le module feed.
- [ ] `bun run lint` : 0 nouveau warning sur le module feed.
- [ ] `bun run e2e --project=chromium` : 100% pass.
- [ ] `/kit` HTML contient un `<script type="application/ld+json">`
      Product valide (test via [Schema.org Validator](https://validator.schema.org/)).
- [ ] `curl -I /feed.xml` retourne `Last-Modified` + `ETag`.
- [ ] `curl -H 'If-None-Match: <etag>' /feed.xml` retourne 304.
- [ ] Sentry dashboard montre 0 erreur sur l'endpoint.
- [ ] Modifier un prix produit → `/feed.xml` reflète le nouveau prix
      en < 5 secondes (au lieu de 30 min).

### Sprint 2 — Définition de « done »
- [ ] Coverage `lib/products/feed/**` ≥ 80% statements.
- [ ] Visual regression : 0 diff pixel sur `/kit#product-feed`.
- [ ] Cross-browser : 100% pass sur Chromium + Firefox + WebKit.
- [ ] Cross-viewport : 100% pass sur 375 / 768 / 1280.
- [ ] Linter Merchant local : 0 erreur sur le feed produit kit.

### Sprint 3+ — Définition de « done »
- [ ] Feed multi-produits : 2+ items dans `<channel>` quand on a 2 SKUs.
- [ ] Feed AR-MA disponible à `/feed.ar.xml` ou `/ar/feed.xml`.
- [ ] Doc `01-architecture.md` + ADR + runbook publiés.

---

> **Note** : ce plan est cohérent avec le rapport CHA-225 du chat
> (`docs/chat-assistant/20-rapport-amelioration-CHA-225.md`) sur les
> aspects partagés (Playwright storage state, mock Drizzle, coverage
> report). Coordo recommandée pour ne pas dupliquer l'effort.
