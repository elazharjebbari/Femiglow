# 06 — Admin UI/UX design (Phase G5 optionnelle)

> Cette phase est **optionnelle** dans la livraison initiale. Le builder
> pur couvre 95 % des besoins. L'override admin est un nice-to-have
> pour permettre à un éditeur non-dev d'ajuster :
>  - la copy du header (kicker / durée totale / lead)
>  - les durées des 4 steps
>  - le label du CTA post-grille
>  - le flag isResult (par défaut step 4)
>
> Décision : si J+30 montre que les durées doivent évoluer souvent →
> on livre G5. Sinon, on reste sur mock + édition git (1 commit suffit).

## 1. Wireframe

```
/admin/kit/steps                            (singleton)
┌─────────────────────────────────────────────────────────────────┐
│ Steps /kit                                                      │
│ Statut : Mock par défaut | Brouillon | Publié                   │
│ ────────────────────────────────────────────────────────────────│
│                                                                 │
│ EN-TÊTE                                                         │
│ Kicker        [EN TOUT                              ]           │
│ Durée totale  [5 minutes le soir                    ]           │
│ Lead          [Quatre gestes lents, une fois par sem]           │
│                                                                 │
│ ────────────────────────────────────────────────────────────────│
│                                                                 │
│ STEPS                                                           │
│ ┌─────────────────────────────────────────────────────────┐     │
│ │ #1 PRÉPARATION                                          │     │
│ │ Durée   [30 s     ]    Icon [buffer ▾]    Résultat ☐    │     │
│ └─────────────────────────────────────────────────────────┘     │
│ ┌─────────────────────────────────────────────────────────┐     │
│ │ #2 GESTE 1 — Appliquez la paste                         │     │
│ │ Durée   [1 min    ]    Icon [drop ▾]      Résultat ☐    │     │
│ └─────────────────────────────────────────────────────────┘     │
│ ┌─────────────────────────────────────────────────────────┐     │
│ │ #3 GESTE 2 — Appliquez la powder                        │     │
│ │ Durée   [2 min    ]    Icon [sparkle ▾]   Résultat ☐    │     │
│ └─────────────────────────────────────────────────────────┘     │
│ ┌─────────────────────────────────────────────────────────┐     │
│ │ #4 POLISSOIR STEP 4 — Polish & Shine                    │     │
│ │ Durée   [1 min    ]    Icon [mirror ▾]    Résultat ☑    │     │
│ └─────────────────────────────────────────────────────────┘     │
│                                                                 │
│ ────────────────────────────────────────────────────────────────│
│                                                                 │
│ CTA POST-GRILLE                                                 │
│ Label    [Démarrer le rituel                         ]          │
│ Ancre    [commander-femiglow                         ]          │
│                                                                 │
│ ────────────────────────────────────────────────────────────────│
│                                                                 │
│ [Enregistrer]  [Publier sur /kit]  [Reset au mock]              │
└─────────────────────────────────────────────────────────────────┘
```

## 2. Composants admin

| Composant | Type | Rôle |
|---|---|---|
| `KitStepsEditor.tsx` | Client | Form principal, dirty tracking, validation Zod live, Save/Publish/Reset |
| `StepEditorRow.tsx` | Client | Une ligne par step (durée + icon select + isResult checkbox) |
| `KitStepsPreviewCard.tsx` | Server | Aperçu live du rendu — montre la timeline avec les modifs en cours |
| `KitStepsResetDialog.tsx` | Client | Modale magic word `RESET-STEPS` |

## 3. Champs editables

| Champ | Type | Validation |
|---|---|---|
| `header.kicker` | text | min 1 / max 40 |
| `header.totalDuration` | text | min 1 / max 40 |
| `header.lead` | textarea | min 1 / max 200 |
| `stepOverrides[1-4].duration` | text | min 1 / max 20, regex `/^\d+\s?(s|min|min\s)/i` (warning si format inhabituel) |
| `stepOverrides[1-4].icon` | select | enum 'buffer' \| 'drop' \| 'sparkle' \| 'mirror' \| '' (= défaut builder) |
| `stepOverrides[1-4].isResult` | checkbox | bool |
| `postCta.label` | text | min 1 / max 40 |
| `postCta.anchorId` | text | min 1 / max 60, regex `/^[a-z0-9-]+$/` |

Tous facultatifs côté Zod, `null` explicite = retour mock.

## 4. UX

### Cycle nominal
1. Édition libre → live validation côté Zod
2. **Save** → PATCH `/api/admin/kit/steps` → status « Brouillon enregistré »
3. **Publish** désactivé tant que dirty (force Save)
4. **Publish** → POST `/publish` → revalidate `kit-steps` → visible sur `/kit`
5. **Reset** → modale magic word `RESET-STEPS` → DELETE override → retour mock

### États
- `mock` : pas d'override, badge gris
- `override-draft` : dirty saved, badge bleu
- `override-published` : badge vert

### Aperçu live
La colonne droite (sur md+) rend `KitStepsPreviewCard` qui réutilise
`StepsTimeline` sur les patches en cours — synchro à chaque keystroke
via `useDeferredValue`.

## 5. Magic words convention

| Section | Magic word |
|---|---|
| Vidéo | `RESET-VIDEO` |
| Composition | `RESET-COMPOSITION-{ID}` |
| Pack | `RESET-PACK` |
| **Steps** | **`RESET-STEPS`** |

## 6. AdminShell entry

```ts
{ href: '/admin/kit/steps', key: 'kit-steps', label: 'Rituel /kit' }
```

À ajouter dans `AdminShell.tsx` après `kit-pack`.

## 7. Décisions finales

- Format compact (1 ligne par step) — pas d'expansion à scroll infini.
- Pas d'édition de la copy `title / description` côté admin — la voix
  reste pilotée par git (cohérent avec section vidéo/composition).
- Aperçu live à droite, formulaire à gauche (md:grid-cols-2).
- Bouton Publish n'est jamais cliquable sans Save préalable.
