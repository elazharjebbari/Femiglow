# S13 — LIVE Instagram AlFenna Beauty

## ⚠ GATING STRICT

- Requires `E2E_LIVE_POSTIZ=1`
- Requires valid `POSTIZ_API_KEY`, `E2E_LIVE_ACCOUNT_ID`
- Marqué `@live` — exclu par défaut
- Workers=1

## Pré-conditions
- Compte Postiz actif avec quota disponible
- Compte Instagram AlFenna Beauty (`@alfenna_beauty`) lié via OAuth Postiz
- Image test hébergée HTTPS publique
- Sync FemiGlow ↔ Postiz effectuée

## Étapes (haut niveau)

### Setup
1. Vérification env : E2E_LIVE_POSTIZ=1, vars présentes
2. Smoke check Postiz API (GET /integrations contient AlFenna)
3. Vérification pas de post test dangling dans les 10min précédentes

### Création du post test
4. Via API admin :
   - POST /ideas (idea minimale)
   - POST /ideas/:id/generate (mock-text si possible, sinon fallback)
   - PATCH /drafts/:id (caption marquée "[TEST AUTO — FemiGlow QA — {ISO}] ...")
   - Bind media (image test)
   - POST /drafts/:id/approve → postId obtenu

### Publication live
5. Visit /admin/content-studio-v2/create?draft=<id>
6. Confirme : Publier maintenant
7. Confirme dans dialog
8. Toast "Publication lancée"

### Wait + vérifs DB
9. Polling social_publish_job WHERE postId=<id> jusqu'à status='published' (timeout 90s)
10. Capture postizPostId
11. Vérifie content_postiz_delivery : status='sent', postizPostId présent
12. Vérifie audit_log social.publish.published existe

### Vérif Postiz API
13. GET Postiz /api/public/v1/posts/<postizPostId>
14. Expect : status SENT, permalink contient 'instagram.com'

### Vérif Instagram (optionnel manuel)
15. Ouvre https://instagram.com/alfenna_beauty incognito
16. Cherche post test "[TEST AUTO — FemiGlow QA — ...]"
17. Confirme visible

### Cleanup (auto si E2E_LIVE_CLEANUP=1)
18. DELETE Postiz /api/public/v1/posts/<postizPostId>
19. UPDATE content_postiz_delivery SET cleanupAt=now()
20. INSERT audit_log social.publish.cleaned

## Critères de succès
- [ ] job.status='published' dans 90s
- [ ] content_postiz_delivery.status='sent', postizPostId non null
- [ ] Postiz API retourne le post avec permalink IG
- [ ] audit_log social.publish.published row existe
- [ ] (Manuel) post visible sur IG AlFenna
- [ ] Cleanup réussi (post supprimé)

## Spec
`e2e/social-publishing/live-instagram-alfenna.spec.ts` avec tag @live

## Voir aussi
`05-live-testing-protocol.md` pour les détails opérationnels (recovery, métriques, escalation).
