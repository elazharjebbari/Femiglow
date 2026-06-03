# Module 02 — Cockpit transactionnel (`/admin/emails/transactional`)

> Périmètre : l'écran de travail le plus dense de la section. L'opérateur y
> filtre l'outbox, sélectionne en masse, relance/suppress, sauvegarde des vues,
> exporte, et plonge sur la page détail d'un envoi. C'est ici que se concentrent
> les défauts les plus graves de l'audit (faux succès, pagination absente).
>
> Couvre l'inventaire **F-010 → F-019** (cf. `../../01-inventaire-fonctionnalites.csv`).

## 1. Fichiers sources concernés

| Rôle | Chemin (sous `apps/web/`) |
|---|---|
| Orchestrateur client | `src/components/admin/emails/cockpit/TransactionalCockpit.tsx` |
| Tableau dense + sélection | `src/components/admin/emails/cockpit/FilteredTable.tsx` |
| Barre d'actions bulk | `src/components/admin/emails/cockpit/BulkActionsBar.tsx` |
| Header KPI + sparklines | `src/components/admin/emails/cockpit/KpiHeader.tsx` (+ hook `useSummary`) |
| Sidebar vues sauvegardées | `src/components/admin/emails/cockpit/SavedViewsSidebar.tsx` |
| Palette ⌘K cockpit | `src/components/admin/emails/cockpit/CommandPalette.tsx` |
| Grammaire de filtres | `src/lib/mail/transactional/filters-parser.ts` |
| Recherche DB | `src/lib/mail/transactional/search.ts` |
| Résumé KPI | `src/lib/mail/transactional/summary.ts` |
| Actions bulk (DB) | `src/lib/mail/transactional/bulk-actions.ts` |
| CRUD vues (DB) | `src/lib/mail/transactional/views-queries.ts` |
| Schémas Zod (frontières) | `src/lib/mail/transactional/schemas.ts` |
| Routes API | `src/app/api/admin/emails/transactional/{search,summary,bulk-retry,bulk-suppress}/route.ts` |
| Routes vues | `src/app/api/admin/emails/views/route.ts`, `views/[id]/route.ts` |
| Page détail | `src/app/admin/emails/transactional/[id]/page.tsx` |
| Action retry unitaire | `src/lib/admin/emails/actions.ts` (`retryOutboxAction`) |

## 2. État cible — comportement optimal attendu

### 2.1 Recherche / filtres (F-010)

Grammaire ⌘K (`filters-parser.ts`), AND implicite (espace), pas de OR en V1 :

| Clé | Valeur | Exemples | SQL cible |
|---|---|---|---|
| `status:` | enum, liste virgules | `status:failed`, `status:pending,sending` | `IN (...)` |
| `to:` | email exact ou glob `*` | `to:a@b.tld`, `to:*@bad.tld`, `to:fatima*` | exact → **ilike insensible à la casse** (état cible) ; glob → `ilike` |
| `template:` | slug ou glob | `template:welcome`, `template:cart-*` | idem |
| `source:` | source | `source:api.contact` | idem |
| `after:` / `before:` | ISO, mots-clés (`today`/`yesterday`/`now`), offsets (`-7d`,`-1h`,`-30m`) | `after:-24h` | `>=` / `<=` sur `created_at` |
| `attempts:` | opérateur+nombre | `attempts:>3`, `attempts:<=2`, `attempts:0` | comparateur |
| `has:error` | flag | `has:error` | `last_error IS NOT NULL` |

Token non reconnu → **freetext** (match `to_email` OU `to_name` OU `template`, ilike).
Tokens hostiles (injection SQL via valeur, glob `%`/`_` littéraux, quotes non fermées,
très long, unicode) doivent être **neutralisés** : `globToSqlPattern` échappe `_`, le
freetext échappe `%`/`_`, les paramètres Drizzle empêchent l'injection.

