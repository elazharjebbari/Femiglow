# Étude stratégique — Internationalisation (i18n) FemiGlow

> **Mission** : étudier toutes les options techniques et UX pour traduire dynamiquement le site FemiGlow dans **autant de langues que souhaité**, de manière **ergonomique, robuste, fiable, optimale, modulaire et non-régressive**.
>
> **Périmètre** : pages marketing publiques (/, /maison, /kit, /rituel, /journal, /contact), pages légales (/legal/*), tunnel checkout (wizard), console admin, emails transactionnels, JSON-LD/SEO, contenu CMS dynamique.
>
> **Statut** : ⚠️ **ÉTUDE** — pas d'implémentation à ce stade. Le livrable est ce dossier d'analyse. Une fois validé par la fondatrice, on créera un dossier `docs/i18n-implementation-YYYY-MM/` avec le plan d'exécution.

## Audience cible

- **Fondatrice** : décision GO/NO-GO + choix langues prioritaires (DA-CR-AR-EN ?)
- **Lead technique** : choix de stack i18n et architecture
- **Dev** : référence d'implémentation
- **Traducteur** : workflow d'ajout/édition de contenu
- **QA** : matrice de tests + checklists

## Sommaire des 12 sous-dossiers

| # | Dossier | Aspect | Formats | Lecture |
|---|---|---|---|---|
| 0 | [`00-context/`](./00-context/) | Audit existant + besoins + glossaire + ADR + contraintes | md, csv | 25 min |
| 1 | [`01-options-techniques/`](./01-options-techniques/) | Comparatif libraries + matrices décisionnelles + benchmarks | md, csv, puml | 40 min |
| 2 | [`02-design-conception/`](./02-design-conception/) | Architecture cible + data model + URL strategy + flow diagrams | md, puml, json | 30 min |
| 3 | [`03-backend/`](./03-backend/) | Translation store + API routes + SSR + SEO + content CMS | md, sql, yaml | 35 min |
| 4 | [`04-frontend/`](./04-frontend/) | Components + keys + switcher + pluralization + formatting | md, tsx | 35 min |
| 5 | [`05-ui-ux-design/`](./05-ui-ux-design/) | Locale switcher + RTL + typography + images + wizard | md, csv, png-mockup | 30 min |
| 6 | [`06-data-strategy/`](./06-data-strategy/) | Translation tables + seed + workflow TMS + extraction strings | md, sql, csv, yaml | 30 min |
| 7 | [`07-tests/`](./07-tests/) | Vitest + MSW + Playwright + a11y + visual + coverage | md, csv | 35 min |
| 8 | [`08-plan-action/`](./08-plan-action/) | Phases T0→TN + checklist + rollback + feature flags + risk | md, csv, puml | 25 min |
| 9 | [`09-runbook/`](./09-runbook/) | Exécution + ajout langue + workflow translateur + troubleshooting | md, txt | 30 min |
| 10 | [`10-monitoring/`](./10-monitoring/) | KPIs + dashboards + alerts + locale analytics | md, yaml, csv | 15 min |
| 11 | [`11-test-execution/`](./11-test-execution/) | **Batterie de tests dense** + boucle correction + runbook tests | md, csv, yaml | 30 min |

**Total lecture** : ~6h pour absorber l'étude complète. Si lecture rapide : 1h pour les README de chaque sous-dossier + ADRs.

## Tableau de bord rapide

### Le problème en 4 phrases

1. FemiGlow opère au Maroc (FR + AR/Darija marché principal) et veut s'ouvrir à d'autres marchés (EN tier-1, ES, IT…)
2. Le site actuel est **100% FR hardcoded** sauf le wizard checkout (FR + AR existants mais inactifs côté UI)
3. Ajouter une langue aujourd'hui = duplication massive du code + risque divergence editorial
4. Besoin d'un système où **ajouter une langue = remplir un dictionnaire** (sans toucher au code), avec **support RTL** pour AR/HE et **content CMS traduit**

### Les 5 verrous techniques à débloquer

| # | Verrou | Sévérité | Solution candidate |
|---|---|---|---|
| **V1** | Strings hardcoded partout dans le code TSX | 🔴 Critique | Extraction systématique vers messages JSON + ESLint rule |
| **V2** | Pas de routing locale-aware (`/fr/kit`, `/ar/kit`) | 🔴 Critique | Next.js App Router middleware + i18n routing |
| **V3** | CMS components (`component_field_bindings.value`) pas multilingue | 🔴 Critique | Champ `locale` déjà existe, étendre repo + UI admin pour saisir par langue |
| **V4** | RTL non supporté (arabe) | 🟠 Haute | `dir="rtl"` global + audit Tailwind logical properties |
| **V5** | Pages légales 100% en FR via `body_md` | 🟡 Moyenne | Variante par locale dans `legal_pages.locale` (champ existe déjà) |

### Les 4 options techniques candidates

| Option | Pros | Cons | Compatible Next 14 App Router |
|---|---|---|---|
| **A — `next-intl`** | RSC-first, type-safe, routing intégré, mature | Dictionnaire JSON séparé du code | ✅ Top choix App Router |
| **B — `next-i18next`** | Standard historique, écosystème vaste | Pages Router-first, fork pour App Router | ⚠️ Pas idéal pour App Router |
| **C — `paraglide-js`** | Bundle léger, type-safe, message-format ICU | Moins mature, doc en évolution | ✅ Si on veut bleeding edge |
| **D — Maison (extension de WizardDictionary)** | 0 dépendance, contrôle total | À maintenir, recoder routing + RSC plug | 🤝 Possible (incrémental sur CHA-231) |

→ Cf. [`01-options-techniques/comparaison-libraries.md`](./01-options-techniques/comparaison-libraries.md) pour analyse détaillée.

## Recommandation préliminaire

**Choix recommandé** : **Option A — `next-intl`** + extension de l'architecture `WizardDictionary` existante (Option D) pour le wizard (déjà fait, ne pas régresser).

**Justification courte** :
- ✅ Compatible RSC natif Next 14 (App Router de FemiGlow)
- ✅ Middleware locale routing prêt à l'emploi
- ✅ Mature et bien maintenu
- ✅ Migration progressive possible (par route)
- ✅ Type-safe via codegen (cohérent avec philosophie projet)

Le wizard reste sur **`WizardDictionary`** existant — pas de régression, contrats type-safe préservés.

## Effort estimé global

| Phase | Durée | Description |
|---|---|---|
| Phase 0 — Étude validée | 1 sem | Ce dossier + décisions ADR |
| Phase 1 — Foundation | 2 sem | next-intl + middleware + routing + 1 langue active (EN) |
| Phase 2 — Content extraction | 2 sem | Extraire 100% strings TSX/MD → messages JSON |
| Phase 3 — CMS multilingue | 1 sem | UI admin saisie par locale + repo update |
| Phase 4 — RTL + AR | 1 sem | Activation AR avec RTL complet |
| Phase 5 — Workflow translateur | 1 sem | Crowdin/Lokalise ou similaire |
| Phase 6 — Tests denses + QA | 2 sem | Pyramide complète + boucle fix-test |
| Phase 7 — Deploy + obs | 1 sem | Ship + monitoring 30 jours |
| **Total** | **~11 semaines** | (~2.5 mois d'effort intermittent) |

## Liens rapides

- 📊 **État actuel du projet** : [`00-context/etat-actuel.md`](./00-context/etat-actuel.md)
- 🔬 **Comparaison libraries** : [`01-options-techniques/comparaison-libraries.md`](./01-options-techniques/comparaison-libraries.md)
- 🏗 **Architecture cible** : [`02-design-conception/architecture-cible.puml`](./02-design-conception/architecture-cible.puml)
- 📋 **Plan d'action complet** : [`08-plan-action/phases.md`](./08-plan-action/phases.md)
- 🛠 **Runbook ajout langue** : [`09-runbook/ajouter-nouvelle-langue.md`](./09-runbook/ajouter-nouvelle-langue.md)
- ✅ **Batterie de tests** : [`11-test-execution/plan-batterie-tests.md`](./11-test-execution/plan-batterie-tests.md)

## Conventions du dossier

- **Code blocks** : TypeScript / SQL / YAML / shell / TSX directement copiables (pas de pseudo-code).
- **Diagrammes** : PlantUML (`.puml`) — éditables sans IDE spécifique. Rendu via https://www.plantuml.com/plantuml/.
- **Matrices** : CSV (lisible Git + Excel). Notamment décisionnelles et test plans.
- **Schémas data** : JSON Schema + SQL DDL.
- **Configs** : YAML pour orchestration / GitHub Actions / Vercel.
- **Naming** : `I18N-XX-DESC` pour commits / branches (cohérent avec autres sprints).
- **Branche suggérée** : `feat/i18n-foundation` (à créer une fois étude validée).

## Statut de l'étude

| Section | Statut | Auteur |
|---|---|---|
| 00 — Context | ⏳ Draft | Claude |
| 01 — Options | ⏳ Draft | Claude |
| 02 — Design | ⏳ Draft | Claude |
| 03 — Backend | ⏳ Draft | Claude |
| 04 — Frontend | ⏳ Draft | Claude |
| 05 — UI/UX | ⏳ Draft | Claude |
| 06 — Data | ⏳ Draft | Claude |
| 07 — Tests | ⏳ Draft | Claude |
| 08 — Plan action | ⏳ Draft | Claude |
| 09 — Runbook | ⏳ Draft | Claude |
| 10 — Monitoring | ⏳ Draft | Claude |
| 11 — Test exec | ⏳ Draft | Claude |

→ Une fois validée par la fondatrice et le lead technique, basculer en `Validé` et démarrer la phase 1 du plan d'action.
