# Déploiement prod

> Procédure ship prod. À exécuter UNIQUEMENT après validation staging complète.

## ⚠️ Pré-requis OBLIGATOIRES

- [ ] Staging validé GO (cf. `verifications-staging.md` §8)
- [ ] Lead a donné le feu vert
- [ ] Fondatrice notifiée du créneau de ship
- [ ] Créneau hors heures de pointe (ex. mardi 14h, pas vendredi 17h)
- [ ] Slack `#deploys` notifié
- [ ] Backup prod fraîchement créé

## 1. Pré-flight

### 1.1 Backup DB prod

```bash
# Neon : créer branche de sauvegarde
neon branches create --parent main --name pre-cha-lead-v2-prod \
  --output json | jq -r '.id'
# Noter l'ID pour potentiel rollback

# Vérifier la branche
neon branches list | grep pre-cha-lead-v2
```

### 1.2 Vérifier env prod

```bash
vercel env ls production | grep -E "DATABASE_URL|CHAT_ADMIN_FILTERS"
# Doit afficher :
# DATABASE_URL=<prod>
# (CHAT_ADMIN_FILTERS_V2 absent ou false)
```

### 1.3 Vérifier code mergé

```bash
git fetch origin
git log --oneline origin/master | head -10
# Doit afficher les commits T0-T5
```

### 1.4 Smoke pré-deploy (legacy comportement)

```bash
pnpm tsx scripts/smoke-chat-purity.ts --url https://femiglow-maroc.com
# Attendu : 2-3/3 OK (cleanup peut skip si pas d'admin cookie)
```

## 2. Phase A — Déploiement code avec flag OFF

### 2.1 Trigger déploiement

```bash
# Si déploiement auto sur push master : déjà fait
# Sinon manuel :
vercel deploy --prod
```

### 2.2 Attendre fin du build

```bash
vercel ls --limit 1
# Status : Ready
```

### 2.3 Smoke post-deploy (flag toujours OFF)

```bash
pnpm tsx scripts/smoke-chat-purity.ts --url https://femiglow-maroc.com

# Attendu :
# ✅ create_ghost     201 created
# ✅ audit_pollution  X kinds
# ✅ cleanup_dryRun   skipped (no admin cookie)
```

### 2.4 Vérifier visite admin (legacy comportement)

```bash
open https://femiglow-maroc.com/admin/chat/conversations
# Attendu : liste polluée (comportement legacy)
# Total count élevé (100+ probablement)
```

⚠️ **STOP si le smoke échoue** : le code a un bug même avec flag off. Rollback (cf. `06-plan-action/rollback.md` §2).

## 3. Phase B — Migration DB prod

### 3.1 Appliquer migration

```bash
DATABASE_URL=$PROD_DATABASE_URL pnpm drizzle-kit migrate

# Attendu :
# - "Migration applied successfully"
# - Durée : <30s sur volumes raisonnables
```

### 3.2 Vérifier colonne

```bash
psql $PROD_DATABASE_URL -c "\d chat_session" | grep kind
# Attendu : kind | text | not null | default 'chat'

psql $PROD_DATABASE_URL -c "SELECT kind, COUNT(*) FROM chat_session GROUP BY 1"
# Attendu : 'chat' = XX (toutes les rows ont le default), 'wizard_pivot' = 0
```

### 3.3 Vérifier index

```bash
psql $PROD_DATABASE_URL -c "\di chat_session*"
# Attendu : chat_session_kind_status_idx présent
```

## 4. Phase C — Backfill prod

### 4.1 Dry run

```bash
DATABASE_URL=$PROD_DATABASE_URL \
  pnpm tsx scripts/backfill-chat-session-kind.ts --dry-run

# Attendu :
# Backfill chat_session.kind — DRY RUN
# Candidates (id préfixe s_ + kind='chat') : XX
```

### 4.2 Décision GO/NO-GO

- Si candidates est cohérent avec estimation (10-2000 pour FemiGlow actuel) : GO.
- Si candidates est anormal (>10k ou 0) : INVESTIGUER avant execute.

### 4.3 Execute

```bash
DATABASE_URL=$PROD_DATABASE_URL \
  pnpm tsx scripts/backfill-chat-session-kind.ts --execute

# Attendu :
# ✅ Updated XX rows to kind='wizard_pivot'
# 📊 Backfill complete. 0 rows remaining mismatched.
```

### 4.4 Audit post-backfill

```bash
psql $PROD_DATABASE_URL -f - <<'EOF'
\echo '=== Distribution kind ==='
SELECT kind, COUNT(*) FROM chat_session GROUP BY 1 ORDER BY 2 DESC;
\echo '=== Mismatches (should be 0) ==='
SELECT COUNT(*) FROM chat_session WHERE id LIKE 's\_%' ESCAPE '\' AND kind = 'chat';
SELECT COUNT(*) FROM chat_session WHERE id LIKE 'cs\_%' ESCAPE '\' AND kind = 'wizard_pivot';
\echo '=== Coherence kind ↔ source ==='
SELECT s.kind, l.source, COUNT(*) AS n FROM chat_session s
JOIN chat_lead l ON l.session_id = s.id GROUP BY 1, 2 ORDER BY 3 DESC;
EOF
```

Attendu : mismatches = 0, coherence OK.

## 5. Phase D — Activer flag en prod

### 5.1 Toggle flag

```bash
# Via dashboard Vercel : https://vercel.com/<org>/femiglow/settings/environment-variables
# OU via CLI :
vercel env rm CHAT_ADMIN_FILTERS_V2 production
vercel env add CHAT_ADMIN_FILTERS_V2 production
# Saisir : true
```

### 5.2 Re-deploy pour appliquer

