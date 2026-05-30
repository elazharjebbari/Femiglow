# S01 — Golden path : Publier maintenant

## Acteur
Opérateur admin

## Pré-conditions
- 1 post approuvé existant
- 1 compte IG actif (mock ou réel selon mode)
- mockMode=true (ou env publish provider=mock)

## Étapes
1. Visite `/admin/content-studio-v2/create?draft=<id>`
2. Vérifie : bouton "Publier" enabled
3. Click "Publier" → dropdown
4. Click "Publier maintenant" → dialog
5. Vérifie : G12 preview (thumbnail + caption + platform + format + mock tag)
6. Click "Confirmer"
7. Vérifie : toast "Publication lancée"
8. Navigate /plan → JobQueue contient le job
9. Vérifie : job.status transitions queued → publishing → published (polling)
10. Library : post badge passe à "published"

## Critères de succès
- 0 erreur console
- API POST /publish-now appelée 1 fois
- 1 row INSERT social_publish_job
- 1 row INSERT social_publish_attempt (succeeded)
- audit_log social.publish.published présent
- post.status='published'

## Spec
`e2e/social-publishing/publish-now-golden-path.spec.ts`
