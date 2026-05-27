# Plan d'action détaillé — Internationalisation FemiGlow

> Plan d'exécution pas-à-pas sur **11 semaines** (Phase 0 → Phase 8) pour faire passer FemiGlow d'un site 100% FR hardcoded à une plateforme multilingue robuste (FR + AR + EN) avec routing path-based, RTL, CMS dynamique, workflow translateur et observabilité.
>
> **Document parent** : [`README.md`](./README.md) (TL;DR et index)
> **Documents associés** :
> - [`checklist.md`](./checklist.md) — Checklists exhaustives par phase
> - [`rollback.md`](./rollback.md) — Procédures rollback
> - [`feature-flags.md`](./feature-flags.md) — Stratégie feature flags
> - [`gantt.puml`](./gantt.puml) — Gantt des 11 semaines
> - [`risk-matrix.csv`](./risk-matrix.csv) — Matrice de risques
>
> **Statut** : Draft — à valider par fondatrice + lead technique avant kickoff Phase 1.

> **Mise à jour 2026-05-27** : la **préparation du contenu (hors-sprint)** est désormais achevée et disponible dans [`docs/i18n-content-2026-05/`](../../i18n-content-2026-05/). Cela réduit significativement la charge de la **Phase 2 (Content extraction)** : l'audit code est déjà fait (766 strings inventoriées), les traductions FR/AR/EN canoniques sont produites (790 keys par locale), les seeds CSV/MD/JSON sont prêts à brancher, et un script de validation `validate-seeds.py` confirme le verdict `GO pour ingestion`. Voir détails ci-dessous au §"Statut courant".

---

## Statut courant — Préparation hors-sprint achevée (2026-05-27)

### Ce qui est déjà fait (hors planning ci-dessous)

Un dossier compagnon **[`docs/i18n-content-2026-05/`](../../i18n-content-2026-05/)** a été produit en amont du sprint i18n. Il contient les livrables de contenu prêts à brancher :

| Livrable | État | Détails |
|---|---|---|
| Style reference (voix FemiGlow + Kolenda) | ✅ | `00-style-reference.md` — référence unique pour la voix dans les 3 langues |
| Audit code RÉEL des strings | ✅ | `01-audit/inventory-complete.csv` — 766 strings auditées (vs 148 estimées initialement) |
| Traductions FR canonical | ✅ | `02-translations/messages-fr.json` — 790 keys (voix FemiGlow stricte, 0 emoji, 0 « ! » marketing) |
| Traductions AR (MSA féminin) | ✅ | `02-translations/messages-ar.json` — 790 keys (45 impératifs féminins, RTL prêt) |
| Traductions EN (international sobre) | ✅ | `02-translations/messages-en.json` — 790 keys |
| Component bindings CSV (DB seeds) | ✅ | `03-seed-data/component-bindings-{fr,ar,en}.csv` — 510 rows × 3 locales, parité exacte |
| Pages légales (markdown DB seeds) | ✅ | `03-seed-data/legal-pages-{fr,ar,en}/` — 9 slugs × 3 locales = 27 .md (~1500 lignes/locale) |
| Mock data articles (15 articles × 3) | ✅ | `03-seed-data/mock-data-{fr,ar,en}.json` — parité trilingue 15/15 |
| Quality checks | ✅ | `04-quality/` : glossary-applied.csv (35 termes) + conversion-leverage-checklist (30/36 OK Kolenda) + review-notes.md |
| Script de validation Go/No-Go | ✅ | `scripts/validate-seeds.py` — 6 checks, verdict actuel `GO pour ingestion` |

### Impact sur le planning ci-dessous

| Phase | Impact préparation hors-sprint |
|---|---|
| **Phase 0 — Étude validée + ADRs** | Inchangé. Doit toujours être faite (relecture + ADRs). |
| **Phase 1 — Foundation** | Inchangé. Setup next-intl + middleware + routing — le contenu est prêt mais le code applicatif reste à monter. |
| **Phase 2 — Content extraction** | **Réduit de ~50%** : l'audit + l'extraction sont déjà faits. Reste : copier `messages-{fr,ar,en}.json` vers `apps/web/messages/` + écrire scripts de seed DB. |
| **Phase 3 — CMS multilingue** | **Réduit de ~30%** : les `component_field_bindings` seeds sont déjà produits — reste l'UI admin et le repo. |
| **Phase 4 — RTL + AR** | Inchangé côté CSS/Tailwind. AR copy déjà revu pour adresse féminine. |
| **Phase 5 — Workflow translateur** | Inchangé. Le dossier sert de référence/baseline pour les futurs translateurs. |
| **Phase 6 — Tests denses** | Inchangé. Pyramide tests à monter. |

### Points en attente d'arbitrage fondatrice (bloquants avant ingestion)

(Loggés dans [`docs/i18n-content-2026-05/04-quality/review-notes.md`](../../i18n-content-2026-05/04-quality/review-notes.md))

1. **Faits factuels expansés** dans 14 bodies articles AR/EN/FR (« 6 ans », « formule n° 287 », « cooperative Tiznit », etc.) — à valider/corriger
2. **Numéro d'urgence** « 15 » (FR) dans `securite-produits.md` → adapter Maroc
3. **10 placeholders légaux** (`[adresse]`, `[ICE]`, `[RC]`, `[email]`, `[téléphone]`) à remplir avant publication
4. **Drifts identifiés** : Casablanca/Rabat, gestes 3/4/5, founder name, volumes paste/powder, typo « Hémisphage »

### Comment intégrer la préparation hors-sprint au sprint

**Au kick-off Phase 1** : un check ~30 min pour `python3 docs/i18n-content-2026-05/scripts/validate-seeds.py` doit retourner `0` (GO). Si arbitrage founder fait, re-run le script avant Phase 2.

**Pendant Phase 2** : copier les messages-*.json depuis `docs/i18n-content-2026-05/02-translations/` vers `apps/web/messages/[locale].json` (un script `pnpm i18n:ingest-content` fait ça, à écrire dans T2.X).

**Pendant Phase 3** : utiliser les CSV `component-bindings-*.csv` comme source pour le script de seed CMS (à écrire dans T3.X).

---

## Sommaire

