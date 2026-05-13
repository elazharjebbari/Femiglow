# Tradeoffs explicites

> Liste des compromis assumés. Si un de ces tradeoffs devient bloquant,
> ré-ouvrir l'ADR correspondant.

## ⚖ Audience dynamic vs static

**Choix** : dynamic par défaut, static en option.

**Avantage** : la campagne envoyée demain à VIP cible les VIPs de
demain (peut-être 3 nouveaux qui sont devenus VIP entre temps).

**Inconvénient** : reproductibilité audit moins claire. Mais snapshot
au moment de l'envoi est conservé → l'audit est possible.

## ⚖ Step-list V1 vs canvas n8n V2

**Choix** : step-list V1.

**Avantage** : ~3-4 sem dev économisées vs canvas.

**Inconvénient** : moins visuel pour les flows complexes (>5 branches).
Risque : si l'admin construit des automations très complexes, le 
step-list devient lourd. Mitigation : limite implicite UX (warning
si > 20 steps).

## ⚖ Same-table user_event vs partitioning

**Choix** : 1 table user_event, indexée. Partitioning en V2 si > 50M
rows.

**Avantage** : simple à coder, requêtable normalement.

**Inconvénient** : à > 100M rows, queries lentes même avec index.
Mitigation : surveiller volume mensuel, partitionner avant que ça
fasse mal.

## ⚖ Listmonk éphémère vs Listmonk lists permanentes

**Choix** : éphémère, purge J+30.

**Avantage** : pas de drift, source de vérité reste FemiGlow.

**Inconvénient** : on push 10k rows à chaque envoi (latence). Mitigation :
le push n'est pas bloquant pour le UI (job async).

## ⚖ Bypass Listmonk pour automation sends ?

**Choix** : NON. L'automation send passe par `email_outbox` (transactional pipeline), pas Listmonk.

**Avantage** : cohérent avec transactional, retry/idempotency intégré.

**Inconvénient** : pas de stats Listmonk-natives pour automation
emails. Mitigation : on a nos propres stats via `email_event` +
`user_event`.

## ⚖ Cmd-K palette : custom parser vs library

**Choix** : parser custom léger.

**Avantage** : pas de dep externe lourde. ~200 LoC tested.

**Inconvénient** : maintenir le parser. Mitigation : tests exhaustifs.

## ⚖ Audit log dans Postgres vs externe (Datadog) ?

**Choix** : Postgres (table `admin_audit_log` existante).

**Avantage** : pas de dep externe, requêtable, simple.

**Inconvénient** : grossit. Mitigation : purge J+365 (sauf events
légaux qui restent).

## ⚖ Snapshot async vs sync

**Choix** : sync jusqu'à 5s estimé, async au-delà.

**Avantage** : simple en V1 pour les petites audiences.

**Inconvénient** : 2 chemins de code à maintenir. Mitigation : le path
async est juste "INSERT job + cron pick" — minimal.

## ⚖ Évaluation des conditions dans branch : runtime ou compile ?

**Choix** : runtime (re-eval à chaque run advance qui passe par branch).

**Avantage** : toujours à jour avec l'état user courant.

**Inconvénient** : chaque advance coûte une query DB. Mitigation :
cache user state par run dans `automation_run.context`.

## ⚖ TypeScript strict mode partout ?

**Choix** : OUI. Existant FemiGlow déjà strict.

**Inconvénient** : un peu plus de Zod boilerplate pour parser jsonb.
Mitigation : helpers réutilisables (`safeParseJsonb()` etc.).

## ⚖ Tests E2E avec base de données réelle vs mockée ?

**Choix** : base réelle (postgres staging) + seed.

**Avantage** : tests représentatifs.

**Inconvénient** : cleanup à gérer entre tests. Mitigation : transaction
rollback ou DB recréée à chaque suite (slow mais sûr).

## ⚖ Polish (M5.6) en fin ou continu ?

**Choix** : en fin (sprint dédié).

**Avantage** : pas de friction continue, audit cohérent.

**Inconvénient** : risque de dette UX cumulée. Mitigation : checklist
UX par phase (empty state requis, a11y manuel à chaque page).
