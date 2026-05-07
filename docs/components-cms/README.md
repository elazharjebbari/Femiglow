# Components-CMS — README

> Extension du **Component-Media System** (cf. `docs/component-media-system/`)
> à **toute la donnée éditoriale** d'un composant : titres, descriptions,
> CTA, kickers, citations, listes, icônes, tokens couleur, liens, et tout
> élément structuré porté par un composant React.
>
> Objectif : permettre à la fondatrice (et à un futur rédacteur·trice) de
> **modifier le contenu d'un composant depuis l'admin** — texte, icônes,
> tout — sans PR ni redeploy, avec preview, validation, brouillon /
> publication, et un audit complet.

## Pourquoi cette extension

Aujourd'hui le système couvre les **medias** (images, vidéos) liés aux
slots d'un composant. Le **texte** et les **éléments structurés**
(CTA, kickers, citations, icônes, listes éditoriales) restent codés en
dur dans les composants RSC ou récupérés depuis des fichiers `.ts` :

```tsx
// apps/web/src/components/sections/Hero.tsx — état actuel
<Heading as="h1" size="xl">
  Le rituel du soir, en cinq minutes.
</Heading>
<Text size="lg">
  Une routine douce, pensée pour les peaux pressées et fatiguées.
</Text>
<CTA href="/rituel">Découvrir le rituel</CTA>
```

Chaque ajustement éditorial nécessite donc :

1. un PR,
2. une review,
3. un déploiement,
4. la coordination avec un dev.

Ce système supprime ces 4 étapes pour la fondatrice. Le code reste
le code (composants typés, RSC, performants), mais **les valeurs
éditoriales deviennent du contenu géré**.

## Principes directeurs

1. **Type-safety bout en bout** — chaque champ est déclaré dans le
   registre TS, validé par Zod, et exposé typé au RSC.
2. **Cascade prévisible** — registre `defaultValue` ▸ binding DB
   (publié) ▸ surcharge de page (futur). Chaque niveau est testé.
3. **Drafts et publication** — toute modification crée un brouillon.
   Publication explicite (action séparée). Programmation possible.
4. **Audit append-only** — chaque modification est historisée, on peut
   revenir à la version N-1 d'un click.
5. **Rendu RSC inchangé** — la route reste serveur, cache `unstable_cache`
   avec tag `components`, invalidation à chaque publication.
6. **Admin ergonomique** — éditeur par-champ adapté au type
   (texte, rich-text, CTA, icône, token couleur, …), preview live,
   sauvegarde optimiste.
7. **Évolutif vers i18n** — le modèle porte `locale` dès le jour 1
   (défaut `'fr'`), prêt à recevoir `'en'`, `'ar'`, etc.
8. **MSW partout** — chaque flux admin a un handler MSW, chaque
   composant un fichier de scénarios.
9. **Zero-magie** — pas de RHF, pas de Zustand cachés ; on étend les
   patterns déjà en place (zod, server actions, RTL, Vitest).
10. **Migration progressive** — composant par composant, page par page.
    Tant qu'un champ n'est pas migré, le rendu fallback sur la valeur
    codée. Aucun big-bang.

## Architecture en 1 minute

```
┌────────────────────────────────────────────────────────────────────────┐
│  Composant React (RSC)                                                  │
│                                                                          │
│   <ComponentField componentKey="home-hero" fieldKey="title" />           │
│   <ComponentField componentKey="home-hero" fieldKey="cta" />             │
│   <ComponentMedia componentKey="home-hero" slot="primary"  />            │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │ resolveComponentFields()
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│  cascade : registry default ▸ binding (status='published')               │
│                                                                          │
│   componentFieldBindings ──┐                                             │
│                            │                                             │
│                            ├─► (fieldKey, locale, value)                 │
│                            │                                             │
│   componentFieldHistory ───┘  (append-only, versioning)                  │
└────────────────────────────────────────────────────────────────────────┘
                  ▲ RPC POST/PATCH                       ▲ revalidateTag
                  │                                      │
                  │                              ┌───────┴────────┐
                  │                              │ cache          │
                  │                              │ unstable_cache │
                  │                              │ tag=components │
                  │                              └────────────────┘
                  │
┌─────────────────┴────────────────────────────────────────────────────────┐
│  Admin /admin/components/[key]                                            │
│                                                                            │
│  ┌─────────────┐  ┌────────────┐  ┌─────────────┐  ┌──────────┐           │
│  │ Champs      │  │ Médias     │  │ Animations  │  │ Aperçu   │           │
│  │ (texte,     │  │ (slots)    │  │ (profils)   │  │ (iframe  │           │
│  │  CTA, …)    │  │            │  │             │  │  live)   │           │
│  └─────────────┘  └────────────┘  └─────────────┘  └──────────┘           │
│                                                                            │
│  • Save optimiste + dirty tracking                                         │
│  • Brouillon ↔ Publié                                                      │
│  • Diff vs publié                                                          │
│  • Historique 30 jours, restauration 1-click                               │
└────────────────────────────────────────────────────────────────────────────┘
```

## Index

### Architecture

| # | Fichier | Sujet |
|---|---------|-------|
| A1 | [architecture/01-overview.md](architecture/01-overview.md) | Vision système, contraintes, non-goals |
| A2 | [architecture/02-data-model.md](architecture/02-data-model.md) | Tables, types, ERD |
| A3 | [architecture/03-cascade-and-resolution.md](architecture/03-cascade-and-resolution.md) | Cascade default ▸ binding, edge cases |
| A4 | [architecture/04-versioning-and-drafts.md](architecture/04-versioning-and-drafts.md) | Statuts, history, scheduling |
| A5 | [architecture/05-i18n-readiness.md](architecture/05-i18n-readiness.md) | Locale, futur multilingue |
| A6 | [architecture/06-rbac-audit.md](architecture/06-rbac-audit.md) | Permissions, audit log |

