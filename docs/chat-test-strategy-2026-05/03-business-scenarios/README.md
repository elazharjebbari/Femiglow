# Business scenarios — parcours métier réalistes

Scénarios bout-en-bout qui couvrent la **vraie utilisation** du chat. Servent de base aux
tests Playwright `business-scenarios/BS01–BS10.spec.ts`.

## Pourquoi ces scénarios

Ils complètent les tests unitaires / component / intégration en validant que **l'expérience
réelle** des personas (visiteur / opérateur) fonctionne. Inspirés de l'audit + audit-précédent :

- Conversion (P1 + P4 + P5 funnel)
- Frustration et capture de lead
- Multilingue (darija critique pour MA)
- Résilience pannes (ADR-004)
- Opérations admin
- RGPD
- Budget exhausted
- Tools recall (futur, ADR-002)

## Liste des 10 scénarios

| ID | Titre | Persona | Couvre F | Tag |
|----|-------|---------|----------|-----|
| BS01 | Conversion FR — visiteur curieux → lead | Visiteur | F01, F08, F11, F33 | @critical |
| BS02 | Frustration FR — 2 messages → lead form auto | Visiteur | F08, F11, F33 (rule 4) | @critical |
| BS03 | Conversion darija — Salam → commande | Visiteur | F53, F08, F11 | @critical |
| BS04 | Panne provider primary → fallback Anthropic | Visiteur | F31 | @critical |
| BS05 | Admin publie un nouveau canned pair | Admin | F48 | @critical |
| BS06 | Admin rotate provider (OpenAI → Gemini) | Admin | F45, F31 | @critical |
| BS07 | RGPD — visiteur demande oubli | Visiteur | F16, F54 | @critical |
| BS08 | Multilingue handover — switch FR → AR-MA mid-conv | Visiteur | F03, F53 | @critical |
| BS09 | Budget exhausted — visite arrive en CANNED_ONLY | Visiteur | F35 (futur ADR-004) | @critical |
| BS10 | Tools recall — visiteur demande statut commande | Visiteur | F58 (futur ADR-002) | @critical |

## Format de chaque scénario

Chaque fichier contient :
- **Contexte business** (pourquoi ce parcours est important)
- **Personas et état de départ**
- **Étapes détaillées** (Gherkin)
- **Critères de validation** (assertions concrètes)
- **Données de test** (fixtures, seeds)
- **Risques couverts** (mapping audit)

## Exécution

```bash
pnpm exec playwright test e2e/business-scenarios/  # tous
pnpm exec playwright test e2e/business-scenarios/BS01  # 1 spécifique
pnpm exec playwright test --grep @business-scenario  # via tag
```

## Lien avec le plan d'exécution

Voir [04-execution-plan/04-phase-4-e2e-business-scenarios.md](../04-execution-plan/04-phase-4-e2e-business-scenarios.md).
