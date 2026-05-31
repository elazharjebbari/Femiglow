# 03 — Frontend / UI / UX

## Fichiers

| Fichier | Contenu |
|---|---|
| [`pages-admin.md`](./pages-admin.md) | Modifs page template-vars + ajout bouton create-var |
| [`components.md`](./components.md) | `<CreateVarForm />`, modifications header |
| [`anonymisation-marketing.md`](./anonymisation-marketing.md) | Diffs précis sur 6 fichiers `(marketing)/*` |
| [`design-a11y.md`](./design-a11y.md) | Tokens, contrastes, focus management |

## Principes UX

1. **Bouton "+ Nouvelle variable"** en tête de `/admin/legal/template-vars` (proche du flow naturel)
2. **Suggestions auto** : afficher les vars utilisées mais non définies en suggestion d'auto-complétion
3. **Validation inline** : le format `UPPER_SNAKE_CASE` est validé côté client avant submit
4. **Pas de breaking change** sur les autres pages admin
5. **Anonymisation marketing transparent** : aucun changement visible UX si on remplace "Souheila" par "notre fondatrice"

## Wireframe — `/admin/legal/template-vars` (après fix)

```
┌─────────────────────────────────────────────────────────────┐
│  Variables template                                          │
│  ─────────────────────────────────────────────────────────  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  + Nouvelle variable                                  │   │
│  │  KEY: [_______________] (UPPER_SNAKE_CASE)            │   │
│  │  Label: [_______________________________]            │   │
│  │  Value: [_______________________________]            │   │
│  │  ☐ Requis                                             │   │
│  │  [Créer]                                              │   │
│  │                                                       │   │
│  │  Suggestions (vars utilisées sans définition) :      │   │
│  │  • CURRENCY  • SUPPORT_HOURS  • PAYMENT_PROVIDERS    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Variables existantes (24)                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ KEY              Label           Value      Pages   │   │
│  │ CNDP_DECL...REF  CNDP — réf      MA-CNDP-…  2 pages│   │
│  │ COMPANY_ADDRESS  Adresse siège   [filled]    3 pages│   │
│  │ ...                                                  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```
