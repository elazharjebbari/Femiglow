# 02 — Vision, objectifs et KPIs

## 1. Vision

Faire du système SEO de FemiGlow un **outil éditorial de la maison** : un éditeur qui ouvre une fiche produit ou un article doit pouvoir piloter sa métadonnée, prévisualiser le rendu Google et Facebook, et publier sans intervention technique. Le système doit être aussi rigoureux qu'un CMS éditorial moderne (Sanity, Contentful) tout en restant intégré au monorepo Next.js du projet.

Trois principes :

1. **Le SEO suit le composant**. Les composants pilotés par CMS (hero, slots) doivent pouvoir porter leur propre SEO sans passer par une seconde voie. Le scope `'component'` du schéma doit être pleinement opérationnel.
2. **Aucune métadonnée orpheline**. Chaque page publique a un title, une description et une canonical définis par cascade ; aucune route ne doit hériter par accident d'une métadonnée d'une autre.
3. **La maison reste discrète**. Ton éditorial, pas de superlatifs, pas d'emoji, pas d'urgence — le SEO ne contredit pas la charte éditoriale.

## 2. Objectifs mesurables (OKR du plan)

| Objectif | Indicateur | Cible 2026-Q3 |
|---|---|---|
| Couverture metadata explicite | % de pages publiques avec metadata override ou settings non `default` | 100 % (vs ~80 % aujourd'hui à cause de F-01/F-02) |
| Score linter SEO moyen | Moyenne du score audit sur les overrides publiés | ≥ 85/100 |
| Temps moyen édition SEO | Temps médian entre ouverture éditeur et publication (mesuré via analytics admin) | < 90 s pour une mise à jour simple |
| Couverture tests SEO | Lignes couvertes par les tests dans `lib/seo/**` et `components/admin/seo/**` | ≥ 90 % |
| Régression rendu | Nombre de tests E2E SEO passants en CI sur chaque PR | 100 % (zéro flake) |
| Latence OG image dynamique | P95 du temps de réponse `/api/og/[template]` | < 800 ms (cache miss) ; < 50 ms (cache hit) |

## 3. Principes de design

### 3.1 Backend

- **Pure functions** au cœur. `resolveSeoMetadata` et les helpers de validation Zod ne font pas d'I/O hors du repository — testables sans setup DB.
- **Repository pattern** maintenu. Tout accès Drizzle passe par `lib/db/queries/seo.ts` ; les API routes ne touchent pas directement Drizzle.
- **Validation stricte au bord**. Zod sur chaque entrée API ; les types TypeScript sont dérivés des schemas (`z.infer`).
- **Cache par tag, jamais par path** quand on a le choix. Plus précis, plus robuste.
- **Tracer les changements**. Toute mutation SEO produit un `auditEvent` + un `seoAuditSnapshot` (déjà en place, à conserver).

### 3.2 Frontend public

- **`generateMetadata` ne lance pas d'exceptions**. En cas de DB down, retombe sur defaults code (déjà en place via failsafe).
- **JSON-LD typé**. Pas de `as any` ; types `schema-dts` ou helpers locaux pour les types schema.org.
- **Pas d'effet de bord en module scope**. Les helpers SEO ne lisent pas `process.env` en module scope — uniquement dans les fonctions appelées au runtime de la requête.

### 3.3 Admin UI/UX

- **Aucun champ obligatoire caché**. Tous les champs requis sont visibles d'emblée ; les optionnels sont dans une section repliée.
- **Preview au-dessus du fold**. Le preview SERP, Facebook et Twitter restent visibles pendant l'édition (sidebar ou colonne droite).
- **Feedback synchrone**. Save bouton désactivé si dirty=false, indicateur de validité Zod immédiat.
- **Aucune action destructive sans confirmation explicite**. Delete unique → confirm. Bulk delete → confirm avec saisie du nombre attendu.
- **Accessibilité**. WCAG AA, focus visible, navigation clavier complète, labels associés à tous les inputs.
- **Charte FemiGlow**. Palette Sauge/Crème/Encre, Cormorant Garamond pour titres, Inter pour UI, aucun emoji.

### 3.4 Tests

- **Pyramide classique**. Beaucoup d'unit (Vitest), moyennement d'intégration (Vitest + MSW + drizzle-mock ou test-db éphémère), peu de E2E (Playwright sur les parcours critiques).
- **Test-first sur la logique métier**. `resolveSeoMetadata`, règles linter, validation Zod : tests écrits avant implémentation.
- **MSW pour les fetch admin**. L'éditeur SEO consomme `/api/admin/seo/*` ; MSW permet de tester l'éditeur sans backend live.
- **Snapshots pour le JSON-LD**. Verrouille la structure, on review les diffs au merge.
- **Playwright sur 3 parcours** : édition SEO produit, publication, restauration depuis snapshot.

## 4. Anti-objectifs explicites

Ce plan **ne** vise **pas** à :

- Réécrire le système SEO existant. Il est solide ; on étend ce qui manque.
- Introduire un CMS tiers. Tout reste dans le monorepo Next.js + Drizzle.
- Optimiser le contenu éditorial (densité, ancres, internal linking). Sujet distinct.
- Faire de la veille SEO active (suivi positions, audit concurrentiel). Sujet distinct, postérieur à la livraison.
- Couvrir l'i18n applicative (locale switch, URLs préfixées). Le schéma multi-locale est prêt, l'UI hreflang est planifiée, mais le switch utilisateur reste hors périmètre.

## 5. Critères de succès global

Le plan est considéré comme livré quand :

1. Les findings P0 (F-01, F-02, F-03) sont fermés en production.
2. Les findings P1 (F-04 à F-08) sont fermés sur `main` avec tests verts et documentation à jour.
3. La couverture de tests sur `lib/seo/**` et `components/admin/seo/**` est ≥ 90 %.
4. Le runbook `09-runbook-execution.md` a été exécuté de bout en bout sans étape sautée.
5. Un éditeur non-développeur peut piloter le SEO d'une page nouvelle (création override, publication, vérification rendu) en moins de 90 s sans aide.
6. Le header `x-seo-source` est posé sur chaque réponse HTML public et permet de vérifier la source de résolution.
7. Une page de référence (`/kit`) sert de canary : le snapshot JSON-LD et metadata est figé en test E2E, toute régression bloque le merge.

## 6. Gouvernance

- **Décideur** : Elazhar Jebbari (fondateur, valide les choix de design et la priorisation).
- **Implémentation** : Claude Code en mode autonomous phases (cf. mémoire `feedback_autonomous_phases`), pas de validation intermédiaire entre phases sauf rupture explicite.
- **Validation** : passage runbook + smoke tests prod + revue des KPI sous 7 j après livraison.
- **Rollback** : chaque phase peut être annulée via `git revert <phase-commit>` ; les feature flags `NEXT_PUBLIC_SEO_COMPONENT_OVERRIDES` et `NEXT_PUBLIC_SEO_OG_DYNAMIC` permettent un kill-switch runtime sans redéploiement.
