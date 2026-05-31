# Stratégie de rollback

> Procédure en cas d'incident pendant ou après le ship.

## 1. Niveaux de rollback

| Niveau | Trigger | Effet | Réversibilité |
|---|---|---|---|
| **N1 — Flag off** | Bug dans les filtres admin | Comportement legacy restauré | Instantané (redéploiement) |
| **N2 — Code revert** | Bug dans repos / queries / endpoint | Annule les changes code | < 30 min (Vercel rollback) |
| **N3 — Migration drop** | Bug DB irrécupérable | Drop colonne `kind` + index | < 1 h (avec DBA) |
| **N4 — Restore backup** | Perte de données critique | Restore snapshot Neon | < 2 h (avec DBA) |

## 2. N1 — Flag off (le plus probable)

### Quand l'utiliser

- L'admin voit ZÉRO conversation alors qu'il y en a réellement
- L'admin voit ZÉRO lead chat alors qu'il y en a réellement
- Une erreur 500 récurrente sur `/admin/chat/conversations` (filter SQL buggé)
- Decision rapide : besoin de visibilité legacy immédiate

### Procédure

```bash
# Étape 1 : désactiver le flag via dashboard Vercel
# (ou CLI : vercel env rm CHAT_ADMIN_FILTERS_V2)
vercel env add CHAT_ADMIN_FILTERS_V2 production
# Saisir : false

# Étape 2 : redéploiement (auto si Vercel webhook activé)
vercel deploy --prod

# Étape 3 : smoke
curl https://femiglow-maroc.com/api/admin/chat/audit-pollution \
  -H 'cookie: <admin_session>' | jq

# Étape 4 : vérifier visite admin
# /admin/chat/conversations doit redevenir polluée (legacy)
```

### Durée

- 5 min via dashboard Vercel
- ~3 min de redéploiement
- = **8 min total**

### Effet secondaire

- La colonne `kind` reste en DB, juste plus utilisée par les filtres.
- Les nouveaux INSERT continuent à mettre `kind='chat'` / `'wizard_pivot'`.
- Aucune perte de données.

### Retour en arrière

Pour ré-activer plus tard, remettre `CHAT_ADMIN_FILTERS_V2=true`.

## 3. N2 — Code revert

### Quand l'utiliser

- Bug dans `wizardSessionRepo.ensureForWizard()` qui casse les inserts
- Bug dans `sessionRepo.create()` qui casse le chat widget
- Régression sur `/admin/leads` (vue globale) — celle qui ne doit JAMAIS casser

### Procédure

```bash
# 1. Identifier le commit incriminé via git log
git log --oneline master | head -20

# 2. Créer un commit de revert (préserver l'historique)
git revert <commit_sha>
# Si conflit : résoudre puis git revert --continue

# 3. Push + déploiement auto
git push origin master

# 4. Vérifier deploy prod
# 5. Smoke chat purity (peut être ignoré si on revert)
```

### Durée

- 10-30 min selon nombre de commits et conflits

### Effet sur la DB

- La colonne `kind` reste, les rows backfilled aussi.
- Seul le code applicatif redevient legacy.
- Les futures INSERT iront sans `kind` explicite → default DB `'chat'`.

## 4. N3 — Migration drop

### Quand l'utiliser

- Erreur fondamentale dans le schéma (ex. contrainte CHECK casse les inserts wizard)
- Performance dégradée drastiquement (rare)
- Décision stratégique de revenir au modèle sans `kind`

### Procédure

```bash
# 1. PRÉREQUIS : flag CHAT_ADMIN_FILTERS_V2=false partout
# (sinon le code Drizzle qui lit `kind` plante au SELECT)

# 2. Vérifier qu'aucun code en cours n'utilise `kind`
grep -rn "chatSession.kind\|chat_session.kind" apps/web/src --include="*.ts" --include="*.tsx"

# 3. Si rien : créer migration de drop
cat <<EOF > drizzle/migrations/0XYZ_drop_chat_session_kind.sql
-- Rollback de la migration kind
DROP INDEX CONCURRENTLY IF EXISTS chat_session_kind_status_idx;
ALTER TABLE chat_session DROP CONSTRAINT IF EXISTS chat_session_kind_check;
ALTER TABLE chat_session DROP COLUMN IF EXISTS kind;
EOF

# 4. Appliquer
pnpm drizzle-kit migrate

# 5. Vérifier
psql $DATABASE_URL -c "\d chat_session"
# Doit afficher 0 colonne `kind`

# 6. Mettre à jour le schema TS
# Retirer la ligne `kind: text('kind', {...}).notNull().default('chat')` de schema.ts
```

