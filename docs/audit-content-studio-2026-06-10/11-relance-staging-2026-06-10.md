# 11 — Relance du staging (exécutée le 2026-06-10) + plan de relance propre

Décision actée par le propriétaire : **pas de merge vers master** (le projet studio n'est pas assez mature pour s'approcher de la prod). Le staging revit donc **depuis la branche `backup-staging-2026-06-01`**, seule lignée compatible avec la base de données.

## A. Ce qui a été fait (état final vérifié)

| Élément | Avant | Après |
|---|---|---|
| Code | working tree sur master (incompatible DB) | **checkout `backup-staging-2026-06-01`** (+ commit local `e7f6ccbd` : le tick lit le port depuis `.env`) |
| Port | 8012 (pris par corolle-reviews) | **8014** (libre, vérifié) |
| Process manager | PM2 `web` (disparu) | **systemd `femiglow-staging.service`** (infra installée le 02/06 : user `nodeapp`, limites mémoire, `EnvironmentFile=.env`) — ExecStart corrigé : port 8014 + chemin `next` stable (`apps/web/node_modules/next/dist/bin/next` au lieu du chemin `.pnpm` épinglé par version) |
| 9 unités cron systemd `femiglow-staging-cron-*` | curl `127.0.0.1:8012` | curl `127.0.0.1:8014` |
| Hibernation (`wake-proxy.py` :8020 + `staging-hibernate.sh`) | femiglow → 8012 | femiglow → **8014** ; `staging-wake-proxy` redémarré |
| Cron 03:15 media-optimize (crontab root) | échouait chaque nuit (script absent) | script restauré par le checkout, port lu depuis `.env`, **test manuel OK** (`processed:0`) |
| Migrations | — | `Pending: 0` (la DB correspond exactement à la branche) |
| Build | `.next` du 01/06 désynchronisé | rebuild complet, routes média présentes, `.next` chown `nodeapp` |

