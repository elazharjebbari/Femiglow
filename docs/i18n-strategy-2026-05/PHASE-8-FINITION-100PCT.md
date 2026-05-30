# PHASE 8 — Finition i18n 100 % : couverture totale, robustesse, UI/UX premium

> **But** : zéro mélange AR/FR/EN visible sur l'ensemble du site, implémentation robuste
> (garde-fous anti-régression), UI/UX arabe/RTL de très haute qualité, code maintenable /
> modulaire / évolutif / fiable, et **mécanisme de seed préservé** pour le déploiement remote.
>
> Fait suite à PHASE 7 (cf. `PHASE-7-100PCT-COVERAGE-PLAN.md`, `PHASE-7-AUDIT.md`).
> Convention : `fr` = locale défaut, `ar` (RTL, Cairo), `en`. Admin reste 100 % FR (ADR-008).

---

## 0. Definition of Done (critères de succès, non négociables)

Une locale est « 100 % » quand **toutes** ces conditions sont vraies :

1. **Couverture** — le scanner FR (cf. §8C.1) ne trouve **0 token français visible** sur `/ar/*`
   et `/en/*` (hors termes de marque whitelistés : `Paste`, `Powder`, `Step 4`, `FemiGlow`,
   `MAD`, `INCI`, `clean girl`, `Cosmos Organic`, etc.).
2. **Non-régression FR** — chaque page `/fr/*` est **byte-identique** en copie à l'état pré-Phase-8.
3. **Robustesse** — un build échoue si un token FR réapparaît sur `/ar|/en` (garde-fou CI), et une
   clé de message manquante est détectée en dev (pas de fallback silencieux vers la clé brute).
4. **UI/UX** — `dir=rtl` + police Cairo sur `/ar`, aucune troncature/chevauchement, switcher
   accessible au clavier, zéro flash de langue, axe (a11y) vert sur les 3 locales.
5. **Données dynamiques** — le contenu admin (component bindings, rituels, SEO) est **localisé en
   prod** via le seed, pas seulement via les mocks de dev.
6. **Qualité de code** — respect des invariants d'architecture (§2), tests verts, `pnpm typecheck`
   clean.

---

## 1. État des lieux (au démarrage de la Phase 8)

| Élément | État |
|---|---|
| Catalogue `messages/{fr,ar,en}.json` | **100 % — 797 clés × 3 locales** (le manque est du *wiring/data*, pas de la traduction) |
| Page `/kit` (la plus profonde) | **95 → 32** occurrences FR visibles ; toute la couche **statique + composant + contenu** localisée (15 tâches 7E vérifiées) |
| Patterns réutilisables établis | header-prop, Bound+`getTranslations`, localize-overlay, FR-default-guard, data-resolver locale-aware |
| Reste identifié sur `/kit` | RitualsModule (DB seed), wizard checkout (funnel), PriceBlock (1 string) |
| Autres pages | validées au niveau H1/switcher uniquement — **pas encore scannées en profondeur** |
| Garde-fous i18n (CI/ESLint) | **Aucun** — à créer (Phase 8C) |
| Seed | `seed:i18n-bindings` + `seed-rituals.ts` + `seed-components.ts` opérationnels — **à préserver** |

---

## 2. Invariants d'architecture (les règles qui garantissent maintenabilité & évolutivité)

Ces invariants sont la colonne vertébrale. Toute nouvelle localisation **doit** s'y conformer.

### 2.1 Source unique de vérité, par nature de contenu
| Nature | Source | Exemple |
|---|---|---|
| Chrome UI (kicker, CTA, labels, en-têtes section) | `messages/{locale}.json` via `getTranslations` | `marketing.kit.hero.cta_commander` |
| Contenu éditorial dynamique (produit, compo, transcript) | CMS / mocks locale-aware (`kit.ar.ts`, `kit.en.ts`) via `cms.get*({ locale })` | `content.product.tagline` |
| Données générées/seedées (témoignages rituels, reviews) | DB + seed locale-aware | `seed-rituals.ts` |
| Override admin éditeur | `component_field_bindings` (colonne `locale`) | `resolveComponentFields(key, locale)` |

> **Ne jamais** dupliquer une string entre deux sources. Si un builder pur sert aussi un flux
> non-UI (ex. `kit-feed.ts` → Google Shopping XML), il reste **canonique FR** et on applique un
> **overlay de localisation** côté Bound (cf. `lib/products/feed/localize.ts`).