```bash
vercel deploy --prod
# Ou : vercel redeploy --prod
```

### 5.3 Attendre 1-2 min pour cache CDN

```bash
sleep 90
```

### 5.4 Smoke post-flag ON

```bash
pnpm tsx scripts/smoke-chat-purity.ts --url https://femiglow-maroc.com
# Attendu : 3/3 OK

# Vérifier flag actif via audit endpoint (si admin cookie dispo)
curl -H "cookie: $admin_cookie" \
  https://femiglow-maroc.com/api/admin/chat/audit-pollution | jq '.distributions.session_kind'
# Attendu : kind='wizard_pivot' présent avec count > 0
```

## 6. Phase E — Validation manuelle prod

### 6.1 Login admin

```bash
open https://femiglow-maroc.com/admin/login
# Login admin@femiglow.local + password
```

### 6.2 Checklist visite manuelle

- [ ] `/admin/chat/conversations` charge en <2s
- [ ] Liste est PROPRE (count attendu : 5-30 selon traffic réel, pas 100+)
- [ ] Aucune ligne préfixe `s_xxx`
- [ ] Toggle "Voir tout (debug)" fonctionne
- [ ] `/admin/chat/leads` charge en <2s
- [ ] Aucun lead "yasmine"/"test" wizard converted visible
- [ ] Badge source `chat_widget` visible (couleur emerald)
- [ ] `/admin/leads` (global) charge sans régression
- [ ] Compteur "31 prospects" inchangé (ou plus si nouveaux leads)
- [ ] `/admin/chat/audit` affiche le rapport pollution
- [ ] Section "Pollution chat_session" présente
- [ ] Bouton "Prévisualiser cleanup" présent

### 6.3 Captures d'écran pour archive

```bash
# Screenshot des pages avant/après pour documentation
# Sauvegarder dans docs/chat-conversations-leads-fix-2026-05/screenshots/prod-after.png
```

## 7. Phase F — Notification

### 7.1 Slack `#deploys`

```
[SHIPPED] CHA-LEAD-V2 — Chat conversations & leads fix

✅ Migration appliquée (durée Xs)
✅ Backfill exécuté (Y rows updated)
✅ Flag CHAT_ADMIN_FILTERS_V2=true en prod
✅ Smoke 3/3 OK
✅ Validation manuelle OK

Impact :
- /admin/chat/conversations : liste propre (vraies conversations seulement)
- /admin/chat/leads : leads chat purs uniquement (wizard exclus)
- /admin/leads : inchangé

Monitoring 48h en cours.
```

### 7.2 Email fondatrice

```
Bonjour <nom>,

Le fix sur l'admin chat est en prod depuis <heure>.

Tu peux désormais consulter /admin/chat/conversations et
/admin/chat/leads en sachant que seules les vraies conversations
chat et les leads chat sont affichés.

Pour voir tous les leads (chat + wizard fusionnés), va sur
/admin/leads (vue globale, inchangée).

Nous suivons la santé du système pendant 48h.

Cordialement,
<Lead>
```

## 8. Phase G — Observation 48h

### 8.1 Monitoring continu

- Sentry : checker toutes les 2-4h pendant 48h
- Vercel logs : `vercel logs --follow | grep chat`
- Plausible : custom dashboard "Chat Admin Health"

### 8.2 KPIs à observer

| KPI | Mesure | Action si anormal |
|---|---|---|
| Sessions visibles `/admin/chat/conversations` | <30 (vs ~100 pré-fix) | Si >100 : flag mal appliqué |
| Pages 500 erreurs | 0 | Rollback flag |
| Latency P95 SSR | <500ms | Investigate index |
| Leads visibles `/admin/chat/leads` | proportionnel | OK si baisse 30-60% |

### 8.3 J+1 checkpoint

```bash
# 24h après ship
psql $PROD_DATABASE_URL -c "
  SELECT kind, COUNT(*) FROM chat_session
  WHERE opened_at >= NOW() - INTERVAL '24 hours'
  GROUP BY 1
"
# Attendu : kind='chat' et kind='wizard_pivot' avec ratios cohérents
```

### 8.4 J+2 checkpoint

- Décision : maintenir flag ON définitivement OU retour rollback
- Si OK : annoncer "Fix validé" dans #shipped
- Si NOK : RCA + rollback

## 9. Rollback prod (si nécessaire)

⚠️ **Procédure d'urgence** — cf. `06-plan-action/rollback.md`.

```bash
# Rollback N1 (flag) — 5 min
vercel env add CHAT_ADMIN_FILTERS_V2 production
# Saisir : false
vercel deploy --prod

# Smoke après rollback
pnpm tsx scripts/smoke-chat-purity.ts --url https://femiglow-maroc.com
# Doit toujours retourner 3/3

# Visite admin
open https://femiglow-maroc.com/admin/chat/conversations
# Doit afficher la liste polluée (comportement legacy)
```

## 10. Clore le sprint

```bash
# Une fois 48h passées sans incident :

# 1. Update doc
echo "## Status: SHIPPED (2026-05-XX)" >> docs/chat-conversations-leads-fix-2026-05/README.md

# 2. Tag git
git tag -a cha-lead-v2-shipped -m "CHA-LEAD-V2 shipped 2026-05-XX"
git push origin cha-lead-v2-shipped

# 3. Archiver les snapshots
ls docs/chat-conversations-leads-fix-2026-05/04-data-strategy/snapshots/
# Vérifier : pre-migration.json, post-migration.json, post-cleanup.json (si applicable)

# 4. Communication finale
# Slack #shipped : "CHA-LEAD-V2 validé après 48h obs. RAS."

# 5. Update Linear/Notion : sprint marqué Done.
```