### Durée

- 30 min - 1 h selon dispo DBA
- Risque de lock long sur table si > 100k rows (CONCURRENTLY important)

### Effet

- Toutes les modifications code utilisant `kind` doivent être revertées d'abord.
- La discrimination chat vs wizard est perdue (retour à la pollution).
- Les rows historiques restent intactes (FK toujours OK).

## 5. N4 — Restore backup DB

### Quand l'utiliser

- Backfill a corrompu des données (cas extrême — peu probable car UPDATE simple)
- Cleanup endpoint a archivé des rows par erreur (réversible aussi)
- Perte de la cohérence FK chat_lead.session_id

### Procédure (Neon-specific)

```bash
# 1. Identifier le point de restauration via Neon Console
# (cf. Neon docs : Branches > Restore from point in time)

# 2. Créer une branche de restauration (sans toucher prod)
neon branches create --parent main --name rescue-2026-05-26 \
  --timestamp 2026-05-26T08:00:00Z

# 3. Vérifier les données sur la branche
psql $NEON_RESCUE_URL -c "SELECT COUNT(*) FROM chat_session;"

# 4. Si OK, promouvoir la branche en main (avec DBA)
# Procédure Neon documentée

# 5. Vérifier prod après promotion
```

### Durée

- 1-2 h
- Coordination avec DBA / Neon support si nécessaire

### Effet

- Toutes les écritures depuis le point de restauration sont perdues (à confirmer)
- Cleanup endpoint exécuté avant ce point : annulé
- Les leads créés après ce point : perdus

⚠️ **Action de dernier recours** — ne pas exécuter sans :
- Lead validé
- Fondatrice prévenue
- Snapshot post-incident archivé

## 6. Décision tree

```
Incident détecté
       │
       ▼
   Quel symptôme ?
       │
       ├─ Liste admin vide / pollution affichée
       │    ▼
       │    → N1 Flag off (8 min)
       │
       ├─ Erreur 500 récurrente
       │    ▼
       │    → N1 Flag off + investigate
       │      → Si bug code : N2 revert
       │
       ├─ Wizard checkout casse
       │    ▼
       │    → N1 + investigate
       │      → Si schema buggé : N3 migration drop
       │      → Si code buggé : N2 revert
       │
       └─ Perte de données / corruption
            ▼
            → N4 Restore backup (DBA)
```

## 7. Communications pendant un rollback

### Notification équipe

```
[ROLLBACK] CHA-LEAD-V2 — Niveau N{1-4}

Symptôme : <ce qu'on observe>
Action : <ce qu'on fait>
Owner : <qui pilote>
ETA : <durée estimée>
Status : in_progress | resolved

Slack : #incidents
```

### Notification fondatrice

```
Bonjour <nom>,

Suite à un incident détecté sur l'admin chat (CHA-LEAD-V2), nous
avons rollback le fix temporairement. Le comportement legacy est
restauré.

Impact :
- /admin/chat/conversations affiche à nouveau les sessions polluées
- /admin/chat/leads affiche à nouveau les leads wizard

Aucune donnée perdue. Le fix sera relancé après investigation
(ETA J+X).

Cordialement,
<Lead>
```

## 8. Post-mortem (RCA)

Si rollback exécuté, planifier un RCA dans les 48h :

- [ ] Réunion 30 min avec Dev + Lead + DevOps
- [ ] Document RCA dans `docs/incidents/<date>-chat-lead-v2-rollback.md`
- [ ] Identification de la cause racine
- [ ] Plan de prévention (test additionnel ? code review plus stricte ?)
- [ ] Décision : ré-essayer le fix avec correction OU abandon

## 9. Checklist rollback

- [ ] Décision documentée (qui, quand, pourquoi)
- [ ] Flag désactivé en prod
- [ ] Smoke confirmé que legacy est restauré
- [ ] Slack/team notifié
- [ ] Fondatrice notifiée
- [ ] Tickets ouverts (Sentry, RCA, fix)
- [ ] Sprint clos en "rollback" plutôt que "shipped"
- [ ] Documentation mise à jour
