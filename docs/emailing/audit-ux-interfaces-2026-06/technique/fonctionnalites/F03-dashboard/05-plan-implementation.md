# F03 — Plan d'implémentation (phase P2.1)

> Ordre dicté par la pyramide de tests : on **étend le contrat partagé d'abord**
> (summary), on verrouille par l'intégration, puis on remonte vers le pur, le
> composant, et enfin l'orchestration client (auto-refresh). Chaque étape est
> mergeable seule (additive, pas de breaking change), gate G1..G9 verte.

---

## Étape 1 — Étendre le summary + intégration (fondation)

**Pourquoi en premier** : le tri-état, les tendances et le drill-down dépendent
TOUS du contrat summary. On le solidifie avant de construire dessus.

**Changements**
1. `lib/mail/transactional/summary.ts` :
   - `SummaryWindow` += `'30d'` ; `windowToMs` += cas `30d` (2 592 000 000).
   - `SummaryResult` += `sent: number` (status IN sent/delivered/opened/clicked).
   - `SummaryResult` += `webhookLastSuccessAt: string | null` (`max(ts)` sur
     `email_event` WHERE `type='delivered'`).
   - `comparison` activée pour `30d` aussi (déjà `24h|7d`).
2. `lib/mail/transactional/schemas.ts` : `SummaryQuerySchema.window` enum +=
   `'30d'`.
3. `app/api/admin/emails/transactional/summary/route.ts` : aucun changement de
   logique (l'enum élargi suffit) ; fallback inchangé.

**Tests d'abord (TDD)** : `F03-I-001..011` — bornes SQL des fenêtres (lignes
posées à cheval, `gte` inclusif), conformité Zod, enum 30d accepté / invalide
rejeté, 1h non régressé (cockpit), `webhookLastSuccessAt`, auth, comparaison 30d.

**Gate** : G9 (contrat) + non-régression cockpit (suite emails globale G2).

---

## Étape 2 — Logique pure tri-état + tendances (unitaire)

**Pourquoi ensuite** : pur, sans I/O, sans DOM — rapide à verrouiller, sert de
socle aux composants.

**Changements** (`app/admin/emails/kpi-format.ts`)
- `deliveredState({ sent, delivered, webhookLastSuccessAt })` → machine 3 états
  (E1 tracked / E2 silent / E3 untracked), cf. `02-spec-technique.yaml`.
- `fmtClock(iso)` → `HH:MM` (Casablanca) ou `JJ/MM HH:MM` si > 24 h.
- `trendLabel(pct, periodLabel, polarity)` → texte + ton sémantique par polarité.
- `parseWindow(raw)` / `windowLabel(w)` helpers fenêtre (défaut `7d`).

**Tests d'abord** : `F03-U-001..024` — dont la **table de vérité exhaustive**
`sent × delivered × webhook` (`F03-U-009`), pct anti-division-par-zéro, polarité
des tendances.

**Gate** : G4 coverage écran ≥ 80 %.

---

## Étape 3 — Composants présentationnels

**Pourquoi ensuite** : consomment l'étape 2, montables en jsdom sans timers.

**Changements**
- `KpiCards.tsx` : carte Livrés branchée sur `deliveredState` (remplace le
  sous-texte ambigu) ; bandeau silence recalculé sur la fenêtre ; cartes
  propagent `&window=` ; tendances + `<Sparkline>` ; carte En attente avec âge.
- `Sparkline.tsx` (nouveau) : `<svg>` `aria-hidden`, 12 points.
- `HealthBadge.tsx` : deep-links `?from=health&check=…` + `&window=` ; pied
  `rose-800` (DASH-11).
- Table « Derniers envois » : `<EmptyState>` socle (DASH-05) + `Pill` socle
  (TRV-07, libellé « Bounce permanent »).
- `loading.tsx` (skeleton `role=status`) ; `error.tsx` message neutre (DASH-09).
- Sélecteur de fenêtre `WindowSelector.tsx` (radiogroup, pousse `?window=`).

