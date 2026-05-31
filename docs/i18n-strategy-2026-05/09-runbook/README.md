# 09 — Runbook opérationnel i18n FemiGlow

> **Mission** : guide opérationnel pas-à-pas pour exécuter, opérer et maintenir l'internationalisation FemiGlow en conditions réelles.
>
> **Audience** : lead technique (exécution), dev (pilotage), translateur externe (workflow), founder (monitoring), ops (déploiement, troubleshooting).
>
> **Différence avec `08-plan-action/`** : le plan d'action **décrit** ce qu'il faut faire (phases, DoD, dépendances). Le runbook **explique comment** le faire en pratique avec des commandes shell exécutables, des templates, et des checklists copy-pastables.

---

## TL;DR usage

Tu es à quel poste ? Voici par où commencer :

| Profil | Premier fichier à lire | Temps lecture initial |
|---|---|---|
| **Lead technique** kickoff projet | [`execution-pas-a-pas.md`](./execution-pas-a-pas.md) | ~45 min |
| **Dev** en exécution phase X | [`execution-pas-a-pas.md`](./execution-pas-a-pas.md) § Phase X | ~10 min |
| **Translateur externe** AR/EN | [`workflow-translateur.md`](./workflow-translateur.md) | ~20 min |
| **DevOps / Lead** deploy prod | [`deploiement.md`](./deploiement.md) | ~30 min |
| **Maintenance régulière** (toute l'équipe) | [`operations-quotidiennes.md`](./operations-quotidiennes.md) | ~15 min |
| **Bug / question** en cours | [`troubleshooting.md`](./troubleshooting.md) | (recherche Cmd+F) |
| **Ajouter une 4ème langue** (post V1) | [`ajouter-nouvelle-langue.md`](./ajouter-nouvelle-langue.md) | ~25 min |

---

## Les 7 documents du runbook

| Fichier | Quand l'utiliser | Volume |
|---|---|---|
| [`README.md`](./README.md) | **Ce fichier** — Index, TL;DR, ordre lecture | ~250 lignes |
| [`execution-pas-a-pas.md`](./execution-pas-a-pas.md) | Pilotage exécution phase 0 → phase 8 (setup env, commandes, vérifs, commit/PR, gates) | ~900 lignes |
| [`ajouter-nouvelle-langue.md`](./ajouter-nouvelle-langue.md) | Procédure post-V1 pour ajouter `es`, `de`, `it`, `he`, `ja`… | ~500 lignes |
| [`workflow-translateur.md`](./workflow-translateur.md) | Onboarding translateur externe (lecture par translateur, pas dev) | ~450 lignes |
| [`deploiement.md`](./deploiement.md) | Procédure déploiement i18n prod (canary 10% → 50% → 100%) | ~500 lignes |
| [`operations-quotidiennes.md`](./operations-quotidiennes.md) | Tâches récurrentes daily / weekly / monthly / quarterly | ~400 lignes |
| [`troubleshooting.md`](./troubleshooting.md) | FAQ 25+ Q/A + erreurs fréquentes avec fix TypeScript | ~600 lignes |

**Total** : ~3 600 lignes de doc opérationnelle pure.

---

## Ordre de lecture recommandé selon contexte

### Contexte 1 — Kickoff projet (semaine 0)

Tu es lead technique et tu démarres la phase 1 :

1. [`../README.md`](../README.md) — Vue d'ensemble étude (10 min)
2. [`../08-plan-action/phases.md`](../08-plan-action/phases.md) — Plan détaillé tâches (60 min)
3. [`execution-pas-a-pas.md`](./execution-pas-a-pas.md) § Setup environnement + Phase 0 + Phase 1 (45 min)
4. [`deploiement.md`](./deploiement.md) § Setup Vercel env vars (20 min)

### Contexte 2 — Onboarding nouveau dev sur le projet

Tu rejoins l'équipe en cours d'exécution :

1. [`../README.md`](../README.md) — Comprendre l'étude (10 min)
2. [`../00-context/glossaire.md`](../00-context/glossaire.md) — Vocabulaire i18n (5 min)
3. [`../08-plan-action/phases.md`](../08-plan-action/phases.md) — Plan tâches (30 min)
4. [`execution-pas-a-pas.md`](./execution-pas-a-pas.md) — Tout (60 min)
5. [`troubleshooting.md`](./troubleshooting.md) — Au cas où tu butes (référence)

### Contexte 3 — Translateur externe missionné

Tu es translateur AR ou EN :

1. [`workflow-translateur.md`](./workflow-translateur.md) — Tout, lu par toi (25 min)
2. [`../06-data-strategy/glossaire-fr-ar.csv`](../06-data-strategy/) — Glossaire (référence)
3. [`../05-ui-ux-design/tone-style-guide.md`](../05-ui-ux-design/tone-style-guide.md) — Voix FemiGlow (15 min)

### Contexte 4 — Préparation deploy prod

Tu pilotes le déploiement phase 7 :

1. [`../08-plan-action/rollback.md`](../08-plan-action/rollback.md) — Connaître les procédures rollback (30 min)
2. [`../08-plan-action/feature-flags.md`](../08-plan-action/feature-flags.md) — Comprendre les 4 flags (20 min)
3. [`deploiement.md`](./deploiement.md) — Tout (45 min)
4. [`troubleshooting.md`](./troubleshooting.md) — Préparer mental check-list erreurs (20 min)

### Contexte 5 — Maintenance post-V1

Le projet est en prod, tu fais le run quotidien :

1. [`operations-quotidiennes.md`](./operations-quotidiennes.md) — Tout (20 min)
2. [`troubleshooting.md`](./troubleshooting.md) — Référence (à garder ouvert)

### Contexte 6 — Ajout d'une langue après V1

La fondatrice décide d'activer Espagnol après 6 mois :

1. [`ajouter-nouvelle-langue.md`](./ajouter-nouvelle-langue.md) — Tout (30 min)
2. [`workflow-translateur.md`](./workflow-translateur.md) § export CSV + brief (rappel)
3. [`deploiement.md`](./deploiement.md) § Canary (rappel)

---

## Pré-requis avant d'utiliser ce runbook

### Outils à installer en local

| Outil | Version min | Commande check |
|---|---|---|
| Node.js | 20.x LTS | `node --version` |
| pnpm | 9.x | `pnpm --version` |
| Git | 2.40+ | `git --version` |
| Vercel CLI | latest | `vercel --version` |
| Drizzle Kit | (via pnpm) | `pnpm drizzle-kit --version` |
| Playwright | (via pnpm) | `pnpm playwright --version` |

### Accès à demander avant kickoff

| Service | Niveau d'accès | Owner |
|---|---|---|
| GitHub repo `femiglow/web` | Maintainer | Lead actuel |
| Vercel project `femiglow` | Member (env vars) | Lead actuel |
| Neon DB project `femiglow-prod` | Editor (snapshots) | Lead actuel |
| Sentry org `femiglow` | Member (créer alerts) | Lead actuel |
| Slack #team-femiglow | Member | Founder |
| Google Drive partagé translations | Editor | Founder |

### Variables d'environnement minimales

Voir `apps/web/.env.example`. Variables i18n :

```bash
I18N_ENABLED=true
I18N_LOCALES_ACTIVE=fr,ar,en
I18N_RTL_ENABLED=true
I18N_CMS_BINDINGS_ENABLED=true
```

Détails complets : [`../08-plan-action/feature-flags.md`](../08-plan-action/feature-flags.md).

---

## Conventions du runbook

### Notation des commandes

Toutes les commandes shell sont **copy-pastables**. Convention :

```bash
# Commentaire explicatif
pnpm -F web build
```

Les variables placeholder sont entre `{}` :

```bash
git checkout -b feat/i18n-{phase-name}
```

Les chemins absolus locaux sont entre `<>` :

```bash
cd <project-root>/apps/web
```

### Notation des résultats attendus

Chaque commande critique est suivie d'un bloc « Sortie attendue » ou d'une checkbox de vérification :

```bash
pnpm -F web typecheck
# Attendu : exit code 0, aucune erreur TS
```

Ou bien :

- [ ] `<html lang="fr" dir="ltr">` visible dans devtools sur `/fr/contact`
- [ ] `<html lang="ar" dir="rtl">` visible sur `/ar/contact`

### Avertissements

- ⚠️ **Attention** : action potentiellement dangereuse
- 💡 **Astuce** : raccourci ou conseil
- 🚨 **Critique** : à ne surtout pas faire

(les emojis sont utilisés uniquement pour ces 3 marqueurs visuels)

---

## Liens transverses

### Dans `docs/i18n-strategy-2026-05/`

- [`../README.md`](../README.md) — Sommaire étude
- [`../00-context/`](../00-context/) — Audit existant + ADRs + glossaire
- [`../06-data-strategy/workflow-translation.md`](../06-data-strategy/workflow-translation.md) — Workflow détaillé export/import
- [`../08-plan-action/phases.md`](../08-plan-action/phases.md) — Plan détaillé tâches
- [`../08-plan-action/feature-flags.md`](../08-plan-action/feature-flags.md) — 4 flags i18n
- [`../08-plan-action/rollback.md`](../08-plan-action/rollback.md) — Procédures rollback
- [`../10-monitoring/`](../10-monitoring/) — KPIs et dashboards
- [`../11-test-execution/`](../11-test-execution/) — Boucle correction tests

### Externes

- Doc next-intl : https://next-intl-docs.vercel.app/
- Doc Vercel env vars : https://vercel.com/docs/projects/environment-variables
- Doc Neon snapshots : https://neon.tech/docs/manage/snapshots
- BCP-47 reference : https://www.iana.org/assignments/language-subtag-registry

---

## Statut du runbook

| Section | Statut | Auteur |
|---|---|---|
| README index | ⏳ Draft | Claude |
| Exécution pas-à-pas | ⏳ Draft | Claude |
| Ajouter langue | ⏳ Draft | Claude |
| Workflow translateur | ⏳ Draft | Claude |
| Déploiement | ⏳ Draft | Claude |
| Opérations quotidiennes | ⏳ Draft | Claude |
| Troubleshooting | ⏳ Draft | Claude |

→ Une fois exécution phase 1-2 démarrée, basculer en `Vivant` (doc mise à jour au fil de l'eau avec retours réels du terrain).

---

## Workflow de mise à jour du runbook

Ce runbook est un **document vivant**. À mettre à jour à chaque :

1. **Nouvelle erreur rencontrée** → ajout Q/A dans `troubleshooting.md`
2. **Commande corrigée** → mise à jour `execution-pas-a-pas.md`
3. **Nouvelle locale ajoutée** → enrichir `ajouter-nouvelle-langue.md` avec retour d'expérience
4. **Rollback effectué** → leçons dans `operations-quotidiennes.md` ou `troubleshooting.md`
5. **Translateur change** → re-vérifier `workflow-translateur.md` clair pour nouveau

Process pull request pour update :

```bash
git checkout -b docs/runbook-update-{topic}
# Modifier les fichiers concernés
git add docs/i18n-strategy-2026-05/09-runbook/
git commit -m "docs(runbook): {topic}"
gh pr create --title "docs(runbook): {topic}" --base master
```

---

**Auteur** : Claude — 27 mai 2026
**Version** : 1.0
