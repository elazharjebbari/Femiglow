# Plan S2.3 phase e — Mode "Brouillon Postiz" comme citoyen de première classe du nouveau pipeline

**Version** : 1.0 — 2026-05-22
**Statut** : approuvé, en exécution
**Dépendances** : S2.1 (done), S2.3a (done), S2.3c (done)
**Bloque** : S2.3d (suppression code legacy)
**ETA total** : 1.5 jour

## 0. Pourquoi ce plan

Aujourd'hui le module a deux pipelines parallèles (legacy `content_postiz_delivery` qui crée un draft Postiz pour QA humaine, et nouveau `social_publish_job` qui publie en `now`/`schedule`). Le risque opérationnel est **doublon de publication** et **divergence d'état**. La solution n'est pas de supprimer la fonctionnalité "draft Postiz" (qui a une vraie valeur produit : QA finale dans l'UI Postiz, scheduling cross-channel natif Postiz, 4-eyes review) mais d'**unifier sous le nouveau modèle** en ajoutant `draft` comme troisième mode d'envoi.

### Objectifs

1. Exposer "Brouillon Postiz" comme troisième bouton dans `SocialPublishingPanel`, à côté de "Publier maintenant" et "Programmer".
2. Une seule table source de vérité (`social_publish_job`), un seul state machine, un seul audit trail.
3. Aucune régression sur les deux modes existants.
4. Préparer le terrain pour la suppression de la route legacy `POST /postiz-draft` en S2.3d.

### Principes de conception

| Principe | Conséquence |
|---|---|
| **Modes orthogonaux** | `now`, `schedule`, `draft` partagent la même infra. Seule la branche provider diverge. |
| **Backward-compatible** | Si `publishMode` n'est pas fourni, l'inférence actuelle (scheduledAt → now/schedule) reste valide. |
| **Provider-aware** | Un adapter qui ne supporte pas `draft` rejette explicitement avec `unsupported_format`. |
| **Idempotence** | La clé d'idempotence inclut le mode pour éviter collisions cross-mode. |
| **Observabilité** | Logs incluent `publish_mode`. Le dashboard distingue draft vs publication réelle. |

## 1. Modèle de données

### 1.1 Types TypeScript

- `SOCIAL_PUBLISH_MODES = ['now', 'schedule', 'draft']`
- `SocialPublishMode` union literal
- `SocialPublishContent.publishMode?: SocialPublishMode`
- `SocialPublishingCapability.supportsDraft: boolean`

### 1.2 Persistance

Aucune migration SQL — `publishMode` est sérialisé dans `social_publish_job.content` (JSONB).

## 2. Backend — résumé

