# S19 — Content policy violation (Brand)

## Pré-conditions
- 1 draft avec contenu qui passe les règles brand → status='warning'
- Modification → contenu blocked

## Étapes
1. Post approuvé avec warning (passe quand même)
2. Édite caption avec mot interdit (ex: "promesse médicale")
3. Brand review revalide → status='blocked'
4. Tente publish-now → 409 code='brand_review_blocked'
5. Toast "Le contenu est bloqué par la revue brand."
6. ApproveButton se désactive (cf audit precedent)
7. Édite caption pour retirer le mot interdit
8. Brand revalide → 'pass'
9. Retente publish-now → succès

## Critères
- Brand review réactif (re-run après PATCH)
- Pre-flight bloque publish si blocked
- UI feedback clair

## Spec
`e2e/social-publishing/brand-violation.spec.ts`
