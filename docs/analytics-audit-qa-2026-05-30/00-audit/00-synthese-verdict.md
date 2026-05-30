# 00 — Synthèse & verdict d'audit

> Question posée : les systèmes analytics **Funnel / CTA / Checkout / Insights** sont-ils
> **optimaux, fonctionnels, précis, corrects** ? Réponse argumentée ci-dessous, preuves `file:line`
> dans les fiches `02`→`06` et le registre `findings-register.csv`.

---

## 1. Verdict global

| Critère | Note | Verdict |
|---|---|---|
| **Fonctionnel** (l'opérateur obtient ce qu'il demande) | 🟠 5/10 | **NON validé** — bug de réactivité des filtres (Funnel/CTA/Checkout) |
| **Précis** (les chiffres sont justes) | 🟠 5,5/10 | **NON validé** — revenu CTA ÷100, fuseau horaire, bords de fenêtre |
| **Correct** (la sémantique est cohérente) | 🟡 6,5/10 | **partiel** — modèles de funnel incohérents, KPI mal nommés |
| **Optimal** (perf/scalabilité/архитектura) | 🟡 6/10 | **partiel** — agrégation in-memory, double fetch, matviews sous-exploitées |
| **Robuste** (gestion erreurs/edge cases) | 🟢 7,5/10 | bon — consent gate, fallback, Zod, états vides/erreur présents |
| **Testabilité actuelle** (unit) | 🟢 8/10 | excellente couverture unitaire des queries et primitives |
| **Couverture UI / opérateur** | 🔴 3/10 | quasi absente — c'est l'objet de la partie tests |

**Score d'aptitude « production-grade » : 5,8 / 10.** Le socle est sain ; **5 défauts bloquants ou
majeurs** doivent être corrigés et **verrouillés par des tests UI** avant de pouvoir affirmer que
ces tableaux de bord sont fiables pour piloter le business.

> Conclusion : **je ne valide pas** ces systèmes comme « optimaux et précis » en l'état. Ils sont
> **proches** de l'être : l'essentiel des erreurs est concentré et corrigeable rapidement (voir
> `30-plan-action/`).

---

## 2. Les 5 défauts à corriger en priorité

| ID | Sévérité | Système | Défaut | Preuve | Conséquence opérateur |
|---|---|---|---|---|---|
| **AF-01** | 🔴 P0 | Funnel, CTA, Checkout | **Les filtres ne rafraîchissent pas l'affichage.** Le dashboard client fige `useState(initialFilters)` et son `useEffect([filters])` ne se redéclenche jamais ; il ne relit jamais l'URL (`useSearchParams`) après le mount. | `cta/CtaDashboard.tsx:33`, `checkout/CheckoutDashboard.tsx:31`, `funnel/FunnelDashboard.tsx:47` | L'opérateur change « 7 jours » ou « Desktop » → **les chiffres ne bougent pas**. Décisions prises sur des données figées. |
| **AF-02** | 🔴 P1 | CTA | **Revenu attribué ÷ ~100.** Les events checkout émettent `value` en **MAD (unité majeure)** (`checkout-events.ts:21` Enhanced Ecommerce) ; `cta.ts` le lit puis le stocke comme `valueCents` et `formatCurrency` divise par 100. | `cta.ts:297` + `format.ts:53` | « Revenu attribué » affiché ≈ 100× trop bas (1,99 MAD au lieu de 199 MAD). KPI revenu faux. |
| **AF-03** | 🟠 P1 | Funnel vs Checkout | **Deux modèles de funnel incompatibles.** `funnel.ts` est **cumulatif strict** (`view∧engage∧cta∧checkout∧purchase`) ; `checkout.ts` compte chaque étape **indépendamment** (BOOL_OR). | `funnel.ts:181`, `checkout.ts:143` | Sur Checkout, une étape peut dépasser la précédente (**progression > 100 %**) ; sémantique « drop-off » différente d'un onglet à l'autre. |
| **AF-04** | 🟠 P1 | Transverse | **Fuseau horaire serveur.** `startOfDay` applique `setHours(0,0,0,0)` en **timezone du process** (UTC sur Vercel) ≠ jour Maroc (UTC+1). | `filters.ts:181` | « Aujourd'hui » / « Hier » décalés d'1 h : un achat de 00 h 30 (heure Maroc) tombe la veille. |
| **AF-05** | 🟠 P1 | UX transverse | **Filtre Device par défaut = `mobile`** (pas `all`) **et** double barre de filtres sur Insights (modèle `window/env/locale` ≠ `period/device/traffic`). | `filters.ts:40`, `InsightsView.tsx:67` | L'opérateur croit voir **tout le trafic** alors qu'il ne voit que le mobile ; sur Insights, deux barres aux réglages divergents prêtent à confusion. |

