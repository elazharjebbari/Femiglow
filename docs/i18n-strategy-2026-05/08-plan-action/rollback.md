# Plan de rollback i18n FemiGlow

> Procédures, triggers et templates pour rollback rapide en cas d'incident lors du déploiement i18n.
>
> **Principe** : rollback doit être **rapide** (≤ 5 min), **réversible** (peut re-deploy après fix), et **non-destructif** (pas de perte de données).
>
> **Document parent** : [`README.md`](./README.md)

## Sommaire

- [Principes de rollback](#principes-de-rollback)
- [Triggers de rollback](#triggers-de-rollback)
- [Procédure rollback master (≤ 5 min)](#procédure-rollback-master--5-min)
- [Rollback partiel par locale](#rollback-partiel-par-locale)
- [Rollback partiel par phase](#rollback-partiel-par-phase)
- [Snapshot DB et restauration](#snapshot-db-et-restauration)
- [Communication équipe et utilisateurs](#communication-équipe-et-utilisateurs)
- [Template post-mortem](#template-post-mortem)
- [Tests de rollback](#tests-de-rollback)
- [Checklist post-rollback](#checklist-post-rollback)

---

## Principes de rollback

### Hiérarchie de réversibilité

Du plus simple (et préféré) au plus complexe :

| Niveau | Action | Durée | Réversible |
|---|---|---|---|
| 1 | Toggle feature flag Vercel `I18N_ENABLED=false` | ≤ 5 min | Oui |
| 2 | Réduire locales actives `I18N_LOCALES_ACTIVE=fr` | ≤ 5 min | Oui |
| 3 | Désactiver RTL `I18N_RTL_ENABLED=false` | ≤ 5 min | Oui |
| 4 | Désactiver CMS multilang `I18N_CMS_BINDINGS_ENABLED=false` | ≤ 5 min | Oui |
| 5 | Rollback déploiement Vercel précédent | ≤ 5 min | Oui |
| 6 | Revert commit + redeploy | ≤ 30 min | Oui (mais re-deploy nécessaire) |
| 7 | Restore snapshot DB | ≤ 60 min | Oui (perte data window) |
| 8 | Rollback migration Drizzle | ≤ 30 min | Risqué selon migration |

### Règles d'or

1. **Préférer le toggle de flag** plutôt qu'un redeploy
2. **Communiquer avant rollback** (au moins lead + fondatrice)
3. **Documenter le trigger** dans le post-mortem
4. **Tester le rollback** sur staging au moins une fois par mois
5. **Ne JAMAIS rollback sans monitoring actif** (sinon on ne sait pas si ça a corrigé)
6. **Snapshot DB obligatoire avant chaque phase à risque** (3, 7 surtout)

---

## Triggers de rollback

### Triggers automatiques (alertes)

Configurés dans Sentry, Vercel et monitoring custom :

| Trigger | Seuil | Délai détection | Action |
|---|---|---|---|
| Erreur 5xx prod | > 1% requests sur 5 min | 5 min | Page on-call + investigation |
| Erreur 5xx prod | > 5% requests sur 5 min | 5 min | **Rollback automatique** (si configuré) |
| LCP médian | > 4s pendant 10 min | 10 min | Investigation perf |
| Taux conversion | -10% vs J-7 sur 1h | 1h | Investigation business |
| Taux conversion | -20% vs J-7 sur 30 min | 30 min | **Rollback recommandé** |
| Erreurs JS client | > 100/min | 5 min | Investigation |
| Sentry events spike | × 10 vs baseline | 5 min | Investigation |
| Locale distribution | Anomalie (ex: 0% FR) | 15 min | **Rollback recommandé** |

### Triggers manuels

À déclencher si :
- **Bug critique reproductible** (ex: checkout cassé en AR)
- **Régression visuelle massive** (layout brisé sur > 50% utilisateurs)
- **Demande fondatrice/lead** (jugement business)
- **Incident sécurité** (XSS via input traduit, etc.)

### Triggers à NE PAS rollback

- Bug cosmétique mineur sur 1 locale (fix via PR)
- Typo dans traduction (fix via PR `messages/`)
- Performance dégradée < 5% (acceptable)
- Bug isolé à un parcours rare

---

## Procédure rollback master (≤ 5 min)

### Étape 1 : Confirmer le trigger (30s)

- Vérifier dashboard Sentry
- Vérifier dashboard Vercel Analytics
- Confirmer avec lead (Slack DM) si possible
- Si critique : agir, raconter après

### Étape 2 : Snapshot état (30s)

Capturer pour post-mortem :
- Sentry error sample
- Vercel deployment ID actuel
- Heure exacte UTC
- Trigger spécifique

### Étape 3 : Toggle feature flag (1 min)

Via Vercel Dashboard ou CLI :

```bash
# Via Vercel CLI (depuis machine avec accès)
vercel env rm I18N_ENABLED production
vercel env add I18N_ENABLED production
# entrer : false

# Redeploy pour appliquer
vercel --prod
```

Via Dashboard :
1. Vercel → Project FemiGlow → Settings → Environment Variables
2. Trouver `I18N_ENABLED` ligne Production
3. Edit → valeur `false`
4. Save
5. Redeploy (Vercel propose un bouton "Redeploy")

### Étape 4 : Vérifier rollback (1 min)

- Visiter https://femiglow.ma/ en navigation privée
- Vérifier que `/contact` ne redirige PAS vers `/fr/contact` (back to legacy)
- Inspecter `<html lang>` : doit être `fr` hardcoded
- Vérifier Sentry : erreurs diminuent ?

### Étape 5 : Communication immédiate (2 min)

Slack #team-femiglow (ou Discord équivalent) :

```
🚨 [ROLLBACK i18n] - {timestamp}

Trigger : <description courte>
Action : I18N_ENABLED=false sur prod
Statut : Rollback effectif depuis {time}
Investigations en cours.

Next steps :
- Analyse cause racine
- Fix sur staging
- Re-deploy après validation
```

Si > 30 min downtime ou impact utilisateur visible :
- Status page mise à jour
- Communication réseaux sociaux (selon politique FemiGlow)

---

## Rollback partiel par locale

Si bug isolé à une locale, désactiver uniquement celle-ci sans tout casser.

### Désactiver locale AR uniquement

```bash
# Vercel env
I18N_LOCALES_ACTIVE=fr,en
```

Effets :
- `/ar/*` retourne 404 ou redirige vers `/fr/*`
- Middleware ne propose plus AR dans LocaleSwitcher
- Cookie `NEXT_LOCALE=ar` ignoré → fallback default `fr`

### Désactiver locale EN uniquement

```bash
I18N_LOCALES_ACTIVE=fr,ar
```

### Désactiver RTL mais garder AR (mode dégradé)

```bash
I18N_LOCALES_ACTIVE=fr,ar,en
I18N_RTL_ENABLED=false
```

Effets :
- AR rendu mais en LTR (pas idéal mais évite régression layout)
- `<html dir="ltr">` même en AR
- Utilisé pour debug ou si bug RTL critique

---

## Rollback partiel par phase

Selon la phase déployée, scopes différents :

### Rollback Phase 1 (Foundation)

**Cas** : routing `[locale]` cassé, middleware boucle.

**Action** :
```bash
I18N_ENABLED=false
```

Middleware bypass, routes legacy retournent.

### Rollback Phase 2 (Content extraction)

**Cas** : strings manquantes dans messages JSON, crashes.

**Option A — fix avant** : merger un hotfix avec strings manquantes.

**Option B — rollback** : revenir au commit avant phase 2.

```bash
# Identifier le SHA avant phase 2 (ex: abc1234)
git revert -m 1 <merge-commit-sha>
git push origin master
# Vercel auto-deploy
```

### Rollback Phase 3 (CMS multilingue)

**Cas** : DB query slow, admin cassé, fallback ne marche pas.

**Option A — toggle flag** :
```bash
I18N_CMS_BINDINGS_ENABLED=false
```
→ Code revient à lire `locale='fr'` hardcoded (pré-CMS multilang).

**Option B — rollback migration** :
Migration de Phase 3 est additive (backfill + index). Pour rollback :
```sql
DROP INDEX IF EXISTS idx_cfb_locale_lookup;
-- Le backfill n'est pas rollback (les valeurs 'fr' restent, ce qui est correct)
```

### Rollback Phase 4 (RTL)

**Cas** : layout cassé en AR.

**Action immédiate** :
```bash
I18N_RTL_ENABLED=false
```

Puis investigation visual regression sur prod, fix, redeploy.

### Rollback Phase 5 (Traduction AR)

**Cas** : traduction AR contient bugs (mistranslations, mojibake).

**Option A — fichier seul** :
```bash
git checkout <commit-before-trad> -- apps/web/messages/ar.json
git commit -m "rollback: revert AR translation"
git push
```

**Option B — désactiver AR** :
```bash
I18N_LOCALES_ACTIVE=fr,en
```

### Rollback Phase 7 (Deploy)

**Cas** : canary 50% montre problème, retour à canary 10% ou 0%.

```bash
# Edge Config Vercel
# Réduire de 50% → 10%
# Ou 50% → 0% (rollback complet)
```

---

## Snapshot DB et restauration

### Avant chaque phase à risque

Phases concernées : Phase 3 (migration CMS), Phase 7 (deploy prod).

**Commande Neon** (via dashboard ou CLI) :

```bash
# Via Neon CLI
neon snapshot create \
  --branch main \
  --name "pre-i18n-phase-3-{YYYYMMDD-HHMM}" \
  --description "Backup before CMS multilang migration"
```

Via Dashboard Neon :
1. Project femiglow-prod → Branches
2. Sélectionner branche `main`
3. Create branch from current state
4. Nommer `pre-i18n-phase-3-{date}`
5. Rétention : 30 jours minimum

### Vérifier le snapshot

```bash
# Lister snapshots
neon snapshot list --branch main

# Tester restore sur DB temp
neon branch create \
  --from-snapshot "pre-i18n-phase-3-{date}" \
  --name "test-restore-{date}"

# Connecter à la DB temp et vérifier données
psql $TEST_RESTORE_URL -c "SELECT count(*) FROM component_field_bindings;"
```

### Procédure restore en production

⚠️ **Dernier recours**. Préférer toggle flag.

1. **Communication équipe** : confirmer avec lead + fondatrice
2. **Mode maintenance** : activer page maintenance (Vercel deployment protection)
3. **Snapshot état actuel** (au cas où on veut re-restore plus tard)
4. **Restore Neon** :
   ```bash
   neon branch restore \
     --branch main \
     --snapshot "pre-i18n-phase-3-{date}"
   ```
5. **Vérifier intégrité** : tests smoke sur staging mirroring prod
6. **Désactiver mode maintenance**
7. **Monitor 1h** : KPIs, Sentry, conversion

**Perte de données** : tout ce qui a été écrit entre snapshot et restore est perdu (commandes, leads chat, etc.). Évaluer impact business.

### Migration rollback Drizzle

Pour les migrations purement additives (phase 3), pas besoin de rollback DB :
- L'index ajouté reste (innocuous)
- Le backfill `locale='fr'` reste (correct)
- Le code legacy n'utilise pas la colonne en spécifique

Si migration destructive (drop colonne, rename) :
```bash
pnpm drizzle:down --step 1
```

Mais idéalement : **jamais de migration destructive en phase i18n**.

---

## Communication équipe et utilisateurs

### Communication interne — Slack/Discord template

#### Cas 1 : Rollback préventif (avant impact utilisateur)

```
[INFO] Rollback préventif i18n

Heure : {UTC time}
Trigger : <ex: spike Sentry sur /ar/kit>
Action : I18N_ENABLED=false
Impact : Site revient en monolingue FR
Durée estimée : 2-4h le temps de fix

Personnes contactées : @lead @fondatrice
Investigation : <lien ticket / dashboard>

Status : Rollback effectif. Investigation en cours.
```

#### Cas 2 : Rollback suite incident (impact utilisateur)

```
🚨 [INCIDENT] Rollback i18n urgent

Heure : {UTC time}
Trigger : <ex: 12% requests 500 sur /ar/*>
Impact utilisateur : ~X% des utilisateurs AR voient erreur
Action prise : I18N_ENABLED=false (full rollback)
Statut : Effectif depuis {time}

Vérifications post-rollback :
- [ ] Sentry error rate < baseline
- [ ] Conversion FR stable
- [ ] /fr/* fonctionne
- [ ] /contact (legacy) fonctionne

Cause apparente : <hypothèse à confirmer>
Post-mortem : programmé {date+time}
```

### Communication utilisateurs

**Si downtime < 5 min** : pas de communication publique.

**Si downtime > 5 min ou bug visible** :
- Status page mise à jour (status.femiglow.ma si existe)
- Tweet/Instagram court si community manager présent
- Pop-in site (banner) optionnel : "Maintenance en cours, nous revenons rapidement"

**Si bug AR mais FR/EN OK** : pas de communication globale, juste désactiver AR temporairement.

### Communication post-incident

24-48h après résolution :
- Post LinkedIn / blog si bug avait visibilité
- Email transparence aux clients premium si applicable
- Pas de spam : seulement si pertinent

---

## Template post-mortem

Fichier à créer : `docs/i18n-strategy-2026-05/00-context/post-mortem-rollback-{YYYYMMDD}.md`

```markdown
# Post-mortem — Rollback i18n du {date}

## Résumé exécutif

**Date incident** : {YYYY-MM-DD HH:MM UTC}
**Durée totale** : {X minutes/heures}
**Sévérité** : {SEV1 / SEV2 / SEV3}
**Impact utilisateurs** : {nombre / pourcentage}

**Trigger** : {1 phrase}

**Résolution** : {1 phrase}

## Timeline détaillée

| Heure UTC | Événement | Action |
|---|---|---|
| HH:MM | Deploy phase X | — |
| HH:MM | Alerte Sentry | Investigation lancée |
| HH:MM | Confirmation incident | @lead notifié |
| HH:MM | Décision rollback | — |
| HH:MM | I18N_ENABLED=false | Rollback effectif |
| HH:MM | KPIs reviennent baseline | Confirmation rollback OK |
| HH:MM | Post-mortem démarré | — |

## Cause racine

{Analyse 5-whys ou équivalent}

**Cause immédiate** : {ce qui a déclenché}
**Cause sous-jacente** : {pourquoi ça s'est produit}
**Cause systémique** : {qu'est-ce qui a permis ça}

## Ce qui a bien marché

- {Détection rapide via Sentry}
- {Rollback effectif en X minutes}
- {Communication claire équipe}
- ...

## Ce qui a foiré

- {Détection trop tardive}
- {Procédure rollback pas testée}
- {Manque de tests sur cas X}
- ...

## Actions correctives

| # | Action | Owner | Délai | Statut |
|---|---|---|---|---|
| 1 | Ajouter test E2E sur cas X | @dev | 7j | TODO |
| 2 | Améliorer alerting Sentry | @lead | 14j | TODO |
| 3 | Update runbook rollback | @lead | 3j | TODO |
| 4 | Briefer équipe sur scenario | @lead | 7j | TODO |

## Leçons apprises

1. {Insight 1}
2. {Insight 2}
3. {Insight 3}

## Réfs

- Sentry incident : {URL}
- Vercel deployment qui a foiré : {URL}
- PR du fix : {URL}
- Slack thread : {URL}
```

---

## Tests de rollback

### Test mensuel sur staging

Une fois par mois pendant phases 6-8, exécuter ce drill :

1. Choisir un moment off-peak (peu de tests CI en cours)
2. Activer `I18N_ENABLED=true` sur staging (déjà cas par défaut)
3. Trafic synthétique vers `/ar/kit`
4. Toggle `I18N_ENABLED=false` via Vercel
5. **Chrono** : temps entre toggle et `/contact` revient en legacy
6. Documenter dans `docs/i18n-strategy-2026-05/08-plan-action/drills-rollback.md`

**Cible** : ≤ 5 minutes

### Test bi-mensuel restore DB

Une fois tous les 2 mois :
1. Snapshot DB staging (état actuel)
2. Restore vers branche temp
3. Mesurer durée
4. Vérifier intégrité

**Cible** : ≤ 60 minutes pour restore complet

---

## Checklist post-rollback

À cocher dans les 4h suivant un rollback réel :

### Stabilité

- [ ] Sentry error rate retour à baseline
- [ ] Conversion FR revenue normale
- [ ] Aucun nouveau ticket support lié
- [ ] Health checks Vercel verts
- [ ] DB no slow queries
- [ ] CDN cache cohérent

### Investigation

- [ ] Sentry event sample copié
- [ ] Logs Vercel exportés
- [ ] Captures dashboard archivées
- [ ] Stack trace analysée
- [ ] Hypothèse cause racine formulée

### Communication

- [ ] Slack #team-femiglow informé
- [ ] Fondatrice tenue au courant
- [ ] Lead technique notifié
- [ ] (Si applicable) Status page mise à jour
- [ ] (Si applicable) Communication utilisateurs

### Documentation

- [ ] Post-mortem créé (template ci-dessus)
- [ ] Timeline détaillée renseignée
- [ ] Actions correctives listées
- [ ] Tickets ouverts pour actions

### Re-deploy plan

- [ ] Cause identifiée
- [ ] Fix développé et testé staging
- [ ] Tests additionnels écrits pour prévenir régression
- [ ] PR ouverte avec review
- [ ] Plan re-deploy défini (canary à nouveau ?)
- [ ] Communication équipe sur timeline

---

## Cas particuliers

### Cas 1 : Rollback nécessaire mais flag déjà cassé

Si le flag `I18N_ENABLED` lui-même est buggé (lecture incorrecte), revenir au déploiement précédent via Vercel :

```bash
# Lister déploiements
vercel ls femiglow

# Promote un précédent au prod
vercel promote <deployment-url> --prod
```

### Cas 2 : Rollback partiel impossible (interdépendances)

Si désactiver locale AR casse aussi `/fr/*` (cas de figure d'un bug global) :
- Rollback master (`I18N_ENABLED=false`)
- Investigation séparée
- Pas de cherry-pick risqué en urgence

### Cas 3 : DB inconsistante après rollback

Si rollback laisse DB dans état weird (rows AR créées en admin mais code legacy n'en sait rien) :
- Données AR restent en DB (innocuous)
- Code legacy ignore colonne locale (read default 'fr')
- Restore data complet quand re-deploy

### Cas 4 : Vercel down

Si Vercel lui-même est en panne, le rollback via env var ne marchera pas. Plan B :
- Attendre Vercel restored
- Si urgence absolue : pas d'option immédiate (Vercel = SPOF)
- Communication transparente avec utilisateurs

---

## Annexes

### Commandes utiles

```bash
# Vercel env vars
vercel env ls
vercel env add I18N_ENABLED production
vercel env rm I18N_ENABLED production

# Vercel deployments
vercel ls
vercel inspect <deployment-url>
vercel promote <deployment-url> --prod

# Neon snapshots
neon snapshot list --branch main
neon snapshot create --branch main --name "pre-deploy-{date}"
neon branch create --from-snapshot "name" --name "restore-test"

# Logs Vercel
vercel logs <deployment-url> --since 1h

# Git revert
git log --oneline --merges -20
git revert -m 1 <merge-sha>
git push origin master
```

### Liens

- [`README.md`](./README.md) — TL;DR
- [`phases.md`](./phases.md) — Plan détaillé
- [`feature-flags.md`](./feature-flags.md) — Détails feature flags
- [`checklist.md`](./checklist.md) — Checklists phases
- [`../10-monitoring/`](../10-monitoring/) — Dashboards et alertes
- [`../11-test-execution/`](../11-test-execution/) — Tests

---

## Statut document

- ⏳ **Draft** — à valider lead avant phase 7
- Tester procédure rollback sur staging avant phase 7
