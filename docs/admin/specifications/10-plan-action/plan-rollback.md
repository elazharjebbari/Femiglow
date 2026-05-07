# Plan de rollback

Document **opérationnel** à dérouler en cas d'échec critique post
go-live. Préparé à l'avance, lu par la fondatrice avant le go-live,
imprimé et conservé en accès rapide.

## Critères de déclenchement

Rollback **immédiat** (sans attendre) si l'un des cas suivants survient
dans les 24h post-launch :

- 5xx rate > 10 % sur 5 minutes consécutives
- Login admin impossible (fondatrice bloquée)
- Données utilisateur corrompues (lead.email vide, etc.)
- Fuite de secret confirmée
- Latence p95 > 5 secondes pendant 10 minutes

Rollback **après évaluation 30 min** si :

- 5xx rate entre 1 % et 10 %
- Cron tick silencieux > 10 min mais site fonctionnel
- Webhook delivery success rate < 50 %

## Niveaux de rollback

### Niveau 1 — Rollback déploiement Vercel (sans toucher DB)

**Quand** : bug logique applicatif, sans modification de schéma DB.

**Procédure** :

```bash
# 1. Identifier le déploiement précédent stable
vercel deployments --prod | head -3

LAST_GOOD=https://femiglow-{previous-sha}.vercel.app

# 2. Promouvoir
vercel rollback "$LAST_GOOD" --scope=femiglow

# OU dashboard : Deployments → […] → Promote to Production

# 3. Vérifier
curl -I https://femiglow.ma   # 200
```

**Délai** : ~30 secondes pour la propagation.
**Risque** : nul (Vercel garde toutes les versions).
**Effet sur DB** : aucun.

### Niveau 2 — Rollback DB (PITR Neon)

**Quand** : migration cassée ou corruption de données.

**Procédure** :

1. Bloquer le trafic admin :
   ```bash
   vercel env add MAINTENANCE_MODE production "true"
   vercel deploy --prod --force
   ```
2. Identifier le timestamp **avant** l'incident (Sentry / logs).
3. Dashboard Neon → Restore → sélectionner timestamp T-X min.
4. Crée une nouvelle branche depuis ce point.
5. Promouvoir cette branche en `main` Neon (switch).
6. Mettre à jour `DATABASE_URL` et `DIRECT_DATABASE_URL` dans Vercel
   (les nouvelles URLs de la branche promue).
7. Rollback Vercel niveau 1 (vers la version applicative qui correspond
   à ce schéma DB).
8. Désactiver le mode maintenance.
9. Vérifier intégrité : ping `/healthz`, login admin, listing leads.

**Délai** : 15 à 30 minutes selon la complexité.
**Risque** : perte des écritures depuis T (annoncer aux utilisateurs).
**Effet** : retour à un état antérieur cohérent.

### Niveau 3 — Rollback complet (DB + code + DNS)

**Quand** : incident catastrophique (Vercel down longue durée, fuite
massive, corruption multi-tables).

**Procédure** :

1. Communication publique immédiate (Twitter, page d'incident statique).
2. Désactiver les domaines Vercel (Vercel dashboard → Domains → Disable).
3. Pointer DNS `femiglow.ma` vers une page statique d'incident
   (Cloudflare Pages ou S3).
4. Rétablir un environnement propre :
   - Nouvelle branche Vercel depuis tag stable `v0.9.0`.
   - Restore Neon depuis snapshot pre-launch (S3 dump).
   - Re-créer les variables Vercel à neuf.
   - Régénérer **tous** les secrets (`ADMIN_SESSION_PASSWORD`,
     `WEBHOOK_SECRET_KEY`, `CRON_SECRET`, mot de passe admin).
5. Re-déployer.
6. Smoke complet avant ré-ouverture publique.
7. Post-mortem avec action items obligatoires.

**Délai** : 2 à 4 heures.
**Risque** : perte de toutes les données depuis le snapshot pre-launch.
**Effet** : rétablissement quasi-from-scratch.

## Décision : qui déclenche le rollback ?

| Niveau | Décideur | Délai max décision |
|---|---|---|
| Niveau 1 | dev oncall (sans confirmation préalable) | immédiat |
| Niveau 2 | dev oncall + fondatrice (confirmation par SMS) | 5 min |
| Niveau 3 | dev oncall + fondatrice (call vocal) | 15 min |

Le niveau 1 est **toujours réversible** (re-promouvoir la nouvelle
version après fix), donc privilégier ce niveau quand le doute existe.

## Communication pendant le rollback

### Niveau 1 — communication minimale

Slack interne uniquement :
```
🔧 Rollback Niveau 1 en cours — {raison} — ETA 1 min
```

### Niveau 2 — communication interne + fondatrice

```
⚠️ Rollback Niveau 2 — restauration DB en cours
Fenêtre indisponible : ~30 min
Cause : {root cause}
Mise à jour dans 15 min.
```

### Niveau 3 — communication publique

Tweet + email à la fondatrice + bandeau site :
```
Maintenance d'urgence en cours sur femiglow.ma.
Le service sera indisponible quelques heures.
Mise à jour : femiglow.ma/incident
Désolés pour la gêne occasionnée.
```

## Données utilisateur pendant le rollback

Après n'importe quel rollback, identifier les données perdues :

```sql
-- Leads créés pendant la fenêtre incidentelle
SELECT id, email, created_at
FROM leads
WHERE created_at BETWEEN '{T_incident}' AND '{T_rollback}';
```

Pour chaque lead identifié, contact manuel ou réimport si possible
(si le formulaire public a été pris en cache et peut être rejoué).

## Conditions de retour à la normale

Avant de tenter une nouvelle bascule :

- [ ] Root cause identifiée et documentée
- [ ] Fix mergé sur `main` après revue (pas de hotfix non testé)
- [ ] Tests E2E complets verts sur preview
- [ ] Test spécifique pour le scénario d'incident ajouté
- [ ] Plan de bascule mis à jour avec les leçons apprises
- [ ] Communication préventive aux utilisateurs

## Exercice trimestriel

À chaque trimestre, dérouler en preview :

- 1 exercice rollback Niveau 1 (target : < 5 min)
- 1 exercice rollback Niveau 2 (target : < 30 min)
- 1 exercice rollback Niveau 3 (target : < 4h, théorique)

Documenter dans `operations/rollback-tests.md`.

## Annexe : commandes prêtes à copier

```bash
# Vérifier l'état actuel
curl -I https://femiglow.ma
vercel deployments --prod | head -5

# Activer mode maintenance
vercel env add MAINTENANCE_MODE production "true"
vercel deploy --prod --force

# Rollback Vercel
vercel rollback https://femiglow-{sha}.vercel.app --scope=femiglow

# Désactiver mode maintenance
vercel env rm MAINTENANCE_MODE production
vercel deploy --prod --force

# Snapshot manuel Neon (avant intervention)
pg_dump $DATABASE_URL --format=custom --no-owner --no-privileges \
  > backups/femiglow-emergency-$(date +%Y%m%d-%H%M).dump
aws s3 cp backups/femiglow-emergency-*.dump \
  s3://femiglow-backups/emergency/

# Restore depuis dump (en preview d'abord !)
pg_restore --clean --if-exists --no-owner --no-privileges \
  -d $PREVIEW_DATABASE_URL \
  backups/femiglow-emergency-*.dump
```