**Tests** : `F03-C-001..046` + `F03-N-001..006` (grille réseau sur le fetch
summary client : 200/401/500/hang/network — dashboard reste lisible avec les
dernières données + bandeau, jamais de faux succès).

**Gate** : G6 axe (jsdom), G7 grille réseau 6/6, G4 coverage.

---

## Étape 4 — Auto-refresh client (orchestration)

**Pourquoi en dernier** : le plus sensible au flakiness (timers, visibilité) ; on
le branche une fois tout le reste vert.

**Changements** (`DashboardAutoRefresh.tsx`, évolution de `DashboardFreshness.tsx`)
- `setInterval(router.refresh, 60_000)` + intervalle d'âge 1 s.
- `visibilitychange` : pause du tick 60 s onglet caché ; refresh immédiat au
  retour ; l'âge court en continu.
- nettoyage des deux intervalles au démontage.
- bandeau « rafraîchissement impossible — figé à HH:MM » si refresh raté.

**Tests** : `F03-C-014..021` avec `vi.useFakeTimers` (exactement 1 refresh à 60 s,
0 onglet caché, âge qui court, démontage propre).

**Gate** : G1 batterie F03 100 % ; budget 0 flaky.

---

## Étape 5 — E2E + a11y de page

`emails-dashboard.spec.ts` (SM-F03-02) + extension `emails-degraded.spec.ts`
(SM-F03-01/03/04 + astreinte santé E-005), axe Playwright (`F03-A-001/002`).

**Gate** : G8 scénarios métier de la phase 100 % vert.

---

## Risques & mitigations

| Risque | Impact | Mitigation |
|--------|--------|------------|
| **Charge requêtes 30 j** | scan large sur `email_outbox` ; sparkline 30 j = 12 buckets de 2,5 j | vérifier/ajouter index sur `email_outbox(created_at)` ; `EXPLAIN ANALYZE` sur les 4 requêtes summary 30 j avant merge (étape 1) ; les `count FILTER` restent index-friendly |
| **`max(ts)` delivered** | scan `email_event` pour `webhookLastSuccessAt` | index `(type, ts)` sur `email_event` ; sinon borner la requête à la fenêtre |
| **Double polling avec le cockpit** | si l'opérateur a dashboard + cockpit ouverts, 2 boucles 60 s tapent summary | suspension `visibilitychange` (onglet caché = 0 fetch) limite le doublon ; documenter que le drain cron est la vraie cadence (60 s) — pas besoin de polling plus serré |
| **Flakiness timers auto-refresh** | tests instables | `vi.useFakeTimers` strict, `vi.advanceTimersByTime`, jamais de `waitForTimeout` ; oracle compteur exact de `router.refresh` |
| **Enum window divergent** | casser le cockpit (1h) | union d'enum unique (`1h|24h|7d|30d`), `F03-I-008` verrouille la non-régression 1h |
| **`router.refresh()` + error boundary** | un refresh sur DB down peut faire clignoter l'error boundary | error boundary `reset()` + données précédentes ; `F03-N-003/005/006` vérifient l'absence de faux succès |

---

## Rollback

- **Granulaire par étape** (chaque étape est additive et mergeable seule).
- Étape 1 réversible : retirer `'30d'` de l'enum et `sent`/`webhookLastSuccessAt`
  de `SummaryResult` ne casse pas le cockpit (champs additifs, ignorés s'ils
  disparaissent).
- **Kill-switch UX** : si l'auto-refresh pose problème en prod, désarmer le tick
  60 s (constante `REFRESH_INTERVAL_MS = 0` → mode bouton manuel seul) restaure le
  comportement historique sans rollback de code.
- Le sélecteur de fenêtre dégrade proprement : `?window=` absent → `7d`, donc un
  retour arrière du composant `WindowSelector` laisse un dashboard 7 j fonctionnel.
- Aucune migration DB destructive (un éventuel index est `CREATE INDEX
  CONCURRENTLY`, droppable sans perte).
