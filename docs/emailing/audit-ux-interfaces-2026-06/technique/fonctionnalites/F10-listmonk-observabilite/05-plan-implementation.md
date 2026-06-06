# F10 — Plan d'implémentation (phase P5.2)

> Ordre **strict** : la donnée d'abord (migration additive livrée AVANT son
> lecteur, contrainte single-instance), puis l'écrivain qui la peuple, puis les
> consommateurs (badges, santé), enfin les écrans honnêtes (wizard, iframe,
> proxy). Chaque étape est livrable et testable indépendamment ; rien ne casse
> l'existant tant que les badges ne lisent pas encore des colonnes vides.

---

## Étape 0 — Préparatifs de test (factories + handlers)
- `emails.factory.ts` : `makeCampaignLinkSyncState` (+ presets `staleSyncLink`,
  `failedSyncLink`, `neverSynced`, `sentStale`), `makePushSnapshotResult`
  (`partiel`, `zero`), `makeListmonkHealth` (`pingOk/Lent/Down`, `syncKo`).
- Handlers MSW Listmonk (`campaigns.get` succès/503/timeout) + handler du
  re-poll ciblé et du re-fetch listes wizard.
- **Aucune migration encore lue** — ces builders pilotent les tests U/C.

## Étape 1 — Migration des 3 colonnes (LIVRÉE EN PREMIER)
- `drizzle-kit generate` → relire le SQL (3 `ADD COLUMN IF NOT EXISTS`
  nullable, aucun index). Vérifier l'absence de drift `schema-emails.ts` ↔ DB.
- Appliquer sur `femiglow_test` puis `femiglow_emailqa`, puis prod (psql
  transactionnel) — **avant** tout code lecteur. Smoke `SELECT` des 3 colonnes.
- Test d'intégration `schema-drift` vert sur les deux bases.
- **Risque nul** : colonnes inertes tant que personne ne les écrit/lit.

## Étape 2 — Écrivain sync + tests d'intégration (LMK-06)
- Modifier `syncCampaignStatuses()` : `last_sync_attempt_at=now` **systématique**
  (un seul UPDATE/candidat), `ok_at`/`error` exclusifs, troncature 500 car.
  (cf. structure §1 de `01-description.md`).
- Tests **intégration** (F10-I-053..056) sur `femiglow_test`, client Listmonk
  mocké : succès / 503 / timeout / reset error sur succès. Vérifier que `ok`
  reste **inchangé** sur échec (régression la plus subtile).
- Non-régression : la transition de statut reste `isLegalTransition` only ; les
  métriques ne bougent que sur succès. La suite emails globale reste verte.

## Étape 3 — Dérivation + badges (liste & détail) — LMK-02
- Helper pur `deriveSyncBadge(link, now)` → `'none'|'stale'|'failed'` avec la
  table de vérité (terminale ⇒ none). Tests **unitaires** F10-U-001..010
  (toutes combinaisons + seuil 1 h exact + cas terminal).
- Rendu liste (`Pill` conditionnel) + détail (bandeau + `Freshness`) + bouton
  « Réessayer maintenant » câblé sur le re-poll ciblé (action serveur).
- Tests **composant** F10-C-025..037 (badges affichés/absents selon états +
  **grille réseau 6/6** sur Réessayer).

## Étape 4 — Check santé Listmonk (HealthBadge) — LMK-01
- `checks.ts` : ajouter `listmonkPing` (ping `meta.serverInfo()` sous
  `AbortSignal.timeout(3000)` — **timeout court dédié**, pas le 10 s métier) et
  `listmonkSync` (agrégat SQL max(ok)/count(échecs) sur campagnes non
  terminales). Worst-wins avec l'existant.
- Helpers de niveau purs → tests **unitaires** F10-U-013..019.
- `HealthBadge` : 2 nouvelles `CheckLine` avec deep-link `?from=health`. Tests
  **composant** F10-C-020..024. Conformité contrat sur `/health` (F10-I-060).

