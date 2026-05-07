# Parties prenantes

| Rôle | Responsabilité | Contact / approbation |
|---|---|---|
| **Sponsor** | Décision go/no-go, budget | Fondatrice FemiGlow |
| **Product owner** | Priorisation, validation parcours | Fondatrice FemiGlow |
| **Tech lead** | Architecture, revue ADR, gardien des invariants | équipe technique |
| **Dev frontend** | Implémentation `/admin/*`, design system | équipe technique |
| **Dev backend** | API `/api/admin/*`, webhook engine, DB | équipe technique |
| **DPO** | Validation conformité RGPD/loi 09-08 | délégué externe |
| **Partenaire CRM** | Réception webhook, validation format | équipe partenaire |
| **Hébergeurs** | SLAs Vercel + Neon | comptes établis |

## Approbations requises avant go-live

- [ ] Sponsor : sign-off final sur le parcours admin
- [ ] DPO : validation registre de traitement, déclaration CNDP
- [ ] Partenaire : test d'intégration webhook réussi sur 50 leads
- [ ] Tech lead : revue de tous les ADR + checklist invariants
- [ ] Sécurité : revue threat model et headers CSP