**État cible du COUNT** : pas de `count(*)` plein scan à chaque frappe. Utiliser
l'estimation `EXPLAIN`/borne sentinelle (`window:'truncated'` quand > seuil) AVANT
le COUNT exact. **Écart audit F-010** : `listOutboxFiltered` fait un `count(*)::int`
complet à chaque recherche (plein scan), et `to:`/`template:`/`source:` exacts utilisent
`eq` (case-sensitive) au lieu d'`ilike` → un opérateur qui tape `To:Fatima@…` rate des lignes.

### 2.2 Pagination (F-011) — **DÉFAUT P0**

`PAGE_SIZE = 50`. `offset` existe en state mais **n'est jamais incrémentable depuis
l'UI** : aucun contrôle « page suivante / précédente », `setOffset` n'est appelé que
pour le reset à 0. L'opérateur est **bloqué aux 50 premières lignes** quel que soit
`total` (qui peut valoir 5 000). **État cible** : contrôles préc./suiv. + indicateur
`offset+1–offset+rows.length sur total`, bornes correctes (pas de page < 0, pas de page
au-delà de `ceil(total/PAGE_SIZE)`), reset à la page 1 sur changement de filtre/tri.

### 2.3 Sélection multiple + select-all (F-012)

`FilteredTable` : checkbox/ligne, shift+click range, checkbox d'en-tête `select-all`
(toggle), état `indeterminate` quand partiel. **Écart audit** : `select-all` ne couvre
que **la page visible** (50) sans avertir l'opérateur qu'il y a plus de lignes que
sélectionnées. **État cible** : si `total > rows.length`, afficher « 50 sélectionnés sur
cette page · sélectionner les N correspondant aux filtres » (sélection étendue explicite).

### 2.4 Bulk retry (F-013) — **DÉFAUT P0 (faux succès)**

`bulk-actions.ts#bulkRetry` est correct côté serveur : il classe chaque id en
`retried` / `skipped` avec raison (`not_found` / `wrong_status`), n'autorise que
`failed`/`dlq`/`bounced_soft`, plafonne à 500. **Mais côté UI** (`TransactionalCockpit
.handleBulkAction`) le `fetch` n'inspecte **pas `res.ok`** : sur 401/422/500 la promesse
résout quand même, la sélection est vidée (`setSelected(new Set())`) et un re-fetch
masque l'échec → **faux succès**. **État cible** : lire `res.ok`, afficher le résultat
partiel (`X relancés, Y ignorés (raison)`), conserver la sélection en cas d'erreur, bouton
réessayer. C'est la cible directe de la **grille d'échecs 5 points** (cf. `02-architecture-tests.md`).

### 2.5 Bulk suppress (F-014) — **DÉFAUT P0**

`bulkSuppress` insère dans `email_suppression` (ON CONFLICT DO NOTHING) + passe les rows
`suppressed`. **Écarts** : (a) même faux succès UI que retry ; (b) **ne blockliste pas
dans Listmonk** → la cible peut encore recevoir des campagnes. **État cible** : propagation
Listmonk (ajout blocklist) vérifiée, confirmation destructive honorée, comptes
`suppressed`/`skipped` affichés, suppression effective sur transactionnel ET campagne.

### 2.6 KPI header + sparklines + tendances (F-015) — **DÉFAUT P1**