**Vérifications post-démarrage** : `NRestarts=0`, uptime croissant, un seul process sur :8014 (pas d'orphelin) ; `/api/health` local **200** ; `https://staging.femiglow-maroc.com/api/health` **200** (via wake-proxy) ; `/admin/content-studio-v2/create` 307 (login attendu) ; variante AVIF servie 200 ; **e2e `media-studio-tracks.spec.ts` : 3/3 passed, EXIT 0** (golden path vidéo → voix-off → sous-titres → montage, assets visibles = la dérive `role` est bien résorbée en tournant sur cette branche).

**À savoir (comportements normaux de la nouvelle infra)** :
- L'**hibernation** endormira l'app après inactivité ; la première visite la réveille (page « waking up » ~quelques secondes). C'est voulu, partagé avec les autres stagings.
- ⚠️ **Le détecteur d'inactivité ne voit QUE le trafic public** (marqueur `/var/run/staging-activity-femiglow` touché par le wake-proxy). Les e2e locaux sur `127.0.0.1:8014` sont invisibles → l'app peut être arrêtée **en plein run** (constaté le 10/06 à 21:30, suite tuée à mi-course). La détection par journal du script est inopérante (bug de parsing `short-precise` → date à minuit). **Avant une suite e2e longue : `sudo touch /var/run/staging-activity-femiglow`** (fenêtre 60 min, à re-toucher si la suite dépasse).
- Le timer systemd `femiglow-staging-cron-media-optimize.timer` existe mais est **minutely** → laissé désactivé (le cron quotidien 03:15 fait le travail).
- master n'a pas bougé ; la prod n'a pas été touchée ; rien n'a été poussé sur origin.

## B. Plan de relance propre (proposition)

### Phase 0 — Sécuriser le travail (immédiat, ~10 min)
1. **Pousser la branche sur origin** (`git push origin backup-staging-2026-06-01`) — aujourd'hui 78 commits n'existent que sur ce disque. *(Attend ton OK explicite.)*
2. La renommer en branche de travail assumée, ex. `studio/integration` (la garder hors master tant que non mature) : `git branch -m` + push. Master reste la lignée prod.

> **STATUT 2026-06-10 (soir)** : Phase 0 et Phase 1 **exécutées le jour même**.
> Branche poussée sur origin + branche de travail `studio/integration` créée.
> Commits : `019a8517` (kill-switch P1-2), `b7173778` (purge jobs P1-1),
> `029e34c6` (reaper + 0066 + transactions P1-4), `12e2e894` (3 specs e2e
> réparées — rouges depuis la 0065/le défaut v2, pas à cause de P1). P1-3 était
> déjà corrigé sur la branche. Vérifié : 584 vitest EXIT 0, 7/7 specs e2e
> studio vertes, app rebuildée + redémarrée (NRestarts=0, health 200 local +
> public). Dette tsc tests ai-engine (92 erreurs, préexistant) tracée à part.

### Phase 1 — Sûreté de publication (avant toute bascule live ; ~3-5 j)
Les correctifs bloquants de l'audit (`10-plan-action.md` P1), dans l'ordre :
1. `cancel`/`reschedule` purgent les `social_publish_job` queued + `executeJob` re-vérifie le statut du post.
2. Kill-switch global : `SOCIAL_PUBLISHING_MODE` (déjà présent sur cette branche) vérifié au niveau adapter ; supprimer le repli silencieux sur `eligible[0]`.
3. Supprimer le bypass `x-vercel-cron` du scheduler.
4. Reaper des jobs zombies (lock TTL) + `uniqueIndex` sur `content_post.draft_id` + transactions drizzle.
5. Tests des routes `reschedule`, `cancel`, `retry` (exactement là où vivent ces bugs).

> **STATUT 2026-06-10 (fin de journée)** : Phases 2 et 3 **exécutées aussi**.
> P2 (`d1991cb6`) : autosave fiable (pending restauré + instance unique),
> mediaId persisté à la sélection, route deep-link `/create/[draftId]`,
> « Programmer » bulk honnête, JobQueue anti-spam. Beaucoup de constats de
> l'audit (fait sur master) étaient déjà résolus sur la branche.
> P3 (`d429916f`) : échec génération → run `failed` + 502 explicite, budget
> testé en réel, CI e2e avec Postgres + specs DB-assertives gâtées
> (déclenche sur studio/integration), reload() complet. Scheduler (BUG-003) :
> endpoint vérifié à la main ; **décision utilisateur : pas de timer
> périodique, déclenchement manuel** — à revoir au passage en live.
> Dette tsc purgée (`325394a2`) : **typecheck repo à ZÉRO erreur**.

### Phase 2 — Flow opérateur `/create` (~1 semaine)
Quick-wins d'abord : hydratation de la page (le correctif racine), déclencheur de génération texte, bouton **Approuver** dans le workspace, route `create/[draftId]`, autosave unifié + `mediaId` persisté, suppression du faux succès « Programmer » bulk. Détail : `02-interface-ux.md` et P2 du plan d'action.

### Phase 3 — Filets (en continu)
- Tests réels de `generation.ts` et `budget.ts` ; payload vidéo asserté ; e2e DB-assertives en CI.
- Génération : runs `failed` enregistrés + erreurs 502 explicites (au lieu de 500 opaques).
- Brancher enfin le scheduler (BUG-003) **après** Phase 1 — un timer systemd `femiglow-staging-cron-*` est le véhicule naturel désormais.

### Phase 4 — Critères de maturité avant tout merge vers master (les « gates »)
Le merge ne se discute que quand TOUT ceci est vrai :
1. Phase 1 complète (aucun chemin vers une publication réelle non voulue) ;
2. flow opérateur complet démontré par e2e en CI (create → approve → publish dry_run, image ET vidéo) ;
3. un test de publication live contrôlé réussi en `publishMode:'draft'` sur un compte Postiz dédié (jamais un compte client) ;
4. `pnpm -r typecheck` + suite complète + build verts sur la branche à jour de master (rebase/merge de master → branche d'abord, pour absorber les 146 commits tracking/chat/i18n **dans le sens sans risque**) ;
5. plan de migration DB prod écrit (la prod n'a PAS les migrations 0063-0065 — c'est le point qui demandera le plus de soin au moment du merge).

> **STATUT 2026-06-11** :
> - **Gate 2 FERMÉ** : la jambe vidéo (`video-publish-end-to-end.spec.ts`)
>   est dans le scope CI ; au passage, ce spec a révélé un crash réel de
>   /create (patch partiel → caption undefined → `.trim()` dans le
>   Stepper) corrigé à la racine (`f3c751c4`). Le premier run COMPLET du
>   scope CI a ensuite révélé 88 échecs e2e déterministes (drift UI) :
>   31 specs réparés (`a7cfde20`, `2dae9969`), 412 tests `ai-engine-*`
>   (battery spéculative du 25/05) mis en quarantaine CI via
>   `CS_E2E_SKIP_AI_ENGINE=true` — dette tracée, à réparer ou réécrire.
>   Scope CI final : 220 tests / 46 fichiers, vérifiés verts contre :8014.
> - **Gate 5 FERMÉ** : plan de migration DB prod écrit
>   (`12-plan-migration-db-prod.md`).
> - **Gate 4 FERMÉ (2026-06-11, feu vert explicite du propriétaire)** :
>   merge `origin/master` → `studio/integration` (`9a88c0a8`), 239 commits
>   absorbés, master/prod intacts. 5 conflits résolus comme mesuré ;
>   journal migrations unifié (87 entrées, validateur strict OK) ; DB
>   staging migrée (11 appliquées, re-run Pending: 0). Sur l'arbre mergé :
>   typecheck 0, lint 0, vitest 12 051/12 051, build OK, e2e scope CI
>   195 passed/23 skipped (2 échecs calendar-drag-drop dépendants des
>   données staging — skippent en CI). Au passage, 4 bugs PRÉEXISTANTS de
>   master corrigés (build cassé par un export de helper dans un route.ts
>   emails, 2 tests rouges, lint) — master lui-même ne buildait pas tel
>   quel.
> - **Gate 3 EN ATTENTE** : test live Postiz sur compte dédié — attend
>   décision + credentials (jamais un compte client). **Runbook prêt :
>   `13-runbook-gate3-test-live-postiz.md`** (procédure, garde-fous,
>   retour arrière).
> - **Dette quarantaine RÉSORBÉE (2026-06-11 soir, `63d37d94`)** : les 412
>   tests `ai-engine-*` sont réparés (causes : HITL par défaut → helper
>   `disableHumanReview`, locators ambigus, labels renommés) — run complet
>   267 verts / 146 skips conditionnels / 0 échec contre :8014. Bonus : les
>   3 audits axe d'accessibility étaient silencieusement skippés (require
>   en ESM) et tournent désormais ; `global.setup` réutilise la session
>   admin (anti rate-limit 20 logins/15 min). CI : le job bloquant garde le
>   scope rapide ; **nouveau job dédié non-bloquant `e2e-ai-engine`**
>   exécute la suite complète. Les specs calendar-drag-drop sont aussi
>   réparés (drag dnd-kit piloté à la souris, 5/5).
> - **Infra réparée (2026-06-11 soir, accord explicite du propriétaire)** :
>   1. *Hibernation* : le parsing journal de `get_last_access` tronquait le
>      timestamp à « Jun 11 » → minuit (3 suites e2e tuées en plein run).
>      Corrigé dans `/opt/staging-hibernate/staging-hibernate.sh`
>      (`--output=short-unix`, backup `.bak-2026-06-11`) — l'activité
>      locale est désormais visible (« Last access: 0 min ago » vérifié).
>      Le `touch` du marqueur n'est plus nécessaire avant les e2e.
>   2. *Postiz en crash-loop depuis le reboot du 02/06* (9 jours) —
>      DOUBLE cause :
>      - **a)** PostgreSQL avait démarré avant Docker → bind `172.17.0.1`
>        raté (« could not bind IPv4 address ») → le conteneur ne joignait
>        plus sa DB (P1001). Ses restarts ~toutes les 60 s faisaient
>        churner les réseaux Docker (`ERR_NETWORK_CHANGED` dans Chromium →
>        crashs client intermittents pendant les e2e).
>      - **b)** une fois Postgres rebindé, `ufw` (default deny) bloquait
>        encore les deux dépendances hôte du backend depuis les bridges
>        Docker : **5432** (PostgreSQL) ET **6379** (Redis/BullMQ). Sans
>        Redis joignable, le backend NestJS ne finit jamais son boot → port
>        3000 jamais bindé → API en 502 (frontend up mais API morte).
>      Réparé : (a) restart `postgresql@16-main` (listener 172.17.0.1 OK,
>      prod re-vérifiée 200 local+public immédiatement) + drop-in systemd
>      `postgresql@16-main.service.d/after-docker.conf` (ordre After=docker
>      pour les prochains reboots) ; (b) DEUX règles `ufw allow from
>      172.19.0.0/16 to 172.17.0.1 port <5432|6379> proto tcp` (subnet
>      Docker Postiz → hôte, trafic interne non routable). Redis et
>      Postgres deviennent joignables (`pg_isready` = « accepting », Redis
>      = `NOAUTH` donc TCP OK), le conteneur cesse de redémarrer, le
>      backend rebind `:3000`.
>      ⚠️ NB : Postiz dépend de Redis ET PostgreSQL **sur l'hôte** (pas de
>      conteneurs dédiés), via `172.17.0.1` (docker0). Toute remise à zéro
>      du firewall doit reconduire ces deux règles.
> - **Suite e2e INTÉGRALE du repo** (1 329 tests, 52 min, pendant le
>   crash-loop Postiz) : 843 verts / 315 skips / 165 échecs — TOUS hors
>   périmètre studio (tracking, kit/wizard, owbs, coupons/loyalty, legal,
>   attribution…) : specs master exigeant leurs feature flags/builds
>   dédiés (ex. owbs : « Nécessite un build avec
>   NEXT_PUBLIC_CHECKOUT_OPTIMISTIC_WIZARD_ENABLED=true ») + une part de
>   casse réseau due au crash-loop. Jamais couverts par un job CI global ;
>   à re-mesurer Postiz stable si on veut un chiffre propre.
> - NB : les résultats GitHub Actions ne sont pas vérifiables depuis ce
>   serveur (pas de `gh`, repo privé) — la CI réelle est à confirmer côté
>   GitHub.

### Risques résiduels acceptés aujourd'hui
- Hibernation : un cron applicatif qui tire pendant le sommeil échoue silencieusement (`curl -sf`) — acceptable en staging.
- La branche porte aussi `lib/ai-engine` (~240 fichiers) dont la maturité est inférieure au studio lui-même — le périmètre du futur merge pourra être découpé (cherry-pick studio sans ai-engine) si on veut réduire le risque, au prix d'un travail git plus fin.
