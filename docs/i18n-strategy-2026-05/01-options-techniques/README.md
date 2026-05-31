# 01 — Options techniques

Analyse comparative des libraries i18n et architectures.

## Fichiers

| Fichier | Contenu | Format |
|---|---|---|
| [`comparaison-libraries.md`](./comparaison-libraries.md) | next-intl vs next-i18next vs paraglide vs lingui vs maison — 50+ critères | Markdown |
| [`decision-matrix.csv`](./decision-matrix.csv) | Matrice de scoring (poids × note) pour les 5 options | CSV |
| [`architecture-options.puml`](./architecture-options.puml) | 3 archi alternatives (path-based, cookie-based, hybrid) | PlantUML |
| [`benchmarks.md`](./benchmarks.md) | Bundle size, startup time, SSR perf par option | Markdown |
| [`recommendation.md`](./recommendation.md) | Synthèse + recommandation argumentée | Markdown |
| [`migration-paths.md`](./migration-paths.md) | Comment basculer d'une option à une autre | Markdown |

## Méthode d'analyse

1. **Critères** : 50+ critères pondérés (performance, DX, SEO, RSC, RTL, écosystème, etc.)
2. **Scoring** : 0-5 par critère
3. **Pondération** : selon priorité projet
4. **Recommandation** : option avec meilleur score pondéré

## Synthèse rapide

| Option | Score / 100 | Verdict |
|---|---|---|
| **A. next-intl** | **88** | 🥇 Top choix — RSC-first, mature, type-safe |
| **B. next-i18next** | 65 | ⚠️ Pages Router orienté |
| **C. paraglide-js** | 75 | 🆕 Prometteur mais jeune |
| **D. react-i18next brut** | 60 | Trop bas niveau |
| **E. Maison** | 55 | Trop coûteux à maintenir |

→ Cf. [`decision-matrix.csv`](./decision-matrix.csv) pour le détail des 50 critères.

## Décision proposée

**Option A — `next-intl`** combinée avec :
- Path-based routing (`/[locale]/...`)
- JSON messages files + Drizzle DB pour CMS dynamique
- ICU MessageFormat
- `Intl.PluralRules` native
- Tailwind logical properties pour RTL
- Codegen TypeScript pour type-safety

À valider via ADR-001.
