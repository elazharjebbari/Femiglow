# Geo Promo Slide Header - Dossier de conception et plan d'action

Date: 2026-05-18  
Perimetre obligatoire: `/var/www/femiglow-leads-webhook-multi-step`  
Serveur cible du chantier: staging actuel uniquement, aucune mise en production directe.

## Objectif

Mettre en place sur `/kit` uniquement un sticky slide header promotionnel, actionnable et admin-editable, capable d'afficher un message contextualise court du type:

> Offre du 18 mai - Casablanca

Le composant doit maximiser la conversion sans abimer la charte FemiGlow: pas de promotion criarde, pas de compteur d'urgence, pas de rouge liquidation, pas de mouvement permanent. Le signal fort doit venir d'un message tres court, de tags de reassurance bien hierarchises, d'icones de haut calibre, de la personnalisation locale, d'un mouvement bref et d'une integration premium.

## Livrables du dossier

1. [Synthese executive](./00-synthese-executive.md)
2. [Principes Kolenda et strategie conversion](./01-kolenda-conversion.md)
3. [Architecture cible](./02-architecture-cible.md)
4. [Backend, geolocalisation et API](./03-backend-geolocalisation-api.md)
5. [Data model et admin settings](./04-data-admin-settings.md)
6. [Frontend, UI, UX et design system](./05-frontend-ui-ux-design.md)
7. [Plan de developpement](./06-plan-de-developpement.md)
8. [Plan de tests Vitest, MSW et Playwright](./07-plan-tests.md)
9. [Plan d'action detaille](./08-plan-action-detaille.md)
10. [Runbook staging](./09-runbook-staging.md)

## Decision recommandee

Le projet etant actuellement observe sur VPS/LiteSpeed, la voie recommandee est:

- Cloudflare devant le domaine staging.
- Activation de `Add visitor location headers`.
- Lecture defensive des headers Cloudflare dans une route Next.js privee.
- Abstraction interne permettant d'ajouter Vercel plus tard sans refaire le composant.
- Injection frontend apres hydration sur `/kit` uniquement pour eviter de rendre toute la page marketing dynamique et pour eviter les risques de cache partage par ville.

Le composant public doit etre gere via le systeme existant de composants/admin quand c'est possible, avec une cle dediee `global-promo-slide-header`. Un module admin specialise ne doit etre ajoute que pour la preview, les raccourcis editoriaux ou les validations avancees.

## Regle de chantier

Tout le code, toutes les migrations, tous les tests et toutes les validations de ce chantier doivent etre executes depuis:

```bash
cd /var/www/femiglow-leads-webhook-multi-step
```

Le chantier doit rester isole du checkout principal jusqu'a validation staging complete.
