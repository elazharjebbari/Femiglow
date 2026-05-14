# Rollback production — Procédure fast + safe

> Rollback n'est pas un échec. Rollback rapide et propre est un signe d'équipe mature. La règle : **rollback first, debug after.**

## Décision rollback en 60 secondes

```
Question 1 : Le chat est-il critique pour le business RIGHT NOW ?
  - Oui → rollback en priorité
  - Non → on peut investiguer 10 min avant rollback

Question 2 : Le bug touche-t-il > 10% des sessions ?
  - Oui → rollback
  - Non → hot fix peut être envisagé

Question 3 : Le rollback nécessite-t-il un rollback de migration DB ?
  - Non → rollback Vercel = 2 min
  - Oui → procédure complète (15 min mais sûre)
```

## Trois types de rollback

### Type A — Rollback Vercel pur (le plus courant, 2 min)

**Quand** : bug code FE ou BE qui n'a pas modifié le schema DB.

**Comment** :

```bash
# Identifier deployment précédent (noté dans deploy-session.log)
PREVIOUS_DEPLOYMENT_ID=$(cat deploy-session.log | grep PREVIOUS_DEPLOYMENT_ID | cut -d= -f2)

# Promouvoir comme prod
vercel promote $PREVIOUS_DEPLOYMENT_ID --scope femiglow

# Vérifier
vercel ls --prod | head -3
# Le précédent deployment doit être à nouveau "PROD"
```

**Smoke test post-rollback** :

```bash
curl -s https://femiglow.com/api/chat/health | jq '.serviceLevel'
# Doit retourner 1 (NOMINAL)
```

**Annonce Slack** :

```
🟡 ROLLBACK V5 effectué (Type A — Vercel pur, 2 min).
Raison : [brief]
Status : prod fonctionnelle, on investigue le bug.
Post-mortem ETA : 48h.
```

### Type B — Rollback feature flag (< 1 min, mini-rollback)

**Quand** : V5 entier est buggué mais le code reste déployable. On désactive juste la feature.

**Comment** :

```bash
# Désactiver feature flag
vercel env rm ENABLE_CHAT_V2 production
echo "false" | vercel env add ENABLE_CHAT_V2 production

# Trigger redeploy (héritage env Vercel)
vercel --prod
```

**Effet** : `ChatLauncher` ne se monte plus, mais le code reste déployé.

**Smoke test** :

```bash
curl -s https://femiglow.com/ | grep -c 'data-component="ChatLauncher"'
# Doit retourner 0 (launcher absent)
```

### Type C — Rollback complet incluant migration DB (15 min)

**Quand** : un changement de schema casse les requêtes ou corrompt des données.

**⚠️ Lire intégralement avant d'exécuter.**

#### C.1 Stopper le traffic chat (feature flag off)

```bash
vercel env rm ENABLE_CHAT_V2 production
echo "false" | vercel env add ENABLE_CHAT_V2 production
vercel --prod
# Attendre redeploy ~3 min
```

#### C.2 Rollback Vercel deployment

```bash
PREVIOUS_DEPLOYMENT_ID=$(cat deploy-session.log | grep PREVIOUS_DEPLOYMENT_ID | cut -d= -f2)
vercel promote $PREVIOUS_DEPLOYMENT_ID --scope femiglow
```

#### C.3 Rollback migrations DB

**Cas C.3.a — Rollback migration unique** (juste la dernière) :

```bash
# Identifier la migration à rollback
DATABASE_URL=$DATABASE_DIRECT_URL_PROD npm run db:migrate:status

# Rollback la dernière
DATABASE_URL=$DATABASE_DIRECT_URL_PROD npm run db:migrate:down -- --steps=1

# Vérifier
DATABASE_URL=$DATABASE_DIRECT_URL_PROD npm run db:migrate:status
```

**Cas C.3.b — Rollback multiple migrations** (toutes les V5) :

```bash
# Compter combien
COUNT=$(DATABASE_URL=$DATABASE_DIRECT_URL_PROD npm run db:migrate:status --json | jq '[.applied[]] | length')
# Soustraire le baseline pré-V5
ROLLBACK_COUNT=$((COUNT - 16))  # si baseline était 0016

DATABASE_URL=$DATABASE_DIRECT_URL_PROD npm run db:migrate:down -- --steps=$ROLLBACK_COUNT
```

**Cas C.3.c — Rollback catastrophique (restore from backup)** :

⚠️ **Procédure de dernier recours**. Perte de données entre backup et maintenant.

