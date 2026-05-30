# BUG-042 — E2E draft Postiz interroge la table 'audit_event' (singulier) inexistante — test impossible à passer

| | |
|---|---|
| **Sévérité** | `major` (ajustée depuis blocker) |
| **Domaine** | test-mock-infrastructure |
| **Composant** | `e2e/content-studio-social-publishing-draft.spec.ts (lignes 207, 227)` |
| **Mode mock** | `broken` |
| **Mode live** | `untested` |
| **Verdict vérification** | `adjusted` (confiance: high) |

## État supposé (code + tests)
Le spec 'envoie un post en brouillon Postiz' est censé valider de bout en bout le flux brouillon dry-run + l'émission d'un audit event en DB.

## État réel vérifié
Le spec E2E draft Postiz reference 'audit_event' (singulier) aux l.206/227 alors que la table reelle est 'audit_events' (pluriel, schema.ts:268) — le test echoue au cleanup contre la vraie DB et n a jamais pu passer. C est un bug du test, pas de l app: l audit applicatif vise la bonne table.

## Écart
Un test E2E 'parcours opérateur réel' référence un nom de table qui n'existe pas, donc il a toujours été cassé contre le réel — il ne pouvait passer que si jamais exécuté avec DB, ou compté comme vert par erreur ailleurs. L'assertion d'audit (l.205-209) est aussi sur 'audit_event'.

## Cause racine
Nom de table erroné codé en dur dans le spec (singulier vs pluriel), jamais vérifié contre le schéma Drizzle réel. Indique que ces E2E DB ne tournent pas en CI standard (sinon rouge permanent).

## Preuves
- /tmp/audit-playwright.log: 'PostgresError: relation "audit_event" does not exist' at e2e/content-studio-social-publishing-draft.spec.ts:227:15
- spec l.227: 'delete from audit_event where resource_id = ${ids.postId}' ; l.205-207: 'select action, resource_id from audit_event'
- DB: psql to_regclass → '|audit_events' (singulier null, pluriel existe)
- src/lib/db/schema.ts:268 'audit_events' + index 'audit_events_created_at_idx'

## Reproduction
psql $DATABASE_URL -c "select to_regclass('audit_event'), to_regclass('audit_events');" → singulier NULL. Lancer le spec → erreur l.227.

## Piste de correction
Remplacer 'audit_event' par 'audit_events' aux l.205, 207, 227. Ajouter ces E2E DB à un job CI dédié (avec DATABASE_URL) pour qu'un nom de table faux devienne rouge immédiatement.

## Vérification adversariale
- **Verdict :** adjusted (confiance high)
- **Analyse :** Le bug est reel et prouve: psql to_regclass('audit_event')=NULL, to_regclass('audit_events')=audit_events; schema.ts:268 = 'audit_events'; le spec utilise 'audit_event' (singulier) aux l.206, 227. Le run /tmp/audit-playwright.log confirme 'PostgresError: relation "audit_event" does not exist' a la l.227. Le test n a jamais pu passer contre la vraie DB. MAIS 'blocker' surevalue: c est un bug de TEST E2E (mauvais nom de table dans le cleanup/assert), pas un defaut de l app en production — le flux dry-run lui-meme fonctionne. Impact = signal CI faux/test mort, severite major.
- **Contre-preuve / nuance :** Le defaut est confine au fichier de test e2e/content-studio-social-publishing-draft.spec.ts (l.206/227). Le code applicatif utilise correctement 'audit_events' (schema.ts:268). Donc la fonctionnalite d audit n est pas cassee — seul le test l est.

> Réf. registre : `bug-register.csv` ligne `BUG-042` · matrice : `gap-matrix.csv`.
