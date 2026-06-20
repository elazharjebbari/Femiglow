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

---

## Enrichissement barème relevé (2026-06-20) — gates G10–G15

> Référence : ../../09-charte-ux-qualite.md. Ces exigences s'ajoutent au plan
> ci-dessus et conditionnent le gate de phase (cf. 07-plan-action-global.yaml,
> 08-runbook.md §5). Nouvelles couches de batterie à créer : **F10-D-*** (design)
> et **F10-S-*** (sécurité).

### Design haut calibre (G10)
- Créer un composant socle **`ui/Banner.tsx`** (4 tones success/warning/danger/info ; slots icône + titre + corps + action) AVANT l'étape 3 : il manque au socle C1 (qui n'a que Pill/Toast/EmptyState). Tous les bandeaux F10 (détail échec/périmé, bloc indispo wizard étape 2/3, overlay iframe morte) en dérivent — 0 markup de bandeau ad hoc dans `components/admin/emails/**`. Snapshot visuel **F10-D-001** (3 tones) + axe 0 serious/critical.
- Bandeau détail campagne : spec de composition (icône + titre + corps + action), échelle d'espacement et poids typo distinguant le message d'erreur de la consigne d'action — pas un bloc plat générique. Snapshot **F10-D-002** (états échec et périmé).
- `last_sync_error` affiché humanisé (pas le log brut) : la classe technique va sous un disclosure « Détails techniques » en monospace/secondaire ; le corps du bandeau porte le message d'action. Snapshot **F10-D-003** comparant rendu brut interdit vs humanisé.
- Page iframe en mode dégradé : DESSINER le « shell digne » — overlay `EmptyState` « Listmonk ne répond pas pour l'instant — [Réessayer] / [Ouvrir dans un nouvel onglet] » par-dessus l'iframe morte, jamais un iframe blanc/cassé. Snapshot **F10-D-004** (iframe down).
- Bandeau piège (LMK-03) `role=note` : travail de hiérarchie pour qu'il soit lu et non « banni » (les bandeaux info permanents deviennent invisibles) — le distinguer visuellement d'un bandeau d'erreur. Snapshot **F10-D-005**.
- État de chargement DESSINÉ des 2 nouvelles `CheckLine` Listmonk pendant le (re)calcul du ping 3 s (skeleton ou valeur stale explicite, standard §3.7 appliqué). Snapshot **F10-D-006**.
- Responsive 3 breakpoints (mobile/tablette/desktop) des badges en liste : `Pill` statut + `Pill` sync côte à côte avec libellé long « ⚠ métriques périmées (>1h) » — règle de troncature/wrap/icône-seule en colonne étroite. Snapshot **F10-D-007** aux 3 viewports.
- Micro-interactions : transition d'apparition/résolution du bandeau quand « Réessayer » réussit (le bandeau se met à jour/disparaît, pas un saut sec), feedback de succès au-delà du toast ; respecter `prefers-reduced-motion`.

