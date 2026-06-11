# F<NN> — <Nom feature>

Template à dupliquer pour chaque feature non détaillée en profondeur.

> Structure minimale **OBLIGATOIRE** :
> - `README.md` (ce fichier, dupliqué et rempli)
> - `acceptance-criteria.md`
> - `test-matrix.csv`
>
> Optionnel (recommandé pour P0/P1) :
> - `scenarios.gherkin`, `sequence-diagram.puml`, `vitest-suite.spec.md`,
>   `playwright-suite.spec.md`, `msw-handlers.md`, `a11y-checklist.md`,
>   `test-data.json`, `risks.md`

## 1. Description fonctionnelle

### 1.1 Cible
<!-- À quoi sert cette feature ? Quelle valeur produit-elle pour l'utilisateur (visiteur ou admin) ? -->

### 1.2 Comportement attendu (happy path)
<!-- Décris pas à pas le comportement nominal, du point de vue utilisateur. -->

### 1.3 Comportements alternatifs / edge cases
<!-- Empty state, loading, error, offline, slow network, concurrent operations, large data, etc. -->

### 1.4 Interfaces / contrats
<!-- Liste les composants UI, props, API endpoints, événements, types Zod -->

### 1.5 Dépendances
<!-- Tables DB, services, autres features (FNN), feature flags, env vars -->

## 2. Pourquoi tester (risques)

### 2.1 Risques métier
<!-- Quels KPI / parcours sont impactés en cas de bug ? -->

### 2.2 Risques techniques
<!-- Race conditions, états partagés, side effects, perf, sécurité -->

### 2.3 Mapping audit
<!-- Référence aux findings audit (C1-C6, I1-I8, etc.) — voir docs/chat-audit-2026-05/02-audit-critique.md -->

## 3. Stratégie de test

### 3.1 Couches utilisées (cocher)
- [ ] Unit (vitest pur)
- [ ] Integration (vitest + MSW + DB test)
- [ ] Component (vitest + RTL + MSW)
- [ ] E2E (Playwright)

### 3.2 Outils spécifiques
<!-- ex : axe-playwright pour a11y, k6 pour load, etc. -->

### 3.3 Données de test
<!-- Factories utilisées, seeds, fixtures -->

## 4. Couverture cible

| Métrique | Cible |
|----------|-------|
| Coverage line | <80 % par défaut, voir test-matrix.csv> |
| Coverage branch | <85 % pour règles métier critiques> |
| Pass rate CI | 100 % |
| A11y violations | 0 critique, 0 sérieux |

## 5. Liens

- 📊 `test-matrix.csv` — détail tests par couche × scénario
- 📜 `scenarios.gherkin` — scénarios Gherkin
- 📐 `sequence-diagram.puml` — séquence UML
- 🧪 `vitest-suite.spec.md` — plan tests vitest
- 🎭 `playwright-suite.spec.md` — plan tests Playwright
- 🔗 `msw-handlers.md` — handlers MSW
- ♿ `a11y-checklist.md` — checklist a11y
- 📦 `test-data.json` — fixtures
- ⚠️ `risks.md` — risques connus

## Métadonnées

- **Owner équipe** : <Frontend / Backend / Both>
- **Priorité** : <P0 / P1 / P2>
- **Bloquant release** : <yes / no>
- **Status doc** : <DRAFT / REVIEWED / FROZEN>
- **Dernière mise à jour** : <YYYY-MM-DD>
