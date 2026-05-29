# BUG-017 — La 'variation' de draft ne régénère aucun texte — clone exact du parent, promptOverride ignoré

| | |
|---|---|
| **Sévérité** | `major` |
| **Domaine** | copywriting |
| **Composant** | `src/app/api/admin/content-studio/drafts/[id]/variation/route.ts -> service.createVariation -> repository.createDraftVariation:910` |
| **Mode mock** | `broken` |
| **Mode live** | `broken` |
| **Verdict vérification** | `confirmed` (confiance: high) |

## État supposé (code + tests)
Créer une variation produit un texte distinct (autre hook/angle/CTA), idéalement via les stratégies de generate-variants.ts (hook-alternatif, cta-different, emotion-different).

## État réel vérifié
createDraftVariation:917-935 copie caption, hook, cta, altText, hashtags du parent à l'identique et ne change que variantLabel. Vérifié: variation 'angle-test' du draft cd_szd2vffv41jg1eq3 a EXACTEMENT la même caption et le même hook que le parent. Le schema accepte promptOverride mais la route ne le transmet pas et le repository l'ignore.

## Écart
Aucune régénération de texte: l'opérateur croit obtenir une alternative rédactionnelle, il obtient un doublon relabelisé. Le nœud generate-variants.ts (3 angles distincts) n'est jamais appelé par ce chemin.

## Cause racine
createDraftVariation est un simple clone DB. La route variation/route.ts:18 ne passe que variantLabel. draftVariationSchema:83-88 expose promptOverride mais il n'est jamais consommé.

## Preuves
- POST /api/admin/content-studio/drafts/cd_szd2vffv41jg1eq3/variation {variantLabel:'angle-test'} -> HTTP 200; draft.caption == parent.caption (verbatim), hook=='Un geste lent, une main qui retrouve sa lumière.' (identique), parentDraftId=cd_szd2vffv41jg1eq3
- repository.ts:922-927 caption: overrides.caption ?? parent.caption; hook: parent.hook (jamais régénéré)
- variation/route.ts:18 `createVariation({ draftId: params.id, variantLabel: body.variantLabel })` — promptOverride non transmis

## Reproduction
1) Générer une idée -> draft. 2) POST /drafts/<draftId>/variation {variantLabel:'x', promptOverride:'change le hook'}. 3) Constater caption/hook identiques au parent.

## Piste de correction
Brancher createVariation sur une vraie régénération (generateForIdea ciblé sur un variantLabel, ou generate-variants.ts) et consommer promptOverride. A minima, transformer le hook/caption déterministiquement (comme generateDeterministicVariants de generate-variants.ts) au lieu de cloner.

## Vérification adversariale
- **Verdict :** confirmed (confiance high)
- **Analyse :** repository.ts:910-943 createDraftVariation est un clone DB pur: caption=`overrides.caption ?? parent.caption`, hook=parent.hook, cta=parent.cta, altText=parent.altText, hashtags=parent.hashtags; seul variantLabel change (et status='generated', parentDraftId). variation/route.ts:18 ne transmet que `variantLabel` a createVariation; service.createVariation (service.ts:597-601) idem. draftVariationSchema:83-88 expose promptOverride mais il n'est jamais consomme (ni route ni service ne le passent). Confirme au runtime: la variation cd_u8ccsx9c8s9va4bm (label 'angle-test', parent cd_szd2vffv41jg1eq3) a caption/hook/cta/hashtags TOUS identiques au parent; hook='Un geste lent, une main qui retrouve sa lumiere.' verbatim. Aucune regeneration de texte; generate-variants.ts jamais appele. Severite major justifiee.
- **Contre-preuve / nuance :** Aucune. Clone exact confirme via comparaison runtime des champs.

> Réf. registre : `bug-register.csv` ligne `BUG-017` · matrice : `gap-matrix.csv`.
