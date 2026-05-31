# Exécution pas-à-pas du plan d'action i18n

> Guide opérationnel pour exécuter les **9 phases** du plan d'action ([`../08-plan-action/phases.md`](../08-plan-action/phases.md)) avec les commandes shell exactes, les checks de DoD, les gates entre phases, et les commits / PRs attendus.
>
> **Ce document complète, ne remplace pas, `phases.md`** : `phases.md` décrit le quoi (objectif, DoD, dépendances), ce document décrit le comment (commandes, vérifications, gestion d'erreurs).
>
> **Statut** : Draft — à valider après phase 1 effective puis enrichir avec retours terrain.

---

## Sommaire

- [Setup environnement initial](#setup-environnement-initial)
- [Boucle de travail quotidienne](#boucle-de-travail-quotidienne)
- [Phase 0 — Étude validée + ADRs](#phase-0--étude-validée--adrs)
- [Phase 1 — Foundation](#phase-1--foundation)
- [Phase 2 — Content extraction](#phase-2--content-extraction)
- [Phase 3 — CMS multilingue](#phase-3--cms-multilingue)
- [Phase 4 — RTL + AR](#phase-4--rtl--ar)
- [Phase 5 — Workflow translateur](#phase-5--workflow-translateur)
- [Phase 6 — Tests denses](#phase-6--tests-denses)
- [Phase 7 — Deploy + observabilité](#phase-7--deploy--observabilité)
- [Phase 8 — Stabilisation](#phase-8--stabilisation)
- [Gates entre phases](#gates-entre-phases)
- [Erreurs courantes](#erreurs-courantes)

---

## Setup environnement initial

À faire **une seule fois** au début du projet par chaque membre dev de l'équipe.

### Étape 1 — Cloner le repo (si pas déjà fait)

```bash
git clone git@github.com:femiglow/web.git
cd web
```

### Étape 2 — Installer Node et pnpm

Vérifier la version Node attendue :

```bash
cat .nvmrc
# Attendu : 20.x (LTS)
```

Si tu utilises `nvm` :

```bash
nvm install
nvm use
```

Installer pnpm via Corepack (recommandé) :

```bash
corepack enable
corepack prepare pnpm@9 --activate
pnpm --version
# Attendu : 9.x
```

### Étape 3 — Installer Vercel CLI

```bash
pnpm add -g vercel
vercel login
# Ouvrir le lien dans le navigateur, s'authentifier avec compte FemiGlow
vercel link --project femiglow
# Sélectionner organization femiglow + project web
```

### Étape 4 — Récupérer les env vars locaux

```bash
cd apps/web
vercel env pull .env.local
# Vercel crée .env.local avec toutes les vars dev
```

Vérifier que les 4 flags i18n sont présents :

```bash
grep '^I18N_' .env.local
# Attendu :
# I18N_ENABLED=true
# I18N_LOCALES_ACTIVE=fr,ar,en
# I18N_RTL_ENABLED=true
# I18N_CMS_BINDINGS_ENABLED=true
```

Si manquants, les ajouter manuellement (cf. [`../08-plan-action/feature-flags.md`](../08-plan-action/feature-flags.md) § Setup Vercel env vars).

### Étape 5 — Installer dépendances + build initial

```bash
cd <project-root>
pnpm install --frozen-lockfile
pnpm -F web typecheck
pnpm -F web build
# Attendu : exit 0 sur les 3 commandes
```

### Étape 6 — Setup DB locale (Postgres ou Neon dev branch)

Option A — Neon branch personnelle :

```bash
# Créer une branche Neon (dashboard Neon ou CLI)
neon branch create --name "dev-{your-name}" --parent main
# Récupérer la connection string
# La mettre dans .env.local : DATABASE_URL=postgresql://...
```

Option B — Postgres local Docker :

```bash
docker run -d --name femiglow-pg \
  -e POSTGRES_USER=fmg \
  -e POSTGRES_PASSWORD=fmg \
  -e POSTGRES_DB=femiglow \
  -p 5432:5432 \
  postgres:15
# Mettre dans .env.local : DATABASE_URL=postgresql://fmg:fmg@localhost:5432/femiglow
```

Lancer les migrations :

```bash
cd apps/web
pnpm db:migrate
# Attendu : aucune erreur, "all migrations applied"
```

### Étape 7 — Vérifier le serveur dev

```bash
cd apps/web
pnpm dev
# Attendu : "Ready in X.Xs" sur http://localhost:3000
```

Ouvrir http://localhost:3000 dans le navigateur :

- [ ] Page home s'affiche en FR (legacy si Phase 1 pas démarrée)
- [ ] Pas d'erreur console
- [ ] Header / footer affichés

### Étape 8 — Setup Playwright (pour tests E2E)

```bash
cd apps/web
pnpm exec playwright install --with-deps
# Installe les binaires browsers (Chromium, Firefox, WebKit)
```

Lancer un test smoke pour valider :

```bash
pnpm -F web test:e2e -- --grep="@smoke"
# Attendu : tests passent (ou skip si pas encore créés)
```

### Étape 9 — Connaissance du repo

Avant d'écrire du code, faire une exploration de 15 min :

```bash
# Voir la structure
tree -L 2 apps/web/src

# Lire les conventions
cat CLAUDE.md
cat apps/web/CLAUDE.md  # si existe

# Voir les locales déjà supportées (wizard CHA-231)
ls apps/web/src/lib/wizard/dictionary/
# Devrait montrer fr.ts, ar.ts (existants)
```

### Checklist setup

- [ ] `node --version` ≥ 20.x
- [ ] `pnpm --version` ≥ 9.x
- [ ] `vercel whoami` retourne ton compte
- [ ] `.env.local` contient les 4 flags i18n
- [ ] `pnpm -F web typecheck` exit 0
- [ ] `pnpm -F web build` exit 0
- [ ] `pnpm -F web dev` lance sur http://localhost:3000
- [ ] DB locale accessible (`pnpm db:migrate` réussi)
- [ ] Playwright installé
- [ ] Lecture rapide structure du repo

---

## Boucle de travail quotidienne

Pendant l'exécution d'une phase, voici la routine du matin / soir.

### Matin (~15 min)

```bash
# 1. Synchroniser avec master
git fetch origin
git checkout master
git pull origin master

# 2. Revenir sur ta branche
git checkout feat/i18n-{phase-name}
git rebase master   # ou merge selon convention équipe

# 3. Mettre à jour dépendances si lockfile changé
pnpm install --frozen-lockfile

# 4. Lancer typecheck + tests rapides
pnpm -F web typecheck
pnpm -F web test:unit -- --run

# 5. Lancer dev server
pnpm -F web dev
```

### Soir (~10 min)

```bash
# 1. Commit le travail en cours
git add -p   # review avant
git commit -m "I18N-X.Y-{desc}"

# 2. Push pour backup
git push origin feat/i18n-{phase-name}

# 3. Si tâche finie : ouvrir/mettre à jour PR
gh pr create   # ou gh pr edit si déjà ouverte
```

### En cas de blocage

1. Cherche dans [`troubleshooting.md`](./troubleshooting.md) (Cmd+F)
2. Vérifie le `phases.md` § Anti-patterns de ta tâche
3. Demande sur Slack #team-femiglow
4. Si bloqué > 30 min : créer un ADR brouillon `docs/adr/i18n/draft-XX-{topic}.md` pour tracer la question

---

## Phase 0 — Étude validée + ADRs

**But** : verrouiller les décisions avant de coder. Pas de code applicatif touché.

### Commandes / actions

#### Action 1 — Diffuser l'étude pour relecture

```bash
# Créer une PR docs si pas encore fait
git checkout -b docs/i18n-strategy-2026-05-final
# Vérifier que tous les .md sont commités
git add docs/i18n-strategy-2026-05/
git status

# Push + ouvrir PR
git push origin docs/i18n-strategy-2026-05-final
gh pr create \
  --title "docs(i18n): étude stratégique complète" \
  --body "Étude i18n FemiGlow — lecture par fondatrice + lead, signoff requis avant kickoff Phase 1."
```

Slack template à envoyer :

```
@founder @lead
L'étude i18n complète est prête pour relecture :
- 12 dossiers, ~3500 lignes de doc
- PR : <lien>
- Lecture estimée : 6h cumulées (1h README seul)
- Deadline relecture : J+2

Réunion décision GO/NO-GO : <date à fixer>
```

#### Action 2 — Réunion GO/NO-GO (J3)

Préparer un Google Doc avec les 10 questions ouvertes de `01-options-techniques/recommendation.md`. Capturer les réponses pendant la réunion.

Template CR à créer dans `docs/i18n-strategy-2026-05/00-context/cr-decision-go.md` :

```markdown
# CR Réunion décision GO/NO-GO i18n — {date}

Participants : @founder @lead @dev

## Décisions

| # | Question | Décision | Raison courte |
|---|---|---|---|
| Q1 | Locale par défaut ? | `fr` | Marché principal MA |
| Q2 | Locales V1 ? | `fr, ar, en` | Cf. 00-context/marches-cibles.csv |
| ... | ... | ... | ... |

## Next steps

- [ ] Lead rédige 8 ADRs (J4)
- [ ] Lead crée branche `feat/i18n-foundation`
- [ ] Kickoff Phase 1 (J5)
```

#### Action 3 — Rédiger les 8 ADRs

```bash
mkdir -p docs/adr/i18n
cd docs/adr/i18n

# Créer les 8 fichiers ADR (template MADR)
for adr in \
  "0001-choix-next-intl" \
  "0002-path-based-routing" \
  "0003-default-locale-fr" \
  "0004-locales-v1-fr-ar-en" \
  "0005-rtl-via-logical-properties" \
  "0006-cms-component-bindings-multilang" \
  "0007-wizard-dictionary-preserved" \
  "0008-workflow-translateur-csv"; do
  touch "${adr}.md"
done
```

Pour chaque ADR, suivre le template MADR (Markdown Architectural Decision Records) :

```markdown
# ADR-XXXX — Titre

## Statut

Accepté — {date}

## Contexte

{Pourquoi cette décision est nécessaire}

## Décision

{Ce qui est décidé}

## Alternatives considérées

- Option A : ... (rejetée car ...)
- Option B : ... (rejetée car ...)

## Conséquences

**Positives** :
- ...

**Négatives / dette acceptée** :
- ...

## Références

- {Lien vers étude, ticket, etc.}
```

#### Action 4 — Setup tracking + branche

```bash
# Créer la branche pour Phase 1
git checkout master
git pull origin master
git checkout -b feat/i18n-foundation
git push -u origin feat/i18n-foundation
```

Créer un epic dans Linear/JIRA avec les sous-tâches T1.1 à T1.8 (cf. `phases.md`).

### Vérifier le DoD Phase 0

- [ ] PR `docs/i18n-strategy-2026-05-final` mergée
- [ ] `cr-decision-go.md` créé et signé
- [ ] 8 ADRs présents dans `docs/adr/i18n/`
- [ ] Branche `feat/i18n-foundation` poussée
- [ ] Epic + tickets Phase 1 créés
- [ ] Statut README étude basculé `Draft` → `Validé`

### Commit final Phase 0

```bash
git add docs/adr/i18n/ docs/i18n-strategy-2026-05/
git commit -m "docs(i18n): ADRs + CR décision GO Phase 1"
git push
```

### Gate Phase 0 → Phase 1

Tous les points DoD ci-dessus cochés. Si un seul rouge, ne pas démarrer Phase 1.

---

## Phase 1 — Foundation

**But** : `next-intl` installé, routing `/[locale]`, page pilote `/contact` en 3 langues.

**Branche** : `feat/i18n-foundation` (créée en Phase 0)

### T1.1 — Installer next-intl

```bash
cd <project-root>
pnpm add -F web next-intl@3.x
# Lock la version exacte une fois confirmée
pnpm -F web list next-intl
# Attendu : next-intl@3.X.X (pin major)

# Vérifier que rien n'a cassé
pnpm -F web typecheck
pnpm -F web build
```

Commit :

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "I18N-1.1-install-next-intl"
```

### T1.2 — Configurer middleware locale + routing

Créer les fichiers :

```bash
cd apps/web
mkdir -p src/i18n
touch src/i18n/config.ts src/i18n/routing.ts src/i18n/request.ts
```

Implémenter selon le détail dans `phases.md` § T1.2.

Vérifier le routing :

```bash
pnpm -F web dev
```

Tester dans le navigateur :

- [ ] `http://localhost:3000/contact` redirige vers `/fr/contact`
- [ ] `http://localhost:3000/en/contact` rend la page
- [ ] `http://localhost:3000/ar/contact` rend la page
- [ ] `http://localhost:3000/xx/contact` retourne 404 (locale invalide)
- [ ] `http://localhost:3000/admin` reste accessible (middleware exclu)
- [ ] `http://localhost:3000/api/health` reste accessible

Commit :

```bash
git add apps/web/src/i18n/ apps/web/src/middleware.ts apps/web/next.config.js
git commit -m "I18N-1.2-middleware-locale"
```

### T1.3 — Structure `app/[locale]/`

```bash
cd apps/web/src/app
mkdir -p \[locale\]/contact
# Déplacer la page contact existante
git mv contact/page.tsx \[locale\]/contact/page.tsx
# Créer le layout
touch \[locale\]/layout.tsx
```

Vérifier :

```bash
pnpm -F web build
# Attendu : routes /fr/contact, /en/contact, /ar/contact dans la sortie build
```

Commit :

```bash
git add apps/web/src/app/\[locale\]/
git commit -m "I18N-1.3-app-locale-structure"
```

### T1.4 — Fichiers messages JSON

```bash
cd apps/web
mkdir -p messages
touch messages/fr.json messages/ar.json messages/en.json
```

Initialiser avec un namespace `contact` (cf. `phases.md` § T1.4 pour le schéma).

Augmenter le type :

```bash
# Créer le fichier de type
touch src/i18n/messages.d.ts
```

Contenu :

```typescript
import type messages from '../../messages/fr.json';

declare global {
  interface IntlMessages extends typeof messages {}
}
```

Vérifier :

```bash
pnpm -F web typecheck
# Attendu : IntlMessages reconnu, autocomplete des clés
```

Commit :

```bash
git add apps/web/messages/ apps/web/src/i18n/messages.d.ts
git commit -m "I18N-1.4-messages-baseline-contact"
```

### T1.5 — LocaleSwitcher

Créer le composant :

```bash
mkdir -p apps/web/src/components/i18n
touch apps/web/src/components/i18n/LocaleSwitcher.tsx
touch apps/web/src/components/i18n/LocaleSwitcher.test.tsx
```

Intégrer dans le header. Tester :

- [ ] Switcher visible sur `/fr/contact`
- [ ] Click `العربية` → URL change vers `/ar/contact`
- [ ] Cookie `NEXT_LOCALE=ar` posé
- [ ] Querystring préservée (`/fr/contact?utm=test` → `/ar/contact?utm=test`)
- [ ] Accessible clavier (Tab focus + Enter)

Commit :

```bash
git add apps/web/src/components/i18n/ apps/web/src/components/site-header/
git commit -m "I18N-1.5-locale-switcher"
```

### T1.6 — Tests E2E baseline

```bash
mkdir -p apps/web/e2e/i18n
touch apps/web/e2e/i18n/contact-locales.spec.ts
```

Écrire 6 scenarios Playwright (cf. `phases.md` § T1.6).

Lancer :

```bash
cd apps/web
pnpm exec playwright test e2e/i18n/contact-locales.spec.ts
# Attendu : 6/6 passent
```

Si flaky, debug :

```bash
pnpm exec playwright test e2e/i18n/contact-locales.spec.ts --debug
# Ouvre Playwright inspector
```

Commit :

```bash
git add apps/web/e2e/i18n/
git commit -m "I18N-1.6-e2e-contact-locales"
```

### T1.7 — Feature flag `I18N_ENABLED`

Créer le module :

```bash
mkdir -p apps/web/src/lib/feature-flags
touch apps/web/src/lib/feature-flags/i18n.ts
touch apps/web/src/lib/feature-flags/__tests__/i18n.test.ts
```

Implémenter selon `../08-plan-action/feature-flags.md` § Implementation TypeScript.

Tester en local :

```bash
# Toggle local
echo "I18N_ENABLED=false" >> apps/web/.env.local
pnpm -F web dev
# Vérifier : /contact ne redirige plus vers /fr/contact (routes legacy)

# Re-enable
sed -i.bak 's/I18N_ENABLED=false/I18N_ENABLED=true/' apps/web/.env.local
```

Mettre à jour `.env.example` :

```bash
# Ajouter dans apps/web/.env.example
cat >> apps/web/.env.example << 'EOF'
# i18n feature flags (voir docs/i18n-strategy-2026-05/08-plan-action/feature-flags.md)
I18N_ENABLED=true
I18N_LOCALES_ACTIVE=fr,ar,en
I18N_RTL_ENABLED=true
I18N_CMS_BINDINGS_ENABLED=true
EOF
```

Commit :

```bash
git add apps/web/src/lib/feature-flags/ apps/web/.env.example
git commit -m "I18N-1.7-feature-flag-i18n-enabled"
```

### T1.8 — Code review + PR + signoff

```bash
git push origin feat/i18n-foundation
gh pr create \
  --title "I18N Phase 1 — Foundation" \
  --body "$(cat <<'EOF'
## Phase 1 — Foundation i18n

Met en place next-intl + routing `/[locale]/` + page pilote `/contact` en FR, AR, EN.

### Changements
- next-intl v3.x installé
- Middleware locale-aware (exclut /admin, /api, /_next)
- Route `/contact` migrée sous `app/[locale]/contact/`
- LocaleSwitcher dans le header
- Feature flag `I18N_ENABLED` (rollback ≤ 5 min)
- 6 specs Playwright pour les 3 locales

### Test plan
- [ ] `pnpm -F web typecheck` vert
- [ ] `pnpm -F web build` vert
- [ ] `pnpm -F web test:unit` vert
- [ ] `pnpm -F web test:e2e -- --grep="@i18n"` vert
- [ ] Manuel : `/contact`, `/fr/contact`, `/en/contact`, `/ar/contact`
- [ ] Manuel : switcher fonctionne + cookie persiste
- [ ] Manuel : `I18N_ENABLED=false` retourne au legacy

### Hors scope
- AR encore en copie FR (sera traduit Phase 5)
- Pas de RTL (Phase 4)
- Pas de CMS multilang (Phase 3)

Refs : [phases.md § Phase 1](../docs/i18n-strategy-2026-05/08-plan-action/phases.md#phase-1--foundation-semaines-1-2)
EOF
)"
```

Demander review au lead. Démo fondatrice (5 min en visio).

### DoD Phase 1 — Checklist

- [ ] `pnpm -F web build` vert avec et sans `I18N_ENABLED`
- [ ] `/fr/contact` rend en FR
- [ ] `/en/contact` rend en EN
- [ ] `/ar/contact` rend (copie FR temporaire)
- [ ] `/contact` redirige 308 vers `/fr/contact`
- [ ] LocaleSwitcher persiste cookie + querystring
- [ ] 6 specs Playwright passent en CI
- [ ] PR mergée sur master
- [ ] Signoff lead + démo fondatrice

### Si fail

| Symptôme | Action |
|---|---|
| Middleware boucle infinie | Voir [`troubleshooting.md`](./troubleshooting.md) § Q3 |
| `IntlMessages` type non trouvé | Voir [`troubleshooting.md`](./troubleshooting.md) § Q5 |
| Cookie locale pas persisté | Vérifier `SameSite=Lax` dans config next-intl |
| Routes legacy 404 | Vérifier redirect 308 dans `middleware.ts` |

### Gate Phase 1 → Phase 2

- [ ] PR mergée
- [ ] CI verte sur master
- [ ] Démo fondatrice signée

---

## Phase 2 — Content extraction

**But** : externaliser ~700 strings hardcoded dans `messages/{fr,ar,en}.json`.

**Branche** : `feat/i18n-extraction`

### Setup branche

```bash
git checkout master
git pull origin master
git checkout -b feat/i18n-extraction
```

### T2.1 — Audit inventaire strings

```bash
cd <project-root>

# Lancer le scan initial
rg -t tsx -t ts -n --pcre2 '"[A-Z][a-zé][^"]{5,}\s+[a-zé][^"]*"' \
  apps/web/src/app apps/web/src/components \
  > /tmp/scan-fr-strings.txt

wc -l /tmp/scan-fr-strings.txt
# Attendu : ~600-1000 matches (faux positifs inclus)
```

Construire le CSV inventaire :

```bash
mkdir -p docs/i18n-strategy-2026-05/06-data-strategy
touch docs/i18n-strategy-2026-05/06-data-strategy/inventaire-strings.csv
```

En-tête du CSV :

```
file,line,string_fr,context,priority,key_proposed
```

Parcourir les ~1000 matches manuellement (~2 JH), classer P0/P1/P2 selon visibilité, dégager namespaces (`home`, `kit`, `rituel`, etc.).

Commit :

```bash
git add docs/i18n-strategy-2026-05/06-data-strategy/inventaire-strings.csv
git commit -m "I18N-2.1-inventaire-strings"
```

### T2.2 — Script AST d'extraction

```bash
mkdir -p apps/web/scripts/i18n
touch apps/web/scripts/i18n/extract.ts
touch apps/web/scripts/i18n/extract.test.ts
touch apps/web/scripts/i18n/README.md
```

Implémenter avec `ts-morph` ou `@babel/parser`. Test sur fixture :

```bash
cd apps/web
pnpm exec tsx scripts/i18n/extract.ts --route /contact --dry-run
# Attendu : montre les remplacements proposés sans rien modifier
```

Commit :

```bash
git add apps/web/scripts/i18n/
git commit -m "I18N-2.2-script-ast-extraction"
```

### T2.3 à T2.7 — Extraction route par route

Pour chaque route, suivre le même pattern. Exemple pour `/` :

```bash
# 1. Run script AST en dry-run
pnpm -F web exec tsx scripts/i18n/extract.ts --route / --dry-run

# 2. Review propositions, ajuster les keys
# (éditer manuellement le script ou les outputs)

# 3. Apply
pnpm -F web exec tsx scripts/i18n/extract.ts --route / --apply

# 4. Vérifier que les 3 locales rendent
pnpm -F web dev
# Tester /fr/, /en/, /ar/

# 5. Visual regression
pnpm -F web exec playwright test e2e/visual/home.spec.ts --update-snapshots
# Si delta > 0 pixel : investiguer (anormal pour cette phase)

# 6. Commit
git add apps/web/src/app/\[locale\]/page.tsx apps/web/messages/
git commit -m "I18N-2.3-extract-home"
```

Répéter pour `/maison` (T2.4), `/kit` (T2.5), `/rituel` (T2.6), `/journal` (T2.7).

🚨 **Pour `/kit`** : ne JAMAIS toucher au `WizardDictionary` (cf. ADR-007). Le wizard reste piloté par `apps/web/src/lib/wizard/dictionary/*`.

### T2.8 — Validation voix FR par fondatrice

```bash
# Exporter les messages FR pour relecture
cp apps/web/messages/fr.json /tmp/fr-review.json
# Envoyer en partage Drive ou ouvrir en visio

# Après corrections, ré-importer
cp /tmp/fr-review-corrected.json apps/web/messages/fr.json
git diff apps/web/messages/fr.json
git add apps/web/messages/fr.json
git commit -m "I18N-2.8-validation-voix-fr"
```

### T2.9 — ESLint rule custom

```bash
mkdir -p apps/web/eslint-rules
touch apps/web/eslint-rules/no-hardcoded-strings.js
touch apps/web/eslint-rules/no-hardcoded-strings.test.js
```

Implémenter. Activer en mode `warn` :

```bash
# Modifier apps/web/eslint.config.js
pnpm -F web lint
# Attendu : warnings sur strings hardcoded restantes (ok pour l'instant)
```

Commit :

```bash
git add apps/web/eslint-rules/ apps/web/eslint.config.js
git commit -m "I18N-2.9-eslint-rule-no-hardcoded"
```

### T2.10 — Traduction EN baseline

```bash
# Auto-traduction via DeepL API (script à créer)
pnpm -F web exec tsx scripts/i18n/auto-translate.ts \
  --source messages/fr.json \
  --target messages/en.json \
  --provider deepl

# Review humaine sur les CTAs (P0) avec translateur EN
# Workflow : voir 09-runbook/workflow-translateur.md
```

Commit :

```bash
git add apps/web/messages/en.json
git commit -m "I18N-2.10-traduction-en-baseline"
```

### PR Phase 2

```bash
git push origin feat/i18n-extraction
gh pr create \
  --title "I18N Phase 2 — Content extraction (~700 strings)" \
  --body "Externalisation des strings hardcoded sur 6 routes principales. Wizard CHA-231 préservé."
```

### DoD Phase 2 — Checklist

- [ ] ~700 strings externalisées dans `messages/{fr,ar,en}.json`
- [ ] 6 routes × 3 locales rendent OK
- [ ] Wizard CHA-231 inchangé (tests CHA-231 toujours verts)
- [ ] ESLint rule en mode warn active
- [ ] Fondatrice a validé `messages/fr.json`
- [ ] EN baseline en place
- [ ] AR en copie FR (traduction Phase 5)

### Gate Phase 2 → Phase 3

- [ ] PR mergée
- [ ] Visual regression LTR = 0 diff sur FR
- [ ] Test wizard CHA-231 toujours vert

---

## Phase 3 — CMS multilingue

**But** : étendre `component_field_bindings` + UI admin onglets + fallback FR.

**Branche** : `feat/i18n-cms-bindings`

### T3.1 — Repo `componentFieldBindings.getByLocale`

```bash
# Trouver le repo existant
find apps/web/src/lib/cms -name "*.ts" | xargs grep -l "componentFieldBindings"
```

Modifier `componentFieldBindingsRepo.ts` pour ajouter la méthode `getByLocale` (signature dans `phases.md` § T3.1).

Tester :

```bash
pnpm -F web test apps/web/src/lib/cms/repositories/componentFieldBindingsRepo.test.ts
```

### T3.2 — UI Admin onglets locale

Créer le composant `LocaleTabs.tsx` et l'intégrer dans la page admin CMS.

Tester en local :

```bash
pnpm -F web dev
# Ouvrir /admin/cms/components/<id>/edit
# Vérifier les onglets FR / AR / EN
```

### T3.3 — Migration data backfill

```bash
cd apps/web

# Créer la migration
pnpm db:generate
# Drizzle propose une migration ; éditer pour ajouter BACKFILL + INDEX

# Vérifier le SQL
cat drizzle/migrations/00XX-cms-locale-backfill.sql

# Tester en local
pnpm db:migrate

# Vérifier que toutes les rows ont locale='fr'
psql $DATABASE_URL -c "SELECT count(*), locale FROM component_field_bindings GROUP BY locale;"
# Attendu : tout en 'fr', 0 NULL
```

### T3.4 — Intégration frontend RSC

Créer le helper `loadCmsField(componentId, fieldKey, locale)` côté serveur, qui :
1. Lit le flag `I18N_CMS_BINDINGS_ENABLED`
2. Si actif : call `getByLocale({ locale, fallbackLocale: 'fr' })`
3. Si inactif : call `getByLocale({ locale: 'fr' })`

Tester :

```bash
# Mode dev : marquer visuellement les fallbacks
NEXT_PUBLIC_I18N_DEV_MARKERS=true pnpm -F web dev
# Sur /ar/maison, voir un badge "fallback FR" sur les sections non traduites
```

### T3.5 — Tests integration

```bash
touch apps/web/src/lib/cms/__tests__/multilang.test.ts
# Écrire 12 tests (4 scénarios × 3 locales)

pnpm -F web test apps/web/src/lib/cms/__tests__/multilang.test.ts
```

### PR + DoD Phase 3

```bash
git push origin feat/i18n-cms-bindings
gh pr create --title "I18N Phase 3 — CMS multilingue (admin onglets + fallback)"
```

- [ ] Repo `getByLocale` opérationnel
- [ ] UI admin onglets fonctionnelle
- [ ] Migration DB appliquée
- [ ] Frontend récupère bonne locale avec fallback FR
- [ ] 12+ tests CMS multilang verts
- [ ] Démo fondatrice : créer une section AR via admin

---

## Phase 4 — RTL + AR

**But** : `<html dir="rtl">` pour AR, refactor Tailwind logical, font Cairo.

**Branche** : `feat/i18n-rtl`

### T4.1 — Audit RTL

```bash
rg -t tsx -t ts -n '\b(m[lr]-|p[lr]-|text-(left|right)|border-[lr]|left-|right-)\b' \
  apps/web/src \
  > /tmp/audit-rtl.txt

wc -l /tmp/audit-rtl.txt
# Attendu : ~200-300 lignes
```

Construire `docs/i18n-strategy-2026-05/05-ui-ux-design/audit-rtl.csv` avec colonnes `file,line,class,replacement`.

### T4.2 — Refactor Tailwind logical properties

⚠️ **Pas de sed-replace aveugle**. Mappings :

| Direction-aware | Logical |
|---|---|
| `ml-X` | `ms-X` |
| `mr-X` | `me-X` |
| `pl-X` | `ps-X` |
| `pr-X` | `pe-X` |
| `text-left` | `text-start` |
| `text-right` | `text-end` |
| `border-l` | `border-s` |
| `border-r` | `border-e` |
| `left-X` | `start-X` |
| `right-X` | `end-X` |

Approche fichier par fichier avec review visuelle.

Après chaque batch :

```bash
pnpm -F web typecheck
pnpm -F web build
pnpm -F web exec playwright test e2e/visual/ --grep="@ltr"
# Attendu : 0 diff visuel LTR
```

### T4.3 — `<html dir>` dynamique

Modifier `apps/web/src/app/[locale]/layout.tsx` :

```typescript
import { i18nFlags } from '@/lib/feature-flags/i18n';

const dir = i18nFlags.isRtlEnabled() && locale === 'ar' ? 'rtl' : 'ltr';
```

Vérifier en local :

```bash
pnpm -F web dev
# Ouvrir /ar/contact en navigation privée
# Inspecter <html> dans devtools : doit avoir dir="rtl" lang="ar"
# Ouvrir /fr/contact : dir="ltr" lang="fr"
```

### T4.4 — Font Cairo

Modifier `apps/web/src/app/[locale]/layout.tsx` :

```typescript
import { Cairo } from 'next/font/google';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-latin' });
const cairo = Cairo({ subsets: ['arabic'], variable: '--font-arabic' });
```

Vérifier dans devtools Network qu'on charge Cairo SEULEMENT sur `/ar/*`.

### T4.5 — Tests visuels RTL

```bash
mkdir -p apps/web/e2e/visual/rtl
touch apps/web/e2e/visual/rtl/home.spec.ts
# (+ 5 autres routes)

pnpm -F web exec playwright test e2e/visual/rtl/ --update-snapshots
# Première run : crée baselines
# Re-run : vérifie 0 diff
```

### T4.6 — A11y RTL

```bash
mkdir -p apps/web/e2e/a11y
touch apps/web/e2e/a11y/rtl-home.spec.ts

pnpm -F web exec playwright test e2e/a11y/rtl-*.spec.ts
# Attendu : 0 violation critical/serious
```

### DoD Phase 4 — Checklist

- [ ] ~200 classes Tailwind refactorées logical
- [ ] `<html dir="rtl">` sur `/ar/*`
- [ ] Font Cairo chargée AR uniquement
- [ ] 6 visual snapshots RTL
- [ ] 0 régression LTR
- [ ] a11y RTL = 0 violation
- [ ] Wizard CHA-231 RTL-ready

---

## Phase 5 — Workflow translateur

**But** : workflow export/import + doc + 1er round traduction AR.

**Branche** : `feat/i18n-workflow`

### T5.1 — Scripts export / import

```bash
touch apps/web/scripts/i18n/export.ts
touch apps/web/scripts/i18n/import.ts

# Ajouter dans package.json scripts :
# "i18n:export": "tsx scripts/i18n/export.ts"
# "i18n:import": "tsx scripts/i18n/import.ts"

pnpm -F web i18n:export -- --source fr --target ar --format csv
# Attendu : crée /tmp/femiglow-i18n-fr-to-ar-{date}.csv
```

### T5.2 — Doc translateur + glossaire

Le runbook translateur est : [`workflow-translateur.md`](./workflow-translateur.md). À ce stade, vérifier qu'il est à jour et que le glossaire `06-data-strategy/glossaire-fr-ar.csv` existe.

```bash
# Tester l'onboarding avec le translateur
# 1. Lui envoyer workflow-translateur.md
# 2. Demander un retour "ok je sais quoi faire" sous 24h
# 3. Si questions, enrichir le doc
```

### T5.3 — Premier round traduction AR

```bash
# Exporter le CSV à envoyer au translateur
pnpm -F web i18n:export \
  --source fr --target ar \
  --priority P0,P1,P2 \
  --format csv \
  -o /tmp/femiglow-i18n-fr-to-ar-$(date +%Y%m%d).csv

# Vérifier ~700 lignes
wc -l /tmp/femiglow-i18n-fr-to-ar-*.csv
```

Email template au translateur (voir [`workflow-translateur.md`](./workflow-translateur.md) § Template kickoff).

Délai attendu : **5-7 jours ouvrés**. Pendant ce temps, le dev peut avancer sur Phase 4 polish.

### T5.4 — Import + intégration AR

À la réception du CSV traduit :

```bash
# Vérifier l'intégrité
pnpm -F web exec tsx scripts/i18n/validate.ts \
  --file /tmp/femiglow-i18n-fr-to-ar-{date}-COMPLETED.csv \
  --target ar

# Importer
pnpm -F web i18n:import \
  --file /tmp/femiglow-i18n-fr-to-ar-{date}-COMPLETED.csv \
  --target ar

# Vérifier le diff
git diff apps/web/messages/ar.json

# Tester
pnpm -F web dev
# Ouvrir /ar/contact, /ar/maison, etc. — toutes les strings doivent être en AR (pas FR)
```

### T5.5 — Validation native speaker

Booker 1h avec un native speaker AR-MA. Lui montrer le site en `/ar/*` et noter les retours dans `docs/i18n-strategy-2026-05/05-ui-ux-design/validation-ar-ma.md`.

Appliquer corrections si nécessaire.

### Commit Phase 5

```bash
git add apps/web/messages/ar.json apps/web/scripts/i18n/ docs/i18n-strategy-2026-05/
git commit -m "I18N-5-traduction-ar-validee"
git push origin feat/i18n-workflow

gh pr create --title "I18N Phase 5 — Workflow translateur + traduction AR complète"
```

---

## Phase 6 — Tests denses

**But** : ~250 tests verts (unit + integration + e2e + visual + a11y).

**Branche** : `feat/i18n-tests`

### T6.1 — Pyramide unit

Compléter tests pour `apps/web/src/i18n/*` et `apps/web/src/components/i18n/*`.

```bash
pnpm -F web test:unit --coverage
# Attendu coverage : i18n/ ≥ 90%, components/i18n/ ≥ 85%
```

### T6.2 — Pyramide integration

Tests sur `apps/web/src/lib/cms/*` (méthodes locale), `apps/web/src/lib/legal/*` (si applicable).

### T6.3 — E2E exhaustif 3 locales

```bash
# Configurer matrice Playwright
# apps/web/playwright.config.ts : ajouter projects pour chaque locale

pnpm -F web exec playwright test e2e/i18n/
# Attendu : 50+ specs × 3 locales = 150+ runs verts
```

### T6.4 — Visual regression 3 locales

```bash
pnpm -F web exec playwright test e2e/visual/i18n/ --update-snapshots
# Première run : crée baselines (36 snapshots)
git add apps/web/e2e/visual/i18n/__snapshots__/
git commit -m "I18N-6.4-visual-baselines"
```

### T6.5 — A11y scans

```bash
pnpm -F web exec playwright test e2e/a11y/i18n-*.spec.ts
# Attendu : 0 violation critical/serious sur 18 scans (6 routes × 3 locales)
```

### T6.6 — Lighthouse CI

```bash
touch apps/web/lighthouserc.json
# Configurer assertions
# pnpm -F web exec lhci autorun
```

### T6.7 — Coverage gates

Modifier `apps/web/vitest.config.ts` :

```typescript
coverage: {
  thresholds: {
    'src/i18n/**': { lines: 90, functions: 90, branches: 85 },
    'src/components/i18n/**': { lines: 85, functions: 85, branches: 80 },
  }
}
```

### T6.8 — ESLint rule → error

```bash
# Modifier apps/web/eslint.config.js
# "femiglow-i18n/no-hardcoded-strings": "error"

pnpm -F web lint
# Attendu : 0 erreur (sinon il reste des strings hardcoded à traiter)
```

### T6.9 — Boucle correction-test

Voir [`../11-test-execution/boucle-correction.md`](../11-test-execution/) pour la procédure complète.

Itérer jusqu'à : **0 test rouge, 0 flaky** (3 runs consécutifs verts en CI).

### Commit Phase 6

```bash
git push origin feat/i18n-tests
gh pr create --title "I18N Phase 6 — Tests denses (~250 tests verts)"
```

---

## Phase 7 — Deploy + observabilité

**But** : canary 10% → 50% → 100% en prod avec monitoring.

**Branche** : `feat/i18n-deploy`

Voir [`deploiement.md`](./deploiement.md) pour la procédure détaillée. Ici, résumé exécution :

### T7.1 — Vercel env vars

```bash
vercel env add I18N_ENABLED production
# entrer : false (sera flippé à true après canary 100%)

vercel env add I18N_LOCALES_ACTIVE production
# entrer : fr,ar,en

vercel env add I18N_RTL_ENABLED production
# entrer : true

vercel env add I18N_CMS_BINDINGS_ENABLED production
# entrer : false (sera true après phase 3 deploy validé)
```

### T7.2 — Snapshot DB

```bash
# Via Neon CLI
neon snapshot create --branch main --name "pre-i18n-deploy-$(date +%Y%m%d)"

# Vérifier
neon snapshot list --branch main
```

### T7.3 → T7.5 — Canary 10% → 50% → 100%

Voir [`deploiement.md`](./deploiement.md) § Procédure canary.

### T7.6 — Sentry tags

Modifier `apps/web/src/lib/observability/sentry.ts` pour tagger `locale` sur chaque error.

```bash
# Provoquer une erreur de test
curl -s 'https://femiglow.ma/ar/contact?force_error=1'
# Vérifier dans Sentry que le tag locale=ar apparaît
```

### T7.7 — Analytics locale tracking

Ajouter dimension custom `locale` dans GA4/Plausible. Créer un dashboard "Locale distribution".

### T7.8 — Test rollback

```bash
# Sur staging
vercel env rm I18N_ENABLED staging
vercel env add I18N_ENABLED staging
# entrer : false
vercel --target staging

# Chrono : temps entre `vercel --target` et page legacy visible
# Attendu : ≤ 5 min
```

### DoD Phase 7 — Checklist

- [ ] i18n actif 100% prod
- [ ] 0 incident critique pendant canary
- [ ] Sentry tagué locale
- [ ] Analytics tracke locale
- [ ] Rollback testé chronométré ≤ 5 min

---

## Phase 8 — Stabilisation

**But** : bug bash + a11y + perf + doc finale + post-mortem.

### T8.1 — Bug bash

Booker 2h avec toute l'équipe + fondatrice :

1. Chaque personne ouvre une locale différente (FR / AR / EN)
2. Navigue librement le site pendant 30 min
3. Note tout ce qui choque (typo, layout, navigation, format)
4. Compile la liste finale dans `docs/i18n-strategy-2026-05/11-test-execution/bug-bash-rapport.md`
5. Triage : P0 (24h), P1 (72h), P2 (backlog)

### T8.2 — A11y approfondi

```bash
# Audit manuel WCAG 2.1 AA
pnpm -F web exec playwright test e2e/a11y/ --reporter=html
# Open report, analyser violations

# Test screen reader (manuel)
# NVDA sur Windows pour FR/EN
# VoiceOver macOS pour AR (besoin Mac dispo)
```

### T8.3 — Perf approfondi

```bash
# Lighthouse CI sur 3 locales
pnpm -F web exec lhci autorun --collect.url=https://femiglow.ma/fr/
pnpm -F web exec lhci autorun --collect.url=https://femiglow.ma/en/
pnpm -F web exec lhci autorun --collect.url=https://femiglow.ma/ar/

# Mesurer bundle size delta
# Avant : `du -sh apps/web/.next/static/chunks/`
# Après : idem
# Attendu delta < +15%
```

### T8.4 — Documentation finale

Ré-relire les 7 fichiers du runbook + ajuster avec retours terrain Phase 1-7.

### T8.5 — Post-mortem

Créer `docs/i18n-strategy-2026-05/00-context/post-mortem.md` selon template dans `08-plan-action/rollback.md`.

### DoD Phase 8 — Checklist

- [ ] Bug bash exécuté, P0/P1 fixés
- [ ] WCAG ≥ 95%
- [ ] Perf budgets respectés (LCP < 2.5s, CLS < 0.1, bundle +15% max)
- [ ] Doc finale validée par dev externe
- [ ] Post-mortem partagé en équipe

---

## Gates entre phases

Récapitulatif des conditions Go/No-Go (voir aussi `phases.md` § Conditions de Go / No-Go).

Un seul critère rouge = STOP, on ne passe pas.

### Phase 0 → 1

- [ ] 8 ADRs mergés
- [ ] CR décision signé
- [ ] Branche `feat/i18n-foundation` créée

### Phase 1 → 2

- [ ] `/contact` × 3 locales OK
- [ ] 6 specs E2E baseline verts
- [ ] Feature flag testé local
- [ ] PR mergée

### Phase 2 → 3

- [ ] 6 routes × 3 locales OK
- [ ] ESLint rule mode warn min
- [ ] `messages/fr.json` validé fondatrice
- [ ] 0 régression visuelle FR

### Phase 3 → 4

- [ ] UI admin onglets OK
- [ ] Migration DB staging
- [ ] Démo fondatrice OK
- [ ] 12 tests CMS verts

### Phase 4 → 5

- [ ] Refactor logical sans régression LTR
- [ ] `<html dir>` correct
- [ ] Visual regression LTR = 0 diff
- [ ] Baselines RTL créées
- [ ] a11y RTL = 0 violation critique

### Phase 5 → 6

- [ ] `messages/ar.json` 100% complet
- [ ] Validation native speaker AR-MA
- [ ] Workflow export/import testé roundtrip

### Phase 6 → 7

- [ ] ~250 tests verts, 0 flaky
- [ ] Coverage gates respectés
- [ ] Lighthouse CI vert × 3 locales
- [ ] ESLint rule en error
- [ ] Rapport boucle correction signé

### Phase 7 → 8

- [ ] Canary 100% sans incident 72h
- [ ] Sentry tagué locale
- [ ] Rollback testé chronométré ≤ 5 min
- [ ] Conversion stable (±5%)

### Phase 8 → Fin projet

- [ ] Bug bash exécuté
- [ ] WCAG ≥ 95%
- [ ] Perf budgets OK
- [ ] Doc finale OK
- [ ] Post-mortem partagé

---

## Erreurs courantes

### Erreur 1 — Casser le routing legacy avant Phase 1 complète

**Symptôme** : `/contact` retourne 404 alors qu'on n'a pas encore migré toutes les routes.

**Cause** : middleware trop agressif qui force `[locale]` partout.

**Fix** : dans `middleware.ts`, garder un fallback redirect 308 `<route>` → `/fr/<route>` pour les routes pas encore migrées.

```typescript
// middleware.ts (extrait)
const LEGACY_ROUTES_TO_REDIRECT = ['/contact', '/kit', '/rituel']; // mise à jour Phase 2

if (LEGACY_ROUTES_TO_REDIRECT.includes(pathname)) {
  return NextResponse.redirect(new URL(`/fr${pathname}`, req.url), 308);
}
```

### Erreur 2 — Touche au WizardDictionary par erreur

**Symptôme** : tests CHA-231 wizard cassés.

**Cause** : refactor automatique qui a remplacé `dictionary.lead.title` par `t('wizard.lead.title')`.

**Fix** : reverter immédiatement les fichiers `apps/web/src/lib/wizard/dictionary/*` et `apps/web/src/components/wizard/**`. ADR-007 interdit cette modification.

```bash
git checkout master -- apps/web/src/lib/wizard/
git checkout master -- apps/web/src/components/wizard/
```

### Erreur 3 — Build fail "Cannot find module 'next-intl/middleware'"

**Symptôme** : `pnpm build` fail avec import next-intl.

**Cause** : version next-intl trop ancienne (< 3.x) ou conflit avec Next.js.

**Fix** :

```bash
pnpm -F web list next next-intl
# Vérifier next ≥ 14 et next-intl ≥ 3.x
pnpm -F web add next-intl@latest
pnpm -F web build
```

### Erreur 4 — Migration DB échoue en staging

**Symptôme** : `pnpm db:migrate` retourne erreur sur staging.

**Cause** : migration phase 3 mal écrite (ex: DROP COLUMN au lieu de backfill).

**Fix** : reverter la migration, refaire en additive only.

```bash
pnpm drizzle-kit drop --config drizzle.config.ts
# Réécrire la migration
pnpm db:generate
pnpm db:migrate
```

### Erreur 5 — Tests E2E flaky en CI

**Symptôme** : tests passent en local, échouent 30% du temps en CI.

**Cause** : timing race (ex: assert avant que `useTranslations` n'ait hydraté côté client).

**Fix** :

```typescript
// Avant
await page.click('button[data-testid="switch-ar"]');
await expect(page.locator('h1')).toHaveText(/مرحبا/);

// Après — attendre que l'hydratation soit faite
await page.click('button[data-testid="switch-ar"]');
await page.waitForURL(/\/ar\//);
await page.waitForLoadState('networkidle');
await expect(page.locator('h1')).toHaveText(/مرحبا/);
```

### Erreur 6 — Cookie `NEXT_LOCALE` pas posé

**Symptôme** : switcher change l'URL mais pas la persistance après refresh.

**Cause** : config `localeDetection` désactivée dans next-intl OU SameSite restrictif.

**Fix** : vérifier `apps/web/src/i18n/routing.ts` :

```typescript
export const routing = defineRouting({
  locales: ['fr', 'ar', 'en'],
  defaultLocale: 'fr',
  localePrefix: 'always',
  localeDetection: true,
  // cookie config
});
```

### Erreur 7 — Font Cairo charge sur toutes les locales

**Symptôme** : devtools Network montre Cairo sur `/fr/*` aussi.

**Cause** : import top-level dans `layout.tsx` sans conditional.

**Fix** : utiliser conditional dans `metadata` ou `<head>` :

```typescript
// apps/web/src/app/[locale]/layout.tsx
const fontClass = locale === 'ar' ? cairo.variable : inter.variable;
return <html className={fontClass}>...</html>;
```

Pour vraiment décharger sur FR/EN, faire un layout séparé par groupe :

```
app/
  [locale]/
    (latin)/    # routes FR + EN
      layout.tsx (Inter only)
    (arabic)/   # routes AR
      layout.tsx (Cairo only)
```

### Erreur 8 — `IntlMessages` type non augmenté

**Symptôme** : `t('home.title')` renvoie `unknown` au lieu de string.

**Cause** : `apps/web/src/i18n/messages.d.ts` pas dans `tsconfig include`.

**Fix** : vérifier `apps/web/tsconfig.json` :

```json
{
  "include": ["src/**/*", "messages/**/*.json"]
}
```

### Erreur 9 — Visual regression diff systématique

**Symptôme** : `playwright test --update-snapshots` change les baselines à chaque run.

**Cause** : éléments dynamiques (date, prix, animations) pas masqués.

**Fix** :

```typescript
await expect(page).toHaveScreenshot('home.png', {
  mask: [
    page.locator('[data-testid="current-date"]'),
    page.locator('[data-testid="dynamic-price"]'),
  ],
  animations: 'disabled',
});
```

### Erreur 10 — Bundle size explose

**Symptôme** : Lighthouse CI échoue sur "Total bundle size".

**Cause** : `messages/*.json` importés tous d'un coup (pas lazy par route).

**Fix** : utiliser `getRequestConfig` next-intl avec import dynamique par namespace :

```typescript
// apps/web/src/i18n/request.ts
export default getRequestConfig(async ({ locale }) => {
  const messages = (await import(`../../messages/${locale}.json`)).default;
  return { messages };
});
```

---

## Annexe — Convention commits

| Préfixe | Usage |
|---|---|
| `I18N-0.X-{desc}` | Phase 0 (étude) |
| `I18N-1.X-{desc}` | Phase 1 (foundation) |
| `I18N-2.X-{desc}` | Phase 2 (extraction) |
| `I18N-3.X-{desc}` | Phase 3 (CMS) |
| `I18N-4.X-{desc}` | Phase 4 (RTL) |
| `I18N-5.X-{desc}` | Phase 5 (workflow) |
| `I18N-6.X-{desc}` | Phase 6 (tests) |
| `I18N-7.X-{desc}` | Phase 7 (deploy) |
| `I18N-8.X-{desc}` | Phase 8 (stabilisation) |
| `docs(i18n): ...` | Docs only |
| `fix(i18n): ...` | Bug fix post-V1 |

Exemple : `I18N-2.3-extract-home`, `I18N-4.4-font-cairo`, `fix(i18n): persist locale on admin login`.

---

## Annexe — Templates messages Slack

### Démarrage de phase

```
[I18N] Démarrage Phase X — {nom}
Branche : feat/i18n-{nom}
Durée estimée : {Y} semaines
Owner : @{nom}
Lien plan : docs/i18n-strategy-2026-05/08-plan-action/phases.md#phase-X
```

### Fin de phase + demande review

```
[I18N] Phase X terminée — PR ouverte
PR : <lien>
DoD : tous critères verts (voir checklist phase X)
Demande : review @lead + démo fondatrice (15 min)
Gate Phase X → X+1 : à valider avant lundi
```

### Incident pendant exécution

```
[I18N] Bloqueur — Phase X tâche TX.Y
Symptôme : {description}
Tentatives : {ce que j'ai essayé}
Question : {ce dont j'ai besoin}
Impact planning : retard estimé {N} jours
```

---

## Liens utiles

- [`../08-plan-action/phases.md`](../08-plan-action/phases.md) — Plan détaillé
- [`../08-plan-action/feature-flags.md`](../08-plan-action/feature-flags.md) — Feature flags
- [`../08-plan-action/rollback.md`](../08-plan-action/rollback.md) — Rollback
- [`troubleshooting.md`](./troubleshooting.md) — FAQ erreurs
- [`deploiement.md`](./deploiement.md) — Déploiement détaillé
- [`workflow-translateur.md`](./workflow-translateur.md) — Workflow translateur

---

**Auteur** : Claude — 27 mai 2026
**Version** : 1.0
**À mettre à jour** : après chaque phase terminée, avec retours terrain.
