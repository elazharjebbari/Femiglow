# 06 — Admin UI/UX design (Phase W5 optionnelle)

> Cette phase est **optionnelle** pour la livraison initiale. Le mock
> couvre 100 % des besoins de base. L'override admin est livré quand
> on a besoin de tester rapidement des variants copy/features sans
> redéploiement.
>
> Décision **GO** si J+30 montre :
> - besoin d'A/B testing rapide sur le CTA Lead
> - demandes éditoriales fréquentes (≥ 1 / semaine)
> - besoin de désactiver un feature problématique (PhoneMask casse sur un device)

## 1. Wireframe `/admin/kit/wizard`

```
┌─────────────────────────────────────────────────────────────────┐
│ Wizard /kit                                                     │
│ Statut : Mock par défaut | Brouillon | Publié                   │
│ ────────────────────────────────────────────────────────────────│
│                                                                 │
│ COPY                                                            │
│ CTA Lead       [Continuer · paiement à la livraison]            │
│ CTA Address    [Confirmer la commande            ]              │
│ No-commitment  [Aucun paiement maintenant        ]              │
│ Sub no-commit  [Vous payez à la livraison…       ]              │
│ Time total     [≈ 90 secondes pour confirmer     ]              │
│ Time lead      [60 s   ]                                        │
│ Time address   [30 s   ]                                        │
│ Time thank-you [5 s    ]                                        │
│ Consent label  [Je veux être rappelée…           ]              │
│ Consent foot.  [Pas de revente, pas de spam…     ]              │
│ Resume tmpl    [Bon retour, {firstName} —…       ]              │
│                                                                 │
│ ────────────────────────────────────────────────────────────────│
│                                                                 │
│ FEATURES (toggle ON/OFF)                                        │
│ ☑ Mini cart-recap permanent                                     │
│ ☑ NoCommitmentBadge step 2                                      │
│ ☑ TimeEstimate global + per-step                                │
│ ☑ PhoneMask live                                                │
│ ☑ Field validation checkmark                                    │
│ ☑ ResumeBanner (Bon retour)                                     │
│ ☑ Mobile pack thumbnail header                                  │
│                                                                 │
│ ────────────────────────────────────────────────────────────────│
│                                                                 │
│ [Enregistrer]  [Publier sur /kit]  [Reset au mock]              │
└─────────────────────────────────────────────────────────────────┘
```

Layout 2 colonnes desktop : édition gauche, aperçu live droite (réutilise
`<WizardShell>` en mini-view).

## 2. Composants admin

| Composant | Type | Rôle |
|---|---|---|
| `KitWizardEditor.tsx` | Client | Form principal, dirty tracking, validation Zod live, Save/Publish/Reset |
| `KitWizardPreviewCard.tsx` | Server-renderable | Aperçu live — mini wizard en lecture seule reflétant le patch en cours |
| `KitWizardResetDialog.tsx` | Client | Modale magic word `RESET-WIZARD` |
| `WizardFeatureToggle.tsx` | Client | Checkbox stylée + label + description |

## 3. Champs editables

| Champ | Type | Validation Zod | Effet UX |
|---|---|---|---|
| `copy.ctaLead` | text | min 1 / max 60 | CTA Step 1 |
| `copy.ctaAddress` | text | min 1 / max 40 | CTA Step 2 |
| `copy.noCommitmentLabel` | text | min 1 / max 60 | Titre badge step 2 |
| `copy.noCommitmentSub` | text | min 1 / max 80 | Sub badge step 2 |
| `copy.timeEstimateTotal` | text | min 1 / max 60 | Header wizard |
| `copy.timeEstimateLead` | text | min 1 / max 20 | StepIndicator step 1 |
| `copy.timeEstimateAddress` | text | min 1 / max 20 | StepIndicator step 2 |
| `copy.timeEstimateThankYou` | text | min 1 / max 20 | StepIndicator step 3 |
| `copy.consentLabel` | text | min 1 / max 200 | Consent step 1 |
| `copy.consentFootnote` | text | min 1 / max 200 | Footnote consent |
| `copy.resumeBannerTemplate` | text | min 1 / max 200, regex `\{firstName\}` requis | Resume banner |
| `features.cartRecap` | checkbox | bool | Affiche/cache cart-recap |
| `features.noCommitmentBadge` | checkbox | bool | Affiche/cache badge step 2 |
| `features.timeEstimate` | checkbox | bool | Affiche/cache time labels |
| `features.phoneMask` | checkbox | bool | Active/désactive masque tel |
| `features.fieldCheckmark` | checkbox | bool | Active/désactive ✓ champs |
| `features.resumeBanner` | checkbox | bool | Active/désactive « Bon retour » |
| `features.mobilePackThumbnail` | checkbox | bool | Active/désactive thumb mobile |

Tous facultatifs côté Zod, `null` explicite = retour mock.

## 4. UX du cycle nominal

### 4.1 Sequence

1. Édition libre → live validation Zod
2. **Save** désactivé si dirty=false ou validation=false
3. **Save** → PATCH `/api/admin/kit/wizard` → status « Brouillon enregistré »
4. **Publish** désactivé tant que dirty (force Save d'abord)
5. **Publish** → POST `/publish` → revalidate `kit-wizard` → visible sur `/kit`
6. **Reset** → modale magic word `RESET-WIZARD` → DELETE override → retour mock

### 4.2 États visuels

- `mock` : badge gris « Mock par défaut »
- `override-draft` : badge bleu « Brouillon — non publié »
- `override-published` : badge vert « Publié »

### 4.3 Aperçu live

Colonne droite (sur `md:`) rend `KitWizardPreviewCard` qui réutilise
`WizardShell` en lecture seule, sur les patches en cours, via
`useDeferredValue` pour éviter la sur-recompilation pendant la frappe.

## 5. Magic word convention

| Section | Magic word |
|---|---|
| Vidéo | `RESET-VIDEO` |
| Composition | `RESET-COMPOSITION-{ID}` |
| Pack | `RESET-PACK` |
| Steps | `RESET-STEPS` |
| **Wizard** | **`RESET-WIZARD`** |

## 6. AdminShell entry

```ts
// apps/web/src/components/admin/AdminShell.tsx
{ href: '/admin/kit/wizard', key: 'kit-wizard', label: 'Wizard /kit' }
```

À ajouter après `kit-steps`.

## 7. Sécurité

- `getAdminSession()` obligatoire sur GET / PATCH / POST publish / POST reset (401 sinon)
- Validation Zod stricte (422 si payload invalide)
- Audit log à chaque mutation (`kit_wizard.update`, `kit_wizard.publish`, `kit_wizard.reset`)
- Pas de XSS possible : toute la copy est rendu par React (escape par défaut)
- Pas d'accès au store côté serveur (le store est purement client Zustand)

## 8. Décisions finales

- Format **2 colonnes md+** : formulaire gauche, aperçu live droite
- Mobile : formulaire pleine largeur, aperçu en bas dans un drawer ?
  → NON, simplement aperçu absent sur mobile (l'admin est desktop-first)
- Pas d'édition multi-langue dans cette itération (FR only)
- Pas d'A/B testing multi-variants natif — on garde un seul jeu de copy
  par site. L'A/B peut venir en V2 avec un splitter externe (GrowthBook).

## 9. Roadmap admin

- **V1 (W5)** : édition copy + features toggles (ce dossier)
- **V2 (post-J+30)** : A/B variants natif (2-3 jeux de copy, distribution
  par cookie), métriques par variant
- **V3 (post-J+60)** : édition multi-langue (FR/AR) avec fallback automatique
