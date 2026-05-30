# Méthodologie d'audit

> Baseline figée — audit du pipeline **génération + publication** de FemiGlow Content Studio v2 / AI Engine.
> Date de gel : **2026-05-29**. Branche : `feat/ai-engine-langgraph-mvp`.

## 1. Principe directeur (non négociable)

> **La vérité, c'est le comportement réel de l'application exercée par un opérateur — PAS le rapport de la suite de tests, ni les conclusions d'une passe précédente.**

Conséquences appliquées tout au long de cet audit :

1. Toute affirmation « ça marche » est **prouvée en exerçant le chemin réel**, pas en lisant un test vert.
2. Chaque fonctionnalité est qualifiée séparément en **mode MOCK** et en **mode LIVE**.
3. **Toute fonctionnalité non vérifiée dans les DEUX modes est considérée cassée par défaut** (`untested` ≠ `works`).
4. Chaque finding est soumis à un **vérificateur indépendant** qui tente activement de le **réfuter** ; un finding ne « passe » (`confirmed`) que s'il survit à la réfutation par preuve.

## 2. Pourquoi cette méthode (le problème à traiter)

Le commanditaire constate un **décalage systématique** entre les tests (souvent au vert) et le comportement réel en interface. L'audit cible explicitement **la source de ce décalage** : mocks trop permissifs, doublures qui ne reflètent pas l'API live, assertions qui ne testent pas le point de vue opérateur, états d'erreur non couverts, conditions de course, désynchronisation UI/état réel, hypothèses fausses sur les services externes (OpenAI, Higgsfield, Postiz).

Un symptôme a été capturé **dès la phase de cadrage** et sert de cas d'école (cf. `evidence/`) :
- `vitest` rapporte **1695 tests « passed », 0 failed**, mais le **process sort en exit 1** (unhandled promise rejection). Un *gate* CI basé sur la ligne de résumé déclarerait « tout vert » ; un *gate* basé sur le code de sortie échouerait. → Le rapport de test ment sur l'état réel.

## 3. Protocole d'exécution

### 3.1 Capture de preuves réelles (baseline)

| Source de vérité | Commande | Sortie archivée |
|---|---|---|
| Tests unitaires/intégration (réel) | `pnpm exec vitest run src/lib/content-studio src/lib/social-publishing src/lib/ai-engine src/components/admin/content-studio-v2 --reporter=json` | `evidence/vitest-run.txt`, `evidence/vitest-summary.json` |
| Parcours opérateur E2E (mode MOCK) | `PLAYWRIGHT_BASE_URL=http://127.0.0.1:8012 pnpm exec playwright test <parcours pipeline>` | `evidence/playwright-operator-journeys.txt` |
| Endpoints réels (read-only, authentifié) | `curl -H "Cookie: <session sanctionnée>" http://127.0.0.1:8012/api/...` | cité dans chaque finding |
| Config runtime réelle | inspection `apps/web/.env` (valeurs masquées) | `evidence/runtime-env-state.md` |

### 3.2 Session d'authentification (sanctionnée)

Les probes authentifiés réutilisent **la session admin produite par le flux Playwright officiel** (`e2e/global.setup.ts` → `apps/web/.auth/admin.json`). Extraction du cookie :

```bash
COOKIE=$(python3 -c "import json;d=json.load(open('.auth/admin.json'));print('; '.join(f\"{c['name']}={c['value']}\" for c in d.get('cookies',[])))")
curl -s -H "Cookie: $COOKIE" http://127.0.0.1:8012/api/admin/content-studio/health   # -> 200 (401 sans)
```

> **Contrainte de sécurité** : aucune tentative de *brute-force* ou de *scavenging* de credentials contre `/api/admin/login`. La seule voie d'authentification utilisée est le storageState Playwright.

### 3.3 Fan-out adversarial (Phase 1)

Orchestration multi-agents déterministe (8 domaines audités en parallèle, chacun suivi de son réfuteur indépendant — pipeline *find → refute*) :

```
pipeline(domaines,
  audit  = lecture exhaustive code+tests + probes réels  -> findings {supposé|réel|écart|cause racine, mock/live}
  verify = re-lecture + re-probe indépendants, tentative de RÉFUTATION -> verdict {confirmed|adjusted|refuted}
)
```

Chaque finding porte des **preuves concrètes** (sortie de commande, `fichier:ligne`, ligne de log). Les verdicts `refuted` sont écartés ; les `adjusted` sont corrigés (sévérité/portée) ; seuls les `confirmed`/`adjusted` entrent au registre.

### 3.4 Diagnostic transversal (Phase 2)

11 axes (UI/UX, design, frontend, backend, fiabilité, process, robustesse, maintenabilité, évolutivité, modularité, débogabilité), chacun nourri par les findings confirmés de Phase 1 → `03_axes/<axe>/state.md` + `metrics.json`.

### 3.5 Plan & runbook (Phases 3-4)

Plan priorisé par impact/risque avec **critère de fin mesurable** (« vérifié en mock + live par tel chemin opérateur », jamais « fait »), backlog tracé, et runbook exécutable avec boucle correction → re-test → vérification indépendante.

## 4. Définition de fin (DoD global)

> **Système 100 % fonctionnel, prouvé par des tests orientés opérateur qui passent À L'IDENTIQUE en mode MOCK ET en mode LIVE.**

Tant qu'un chemin n'est pas prouvé dans les deux modes, il reste `broken by default` dans cette baseline.

## 5. Limites de l'audit

- Le **mode LIVE de génération est non configurable en staging au moment du gel** (aucune clé OpenAI ; credential Higgsfield incomplet) : la parité live de la génération est donc **constatée non démontrable** et documentée comme telle, et non simulée.
- Le **mode LIVE de publication n'a pas été déclenché** (il poste sur de **vrais comptes clients Instagram**) : l'analyse live de Postiz repose sur lecture de code, contrats et probes read-only, pas sur une publication réelle.
- Les diagrammes d'architecture reflètent le code de la branche au gel ; ils ne sont pas réécrits après coup (cf. `../CHANGELOG.md`).

## 6. Échelle de sévérité

| Niveau | Définition |
|---|---|
| `blocker` | L'opérateur est bloqué : le résultat attendu est impossible à obtenir. |
| `critical` | Échec silencieux ou perte de données / publication erronée possible. |
| `major` | Dysfonctionnement notable avec contournement pénible. |
| `minor` | Défaut limité, faible impact opérateur. |
| `info` | Observation / dette sans impact immédiat. |
