# Boucle correction-vérification — Tests i18n FemiGlow

> **Cœur opérationnel** du sous-dossier `11-test-execution/`.
> Décrit **comment réagir** quand un test fail : detecter, trier, corriger, vérifier, regress check, documenter.
>
> Audience : dev qui pilote, QA, lead technique qui valide signoff.
> Référence appelée depuis `plan-batterie-tests.md` à chaque palier rouge.

## Sommaire

- [Vue d'ensemble de la boucle](#vue-densemble-de-la-boucle)
- [Phase 1 — Detect](#phase-1--detect)
- [Phase 2 — Triage](#phase-2--triage)
- [Phase 3 — Fix](#phase-3--fix)
- [Phase 4 — Verify](#phase-4--verify)
- [Phase 5 — Regress check](#phase-5--regress-check)
- [Phase 6 — Document](#phase-6--document)
- [Boucle visualisée](#boucle-visualisée-flowchart-ascii)
- [SLA par sévérité](#sla-par-sévérité)
- [Exit criteria globaux](#exit-criteria-globaux)
- [Templates](#templates)

---

## Vue d'ensemble de la boucle

Quand une wave fail, on enclenche la **boucle correction-vérification** en 6 phases :

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   1. DETECT    →    2. TRIAGE    →    3. FIX                    │
│   (constate)        (priorise)        (code + test)             │
│       ▲                                  │                      │
│       │                                  ▼                      │
│   6. DOCUMENT  ←    5. REGRESS   ←    4. VERIFY                 │
│   (changelog)       (full wave)       (test+adj)                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Principe** : on ne quitte une phase que quand sa **definition of done** est atteinte. Pas de raccourci.

**Durée typique d'une boucle** :
- P0 : 4-24h
- P1 : 1-7 jours
- P2 : 1-30 jours (sprint suivant)

---

## Phase 1 — Detect

### 1.1 Objectif

Constater, collecter et caractériser les failures d'une wave de tests.

### 1.2 Activités

#### a) Run la wave en mode reporting

```bash
# Exemple Wave 4 (E2E)
pnpm --filter @femiglow/web test:i18n:wave4 -- \
  --reporter=list,html,junit \
  --output-dir=.test-execution/wave-4-attempt-N
```

Avec `--reporter=list,html,junit` :
- `list` : log lisible en console pendant le run
- `html` : rapport HTML auto-générique pour navigation des fails
- `junit` : `junit.xml` pour ingestion CI

#### b) Collecter les failures

Pour chaque test rouge, extraire :

| Champ | Description | Exemple |
|---|---|---|
| Test ID | ID Vitest/Playwright | `T204` ou `wizard-checkout.spec.ts:15:1 > completes wizard in ar` |
| Wave | Numéro de la wave | 4 |
| Locale | FR / AR / EN / all | ar |
| Layer | unit / component / integration / e2e | e2e |
| Symptôme | Message d'erreur | `Expected dir="rtl" got dir="ltr"` |
| Stack trace | Fichier + ligne | `WizardPage.ts:42` |
| Screenshot | (E2E) | `test-results/.../screenshot.png` |
| Video | (E2E) | `test-results/.../video.webm` |
| Trace | (E2E Playwright) | `test-results/.../trace.zip` |

#### c) Catégoriser

| Catégorie | Description | Exemple FemiGlow |
|---|---|---|
| **App bug** | Bug réel dans le code applicatif | Switcher ne change pas `dir` sur `<html>` |
| **Test bug** | Bug dans le test lui-même | Selector `getByText('Découvrir')` au lieu de `getByTestId` |
| **Flaky** | Passe parfois, fail parfois (non-déterministe) | Race condition `waitForLoadState` |
| **Env** | Problème environnement (CI, DB, browser) | Postgres pas seedé |
| **Lib bug** | Bug dans une dep tierce | next-intl issue connue |
| **Data** | Problème data de test (fixtures) | `messages/ar.json` manque une clé |
| **Régression** | Ce qui passait avant fail maintenant | PR récente a cassé la coverage |

#### d) Output Phase 1

Un fichier `failures-wave-{N}.csv` avec toutes les failures classées :

```csv
test_id,wave,locale,layer,category,severity,symptom,owner_pending,timestamp
T204,4,ar,e2e,app-bug,P1,Expected dir=rtl got dir=ltr,tbd,2026-05-27T14:30:12Z
T207,4,fr,e2e,flaky,P2,Timeout waiting for #cart,tbd,2026-05-27T14:31:45Z
T306,6,ar,a11y,app-bug,P0,Critical: label-missing on input,tbd,2026-05-27T14:35:02Z
```

### 1.3 Definition of Done Phase 1

- [ ] Toutes les failures sont listées (pas seulement les 5 premières)
- [ ] Chaque failure a un test ID unique
- [ ] Chaque failure a une catégorie assignée
- [ ] Stack trace + screenshot + video archivés
- [ ] CSV `failures-wave-{N}.csv` versionné dans `.test-execution/`

### 1.4 Anti-patterns Phase 1

- ❌ Ignorer les fails "qui paraissent flaky" sans les analyser
- ❌ Re-run blindement en espérant que ça passe (sans investigation)
- ❌ Considérer les warnings comme des fails (ou inversement)
- ❌ Mélanger les failures de plusieurs runs sans tag de run
- ✅ Toujours conserver les traces Playwright pour rejouer en local

---

## Phase 2 — Triage

### 2.1 Objectif

Prioriser chaque failure (sévérité), assigner un owner, créer un ticket trackable.

### 2.2 Grille de sévérité

| Sévérité | Définition | Exemples | SLA |
|---|---|---|---|
| **P0** | Crash, perte de données, sécurité | XSS dans messages, prod 500 sur `/ar`, locale switcher crash | 24h |
| **P1** | UX cassée, fonctionnalité bloquée | Wizard étape 3 ne valide pas en AR, switcher inactif au keyboard | 7 jours |
| **P2** | Inconvénient visible mais workaround | Mauvais format date en relative time, snapshot diff 0.6% | sprint suivant |
| **P3** | Cosmétique, edge case rare | Très long input AR overflow visuel sur mobile <320px | backlog |

### 2.3 Critères de priorisation

**P0 si l'une des conditions** :
- Production utilisateurs impactés (si déjà shipé)
- Perte de données (audit log manquant, override silencieux)
- Faille de sécurité (XSS, auth bypass, leak data)
- Crash navigateur ou serveur
- Régression critique : feature qui marchait avant ne marche plus

**P1 si l'une des conditions** :
- Flow utilisateur principal bloqué (checkout AR, locale switch, etc.)
- Accessibility critical ou serious violation
- Non-conformité légale (RGPD locale, ARCEP, etc.)
- Bug spécifique à AR/EN (pas FR), donc divergence locale

**P2 si l'une des conditions** :
- Visual diff léger (sub-1% pixel)
- Performance dégradée mais ≥ 90 Lighthouse
- Test flaky < 5% des runs
- Coverage drop < 2% sur module non-critique

**P3** : pour le reste (cosmétique, hyperedge case).

### 2.4 Activités

#### a) Réunion de triage

- **Fréquence** : 1× par jour pendant les 2 semaines de Phase 6
- **Durée** : 15 min
- **Participants** : lead technique, dev, QA
- **Ordre du jour** : revue des failures Wave par Wave avec assignation P0/P1/P2

#### b) Assignation d'un owner

Pour chaque failure, on désigne :
- **Reporter** : qui a constaté (dev qui pilotait la wave)
- **Owner** : qui va corriger (souvent même personne, parfois autre dev)
- **Reviewer** : qui valide la PR de fix

#### c) Création de ticket

Template ticket Linear/JIRA :

```markdown
# [I18N-FIX-{wave}-{nnn}] {short description}

## Sévérité
P{0|1|2|3}

## Wave de la batterie
Wave {N} — {nom}

## Test concerné
- Test ID : `T{nnn}`
- Spec file : `{path}`
- Locale impactée : `{fr|ar|en|all}`

## Symptôme
{message d'erreur exact}

## Stack trace
```
{trace}
```

## Reproduction locale
```bash
{commande pnpm pour reproduire}
```

## Hypothèse cause
{si déjà identifié, sinon "à investiguer"}

## DoD
- [ ] Reproduction locale
- [ ] Fix code applicatif
- [ ] Test ajouté/corrigé
- [ ] Wave {N} re-run green
- [ ] Tests adjacents re-run green
- [ ] Smoke wave {N+1} green (regress check)
- [ ] PR mergée
- [ ] CHANGELOG mis à jour

## Owner
@{username}

## Date estimée résolution
{date selon SLA}
```

#### d) Tableau de bord triage

Maintenir un dashboard quotidien (Notion, Linear board, ou simple `.md`) :

```markdown
# Triage batterie i18n — J{N} ({date})

## Compteurs
- P0 ouverts : 0
- P1 ouverts : 3
- P2 ouverts : 8
- Total ouverts : 11
- Fermés depuis J-1 : 4
- Nouveaux J : 2

## P0 en cours
(aucun)

## P1 en cours
| ID | Owner | ETA | Status |
|---|---|---|---|
| I18N-FIX-4-001 | @alice | J+2 | in review |
| I18N-FIX-6-003 | @bob | J+3 | in progress |
| I18N-FIX-4-007 | @claire | J+5 | todo |

## P2 backlog
(8 items, voir Linear)
```

### 2.5 Definition of Done Phase 2

- [ ] Chaque failure a une sévérité assignée
- [ ] Chaque failure a un owner désigné
- [ ] Chaque failure P0/P1 a un ticket créé
- [ ] Tableau de bord triage à jour
- [ ] Réunion daily standup avec triage tenue

### 2.6 Anti-patterns Phase 2

- ❌ "Tout est P1" → priorisation fictive, surcharge équipe
- ❌ Assigner sans demander à l'owner (capacité, disponibilité)
- ❌ Ne pas créer de ticket pour P2/P3 (perdu, oublié, jamais fixé)
- ❌ Promouvoir un P2 en P0 pour faire pression (manipulation, perte de confiance)
- ✅ Priorisation honnête, owner consenti, ticket trackable

---

## Phase 3 — Fix

### 3.1 Objectif

Implémenter la correction de manière isolée, testée, reviewable.

### 3.2 Workflow Git

#### a) Création de branche

Convention de nommage :
- `fix/i18n-test-{wave}-{nnn}` pour les bugs d'app
- `chore/i18n-test-{wave}-{nnn}` pour les bugs de test
- `flake/i18n-test-{wave}-{nnn}` pour les flaky fixes

Exemple :
```bash
git checkout master
git pull origin master
git checkout -b fix/i18n-test-4-001-rtl-attribute-on-switch
```

#### b) Coder le fix

**Principe** : modification minimale, juste ce qu'il faut pour faire passer le test.

- ❌ "Tant que je suis dedans, je refactor cette autre partie aussi"
- ✅ "Fix minimal, refactor dans une PR séparée"

#### c) Coder le test

Si le test n'existait pas avant ou n'attrapait pas le bug :

1. **Reproduire le bug** dans un test qui fail
2. **Implémenter le fix**
3. **Vérifier que le test passe maintenant**

Approche TDD inversée : on **garantit** que le test attrape le bug avant de le fixer.

```ts
// Exemple : test qui aurait dû exister pour attraper le bug RTL
test('switch to AR sets dir=rtl on <html>', async ({ page }) => {
  await page.goto('/fr/kit');
  await page.getByTestId('locale-switcher-button').click();
  await page.getByRole('menuitemradio', { name: /العربية/ }).click();
  // ⬇️ Cette assertion fail avant le fix
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});
```

#### d) Run local

```bash
# Run le test spécifique pour valider
pnpm --filter @femiglow/web test:i18n:wave4 -- --grep "switch to AR sets dir"
```

#### e) Commit

Convention de message :
```
fix(i18n): set dir=rtl on <html> when switching to AR

- Refresh LangAttribute on locale change client-side
- Add test for switcher → html dir attribute
- Resolves I18N-FIX-4-001

Co-Authored-By: ...
```

#### f) Pull request

Template PR :

```markdown
## Lien ticket
I18N-FIX-4-001

## Problème
Avant ce PR : changer la locale via le switcher ne mettait pas à jour `dir="rtl"` sur `<html>` côté client. Conséquence : layout cassé en AR jusqu'au reload manuel.

## Fix
- `src/components/i18n/LangAttribute.tsx` : ajout d'un `useEffect` qui synchronise `document.documentElement.setAttribute('dir', ...)` à chaque changement de locale.
- `src/components/i18n/LocaleSwitcher.tsx` : passe la nouvelle locale au context provider via `router.replace`.

## Tests
- ✅ E2E `e2e/i18n/locale-switcher.spec.ts:42` ajouté (RTL attribute après switch)
- ✅ Wave 4 entière re-run green
- ✅ Wave 5 visual regression : 0 diff inattendu
- ✅ Wave 6 a11y : 0 critical/serious

## Non-régression
- ✅ Wave 1, 2, 3 toujours green
- ✅ Test CHA-231 (wizard FR/AR keys) toujours green
- ✅ Coverage `components/i18n` : 87% (≥ 85% gate)

## Screenshot
{avant/après diff}
```

### 3.3 Definition of Done Phase 3

- [ ] Branche Git créée avec convention de nommage
- [ ] Code applicatif modifié au minimum nécessaire
- [ ] Test reproduit le bug, puis passe après fix
- [ ] Run local de la wave concernée green
- [ ] Commit message conforme au format
- [ ] PR ouverte avec template rempli
- [ ] PR linkée au ticket (I18N-FIX-{nnn})
- [ ] Reviewer assigné

### 3.4 Anti-patterns Phase 3

- ❌ Fix sans test → on ne saura pas si une future régression réintroduit le bug
- ❌ Fix global (refactor) profitant du moment → review difficile, risque collatéral
- ❌ Force-push après review (efface les commentaires)
- ❌ Merger sans review (perd la 2nd opinion)
- ✅ Fix minimal + test régression + review par 2nd dev

---

## Phase 4 — Verify

### 4.1 Objectif

Confirmer que le fix marche et n'a rien cassé d'adjacent.

### 4.2 Niveaux de vérification

#### Niveau 1 : Test spécifique re-run

```bash
# Le test qui était rouge passe maintenant
pnpm --filter @femiglow/web test:i18n:wave4 -- --grep "T204"
```

Attendu :
```
 ✓ e2e/i18n/locale-switcher.spec.ts:42 › T204 switch to AR sets dir=rtl (3.2s)

 1 passed
```

#### Niveau 2 : Tests adjacents

Identifier les tests qui touchent le même module ou la même feature et les re-run :

```bash
# Tous les tests dans le même fichier
pnpm test:i18n:wave4 -- e2e/i18n/locale-switcher.spec.ts

# Tests qui touchent le composant LocaleSwitcher
pnpm test:i18n:wave2 -- src/components/i18n/LocaleSwitcher

# Tests qui touchent le composant LangAttribute
pnpm test:i18n:wave2 -- src/components/i18n/LangAttribute
```

#### Niveau 3 : Wave complète

Re-run la wave entière pour vérifier que rien d'autre n'a fail :

```bash
pnpm test:i18n:wave4
```

#### Niveau 4 : Smoke wave suivante

Si la wave concernée est une dépendance d'une autre :

```bash
# Si on a fixé wave 4 (E2E), smoke wave 5 (Visual) car elle dépend du DOM rendu
pnpm test:i18n:wave5
```

### 4.3 Activités

#### a) Run en local avant push

```bash
# Toutes les vérifications de niveau 1-3
pnpm test:i18n:wave4 -- --grep "T204"          # niveau 1
pnpm test:i18n:wave4 -- e2e/i18n/locale-switcher.spec.ts  # niveau 2
pnpm test:i18n:wave4                            # niveau 3
```

#### b) Run en CI sur la PR

GitHub Actions doit lancer automatiquement :
- Wave 1 (Foundation)
- Wave 2 (Component)
- Wave 3 (Integration)
- Wave 4 (E2E) — celle qui est concernée
- Wave 5 ou 6 si la PR touche le visuel ou a11y

Si CI rouge → retour Phase 3 (fix incomplet).

#### c) Demo locale pour reviewer

Pour les bugs P0/P1 visuels ou interactifs, partager un screen recording ou Loom de la reproduction avant/après fix.

### 4.4 Definition of Done Phase 4

- [ ] Niveau 1 (test spécifique) green local + CI
- [ ] Niveau 2 (tests adjacents) green local + CI
- [ ] Niveau 3 (wave complète) green local + CI
- [ ] Niveau 4 (smoke wave suivante) green
- [ ] PR review approuvée par 1+ reviewer
- [ ] Pas de nouveau warning console dans les tests
- [ ] Pas de degradation coverage > 1%

### 4.5 Anti-patterns Phase 4

- ❌ Merger sur "ça passe en CI" sans run en local
- ❌ Ignorer le re-run wave complète ("c'est ok, juste le test était cassé")
- ❌ Ne pas vérifier la wave suivante alors qu'elle dépend (visual après E2E)
- ❌ Approuver review sans avoir read le diff
- ✅ Tous les niveaux 1-4 verts avant merge

---

## Phase 5 — Regress check

### 5.1 Objectif

Confirmer que le fix n'a rien cassé ailleurs dans la batterie, et que la régression est durablement testée.

### 5.2 Activités

#### a) Re-run wave entière post-merge

Après merge sur master :

```bash
# Pull master
git pull origin master

# Re-run wave concernée
pnpm test:i18n:wave{N}
```

Si fail → retour Phase 3 (régression réintroduite, hypothèse non comprise).

#### b) Re-run waves dépendantes

Si Wave 2 modifiée, re-run :
- Wave 2 (concernée)
- Wave 4 (qui en dépend pour les flows utilisateur)
- Wave 5 (visuel)
- Wave 6 (a11y)

#### c) 3-runs anti-flaky

Pour les fix de tests flaky, lancer 3 fois consécutives :

```bash
for i in 1 2 3; do
  echo "=== Run $i ==="
  pnpm test:i18n:wave{N} || exit 1
done
```

Si 3/3 green → flaky résolu. Si 2/3 → toujours flaky, retour Phase 1.

#### d) Coverage check

Coverage ne doit pas avoir baissé sur les modules touchés :

```bash
pnpm test:i18n:coverage

# Comparer avec baseline (script perso)
node scripts/perf/compare-coverage.mjs --baseline=.coverage-baseline --current=coverage
```

#### e) Update test-matrix.csv

Si un nouveau test a été ajouté pour la régression :

```csv
T204b,switcher sets dir=rtl on <html> after change,all,e2e,P1,yes,e2e/i18n/locale-switcher.spec.ts
```

#### f) Update verification-checklist.csv

Si un nouveau check est devenu pertinent (cf. fichier dédié).

### 5.3 Definition of Done Phase 5

- [ ] Wave concernée re-run green post-merge
- [ ] Waves dépendantes re-run green
- [ ] 3-runs consécutifs green pour flaky fix
- [ ] Coverage maintenue ou améliorée
- [ ] test-matrix.csv et verification-checklist.csv mis à jour
- [ ] Aucune régression sur tests non-i18n (smoke général)

### 5.4 Anti-patterns Phase 5

- ❌ Ne pas re-run après merge ("c'était green avant le merge")
- ❌ Ignorer un fail "intermittent" (1/3 runs) — c'est flaky
- ❌ Oublier de mettre à jour la matrice → test orphelin
- ✅ Vérification systématique après chaque merge

---

## Phase 6 — Document

### 6.1 Objectif

Tracer pour audit, sharing avec l'équipe, et apprentissage.

### 6.2 Activités

#### a) Mise à jour CHANGELOG

Format `CHANGELOG.md` à la racine ou dans `docs/changelog/` :

```markdown
## [Unreleased] — i18n batterie corrections

### Fixed
- **i18n** : `<html dir="rtl">` correctement appliqué après switch locale (était requis reload) (I18N-FIX-4-001)
- **i18n** : Tab order correct en RTL sur LocaleSwitcher (I18N-FIX-6-003)
- **i18n** : XSS protection ajoutée sur messages ICU avec HTML entities (I18N-FIX-8-002)

### Added
- Test régression E2E pour switch locale + RTL attribute
- Fuzz test sur `resolveLocale` (1000 runs)
```

#### b) Création de regression test (si bug critique)

Pour chaque P0/P1 fixé, **un test de régression dédié** est ajouté pour empêcher la réintroduction :

```ts
// e2e/i18n/regressions/I18N-FIX-4-001-dir-rtl-after-switch.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Regression I18N-FIX-4-001', () => {
  test('html dir=rtl is set after switching to AR (no reload)', async ({ page }) => {
    await page.goto('/fr/kit');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await page.getByTestId('locale-switcher-button').click();
    await page.getByRole('menuitemradio', { name: /العربية/ }).click();
    await expect(page).toHaveURL(/\/ar/);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });
});
```

Convention : `e2e/i18n/regressions/I18N-FIX-{wave}-{nnn}-{slug}.spec.ts`.

#### c) Post-mortem (si incident majeur)

Pour les P0 ou les incidents qui ont impacté la production :

```markdown
# Post-mortem I18N-INC-001 — Production: 500 sur /ar/checkout

## Date
2026-06-15 14:32 UTC

## Sévérité
P0 — Impact production 20% trafic AR

## Durée
- Détection : 14:32
- Mitigation (rollback feature flag) : 14:42 (10 min)
- Root cause identifiée : 16:15
- Fix mergé : 18:00
- Re-activation production : 19:30

## Impact utilisateurs
- 423 sessions AR sur /checkout impactées
- 23 paniers abandonnés probable (à confirmer avec analytics)
- Aucune perte de données (DB intacte)

## Cause
Le wizard CHA-231 importait `messages/ar.json` via un require synchrone qui crashait en runtime serveur Vercel Edge à cause d'une circular dependency avec `dictionary.ts`.

## Comment c'est passé en prod
Wave 3 (integration) n'avait pas couvert le scenario Vercel Edge spécifique. Test passait en Node.js mais pas en Edge runtime.

## Actions correctives
- [x] Hot fix : import dynamique `await import('messages/ar.json')`
- [x] Test ajouté : Wave 8 robustness → test Edge runtime sur 3 locales
- [ ] Process : ajouter "test Edge runtime" à la checklist Wave 3
- [ ] Process : Lighthouse CI doit run en mode Edge également
- [ ] Monitoring : alert Sentry sur erreurs spécifiques runtime mismatches

## Lessons learned
1. **Edge runtime != Node runtime** : nécessite tests dédiés.
2. **Circular dep** doit être bannie via ESLint rule `import/no-cycle`.
3. **Canary 10%** aurait dû attraper ça si trafic AR ≥ 10% : ici, on est passé en 100% trop vite.
```

#### d) Communication équipe

- Annonce sur Slack `#dev-femiglow` à chaque fix P0/P1 mergé
- Récap hebdomadaire dans la review weekly
- Démo live de 5 min lors de la weekly si fix complexe

#### e) Update docs si nécessaire

Si le bug a révélé une lacune doc :

```diff
# docs/i18n-strategy-2026-05/04-frontend/locale-switcher.md
@@ -123,7 +123,15 @@ Composant LocaleSwitcher :
- Au click sur une locale, le composant appelle `router.replace`.
+ Au click sur une locale, le composant :
+ 1. Appelle `router.replace(newPath, { scroll: false })`
+ 2. Met à jour le cookie `NEXT_LOCALE` via Server Action
+ 3. Le `LangAttribute` synchronise `document.documentElement.setAttribute('dir', ...)` via useEffect
+
+ ⚠️ Anti-pattern résolu (I18N-FIX-4-001) : ne pas attendre le reload pour `dir="rtl"`.
```

### 6.3 Definition of Done Phase 6

- [ ] CHANGELOG mis à jour
- [ ] Test de régression ajouté dans `e2e/i18n/regressions/`
- [ ] Post-mortem rédigé si P0
- [ ] Communication équipe faite (Slack + weekly)
- [ ] Docs mises à jour si lacune révélée
- [ ] Ticket I18N-FIX fermé avec lien PR + commit
- [ ] Boucle considérée close

### 6.4 Anti-patterns Phase 6

- ❌ "C'est fixé, on passe au suivant" sans changelog
- ❌ Post-mortem orienté blâme (personne responsable) au lieu d'orienté processus
- ❌ Ne pas créer de regression test → bug peut revenir à l'identique
- ❌ Ne pas updater la doc qui contient l'anti-pattern documenté
- ✅ Documenter pour empêcher le bug de revenir dans 6 mois

---

## Boucle visualisée (flowchart ASCII)

```
                        ┌─────────────────────┐
                        │  WAVE RED DETECTED   │
                        └──────────┬──────────┘
                                   ▼
        ┌──────────────────────────────────────────────────┐
        │  PHASE 1 — DETECT                                 │
        │  - Run wave avec --reporter=list,html,junit       │
        │  - Collect failures → failures-wave-{N}.csv       │
        │  - Catégoriser (app-bug / test-bug / flaky / env) │
        │  DoD : CSV à jour, traces archivées               │
        └──────────────────────────┬────────────────────────┘
                                   ▼
        ┌──────────────────────────────────────────────────┐
        │  PHASE 2 — TRIAGE                                 │
        │  - Sévérité P0 / P1 / P2 / P3                      │
        │  - Owner assigné                                   │
        │  - Ticket I18N-FIX-{wave}-{nnn} créé               │
        │  DoD : dashboard triage à jour                    │
        └──────────────────────────┬────────────────────────┘
                                   ▼
        ┌──────────────────────────────────────────────────┐
        │  PHASE 3 — FIX                                    │
        │  - Branche fix/i18n-test-{wave}-{nnn}              │
        │  - Code minimal + test                             │
        │  - PR template rempli                              │
        │  DoD : PR open + reviewer assigné                 │
        └──────────────────────────┬────────────────────────┘
                                   ▼
        ┌──────────────────────────────────────────────────┐
        │  PHASE 4 — VERIFY                                 │
        │  Niveau 1 : test spécifique green                  │
        │  Niveau 2 : tests adjacents green                  │
        │  Niveau 3 : wave entière green                     │
        │  Niveau 4 : smoke wave suivante green              │
        │  DoD : tous les niveaux verts + review approuvée  │
        └──────────────────────────┬────────────────────────┘
                                   ▼
                          ┌────────┴─────────┐
                          │ Tous niveaux OK ?│
                          └────────┬─────────┘
                            NO     │      YES
                       ┌───────────┘      └──────┐
                       ▼                         ▼
                  RETOUR PHASE 3       PHASE 5 — REGRESS CHECK
                  (fix incomplet)      ┌──────────────────────┐
                                       │ - Re-run wave post-  │
                                       │   merge                │
                                       │ - 3-runs anti-flaky    │
                                       │ - Coverage maintenue   │
                                       │ DoD : 3/3 green        │
                                       └──────────┬───────────┘
                                                  ▼
                                       ┌──────────────────────┐
                                       │ PHASE 6 — DOCUMENT    │
                                       │ - CHANGELOG           │
                                       │ - regression test     │
                                       │ - post-mortem si P0   │
                                       │ - update docs         │
                                       │ DoD : ticket fermé    │
                                       └──────────┬───────────┘
                                                  ▼
                                       ┌──────────────────────┐
                                       │  BOUCLE CLOSE         │
                                       │  Reprendre wave OU    │
                                       │  passer wave suivante │
                                       └──────────────────────┘
```

---

## SLA par sévérité

| Sévérité | SLA résolution | Type de bug | Responsable interim |
|---|---|---|---|
| **P0** | **24h** | Crash, perte data, sécu | Lead technique + dev on-call |
| **P1** | **7 jours** | UX cassée, feature bloquée | Dev owner + reviewer obligatoire |
| **P2** | **Sprint suivant (1-2 semaines)** | Inconvénient, workaround possible | Dev owner |
| **P3** | **Backlog (1-3 mois)** | Cosmétique, edge case rare | Pas d'owner fixe |

### Escalade

Si le SLA n'est pas tenable (capacité, complexité) :

1. **+24h sur P0** → escalade lead technique + founder
2. **+3 jours sur P1** → escalade lead technique
3. **+1 sprint sur P2** → revue en weekly, repush ou déprioritisation

### Pause acceptable

Le SLA peut être suspendu si :
- Le dev owner est OOO (vacances, maladie) avec délégation actée
- Le bug dépend d'une lib externe en attente de fix upstream (avec ticket tracking)
- Le bug est documenté comme "won't fix" avec accord équipe

---

## Exit criteria globaux

Pour signer la phase 6 du plan d'action et passer à la phase 7 (deploy) :

### Critères bloquants

- [ ] **0 P0 ouvert**
- [ ] **< 5 P1 ouverts** (et liste des P1 documentée avec ETA)
- [ ] **< 20 P2 ouverts**
- [ ] **0 flaky test** sur 3 runs consécutifs
- [ ] **Coverage gates respectés** :
  - `lib/i18n/*` ≥ 90%
  - `app/api/i18n/*` ≥ 90%
  - `components/i18n/*` ≥ 80% (warn si moins)
  - Clés FR : 100%
  - Clés AR : ≥ 90%
  - Clés EN : ≥ 90%
- [ ] **8 waves green** avec exit criteria respectés
- [ ] **Verification checklist** 100% verte

### Critères qualitatifs

- [ ] **Daily standup tenu** chaque jour pendant les 2 semaines
- [ ] **Rapport hebdomadaire** envoyé à la founder J5 et J10
- [ ] **Rapport final** rédigé et partagé
- [ ] **Démo équipe** (15 min) tenue
- [ ] **Signoff lead technique** obtenu (commentaire PR ou doc)
- [ ] **Signoff founder** obtenu pour shipping
- [ ] **Tag Git** `i18n-batterie-passed-{date}` créé et pushé

### En cas de non-atteinte

Si exit criteria non atteints en fin de phase 6 :
1. **Repousser ship** : la phase 7 (deploy) ne démarre pas
2. **Documenter** : quel critère manque, pourquoi, plan rattrapage
3. **Réunion d'arbitrage** : lead + founder + dev → arbitrage (continuer batterie, scope réduit, etc.)
4. **Communication** : annoncer le délai sur #dev-femiglow et aux stakeholders

---

## Templates

### Template T1 — Ticket I18N-FIX

```markdown
# [I18N-FIX-{wave}-{nnn}] {short description}

**Sévérité** : P{0|1|2|3}
**Wave** : Wave {N} — {nom}
**Test concerné** : `T{nnn}` dans `{path}`
**Locale impactée** : `{fr|ar|en|all}`

## Symptôme
{message d'erreur exact}

## Stack trace
```
{trace}
```

## Reproduction locale
```bash
pnpm --filter @femiglow/web test:i18n:wave{N} -- --grep "{test_name}"
```

## Hypothèse cause
{si déjà identifié, sinon "à investiguer"}

## DoD
- [ ] Reproduction locale
- [ ] Fix code applicatif
- [ ] Test ajouté/corrigé
- [ ] Wave {N} re-run green
- [ ] Smoke wave {N+1} green
- [ ] PR mergée
- [ ] CHANGELOG mis à jour
- [ ] Regression test ajouté (si P0/P1)

**Owner** : @{username}
**Reviewer** : @{username}
**Date estimée résolution** : {date}
```

### Template T2 — PR description

```markdown
## Lien ticket
I18N-FIX-{wave}-{nnn}

## Problème
{description courte du bug avec contexte}

## Fix
- {fichier 1} : {modification}
- {fichier 2} : {modification}

## Tests
- ✅ Test {ID} ajouté/corrigé
- ✅ Wave {N} re-run green
- ✅ Wave {N+1} smoke green
- ✅ Coverage maintenue ({X}% sur module touché)

## Non-régression
- ✅ Wave 1, 2, 3 toujours green
- ✅ Test CHA-231 (wizard FR/AR keys) toujours green
- ✅ Lighthouse perf 3 locales ≥ 90

## Screenshot avant/après
{image diff}

## Checklist reviewer
- [ ] Diff focalisé (pas de refactor non nécessaire)
- [ ] Test régression présent si bug
- [ ] Pas de warning console
- [ ] CHANGELOG mis à jour
```

### Template T3 — Post-mortem

```markdown
# Post-mortem I18N-INC-{nnn} — {titre}

## Méta
- **Date** : {YYYY-MM-DD HH:MM UTC}
- **Sévérité** : P{0|1}
- **Durée totale** : {minutes}
- **Reporter** : @{username}
- **Owner mitigation** : @{username}

## Timeline
- {HH:MM} — Détection (par qui, comment)
- {HH:MM} — Mitigation appliquée (rollback / hot fix)
- {HH:MM} — Root cause identifiée
- {HH:MM} — Fix mergé
- {HH:MM} — Validation production
- {HH:MM} — Incident clos

## Impact utilisateurs
- {nombre de sessions impactées}
- {locale(s) impactée(s)}
- {flow(s) impacté(s)}
- {perte de revenue estimée}
- {perte de données : oui/non}

## Cause racine
{description technique précise}

## Pourquoi c'est passé en prod
{ce que la batterie de tests n'a pas attrapé et pourquoi}

## Actions correctives
- [x] {action immédiate}
- [x] {action immédiate}
- [ ] {action court terme}
- [ ] {action processus}

## Lessons learned
1. {leçon 1}
2. {leçon 2}
3. {leçon 3}

## Owner suivi
@{username} — review actions correctives J+30
```

### Template T4 — Daily standup batterie

```markdown
# Batterie i18n — Daily J{N} ({date})

## Wave en cours
Wave {N} — {nom}

## Hier
- Wave {N-1} cloturée : {green/red avec détail}
- {nombre} P0/P1 fermés
- {nombre} P0/P1 ouverts

## Aujourd'hui
- Wave {N} : lancement
- Owner principal : @{username}
- Risques anticipés : {liste}

## Tableau bord
- P0 ouverts : {N}
- P1 ouverts : {N}
- P2 ouverts : {N}
- Tests green / total : {X / Y} ({Z}%)
- Coverage : {pct}% (cible 90%)

## Blockers
{liste si présents}

## Actions équipe
- @{username1} : {action}
- @{username2} : {action}
```

### Template T5 — Failure CSV row

```csv
test_id,wave,locale,layer,category,severity,symptom,owner_pending,timestamp,ticket_url,status
T204,4,ar,e2e,app-bug,P1,Expected dir=rtl got dir=ltr,@alice,2026-05-27T14:30:12Z,https://linear.app/femiglow/issue/I18N-FIX-4-001,in-progress
T207,4,fr,e2e,flaky,P2,Timeout waiting for #cart,@bob,2026-05-27T14:31:45Z,https://linear.app/femiglow/issue/I18N-FIX-4-002,todo
T306,6,ar,a11y,app-bug,P0,Critical label-missing on input,@claire,2026-05-27T14:35:02Z,https://linear.app/femiglow/issue/I18N-FIX-6-003,in-review
```

### Template T6 — Branche Git + commit

```bash
# Branche
git checkout master && git pull
git checkout -b fix/i18n-test-{wave}-{nnn}-{slug}

# Commit
git commit -m "$(cat <<'EOF'
fix(i18n): {short description}

- {what changed file 1}
- {what changed file 2}
- Resolves I18N-FIX-{wave}-{nnn}

Refs T{nnn} in test-matrix.csv
EOF
)"
```

---

## Anti-patterns transverses de la boucle

| # | Anti-pattern | Pourquoi mauvais | Bon pattern |
|---|---|---|---|
| 1 | Skip une phase de la boucle | Bug peut revenir, dette technique | Toutes les 6 phases obligatoires |
| 2 | "Re-run et on verra" sans détecter | Flaky resté caché, retour à 0 demain | Phase 1 detect obligatoire |
| 3 | Tout P1 → engorge équipe | Vraies P0 noyées dans le bruit | Grille de sévérité respectée |
| 4 | Fix sans test régression | Bug revient dans 3 mois | Phase 3 + Phase 6 regression test |
| 5 | Merger sans run wave complète | Casse les tests adjacents | Phase 4 niveau 3 obligatoire |
| 6 | Pas de CHANGELOG ni post-mortem | Apprentissage perdu | Phase 6 documentation obligatoire |
| 7 | Owner pas consenti, deadline pas réaliste | Bug bloqué, escalade tardive | Phase 2 owner consenti + ETA réaliste |
| 8 | Mélanger refactor et fix bug | Review difficile, risque collatéral | Fix minimal, refactor en PR séparée |