```bash
# 1. Mettre prod en maintenance complète
vercel env rm DATABASE_URL production
echo "postgresql://maintenance:@noop/femiglow_maint" | vercel env add DATABASE_URL production
vercel --prod  # site retourne 503 partout

# 2. Restore from backup
pg_restore \
  --clean \
  --create \
  --no-owner \
  --no-acl \
  --dbname=$DATABASE_DIRECT_URL_PROD \
  backups/femiglow_prod_pre_v5_YYYYMMDD_HHMMSS.dump

# 3. Vérifier
psql $DATABASE_URL_PROD -c "SELECT COUNT(*) FROM chat_messages WHERE created_at > NOW() - INTERVAL '24 hours';"

# 4. Restaurer DATABASE_URL prod
vercel env rm DATABASE_URL production
echo "$ORIGINAL_DATABASE_URL_PROD" | vercel env add DATABASE_URL production
vercel --prod
```

#### C.4 Smoke test post-rollback complet

```bash
curl -s https://femiglow.com/api/chat/health | jq
psql $DATABASE_URL_PROD -c "SELECT version();"
# Vérifier que les tables V5 (intent_centroids, etc.) sont absentes si rollback complet
```

#### C.5 Annonce Slack

```
🔴 ROLLBACK V5 COMPLET effectué (Type C, 15 min).
Raison : [détail technique]
Impact : feature chat désactivée + schema DB revenu pre-V5.
Status : prod stable sur ancien comportement.
Next : war room 30 min + post-mortem obligatoire.
```

## Décision arbre

```
Bug détecté
│
├─ Est-ce P0 (chat down complet) ?
│   ├─ Oui → Type A immédiat, debug après
│   └─ Non → continue
│
├─ Le bug touche-t-il le schema DB ?
│   ├─ Oui → Type C (15 min)
│   └─ Non → continue
│
├─ Peut-on isoler la feature défaillante ?
│   ├─ Oui → Type B (feature flag off, 1 min)
│   └─ Non → Type A (rollback complet, 2 min)
```

## Critères "on revient sur prod V5" après rollback

Une fois rollback fait, on ne revient pas sur V5 prod avant :

- [ ] Root cause identifié et documenté.
- [ ] Fix implémenté + reviewé.
- [ ] Test ajouté qui aurait détecté le bug.
- [ ] Test ULTIMATE ré-exécuté et vert.
- [ ] Staging redéployé + smoke 24h vert.
- [ ] PO + dev_lead décision conjointe de redéployer.
- [ ] Post-mortem publié en interne.

## Quand un rollback est-il "trop tard" ?

- **> 1h post-deploy + > 1000 sessions servies** : un rollback peut perdre des données utilisateurs.
- **Lead créés en V5 non rétro-compatibles avec V4** : on doit faire roll-forward.

Dans ces cas, plutôt **forward-fix** : hot patch déployé, pas rollback.

## Coordination équipe pendant rollback

```
00:00  dev_lead détecte / reçoit alerte
00:01  dev_lead juge sévérité (P0/P1)
00:02  dev_lead annonce dans #chat-launch : "Investigating issue X"
00:03  dev_lead décide rollback (Type A/B/C)
00:04  dev_lead démarre rollback
00:06  dev_lead annonce "Rollback in progress"
00:08-15  Rollback en cours
00:15  dev_lead smoke test
00:18  dev_lead annonce "Rollback complet, prod stable"
00:30  PO Selma communique éventuellement externe
00:48  Care team confirme zéro impact résiduel
+48h  Post-mortem publié
```

## Préventif — Préparer rollback dès deploy

À chaque deploy prod :
- [ ] Noter `PREVIOUS_DEPLOYMENT_ID` dans `deploy-session.log`.
- [ ] Confirmer backup DB de la dernière heure existe.
- [ ] Tester `rollback.md` Type A en staging dans les 7 jours.
- [ ] Garder le terminal du deploy ouvert 1h post-deploy.

## Anti-patterns rollback

- ❌ Hésiter à rollback car "ça va passer" — ça passe rarement seul.
- ❌ Tenter un hot fix en prod sous pression — chance d'aggraver.
- ❌ Rollback sans annonce Slack — chaos communication.
- ❌ Rollback sans noter le `PREVIOUS_DEPLOYMENT_ID` au moment du deploy.
- ❌ Skip le post-mortem car "c'était mineur" — on perd les leçons.
- ❌ Rollback en cachette pour ne pas alerter — l'équipe perd la confiance.
