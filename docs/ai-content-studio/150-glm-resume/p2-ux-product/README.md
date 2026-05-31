# P2 — UX Produit : Actions de review, Brief éditeur, Calendrier, Notes, UTM, Analytics

**Serveur** : staging.femiglow-maroc.com (`/var/www/femiglow-staging`)
**Branche** : master
**Environnement** : `apps/web/`
**Prérequis** : P1 stabilisation terminé (9 commits, 126 tests, monolithe 1567→203 lignes)

---

## Objectif P2

Transformer le prototype fonctionnel (P0+P1) en outil de production utilisable par l'équipe éditoriale :
- Actions de review complètes (rejeter, variation, annuler schedule, archiver)
- Brief éditeur modifiable avant génération
- Calendrier éditorial interactif (vue semaine/mois, filtres)
- Notes d'apprentissage + tags winner/loser
- Builder UTM automatique
- Dashboard analytics basique
- Robustesse API (validation Zod côté client, idempotence, budget tracking)

## Sous-dossiers

| Dossier | Contenu |
|---------|----------|
| `conception/` | Architecture, modèle de données, schémas Zod, state machine |
| `plan-dev/etapes.md` | Étapes de développement détaillées avec code |
| `plan-action/checklist.md` | Checklist de fichiers impactés par tâche |
| `tests/strategie-tests.md` | Stratégie de tests (vitest, MSW, Playwright) |
| `runbook/execution.md` | Runbook pas-à-pas pour exécuter le plan |

## Phases

| Phase | Description | Durée estimée |
|-------|-------------|---------------|
| P2.1 | Actions de review (reject, variation, cancel, archive) | 1 jour |
| P2.2 | Brief éditeur + validation Zod client | 0.5 jour |
| P2.3 | Calendrier éditorial interactif | 1 jour |
| P2.4 | Notes d'apprentissage + tags + UTM | 1 jour |
| P2.5 | Dashboard analytics + santé Postiz | 0.5 jour |
| P2.6 | Budget tracking + idempotence | 0.5 jour |
| P2.7 | Pages séparées + navigation | 1 jour |
| P2.8 | Tests E2E Playwright + MSW étendu | 1 jour |

## Principes

- Tout le code est sur le serveur staging (`/var/www/femiglow-staging/apps/web`)
- Chaque étape est commitée séparément avec message descriptif
- Les tests sont écrits AVANT ou EN MÊME TEMPS que le code (TDD)
- Le code est robuste, fiable, maintenable, non-régressif, modulaire et fonctionnel
- La state machine est la source de vérité pour les transitions
- Les schémas Zod valident côté client ET côté serveur
- Les erreurs API retournent du JSON structuré (`HttpError` avec code + message)