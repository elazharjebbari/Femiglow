# 05 — Runbook rollout

## Pré-requis avant L4

- [ ] L0 → L3 mergés sur `master`
- [ ] CI verte (vitest + Playwright + Lighthouse + axe)
- [ ] PR review humaine OK
- [ ] Baseline 7 j Plausible exportée
- [ ] Git tag `kit-landing-baseline-2026-05-22` créé

## Procédure rollout (4 paliers)

### Palier 1 — Internal (0% trafic)

**Durée** : 2h
**Activation** : preview deployment Vercel uniquement
**Vérif équipe** :
- [ ] /kit?layout=v2 charge sans erreur
- [ ] Wizard fonctionne (lead → address → thank_you)
- [ ] Sticky CTA mobile scroll correctement
- [ ] Tracking events fire dans Plausible debug
- [ ] LCP < 2.5s sur device test
- [ ] axe scan : 0 violation

**Gate** : ✅ équipe valide → palier 2.

### Palier 2 — Canary (10% trafic)

**Durée** : 24h
**Activation** :
```bash
# Vercel env
NEXT_PUBLIC_KIT_LAYOUT_V2=true  # 10% via edge middleware split
```

Routing 90/10 via cookie sticky `fg_kit_layout=v2|v1` (set 1ère visite).

**Métriques à surveiller** :
- Bounce rate ≤ baseline +2%
- Aucune erreur JS supplémentaire (Sentry)
- Wizard `lead_submit` rate ≥ baseline -5%
- LCP P75 mobile < 2.8s

**Gate** : ✅ Canary OK → palier 3. ❌ Sinon **ROLLBACK** (voir ci-dessous).

### Palier 3 — Ramp (50% trafic)

**Durée** : 5 j
**Activation** : split edge middleware 50/50
**Mesure statistique** :
- N ≥ 5000 visiteurs / branche
- Conv rate v2 vs v1 (test χ²)
- Décision Go si v2 ≥ v1 + 0% (au moins égal) ET pas de régression sur autres KPI

**Gate** : ✅ Ramp gagne → palier 4. ❌ Sinon décision business (continuer mesure ou rollback).

### Palier 4 — Full (100% trafic)

**Activation** :
```bash
# Vercel env
NEXT_PUBLIC_KIT_LAYOUT_V2=true   # 100%
```

Suppression du split middleware. Toute la prod sur v2.

**Suivi continu** : conv rate + LCP web-vitals.

## Rollback procedure

### Rollback rapide (< 60 sec)

```bash
# Via Vercel CLI ou dashboard
vercel env rm NEXT_PUBLIC_KIT_LAYOUT_V2 --env production
vercel --prod  # redeploy
```

Effet : tous les utilisateurs basculent sur v1 instantanément (no cache miss car le code v1 est toujours présent).

### Rollback profond (revert code)

Si bug structurel détecté :

```bash
git revert <merge-commit>
git push origin master
# Vercel redeploy auto
```

## Dashboard métriques

Créer un dashboard Plausible avec :
- Conv rate v1 vs v2 (split par cookie `fg_kit_layout`)
- Scroll depth (P50, P90)
- Wizard abandon rate par étape
- LCP réel (web vitals events)
- Erreurs JS par version

URL : `https://plausible.io/femiglow-maroc.com/dashboards/kit-layout-v2`

## Communication

### Annonce interne (start Canary)

```
🚀 /kit layout v2 — Canary 10%
- Nouveau ordre Kolenda (wizard pos 6)
- 3 sections retirées
- Sticky CTA mobile
- Rollback < 60 sec si KO
- Dashboard : <lien>
```

### Annonce externe (Full)

Aucune. Le changement est UX, pas business.

## Timeline cible

| Jour | Action |
|---|---|
| J+0 | Merge PR `kit-landing-reorder-2026-05` |
| J+0 | Internal 2h |
| J+0 (soir) | Canary 10% |
| J+1 | Vérif Canary → Ramp 50% si OK |
| J+6 | Décision Go/No-Go basé sur 5 j de Ramp |
| J+7 | Full 100% (si Go) ou rollback (si No-Go) |
| J+30 | Si Go ferme : suppression définitive du flag + composants v1 redondants |

## Post-mortem si rollback

Document `06-postmortem-rollback.md` (à créer si applicable) :
- Cause racine
- Métrique qui a déclenché le rollback
- Apprentissages
- Itération v3 envisagée