### 2.2 Pattern « dual-mode » pour composants de présentation
Un composant présentation (`'use client'` ou serveur dumb) **n'appelle jamais** `getTranslations`
directement. Il reçoit ses strings en props avec un **défaut FR** :

```tsx
interface Props { /* … */ header?: { kicker: string; title: string; description: string } }
const DEFAULT_HEADER = { kicker: 'Questions', title: '…', description: '…' };
export function FAQContextuelle({ header = DEFAULT_HEADER }: Props) { /* {header.kicker} */ }
```

Bénéfices : testable sans contexte i18n, rétro-compatible (legacy `(marketing)/*`), zéro flash.

### 2.3 Les Bounds RSC résolvent, les composants restent « dumb »
Le wrapper `*Bound` (server, `async`) résout `getTranslations({ locale, namespace })` **ou** lit
le `content` locale-aware, puis passe des objets plats. Le layout `async` résout une fois
`tKit = getTranslations({ locale, namespace: 'marketing.kit' })` pour les strings de niveau page.

### 2.4 Garde « FR-default »
En locale **non-défaut**, on **refuse** toute valeur dont la source est `default` (= FR du registry)
et tout fallback FR hardcodé : `acceptDefault = effectiveLocale === DEFAULT_LOCALE`
(cf. `hero-fields.ts`, `HeroProduitBound.pickString`). Un fallback non-FR **doit** être fourni.

### 2.5 Data-resolvers locale-aware
Les resolvers FR-only (`resolveKitComposition`, `resolveKitVideo`) restent FR (+ override admin)
en défaut ; en non-défaut le layout passe la donnée locale-aware (`content.composition`,
`content.videoSrc`). Garde explicite : `(locale ?? DEFAULT_LOCALE) === DEFAULT_LOCALE ? resolverFR() : content.*`.

### 2.6 Règles « messages »
- **Pas de tableaux** dans les JSON de messages (next-intl) → clés nommées (`chips.no_polish`).
- Clés `snake_case`, namespaces alignés sur la structure UI (`marketing.<page>.<section>.<field>`).
- Les 3 catalogues ont **exactement le même shape** (test de parité — §8C.3).
- `exactOptionalPropertyTypes` actif : caster (`as`) au spread d'optionnels (cf. `localize.ts`).

---

## 3. Plan par phases

### Phase 8A — Terminer la page `/kit` (reste identifié)

#### 8A.1 — RitualsModule « voix de la maison » (tâche 7E-11) · *priorité P0*
**Symptôme** : `/ar/kit` affiche « LES VOIX DE LA MAISON · 47 initiées ont partagé · 38 reprendraient
le rituel · plaque souple · Reviendrait » + témoignages FR (« Khadija, Salé »).
**Cause** : `RitualsModuleBound` lit `getRitualSummary` / `listRituals` (DB) — données FR ;
labels de structure hardcodés dans le composant.
**Travaux** :
1. **Labels composant** → namespace `marketing.kit.rituals.*` (kicker, count phrases, badges
   « Reviendrait », chips « plaque souple/fini brillant/plus de casse »). Pattern header-prop +
   layout `tKit`. *(les clés peuvent être ajoutées — catalogue extensible)*
2. **Données témoignages** → étendre `seed-rituals.ts` avec variantes **AR/EN** (champ `language`
   ou table `ritual_translations`) + rendre `listRituals({ locale })` / `getRitualSummary({ locale })`
   **locale-aware** (filtre/fallback). En dev local sans DB : mock locale-aware.
3. **Préservation seed** : c'est exactement le mécanisme à garder pour le remote (cf. §8E).
**Acceptation** : scanner FR = 0 sur le bloc rituals `/ar` & `/en` ; `/fr` inchangé ; `seed:rituals`
idempotent et produit les 3 langues.
**Risque** : moyen (DB + query). Rollback : flag de lecture locale-aware, défaut FR.

#### 8A.2 — Wizard checkout embarqué + funnel (tâche 7E-13) · *priorité P0, CRITIQUE*
**Symptôme** : footer légal du wizard en FR (« Politique de confidentialité/cookies/livraison »,
« Mentions légales », « FAQ — Service client ») sur `/ar/kit` et tout le funnel `/panier`, `/merci`,
steps lead/address.
**Cause** : sous-système i18n séparé `lib/checkout/i18n` (`dictionary.ts` → `use-wizard-translation`,
`language: 'fr' | 'ar'`, défaut `fr`). `ar.ts` **existe**, **pas de `en.ts`**.
`KIT_FORM_CONTEXT.language` n'est pas renseigné → défaut `fr`.
**Travaux** :
1. **Câbler la locale active** : `KitCommanderSectionBound` (a déjà `locale`) → `KitCommanderSection`
   → `KIT_FORM_CONTEXT.language = locale === 'ar' ? 'ar' : 'fr'` (en→fr tant que `en.ts` absent).
