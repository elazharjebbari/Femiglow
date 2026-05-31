# Checklist DoD

## Global (avant chaque release)

### Compilation
- [ ] `pnpm typecheck` passe sur fichiers touchés
- [ ] `pnpm lint` 0 erreur nouvelle
- [ ] Aucun import circulaire
- [ ] Aucune nouvelle dépendance npm

### Tests
- [ ] 7159+ tests vitest verts (baseline maintenue)
- [ ] 12+ tests vitest unit nouveaux verts
- [ ] 5+ tests intégration MSW verts
- [ ] 7+ specs Playwright `@legal-purity` verts
- [ ] 3 specs `@a11y` verts
- [ ] Smoke script exit 0 local + staging + prod
- [ ] Coverage ≥ 85% sur fichiers modifiés

### Comportement fonctionnel
- [ ] 3 drafts (CGU, retours, sécurité) peuvent être publiés sans erreur
- [ ] `/legal/mentions-legales` HTML : ni ICE 15-chiffres, ni RC Ville-NNN
- [ ] `/legal/*` contient `legal@femiglow-maroc.com` pour demandes
- [ ] `/admin/legal/template-vars` : bouton "+ Nouvelle variable" présent et fonctionnel
- [ ] `/admin/legal` : plus de pages E2E orphelines
- [ ] Endpoint DELETE cleanup-e2e fonctionne (auth + dryRun + execute)
- [ ] Marketing pages : `grep souheila` = 0
- [ ] Test invariant `no-founder-name` passe en CI

### Data integrity
- [ ] Migration appliquée sans erreur
- [ ] 6 vars renommées (valeurs préservées)
- [ ] 6 vars ajoutées avec defaults
- [ ] 0 row préfixe `e2e-test-` après cleanup
- [ ] Cohérence cross-table : 100%

### Performance
- [ ] Migration DB < 1s
- [ ] Latency SSR `/legal/*` < 500ms
- [ ] Latency SSR `/admin/legal/*` < 500ms
- [ ] Aucun nouvel index requis

### Observabilité
- [ ] Logs `legal.vars.create`, `legal.cleanup.e2e` émis
- [ ] Sentry rules L1, L2, L3 configurées
- [ ] Plausible events configurés
- [ ] Dashboard `/admin/legal/audit` (si créé)

### Documentation
- [ ] `docs/legal-pages/60-content/*.md` mis à jour (templates source)
- [ ] `docs/pages-legales-fix-2026-05/` complet
- [ ] CHANGELOG.md mis à jour
- [ ] PR descriptions incluent lien vers ce dossier

### Sécurité
- [ ] Endpoint create-var require auth admin
- [ ] Endpoint cleanup-e2e require auth admin + olderThanDays ≥ 7
- [ ] Validation Zod stricte (KEY pattern, max length)
- [ ] Aucune SQL injection possible (params Drizzle)

### Juridique
- [ ] Juriste a validé l'approche "info sur demande"
- [ ] Email `legal@femiglow-maroc.com` setup + monitoring
- [ ] Politique réponse 5j ouvrés documentée

### Rollback
- [ ] Feature flag `LEGAL_VARS_V2=false` restaure comportement legacy
- [ ] Migration SQL rollback documenté
- [ ] Procédure rollback dans `rollback.md`

---

## Par phase

### T0 — Prep
- [ ] Branch créée
- [ ] Flag `LEGAL_VARS_V2` ajouté à env
- [ ] `presetVarsForPage` planifié (à implémenter T1)
- [ ] Snapshot pré-fix stocké
- [ ] Juriste contacté avec brief
- [ ] Email legal@femiglow-maroc.com actif

### T1 — Backend
- [ ] Migration `0075` créée et appliquée local
- [ ] `vars.ts` étendu avec `presetVarsForPage`
- [ ] `cleanup.ts` créé
- [ ] `repository.ts` étendu avec `createTemplateVar`
- [ ] 2 endpoints API créés (POST var + DELETE cleanup-e2e)
- [ ] Logs émis avec `actor`
- [ ] Type check OK
- [ ] Tests existants restent verts

### T2 — Templates
- [ ] Juriste OK reçu
- [ ] 4 templates source mis à jour
- [ ] 4 pages republier (staging/local)
- [ ] Smoke OK : pas d'ICE/RC

### T3 — Anonymisation + cleanup
- [ ] 6 fichiers marketing modifiés
- [ ] Test invariant `no-founder-name` passe
- [ ] 5 pages E2E orphelines supprimées
- [ ] Test Playwright incriminé fixé

### T4 — Tests
- [ ] 12+ vitest unit
- [ ] 5+ MSW intégration
- [ ] 7+ Playwright `@legal-purity`
- [ ] 3 `@a11y`
- [ ] Smoke local ok

### T5 — Data
- [ ] Snapshots before/after
- [ ] Sentry + Plausible OK
- [ ] Cron weekly cleanup setup

### T6 — Ship
- [ ] Staging migré + flag ON + manual valid
- [ ] Prod migré + flag ON + manual valid
- [ ] Email fondatrice envoyé
- [ ] 48h obs : 0 erreur Sentry
- [ ] Décision : flag stays ON

---

## Anti-patterns à éviter

- ❌ Merge sans smoke
- ❌ Activer flag avant migration
- ❌ DELETE des vars sans backup
- ❌ Republier les 4 pages sans pré-visualisation
- ❌ Anonymiser sans validation juriste préalable
- ❌ Modifier sans test invariant pour empêcher régression
