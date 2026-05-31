# Déploiement prod

⚠️ **Pré-requis OBLIGATOIRES** :
- Staging validé GO
- Lead a donné le feu vert
- Fondatrice notifiée du créneau
- Backup prod fraîchement créé
- Juriste a validé templates anonymisés

## Phase 1 — Backup prod

```bash
# Neon backup branche
neon branches create --parent main --name pre-legal-v2-prod

# Vérifier branche créée
neon branches list | grep pre-legal-v2
```

## Phase 2 — Migration DB prod

```bash
DATABASE_URL=$PROD_DATABASE_URL pnpm drizzle-kit migrate

# Vérifier
psql $PROD_DATABASE_URL -c "
SELECT key FROM legal_template_vars
 WHERE key IN ('CONTACT_EMAIL','HOST_ADDRESS','COOLING_OFF_DAYS');
"
# Attendu : 3 rows
```

## Phase 3 — Déploiement code avec flag OFF

```bash
# Push branche déjà mergée dans master
git checkout master && git pull

# Vérifier flag prod OFF (default)
vercel env ls production | grep LEGAL_VARS_V2

# Deploy
vercel deploy --prod

# Smoke flag OFF
pnpm tsx scripts/smoke-legal-purity.ts --url https://femiglow-maroc.com
# Attendu : OK (legacy behavior)
```

## Phase 4 — Cleanup orphelins prod

```bash
# Si applicable (prod a aussi des E2E-orphans ?)
# Login admin prod + curl
curl -X DELETE -H "cookie: <prod_admin>" -d '{"dryRun":true,"olderThanDays":7}' \
  https://femiglow-maroc.com/api/admin/legal/cleanup-e2e

# Si candidates raisonnable :
curl -X DELETE -H "cookie: <prod_admin>" -d '{"dryRun":false,"olderThanDays":7}' \
  https://femiglow-maroc.com/api/admin/legal/cleanup-e2e
```

## Phase 5 — Activer flag prod

```bash
# Via dashboard Vercel ou CLI
vercel env rm LEGAL_VARS_V2 production
vercel env add LEGAL_VARS_V2 production
# Saisir : true

# Re-deploy
vercel deploy --prod

# Attendre 1-2 min cache CDN
sleep 90
```

## Phase 6 — Smoke flag ON

```bash
pnpm tsx scripts/smoke-legal-purity.ts --url https://femiglow-maroc.com
# Attendu : 3/3 OK

# Visite admin prod
open https://femiglow-maroc.com/admin/legal/template-vars
# Vérifier bouton "+ Nouvelle variable" + 24 vars
```

## Phase 7 — Republish 4 pages prod

Via admin `/admin/legal/<slug>/edit` :

1. **mentions-legales** — coller nouveau template + save + preview + publier
2. **cgv** — idem
3. **confidentialite** — idem
4. **retours-remboursements** — idem

Pour chaque, vérifier `/legal/<slug>` HTML :
- ❌ Aucun ICE 15-chiffres
- ❌ Aucun RC Ville-NNNN
- ✅ `legal@femiglow-maroc.com` présent
- ✅ Bloc "information sur demande"

## Phase 8 — Validation manuelle prod

```bash
# Visite par Lead
open https://femiglow-maroc.com/legal/mentions-legales
# Vérifier visuellement

# Test création var via admin
open https://femiglow-maroc.com/admin/legal/template-vars
# Créer une test var, valider, supprimer

# Test publish d'un draft (s'il en reste)
open https://femiglow-maroc.com/admin/legal
# Cliquer sur un draft, publier, vérifier rendu /legal/<slug>
```

## Phase 9 — Notification

### Slack `#deploys`

```
[SHIPPED] LEGAL-V2 — Pages légales fix

✅ Migration appliquée
✅ 4 templates anonymisés republies
✅ 6 marketing pages anonymisées
✅ E2E orphans cleanup
✅ Flag LEGAL_VARS_V2=true en prod
✅ Smoke 3/3 OK
✅ Manual validation OK

Impact :
- /legal/mentions-legales et cgv : pas d'ICE/RC visible
- /admin/legal/template-vars : bouton + nouvelle var
- Marketing pages : prénom fondatrice anonymisé

Monitoring 48h en cours.
```

### Email fondatrice

```
Bonjour <nom>,

Le fix sur les pages légales est en prod depuis <heure>.

Tu peux maintenant :
1. Publier les 3 drafts (CGU, retours, sécurité) sans erreur "missing_required_vars"
2. Créer de nouvelles variables depuis /admin/legal/template-vars
3. Vérifier que les pages publiques ne contiennent plus l'ICE ni le RC

L'email legal@femiglow-maroc.com est setup. Les demandes arrivent à <destination>.

Le prénom a été anonymisé sur les pages marketing publiques.

Nous suivons la santé du système pendant 48h.

Cordialement,
<Lead>
```

## Phase 10 — Observation 48h

### J+1

- [ ] Sentry : 0 erreur sur `/legal/*` et `/api/admin/legal/*`
- [ ] Logs Vercel : confirmer events `legal.vars.create`, `legal.cleanup.e2e`
- [ ] Plausible : event `admin_legal_view` reçu
- [ ] Visite admin manual : `/admin/legal` propre (pas d'E2E orphans)
- [ ] Visite public manual : `/legal/mentions-legales` HTML clean

### J+2

- [ ] KPIs business stables
- [ ] Email `legal@` : 0 demandes urgentes en attente
- [ ] Care manual : leads legal en attente acceptables
- [ ] Décision : maintenir flag ON

## Clore le sprint

```bash
# 1. Tag git
git tag -a legal-v2-shipped -m "LEGAL-V2 shipped $(date -I)"
git push origin legal-v2-shipped

# 2. Update doc
echo "## Status: SHIPPED ($(date -I))" >> docs/pages-legales-fix-2026-05/README.md

# 3. Slack #shipped
# "LEGAL-V2 validé après 48h obs. RAS."

# 4. Linear/Notion : sprint marqué Done
```

## Rollback prod si besoin

Cf. `06-plan-action/rollback.md`.

```bash
# Quick rollback flag
vercel env add LEGAL_VARS_V2 production
# Saisir : false
vercel deploy --prod

# Smoke après
pnpm tsx scripts/smoke-legal-purity.ts --url https://femiglow-maroc.com
```
