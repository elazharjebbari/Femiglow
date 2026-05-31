# 80.5 — Réponse aux incidents

## Sévérité

| Niveau | Définition | Réponse |
|---|---|---|
| **P0** | Impact légal grave (RGPD breach, page CGV inaccessible) | Immédiat — sur appel |
| **P1** | Impact utilisateur majeur (footer cassé, banner cookies KO) | < 1h |
| **P2** | Impact mineur (typo publiée, lien cassé) | < 24h |
| **P3** | Tech debt, optimisation | Planifié |

## Incidents typiques

### I-1 : Page légale 500 ou inaccessible

**Sévérité** : P0 si CGV/Privacy, P1 si autre.

**Procédure** :
1. Check Sentry : trace stack
2. Si urgence : **dépublier la page** depuis l'admin (404 plutôt que 500)
3. Investigation root cause
4. Fix + déploiement
5. Re-publication

### I-2 : Lien légal du footer cassé (404)

**Sévérité** : P1.

**Procédure** :
1. `/admin/legal/health` → identifier les liens cassés
2. Cause typique : slug renommé sans redirect
3. Solutions :
   - Créer un redirect 301 dans `middleware.ts`
   - OU re-créer la page avec l'ancien slug
   - OU retirer le lien du footer

### I-3 : Variable manquante affichée en production

**Symptôme** : `{{COMPANY_RC}}` apparaît tel quel sur la page publique.

**Sévérité** : P1 (image marque).

**Procédure** :
1. `/admin/legal/template-vars` → remplir la variable
2. `/admin/legal/[slug]/edit` → re-publier la page (force la re-substitution + cache invalidation)
3. Vérifier en public

### I-4 : Cookie banner ne s'affiche pas

**Sévérité** : P0 (compliance ePrivacy).

**Procédure** :
1. Vérifier console : erreur JS ?
2. Vérifier cookies : `femiglow_consent` est-il set ?
3. Vérifier `/api/legal/placements/cookie-banner-links` : retourne les bons liens ?
4. Si bug récent : rollback du commit responsable
5. Sinon : patch + redeploy

### I-5 : Checkout consent checkbox absent ou cassé

**Sévérité** : P0 (compliance + bloque conversion).

**Procédure** :
1. Test `/checkout` → la checkbox apparaît ?
2. Si non : urgence — bypass impossible légalement
3. Mitigation immédiate : ajouter à la main le texte hardcoded en attendant le fix
4. Patch + déploiement

### I-6 : RGPD data breach (donnée perso fuitée)

**Sévérité** : P0.

**Procédure CNDP** :
1. **Isoler** la source (revoke tokens, kill compromised process)
2. **Évaluer impact** : combien d'utilisateurs ? quelles données ?
3. **Documenter** : timeline, root cause, données affectées
4. **Notifier la CNDP** sous **72 heures** (loi 09-08)
5. Si risque élevé pour les utilisateurs : **notifier les concernés** directement
6. Post-mortem complet
7. Mise à jour `/legal/politique-confidentialite` si nécessaire (transparence)

### I-7 : Suppression accidentelle d'une page critique

**Procédure** :
1. Vérifier statut en DB :
   ```sql
   SELECT * FROM legal_pages WHERE slug = 'cgv';
   ```
2. Si soft-deleted (`status='archived'`) :
   ```sql
   UPDATE legal_pages SET status = 'published' WHERE slug = 'cgv';
   ```
3. Si hard-deleted (improbable) : restore from git ou backup
4. Vérifier que le footer affiche à nouveau le lien

### I-8 : Cron health échoue de manière répétée

**Sévérité** : P2.

**Procédure** :
1. Logs du cron :
   ```bash
   pnpm tsx scripts/check-cron-status.ts legal-link-health
   ```
2. Causes typiques :
   - Timeout réseau (augmenter `LEGAL_LINK_HEALTH_TIMEOUT_MS`)
   - URLs externes lentes → exclure de la vérif
   - Memory leak → kill + restart
3. Si non urgent : ticket P2

### I-9 : Git sync échoue depuis 24h

**Sévérité** : P2 (backup is nice-to-have, DB est primaire).

**Procédure** :
1. Logs :
   ```sql
   SELECT * FROM audit_events WHERE action = 'legal.git.failed' ORDER BY created_at DESC LIMIT 10;
   ```
2. Causes typiques :
   - SSH key expirée
   - Repo full (quota)
   - Network issue
3. Fix la cause
4. Re-run le sync pour les commits manqués :
   ```bash
   pnpm tsx scripts/legal-git-sync-recovery.ts
   ```

### I-10 : Hallucination de l'assistant (lien légal incorrect)

**Symptôme** : Le chat propose un lien `/legal/inexistant`.

**Sévérité** : P2.

**Procédure** :
1. Vérifier le système de validation (`legal-guard.ts`)
2. Logs des hallucinations :
   ```sql
   SELECT * FROM audit_events WHERE action = 'chat.hallucination.legal' LIMIT 20;
   ```
3. Ajuster le system prompt si récurrent
4. Mettre à jour la liste des slugs valides dans le prompt

## Communication

### Interne

Slack `#tech-femiglow` pour P0/P1 :

```
🚨 INCIDENT P0 — legal pages
Quoi : [description courte]
Impact : [combien d'utilisateurs / quelles pages]
Mitigation : [en cours / appliquée]
Owner : [@maya]
ETA : [...]
```

Updates toutes les 30 min jusqu'à résolution.

### Externe

Pour P0 avec impact public > 1h :
- Banner site discret : "Service temporairement perturbé"
- Pas de détails techniques
- Numéro de support visible

Pour breach RGPD : notification CNDP + utilisateurs sous 72h (obligation légale).

## Post-mortem

Tous incidents P0 et P1 :

Template `postmortems/YYYY-MM-DD-legal-{slug-incident}.md` :

```markdown
# Incident : [Titre court]

## TL;DR
[1-2 phrases]

## Timeline
- 14:30 : Détection (Sentry alert)
- 14:35 : Triage par X
- 14:42 : Mitigation appliquée
- 15:10 : Fix permanent déployé
- 15:30 : Vérification finale OK

## Root cause
[Explication technique]

## Impact
- Utilisateurs : 1234 sessions impactées
- Pages : /legal/cgv
- Durée : 40 minutes

## What went well
- Détection rapide via Sentry
- Mitigation < 5 min

## What went wrong
- Pas de test couvrant ce cas
- Alerte Slack en delay

## Action items
- [ ] Ajouter test pour scenario
- [ ] Améliorer alerting
- [ ] Documenter procédure dans runbook
```

Review en équipe sous 1 semaine.