2. **Funnel standalone** (`/panier`, `/merci`) : injecter `language` depuis la route locale.
3. **Authoring `en.ts`** : dictionnaire checkout EN complet (parité de shape avec `fr.ts`/`ar.ts`).
4. **Persistance** : vérifier que `language` stocké avec le lead/session reflète la vraie locale
   (amélioration, pas régression).
**Acceptation** : `/ar/kit` wizard 100 % AR (dir rtl) ; **commande de test end-to-end OK** (lead →
address → thank_you, écriture DB) sur les 3 locales ; aucune régression du tunnel FR.
**Risque** : **ÉLEVÉ — funnel de commande = revenu.** Obligatoire : test E2E Playwright du tunnel
(`@live-*`) avant merge. Flag de rollback `CHECKOUT_I18N_ENABLED`.

#### 8A.3 — PriceBlock « Vous économisez X MAD · Y % » (tâche 7E-15) · *priorité P1*
Petit string FR hardcodé dans PriceBlock (ProductFeed). Clé ICU
`marketing.kit.product_feed.value_breakdown.savings_phrase` (`{amount}`, `{percent}`) + wiring via
l'overlay `localize.ts`. **Risque** : faible.

---

### Phase 8B — Audit + finition des **autres pages** (couverture site)

Méthode **systématique et reproductible** (identique à `/kit`), une page à la fois :
1. **Scan** : lancer `pnpm i18n:scan-fr -- /ar/<route>` (script §8C.1) → liste catégorisée.
2. **Catégoriser** chaque leak : *chrome UI* (clé existe → wiring) / *contenu* (mock locale-aware) /
   *données* (seed) / *hardcodé* (clé à ajouter).
3. **Corriger** via les patterns §2. 4. **Rebuild + re-scan = 0**. 5. **Vérif FR non-régression**.

**Routes à traiter** (ordre conseillé, du plus visible au moins) :
- `/` (home) — hero/gestes/manifeste/avis/journal extracts
- `/journal` + `/journal/[slug]` (articles : contenu CMS locale-aware)
- `/maison`
- `/contact` (déjà POC — re-scan complet)
- `/rituel`
- `/panier`, `/merci` (couplé 8A.2)
- Pages légales (`/mentions-legales`, CGV, confidentialité, cookies, livraison, retours)
- `404` / `not-found`, `robots`, `sitemap`, `feed.xml` (hreflang)
- Header / Footer (chrome global — re-scan, footer legal links)

