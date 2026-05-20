# 02 — Vision, objectifs, KPI

## 1. Vision

Faire de la section « La composition » un **moment éditorial autonome** de la landing `/kit` : trois objets, trois gestes, trois sensations distinctes, lisibles d'un coup d'œil et explorables en profondeur. La section doit **densifier l'argument qualitatif** (matière, geste, sensation) sans déclencher de friction d'achat — toute la pression conversion reste dans le Hero et le bloc « Le pack ».

Trois principes :

1. **Pédagogie d'abord, pression nulle**. Aucun CTA conversion dans la section. Le seul lien est éditorial (`Lire le détail ↓` vers INCI).
2. **Sensation > description fonctionnelle**. Une phrase de sensation physique remplace tout superlatif (« tiède au contact », « glisse, ne grise pas », « la lumière revient »).
3. **L'éditeur pilote tout**. Phase 6 → nom, volume, description, sensation, image isolated, image contextuelle, ingrédients, certifications sont éditables depuis `/admin/kit/composition`. Plus de hardcode TS pour la rédaction.

## 2. OKR du plan

| Objectif | Indicateur | Cible 2026-Q3 |
|---|---|---|
| Compréhension de la composition | % visiteurs qui scrollent jusqu'à `section#composition-title` (proxy : visibility event) | ≥ 75 % des sessions /kit |
| Engagement card | Taux de clic sur `Lire le détail ↓` (toutes cards confondues) | ≥ 8 % des sessions atteignant la section |
| Interaction contextuelle | Taux de hover ou tap déclenchant le crossfade isolated → contextual (Phase 3 livrée) | ≥ 20 % des sessions desktop, ≥ 10 % mobile |
| Couverture tests | Lignes couvertes par les tests dans `components/sections/Composition*` + `components/kit/CompositionCard.tsx` | ≥ 90 % |
| Latence rendu | Time-to-paint de la section après scroll dans le viewport (P95) | < 200 ms |
| A11y | Axe violations sur `/kit` après phase 4 | 0 |
| Régression | Tests E2E composition passants en CI | 100 % stable (0 flake) |
| Adoption éditeur | Nombre de modifications de la composition via l'admin (post phase 6) sur 30 j | ≥ 5 modifications (proxy d'usage réel) |

## 3. Principes de design

### 3.1 Backend / data

- **Schema Zod source de vérité.** Toute extension passe par `subProductSchema` + tests dédiés.
- **Champs additifs et rétrocompatibles.** `sensation`, `contextualImage`, `accentColor` sont optionnels. Le mock fonctionne sans les remplir.
- **Pas de DB ajoutée à court terme.** Phase 6 utilise le système Component-Fields existant (déjà présent dans `/admin/components`) pour persister les overrides.
- **Validation au bord uniquement.** Les API admin (phase 6) valident en input via Zod, jamais les composants de rendu.

### 3.2 Frontend public

- **`CompositionCard` dédié.** Extrait de `ProductCard` pour découpler les évolutions. `ProductCard` n'est plus utilisé après extraction (à supprimer avec circonspection en phase 8).
- **Animations sous 600 ms.** `whileInView` + `once: true` Framer Motion. Pas d'observer global.
- **Image contextuelle robuste mobile.** Pas de dépendance au hover. Alternance par défaut + bouton lever.
- **Aucun JS critique above-the-fold.** La section composition est below-the-fold ; lazy-load des Framer Motion via `dynamic()` si poids constaté > 30 kb.

### 3.3 Admin (phase 6)

- **Formulaire séquentiel, pas onglets.** Tout l'éditeur tient dans un scroll vertical avec sections collapsibles.
- **Aperçu temps réel.** À droite (desktop) un mini-render de la card en cours d'édition.
- **Save = draft, Publish = live.** Distinction explicite, audit log à chaque action.
- **Réutilisation patterns admin existants.** Médiapicker, Linter, AuditLogPanel (livrés dans `docs/seo-action-plan-2026-05/`).

### 3.4 Tests

- **Pyramide classique** : ~70 % unit, ~20 % MSW integration, ~10 % E2E.
- **Test-first** sur les fonctions pures (`buildCardCopy`, schema validation, parsing accentColor).
- **Snapshot DOM** côté Vitest pour figer la structure, côté Playwright pour figer le rendu visuel.
- **Test E2E sur 3 parcours** : visite section + lecture détail, hover crossfade (desktop), navigation clavier (a11y).

## 4. Anti-objectifs

Ce plan **ne** vise **pas** à :

- Vendre les sous-produits séparément. Aucun CTA achat dans la section (cohérent avec §4.3 anti-pattern « pas de pricing dans la composition »).
- Refaire l'INCI. La section `IngredientsDetails` reste inchangée, hors scope.
- Implémenter Sanity. Le mock reste source court terme.
- Introduire un nouveau système de design tokens. On utilise la palette Annexe A existante.
- Ouvrir l'édition à plus de 4 sous-produits. Le contrat reste 3 cards (anti-pattern §4.3).

## 5. Critères de succès global

Plan livré quand :

1. Tous les findings P0-P3 fermés en production.
2. Couverture tests `Composition*` ≥ 90 %.
3. Audit Axe 0 violations sur `/kit#composition-title`.
4. Snapshot E2E Playwright stable 7 j consécutifs en CI.
5. Un éditeur non-développeur publie une modification de la composition via `/admin/kit/composition` en < 90 s sans aide.
6. Le commit de référence `feat(composition): refonte Kolenda v2` mergé sur main avec PR review approuvée.

## 6. Gouvernance

- **Décideur produit** : Elazhar Jebbari.
- **Implémentation** : Claude Code en mode autonomous phases (cf. mémoire `feedback_autonomous_phases`).
- **Validation** : runbook complet + smoke prod + revue KPIs à J+7 et J+30.
- **Rollback** : `git revert` par phase + feature flag `NEXT_PUBLIC_COMPOSITION_V2` (default `false` en staging, `true` en prod après J+7).