### Assistance à la saisie (G11)
- **[Réessayer maintenant] / re-poll ciblé** → action serveur, PAS une saisie : `mecanisme=none`, mais navigation clavier sur le bouton requise (test focus + activation Entrée/Espace). Inscrit `10-inventaire-assistance.csv` (F10-detail-campagne).
- **Filtre « sync KO » (deep-link `?from=health`)** → `smart_default` : le filtre est pré-appliqué par le deep-link santé ; l'épingler comme état de filtre suggéré dans la barre de filtres de la liste campagnes (F04) et pas seulement comme query-param. Test : arriver via `?from=health` applique et matérialise le filtre. Inscrit CSV (F10-liste-campagnes).
- **Les 3 colonnes (last_sync_attempt/ok/error)** → écrites par le cron, aucune saisie opérateur : déclarer EXPLICITEMENT « aucun champ éditable opérateur dans F10 » (`assiste_cible=non` justifié) pour tracer le barème G11 au lieu de laisser le vide implicite. Inscrit CSV (F10-3-colonnes-cron). `LISTMONK_PUBLIC_URL`/creds = config ops (env), hors UI — message ops pointe vers le runbook (acceptable, pas d'autocomplete attendu).

### Sécurité (G12) — batterie F10-S-*
- **F10-S-001** — rendu sûr des messages upstream : `last_sync_error` et `firstError` rendus en **texte échappé**, JAMAIS `dangerouslySetInnerHTML` (corps Listmonk = donnée non fiable → XSS stocké). Grep interdisant `dangerouslySetInnerHTML` dans le périmètre F10.
- **F10-S-002** — redaction PII : `firstError` (ex. Listmonk 422 « invalid email » inclut l'adresse) masque toute adresse email (regex) avant affichage. Test unitaire « 422 invalid email → email masqué ».
- **F10-S-003** — anti-abus du re-poll ciblé : le bouton « Réessayer » déclenche un appel Listmonk externe à la demande ; garde serveur « pas plus d'un re-poll par campagne / 10 s » → **429 humanisé**. Étendre la grille réseau du bouton avec le cas 429 (en plus du debounce client 1 POST/double-clic).
- Authz : le 401 proxy et l'auth implicite de l'action admin sont conservés ; vérifier que le re-poll passe bien par `requireAdmin`.

### Observabilité / débogabilité (G14)
- Émettre des logs structurés nommés `<domaine>.<action>` (sans champ `event`, gotcha logger) : `listmonk.health.ping{latencyMs,level}`, `listmonk.health.ping_failed{error}`, `listmonk.sync.retry{campaignId,result}`, `listmonk.push.partial{attempted,pushed,rejected,firstErrorClass}`.
- Corrélation incident : chaque re-poll échoué logge `campaignId` + classe d'erreur côté serveur (pour retrouver l'incident). Ligne batterie **F10-I** asserrant sur un logger espionné que le re-poll KO émet le log avec `campaignId`.
- Stockage débogable : préférer conserver `error class` + `status` séparément à `String(err).slice(0,500)` (qui perd la stack/le code) — champ structuré plutôt que texte tronqué.
- Tests d'émission : logger espionné vérifiant la présence de `campaignId`/`latencyMs`/`rejected` selon l'action.

### Performance / optimal (G13)
- Budget latence : **/health enrichi p95 < 500 ms** (hors ping froid). Le ping 3 s caché + 1 agrégat SQL s'ajoutent au rapport santé — actuellement aucun budget latence (seul un budget bundle existe ailleurs).
- Cache santé chiffré : `healthCacheMs = 15 s` (le « TTL court » vague devient vérifiable) ; test d'intégration « deux GET /health en < 15 s ⇒ un seul ping Listmonk émis » (compteur sur le client mocké). Jamais `unstable_cache` sans TTL (gotcha i18n).
- Borne de temps sur l'agrégat SQL santé (pas seulement le timeout 3 s du ping) : si la DB traîne, l'agrégat ne doit pas suspendre le dashboard.
- Index : **EXPLAIN documenté** de l'agrégat `email_campaign_link WHERE status IN (...) AND last_sync_error IS NOT NULL AND attempt>ok` ; justifier « statusIdx suffit » ou poser un seuil de ré-évaluation d'index (ex. > 5000 campagnes non terminales).
- Borne du nombre d'UPDATE cron : « un UPDATE par candidat » = N UPDATE ; poser un critère de batch si N grandit.

### Modularité / évolutivité / concurrence (G15)
- Nommer et typer les helpers purs de niveau santé (séparés du fetch/SQL) : `deriveListmonkPingLevel(latencyMs, status)`, `deriveSyncAgeLevel(maxOkAt, failCount, hasNonTerminal, now)` — critère vérifiable au même titre que `deriveSyncBadge(link, now)`. Cible couverture 100 % branches sur la table de vérité.
- Centraliser TOUS les seuils dans un module exporté `LISTMONK_OBS = { staleMs:3600000, pingTimeoutMs:3000, pingSlowMs:1000, syncOkMaxMs:3600000, syncIncidentMs:21600000, errorTruncate:500, healthCacheMs:15000 }` importé par `deriveSyncBadge`/helpers santé/écrivain. **Grep AST** échoue si un littéral numérique de seuil apparaît hors de ce module dans les fichiers F10.
- Contrat `/health` rétro-compatible : l'ajout des 2 checks Listmonk reste **additif only** (consommateurs nav-counters F02 / alerting externe non cassés) ; critère versionning du schéma Zod `/health`.
- Concurrence cron vs re-poll manuel : modèle **dernier-écrivain-gagne** assumé (attempt monotone) explicité ; test d'intégration concurrent (deux UPDATE entrelacés ⇒ `attempt` final = max, `error` cohérente avec le dernier résultat).
- Maintenabilité i18n : relier `textes_verbatim` aux clés i18n du repo ; les oracles composant/E2E lisent la valeur via la **même source** que le rendu (évite divergence libellé/oracle — gotcha i18n bindings).
