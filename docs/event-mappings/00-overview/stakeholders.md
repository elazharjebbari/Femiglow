# 00.5 — Stakeholders

## Owner principal

| Rôle | Responsabilité |
|---|---|
| **Tech Lead FemiGlow** | Approuve les ADRs, valide les PRs, signe les Go/No-Go milestone |

## Stakeholders projet

| Rôle | Implication | Cadence |
|---|---|---|
| **Marketing (Sara — Google Ads/Meta)** | Valide la microcopy, fournit les noms custom events attendus, teste l'UX | Hebdomadaire pendant le dev |
| **Dev Backend** | Implémente migrations, services, routes, dispatcher refactor | Full-time pendant phases 1-3 |
| **Dev Frontend** | Implémente UI, intégration admin, tests Playwright | Full-time pendant phases 4-5 |
| **QA** | Valide la test matrix, sign-off avant prod | Phase 6 |
| **Ops / SRE** | Valide le runbook deploy/rollback, smoke prod | Phase 7 |
| **Sécurité / Legal** | Valide audit log + scope RGPD (no PII dans mappings) | One-shot review en phase 1 |

## Personas utilisateurs

### Persona 1 — Sara, Marketing Manager

- **Profil** : 32 ans, gère les pixels Meta/Google Ads pour FemiGlow
- **Mission** : optimiser ROAS, créer audiences Lookalike, ajouter nouveaux events sans dépendre du dev
- **Goals dans la console mappings** :
  - Renommer un Meta CustomEvent quand campagne change
  - Ajouter un nouvel event vendor (ex : TikTok `OptimizedLead`)
  - Voir l'historique des changements (qui a changé quoi, quand)
  - Exporter le mapping pour importer dans GTM Web
- **Frustrations actuelles** : doit demander un PR à chaque modif, attente 24-48h
- **Niveau technique** : moyen (comprend les vendors et leur taxonomy mais pas SQL)

### Persona 2 — Karim, Dev Backend FemiGlow

- **Profil** : ingé full-stack, focus tracking + analytics
- **Mission** : maintient la chaîne tracking, ajoute nouveaux events au catalog
- **Goals dans la console** :
  - Vérifier que le default est sync avec son `event-mapping.ts`
  - Inspecter l'audit log pour debug
  - Exporter une version pour comparaison hors ligne
- **Frustrations actuelles** : pas de visibilité sur ce que marketing a "configuré" dans GTM UI (boîte noire)
- **Niveau technique** : élevé (lit le code source, comprend Drizzle, etc.)

### Persona 3 — Yasmine, Visiteur du site

- **Profil** : cliente potentielle, navigue sur `/kit`
- **Mission** : commander un kit, sans friction
- **Goals indirects** : que le tracking serveur fonctionne sans casser la perf perçue (LCP < 2s sur /kit)
- **Risque** : si les mappings sont incorrects → vendors reçoivent des events bizarres → optimisations algo dégradées → moins de visibilité pub → moins de clients
- → Ce projet impacte indirectement son UX via la qualité tracking

## Comm

### Canal Slack
- `#dev` — questions techniques pendant le dev
- `#marketing-tech` — réunion hebdo statut + démo
- `#ops` — alertes deploy/rollback

### Réunions clés
- **Kickoff** (J-7) : 1h, valider les ADRs avec Tech Lead + Marketing
- **Demo milestone M3** (~J+10) : 30 min, Sara + Tech Lead — décide Go/No-Go vers prod
- **Post-deploy** (J+1) : 30 min, retour expérience + ajustements

### Documentation à fournir aux stakeholders externes
- **Sara** : `50-ui-ux-design/microcopy.csv` + maquettes ASCII `wireframes/`
- **Tech Lead** : `10-architecture/adr-*.md` + `20-data/schema.txt`
- **Ops** : `80-runbook/deployment.md` + `80-runbook/rollback.md`
- **QA** : `70-tests/test-matrix.csv` + `70-tests/e2e-scenarios.md`
