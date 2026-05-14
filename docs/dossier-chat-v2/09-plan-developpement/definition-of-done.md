# Definition of Done — Par type de ticket

> Un ticket "Done" ne ferme jamais sur "ça marche chez moi". DoD = checklist objective. Un ticket non-Done bloque le sprint demo.

## DoD universelle (toutes catégories)

- [ ] Code mergé dans `master` (pas en feature branch).
- [ ] PR a au moins 1 approval reviewer.
- [ ] CI verte (lint, type-check, tests, build).
- [ ] Pas de TODO/FIXME dans le code livré (ou ticket de suivi créé).
- [ ] Pas de secrets en clair dans le code.
- [ ] Conventional Commit message.

## DoD — Feature

En plus du universel :

### Code
- [ ] Tous les acceptance criteria du ticket cochés.
- [ ] Tests unitaires écrits et passent.
- [ ] Tests intégration si la feature touche plus d'1 module.
- [ ] Test E2E Playwright si user-facing.
- [ ] Pas de console.log/print/debugger laissés.
- [ ] Pas de magic numbers (constants nommées).
- [ ] Erreurs typées (pas de `throw new Error('...')` générique).

### Performance
- [ ] Bundle size impact ≤ +2 kB (sinon justification).
- [ ] Latence API < cible spec (mesurée).
- [ ] Pas de N+1 queries (vérifié via slow query log si DB).

### A11y (si frontend)
- [ ] axe-core pass sur la nouvelle UI.
- [ ] Test au clavier (Tab/Enter/Esc).
- [ ] Test screen reader 1 fois (NVDA ou VoiceOver).
- [ ] Touch target ≥ 44px.
- [ ] Couleurs WCAG AA.

### i18n
- [ ] Tous les strings extraits dans `microcopy.csv`.
- [ ] FR + AR + AR-MA fournis.
- [ ] Validation native speaker pour AR/AR-MA (Yasmine ou Naima).
- [ ] RTL testé visuellement.

### Observabilité
- [ ] Events analytics ajoutés selon `event-taxonomy.csv`.
- [ ] Logs structurés si backend (pas de `console.log` debug).
- [ ] Sentry tags appropriés.
- [ ] Métrique impactée (KPI tree) ajoutée dans dashboard si applicable.

### Doc
- [ ] Spec inline (commentaire long) ou doc dédiée mise à jour.
- [ ] README du module mis à jour si changement architecture.
- [ ] Storybook story si nouveau composant UI.

### Sécurité (si applicable)
- [ ] Inputs validés (Zod).
- [ ] Sanitization (DOMPurify, etc.).
- [ ] Pas de SQL string concat (use Drizzle).
- [ ] Rate limiting si endpoint public.
- [ ] PII protection vérifiée.

### RGPD (si applicable)
- [ ] Retention période documentée.
- [ ] Export RGPD fonctionne pour cette donnée.
- [ ] Forget RGPD fonctionne pour cette donnée.

### Préparation prod
- [ ] Feature flag en place si déploiement progressif.
- [ ] Migration DB rollback testée.
- [ ] Variables d'env documentées dans `.env.example`.
- [ ] Runbook mis à jour si feature affecte ops.

### Validation
- [ ] PO (Selma) a validé la feature en preview.
- [ ] Si UX significative : designer validation.
- [ ] Si content : Yasmine validation.
- [ ] Si care : Karim validation.

## DoD — Bug

- [ ] Reproduction documentée et résolue.
- [ ] Test ajouté qui aurait détecté le bug.
- [ ] Régression check : autres flows similaires testés.
- [ ] Severity P0/P1 → post-mortem si applicable.
- [ ] Changelog mis à jour si user-facing.

## DoD — Tech debt / Refactor

- [ ] Zéro régression fonctionnelle (tests verts).
- [ ] Code coverage maintenu ou amélioré.
- [ ] Performance maintenue ou améliorée (mesurée).
- [ ] Doc mise à jour (architecture, conventions).
- [ ] Pas de nouvelles abstractions inutiles.

## DoD — Spike

- [ ] Document de recommandation publié.
- [ ] Branche prototype supprimée OU archivée.
- [ ] Décision tracée dans ADR si applicable.
- [ ] Ticket follow-up créé si décision d'implémenter.

## DoD — Doc

- [ ] Publiée à l'endroit prévu (Notion / `docs/`).
- [ ] Lecteur cible identifié et notifié.
- [ ] Linkée depuis index principal.
- [ ] Pas de TODO laissé.

## DoD — Migration DB

- [ ] Migration up testée en local.
- [ ] Migration down (rollback) testée en local.
- [ ] Migration up + down enchainées testées (idempotence).
- [ ] Migration testée en staging.
- [ ] Tests de performance sur la migration (durée < 5 min sinon plan special).
- [ ] Backup DB pre-migration documenté en runbook.

## DoD — Release / Ship

- [ ] Toutes features du sprint en `Done`.
- [ ] CI verte.
- [ ] Test ULTIMATE pipeline verte.
- [ ] Migrations DB appliquées staging puis prod.
- [ ] Variables d'env prod alignées.
- [ ] Smoke test post-deploy validé.
- [ ] Annonce interne (Slack `#chat-launch`).
- [ ] Dashboards opérationnels.
- [ ] Sentry breadcrumbs alimentent correctement.
- [ ] Service level affiché 0 nominal.

## DoD — Incident postmortem (P0/P1)

- [ ] Timeline détaillée publiée.
- [ ] Root cause identifié.
- [ ] Mitigation court-terme déployée.
- [ ] Mitigation long-terme planifiée (ticket créé).
- [ ] Lessons learned partagées en équipe.
- [ ] Si user-facing : communication transparente.

## Anti-patterns DoD

- ❌ "Tests passent" sans avoir écrit de tests (CI verte ne suffit pas pour les tickets feature).
- ❌ "Validé par moi" sans validation PO/UX/content.
- ❌ "On verra plus tard" (TODO sans ticket suivi).
- ❌ "Marche en dev" — toujours valider en staging avant Done.
- ❌ Bundler du tech-debt dans un ticket feature sans le mentionner.
