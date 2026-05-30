# S16 — Operator typo recovery

## Cas
L'opérateur a publié avec un typo dans la caption. Il veut soit retirer le post soit le re-publier corrigé.

## Workflow A : annuler avant publication (scheduled)
1. Post scheduled, user voit le typo dans Calendar
2. Double-click → QuickEditDrawer
3. Click "Voir le post" → navigate /create
4. Édite caption → autosave
5. Retour Plan, attend le cron → publish-now avec nouveau caption

## Workflow B : post déjà publié (visible sur IG)
1. Post.status='published'
2. Library → click post
3. Note : on ne peut pas éditer un post déjà publié (Instagram limitation)
4. Solution : Postiz UI permet supprimer (delete) le post live
5. Re-créer un nouveau post avec caption corrigée

## Critères
- Workflow A : caption corrigée avant cron pick-up
- Workflow B : opérateur informé qu'il faut passer par Postiz pour supprimer (lien dans Library)

## Spec
Couvert par F32 (multi-account) + Library test.
