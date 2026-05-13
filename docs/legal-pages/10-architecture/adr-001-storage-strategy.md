# ADR-001 — Stratégie de stockage : DB + sync git

> **Statut** : Proposed
> **Date** : 2026-05-13

## Contexte

Le contenu des pages légales doit être :
- Éditable depuis l'admin sans deploy
- Versionné (audit légal)
- Récupérable si DB perdue
- Lisible par un juriste externe (diff git)

## Options évaluées

### Option 1 — Pure file-based (git)

Contenu en `content/legal/<slug>.md`. Édition = PR GitHub.

❌ Délai entre rédaction et publication
❌ Workflow inadapté aux non-tech
✅ Audit git natif

### Option 2 — Pure DB

Table `legal_pages`. Édition admin UI.

✅ Édition temps réel
✅ Workflow draft/review/publish
❌ Recovery désastre = DB only
❌ Pas d'audit externe

### Option 3 — Hybride : DB-first + git sync auto

Édition admin = DB. Publication = trigger un git commit auto sur branche
`legal-versions`. Source de vérité = DB ; backup = git.

✅ Combinaison des deux mondes
✅ Audit externalisable
⚠ Complexité supplémentaire (job background)

## Décision

**Option 3 — DB-first + git sync auto**.

## Conséquences

### Positives
- Édition admin temps réel (UX naturelle)
- Versioning DB (`legal_pages_history`) + versioning git (audit immuable)
- Recovery : DB, git, ou backup tier
- Juriste peut review le repo sans accès DB

### Négatives
- Complexité d'implémentation (background job git)
- Gestion des secrets git (SSH key ou token)
- Risque divergence DB ↔ git si job échoue (mitigation : retry + alert)

### Implementation notes

- Branche `legal-versions` créée manuellement au démarrage
- Job background utilise `simple-git` Node lib OU `child_process.exec`
- Format de commit : `[legal] publish <slug> v<version>` + body avec diff
- Sur échec, retry 3× avec backoff, puis alert email

## Format de commit auto

```
[legal] publish mentions-legales v3

Slug:    mentions-legales
Version: 3 (previous: 2)
Status:  draft → published
Author:  Sara (u_abc123)
Date:    2026-05-13T14:32:00.000Z

Variables substituted:
  COMPANY_RC=12345/Rabat
  ICE=001234567890123

Co-Authored-By: FemiGlow Admin Bot <admin-bot@femiglow-maroc.com>
```

## Recovery procedure

Si DB est perdue :
1. `cd /tmp && git clone <repo> --branch legal-versions`
2. `pnpm restore-legal-pages --from-dir /tmp/.../content/legal/`
3. Script importe les `.md` les plus récents par slug en DB en `published`

## Suivi

- C1.F.X (cf. success-criteria.md)
- KPI : ratio commits git / publications DB = 1.0 (jamais de gap)