### Design

| # | Fichier | Sujet |
|---|---------|-------|
| D1 | [design/01-principles.md](design/01-principles.md) | Principes UX |
| D2 | [design/02-information-architecture.md](design/02-information-architecture.md) | Hiérarchie, navigation admin |
| D3 | [design/03-ui-patterns.md](design/03-ui-patterns.md) | Patterns d'éditeur, save flow |
| D4 | [design/04-style-guide.md](design/04-style-guide.md) | Tokens couleur, typographie, spacing |
| D5 | [design/05-accessibility.md](design/05-accessibility.md) | WCAG AA, claviers, lecteurs |
| D6 | [design/06-wireframes.md](design/06-wireframes.md) | Wireframes ASCII des écrans clés |

### Frontend

| # | Fichier | Sujet |
|---|---------|-------|
| F1 | [frontend/01-field-editor-registry.md](frontend/01-field-editor-registry.md) | Registry d'éditeurs par type |
| F2 | [frontend/02-rsc-helpers.md](frontend/02-rsc-helpers.md) | `<ComponentField>`, `resolveComponentFields` |
| F3 | [frontend/03-form-engine.md](frontend/03-form-engine.md) | State, dirty tracking, save |
| F4 | [frontend/04-live-preview.md](frontend/04-live-preview.md) | iframe + postMessage |

### Backend

| # | Fichier | Sujet |
|---|---------|-------|
| B1 | [backend/01-api-routes.md](backend/01-api-routes.md) | Routes REST, payloads |
| B2 | [backend/02-zod-validation.md](backend/02-zod-validation.md) | Schémas, sanitization |
| B3 | [backend/03-cache-revalidation.md](backend/03-cache-revalidation.md) | unstable_cache, tags |
| B4 | [backend/04-seed-pipeline-extensions.md](backend/04-seed-pipeline-extensions.md) | Seed des valeurs default |

### Testing

| # | Fichier | Sujet |
|---|---------|-------|
| T1 | [testing/01-strategy.md](testing/01-strategy.md) | Pyramide, cible de coverage |
| T2 | [testing/02-vitest-unit.md](testing/02-vitest-unit.md) | Patterns unitaires |
| T3 | [testing/03-msw-handlers.md](testing/03-msw-handlers.md) | Setup, handlers |
| T4 | [testing/04-rtl-component.md](testing/04-rtl-component.md) | Tests RTL des éditeurs |
| T5 | [testing/05-playwright-e2e.md](testing/05-playwright-e2e.md) | Parcours admin e2e |
| T6 | [testing/06-component-scenarios.md](testing/06-component-scenarios.md) | Matrice scénarios par composant |

### Runbook

| # | Fichier | Sujet |
|---|---------|-------|
| R1 | [runbook/01-bootstrap.md](runbook/01-bootstrap.md) | Mise en place initiale |
| R2 | [runbook/02-add-field.md](runbook/02-add-field.md) | Ajouter un champ à un composant |
| R3 | [runbook/03-add-component.md](runbook/03-add-component.md) | Ajouter un nouveau composant |
| R4 | [runbook/04-rollout.md](runbook/04-rollout.md) | Déploiement par page-group |
| R5 | [runbook/05-incident-response.md](runbook/05-incident-response.md) | Pannes, rollback |

### Plan d'action

| # | Fichier | Sujet |
|---|---------|-------|
| P1 | [action-plan/01-phases.md](action-plan/01-phases.md) | 12 phases, livrables |
| P2 | [action-plan/02-tasks.md](action-plan/02-tasks.md) | Décomposition tâches |
| P3 | [action-plan/03-risks.md](action-plan/03-risks.md) | Registre des risques |
| P4 | [action-plan/04-acceptance.md](action-plan/04-acceptance.md) | Critères d'acceptance |

### Catalogue

| # | Fichier | Sujet |
|---|---------|-------|
| C1 | [catalog/_template.md](catalog/_template.md) | Template fiche composant |
| C2 | [catalog/home-hero.md](catalog/home-hero.md) | Champs `home-hero` |
| C3 | [catalog/home-avis-strip.md](catalog/home-avis-strip.md) | Champs `home-avis-strip` |
| C4 | [catalog/maison-cross-links.md](catalog/maison-cross-links.md) | Champs `maison-cross-links` |
| C5 | [catalog/journal-article.md](catalog/journal-article.md) | Champs articles journal |

## Glossaire express

- **Composant** : entité du registre `siteComponents` (ex `home-hero`).
- **Slot** : emplacement d'un média (existant, cf. `component-media-system`).
- **Champ** (*field*) : donnée éditoriale typée d'un composant
  (titre, sous-titre, CTA, …). Nouveau dans cette extension.
- **Field binding** : valeur courante d'un champ pour un composant
  (ligne en DB, statut `draft` / `published` / `scheduled`).
- **Field history** : trace append-only de toutes les versions d'un
  binding. Permet de rollback.
- **Cascade** : ordre de résolution d'un champ pour le rendu.
- **Locale** : code BCP-47 ; défaut `fr`. Champ présent dès le jour 1.
- **Editor** : composant React qui édite un champ d'un type donné
  (TextEditor, RichTextEditor, CtaEditor, IconEditor, …).
- **Preview iframe** : `/admin/components/[key]/preview?draft=…` rendu
  RSC servi avec les valeurs *draft* plutôt que *published*.