---

## 3. Ce qui fonctionne bien (à préserver)

- **Consent-gating RGPD** systématique (`analytics_storage='granted'`) sur toutes les queries.
- **Agrégation session-level** robuste aux doublons/ordre (BOOL_OR par session, `BOOL_OR` logique).
- **Attribution CTA last-click** avec fenêtre 7 j et fallback `anonymous_id` — modèle sain.
- **Time-to-submit** Checkout : filtre bot (<1 s), cap outliers (30 min), percentiles P25/50/75/95.
- **Module Insights** : la **bonne** implémentation de réactivité (`useInsightsFilters` lit l'URL,
  `useInsightsFetch` refetch) — sert de **référence** pour corriger AF-01 sur les autres onglets.
- **Robustesse UI** : états `loading` (skeletons), `EmptyState`, `ErrorState`, exports CSV/PNG,
  drill-down drawer, refresh matview avec lock/status. Primitives factorisées et déjà testées.
- **Validation Zod** des filtres + bornes (`MAX_RANGE_DAYS=366`), TTL localStorage.

---

## 4. Défauts secondaires (P2, voir registre complet)

- **Double fetch au mount** : le RSC précharge les données **et** le client refetch immédiatement
  via l'API (mêmes données recalculées 2×). `FunnelDashboard.tsx:58`.
- **Agrégation in-memory non scalable** : `fetchEvents` fait `SELECT *` de toute la période puis
  agrège en JS ; pour 30 j/90 j/all à fort volume → latence/mémoire. Les matviews existent
  (`matviews.ts`, `mv_cta_performance`) mais **ne sont pas utilisées** par Funnel/CTA/Checkout.
- **`sql.raw()` + `escape()` maison** au lieu de requêtes paramétrées (mitigé par enum Zod en
  amont, mais fragile). `funnel.ts:399`, `cta.ts:391`, `checkout.ts:416`.
- **Filtres invalides → fallback silencieux** sur `DEFAULT_FILTERS` (pas de 400) : l'opérateur peut
  voir « today/mobile » en croyant voir sa sélection. `filters.ts:112`.
- **CTA topPages.purchases** peut ne pas compter un achat dont le clic vient du fallback 7 j
  (page hors période) → incohérence avec les totals. `cta.ts:198`.
- **KPI « submissions » = purchases** (pas « submit ») : nommage trompeur. `checkout.ts:182`.
- **Checkout abandons** : faux positif au bord de fenêtre (begin_checkout en fin de période,
  purchase juste après `to`, non fetché). `checkout.ts:154`.
- **Pas de cache** (revalidate=0, no-store partout) : chaque navigation recalcule tout.

---

## 5. Lecture du reste de l'audit

| Doc | Sujet |
|---|---|
| [`01-architecture-flux.md`](01-architecture-flux.md) | Flux RSC → API → query → DB, modèle de données, diagrammes PUML |
| [`02-systeme-funnel.md`](02-systeme-funnel.md) | Funnel : sémantique, justesse, findings, points à tester |
| [`03-systeme-cta.md`](03-systeme-cta.md) | CTA : attribution, revenu, findings |
| [`04-systeme-checkout.md`](04-systeme-checkout.md) | Checkout : étapes, TTS, erreurs/abandons, findings |
| [`05-systeme-insights.md`](05-systeme-insights.md) | Insights : matviews, refresh, exports, drill-down, findings |
| [`06-transverse-filtres-format-perf.md`](06-transverse-filtres-format-perf.md) | Filtres, formatage, perf, sécurité, a11y |
| [`findings-register.csv`](findings-register.csv) | Registre complet (id, sévérité, preuve, test de non-régression) |
