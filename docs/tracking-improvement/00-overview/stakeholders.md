# 00.4 — Stakeholders & responsabilités

| Rôle | Personne / équipe | Responsabilité |
|---|---|---|
| Product Owner | Équipe FemiGlow | Définit les events business, valide la taxonomie |
| Tech Lead | Dev backend | Architecture, décisions ADR |
| Dev Backend | (à attribuer) | Implémentation Google Ads CAPI, dispatcher, API |
| Dev Frontend | (à attribuer) | Wizard GTM, dashboards analytics |
| Marketing | Sara | Mapping Google Ads conversion actions, KPIs cibles |
| Data / Analytics | Sara | Validation taxonomie events, rapports |
| QA | (à attribuer) | Tests Playwright e2e, validation pipeline ultime |
| SRE | (à attribuer) | Monitoring, alerting, déploiement |

## RACI matrix

| Tâche | PO | Tech Lead | Dev BE | Dev FE | Marketing | QA |
|---|---|---|---|---|---|---|
| Décisions ADR | A | R | C | C | I | I |
| Taxonomie events finale | R | C | I | I | C | I |
| Google Ads CAPI impl | I | A | R | I | I | C |
| Wizard GTM édition | I | A | C | R | I | C |
| Dashboards analytics | I | A | C | R | I | C |
| Tests e2e pipeline | I | A | C | C | C | R |
| Déploiement prod | I | A | R | C | I | C |

R = Responsible, A = Accountable, C = Consulted, I = Informed.

## Points de coordination critiques

1. **Customer ID Google Ads + OAuth refresh token** — Marketing doit fournir
   l'accès. Bloqueur pour chantier 1.
2. **Validation taxonomie events** — avant freeze, Marketing valide la liste
   des events `isConversion: true` et leur catégorie Google Ads.
3. **Tests sur compte Google Ads réel** — Marketing fournit un compte test
   ou un compte secondaire pour ne pas polluer les Conversion Actions de prod.