## Étape 5 — Wizard honnête + push détaillé — LMK-04
- Étape 2 : remplacer le hint inconditionnel par la table
  `(listmonkError, lists.length)` → indispo+Réessayer vs hint normal. Idem
  étape 3 (templates). Bouton Réessayer = re-fetch (grille réseau).
- `PushSnapshotResult` étendu (`attempted/rejected/firstError`) + alerte wizard
  détaillée. Tests **composant** F10-C-038..047.
- **Aucune migration** (le wizard lit `listmonkError` déjà passé en prop RSC).

## Étape 6 — Page iframe + proxy CSP — LMK-03 / LMK-05
- `page.tsx` : bouton nouvel onglet désactivé+tooltip sans env, message ops,
  bandeau piège au-dessus de l'iframe. Tests **composant** F10-C-048..052.
- Proxy : remplacer le strip CSP par resynthèse `frame-ancestors 'self'` ;
  `x-frame-options` toujours retiré. Tests **intégration** F10-I-057..059
  (header présent / x-frame-options absent / 401 sans session).

## Étape 7 — E2E + a11y (clôture)
- Étendre `emails-degraded.spec.ts` (Listmonk port mort déjà en place) avec
  SM-F10-01/02/03 + axe. Gate G8 : 100 % vert.

---

## Risques & mitigations

| Risque | Effet | Mitigation |
|---|---|---|
| **Ping santé qui ralentit le dashboard** | un Listmonk gelé suspend le rendu du dashboard 10 s (timeout métier) | **timeout dédié 3 s** sur le ping + résultat porté par le **cache** du rapport santé (TTL court, jamais `unstable_cache` sans TTL — gotcha i18n) ; le ping n'est pas payé à chaque rendu. |
| **Faux « périmé » sur campagne terminale** | une campagne `sent` il y a 3 j crie « métriques périmées » à tort | `terminal ⇒ none` câblé dans `deriveSyncBadge` ET dans l'agrégat santé (`status IN ('sending','scheduled')` only) ; test U dédié F10-U-005/006. |
| **Faux « périmé » sur base calme** | dashboard rouge alors qu'il n'y a rien à synchroniser | check sync `ok` neutre si 0 campagne non terminale (F10-U-019). |
| **Écriture des colonnes court-circuitée par l'échec du fetch** | un timeout laisse `attempt` figé → on croit le cron mort | `attempt=now` écrit **hors** du `try` (base de l'UPDATE), error dans le `catch` — un seul UPDATE/candidat (test I-054/055). |
| **Strip CSP → resynthèse qui re-bloque l'iframe** | `frame-ancestors 'self'` mal formé bloque notre propre iframe | test I-057 vérifie la valeur **exacte** `frame-ancestors 'self'` ; E2E DEGRADED-01 vérifie que l'iframe rend. |
| **Drift schema.ts ↔ DB** sur la migration | colonnes absentes en prod, lecteur qui 500 | migration livrée AVANT lecteur + test `schema-drift` sur les 2 bases (gate M2). |

---

## Rollback
- **Données** : les 3 colonnes additives sont **inertes** — aucune migration
  descendante. Un rollback de F10 = rollback de **CODE** uniquement (revert du
  build), les colonnes restent en place sans effet (cf. stratégie data §3).
- **Par étape** : chaque étape est indépendante. Si les badges (étape 3) posent
  problème, on revient au rendu sans badge sans toucher à l'écrivain (étape 2)
  ni à la migration. Le check santé (étape 4) peut être désactivé en retirant
  les 2 `CheckLine` (le reste du badge fonctionne). Le proxy (étape 6) peut
  revenir au strip pur en cas d'incident de framing (mais on perd LMK-05).
- **Gate de sortie** : G1 (batterie F10 100 % verte), G5 (tsc+lint+next build),
  G6 (axe), G8 (SM-F10-01/02/03 verts), G9 (contrat `/health` + proxy).
