# ADR-0010 — Vérité du schéma de test (noms de table dérivés) + isolation du stockage et des caches

- **Statut** : Proposé (workstream DATA)
- **Date** : 2026-05-29
- **Findings liés** : `BUG-023`, `BUG-042`, `BUG-064` (noms de table), `MISS-030` (caches/isolation), `BUG-032` (exit code)
- **Actions** : ACT-DA-001, ACT-DA-002, ACT-DA-007, ACT-DA-008

## Contexte

Plusieurs symptômes d'un même mal — **l'outillage de test ne reflète pas le réel** :

1. **Nom de table fantôme** : `e2e/content-studio-social-publishing-draft.spec.ts` (L207, L227) requête `audit_event` (singulier). La table réelle est `audit_events` (pluriel, `schema.ts:268`) ; `to_regclass('public.audit_event') = NULL`. Le test échoue au teardown (`cleanupSeed`), le parcours publish-draft n'a **jamais** eu d'E2E vert (`BUG-023/042`), et le rouge masque que le chemin produit **fonctionne** (`BUG-064`).
2. **Exit code masqué** : vitest affiche « 1695 passed » mais sort en `exit 1` (promesse rejetée orpheline, `video-generation.ts:206`). Un voyant vert au-dessus d'un process en échec (`BUG-032`).
3. **Pollution / désync** : médias générés sous chemins cwd-relatifs (`generate-voiceover.ts:13`, `transcode-export.ts:15`) → risque de pollution du média de prod par les tests ; caches `resolvedKeyCache`/`modelCache` (TTL 5min) non invalidés sur changement env (`MISS-030`).

## Décision

**Le signal de test est une donnée dont la vérité doit être garantie.**

1. **Noms de table dérivés du schéma Drizzle** (source unique), jamais d'un littéral. Inventaire canonique dans `plan/03_data/schemas.yaml` (`table_name_registry`). La table d'audit est `audit_events`.
2. **E2E DB sur schéma réel** : base de test migrée (`drizzle/migrations`), **pré-vol** `to_regclass(...)` non null sur l'inventaire ; un nom faux/migration manquante → **rouge immédiat**.
3. **Gate sur exit code** : la CI lit le **code de sortie** (pas la ligne « N passed ») ; aucune promesse de polling provider pendante (drain complet des fake-timers).
4. **Isolation du stockage** : racine média **absolue** (dérivée de `MEDIA_LOCAL_DIR`/`MEDIA_DIR`), indépendante du `cwd` ; en test, **tmpdir dédié** + **DB de test isolée** ; **zéro** artefact de test hors tmpdir.
5. **Caches invalidables** : invalidation sur **changement env** (pas seulement save/delete DB) ; test « clé changée pendant la fenêtre TTL ».

## Conséquences

- ✅ Un test vert **prouve** un vrai comportement ; un test rouge **prouve** un vrai défaut (fondation de toute vérifiabilité — P0 non négociable).
- ✅ Les tests ne polluent plus le média/DB de prod.
- ✅ Aucune migration de schéma applicatif (changements harnais/runtime), réversibles.
- ⚠️ Exige une DB de test provisionnée au schéma réel en CI (coût d'infra modeste).

## Alternatives écartées

- **Teardown silencieux (try/catch sur `audit_event`)** : masquerait le problème au lieu de cibler la vraie table → n'apporte pas la couverture E2E manquante.
- **Gate sur la ligne de résumé** : c'est précisément la cause du faux-vert (`BUG-032`).
- **Mocks au niveau module** : laissent le risque de désync schéma/réel — on préfère une DB de test réelle pour les E2E DB.
