# 90.3 — Milestones macro

## Vue d'ensemble

```
Week 1-2 │█████ M0 + M1 backend
Week 2-3 │     █████ M1 + M2 frontend public + M5 content briefing
Week 3-4 │          █████ M2 + M3 admin
Week 4-5 │               █████ M3 + M4 + M5 juriste loop
Week 5-6 │                    █████ M6 QA + M5 publish
Week 6   │                         ███ M7 deploy
```

## M0 — Foundation
**Cible : 19 mai 2026**

### Critères d'acceptation
- [ ] 7 migrations appliquées sur staging
- [ ] Seed reproduisible (idempotent)
- [ ] Types TS centralisés sans circular dep
- [ ] Documentation `20-data/` à jour avec la réalité du code

### Indicateurs de succès
- 0 erreur migration en CI
- Coverage seed > 95% (toutes les valeurs requises présentes)

### Risques résiduels
- Renommage tables futur si modèle évolue (faible, schéma stable)

---

## M1 — Backend core
**Cible : 30 mai 2026**

### Critères d'acceptation
- [ ] `renderLegalMarkdown` testé sur 20+ cas dont XSS
- [ ] `publishPage` transactional, idempotent
- [ ] 12 routes API documentées (OpenAPI)
- [ ] RBAC vérifié sur toutes les routes admin
- [ ] sitemap.xml génère correctement

### Indicateurs de succès
- 100% des tests Jest backend pass
- p95 API < 200ms en local sur seed data

### Risques résiduels
- DOMPurify config trop stricte → page légale rendue cassée
- Solution : tests exhaustifs sur les 9 templates

---

## M2 — Public frontend
**Cible : 6 juin 2026**

### Critères d'acceptation
- [ ] `/legal/cgv` rend avec layout charte (Cormorant + Inter)
- [ ] Footer dynamique fonctionne sur 5 zones
- [ ] Cookie banner non bloquant, accessible
- [ ] Checkout consentement obligatoire pour submit
- [ ] axe : 0 violations sur les pages publiques
- [ ] Lighthouse a11y ≥ 95

### Indicateurs de succès
- LCP < 1.5s sur /legal/* (mobile)
- 0 CLS perceptible
- Score WCAG AAA pour body text

### Risques résiduels
- Refactor Footer existant peut casser d'autres pages
- Mitigation : tests visuels Storybook + e2e

---

## M3 — Admin frontend
**Cible : 19 juin 2026**

### Critères d'acceptation
- [ ] Wizard "Nouvelle page" complet (5 steps)
- [ ] Éditeur split-pane avec scroll sync
- [ ] Auto-save 30s + indicateur visuel
- [ ] Variables surlignées si manquantes
- [ ] Publish workflow : modal + checklist + tape "PUBLIER"
- [ ] Historique + restore opérationnel
- [ ] Health dashboard affiche les vrais chiffres
- [ ] axe + Lighthouse admin a11y ≥ 90

### Indicateurs de succès
- Time-on-task création page < 2 min (power user)
- Auto-save failure rate < 0.1%
- 0 race condition détectée en testing concurrent

### Risques résiduels
- CodeMirror lourd → bundle size
- Mitigation : code-split + lazy load

---

## M4 — Services secondaires
**Cible : 24 juin 2026** (peut slipper en V1.1)

### Critères d'acceptation
- [ ] Cron health s'exécute quotidiennement
- [ ] Git sync commit après chaque publish
- [ ] Chat assistant ne propose pas de slug inexistant
- [ ] /api/health/legal opérationnel

### Indicateurs de succès
- Cron < 60s pour 50 liens
- Git sync success rate > 99%

### Risques résiduels
- Git sync : SSH key management complexe
- Acceptable : reporter en V1.1 si bloqué

---

## M5 — Content + Legal review
**Cible : 25 juin 2026** (dépend du juriste)

### Critères d'acceptation
- [ ] 9 templates affinés au contexte FemiGlow
- [ ] Variables remplies en DB
- [ ] PDF d'approbation juriste pour les 9 pages archivé
- [ ] 9 pages avec status=`published`
- [ ] Cohérence inter-pages vérifiée

### Indicateurs de succès
- 0 incohérence détectée entre pages
- Juriste valide en < 5 jours par page
- Pas d'allers-retours > 2 sur une même page

### Risques résiduels (élevés)
- Juriste indisponible / lent
- Mitigations :
  - Briefer le juriste 4 semaines avant
  - Envoyer les pages au fil de l'eau
  - Identifier un juriste de back-up

---

## M6 — QA
**Cible : 26 juin 2026**

### Critères d'acceptation
- [ ] Coverage Jest > 85%
- [ ] 100% des 50+ scénarios tests passent
- [ ] Ultimate test passe sur 3 runs consécutifs
- [ ] Pas de flaky test
- [ ] axe + Lighthouse pass tous les écrans

### Indicateurs de succès
- 0 régression détectée en CI
- Suite Playwright complète < 10 min

### Risques résiduels
- Tests flaky sur opérations async (autosave, optimistic update)
- Mitigation : await explicites + retries

---

## M7 — Deploy + Monitoring
**Cible : 30 juin 2026 (LAUNCH)**

### Critères d'acceptation
- [ ] Migrations appliquées en prod sans erreur
- [ ] 9 pages live (200 + contenu correct)
- [ ] Footer, banner, checkout intégrés
- [ ] Health endpoint 200
- [ ] Sentry/PostHog reçoivent des events
- [ ] Slack alerts configurées et test ping OK
- [ ] Synthetic monitoring vert
- [ ] Communication équipe (Slack + email)

### Indicateurs de succès J+1
- 0 erreur 5XX legal en 24h
- 0 alerte Sentry critique
- Trafic /legal/* fluide

### Risques résiduels
- Régression cachée sous-tests
- Mitigation : canary deploy + monitoring serré J0+7

---

## Post-launch

### Semaine 1 (P1)
- Monitoring quotidien
- Patches éventuels (P1/P2 only, pas de feature)
- Feedback Maya en revue 1h le vendredi

### V1.1 (M+1, optionnel)
- Compléter les modules optionnels de M4
- PDF export juriste
- Bulk republish

### V2 (M+3, sur demande)
- 4-eyes workflow
- Multi-langue (arabe)
- Notifications inter-admins

---

## Définition de « DONE »

Chaque milestone est DONE quand :
1. Tous les critères d'acceptation sont cochés
2. Tous les tests CI verts
3. Revue par lead (tech ou produit) approuvée
4. Documentation à jour
5. Démo en interne réalisée
6. Pas d'item P1 ouvert