- **Adapter Postiz** : `resolvePostizSchedule` honore `publishMode` (`draft` → `type='draft'`, override de l'inférence).
- **Adapter DryRun** : `supportsDraft: true`, mode draft marque `metadata.simulatedDraft: true`.
- **Service** : nouvelle fonction `sendContentPostToDraft` ; clé d'idempotence `${postId}:${accountId}:draft`.
- **Route** : `POST /api/admin/content-studio/posts/[id]/draft-on-provider`.
- **Dashboard** : `computeJobSuccessRate` exclut les drafts ; nouveau widget "Brouillons en attente".
- **Audit** : `social.draft_created`.
- **Alertes** : `sendSocialAlert` skippé en mode draft.

## 3. Frontend — résumé

Radio group dans `SocialPublishingPanel.tsx` :
- `( ) Publier maintenant`
- `( ) Programmer pour: [datetime]`
- `( ) Brouillon Postiz (révision humaine côté Postiz)`

Bouton primaire conditionnel selon le mode sélectionné. Note informative amber en mode draft.

## 4. Tests

| Suite | Nouveaux tests |
|---|---|
| `adapters/postiz.test.ts` | +4 (draft happy, unsupported, override, backward-compat) |
| `adapters/dry-run.test.ts` | +2 (draft happy, permalink) |
| `admin-service.test.ts` | +5 (happy, idempotence, cross-mode, dry-run, meta-rejected) |
| `dashboard.test.ts` | +3 (exclude drafts, draftsAwaitingReview, top performers) |
| `draft-on-provider/route.test.ts` | +4 (auth, invalid, happy, idempotency-key) |
| `SocialPublishingPanel.test.tsx` | +5 (radio interaction, button toggle, draft submit) |
| `draft.integration.test.ts` | +2 (MSW Postiz end-to-end) |
| `e2e/...draft.spec.ts` | +2 (Playwright happy + disabled state) |

## 5. Plan d'action — 10 étapes

1. **Contracts & types** (0.1j) — `SocialPublishMode`, `publishMode`, `supportsDraft`.
2. **Adapters** (0.2j) — Postiz + DryRun honorent `publishMode`.
3. **Service `admin-service.ts`** (0.15j) — `sendContentPostToDraft`.
4. **Route API** (0.1j) — `POST /draft-on-provider`.
5. **UI `SocialPublishingPanel.tsx`** (0.25j) — radio group + handler.
6. **Dashboard** (0.1j) — exclure drafts du taux succès + widget "Brouillons".
7. **Audit & alertes** (0.05j) — `social.draft_created` + skip alert en draft.
8. **MSW + integration** (0.1j) — chaîne complète draft via MSW.
9. **Playwright E2E** (0.15j) — happy path + état disabled.
10. **Smoke live + docs** (0.1j) — build, restart, smoke curl, plan doc updated.

Chaque étape commit indépendamment. DoD : tsc vert + suite vitest scopée verte + 0 régression.

## 6. Runbook

### Pré-flight
```bash
cd /var/www/femiglow-staging
git status --short                                # vide
git pull --rebase origin master
cd apps/web
npx vitest run src/lib/content-studio src/lib/social-publishing 2>&1 | tail -3
# baseline: 258/258 passed
npm run build 2>&1 | tail -3
```

### Smoke live (étape 10)
```bash
npm run build && chown -R nodeapp:nodeapp .next && systemctl restart femiglow-staging.service && sleep 4

# Route nouvelle (POST_ID = post Postiz approuvé staging)
curl -sS -X POST -H "Cookie: $(cat /tmp/admin_session)" -H "Content-Type: application/json" -d '{}' \
  http://127.0.0.1:8012/api/admin/content-studio/posts/$POST_ID/draft-on-provider

# Vérif DB
psql $DATABASE_URL -c "select id, status, content->>'publishMode' from social_publish_job where post_id='$POST_ID' order by created_at desc limit 3;"

# Audit
psql $DATABASE_URL -c "select action from audit_event where action='social.draft_created' order by created_at desc limit 3;"

chown -R nodeapp:nodeapp /var/www/femiglow-staging/apps/web/.media-storage
```

### Rollback
```bash
git revert <hash_premier_commit_phase_e>..HEAD
git push origin master
cd apps/web && npm run build && chown -R nodeapp:nodeapp .next && systemctl restart femiglow-staging.service
```

## 7. Critères d'acceptation finaux

- [ ] 25+ nouveaux tests vitest, 0 régression sur la suite existante.
- [ ] 2 nouveaux tests Playwright passent.
- [ ] `social_publish_job.content.publishMode` lisible en DB pour un job draft.
- [ ] Audit event `social.draft_created` émis.
- [ ] Alerte `sendSocialAlert` non déclenchée pour un draft échec.
- [ ] Dashboard distingue draft vs publication réelle.
- [ ] Route legacy `POST /postiz-draft` continue de fonctionner (avec headers de dépréciation).

## 8. Intégration avec S2.3 existant

| Phase | Statut |
|---|---|
| **a** Feature flag UI | done |
| **b** Re-route interne | obsolète (remplacée par phase e) |
| **c** Deprecation marker | done |
| **d** Suppression code | débloqué après 7j de télémétrie à zéro |
| **e** Mode draft natif | **ce plan** |