- [Conventions du plan](#conventions-du-plan)
- [Phase 0 — Étude validée + ADRs (semaine 0)](#phase-0--étude-validée--adrs-semaine-0)
- [Phase 1 — Foundation (semaines 1-2)](#phase-1--foundation-semaines-1-2)
- [Phase 2 — Content extraction (semaines 3-4)](#phase-2--content-extraction-semaines-3-4)
- [Phase 3 — CMS multilingue (semaine 5)](#phase-3--cms-multilingue-semaine-5)
- [Phase 4 — RTL + AR (semaine 6)](#phase-4--rtl--ar-semaine-6)
- [Phase 5 — Workflow translateur (semaine 7)](#phase-5--workflow-translateur-semaine-7)
- [Phase 6 — Tests denses (semaines 8-9)](#phase-6--tests-denses-semaines-8-9)
- [Phase 7 — Deploy + observabilité (semaine 10)](#phase-7--deploy--observabilité-semaine-10)
- [Phase 8 — Stabilisation (semaine 11)](#phase-8--stabilisation-semaine-11)
- [Tableau récapitulatif de toutes les tâches](#tableau-récapitulatif-de-toutes-les-tâches)
- [Pièges transverses à éviter](#pièges-transverses-à-éviter)
- [Conditions de Go / No-Go entre phases](#conditions-de-go--no-go-entre-phases)

---

## Conventions du plan

### Notation des tâches

Chaque tâche est notée `T<phase>.<n>` (ex : `T1.3` = phase 1, tâche 3) et comporte :

| Champ | Description |
|---|---|
| **Objectif** | Résultat business / technique attendu |
| **DoD (Definition of Done)** | Critères vérifiables (sans ambiguïté) qui closent la tâche |
| **Durée estimée** | Jours-homme (JH), inclut codage + tests + review |
| **Dépendances** | Tâches qui doivent être terminées avant (par ID) |
| **Livrables** | Fichiers / artefacts concrets produits |
| **Tests requis** | Type de tests à ajouter (unit / integration / e2e / visual / a11y / manual) |
| **Fichiers touchés** | Chemins concrets dans `apps/web/` ou `docs/` |
| **Anti-patterns** | Pièges spécifiques à la tâche |

### Ressources mobilisables

| Rôle | Allocation | Responsabilités |
|---|---|---|
| **Fondatrice** | ~10% (validation, voix éditoriale) | Décisions GO/NO-GO, validation voix FR/AR, signoff phases |
| **Lead technique** | ~60% pic phases 1-2-3 | Architecture, code review, ADRs, ESLint rule |
| **Dev** | 100% sur la durée | Implémentation, tests, refactors |
| **Translateur AR** | ~40% phase 5 | Traduction AR pages marketing, validation glossaire |
| **Translateur EN** | ~20% phases 1-2 | Traduction EN, validation tonalité |
| **QA** | ~80% phases 6-7-8 | Tests E2E, visual regression, a11y, smoke prod |

### Branches Git

Convention proposée :
- `feat/i18n-foundation` — phase 1
- `feat/i18n-extraction` — phase 2
- `feat/i18n-cms-bindings` — phase 3
- `feat/i18n-rtl` — phase 4
- `feat/i18n-workflow` — phase 5
- `feat/i18n-tests` — phase 6
- `feat/i18n-deploy` — phase 7

Merge stratégie : squash + commit messages préfixés `I18N-<phase><tache>-<desc>` (ex : `I18N-13-locale-switcher`).

---

## Phase 0 — Étude validée + ADRs (semaine 0)

> **But** : verrouiller les décisions architecturales avant d'écrire la moindre ligne de code applicatif. Sortir avec des ADRs signés.

### Calendrier

- **J1-J2** : Relecture étude par fondatrice + lead technique (asynchrone)
- **J3** : Réunion de décision (30-45 min) — validation des 10 questions ouvertes
- **J4** : Rédaction ADRs (Architecture Decision Records)
- **J5** : Signoff + kickoff phase 1

### Tâches

#### T0.1 — Relecture exhaustive de l'étude i18n

| Champ | Valeur |
|---|---|
| Objectif | S'assurer que fondatrice + lead technique ont lu et compris les 12 dossiers de `docs/i18n-strategy-2026-05/` |
| DoD | Notes de relecture (questions, désaccords) déposées en commentaires sur PR `docs/i18n-strategy-2026-05` ou doc partagé |
| Durée | 2 JH (fondatrice 4h, lead 6h) |
| Dépendances | Étude finalisée |
| Livrables | Notes de relecture, liste questions ouvertes |
| Tests requis | N/A |
| Fichiers touchés | Aucun code, uniquement docs |

#### T0.2 — Réunion de décision GO/NO-GO

| Champ | Valeur |
|---|---|
| Objectif | Trancher les 10 questions du `01-options-techniques/recommendation.md` § "Décisions ouvertes" |
| DoD | Compte-rendu réunion validé avec 10 réponses Q1→Q10 |
| Durée | 0.5 JH (réunion 45 min + CR 30 min) |
| Dépendances | T0.1 |
| Livrables | `docs/i18n-strategy-2026-05/00-context/cr-decision-go.md` |
| Tests requis | N/A |
| Fichiers touchés | N/A |
| Anti-patterns | Repousser une décision "on verra" — bloque Phase 1 |

#### T0.3 — Rédaction des ADRs

| Champ | Valeur |
|---|---|
| Objectif | Tracer chaque décision majeure dans un ADR (format MADR) |
| DoD | 8 ADRs créés et mergés sur master |
| Durée | 1.5 JH |
| Dépendances | T0.2 |
| Livrables | `docs/adr/i18n/0001-choix-next-intl.md`, `0002-path-based-routing.md`, `0003-default-locale-fr.md`, `0004-locales-v1-fr-ar-en.md`, `0005-rtl-via-logical-properties.md`, `0006-cms-component-bindings-multilang.md`, `0007-wizard-dictionary-preserved.md`, `0008-workflow-translateur-pr-github.md` |
| Tests requis | N/A |
| Fichiers touchés | `docs/adr/i18n/*.md` |

#### T0.4 — Création branche + setup tracking

| Champ | Valeur |
|---|---|
| Objectif | Préparer l'infrastructure Git/PM pour la phase 1 |
| DoD | Branche `feat/i18n-foundation` créée + epic JIRA/Linear créé avec sous-tâches T1.* |
| Durée | 0.5 JH |
| Dépendances | T0.3 |
| Livrables | Branche Git + epic outil PM |
| Tests requis | N/A |

### DoD globale Phase 0

- [x] Étude `docs/i18n-strategy-2026-05/` relue intégralement par fondatrice et lead
- [x] 10 décisions Q1→Q10 tranchées et tracées dans CR réunion
- [x] 8 ADRs mergés sur master
- [x] Branche `feat/i18n-foundation` créée
- [x] Epic + tickets phase 1 créés dans outil PM
- [x] Statut README étude basculé de `Draft` à `Validé`

### Pièges à éviter

- **Lancer Phase 1 sans ADRs signés** → on reviendra dessus en phase 3-4 et il faudra défaire
- **Décider à la place de la fondatrice** sur la voix éditoriale (FR souverain, AR à valider avec elle)
- **Sous-estimer la lecture** (étude = 6h cumulées) — bloquer 2 jours calme

---

## Phase 1 — Foundation (semaines 1-2)

> **But** : installer la fondation technique (next-intl + middleware + routing) avec **une seule page** servie en 3 locales (`fr`, `ar`, `en`), sans rien casser sur les autres routes.

### Stratégie

- Migration **progressive route par route** (cf. ADR-001)
- **Feature flag** `I18N_ENABLED` qui active le `[locale]` prefix
- **Route pilote** : `/contact` (la plus simple, ~30 strings)
- Pas de RTL en phase 1 (juste config) — RTL = phase 4
- Pas de CMS multilingue en phase 1 (juste static) — CMS = phase 3

### Tâches

#### T1.1 — Installer next-intl + dépendances

| Champ | Valeur |
|---|---|
| Objectif | Avoir `next-intl` installé et fonctionnel sur build local |
| DoD | `pnpm install` réussi, `pnpm typecheck` vert, `pnpm build` vert, version pinned dans `package.json` |
| Durée | 0.5 JH |
| Dépendances | T0.4 |
| Livrables | `package.json` + `pnpm-lock.yaml` modifiés |
| Tests requis | Smoke `pnpm build` |
| Fichiers touchés | `apps/web/package.json`, `pnpm-lock.yaml` |
| Anti-patterns | Installer une version `latest` non-pinned → casse en cas d'upgrade auto |
| Commande | `pnpm add -F web next-intl@3.x` (version exacte à pin une fois choisie) |

#### T1.2 — Configurer middleware locale + routing `[locale]`

| Champ | Valeur |
|---|---|
| Objectif | Mettre en place le middleware `next-intl` qui résout la locale depuis l'URL, le cookie ou `Accept-Language` |
| DoD | Naviguer `/contact` redirige vers `/fr/contact` (default), `/en/contact` rend OK, `/ar/contact` rend OK |
| Durée | 1.5 JH |
| Dépendances | T1.1 |
| Livrables | `apps/web/src/middleware.ts`, `apps/web/src/i18n/config.ts`, `apps/web/src/i18n/routing.ts` |
| Tests requis | Unit (helpers locale resolution) + E2E (3 redirects) |
| Fichiers touchés | `apps/web/src/middleware.ts` (modif), `apps/web/src/i18n/*` (nouveaux), `apps/web/next.config.js` |
| Anti-patterns | Oublier d'exclure `/admin/*`, `/api/*`, `/_next/*` du middleware → boucle infinie |

**Détail config attendue** :

```typescript
// apps/web/src/i18n/config.ts
export const locales = ['fr', 'ar', 'en'] as const;
export const defaultLocale = 'fr' as const;
export type Locale = (typeof locales)[number];
```

#### T1.3 — Créer structure `app/[locale]/` + page pilote

| Champ | Valeur |
|---|---|
| Objectif | Déplacer `/contact` sous `app/[locale]/contact/page.tsx` (route pilote) |
| DoD | `/fr/contact`, `/en/contact`, `/ar/contact` rendent la page (même contenu pour l'instant), `/contact` redirige vers `/fr/contact` |
| Durée | 1 JH |
| Dépendances | T1.2 |
| Livrables | Nouvelle arbo `app/[locale]/contact/page.tsx` |
| Tests requis | E2E (3 URLs servent 200) |
| Fichiers touchés | `apps/web/src/app/[locale]/contact/page.tsx`, `apps/web/src/app/[locale]/layout.tsx` |
| Anti-patterns | Casser la route `/contact` historique → garder redirect 301 temporaire vers `/fr/contact` |

#### T1.4 — Créer fichiers messages minimal

| Champ | Valeur |
|---|---|
| Objectif | Externaliser les ~30 strings de `/contact` dans `messages/{fr,ar,en}.json` |
| DoD | 3 fichiers JSON parsent OK, type-safety via `next-intl` `IntlMessages` module augmentation, ESLint pass |
| Durée | 1 JH |
| Dépendances | T1.3 |
| Livrables | `apps/web/messages/fr.json`, `apps/web/messages/ar.json` (provisoire copie FR), `apps/web/messages/en.json` |
| Tests requis | Unit (parse JSON), TS compile |
| Fichiers touchés | `apps/web/messages/*.json`, `apps/web/src/i18n/messages.d.ts` |
| Anti-patterns | Clés en français (`contact.titre`) → utiliser camelCase anglais (`contact.title`) pour cohérence dev |

**Schéma JSON attendu** (voir `02-design-conception/translation-keys-schema.json`) :

```json
{
  "contact": {
    "title": "Contactez-nous",
    "subtitle": "Nous répondons sous 24h",
    "form": {
      "nameLabel": "Votre prénom",
      "emailLabel": "Votre email",
      "messageLabel": "Votre message",
      "submitButton": "Envoyer"
    },
    "faq": {
      "heading": "Questions fréquentes",
      "items": {
        "delivery": { "q": "Quels délais de livraison ?", "a": "..." }
      }
    }
  }
}
```

#### T1.5 — LocaleSwitcher component

| Champ | Valeur |
|---|---|
| Objectif | Composant `<LocaleSwitcher />` qui permet de switcher entre FR/AR/EN |
| DoD | Composant placé dans le header, fonctionne sur `/contact` (3 langues), accessible clavier, ARIA OK |
| Durée | 1 JH |
| Dépendances | T1.4 |
| Livrables | `apps/web/src/components/i18n/LocaleSwitcher.tsx` + tests |
| Tests requis | Unit (rendering), a11y (axe), E2E (click change URL et persiste cookie) |
| Fichiers touchés | `apps/web/src/components/i18n/LocaleSwitcher.tsx`, `apps/web/src/components/site-header/SiteHeader.tsx` (ajout switcher) |
| Anti-patterns | Hardcoder labels `'Français', 'العربية', 'English'` → utiliser nom natif via `Intl.DisplayNames` |

**Spec composant** (voir `05-ui-ux-design/locale-switcher-ui.md`) :
- Dropdown ou pills selon viewport
- Nom natif des langues (Français / العربية / English)
- Drapeau optionnel (préférence : pas de drapeau, ambigu pour AR)
- Persistance cookie `NEXT_LOCALE`
- Préserve la querystring lors du switch

#### T1.6 — Tests E2E baseline (1 page × 3 locales)

| Champ | Valeur |
|---|---|
| Objectif | Suite Playwright qui valide : redirect, rendering, switch, persistance cookie |
| DoD | 6 specs Playwright passent (3 URLs × 2 scenarios : direct GET, click switcher) |
| Durée | 1.5 JH |
| Dépendances | T1.5 |
| Livrables | `apps/web/e2e/i18n/contact-locales.spec.ts` |
| Tests requis | E2E (Playwright) |
| Fichiers touchés | `apps/web/e2e/i18n/*` |
| Anti-patterns | Tests qui dépendent du cookie résiduel d'un test précédent — toujours `context.clearCookies()` |

#### T1.7 — Feature flag `I18N_ENABLED`

| Champ | Valeur |
|---|---|
| Objectif | Variable env qui désactive complètement le routing `[locale]` (rollback rapide) |
| DoD | Si `I18N_ENABLED=false`, middleware bypass et `/contact` route legacy (sans `[locale]`) fonctionne |
| Durée | 0.5 JH |
| Dépendances | T1.6 |
| Livrables | `apps/web/src/lib/feature-flags/i18n.ts`, `apps/web/.env.example` |
| Tests requis | Unit (resolver flag), Manual (toggle local) |
| Fichiers touchés | `apps/web/src/lib/feature-flags/i18n.ts`, `apps/web/src/middleware.ts`, `apps/web/.env.example` |
| Anti-patterns | Lire `process.env.I18N_ENABLED` 20 endroits différents — centraliser dans un seul module |

#### T1.8 — Code review + signoff Phase 1

| Champ | Valeur |
|---|---|
| Objectif | PR mergée + démo fondatrice |
| DoD | Lead technique approve, fondatrice voit les 3 locales sur `/contact` |
| Durée | 0.5 JH |
| Dépendances | T1.7 |
| Livrables | PR `feat/i18n-foundation` mergée |
| Tests requis | Tous tests CI verts |

### Livrables Phase 1

- ✅ next-intl installé et configuré
- ✅ Middleware locale opérationnel
- ✅ Route `/contact` servie en `/fr/contact`, `/ar/contact`, `/en/contact`
- ✅ LocaleSwitcher fonctionnel
- ✅ Tests E2E baseline verts
- ✅ Feature flag `I18N_ENABLED` opérationnel
- ✅ 3 fichiers messages JSON créés

### DoD globale Phase 1

- [x] `pnpm build` vert avec et sans `I18N_ENABLED`
- [x] `/fr/contact` rendu correct (FR)
- [x] `/en/contact` rendu correct (EN basique)
- [x] `/ar/contact` rendu correct (copie FR temporaire — pas encore traduit)
- [x] `/contact` redirige 308 vers `/fr/contact`
- [x] LocaleSwitcher persiste cookie + querystring
- [x] 6 specs Playwright passent en CI
- [x] PR mergée sur master

### Pièges à éviter Phase 1

- **Refactor en masse** : ne touche QUE `/contact` — pas `/maison`, `/kit`, etc. (= phase 2)
- **Middleware trop permissif** : exclure `/admin`, `/api`, `/_next`, `/static`, `/favicon.ico`, `/sitemap.xml`, `/robots.txt`
- **Casser routes legacy** : redirect 308 (permanent) ou 307 (temp) selon SEO
- **Oublier hreflang** : déjà préparer le helper même si phase SEO complète plus tard
- **Tester uniquement sur Chrome** : Safari + Firefox sur la matrice (cookie SameSite differs)

---

## Phase 2 — Content extraction (semaines 3-4)

> **But** : externaliser **les ~600-800 strings hardcoded** des pages marketing publiques vers les fichiers messages, en industrialisant via script AST et en mettant en place une ESLint rule pour prévenir la régression.

### Stratégie

- **Inventaire d'abord** : audit complet des strings avant extraction
- **Script AST** semi-automatique : détecter et extraire 80% des cas
- **Validation manuelle** : 20% restants + révision voix FR
- **ESLint rule** active dès la fin de phase 2 (warn → error progressif)
- **Routes traitées** : `/`, `/maison`, `/kit`, `/rituel`, `/journal`, `/contact` (déjà fait phase 1)

> 📦 **Préparation hors-sprint disponible** : l'audit + l'extraction + les traductions FR/AR/EN sont **déjà produits** dans [`docs/i18n-content-2026-05/`](../../i18n-content-2026-05/). T2.1 et T2.2 peuvent être considérés comme **déjà accomplis** (à valider en kickoff Phase 2). Les tâches T2.3 à T2.X consistent désormais principalement à **ingérer** ce contenu vers `apps/web/messages/` et à refactorer le code applicatif pour utiliser `useTranslations()`. Lancer `python3 docs/i18n-content-2026-05/scripts/validate-seeds.py` doit retourner `GO pour ingestion` avant kickoff.

### Tâches

#### T2.1 — Audit + inventaire 600-800 strings ✅ DÉJÀ FAIT

| Champ | Valeur |
|---|---|
| Objectif | Recenser TOUTES les strings hardcoded à externaliser, avec scoring priorité |
| DoD | Spreadsheet avec colonnes `file`, `line`, `string_fr`, `context`, `priority` (P0/P1/P2), `key_proposed` |
| Durée | 2 JH — ~~à faire~~ **déjà fait hors-sprint** |
| Dépendances | T1.8 (phase 1 OK) |
| Livrables | ✅ `docs/i18n-content-2026-05/01-audit/inventory-complete.csv` (766 strings auditées) |
| Tests requis | N/A (audit) |
| Fichiers touchés | `docs/i18n-content-2026-05/01-audit/` |
| Anti-patterns | Sauter l'audit et passer direct à l'extraction → on découvre des cas tordus en cours de route et on bloque |

**Commande de scan initial** :

```bash
# Strings FR détectables (heuristique : chaînes entre guillemets contenant ≥ 2 mots FR)
rg -t tsx -t ts -n --pcre2 '"[A-Z][a-zé][^"]*\s+[a-zé][^"]*"' apps/web/src/app apps/web/src/components > scan-fr-strings.txt
```

#### T2.2 — Script AST d'extraction automatique

| Champ | Valeur |
|---|---|
| Objectif | Tooling Node qui parse les TSX et propose des extractions (JSX text, `aria-label`, `title`, `alt`, etc.) |
| DoD | Script `scripts/i18n/extract.ts` qui prend une route en argument et génère : (a) entrée JSON dans `messages/fr.json`, (b) refactor TSX avec `useTranslations(namespace).t('key')` |
| Durée | 3 JH |
| Dépendances | T2.1 |
| Livrables | `apps/web/scripts/i18n/extract.ts`, `apps/web/scripts/i18n/README.md` |
| Tests requis | Unit sur le parser AST + fixtures de TSX |
| Fichiers touchés | `apps/web/scripts/i18n/*` |
| Anti-patterns | Vouloir 100% automatique — les literals dynamiques (`${name} est arrivé`) demandent intervention manuelle |

**Cibles AST** :
- `<Tag>Texte brut</Tag>` → `<Tag>{t('key')}</Tag>`
- `<input placeholder="Votre prénom" />` → `<input placeholder={t('key')} />`
- `aria-label="..."`, `title="..."`, `alt="..."`
- Strings dans variables : `const HEADER = "Maison"` → reporter dans inventaire (manuel)

#### T2.3 — Extraction `/` (home page)

| Champ | Valeur |
|---|---|
| Objectif | Externaliser ~80 strings de la home |
| DoD | `/fr/`, `/en/`, `/ar/` rendent avec messages externalisés ; visual diff vs prod = 0 |
| Durée | 1.5 JH |
| Dépendances | T2.2 |
| Livrables | `messages/{fr,ar,en}.json` enrichis namespace `home.*`, `app/[locale]/page.tsx` refactoré |
| Tests requis | E2E (3 locales), visual regression |
| Fichiers touchés | `apps/web/src/app/[locale]/page.tsx`, sections marketing utilisées par home |
| Anti-patterns | Mettre toutes les sections dans `home.*` — préférer namespaces par section (`hero.*`, `featured.*`, etc.) |

#### T2.4 — Extraction `/maison`

| Champ | Valeur |
|---|---|
| Objectif | Externaliser ~50 strings de `/maison` |
| DoD | 3 locales rendent ; metadata SEO localisée |
| Durée | 1 JH |
| Dépendances | T2.3 |
| Livrables | `messages/*` enrichis namespace `maison.*`, `app/[locale]/maison/page.tsx` |
| Tests requis | E2E + visual + SEO metadata snapshot |
| Fichiers touchés | `apps/web/src/app/[locale]/maison/page.tsx` |

#### T2.5 — Extraction `/kit`

| Champ | Valeur |
|---|---|
| Objectif | Externaliser ~120 strings de `/kit` (hors wizard CHA-231 préservé) |
| DoD | Page kit rendue 3 locales, **wizard CHA-231 inchangé** (utilise toujours `WizardDictionary`) |
| Durée | 2 JH |
| Dépendances | T2.4 |
| Livrables | `messages/*` enrichis namespace `kit.*`, `app/[locale]/kit/page.tsx` |
| Tests requis | E2E (incluant entrée wizard), visual regression, regression wizard |
| Fichiers touchés | `apps/web/src/app/[locale]/kit/page.tsx`, sections kit-hero |
| Anti-patterns | **Toucher au WizardDictionary** = régression CHA-231 — interdit en phase 2 |

#### T2.6 — Extraction `/rituel`

| Champ | Valeur |
|---|---|
| Objectif | Externaliser ~60 strings de `/rituel` |
| DoD | 3 locales rendues, testimonials chargés via `ritual_testimonials.language` (filtré par locale) |
| Durée | 1 JH |
| Dépendances | T2.5 |
| Livrables | `messages/*` enrichis namespace `rituel.*`, repo `ritual_testimonials` étendu pour filtrer par locale |
| Tests requis | E2E + integration (DB fetch by locale) |
| Fichiers touchés | `apps/web/src/app/[locale]/rituel/page.tsx`, `apps/web/src/lib/rituel/repository.ts` |

#### T2.7 — Extraction `/journal` + articles

| Champ | Valeur |
|---|---|
| Objectif | Externaliser ~20 strings UI + supporter articles multilingues (data/mock + DB) |
| DoD | Liste journal en 3 locales, articles individuels servis selon locale (fallback FR si pas de traduction) |
| Durée | 1.5 JH |
| Dépendances | T2.6 |
| Livrables | `messages/*` enrichis, structure data articles refactorée pour multilingue |
| Tests requis | E2E + integration |
| Fichiers touchés | `apps/web/src/app/[locale]/journal/page.tsx`, `apps/web/src/app/[locale]/journal/[slug]/page.tsx`, `apps/web/data/mock/articles.ts` |

#### T2.8 — Validation manuelle FR par fondatrice

| Champ | Valeur |
|---|---|
| Objectif | Revue voix FemiGlow (sobre, posée, pas d'urgence factice) sur les ~700 strings externalisées |
| DoD | Fondatrice signe-off `messages/fr.json` ligne par ligne, corrections appliquées |
| Durée | 2 JH (1 JH fondatrice + 1 JH dev pour corrections) |
| Dépendances | T2.7 |
| Livrables | `messages/fr.json` final, log de modifs dans `docs/i18n-strategy-2026-05/05-ui-ux-design/log-revue-voix-fr.md` |
| Tests requis | Snapshot visuel + E2E |
| Anti-patterns | Faire ça en fin de phase 6 — trop tard, on devra refactor les tests visuels |

#### T2.9 — ESLint rule custom anti-strings-hardcoded

| Champ | Valeur |
|---|---|
| Objectif | Détecter automatiquement toute string FR dans le code TSX hors `messages/*` |
| DoD | Rule active en mode `warn` au début, devient `error` en CI à la fin de phase 6 |
| Durée | 1.5 JH |
| Dépendances | T2.8 |
| Livrables | `apps/web/eslint-rules/no-hardcoded-strings.js`, conf eslintrc activée |
| Tests requis | Unit (rule tests) + CI green |
| Fichiers touchés | `apps/web/eslint.config.js` (modif), `apps/web/eslint-rules/*` (nouveau) |
| Anti-patterns | Whitelister tout `*.test.tsx` (correct) mais aussi `*.tsx` (incorrect) — granularité par dossier |

**Logique de la rule** :
- Détecter JSX text qui matche `/[A-Z][a-zé]{2,}/` (mots FR-like)
- Whitelist : `*.test.tsx`, `*.stories.tsx`, fichiers dans `e2e/`, `messages/`
- Suggest fix : utiliser `useTranslations`

#### T2.10 — Traduction EN baseline (auto + review)

| Champ | Valeur |
|---|---|
| Objectif | Avoir un EN passable (pas perfect) pour V1 |
| DoD | `messages/en.json` rempli à 100% des clés FR ; review humaine sur strings P0 (CTAs, navigation, métadata SEO) |
| Durée | 2 JH (1 JH automatisation DeepL + 1 JH review translator EN) |
| Dépendances | T2.8 |
| Livrables | `messages/en.json`, `docs/i18n-strategy-2026-05/06-data-strategy/glossaire-en.csv` |
| Tests requis | TS compile (clés alignées), Playwright `/en/*` rendering |
| Fichiers touchés | `messages/en.json` |
| Anti-patterns | Publier la traduction DeepL brute sans review humaine sur P0 → impression amateur |

### DoD globale Phase 2

- [x] ~700 strings externalisées dans `messages/{fr,ar,en}.json`
- [x] Routes `/`, `/maison`, `/kit`, `/rituel`, `/journal`, `/contact` servies en 3 locales
- [x] Wizard CHA-231 inchangé et fonctionnel
- [x] ESLint rule active (mode warn min, error en fin de phase 6)
- [x] Fondatrice a validé `messages/fr.json`
- [x] EN baseline en place (DeepL + review P0)
- [x] AR encore en copie FR (sera traduit phase 5)
- [x] Tests E2E verts sur 6 routes × 3 locales = 18 scenarios

### Pièges à éviter Phase 2

- **Refactor anarchique** : suivre l'inventaire T2.1 dans l'ordre, route par route
- **Toucher au wizard** = régression CHA-231 (interdit)
- **Casser SEO** : metadata localisée mais pas oublier `<html lang="">` dynamique
- **Mélanger AR et EN dans phase 2** : phase 2 = extraction FR principalement, AR/EN approfondis phase 5
- **Oublier les strings dans `data/mock/*.ts`** : audit T2.1 doit les couvrir
- **Performance build** : trop de namespaces JSON = lent ; regrouper par feature (cf. 02-design-conception/naming-conventions.md)

---

## Phase 3 — CMS multilingue (semaine 5)

> **But** : étendre le système CMS (`component_field_bindings`) pour saisir des contenus multilingues côté admin, et restituer la bonne locale côté frontend avec fallback FR.

### Contexte technique

- La table `component_field_bindings` a déjà une colonne `locale text default 'fr'`
- Les ~200 composants CMS actuels sont en `locale='fr'`
- L'UI admin actuelle n'a pas d'onglet par langue

### Tâches

#### T3.1 — Repo extension `componentFieldBindings.getByLocale`

| Champ | Valeur |
|---|---|
| Objectif | Méthode `getByLocale(componentId, fieldKey, locale, fallbackLocale)` qui retourne soit la valeur de la locale demandée, soit le fallback |
| DoD | Méthode + tests unit + integration (DB) en place, signature stable |
| Durée | 1 JH |
| Dépendances | T2 phase 2 finie |
| Livrables | `apps/web/src/lib/cms/repositories/componentFieldBindingsRepo.ts` étendu |
| Tests requis | Unit + integration |
| Fichiers touchés | `apps/web/src/lib/cms/repositories/componentFieldBindingsRepo.ts` |
| Anti-patterns | Faire le fallback côté React (côté SSR seulement → cohérence cache) |

**Signature attendue** :

```typescript
type GetByLocaleParams = {
  componentId: string;
  fieldKey: string;
  locale: Locale;
  fallbackLocale?: Locale;
};

async function getByLocale(params: GetByLocaleParams): Promise<{
  value: unknown;
  resolvedLocale: Locale;
  isFallback: boolean;
}>
```

#### T3.2 — UI Admin onglets par locale

| Champ | Valeur |
|---|---|
| Objectif | Dans l'éditeur de `component_field_bindings`, ajouter des onglets `FR / AR / EN` pour saisir chaque champ par locale |
| DoD | Admin peut créer/éditer une valeur par locale, sauver, voir le diff vs FR |
| Durée | 2 JH |
| Dépendances | T3.1 |
| Livrables | `apps/web/src/app/admin/cms/components/[id]/edit/page.tsx`, composant `LocaleTabs` |
| Tests requis | E2E admin + visual regression admin |
| Fichiers touchés | `apps/web/src/app/admin/cms/components/...`, `apps/web/src/components/admin/cms/LocaleTabs.tsx` |
| Anti-patterns | Forcer l'admin à remplir toutes les locales (bloquer save) → frustrant. Plutôt indicateur "manque AR" non-bloquant |

#### T3.3 — Migration data existante

| Champ | Valeur |
|---|---|
| Objectif | Toutes les rows actuelles `component_field_bindings` ont `locale='fr'` → s'assurer qu'aucune n'est `NULL` |
| DoD | Migration Drizzle qui : (a) backfill `locale='fr'` sur `NULL` si existant, (b) ajoute index `(component_id, field_key, locale)` |
| Durée | 0.5 JH |
| Dépendances | T3.1 |
| Livrables | `apps/web/drizzle/migrations/00XX-cms-locale-backfill.sql` |
| Tests requis | Migration testée local + staging |
| Fichiers touchés | `apps/web/drizzle/migrations/*` |
| Anti-patterns | Migration destructive (DROP/RENAME) — préférer additive |

#### T3.4 — Intégration frontend (RSC)

| Champ | Valeur |
|---|---|
| Objectif | Côté pages marketing, les composants CMS chargent la locale courante avec fallback FR |
| DoD | Sur `/en/maison`, si une section CMS n'a pas de version EN → fallback FR affiché avec marker dev (visible en dev mode seulement) |
| Durée | 1.5 JH |
| Dépendances | T3.2, T3.3 |
| Livrables | Hook `useCmsLocale` ou helper RSC `loadCmsField(locale)` |
| Tests requis | Integration + E2E |
| Fichiers touchés | `apps/web/src/lib/cms/serverActions.ts`, composants marketing qui consomment CMS |

#### T3.5 — Tests integration CMS multilingue

| Champ | Valeur |
|---|---|
| Objectif | Couvrir : (a) read locale spécifique, (b) fallback FR, (c) écriture admin, (d) cache invalidation |
| DoD | 12 tests passent (4 scénarios × 3 locales) |
| Durée | 1 JH |
| Dépendances | T3.4 |
| Livrables | `apps/web/src/lib/cms/__tests__/multilang.test.ts` |
| Tests requis | Integration |
| Fichiers touchés | `apps/web/src/lib/cms/__tests__/multilang.test.ts` |

### DoD globale Phase 3

- [x] Repo `componentFieldBindings.getByLocale` opérationnel
- [x] UI Admin avec onglets FR/AR/EN
- [x] Migration DB appliquée (backfill + index)
- [x] Frontend récupère bonne locale avec fallback
- [x] 12+ tests CMS multilingue verts
- [x] Démo fondatrice : créer un composant en AR via admin et voir le résultat sur `/ar/maison`

### Pièges à éviter Phase 3

- **Cache stale** : invalider le cache RSC quand une row CMS est éditée (server actions revalidatePath)
- **Schéma trop rigide** : laisser le JSON `value` libre pour permettre des structures complexes
- **Mauvais index** : `(component_id, field_key, locale)` ou la query devient slow sur 1000+ rows
- **Forcer saisie all-locales** : non-bloquant, juste indicateur

---

## Phase 4 — RTL + AR (semaine 6)

> **But** : activer le RTL (right-to-left) pour la locale AR avec audit complet des composants Tailwind, refactor vers logical properties, intégration font Cairo, et tests visuels RTL Playwright.

### Stratégie RTL

- **Pas de plugin Tailwind RTL** (cf. ADR-005) : on utilise les logical properties Tailwind 3.x (`ms-`, `me-`, `ps-`, `pe-`, etc.)
- `<html dir="rtl" lang="ar">` géré par next-intl helper
- Font Cairo + fallback system pour AR
- Audit composant par composant

### Tâches

#### T4.1 — Audit composants logical properties

| Champ | Valeur |
|---|---|
| Objectif | Identifier tous les composants utilisant `ml-`, `mr-`, `pl-`, `pr-`, `text-left`, `text-right`, `border-l`, `border-r` |
| DoD | CSV inventaire `docs/i18n-strategy-2026-05/05-ui-ux-design/audit-rtl.csv` avec `file`, `line`, `class`, `replacement` |
| Durée | 1 JH |
| Dépendances | Phase 3 finie |
| Livrables | `docs/i18n-strategy-2026-05/05-ui-ux-design/audit-rtl.csv` (~200 lignes attendues) |
| Tests requis | N/A (audit) |
| Fichiers touchés | Aucun code, juste audit |

**Commande de scan** :

```bash
rg -t tsx -t ts -n '\b(m[lr]-|p[lr]-|text-(left|right)|border-[lr]|left-|right-)\b' apps/web/src
```

#### T4.2 — Refactor Tailwind logical properties

| Champ | Valeur |
|---|---|
| Objectif | Remplacer ~200 occurrences par leurs équivalents logiques |
| DoD | `pnpm typecheck` vert, `pnpm test` vert, snapshot visuel LTR identique à avant |
| Durée | 2 JH |
| Dépendances | T4.1 |
| Livrables | ~50-80 fichiers TSX modifiés |
| Tests requis | Visual regression LTR + RTL |
| Fichiers touchés | Multi composants UI + sections marketing |
| Anti-patterns | Sed-replace à l'aveugle — `text-left` n'est pas toujours équivalent à `text-start` selon contexte |

**Mappings Tailwind** :

| Direction-aware | Logical |
|---|---|
| `ml-4` | `ms-4` |
| `mr-4` | `me-4` |
| `pl-4` | `ps-4` |
| `pr-4` | `pe-4` |
| `text-left` | `text-start` |
| `text-right` | `text-end` |
| `border-l` | `border-s` |
| `border-r` | `border-e` |
| `left-0` | `start-0` |
| `right-0` | `end-0` |

#### T4.3 — Setup `<html dir>` dynamique

| Champ | Valeur |
|---|---|
| Objectif | `<html dir="rtl" lang="ar">` pour locale AR, `<html dir="ltr" lang="fr">` pour FR/EN |
| DoD | Inspect dans browser sur les 3 locales montre bons attributs `dir` et `lang` |
| Durée | 0.5 JH |
| Dépendances | T4.2 |
| Livrables | `apps/web/src/app/[locale]/layout.tsx` modifié |
| Tests requis | E2E (attributs HTML), a11y |
| Fichiers touchés | `apps/web/src/app/[locale]/layout.tsx` |

#### T4.4 — Font Cairo intégration

| Champ | Valeur |
|---|---|
| Objectif | Charger Cairo (font AR) uniquement pour locale AR, avec fallback system |
| DoD | DevTools Network montre Cairo chargé sur `/ar/*` uniquement, pas sur `/fr/*` ni `/en/*` |
| Durée | 1 JH |
| Dépendances | T4.3 |
| Livrables | Config `next/font/google` + variable CSS `--font-arabic` |
| Tests requis | E2E (font loaded) + Lighthouse (perf budget OK) |
| Fichiers touchés | `apps/web/src/app/[locale]/layout.tsx`, `apps/web/tailwind.config.ts` (extend fontFamily) |
| Anti-patterns | Charger Cairo sur toutes les locales → +50kB inutile sur FR/EN |

#### T4.5 — Tests visuels RTL Playwright

| Champ | Valeur |
|---|---|
| Objectif | Snapshots des 6 routes principales en `/ar/*` pour détecter régression layout RTL |
| DoD | 6 specs visual regression passent, snapshots dans `apps/web/e2e/visual/rtl/` |
| Durée | 1.5 JH |
| Dépendances | T4.4 |
| Livrables | `apps/web/e2e/visual/rtl/*.spec.ts` + baseline screenshots |
| Tests requis | Playwright visual |
| Fichiers touchés | `apps/web/e2e/visual/rtl/*` |
| Anti-patterns | Ne pas masquer les éléments dynamiques (date, prix) → flakiness |

#### T4.6 — Audit a11y RTL avec axe

| Champ | Valeur |
|---|---|
| Objectif | S'assurer que `/ar/*` n'introduit pas de régression a11y |
| DoD | `axe-playwright` sur 6 routes × locale AR retourne 0 violation critique/sérieuse |
| Durée | 1 JH |
| Dépendances | T4.5 |
| Livrables | Rapports a11y dans `apps/web/e2e/a11y/rtl-report.json` |
| Tests requis | a11y |
| Fichiers touchés | `apps/web/e2e/a11y/rtl-*.spec.ts` |

### DoD globale Phase 4

- [x] ~200 classes Tailwind refactorées vers logical properties
- [x] `<html dir="rtl">` correct sur `/ar/*`
- [x] Font Cairo chargée uniquement sur AR
- [x] 6 routes × AR rendues correctement (visuel OK)
- [x] 0 régression visuelle LTR (FR/EN inchangé)
- [x] a11y RTL = 0 violation
- [x] Wizard CHA-231 RTL-ready (avait déjà l'infra, juste activer)

### Pièges à éviter Phase 4

- **Casser le LTR existant** : tous les refactors doivent garder le rendu LTR identique
- **Oublier les composants tiers** : DayPicker, Recharts, etc. n'ont pas tous un RTL natif — wrapper `<div dir="rtl">` localement
- **Inputs RTL** : `text-align` mais aussi `dir="rtl"` sur l'input lui-même pour clavier
- **Icônes directionnelles** : flèches `→` doivent flipper en RTL (`→` devient `←`)
- **Numéros** : en AR-MA, beaucoup utilisent chiffres latins (0-9) plutôt qu'arabes (٠-٩) — convention à valider avec fondatrice

---

## Phase 5 — Workflow translateur (semaine 7)

> **But** : mettre en place le workflow d'export/import de traductions, doc translateur, glossaire FemiGlow, et lancer le premier round de traduction AR sur les ~700 strings.

### Tâches

#### T5.1 — Endpoints export / import traductions

| Champ | Valeur |
|---|---|
| Objectif | Scripts pour exporter `messages/fr.json` en format CSV ou XLIFF, et réimporter une fois traduit |
| DoD | `pnpm i18n:export` génère `exports/fr-to-ar-{date}.xlsx` ; `pnpm i18n:import` injecte dans `messages/ar.json` |
| Durée | 1.5 JH |
| Dépendances | Phase 4 finie |
| Livrables | `apps/web/scripts/i18n/export.ts`, `apps/web/scripts/i18n/import.ts` |
| Tests requis | Unit + manual (roundtrip) |
| Fichiers touchés | `apps/web/scripts/i18n/*`, `apps/web/package.json` (scripts) |
| Anti-patterns | Format propriétaire — utiliser XLIFF 2.0 ou CSV standard pour portabilité |

#### T5.2 — Doc translateur + glossaire

| Champ | Valeur |
|---|---|
| Objectif | Documentation onboarding translateur (1h pour démarrer) |
| DoD | Translateur AR teste lui-même la doc et confirme "je sais quoi faire" |
| Durée | 1 JH |
| Dépendances | T5.1 |
| Livrables | `docs/i18n-strategy-2026-05/09-runbook/onboarding-translateur.md`, `docs/i18n-strategy-2026-05/06-data-strategy/glossaire-fr-ar.csv` |
| Tests requis | N/A (validation translateur) |
| Fichiers touchés | `docs/i18n-strategy-2026-05/09-runbook/*`, `docs/i18n-strategy-2026-05/06-data-strategy/glossaire-fr-ar.csv` |

**Contenu glossaire** :
- Termes-marque (`FemiGlow`, `rituel`, `Maison`, `Kit`) → ne PAS traduire
- Termes-clés (`hyperpigmentation`, `peau`, `acné`) → traduction validée
- Tone (sobre, posée, premium, pas d'urgence factice)
- Pluralization rules AR (zero/one/two/few/many/other)

#### T5.3 — Premier round traduction AR

| Champ | Valeur |
|---|---|
| Objectif | Translateur AR traduit `messages/fr.json` complet → `messages/ar.json` (réel, plus copie FR) |
| DoD | 100% des clés FR ont une traduction AR ; pas de string non-traduite (vide ou identique à FR involontaire) |
| Durée | 5 JH (translateur, asynchrone) |
| Dépendances | T5.2 |
| Livrables | `messages/ar.json` finalisé |
| Tests requis | Validation qualitative fondatrice (échantillon) |
| Fichiers touchés | `messages/ar.json` |
| Anti-patterns | Translation Google brute sans review humaine native AR |

#### T5.4 — Intégration AR + tests

| Champ | Valeur |
|---|---|
| Objectif | Activer la locale AR dans `I18N_LOCALES_ACTIVE`, tester intégration |
| DoD | `/ar/*` sur 6 routes affiche AR réel (validé par fondatrice native AR ou translateur) |
| Durée | 1 JH |
| Dépendances | T5.3 |
| Livrables | Update `.env.example` (`I18N_LOCALES_ACTIVE=fr,ar,en`), tests E2E AR |
| Tests requis | E2E AR + visual regression |

#### T5.5 — Validation native fondatrice ou native speaker

| Champ | Valeur |
|---|---|
| Objectif | Catch les bugs de tonalité, register, dialectal (Darija vs MSA) |
| DoD | Validation écrite par native speaker AR-MA |
| Durée | 1 JH (native speaker) |
| Dépendances | T5.4 |
| Livrables | `docs/i18n-strategy-2026-05/05-ui-ux-design/validation-ar-ma.md` |
| Tests requis | N/A |

### DoD globale Phase 5

- [x] `messages/ar.json` complet (100% clés)
- [x] Translateur a accès doc + glossaire
- [x] Workflow export/import opérationnel
- [x] `/ar/*` validé qualitativement par native speaker
- [x] EN également enrichi si translateur EN disponible

### Pièges à éviter Phase 5

- **Sous-estimer effort translateur** : 700 strings = 3-5 jours minimum (pas 1 jour)
- **Pas de glossaire** = drift terminologique (peau / skin / بشرة avec variantes incohérentes)
- **Confondre AR standard et Darija** : pour FemiGlow Maroc, mix MSA (formel) pour body + Darija (familier) pour CTA marketing — à valider
- **Roundtrip cassé** : export → translateur édite → import perd le formatting ICU
- **Pluralization oubliée** : AR a 6 formes plurielles, pas 2 comme FR

---

## Phase 6 — Tests denses (semaines 8-9)

> **But** : compléter la pyramide de tests sur la dimension i18n, mettre en place coverage gates CI, et exécuter la boucle correction-test décrite dans `11-test-execution/`.

### Stratégie

Pyramide cible :
- **Unit** : ~80 tests (helpers locale, hooks, components atomiques)
- **Integration** : ~40 tests (repos, server actions, API routes)
- **E2E** : ~50 scenarios (Playwright × 3 locales = 150 runs)
- **Visual regression** : ~36 snapshots (6 routes × 3 locales × 2 viewports)
- **A11y** : ~18 scans (6 routes × 3 locales) avec axe
- **Perf** : Lighthouse CI sur 3 locales

### Tâches

#### T6.1 — Compléter pyramide unit

| Champ | Valeur |
|---|---|
| Objectif | Couvrir les helpers, hooks, composants i18n avec tests unit |
| DoD | Coverage `apps/web/src/i18n/*` ≥ 90% lines, `apps/web/src/components/i18n/*` ≥ 85% |
| Durée | 2 JH |
| Dépendances | Phase 5 finie |
| Livrables | `apps/web/src/i18n/__tests__/*`, `apps/web/src/components/i18n/__tests__/*` |
| Tests requis | Vitest |
| Fichiers touchés | `apps/web/src/i18n/__tests__/*`, `apps/web/src/components/i18n/__tests__/*` |

**Cibles unit** :
- `resolveLocale(request)` — 12 cas (path/cookie/header/IP fallback)
- `LocaleSwitcher` — 8 cas (render, click, persistance)
- `formatDate(date, locale)` — 6 locales × 3 formats
- `formatCurrency(amount, locale)` — 6 cas (MAD pour AR/FR, USD pour EN-US, GBP pour EN-GB...)
- `pluralize(count, locale)` — 12 cas (AR 6 formes, FR 2 formes, EN 2 formes)

#### T6.2 — Compléter pyramide integration

| Champ | Valeur |
|---|---|
| Objectif | Couvrir repos, server actions, API routes pour multilingue |
| DoD | Coverage `apps/web/src/lib/cms/*` (méthodes locale) ≥ 90% |
| Durée | 1.5 JH |
| Dépendances | T6.1 |
| Livrables | `apps/web/src/lib/cms/__tests__/locale.integration.test.ts`, `apps/web/src/lib/legal/__tests__/locale.integration.test.ts` |
| Tests requis | Integration (DB) |

#### T6.3 — E2E exhaustif 3 locales

| Champ | Valeur |
|---|---|
| Objectif | Toutes les routes critiques testées en 3 locales |
| DoD | 50+ specs × 3 locales = 150+ runs E2E, tous verts en CI |
| Durée | 3 JH |
| Dépendances | T6.2 |
| Livrables | `apps/web/e2e/i18n/*.spec.ts` (suite enrichie) |
| Tests requis | Playwright |
| Fichiers touchés | `apps/web/e2e/i18n/*`, `apps/web/playwright.config.ts` (matrix locales) |

**Scenarios critiques** :
- Switch locale au milieu du parcours (home → kit → checkout)
- Deep link `/ar/kit?utm=xyz` préserve UTM
- 404 par locale (`/ar/inexistant` → page 404 AR)
- Cookie expiration → fallback Accept-Language
- Persistance locale après login admin

#### T6.4 — Visual regression 3 locales

| Champ | Valeur |
|---|---|
| Objectif | Snapshots Playwright pour détecter régressions visuelles |
| DoD | 36 snapshots (6 routes × 3 locales × 2 viewports : desktop 1280, mobile 375) |
| Durée | 1.5 JH |
| Dépendances | T6.3 |
| Livrables | `apps/web/e2e/visual/i18n/*.spec.ts` + baselines |
| Tests requis | Playwright visual |
| Anti-patterns | Snapshots full-page sans mask des éléments dynamiques (heure, prix) → flakiness |

#### T6.5 — A11y scans 3 locales

| Champ | Valeur |
|---|---|
| Objectif | Aucune régression a11y entre LTR (fr/en) et RTL (ar) |
| DoD | `axe-playwright` retourne 0 violation critique/sérieuse sur 18 scans |
| Durée | 1 JH |
| Dépendances | T6.4 |
| Livrables | `apps/web/e2e/a11y/i18n-*.spec.ts` |
| Tests requis | a11y |

#### T6.6 — Perf budget Lighthouse CI

| Champ | Valeur |
|---|---|
| Objectif | Pas de régression perf > 5% entre baseline FR et AR/EN |
| DoD | Lighthouse CI configuré, gates `performance ≥ 90`, `accessibility ≥ 95`, `seo ≥ 90` |
| Durée | 1 JH |
| Dépendances | T6.5 |
| Livrables | `apps/web/lighthouserc.json` |
| Tests requis | Lighthouse CI |
| Fichiers touchés | `apps/web/lighthouserc.json`, GitHub Actions workflow |

#### T6.7 — Coverage gates CI

| Champ | Valeur |
|---|---|
| Objectif | CI fail si coverage drop sur fichiers i18n |
| DoD | Coverage gates appliqués : `apps/web/src/i18n/*` ≥ 90%, `apps/web/src/components/i18n/*` ≥ 85%, `apps/web/src/lib/cms/*` (méthodes locale) ≥ 90% |
| Durée | 0.5 JH |
| Dépendances | T6.6 |
| Livrables | Vitest config + GitHub Actions step |
| Tests requis | CI green |
| Fichiers touchés | `apps/web/vitest.config.ts`, `.github/workflows/test.yml` |

#### T6.8 — ESLint rule en mode error

| Champ | Valeur |
|---|---|
| Objectif | Passer la rule custom de `warn` à `error` |
| DoD | CI fail si un dev ajoute une string hardcoded |
| Durée | 0.5 JH |
| Dépendances | T6.7 |
| Livrables | `eslint.config.js` modifié |

#### T6.9 — Boucle correction-test (cf. `11-test-execution/`)

| Champ | Valeur |
|---|---|
| Objectif | Exécuter la boucle décrite dans `11-test-execution/boucle-correction.md` jusqu'à 100% tests verts |
| DoD | 0 test rouge, 0 flaky test (3 runs consécutifs verts) |
| Durée | 3 JH (variable selon bugs trouvés) |
| Dépendances | T6.8 |
| Livrables | Bugs fixés + rapport synthèse `docs/i18n-strategy-2026-05/11-test-execution/rapport-boucle-1.md` |
| Tests requis | Toute la pyramide |

### DoD globale Phase 6

- [x] ~250 tests i18n verts (unit + integration + e2e + visual + a11y)
- [x] Coverage gates respectés
- [x] ESLint rule en mode error
- [x] Lighthouse CI vert sur 3 locales
- [x] 0 flaky test (3 runs consécutifs)
- [x] Rapport boucle correction signé

### Pièges à éviter Phase 6

- **Tests qui dépendent les uns des autres** (ordre execution) — chaque test doit être isolé
- **Snapshots trop précis** — mask les éléments volatils
- **Trop de matrix combinatorial** : ne pas multiplier × 3 locales pour tous les tests — seulement les critiques
- **Skip flaky tests** (`.skip` ou `.only`) — fixer la cause, pas masquer
- **Coverage = qualité** (faux) : 90% coverage avec tests inutiles ne vaut rien

---

## Phase 7 — Deploy + observabilité (semaine 10)

> **But** : déployer en production progressivement (canary 10% → 50% → 100%) avec feature flag, monitoring Sentry + analytics, et plan rollback validé.

### Tâches

#### T7.1 — Setup feature flag `I18N_ENABLED` Vercel

| Champ | Valeur |
|---|---|
| Objectif | Variable d'env Vercel configurée pour preview, staging, production |
| DoD | `I18N_ENABLED=true` sur preview/staging, `false` sur prod jusqu'à canary |
| Durée | 0.5 JH |
| Dépendances | Phase 6 finie |
| Livrables | Vercel project settings + screenshot validation |
| Tests requis | Manual (deploy preview vérification) |

#### T7.2 — Snapshot DB pré-deploy

| Champ | Valeur |
|---|---|
| Objectif | Backup DB Neon prod avant migration phase 3 si pas déjà déployée |
| DoD | Snapshot disponible et restorable (test de restore sur DB temp) |
| Durée | 0.5 JH |
| Dépendances | T7.1 |
| Livrables | Snapshot Neon nommé `pre-i18n-deploy-{YYYYMMDD}` |
| Tests requis | Restore test sur DB temp |

#### T7.3 — Canary 10%

| Champ | Valeur |
|---|---|
| Objectif | Activer i18n sur 10% du trafic prod via Vercel Edge Config |
| DoD | Pendant 24h : 0 erreur Sentry critique, taux conversion stable (±5%), aucun report 5xx |
| Durée | 1.5 JH (mise en place) + 24h observation |
| Dépendances | T7.2 |
| Livrables | Edge config + dashboard monitoring |
| Tests requis | Smoke prod + monitoring real-user |
| Fichiers touchés | Vercel Edge Config |
| Anti-patterns | Canary sans monitoring = blind shot — dashboard avant tout |

#### T7.4 — Canary 50%

| Champ | Valeur |
|---|---|
| Objectif | Élargir à 50% du trafic |
| DoD | Pendant 48h : KPIs stables, pas de spike erreur, locale distribution = expected (~80% FR, ~10% AR, ~10% EN initialement) |
| Durée | 0.5 JH + 48h observation |
| Dépendances | T7.3 |

#### T7.5 — Canary 100% (full rollout)

| Champ | Valeur |
|---|---|
| Objectif | 100% du trafic sur i18n |
| DoD | Pendant 72h : aucun incident, conversion FR stable, AR/EN visible dans funnel |
| Durée | 0.5 JH + 72h observation |
| Dépendances | T7.4 |

#### T7.6 — Monitoring Sentry tags

| Champ | Valeur |
|---|---|
| Objectif | Tag toutes les erreurs Sentry avec `locale` pour segmenter analyse |
| DoD | Erreurs Sentry filtrables par tag `locale=fr/ar/en` |
| Durée | 0.5 JH |
| Dépendances | T7.5 |
| Livrables | `apps/web/src/lib/observability/sentry.ts` (instrumentation locale) |
| Tests requis | Manual (provoquer error et vérifier tag) |
| Fichiers touchés | `apps/web/src/lib/observability/sentry.ts` |

#### T7.7 — Analytics locale tracking

| Champ | Valeur |
|---|---|
| Objectif | Events GA4/Plausible avec dimension custom `locale` |
| DoD | Dashboard `Locale distribution` opérationnel |
| Durée | 0.5 JH |
| Dépendances | T7.6 |
| Livrables | Update tracking config + dashboard |
| Fichiers touchés | `apps/web/src/lib/analytics/*` |

#### T7.8 — Plan rollback validé

| Champ | Valeur |
|---|---|
| Objectif | Procédure rollback testée et timée |
| DoD | Test rollback (staging) chrono ≤ 5 min `I18N_ENABLED=false` → routes legacy |
| Durée | 0.5 JH |
| Dépendances | T7.5 |
| Livrables | `docs/i18n-strategy-2026-05/08-plan-action/rollback.md` validé |

### DoD globale Phase 7

- [x] i18n actif sur 100% prod
- [x] 0 incident critique pendant canary
- [x] Sentry tagué locale
- [x] Analytics tracke locale
- [x] Rollback testé chronométré
- [x] Doc finale runbook publié

### Pièges à éviter Phase 7

- **Deploy un vendredi soir** — toujours déployer en semaine quand l'équipe est dispo
- **Pas de canary** = full rollout direct → risque max
- **Sentry non tagué** = on cherche les bugs à l'aveugle
- **Conversion drop > 5%** = signal d'alerte → rollback partiel (forcer `I18N_LOCALES_ACTIVE=fr` seulement)

---

## Phase 8 — Stabilisation (semaine 11)

> **But** : bug bash final, audit a11y/perf approfondi, documentation finale, post-mortem.

### Tâches

#### T8.1 — Bug bash 2h

| Champ | Valeur |
|---|---|
| Objectif | Session 2h équipe complète + fondatrice : naviguer le site en AR/EN, lister tout ce qui choque |
| DoD | Liste bugs/améliorations triée par sévérité, P0 fixés sous 24h, P1 sous 72h, P2 → backlog |
| Durée | 2 JH (session + fixes) |
| Dépendances | Phase 7 finie |
| Livrables | `docs/i18n-strategy-2026-05/11-test-execution/bug-bash-rapport.md` |
| Tests requis | Manual |

#### T8.2 — Audit a11y approfondi

| Champ | Valeur |
|---|---|
| Objectif | Audit manuel WCAG 2.1 AA sur 3 locales + lecteur d'écran |
| DoD | Score WCAG ≥ 95% sur les 3 locales, screen reader (NVDA + VoiceOver) lit l'AR correctement |
| Durée | 1.5 JH |
| Dépendances | T8.1 |
| Livrables | Rapport a11y `docs/i18n-strategy-2026-05/11-test-execution/audit-a11y.md` |
| Tests requis | Manual + axe |

#### T8.3 — Audit perf approfondi

| Champ | Valeur |
|---|---|
| Objectif | Mesurer impact bundle size + LCP/FID/CLS par locale |
| DoD | Bundle size delta < +15% (à cause messages JSON), LCP < 2.5s, CLS < 0.1 sur 3 locales |
| Durée | 1 JH |
| Dépendances | T8.1 |
| Livrables | Rapport perf `docs/i18n-strategy-2026-05/10-monitoring/audit-perf-post-deploy.md` |
| Tests requis | Lighthouse CI + WebPageTest |

#### T8.4 — Documentation finale

| Champ | Valeur |
|---|---|
| Objectif | Doc complète prête pour onboarding nouveau dev et translateur |
| DoD | 4 docs finalisés + relus : runbook ajout langue, runbook export/import, troubleshooting, FAQ |
| Durée | 1.5 JH |
| Dépendances | T8.1, T8.2, T8.3 |
| Livrables | `docs/i18n-strategy-2026-05/09-runbook/*` (4 fichiers) |
| Tests requis | Validation par lecteur externe (dev qui n'a pas participé) |

#### T8.5 — Post-mortem

| Champ | Valeur |
|---|---|
| Objectif | Retro projet i18n : qu'est-ce qui a bien marché, ce qui a foiré, leçons |
| DoD | Post-mortem template rempli, partagé en équipe, 3 actions concrètes pour le prochain sprint |
| Durée | 1 JH |
| Dépendances | T8.4 |
| Livrables | `docs/i18n-strategy-2026-05/00-context/post-mortem.md` |
| Tests requis | N/A |

### DoD globale Phase 8

- [x] Bug bash exécuté, P0 fixés
- [x] WCAG ≥ 95%
- [x] Perf budgets respectés
- [x] Doc finale validée
- [x] Post-mortem partagé

### Pièges à éviter Phase 8

- **Skipper stabilisation** "ça marche, on passe à autre chose" → tech debt et bugs en prod
- **Post-mortem accusatoire** — focus sur process, pas sur personnes
- **Pas de mesures perf** = on découvre que le site est lent dans 3 mois

---

## Tableau récapitulatif de toutes les tâches

| ID | Tâche | Phase | Durée (JH) | Owner |
|---|---|---|---|---|
| T0.1 | Relecture étude | P0 | 2 | Fondatrice + Lead |
| T0.2 | Réunion décision GO | P0 | 0.5 | Tous |
| T0.3 | Rédaction ADRs | P0 | 1.5 | Lead |
| T0.4 | Branche + tracking | P0 | 0.5 | Lead |
| T1.1 | Install next-intl | P1 | 0.5 | Dev |
| T1.2 | Middleware locale | P1 | 1.5 | Lead + Dev |
| T1.3 | Structure `[locale]` | P1 | 1 | Dev |
| T1.4 | Fichiers messages | P1 | 1 | Dev |
| T1.5 | LocaleSwitcher | P1 | 1 | Dev |
| T1.6 | E2E baseline | P1 | 1.5 | Dev + QA |
| T1.7 | Feature flag | P1 | 0.5 | Lead |
| T1.8 | Code review P1 | P1 | 0.5 | Lead |
| T2.1 | Audit strings | P2 | 2 | Dev |
| T2.2 | Script AST | P2 | 3 | Lead |
| T2.3 | Extract home | P2 | 1.5 | Dev |
| T2.4 | Extract maison | P2 | 1 | Dev |
| T2.5 | Extract kit | P2 | 2 | Dev |
| T2.6 | Extract rituel | P2 | 1 | Dev |
| T2.7 | Extract journal | P2 | 1.5 | Dev |
| T2.8 | Validation voix FR | P2 | 2 | Fondatrice + Dev |
| T2.9 | ESLint rule | P2 | 1.5 | Lead |
| T2.10 | Traduction EN | P2 | 2 | Translator EN + Dev |
| T3.1 | Repo getByLocale | P3 | 1 | Dev |
| T3.2 | UI Admin onglets | P3 | 2 | Dev |
| T3.3 | Migration data | P3 | 0.5 | Lead |
| T3.4 | Intégration frontend | P3 | 1.5 | Dev |
| T3.5 | Tests CMS multilang | P3 | 1 | Dev |
| T4.1 | Audit RTL | P4 | 1 | Dev |
| T4.2 | Refactor Tailwind | P4 | 2 | Dev |
| T4.3 | `<html dir>` dynamic | P4 | 0.5 | Dev |
| T4.4 | Font Cairo | P4 | 1 | Dev |
| T4.5 | Tests visuels RTL | P4 | 1.5 | QA + Dev |
| T4.6 | A11y RTL | P4 | 1 | QA |
| T5.1 | Export/import | P5 | 1.5 | Dev |
| T5.2 | Doc translateur | P5 | 1 | Lead |
| T5.3 | Traduction AR | P5 | 5 | Translator AR |
| T5.4 | Intégration AR | P5 | 1 | Dev |
| T5.5 | Validation native | P5 | 1 | Native speaker |
| T6.1 | Pyramide unit | P6 | 2 | Dev + QA |
| T6.2 | Pyramide integration | P6 | 1.5 | Dev |
| T6.3 | E2E 3 locales | P6 | 3 | QA |
| T6.4 | Visual regression | P6 | 1.5 | QA |
| T6.5 | A11y scans | P6 | 1 | QA |
| T6.6 | Lighthouse CI | P6 | 1 | Lead |
| T6.7 | Coverage gates | P6 | 0.5 | Lead |
| T6.8 | ESLint error | P6 | 0.5 | Lead |
| T6.9 | Boucle correction | P6 | 3 | Tous |
| T7.1 | Vercel feature flag | P7 | 0.5 | Lead |
| T7.2 | Snapshot DB | P7 | 0.5 | Lead |
| T7.3 | Canary 10% | P7 | 1.5 | Lead + QA |
| T7.4 | Canary 50% | P7 | 0.5 | Lead |
| T7.5 | Canary 100% | P7 | 0.5 | Lead |
| T7.6 | Sentry locale tag | P7 | 0.5 | Dev |
| T7.7 | Analytics locale | P7 | 0.5 | Dev |
| T7.8 | Plan rollback testé | P7 | 0.5 | Lead + QA |
| T8.1 | Bug bash | P8 | 2 | Tous |
| T8.2 | A11y approfondi | P8 | 1.5 | QA |
| T8.3 | Perf approfondi | P8 | 1 | Lead |
| T8.4 | Doc finale | P8 | 1.5 | Lead + Dev |
| T8.5 | Post-mortem | P8 | 1 | Tous |
| **Total** | **57 tâches** | — | **~75 JH** | — |

**Note** : 75 JH sur 11 semaines = ~6.8 JH/semaine de moyenne. Pic en phase 2 (~11 JH) et phase 6 (~14 JH). Plusieurs tâches en parallèle (translateur asynchrone notamment).

---

## Pièges transverses à éviter

### Pièges techniques

1. **Vouloir tout faire d'un coup** : migrer route par route, pas big-bang
2. **Sous-estimer l'extraction** : 600-800 strings = 2 semaines de travail réel (pas 3 jours)
3. **Casser le wizard CHA-231** : interdiction absolue de toucher `WizardDictionary` en phase 1-2-3
4. **Oublier `<html lang>` et `dir`** : impact SEO + a11y immédiat
5. **Cache stale** : revalidatePath / cache tag par locale, sinon contenu mixte
6. **Plugin Tailwind RTL** : ADR-005 dit NON, utiliser logical properties — éviter `tailwindcss-rtl` qui crée dette
7. **Translation auto sans review** : DeepL/Google brut sur AR = mauvaise qualité → publier seulement après review native
8. **Feature flag mal isolé** : centraliser dans `lib/feature-flags/i18n.ts` (cf. `feature-flags.md`)

### Pièges process

1. **Pas d'ADRs** : on revient sur les décisions à chaque phase
2. **Pas de glossaire** : drift terminologique (peau / skin / بشرة avec variantes incohérentes)
3. **Trop d'optimisme sur les durées** : multiplier par 1.3-1.5 pour absorber les imprévus
4. **Pas de canary deploy** : 0-to-100% = haut risque, rollback complet seul option
5. **Tests skip "temporairement"** : ne jamais skip sans ticket associé
6. **Documentation tardive** : écrire doc en fin = elle ne reflète pas la réalité

### Pièges UX

1. **Drapeaux dans le LocaleSwitcher** : ambigus pour AR (Maroc ? Algérie ? Égypte ?) — utiliser nom de langue natif
2. **Forcer locale via IP** : intrusif et faux pour utilisateur en voyage
3. **Pas de switcher visible** : utilisateur arrive en mauvaise langue et ne sait pas comment changer
4. **Switch locale perd le contexte** : doit garder la querystring et la page courante

### Pièges SEO

1. **Pas de hreflang** : Google sert la mauvaise version aux mauvais users
2. **Duplicate content** : la même URL FR et EN sans canonical → pénalité
3. **Sitemap pas multilangue** : Google ne découvre pas les versions traduites
4. **`/contact` redirige vers `/fr/contact`** mais pas en 308 → SEO juice perdu

---

## Conditions de Go / No-Go entre phases

Chaque transition de phase est conditionnée par les critères suivants. Un seul critère rouge = STOP, on ne passe pas à la phase suivante.

### Phase 0 → Phase 1

- [ ] 8 ADRs mergés sur master
- [ ] CR réunion décision GO signé
- [ ] Branche `feat/i18n-foundation` créée

### Phase 1 → Phase 2

- [ ] `/contact` en 3 locales fonctionnel
- [ ] Tests E2E baseline verts
- [ ] Feature flag testé en local
- [ ] Code review approuvé par lead

### Phase 2 → Phase 3

- [ ] 6 routes principales × 3 locales rendues
- [ ] ESLint rule en mode warn (au minimum)
- [ ] `messages/fr.json` validé fondatrice
- [ ] Aucune régression visuelle sur FR

### Phase 3 → Phase 4

- [ ] UI admin onglets opérationnelle
- [ ] Migration DB appliquée staging
- [ ] Démo fondatrice OK (créer composant AR via admin)
- [ ] 12 tests CMS verts

### Phase 4 → Phase 5

- [ ] Refactor Tailwind logical sans régression LTR
- [ ] `<html dir>` correct
- [ ] Visual regression LTR = 0 diff
- [ ] Visual regression RTL = baselines créées
- [ ] a11y RTL = 0 violation critique

### Phase 5 → Phase 6

- [ ] `messages/ar.json` 100% complet
- [ ] Validation native speaker AR-MA OK
- [ ] Workflow export/import testé roundtrip

### Phase 6 → Phase 7

- [ ] ~250 tests verts dont 0 flaky
- [ ] Coverage gates respectés
- [ ] Lighthouse CI vert sur 3 locales
- [ ] ESLint rule en error mode
- [ ] Rapport boucle correction signé

### Phase 7 → Phase 8

- [ ] Canary 100% pendant 72h sans incident
- [ ] Sentry tagué locale
- [ ] Rollback testé chronométré ≤ 5 min
- [ ] Métriques conversion stables (±5%)

### Phase 8 → Fin projet

- [ ] Bug bash exécuté, P0/P1 fixés
- [ ] WCAG ≥ 95%
- [ ] Perf budgets respectés
- [ ] Doc finale relue par dev externe
- [ ] Post-mortem partagé en équipe

---

## Annexe — Charge ressources par semaine

| Sem | Fond | Lead | Dev | Trans AR | Trans EN | QA |
|---|---|---|---|---|---|---|
| S0 | 4h | 8h | 0h | 0h | 0h | 0h |
| S1 | 2h | 16h | 24h | 0h | 0h | 4h |
| S2 | 2h | 8h | 32h | 0h | 0h | 6h |
| S3 | 4h | 8h | 28h | 0h | 8h | 4h |
| S4 | 2h | 12h | 24h | 0h | 0h | 4h |
| S5 | 4h | 8h | 24h | 0h | 0h | 6h |
| S6 | 1h | 4h | 28h | 0h | 0h | 12h |
| S7 | 4h | 4h | 16h | 32h | 0h | 4h |
| S8 | 0h | 8h | 24h | 0h | 0h | 24h |
| S9 | 1h | 8h | 24h | 0h | 0h | 24h |
| S10 | 2h | 16h | 12h | 0h | 0h | 16h |
| S11 | 4h | 8h | 12h | 0h | 0h | 8h |
| **Total** | **30h** | **108h** | **248h** | **32h** | **8h** | **112h** |

**Total cumulé : ~540 heures sur 11 semaines = ~14 semaines-personne** (cohérent avec 75 JH estimés en tâches + overhead réunions/review).

---

## Suivi exécution

Pendant l'exécution, mettre à jour ce document avec :

| Élément | Lieu de tracking |
|---|---|
| Statut tâches | Outil PM (Linear / JIRA) avec ID `T<phase>.<n>` |
| Bugs trouvés | GitHub Issues avec label `i18n` |
| Décisions runtime | ADRs additionnels `docs/adr/i18n/00XX-*.md` |
| KPIs déploiement | Dashboard `docs/i18n-strategy-2026-05/10-monitoring/` |
| Post-incidents | `docs/i18n-strategy-2026-05/00-context/post-mortem.md` |

---

## Liens utiles

- [`README.md`](./README.md) — TL;DR
- [`checklist.md`](./checklist.md) — Checklists exhaustives
- [`rollback.md`](./rollback.md) — Procédures rollback
- [`feature-flags.md`](./feature-flags.md) — Feature flags
- [`gantt.puml`](./gantt.puml) — Gantt visuel
- [`risk-matrix.csv`](./risk-matrix.csv) — Risques
- [`../11-test-execution/`](../11-test-execution/) — Boucle correction tests
- [`../09-runbook/`](../09-runbook/) — Runbooks opérationnels
