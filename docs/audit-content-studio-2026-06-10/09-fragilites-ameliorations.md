# 09 — Bilan par dimension : fragilités et améliorations

Réponse point par point aux dimensions demandées. Chaque amélioration renvoie au plan d'action (`10-plan-action.md`).

## Modularité — B−

**Acquis** : découpage frontend sain (43 fichiers, médiane ~160 l.), primitives réutilisées, séparation route→service→repository nette côté backend, adapters de publication interchangeables avec re-validation du provider.
**Fragilités** : double pipeline Postiz (legacy + v2) ; double pipeline de génération (A LangGraph / B create-flow, pont unidirectionnel — sur backup) ; repository dual drizzle/mémoire = chaque fonction écrite deux fois (~40 % de `repository.ts`) ; 4 fichiers UI injectent du CSS dans `document.head` en side-effect de module ; duplications UI (TabRow/TabGroup, SelectField/FilterSelect, toLocalISO).
**Améliorations** : éteindre le legacy Postiz (sunset 2026-08-01 déjà annoncé, migrer `automation.ts`) ; mini-DAO générique pour le dual-store ; consolider les styles dans `tokens.css`.

## Évolutivité — D

**Fragilités** : le schisme de branches est LE frein — toute évolution part d'une base qui ignore 9 jours de travail et une DB déjà migrée ; le schéma de migration est divergent entre lignées ; l'ADR-0007 (convergence des pipelines) est resté à moitié appliqué.
**Améliorations** : merge backup→master (5 conflits, mesuré) ; re-trancher ADR-0007 ; définir une politique de branche (plus jamais 77 commits non poussés).

## Robustesse — D

**Acquis** : pipeline publish-now quadruplement verrouillé (idempotence + lock atomique + 2 contraintes uniques) ; machine à états avec 409 ; budget vérifié avant dépense ; fallback texte sans crash.
**Fragilités** : zéro transaction DB (multi-écritures non atomiques, delete+insert d'assets) ; cancel/reschedule ne purgent pas les jobs (double publication / publication d'un post annulé) ; jobs zombies sans reaper ; assertTransition après la dépense OpenAI ; pas d'unicité `content_post.draft_id` ; double-clic non protégé sur les générations coûteuses.
**Améliorations** : P0-3 à P0-6 du plan d'action.

## Maintenabilité — C

**Acquis** : zéro TODO/FIXME, conventions cohérentes, erreurs uniformisées, ~20 fichiers de tests backend colocalisés, dépréciation legacy instrumentée (headers + audit).
**Fragilités** : code mort UI significatif (états inatteignables, props jamais passées, boutons inertes, routes fantômes `create/[draftId]`) ; docs d'audit invisibles du working tree (sur backup) ; `service.test.ts` mal nommé ; checklist d'exécution jamais tenue à jour.
**Améliorations** : purge du code mort listé en `02-interface-ux.md` §8 ; rapatrier les docs (le merge le fait) ; renommer/réécrire les tests trompeurs.

## Déboggabilité — C+

**Acquis** : publication = exemplaire (events, attempts redactés avec durée, lastError structuré, digest hebdo, endpoint job+events+publications).
**Fragilités** : génération = trou noir (échec image live → 500 opaque, aucun run failed ; fallback texte silencieux pour l'opérateur) ; audit log lacunaire (reschedule, cancel, publish réussi non audités) ; health ne vérifie pas les providers.
**Améliorations** : runs `failed` systématiques, `HttpError('upstream_failed', cause)`, audit log des actions de publication, health enrichi (`hasOpenAiKey`, provider).

## Optimalité — C

**Fragilités** (aucune grave au volume actuel) : `getDailySpentCents` charge 1 000 lignes pour un SUM ; bindings chargés intégralement puis filtrés en JS ; picker média plafonné à 100 (médias plus anciens invisibles — bug fonctionnel autant que perf) ; `service.approval.test.ts` 18 s (sharp réel) ; styles inline recréés à chaque render ; estimations de coût 3× sous la réalité.
**Améliorations** : SUM SQL, `inArray`, pagination du picker, aligner `pricing` (existe sur backup).

## Sécurité — C+

Voir `06-securite.md`. **Acquis** : 36/36 routes auth, zod strict, pas de fuite, redaction, rate-limit upload. **Fragilités** : bypass `x-vercel-cron` spoofable ; pas de kill-switch live ; flag legacy contournable ; pas de rôles ; gating v2 incohérent (create/library sans flag).

## Est-ce fonctionnel ? — E aujourd'hui, B− démontré le 01/06

- **Aujourd'hui** : aucune instance ne tourne (staging arrêté, port pris, prod désactivée) ; sur master le flow create est mort à l'étape 1 (page sans données, pas de déclencheur de génération, pas d'approve, liens 404) ; la DB est incompatible avec le code checkouté.
- **Le 2026-05-30/06-01 (branche backup, staging vivant)** : flow complet démontré par e2e contre l'app réelle — création → génération → visuel → voix-off éditable → sous-titres → compose → approve → publish dry_run, avec assertions Postgres. Le « fonctionnel » existe ; il est juste **orphelin**.
- **Jamais fonctionnel sur aucune lignée** : publication programmée (scheduler sans cron), génération vidéo live Higgsfield (credential incomplet), publication live Postiz non testée de bout en bout.

## Ergonomie / user-friendly — D+

**Acquis** : toasts systématiques, rollback optimiste, estimateur p50/p95 avec paliers d'attente, hints d'états désactivés (publication), a11y au-dessus de la moyenne, raccourcis clavier + palette.
**Fragilités** : opérateur enfermé (pas d'approve dans /create), faux succès (« Programmer » bulk = no-op), boutons morts (⌘K souris, notifications), vidéo sans contrôles ni métadonnées (corrigé sur backup par VideoPlayer), confirmation de publication aveugle au type de média, double-clic non découvrable, date passée acceptée à la programmation, spam de toasts du JobQueue, focus non piégé dans la palette, poignée de trim inopérable à la souris.
**Améliorations** : la liste UI complète est en `02-interface-ux.md` ; les quick-wins (≤1 j chacun) : bouton Approuver dans /create, badge vidéo + contrôles, validation de date, vrai bouton ⌘K, retirer le no-op bulk.

## Tests — C+

Voir `04-tests-couverture.md`. **Acquis** : 428 tests verts EXIT 0, adapters exemplaires, e2e DB-assertives, typecheck gaté en CI. **Fragilités** : trous exactement sur les chemins critiques (texte live, budget auto-validant, live publishing, vidéo, retry) ; 6 specs e2e studio sur 7 hors CI ; composants du flux create→publish sans test.
