# S03 — Golden path : Brouillon Postiz

## Étapes
1. /create avec post approuvé
2. Click Publier → Brouillon Postiz
3. Dialog confirm
4. Click "Envoyer"
5. Toast "Brouillon envoyé au provider"
6. JobQueue contient le job avec mode=draft, status=published (côté Postiz)
7. Post status reste "approved" (PAS published) en DB

## Critères
- Postiz POST /posts avec type='draft'
- audit_log social.draft_created (PAS social.publish.published)
- content_post.status='approved' (inchangé)
- content_postiz_delivery.status='sent'

## Spec
`e2e/social-publishing/postiz-draft-golden-path.spec.ts`