`KpiHeader` : 4 cartes delivered/queued/failed/hardBounced, sparkline SVG 12 buckets,
tendance vs J-1, mode alerte (failed ≥ seuil OU hardBounced > 0). **Écarts** :
- **Sémantique couleur inversée** : `Trend` rend tout `pct > 0` en **emerald** → une
  **hausse d'échecs s'affiche en vert ↑** (faux signal rassurant). État cible : pour la
  carte *Échecs*/*Hard bounces*, `pct > 0` = **rouge** (mauvais), `pct < 0` = vert.
- **Sparkline « En file » trompeuse** : la carte *queued* reçoit `deliveredSpark`
  (données delivered), pas les données queued. État cible : chaque sparkline = sa métrique.

### 2.7 Vues sauvegardées (F-016) — **DÉFAUT P1**

`SavedViewsSidebar` + `views-queries.ts` (CRUD DB correct, séparation système/own,
soft-delete). **Écarts UI** : `handleSelectView` est un **no-op** (highlight seul, ne
charge **pas** les filtres) ; `onCreate` = `window.alert` stub ; rename/delete câblés en
fetch mais sans gestion d'échec. **État cible** : sélectionner une vue **applique
réellement** son `filterState` (filtres + tri + colonnes) ; création via wizard persistée ;
CRUD avec feedback d'erreur.

### 2.8 Export CSV (F-017) — **DÉFAUT P2**

Action `export` = `window.alert('… à implémenter')`. **État cible** : génération CSV des
lignes sélectionnées (ou du résultat filtré), échappement correct (virgules, guillemets,
retours ligne), téléchargement déclenché, encodage UTF-8 BOM pour Excel fr.

### 2.9 Page détail (F-018)

`/transactional/[id]` : métadonnées, preview HTML (`iframe sandbox=""`), timeline events
(`email_event` desc), payload JSON, **retry unitaire** via `retryOutboxAction` (server
action avec `revalidatePath` — **fonctionnel**, contraste avec le bulk). `canRetry` =
status ∈ {failed, dlq, bounced_soft}. État cible : transitions de statut affichables dans
la timeline (sent→delivered→opened…), 404 propre sur id inconnu.

### 2.10 Command palette cockpit (F-019)

`CommandPalette` (cmdk) : input live-parsé via `parseFilters`, suggestions `status:`,
preview des filtres résolus, erreurs de parsing comptées, saved views, actions. Enter
applique (`onApply(parseResult)`). État cible : Esc ferme, ↑/↓ navigue, application réelle
des filtres dans le tableau.

## 3. Oracles transversaux du module

1. **Zéro faux succès** : toute action réseau qui échoue (401/422/500/timeout/network)
   produit un message d'erreur visible ET conserve la sélection. (grille d'échecs 5 pts)
2. **Résultat partiel honnête** : `retried/skipped` affichés tels quels, raisons incluses.
3. **Pagination réelle** : on peut atteindre la ligne 51+ ; bornes respectées.
4. **Sémantique couleur** : hausse d'échecs = rouge ; chaque sparkline = sa métrique.
5. **Vue appliquée** : sélectionner une vue change les lignes affichées, pas juste un highlight.
6. **Propagation suppression** : un email suppressé ne reçoit plus NI transactionnel NI campagne.
7. **Robustesse parsing** : entrées hostiles neutralisées, jamais d'injection.

## 4. Écarts connus vs état cible (résumé audit, ciblés par les tests)

| Réf | Écart | Tests de non-régression |
|---|---|---|
| F-013 | Bulk retry avale 401/422/500 → faux succès, sélection vidée | `CKP-MSW-040..045` |
| F-014 | Bulk suppress idem + pas de blocklist Listmonk | `CKP-MSW-050..056`, `CKP-DB-058` |
| F-011 | Pagination absente (offset non modifiable, 50 max) | `CKP-MSW-020..028` |
| F-012 | Select-all limité à la page sans avertissement | `CKP-MSW-032..034` |
| F-015 | Hausse échecs en vert ↑ ; sparkline queued=delivered | `CKP-MSW-060..064` |
| F-016 | Saved views no-op + create=alert | `CKP-MSW-070..076` |
| F-017 | Export CSV = window.alert | `CKP-MSW-080..083` |
| F-010 | COUNT plein scan + filtre exact case-sensitive | `CKP-UNIT-005`, `CKP-DB-018` |

Voir `test-matrix.csv` (≥ 70 lignes), `scenarios-metier.md`, `parcours-incident.puml`,
`specs/cockpit-bulk-actions.msw.test.tsx`, `specs/cockpit-pagination.msw.test.tsx`,
`specs/e2e-cockpit-incident.spec.ts`.