**Livrable** : `PHASE-8-AUDIT-PAGES.csv` (route × locale × #leaks × statut).

---

### Phase 8C — Robustesse & garde-fous (anti-régression) · *transverse, P0*

#### 8C.1 — Scanner FR réutilisable + gate CI
Créer `apps/web/scripts/i18n-scan-fr.mjs` (industrialise le scan ad-hoc utilisé en Phase 7) :
- Démarre le build prod, fetch `/ar/<routes>` et `/en/<routes>`, **strip `<script>`/`<style>`**
  (ignore flight-data sérialisé), extrait le texte visible.
- Détecte tokens FR (liste de mots-fonction + diacritiques) **hors whitelist marque**.
- `exit 1` si trouvé, rapport `route → tokens → contexte`.
- Script npm `i18n:scan-fr` + job CI (bloquant sur PR touchant `app/[locale]`, `messages`, `components`).

#### 8C.2 — Règle lint « pas de texte brut dans le JSX i18n »
ESLint custom rule (ou `eslint-plugin-i18next`/`react/jsx-no-literals` ciblé) sur
`src/components/**` : interdit `<Tag>Texte brut</Tag>` (force `{t(...)}` ou prop). Whitelist
ponctuation/marque. Avertit dès l'écriture (debuggabilité).

#### 8C.3 — Complétude & cohérence des catalogues
- Test `messages-parity.test.ts` : `fr`/`ar`/`en` ont **le même ensemble de clés** (diff = échec).
- `getRequestConfig` `onError`/`getMessageFallback` : en **dev**, *throw* sur clé manquante ;
  en **prod**, log + fallback FR balisé `⟦key⟧` (jamais une string FR muette).
- `_meta.completeness_pct` recalculé en CI.

#### 8C.4 — Tests E2E par locale
`apps/web/e2e/full-translation.spec.ts` : matrice **routes × {fr,ar,en}** :
- assert `html[lang]` + `dir` corrects, switcher présent & actif.
- assert **aucun token FR** sur `/ar|/en` (réutilise la liste 8C.1).
- assert H1 attendu par locale (golden values).
Tag `@i18n` ; intégré au CI.

#### 8C.5 — Visual regression (RTL)
Baselines Playwright screenshots `/ar` (RTL) des routes clés ; diff bloquant. Détecte
chevauchement/troncature dus à la longueur AR/EN.

---

### Phase 8D — UI/UX premium (qualité d'interface)

> S'appuie sur PHASE-4-RTL-STRATEGY + `05-ui-ux-design/*`. Objectif : que `/ar` soit **aussi
> soigné** que `/fr`, pas juste « traduit ».

1. **RTL impeccable**
   - Audit logical properties (`ms/me/ps/pe`, `text-start/end`) sur tous les composants touchés
     Phase 8 (réutiliser `scripts/audit-rtl-classes.py`).
   - Miroir des éléments directionnels (flèches CTA `↗/→`, carousels, steppers, chevrons accordéon).
   - Vérifier alignements prix/nombres (tabular-nums, sens de lecture), listes, timelines.
2. **Typographie arabe**
   - Cairo/Tajawal chargées (déjà conditionnel `html[lang='ar']`) — vérifier `line-height`,
     interlettrage, pas de justification cassée, ponctuation arabe (، ؛ …).
   - Échelle typographique : titres AR souvent plus denses → vérifier `text-wrap:balance`, hauteurs.
3. **LocaleSwitcher** (cf. `05-ui-ux-design/locale-switcher-ui.md`)
   - États : actif/hover/focus, navigation clavier complète, `aria-current`, menu `aria`.
   - Persistance de préférence (cookie `NEXT_LOCALE`) + redirection middleware cohérente.
   - Transition douce (pas de saut de layout au switch), conservation du path + query.
4. **Zéro flash** — re-vérifier le script SSR inline `lang/dir` sur **toutes** les routes (pas juste home).
5. **Accessibilité** — axe sur les 3 locales par route ; ordre de focus correct en RTL ; `lang` sur
   sous-arbres si langue mixte (ex. terme latin dans phrase AR via `<span lang="en">`).
6. **Cohérence responsive** — mobile/desktop × RTL : pas de débordement, images localisées
   (alt traduits — déjà partiellement), OG images par locale.

---

### Phase 8E — Mécanisme de seed (préservation + extension remote) · *P0 pour le deploy*

> **Contrainte explicite** : le mécanisme de seed doit être **préservé** et servir au déploiement
> remote. Les mocks (`kit.ar.ts`…) sont pour le **dev local** ; en **prod**, le contenu vient de la
> **DB seedée**. Il faut donc la **parité mocks ↔ seed**.

1. **Préserver l'existant** (ne rien casser) :
   - `seed:i18n-bindings` (→ `component_field_bindings`, colonne `locale`) — cf. `PHASE-6-SEED-RUNBOOK.md`.
   - `seed-rituals.ts`, `seed-components.ts`, `seed-seo.ts`, `seed-products.ts`.
2. **Étendre pour AR/EN** :
   - `seed-i18n-bindings` : générer les bindings **AR + EN** (pas seulement FR) à partir des
     catalogues `messages` + CSV `03-seed-data/component-bindings-ar.csv`.
   - `seed-rituals` : variantes AR/EN (8A.1).
   - SEO / products : champs localisés si la prod doit servir des `title/description` par locale
     (cf. 7E-12 — aujourd'hui fallback messages ; en prod, override admin par locale).
3. **Parité mocks ↔ seed** : un test/script vérifie que le contenu AR/EN des mocks dev correspond
   (clés/ids) aux données seedées, pour éviter « ça marche en dev, FR en prod ».
4. **Runbook remote** (`PHASE-8-SEED-REMOTE-RUNBOOK.md`) : ordre des seeds, idempotence,
   `--dry` de pré-vol, vérifications post-deploy (scanner FR contre l'URL de staging).
5. **CI** : `seed:i18n-bindings:dry` en pré-vol PR ; smoke seed sur base éphémère.

---

## 4. Séquencement & dépendances

```
8C.1 (scanner)  ──►  outil utilisé par 8A, 8B, 8C.4, 8E.4   [À FAIRE EN PREMIER]
8A.3 (PriceBlock)         ── quick win, indépendant
8A.1 (RitualsModule)      ── dépend de 8E (seed rituels)
8A.2 (Checkout)           ── CRITIQUE, dépend de tests E2E funnel ; en.ts requis
8B  (autres pages)        ── après 8C.1 (scanner) ; parallélisable par page
8C.2/8C.3/8C.4/8C.5       ── transverses, à activer tôt (garde-fous)
8D  (UI/UX)               ── après corrections wiring (sinon on polit du FR)
8E  (seed remote)         ── socle de 8A.1 ; finalisé avant deploy
```

**Ordre conseillé** : `8C.1` → `8A.3` → `8E` (socle seed) → `8A.1` → `8A.2` (+E2E) → `8B` (page par
page, re-scan à chaque fois) → `8C.2/3/4/5` (garde-fous durcis) → `8D` (polish) → **gate final 100 %**.

---

## 5. Risques & rollback

| Risque | Mitigation |
|---|---|
| **Checkout funnel cassé (revenu)** | Flag `CHECKOUT_I18N_ENABLED`, test E2E commande obligatoire avant merge, déploiement progressif |
| Régression FR silencieuse | Garde FR-default (§2.4) + scanner FR exécuté **aussi** implicitement (FR = golden), tests parité |
| `resolveKit*` refactor casse l'affichage FR | Garde `=== DEFAULT_LOCALE ? resolverFR() : content` ; vérif `/fr` byte-identique |
| Seed prod ≠ mocks dev | Test de parité mocks↔seed (§8E.3) |
| Clé manquante → string brute affichée | `onError` throw en dev, fallback balisé en prod (§8C.3) |
| Build hang (fonts Google en sandbox) | Build avec réseau autorisé ou fonts auto-hébergées (cf. note infra) |

> **Note infra** : les builds Phase 7 ont calé sur le fetch `fonts.gstatic.com` quand le réseau est
> coupé. Envisager `next/font/local` (auto-hébergement Cairo/Newsreader) → builds déterministes,
> offline, plus rapides. *(amélioration robustesse, optionnelle mais recommandée)*

---

## 6. Checklist de validation finale (gate 100 %)

- [ ] `pnpm i18n:scan-fr` = **0** sur **toutes** les routes `/ar/*` et `/en/*`.
- [ ] `full-translation.spec.ts` vert (routes × 3 locales).
- [ ] `messages-parity.test.ts` vert ; `_meta.completeness_pct = 100` × 3.
- [ ] Tunnel de commande E2E OK sur `/fr`, `/ar`, `/en`.
- [ ] axe vert × 3 locales sur routes clés ; visual baselines RTL OK.
- [ ] `/fr/*` byte-identique (diff copie = ∅).
- [ ] `seed:i18n-bindings` + `seed:rituals` produisent AR/EN, idempotents, runbook remote validé en staging.
- [ ] `pnpm typecheck` + `pnpm lint` (incl. règle no-raw-jsx) clean.

---

## 7. Backlog (mapping tâches)

| ID | Tâche | Phase | Prio | Risque |
|---|---|---|---|---|
| 7E-15 | PriceBlock « Vous économisez » | 8A.3 | P1 | faible |
| 7E-11 | RitualsModule seed + labels | 8A.1 | P0 | moyen |
| 7E-13 | Wizard checkout i18n + en.ts | 8A.2 | P0 | **élevé** |
| 8B-* | Audit + fix home/journal/maison/contact/rituel/légales | 8B | P0 | moyen |
| 8C-1 | Scanner FR + gate CI | 8C | P0 | faible |
| 8C-2 | ESLint no-raw-jsx-text | 8C | P1 | faible |
| 8C-3 | Parité catalogues + onError dev | 8C | P0 | faible |
| 8C-4 | Playwright full-translation | 8C | P0 | faible |
| 8C-5 | Visual regression RTL | 8C | P2 | faible |
| 8D-* | RTL/typo/switcher/a11y polish | 8D | P1 | faible |
| 8E-* | Seed AR/EN + parité + runbook remote | 8E | P0 | moyen |

> **Estimation indicative** : 8A (~1-1.5 j), 8B (~2-3 j selon profondeur articles), 8C (~1 j),
> 8D (~1-1.5 j), 8E (~1 j). Le chemin critique réel = 8A.2 (checkout, à sécuriser) + 8B (volume).
