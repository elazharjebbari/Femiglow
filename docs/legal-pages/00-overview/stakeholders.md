# 00.4 — Stakeholders & responsabilités

| Rôle | Personne / équipe | Responsabilité |
|---|---|---|
| Product Owner | Équipe FemiGlow | Décide quelles pages, valide le contenu final |
| Tech Lead | Dev backend | Architecture, ADR, code review |
| Dev Backend | (à attribuer) | Implémentation API, DB, link checker |
| Dev Frontend | (à attribuer) | Wizard, éditeur MD, rendering public |
| **Juriste** | **À identifier** | **Validation finale des contenus avant publication** |
| Marketing | Sara | Validation ton éditorial, variables (RC, ICE, adresse) |
| QA | (à attribuer) | Tests Playwright e2e, pipeline ultime |

## ⚠ Stakeholder critique : Juriste

Aucune page légale ne doit être publiée en production sans validation par
un juriste qualifié (avocat barreau de Rabat ou consultant juridique
e-commerce). Le templating est un **point de départ** uniquement.

### Process recommandé

1. Dev équipe implémente le système + seed 9 pages en `draft`
2. Marketing remplit les variables (RC, ICE, adresse, etc.)
3. Pages soumises en `review`
4. **Juriste consulté** : review chaque page, ajustements
5. Juriste signe le contenu (Word/PDF) → archivé
6. Admin clique "Publier"

Estimer le coût juriste : 2000-5000 MAD pour les 9 pages.

## RACI matrix

| Tâche | PO | Tech Lead | Dev BE | Dev FE | Marketing | Juriste | QA |
|---|---|---|---|---|---|---|---|
| Décisions ADR | A | R | C | C | I | I | I |
| Architecture DB | I | A | R | I | I | I | I |
| Wizards UI | A | C | I | R | C | I | I |
| Pré-rédaction contenu | A | I | I | I | R | C | I |
| **Validation contenu final** | A | I | I | I | R | **R** | I |
| Tests e2e | I | A | C | C | I | I | R |
| Déploiement | I | A | R | C | I | I | C |

## Communication

### Points de coordination obligatoires

1. **Avant kickoff** : validation budget juriste avec PO
2. **Après seed** : Marketing remplit les variables (RC, ICE) — bloqueur
3. **Après dev** : Juriste review (1-2 semaines délai)
4. **Avant publish** : Sign-off explicite Marketing + Juriste
5. **Après publish** : Notification stakeholders, archive contenu signé

### Fréquence

- Daily standup : non requis (chantier compact)
- Weekly review : oui, pour suivre l'avancement
- Sync juriste : 2 ou 3 sessions (kickoff, mid-review, sign-off)

## Risques humains

### R.H1 — Juriste indisponible

**Mitigation** : démarrer la recherche juriste **dès J0**. Backup : pages
restent en `draft` jusqu'à validation. Site fonctionnel sauf checkout
(qui requiert CGV publiées).

### R.H2 — Marketing pas en mesure de fournir RC/ICE

**Mitigation** : variables visibles dans l'éditeur en rouge, pages
non-publiables tant que `{{VAR}}` non-remplies (validation Zod).
