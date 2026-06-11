# 12 — Plan de migration DB prod (gate 5 de la Phase 4)

> Rédigé le 2026-06-10. **Aucune action prod n'a été effectuée** — ce document
> prépare le jour où le merge studio → master sera décidé. La base prod
> (`femiglow`, 127.0.0.1:5432, distincte de `staging_femiglow`) n'a pas été
> interrogée pour l'écrire : les vérifications « pré-vol » ci-dessous sont à
> exécuter le jour J, leurs résultats peuvent changer d'ici là.

## Périmètre

La prod suit master (journal jusqu'à `0082_loyalty_grant_activation`). La
branche `studio/integration` apporte **4 migrations absentes de prod** :

| Fichier | Nature | Risque |
|---|---|---|
| `0063_ai_engine_tables.sql` | CREATE TABLE/INDEX IF NOT EXISTS ×~15 (tables `ai_engine_*`) | quasi nul (purement additif) |
| `0064_media_kind_subtitles.sql` | `ALTER TYPE media_kind ADD VALUE IF NOT EXISTS 'subtitles'` | faible mais **irréversible** (PG n'a pas de DROP VALUE) ; non transactionnel — c'est précisément pour ça que le runner maison existe |
| `0065_content_asset_binding_bundle.sql` | +colonne `meta_json` + **migration de données** : `role='primary'` → `primary_image`/`primary_video` selon `media.kind` | moyen — dépend du volume de bindings legacy en prod (pré-vol n°3) |
| `0066_content_post_draft_unique.sql` | index UNIQUE sur `content_post.draft_id` (remplace l'index simple) | **bloquant si doublons** — pré-vol n°4 obligatoire |

Mécanique : `scripts/_migrate-safe.mjs` est **hash-based** — il applique tout
fichier du journal dont le hash n'est pas dans `drizzle.__drizzle_migrations`,
dans l'ordre du journal. Les numéros n'entrent pas en jeu : pas de collision
possible avec les `0073-0082` de master déjà appliqués en prod. Le `0014`
modifié par master (CHA-230) a déjà été ré-absorbé par la prod via les déploiements
master ; il ne réapparaîtra pas comme pending.

Attendu jour J : `Pending: 4` exactement. Tout autre chiffre = STOP et comprendre.

## Pré-vol (lecture seule, jour J, AVANT tout)

```sql
-- 1) Sanity : état du journal prod
SELECT count(*) FROM drizzle.__drizzle_migrations;

-- 2) Dry-run du runner (n'écrit rien tant qu'on ne confirme pas) :
--    node --env-file=.env scripts/_migrate-safe.mjs --dry-run  (vérifier l'option ; sinon lire la liste « Pending » affichée avant application)

-- 3) Volume de bindings legacy à re-typer par la 0065
SELECT role, count(*) FROM content_asset_binding GROUP BY role;
-- attendu : peu/pas de lignes (flags CONTENT_STUDIO_* OFF en prod → studio inutilisé)

-- 4) BLOQUANT pour la 0066 : doublons draft_id
SELECT draft_id, count(*) FROM content_post
WHERE draft_id IS NOT NULL GROUP BY draft_id HAVING count(*) > 1;
-- DOIT renvoyer 0 ligne. Sinon : résoudre manuellement (garder le post le plus
-- ancien non annulé, annuler les autres) AVANT de lancer la migration.

-- 5) L'enum n'a pas déjà 'subtitles' (sinon IF NOT EXISTS s'en charge, simple confirmation)
SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
WHERE t.typname = 'media_kind' ORDER BY enumsortorder;
```

## Procédure

1. **Backup complet** : `pg_dump -Fc femiglow > femiglow-pre-studio-$(date +%F).dump` — vérifier la taille/intégrité avant de continuer.
2. Déployer le code mergé dans `/var/www/femiglow` (c'est le déploiement du merge lui-même ; les migrations partent du même commit que le code).
3. `node --env-file=.env scripts/_migrate-safe.mjs` — confirmer `Pending: 4`, laisser dérouler (0064 hors transaction, les trois autres transactionnelles).
4. Vérifications post :
   - enum : `subtitles` présent ;
   - `content_asset_binding.meta_json` existe, plus aucune ligne `role='primary'` ;
   - `\d content_post` : `content_post_draft_unique` UNIQUE présent, `content_post_draft_idx` absent ;
   - tables `ai_engine_*` présentes (vides) ;
   - `/api/health` 200, parcours boutique inchangé (le studio reste derrière ses flags).
5. **Les flags `CONTENT_STUDIO_*` restent OFF en prod** : les nouvelles tables sont inertes. La migration peut donc précéder l'activation fonctionnelle de plusieurs jours — c'est même recommandé (découpler risque schéma / risque produit).

## Rollback

| Migration | Rollback |
|---|---|
| 0063 | `DROP TABLE ai_engine_* CASCADE` (tables vides → sans douleur) |
| 0064 | **impossible** (valeur d'enum permanente) — inerte tant que rien n'écrit `kind='subtitles'` ; accepté |
| 0065 | `ALTER TABLE content_asset_binding DROP COLUMN meta_json;` + re-role inverse (`UPDATE ... SET role='primary' WHERE role IN ('primary_image','primary_video')`) — cf. aussi `docs/plan-media-production-2026-05-30/05_runbook/rollback.md` |
| 0066 | `DROP INDEX content_post_draft_unique; CREATE INDEX content_post_draft_idx ON content_post (draft_id);` |

Dernier recours : restauration du dump de l'étape 1 (fenêtre de perte = durée de la migration, soit quelques secondes — aucune écriture studio en prod pendant ce temps puisque flags OFF).

**Attention au rollback applicatif** : si on revert le CODE après avoir migré la
base, master pré-merge requête `role='primary'` et ne verra plus les bindings
re-typés (c'est exactement la régression constatée sur staging à l'audit, doc 01 §2).
Le rollback code implique donc le rollback data de la 0065, ou l'acceptation
d'assets invisibles dans l'admin studio (flags OFF → personne ne les voit).

## Fenêtre & impact

Aucune indisponibilité attendue : DDL additifs sur tables vides ou quasi vides,
un seul `UPDATE` borné. À faire hors pic par prudence (la 0066 pose un lock
court sur `content_post`). Durée totale estimée < 1 min, backup compris < 10 min.
