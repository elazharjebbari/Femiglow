# ADR-0003 — Harnais de parité mock/live via MSW au niveau réseau

- **Statut** : Proposé (recommandation structurante de l'audit)
- **Date** : 2026-05-29

## Contexte

La cause racine systémique du décalage test↔réalité (cf. axe `process`, `debogabilite`, et `BUG-010/011`) est que les tests **mockent au mauvais niveau** : `vi.mock()` remplace des modules entiers et des doublures (`DryRunSocialPublishingAdapter`, templates déterministes) qui **ne reflètent pas la forme réelle des réponses** des services externes (OpenAI images, Higgsfield async submit+poll, Postiz). Résultat : un test passe sur une fiction qui diverge du live. `msw` (2.14.2) est **déjà installé** mais son usage de parité n'est pas en place.

## Décision

Mettre en place un **harnais de parité mock/live** :

1. **Mock au niveau RÉSEAU avec MSW** : intercepter les vrais endpoints (`api.openai.com/v1/images/generations`, `platform.higgsfield.ai/v1/text2image|image2video|requests/{id}/status`, `POSTIZ/api/public/v1/{integrations,posts,upload}`) avec des **handlers fidèles aux contrats** (`05_test-strategy/msw-contracts.md`), couvrant **nominal + erreurs**.
2. **Mêmes scénarios, deux modes** : chaque parcours opérateur (`playwright-journeys.md`) s'exécute identiquement avec `MODE=mock` (MSW actif) et `MODE=live` (services réels, comptes de test/draft), via un **drapeau unique**.
3. **Détecteur de divergence** : un *contract test* compare la **forme** des réponses mock et live (schéma zod partagé) ; toute divergence échoue le CI. Les fixtures live sont rafraîchies périodiquement (golden contracts).
4. **Interdiction du mock qui masque le live** : proscrire `vi.mock` des modules de provider au profit de MSW ; les adapters publication exposent le **même contrat** en dry-run et postiz.

## Conséquences

- ✅ Un test vert devient une **preuve** de comportement, pas une fiction.
- ✅ La parité mock/live (DoD globale) devient **mesurable et automatique**.
- ⚠️ Coût initial : écrire les handlers MSW + fixtures + le détecteur de divergence.
- ⚠️ Le mode live de test nécessite des **comptes/credentials de test dédiés** (jamais les comptes clients) — cf. ADR-0005.

## Alternatives écartées

- **Continuer en `vi.mock`** : reproduit la cause racine.
- **Tests live uniquement** : lents, coûteux, dépendants d'APIs tierces, risque de publication réelle.
