# BUG-023 — E2E publish-draft Postiz casse sur 'relation audit_event does not exist' (table reelle = audit_events)

| | |
|---|---|
| **Sévérité** | `major` |
| **Domaine** | create-ui-flow |
| **Composant** | `e2e/content-studio-social-publishing-draft.spec.ts:227 (cleanupSeed) vs schema auditEvents` |
| **Mode mock** | `broken` |
| **Mode live** | `untested` |
| **Verdict vérification** | `confirmed` (confiance: high) |

## État supposé (code + tests)
Le parcours operateur 'Brouillon Postiz' (envoi draft au provider) est valide par un E2E vert.

## État réel vérifié
Le test echoue avec PostgresError: relation "audit_event" does not exist, leve par cleanupSeed/seed qui requete la table singuliere audit_event. La table reelle en staging est audit_events (pluriel) — verifie: to_regclass('public.audit_event')=f, to_regclass('public.audit_events')=t. Le parcours publish-draft n'est donc PAS couvert par un E2E vert. La PRODUCTION fonctionne (route postiz-draft -> logAuditEvent -> drizzle schema.auditEvents -> table pluriel), mais c'est non teste de bout en bout.

## Écart
Decalage nom de table entre le harness de test (singulier) et le schema/DB (pluriel); zone publish-draft non validee.

## Cause racine
spec:226-227 tx`delete from audit_event ...` (et insert seed equivalent) utilise audit_event au lieu de audit_events.

## Preuves
- /tmp/audit-playwright.log:22 PostgresError: relation "audit_event" does not exist
- content-studio-social-publishing-draft.spec.ts:227 await tx`delete from audit_event where resource_id = ${ids.postId}`
- psql staging: SELECT to_regclass('public.audit_event') IS NOT NULL, to_regclass('public.audit_events') IS NOT NULL => f|t
- log-event.ts:24 await drizzle.insert(schema.auditEvents).values(event) — pas de swallow d'erreur
- postiz-draft/route.ts:31 await logAuditEvent({...})

## Reproduction
1. pnpm playwright test content-studio-social-publishing-draft.spec.ts. 2. Echec immediat: relation audit_event does not exist (seed/cleanup).

## Piste de correction
Corriger le test pour utiliser audit_events; ajouter une couverture E2E reelle du bouton 'Brouillon Postiz' (mode dry_run) une fois le seed repare.

## Vérification adversariale
- **Verdict :** confirmed (confiance high)
- **Analyse :** Confirmé: content-studio-social-publishing-draft.spec.ts:206 et :227 requêtent la table singulière 'audit_event' (delete from audit_event). Le schéma réel: src/lib/db/schema.ts:267-268 pgTable('audit_events') (pluriel). Probe DB directe: SELECT to_regclass('public.audit_event') IS NOT NULL, to_regclass('public.audit_events') IS NOT NULL => f|t. audit-playwright.log:22 'PostgresError: relation "audit_event" does not exist' à la ligne 227. Prod correcte et NON-swallow: log-event.ts:24 await drizzle.insert(schema.auditEvents).values(event) sans try/catch; postiz-draft appelle logAuditEvent. Le parcours publish-draft n'a donc pas de couverture E2E verte.
- **Contre-preuve / nuance :** Aucune contre-preuve. La prod fonctionne (table pluriel existe, insert pointe sur la bonne table) — seul le harness de test est cassé, ce qui correspond exactement au realState.

> Réf. registre : `bug-register.csv` ligne `BUG-023` · matrice : `gap-matrix.csv`.
