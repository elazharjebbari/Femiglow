# Wizard UI Specification — FemiGlow Checkout

> **Document de spécification UI ultra-détaillée**, source de vérité unique
> pendant l'implémentation. Chaque composant, chaque état, chaque transition,
> chaque pixel notable est défini ici.
>
> Si tu hésites pendant le dev → c'est ce fichier qui tranche.
> S'il manque une info ici → on l'ajoute ici **avant** de coder.

---

## Sommaire

1. [Principes de design](#1-principes-de-design)
2. [Tokens & system](#2-tokens--system)
3. [Layout du wizard](#3-layout-du-wizard)
4. [Anatomie globale](#4-anatomie-globale)
5. [Step 1 — Lead capture](#5-step-1--lead-capture)
6. [Step 2 — Adresse](#6-step-2--adresse)
7. [Step 3 — Paiement](#7-step-3--paiement)
8. [Step 4 — Confirmation (Thank-You)](#8-step-4--confirmation-thank-you)
9. [Composants atomiques](#9-composants-atomiques)
10. [États & feedback](#10-états--feedback)
11. [Animations & transitions](#11-animations--transitions)
12. [Mode A — Embed sur /kit](#12-mode-a--embed-sur-kit)
13. [Mode B — Cart sur /commander](#13-mode-b--cart-sur-commander)
14. [Accessibilité](#14-accessibilité)
15. [i18n FR + AR (RTL)](#15-i18n-fr--ar-rtl)
16. [Copywriting source](#16-copywriting-source)
17. [Edge cases visuels](#17-edge-cases-visuels)

---

## 1. Principes de design

| Principe | Concrètement |
|---|---|
| **Une décision par écran** | Step 1 = juste contact. Step 2 = juste adresse. Pas de mélange. |
| **Visible avant scroll** | Tout ce qui est nécessaire pour avancer doit être au-dessus du fold sur 360×640 (iPhone SE). |
| **Tap target ≥ 48px** | Tout bouton, radio, checkbox, link. WCAG 2.5.5. |
| **Erreur dès le blur, jamais à la frappe** | Sauf pour le téléphone (validation live progressive). |
| **Pas de pop-in non sollicité** | Aucun modal qui s'ouvre sans intention utilisateur. |
| **RTL natif** | Si `dir="rtl"`, tout flippe (icons, progress, drawer). Pas de bricolage. |
| **Mobile-first absolu** | On code mobile, on étend desktop. Pas l'inverse. |
| **Pas d'animation > 350ms** | Sinon ça paraît lent. Default `200ms cubic-bezier(.4,0,.2,1)`. |

---

## 2. Tokens & system

> Tous les tokens sont déjà dans `apps/web/tailwind.config.ts` et
> `apps/web/src/app/[locale]/globals.css`. **Ne pas créer de nouveaux tokens** :
> réutiliser l'existant. Si une couleur manque, on l'ajoute au config Tailwind.

### 2.1 Couleurs (références à `tailwind.config.ts`)

| Token | Valeur | Usage wizard |
|---|---|---|
| `--background` | `#FFFFFF` | Fond du wizard |
| `--foreground` | `#0F172A` | Texte principal |
| `--primary` | `#0F172A` (slate-900) | Boutons primaires CTA |
| `--primary-foreground` | `#FFFFFF` | Texte sur primary |
| `--muted` | `#F1F5F9` | Fond des input, badges secondaires |
| `--muted-foreground` | `#64748B` | Helper text, placeholder |
| `--accent` | `#FCE7F3` (rose-100) | Highlight FemiGlow (subtle) |
| `--accent-foreground` | `#831843` (rose-900) | Texte sur accent |
| `--destructive` | `#DC2626` (red-600) | Erreurs |
| `--destructive-foreground` | `#FFFFFF` | Texte sur erreur |
| `--success` | `#16A34A` (green-600) | Validation OK, Step 4 |
| `--border` | `#E2E8F0` (slate-200) | Borders input/divider |
| `--ring` | `#0F172A` opacity 50% | Focus ring (2px) |

> **FemiGlow signature** : utiliser `--accent` (rose-100) sur des éléments
> de confiance (badges "Livraison 24-48h", "Paiement à la livraison") mais **jamais**
> sur l'erreur ou le CTA principal pour garder le contraste WCAG AAA.

### 2.2 Typographie

| Élément | Font | Size mobile | Size desktop | Weight | Line-height |
|---|---|---|---|---|---|
| Wizard title (Step heading) | Inter | 24px | 28px | 600 (semibold) | 1.25 |
| Step subtitle | Inter | 14px | 16px | 400 | 1.5 |
| Field label | Inter | 14px | 14px | 500 | 1.5 |
| Field input text | Inter | 16px | 16px | 400 | 1.5 |
| Helper text | Inter | 12px | 12px | 400 | 1.5 |
| Error text | Inter | 12px | 12px | 500 | 1.5 |
| CTA button | Inter | 16px | 16px | 600 | 1 |
| Progress label | Inter | 11px | 12px | 500 | 1 |
| Reassurance badge | Inter | 13px | 14px | 500 | 1.4 |

> **Pourquoi 16px min sur les inputs** : iOS Safari zoom auto si font-size < 16px
> sur input. C'est non négociable mobile-MA.

### 2.3 Spacing scale (Tailwind)

| Token | Pixels | Usage wizard |
|---|---|---|
| `2` | 8px | Gap entre label et input |
| `3` | 12px | Padding interne badge |
| `4` | 16px | Padding input, gap entre fields |
| `5` | 20px | Margin entre groupes de fields |
| `6` | 24px | Padding interne carte wizard |
| `8` | 32px | Margin entre sections |
| `12` | 48px | Hauteur input et CTA |

### 2.4 Radii & shadow

| Token | Valeur | Usage |
|---|---|---|
| `rounded-md` | 6px | Inputs, badges |
| `rounded-lg` | 8px | Cards |
| `rounded-xl` | 12px | Wizard container (desktop) |
| `rounded-full` | 9999px | Progress dots, CTA "Commander en 30s" (option) |
| `shadow-sm` | 0 1px 2px rgba(0,0,0,.05) | Card subtle |
| `shadow-md` | 0 4px 6px rgba(0,0,0,.07), 0 2px 4px rgba(0,0,0,.06) | Drawer mobile, popover combobox |

### 2.5 Z-index

| Couche | z-index |
|---|---|
| Wizard body | 0 |
| Combobox popover | 50 |
| Sticky CTA footer | 40 |
| Mobile drawer overlay | 60 |
| Toast | 70 |
| Modal (rare) | 80 |

### 2.6 Icônes premium — Lucide stroke 1.5 (charte unique)

> **Règle non négociable** : toutes les icônes du checkout funnel utilisent Lucide
> avec `strokeWidth={1.5}` exclusivement. Pas de glyphes système, pas d'emoji
> à la place d'une icône fonctionnelle (les emojis restent autorisés dans le
> copywriting expressif, ex: "Merci Sara 💗", mais pas comme UI affordance).

| Contexte | Icône Lucide | Size | Stroke | Couleur token |
|---|---|---|---|---|
| Validation field OK | `CheckCircle2` | 18px | 1.5 | `text-success` |
| Erreur field | `AlertCircle` | 16px | 1.5 | `text-destructive` |
| Stock in_stock | `CheckCircle2` | 18px | 1.5 | `text-success` |
| Stock low_stock | `AlertTriangle` | 18px | 1.5 | `text-amber-600` |
| Stock restocking | `Clock` | 18px | 1.5 | `text-blue-600` |
| Stock out_of_stock | `XCircle` | 18px | 1.5 | `text-destructive` |
| Mode paiement COD | `Banknote` | 20px | 1.5 | `text-foreground` |
| Mode paiement Bank | `Landmark` | 20px | 1.5 | `text-foreground` |
| Bouton WhatsApp | `MessageCircle` (override SVG WhatsApp brand) | 20px | 1.5 | `text-success` |
| Email confirmation | `Mail` | 18px | 1.5 | `text-foreground` |
| Cadenas SSL | `ShieldCheck` | 16px | 1.5 | `text-muted-foreground` |
| Livraison rapide | `Truck` | 16px | 1.5 | `text-muted-foreground` |
| Step terminé (progress) | `Check` | 14px | 2 (filled circle) | `text-primary-foreground` |
| Réessayer | `RotateCcw` | 16px | 1.5 | `text-primary` |
| Back arrow (RTL safe) | `ChevronLeft` / `ChevronRight` logique | 18px | 1.5 | `text-foreground` |
| Combobox dropdown | `ChevronsUpDown` | 16px | 1.5 | `text-muted-foreground` |

**Import pattern** :
```tsx
import { CheckCircle2, AlertTriangle, Clock, XCircle, Banknote, Landmark, Mail, ShieldCheck, Truck } from 'lucide-react';

<CheckCircle2 className="w-4.5 h-4.5" strokeWidth={1.5} aria-hidden />
```

**A11y** :
- Toute icône décorative : `aria-hidden="true"`
- Icône qui porte du sens sans label texte adjacent : `role="img"` + `aria-label="…"`
- Jamais d'icône seule pour un bouton interactif sans `aria-label`

### 2.7 Badges signature

> Famille de badges réutilisée à travers le wizard. Une seule forme géométrique
> (`rounded-md` pour le rectangle, `rounded-full` pour le pill), un seul jeu de
> couleurs, deux tailles (`sm` 24px / `md` 28px).

| Badge | Variant | Background | Border | Texte | Icône leading |
|---|---|---|---|---|---|
| **Trust seal "Sécurisé"** | pill md | `bg-muted` | `border-border` | `text-foreground` | `ShieldCheck` 14px stroke 1.5 |
| **Trust seal "Livraison 24-48h"** | pill md | `bg-accent` | `border-rose-200` | `text-accent-foreground` | `Truck` 14px stroke 1.5 |
| **Trust seal "Paiement à la livraison"** | pill md | `bg-muted` | `border-border` | `text-foreground` | `Banknote` 14px stroke 1.5 |
| **Stock "limité"** | pill sm | `bg-amber-50` | `border-amber-200` | `text-amber-900` | `AlertTriangle` 12px stroke 1.5 + pulse |
| **Stock "rupture"** | pill sm | `bg-red-50` | `border-red-200` | `text-destructive` | `XCircle` 12px stroke 1.5 |
| **Stock "réappro"** | pill sm | `bg-blue-50` | `border-blue-200` | `text-blue-900` | `Clock` 12px stroke 1.5 |
| **Confirmation "Envoyée"** | pill sm | `bg-success/10` | `border-success/30` | `text-success` | `CheckCircle2` 12px stroke 1.5 |
| **Promo appliquée** | pill sm | `bg-accent` | `border-rose-200` | `text-accent-foreground` | `BadgePercent` 12px stroke 1.5 |
| **Étape complétée** (progress) | dot circle | `bg-primary` | — | — | `Check` 10px stroke 2 (filled) |

**Anatomy code** :
```tsx
// apps/web/src/components/ui/Badge.tsx (existant ou créé)
export const trustBadgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium leading-none border',
  {
    variants: {
      tone: {
        neutral: 'bg-muted border-border text-foreground',
        signature: 'bg-accent border-rose-200 text-accent-foreground',
        warning: 'bg-amber-50 border-amber-200 text-amber-900',
        danger: 'bg-red-50 border-red-200 text-destructive',
        info: 'bg-blue-50 border-blue-200 text-blue-900',
        success: 'bg-success/10 border-success/30 text-success',
      },
      size: {
        sm: 'h-6 text-[11px]',
        md: 'h-7 text-xs',
      },
    },
    defaultVariants: { tone: 'neutral', size: 'md' },
  },
);
```

### 2.8 Élévations & micro-interactions premium

| Surface | Élévation au repos | Hover | Active | Focus visible |
|---|---|---|---|---|
| Card wizard desktop | `shadow-sm` | — | — | — |
| Card mobile (≤768px) | aucune (pleine largeur) | — | — | — |
| CTA primary | aucune | `bg-primary/90` + `translate-y-[-0.5px]` | `translate-y-[0px]` + `bg-primary/95` | `ring-2 ring-primary/30 ring-offset-2` |
| Radio card paiement | `border-border` | `border-foreground/40 + bg-muted/50` | `border-primary bg-accent/40` | `ring-2 ring-primary/30 ring-offset-2` |
| Badge trust | aucune | — | — | — |
| Combobox option | aucune | `bg-muted` | `bg-accent` | — |
| Stock card | `shadow-sm` (subtle) | — | — | — |

**Transitions** : `transition-[transform,background-color,border-color,box-shadow] duration-150 ease-out` partout. **Pas de glow néon**, pas d'ombres colorées agressives — l'élégance vient de la cohérence, pas du clinquant.

**Reduced motion** : `@media (prefers-reduced-motion: reduce)` désactive `translate-y`, `pulse`, et `scale` partout dans le wizard. Les changements de couleur restent (feedback fonctionnel non décoratif).

---

## 3. Layout du wizard

### 3.1 Container

**Desktop (≥ 1024px)** :
- Wizard centré horizontalement
- max-width : `560px`
- padding-inline : `32px`
- Background : `--background`
- Border radius : `12px`
- Shadow : `shadow-md` autour
- Marge top : `48px` (sous header global)

**Tablet (768-1023px)** :
- max-width : `100%` jusqu'à `640px`
- padding-inline : `24px`
- Border radius : `8px`

**Mobile (< 768px)** :
- Full width
- padding-inline : `16px`
- Pas de border radius (edge-to-edge)
- Pas de shadow

### 3.2 Internal vertical rhythm

```
┌─────────────────────────────────────┐
│ [Progress bar — 4px height]         │  ← top: 0
├─ 24px gap (pt-6) ───────────────────┤
│ [Step title — 24px semibold]        │
├─ 8px gap ───────────────────────────┤
│ [Step subtitle — 14px regular muted]│
├─ 32px gap (mt-8) ───────────────────┤
│ [Fields stack avec gap-5 (20px)]    │
│   ├─ Field 1                        │
│   ├─ Field 2                        │
│   └─ Field N                        │
├─ 32px gap ──────────────────────────┤
│ [Reassurance badges row]            │
├─ 24px gap ──────────────────────────┤
│ [CTA primary full-width — 48px]     │
├─ 12px gap ──────────────────────────┤
│ [Secondary link "← Étape précédente"]│
├─ 24px gap ──────────────────────────┤
│ [Trust seals: SSL · Paiement sécurisé · 24-48h] │  ← bottom: 24px
└─────────────────────────────────────┘
```

---

## 4. Anatomie globale

### 4.1 Header (toujours visible)

```
┌─────────────────────────────────────────────┐
│ [Logo 32px]   ← back   Step 2 sur 4   FR|AR │  ← height 56px desktop, 48px mobile
└─────────────────────────────────────────────┘
```

- Logo : 32×32 SVG, click → home (avec confirm "Quitter le checkout ?" si lead saisi)
- Back arrow : tap target 48×48, désactivé sur Step 1
- "Step N sur 4" : `text-xs text-muted-foreground` (style fonctionnel, pas décoratif)
- Toggle langue : segmented `FR | AR`, 48×32 touch, persists in cookie `NEXT_LOCALE`

### 4.2 Progress bar

```
┌─────────────────────────────────────────────┐
│ ━━━━━━●━━━━━━○━━━━━━○━━━━━━○                │  ← Step 2 actif
└─────────────────────────────────────────────┘
```

- Hauteur : 4px (track) + 12px dot
- Track : `bg-muted` (slate-100)
- Active : `bg-primary` (slate-900)
- Done : `bg-success` (green-600), checkmark interne 8px white
- Inactive dot : `border-2 border-muted bg-background`
- Anim : fill smooth `width transition 280ms ease-out` quand on passe au step suivant
- Aria : `<progress max="4" value="2" aria-label="Étape 2 sur 4">` + visually-hidden détail "Contact validé, Adresse en cours"

### 4.3 Footer (sticky uniquement sur mobile)

**Mobile uniquement** : footer sticky en bas, `position: fixed; bottom: 0; left: 0; right: 0;`
- Hauteur : `80px` (incluant safe-area-inset-bottom)
- Background : `--background`
- Border-top : `1px solid --border`
- Padding : `12px 16px 16px` (avec safe-area)
- Contient : CTA primary (full-width)
- Box-shadow vers haut : `0 -4px 12px rgba(0,0,0,.06)`

**Desktop** : pas de footer sticky. CTA inline dans le flow.

---

## 5. Step 1 — Lead capture

### 5.1 Objectif & contenu

**Objectif business** : convertir un visiteur anonyme en lead identifié (DB row), AVANT d'exiger plus.

**Minimum requis pour avancer** :
- Prénom (≥ 2 chars)
- Téléphone marocain valide

**Champs optionnels** (cachables via admin config) :
- Email (toggle ON par défaut, demandé "pour l'email de confirmation")
- Nom (toggle OFF par défaut)

### 5.2 Wireframe

```
┌─────────────────────────────────────────────┐
│              ━●━━○━━○━━○                    │
│                                             │
│  Recevez votre kit FemiGlow en 24-48h          │
│  Pas de carte. Pas de compte. 30 secondes.  │
│                                             │
│  Prénom                                     │
│  ┌─────────────────────────────────────┐    │
│  │ Sara                                │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  Téléphone                                  │
│  ┌──────┬──────────────────────────────┐    │
│  │ +212 │ 6 12 34 56 78                │    │
│  └──────┴──────────────────────────────┘    │
│  ↳ On vous enverra un SMS de confirmation   │
│                                             │
│  ☐ Email (optionnel)                        │
│  [hidden tant que pas cliqué]               │
│                                             │
│  ✓ Paiement à la livraison                  │
│  ✓ Livraison 24-48h partout au Maroc           │
│  ✓ Garantie satisfait ou remboursé 14j      │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │   Continuer →                       │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  🔒 Vos données sont sécurisées (SSL)       │
└─────────────────────────────────────────────┘
```

### 5.3 Spécif champs

**Prénom** :
- Type : `text`
- `autocomplete="given-name"`
- `inputmode="text"`
- Validation Zod : `z.string().trim().min(2, "Minimum 2 caractères").max(50, "Maximum 50 caractères")`
- Erreur affichée au blur si invalide
- État initial : focus auto si Step 1 vide (mobile uniquement, pas desktop pour éviter le zoom unwanted)

**Téléphone** :
- Layout split : prefix `+212` (lecture seule, `bg-muted`, `font-mono`) + input numérique
- Type : `tel`
- `autocomplete="tel-national"`
- `inputmode="numeric"`
- Pattern : `[0-9 ]*`
- Mask : `6XX XX XX XX` ou `7XX XX XX XX` — formatage live au fur et à mesure
- Validation Zod : `phoneMaroc9DigitsSchema` (existant) : 9 chiffres après préfixe, commence par 6 ou 7
- Erreur affichée :
  - À la frappe : seulement format invalide (trop de chiffres)
  - Au blur : "Numéro marocain invalide (doit commencer par 06 ou 07)"
- Sur valid + blur → trigger `POST /api/checkout/lead` (debounced 600ms après dernier change valide)

**Email (optionnel)** :
- Affiché comme link `+ Ajouter mon email (optionnel)`
- Tap → expand l'input avec smooth height transition
- Type : `email`
- `autocomplete="email"`
- `inputmode="email"`
- Validation : `z.string().email().optional()`

### 5.4 États du CTA "Continuer →"

| État | Apparence | Trigger |
|---|---|---|
| **Disabled** | `bg-muted text-muted-foreground cursor-not-allowed opacity-60` | Form invalid OU lead_id pas encore créé côté serveur |
| **Idle (enabled)** | `bg-primary text-primary-foreground hover:opacity-90` | Form valid AND lead créé |
| **Loading** | Spinner 16px + text "Création..." | Pendant `POST /lead` |
| **Success transient** | Bref ✓ green flash 200ms avant transition step | Après réussite création lead |
| **Error** | Toast en haut (pas bouton qui change) | Erreur réseau |

### 5.5 Reassurance badges (sous CTA)

3 badges horizontaux row gap-3 sur desktop, vertical stack sur mobile :
- ✓ icon green 16px + texte 13px
- Texte non scrollable, pas wrappé

---

## 6. Step 2 — Adresse

### 6.1 Wireframe

```
┌─────────────────────────────────────────────┐
│              ━●━━●━━○━━○                    │
│                                             │
│  Où devons-nous livrer ?                    │
│  Livraison 24-48h dans tout le Maroc        │
│                                             │
│  ┌───── Stock indicator (premium) ──────┐   │
│  │ 🟢 En stock — 12 kits disponibles    │   │
│  │    Expédition immédiate              │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  Ville                                      │
│  ┌─────────────────────────────────────┐    │
│  │ 🔍 Tapez votre ville           ▼    │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  Adresse complète                           │
│  ┌─────────────────────────────────────┐    │
│  │ Rue, immeuble, appartement          │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  Code postal (optionnel)                    │
│  ┌─────────┐                                │
│  │ 20000   │                                │
│  └─────────┘                                │
│                                             │
│  Repère (optionnel)                         │
│  ┌─────────────────────────────────────┐    │
│  │ Près de la pharmacie X              │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │   Continuer →                       │    │
│  └─────────────────────────────────────┘    │
│  ← Étape précédente                         │
└─────────────────────────────────────────────┘
```

### 6.2 City Combobox (composant clé)

**Tech stack** : React Aria `useComboBox` + Fuse.js + dataset GeoNames MA (`apps/web/src/lib/geo/morocco-cities.ts`).

**Comportement** :
- Tap → ouverture popover sous l'input
- Tape "casa" → suggestions :
  - Casablanca (~13 M hab.)
  - Casa-Anfa
  - Casa-Aïn Sebaâ
  - Casa-Hay Hassani
- Algorithme : Fuse.js avec keys `["name", "name_ar", "name_fr_alt"]`, threshold `0.3`
- ASCII-tolerant : "casablanca" trouve "Casablanca", "merrakech" trouve "Marrakech"
- RTL : si `dir="rtl"`, search par `name_ar` aussi
- Empty state : "Aucune ville trouvée. [Saisir manuellement →]"
  - Le link "Saisir manuellement" replace le combobox par un input texte libre (fallback)
- Popover :
  - max-height 280px (~7 items)
  - scrollable
  - keyboard nav : `↑↓` highlight, `Enter` select, `Esc` close
  - mouse hover : `bg-muted`
  - selected : `bg-accent text-accent-foreground`
- ARIA :
  - `role="combobox"` `aria-expanded` `aria-controls` `aria-activedescendant`
  - Popover listbox : `role="listbox" aria-label="Villes disponibles"`
  - Items : `role="option" aria-selected`

### 6.3 Champs adresse

**Adresse complète** :
- Type : `text`
- `autocomplete="street-address"`
- `inputmode="text"`
- Validation : `z.string().trim().min(5).max(150)`
- Placeholder : "Rue, immeuble, appartement"

**Code postal (optionnel)** :
- Type : `text`
- `inputmode="numeric"`
- `autocomplete="postal-code"`
- Mask : 5 chiffres
- Validation : `z.string().regex(/^\d{5}$/).optional()`
- Pré-rempli si ville sélectionnée a un postal_code dans le dataset (auto-fill subtle)

**Repère (optionnel)** :
- Type : `text`
- Validation : `z.string().max(100).optional()`
- Helper : "Aide le livreur à vous trouver plus vite"

### 6.4 Stock indicator (urgency + transparency)

**Pattern UX** : Kolenda Pricing #7 (scarcity authentique) + Baymard 2024 (stock
transparency réduit l'abandon de 12 %). Affiché en haut de l'étape 2, avant les
champs adresse — c'est le moment où l'utilisateur s'engage sur la logistique.

**Composant** : `<StockIndicator productId={kit.productId} />` (RSC, fetch
`GET /api/checkout/stock/[productId]` côté serveur, fallback skeleton 200ms).

**4 états visuels** (driven by `stock_units` + `low_stock_threshold`) :

| État | Condition | Visuel | Copy FR | Copy AR |
|---|---|---|---|---|
| **En stock** | `stock_units > low_stock_threshold` | `bg-success/10 border-success/30`, icône `CheckCircle2` 18px stroke 1.5 verte | « En stock — Expédition sous 24-48h » | « متوفر — الشحن خلال 24-48 ساعة » |
| **Stock limité** | `0 < stock_units ≤ low_stock_threshold` | `bg-warning/10 border-warning/30`, icône `AlertTriangle` 18px stroke 1.5 ambre, **pulse animation subtle** | « Plus que {n} kits disponibles — Commandez vite » | « يبقى فقط {n} طقم — اطلبي بسرعة » |
| **Rupture (réapprovisionnement)** | `stock_units = 0` AND `restock_eta_days != null` | `bg-info/10 border-info/30`, icône `Clock` 18px stroke 1.5 | « Réapprovisionnement sous {restock_eta_days} jours » | « إعادة التموين خلال {restock_eta_days} يوم » |
| **Rupture totale** | `stock_units = 0` AND `restock_eta_days = null` | `bg-destructive/10 border-destructive/30`, icône `XCircle` 18px stroke 1.5 | « Indisponible temporairement — Soyez prévenu·e » + email opt-in | « غير متوفر مؤقتاً — كوني أول من يعلم » + email opt-in |

**Spec visuelle** :
- Container : `rounded-lg border px-4 py-3 mb-6`
- Icon : Lucide stroke 1.5, taille 18px, aligné `flex items-start gap-3`
- Titre : `text-sm font-medium` couleur de l'état
- Sous-titre : `text-xs text-muted-foreground mt-0.5`
- Animation pulse (stock limité) : `animate-pulse-slow` (custom @keyframes 2s ease-in-out infinite)
- **Reduced-motion** : si `prefers-reduced-motion: reduce`, pas d'animation pulse

**Comportement** :
- En "stock limité", **n** s'actualise en temps réel via polling 60s si l'utilisateur
  reste sur Step 2 (signal `seller serieux`, pas manipulation : valeur DB réelle).
- En "rupture (réapprovisionnement)" : le bouton **Continuer** reste cliquable —
  l'utilisateur peut commander en pré-vente (badge "Pré-commande" affiché sur Step 3 et Step 4).
- En "rupture totale" : bouton **Continuer** disabled, form a11y `aria-disabled="true"`,
  email opt-in `<StockNotifyOptIn />` proposé (POST `/api/checkout/stock-notify`).

**Tracking GTM** :
- `stock_indicator_view` : `{state, units, threshold}` à l'affichage
- `stock_notify_optin` : si email saisi en rupture totale

**Admin-adjustable** : `low_stock_threshold` (par produit) défini dans `/admin/products/stock`
(cf. `07-admin-form-management.md §6 Stock management`).

---

## 7. Step 3 — Paiement

### 7.1 Wireframe

```
┌─────────────────────────────────────────────┐
│              ━●━━●━━●━━○                    │
│                                             │
│  Comment souhaitez-vous payer ?             │
│  Tous les modes sont sécurisés               │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │ ⦿  💵 À la livraison (recommandé)   │    │
│  │     Réglez à la réception, en cash  │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │ ○  🏦 Virement bancaire             │    │
│  │     IBAN affiché après commande     │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ── Récapitulatif ──                        │
│  Kit FemiGlow × 1            29,00 €        │
│  Livraison                   Gratuite       │
│  ─────────────────────────────              │
│  Total                       29,00 €        │
│                                             │
│  Code promo                                 │
│  ┌─────────────────┐ ┌─────────┐            │
│  │ Entrez le code  │ │ Appliquer│           │
│  └─────────────────┘ └─────────┘            │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │   Confirmer ma commande →           │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  En confirmant, vous acceptez nos           │
│  CGV et politique de confidentialité.       │
│  ← Étape précédente                         │
└─────────────────────────────────────────────┘
```

### 7.2 Radio paiement

**Layout** : stack vertical de "cards" :
- Hauteur 72px chacune
- Border `1px solid --border`, radius `8px`
- Padding `16px`
- Selected : `border-2 border-primary bg-accent/30`
- Hover (desktop) : `bg-muted/50`
- Disabled (option indisponible géographiquement) : `opacity-50 cursor-not-allowed`
- Le radio (cercle 20px) est à gauche, l'icône emoji 24px ensuite, le label
- Label gras 16px + sublabel muted 13px en dessous

### 7.3 Récap commande

- Section séparée par un divider 1px slate-200
- Lignes alignées left/right
- Total : `font-semibold text-lg`
- Si frais de livraison gratuits : afficher "Gratuite" en `text-success`

### 7.4 Code promo

- Input + bouton "Appliquer" côte à côte (flex gap-2)
- État "applied" : input devient lecture seule, bouton devient "Retirer" link, prix réajusté avec strikethrough sur ancien total
- État "invalid" : message rouge sous input "Code expiré ou invalide"

### 7.5 Consentement implicite à la soumission

**Pattern UX** : pas de checkbox bloquante. Le consentement est **implicite à l'action
de confirmation** (modèle adopté par Amazon, Stripe Checkout, Booking, Shopify).
Sous le CTA, un disclaimer micro-copy explicite :

```
En confirmant, vous acceptez nos [CGV] et notre [politique de confidentialité].
```

- Disclaimer `text-xs text-muted-foreground`, centré sous le CTA, `mt-3`
- Liens CGV / privacy en `underline underline-offset-2 hover:text-primary`
- Click sur les liens → ouvre nouvelle page (`target="_blank" rel="noopener"`)
- AR : `بالضغط على "تأكيد"، تقبل [الشروط] و [سياسة الخصوصية].`
- **Audit trail** : au POST `/finalize`, le serveur écrit `chat_lead.consented_at = now()`
  automatiquement avec `consent_version` + `ip` + `user_agent`. C'est ce timestamp
  qui fait foi pour la loi 09-08 (preuve d'acceptation lors de la transaction).
- **Aucun champ form obligatoire** : pas de `consent: z.literal(true)`. Le CTA n'est
  jamais disabled à cause du consentement.

### 7.6 CTA "Confirmer ma commande →"

- Idle : full-width, primary
- Loading (pendant POST finalize) : spinner + "Création de votre commande..."
- Désactive **tout le formulaire** pendant le loading (overlay subtle `opacity-60 pointer-events-none`)
- Sur succès → animation step-out fluid + redirige `/merci/[orderId]`
- Sur erreur réseau → toast + retry button visible 5s

---

## 8. Step 4 — Confirmation (Thank-You)

### 8.1 Wireframe

```
┌─────────────────────────────────────────────┐
│              ━●━━●━━●━━●                    │  ← all done
│                                             │
│           ╔═════════════╗                   │
│           ║  Lottie 🎉  ║   (180px square)  │
│           ╚═════════════╝                   │
│                                             │
│       Merci Sara ! 💗                       │
│                                             │
│   Votre commande #FG-A4B7C2 est confirmée   │
│   On vous livre sous 24-48h à Casablanca    │
│                                             │
│   ── Récapitulatif ──                       │
│   Kit FemiGlow × 1            29,00 €       │
│   Livraison                   Gratuite      │
│   ─────────────────────────────             │
│   Total                       29,00 €       │
│                                             │
│   Vous recevrez un SMS de confirmation       │
│   au +212 6 XX XX XX XX dans quelques min.  │
│                                             │
│   ── Recevoir aussi par email ? ─────       │
│   ┌─────────────────────────────────────┐   │
│   │ sara@example.com         (optionnel)│   │
│   └─────────────────────────────────────┘   │
│   ┌─────────────────────────────────────┐   │
│   │   ✉️  M'envoyer la confirmation     │   │
│   └─────────────────────────────────────┘   │
│   ↑ état succès : ✓ Confirmation envoyée    │
│                                             │
│   ┌─────────────────────────────────────┐   │
│   │   💬 Discuter avec un expert        │   │
│   └─────────────────────────────────────┘   │
│                                             │
│   Vous aimerez aussi :                      │
│   [Cross-sell carousel — 2 produits]        │
│                                             │
└─────────────────────────────────────────────┘
```

### 8.2 Lottie animation

**Asset** : `apps/web/public/lottie/checkout-success.lottie` (format `.lottie`, ~30 KB).

**Spec animation** :
- Durée : 2,5s
- Loop : non (joue 1 fois)
- Autoplay : oui
- Style : célébration FemiGlow (paillettes rose + checkmark) — designer fournit
- Fallback si Lottie ne charge pas : SVG checkmark green 80px avec scale-in animation CSS

**Implémentation** :
```tsx
const DotLottieReact = dynamic(
  () => import('@lottiefiles/dotlottie-react').then(m => m.DotLottieReact),
  { ssr: false, loading: () => <CheckmarkFallback /> }
);
```

### 8.3 Récap

- Mêmes lignes que Step 3 mais en lecture seule
- Texte `text-success` "Confirmée" en haut

### 8.4 Email opt-in (optionnel)

**Objectif** : capturer un email facultatif pour recevoir une confirmation détaillée et faciliter le remarketing (transac + cycle de vie).

**Comportement** :
- Bloc encadré, fond `bg-muted/30`, padding 16px, séparé du récap par 24px de gutter
- Label : *"Recevoir aussi la confirmation par email ?"* (sm font)
- Champ `<WizardField type="email" optional>` avec placeholder `sara@example.com` et helper `Format : nom@domaine.com`
- CTA secondaire : *"M'envoyer la confirmation"* (icône `Mail` Lucide stroke 1.5, 18px)
- Validation Zod : `z.string().email().optional()` côté client + serveur
- Submit → `PATCH /api/checkout/order/[orderId]/email` avec `{ email }` et `Idempotency-Key`
- États du CTA :
  - `idle` → primary outline
  - `loading` → spinner + label "Envoi…"
  - `success` → tick `CheckCircle2` Lucide stroke 1.5 + label "Confirmation envoyée à sara@example.com" (text-success-foreground, replace le CTA)
  - `error` → message `text-destructive` + re-clic possible (retry idempotent)
- Tracking : `email_optin_submitted` + `email_optin_confirmed` (success) / `email_optin_failed`
- Aucun checkbox ni opt-in marketing par défaut — RGPD-friendly : envoi transactionnel uniquement par défaut, opt-in newsletter séparé plus tard
- A11y : `<form>` indépendant du Thank-You (Enter ne re-submit pas la commande), `aria-live="polite"` sur le bloc succès

**Micro-copy** sous le CTA en cas de succès :
> ✓ Confirmation envoyée à `sara@example.com`. Vérifiez votre boîte de réception (et les spams).

**Garde-fous** :
- Pas de re-soumission si email identique déjà envoyé (vérif serveur sur `orders.email_confirmation_sent_at`)
- Rate limit 3 essais / 10 min par order
- Email transactionnel uniquement (pas de tag marketing), template séparé

### 8.5 CTA secondaire WhatsApp

- Bouton secondary outline
- Icône WhatsApp 20px
- Link `whatsapp://send?phone=<NUMERO_FEMIGLOW>&text=<msg>` avec msg prérempli "Bonjour, je viens de commander le kit FemiGlow #FG-A4B7C2"

### 8.6 Cross-sell

- Carrousel 2 produits (cure 30j + cure 60j si commande est kit 14j)
- Lazy loaded (pas critique)
- Tap → ouvre PDP dans nouvel onglet

---

## 9. Composants atomiques

### 9.1 `<WizardField>`

**Props** :
```ts
type WizardFieldProps = {
  id: string;
  label: string;
  helperText?: string;
  errorMessage?: string;
  required?: boolean;
  optional?: boolean;        // affiche "(optionnel)" à droite du label
  prefix?: React.ReactNode;  // ex: "+212"
  suffix?: React.ReactNode;
  children: React.ReactNode; // l'input
  dir?: 'ltr' | 'rtl';
};
```

**Structure DOM** :
```html
<div data-field={id} data-state={state}>
  <label htmlFor={id}>
    {label}
    {optional && <span className="text-muted-foreground">(optionnel)</span>}
  </label>
  <div className="field-input-wrapper">
    {prefix}
    {children}
    {suffix}
  </div>
  {errorMessage ? (
    <p id={`${id}-error`} role="alert" className="text-destructive">{errorMessage}</p>
  ) : helperText ? (
    <p id={`${id}-helper`} className="text-muted-foreground">{helperText}</p>
  ) : null}
</div>
```

**États visuels** :
| State | Border | Label color | Helper visible |
|---|---|---|---|
| `idle` | `border-slate-200` | `text-foreground` | helperText |
| `focused` | `border-primary ring-2 ring-primary/20` | `text-primary` | helperText |
| `valid` | `border-success` (subtle) | `text-foreground` | optional ✓ checkmark à droite de l'input |
| `error` | `border-destructive` | `text-destructive` | errorMessage rouge |
| `disabled` | `border-slate-200 bg-muted` | `text-muted-foreground` | — |

### 9.2 `<WizardButton>` (CTA)

**Variants** : `primary` | `secondary` | `ghost`
**Sizes** : `default` (48px) | `sm` (40px)
**Width** : `full` (mobile) | `auto` (desktop)

**Primary structure** :
```tsx
<button
  type="submit"
  disabled={disabled}
  className={cn(
    "h-12 rounded-md font-semibold text-base",
    "bg-primary text-primary-foreground",
    "hover:opacity-90 active:scale-[0.99]",
    "disabled:opacity-60 disabled:cursor-not-allowed",
    "transition-all duration-200",
    "w-full md:w-auto md:px-8"
  )}
>
  {loading && <Spinner size={16} />}
  {label}
  {!loading && <ArrowRight size={16} />}
</button>
```

### 9.3 `<WizardCombobox>`

**Props** :
```ts
type WizardComboboxProps<T> = {
  id: string;
  label: string;
  placeholder?: string;
  items: T[];
  itemToString: (item: T) => string;
  itemToValue: (item: T) => string;
  onSelect: (item: T) => void;
  selectedValue?: string;
  searchKeys: (keyof T)[];
  emptyMessage?: string;
  onEmptyAction?: { label: string; handler: () => void };
  dir?: 'ltr' | 'rtl';
};
```

### 9.4 `<WizardRadioGroup>`

Stack vertical de "cards" radio (cf. §7.2).

### 9.5 `<WizardCheckbox>`

```tsx
<label className="flex items-start gap-3 cursor-pointer">
  <input
    type="checkbox"
    className="mt-0.5 size-5 rounded border-slate-300 text-primary focus:ring-primary/40"
  />
  <span className="text-sm">{children}</span>
</label>
```

### 9.6 `<WizardProgress>`

cf. §4.2.

### 9.7 `<WizardToast>`

**Position** : `top-4 inset-x-4` mobile, `top-6 right-6` desktop.
**Variants** : `success` (green), `error` (red), `info` (slate).
**Auto-dismiss** : 5s (error), 3s (success).
**Action button optionnel** : "Réessayer" (sur erreur réseau).

---

## 10. États & feedback

### 10.1 Loading

| Cas | Apparence |
|---|---|
| Submit lead (Step 1) | CTA → spinner + "Création..." (300ms minimum visible) |
| Patch address (Step 2 debounced) | Subtle dot bouncing à droite du champ ville, disparaît au succès |
| Submit finalize (Step 3) | Overlay opacity-30 sur form + spinner centré + texte "Création de votre commande..." |
| Lottie loading (Step 4) | Fallback SVG checkmark immédiat |

### 10.2 Erreur

| Type | Apparence | Action |
|---|---|---|
| Validation field (Zod) | Border red + helper-text red sous field | Pas d'action, fix manuel |
| Réseau (fetch fail) | Toast top + "Réessayer" button | Retry manuel ou auto 3x exponentiel |
| Serveur (500) | Toast + lien support WhatsApp | Contact |
| Validation serveur (422) | Mapping field-level → re-render erreurs sur fields | Re-edit |
| Idempotency conflict (409) | Toast info "Commande déjà créée" + redirige `/merci/[id]` | Auto-redirige |
| Rate limit (429) | Toast "Trop d'essais, patientez 1 min" | Disable CTA 60s |

### 10.3 Success

- Inline check 16px green à droite du field (apparaît au blur valid)
- Step transition : fade-out current + fade-in next, durée 250ms
- Final step : Lottie + redirect (pas de page intermediate)

---

## 11. Animations & transitions

| Élément | Animation | Durée | Easing |
|---|---|---|---|
| Step → Step | translateX(20px) + fade-out → translateX(-20px) + fade-in | 280ms | `cubic-bezier(0.4, 0, 0.2, 1)` |
| Progress fill | width transition | 280ms | `ease-out` |
| Field focus | border + ring | 150ms | `ease-out` |
| CTA hover | opacity | 150ms | `ease-out` |
| CTA active (press) | scale 0.99 | 100ms | `ease-out` |
| Combobox popover open | fade + scale 0.95 → 1 | 150ms | `ease-out` |
| Toast slide-in | translateY(-100%) → 0 + fade | 200ms | `ease-out` |
| Lottie | 2500ms one-shot | n/a | n/a |
| Drawer mobile open | translateY(100%) → 0 | 250ms | `cubic-bezier(0.4, 0, 0.2, 1)` |
| Sticky CTA shadow apparait | shadow opacity | 150ms | `ease-out` |
| Skeleton (cross-sell) | shimmer infinite | 1500ms | `linear` |

**Respecter `prefers-reduced-motion`** :
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 12. Mode A — Embed sur /kit

### 12.1 Desktop layout (≥ 1024px)

```
┌─────────────────────────────────────────────────────────────────┐
│                          [Header global]                         │
├──────────────────────────────────┬──────────────────────────────┤
│                                  │                              │
│   [Bottle gallery 4:5]           │   [Wizard 560px sticky top]  │
│   [Thumbnails]                   │                              │
│                                  │   ━●━━○━━○━━○                │
│   Kit FemiGlow                   │                              │
│   29,00 € · LIVRAISON 24-48H        │   Recevez votre kit en 24-48h   │
│                                  │   [Prénom] [Téléphone]       │
│   [Description longue]           │   [CTA Continuer]            │
│                                  │                              │
│   [FAQ accordéon]                │                              │
│   [Reviews avis client]          │                              │
│                                  │                              │
└──────────────────────────────────┴──────────────────────────────┘
```

- Wizard `position: sticky; top: 96px;` (sous header)
- Container largeur fixe `560px`
- Le scroll de la page ne déplace pas le wizard
- Pas de footer sticky (CTA inline)

### 12.2 Mobile layout (< 768px)

**Trigger** : la page `/kit` montre normalement le PDP avec un bouton CTA en bas : "Commander en 30s →" (sticky bottom).

**Tap CTA** → bottom sheet drawer s'ouvre (translateY de 100% à 0).

```
┌─────────────────────────────────────┐
│  [overlay opacity-60]               │
│                                     │
│ ─── Drawer ──────────────────────── │
│  ──                                 │  ← grab handle 32×4 slate-300
│  Commander · Step 1 sur 4    ✕      │
│                                     │
│  [Same Step 1 content as standalone]│
│                                     │
└─────────────────────────────────────┘
```

- Drawer height : `90vh` (top safe area + 10vh marge)
- Pas de scroll de la page derrière
- Swipe-down sur handle → close (avec confirm si lead saisi)
- ✕ → close avec confirm

### 12.3 Tracking spécifique

- `add_to_cart` est émis automatiquement à l'ouverture du drawer (le kit est ajouté implicitement)
- `form_mode` = `'wizard_embed'`
- Si user ferme sans terminer Step 1 → event `embed_abandoned` avec `step: 'lead'`

---

## 13. Mode B — Cart sur /commander

### 13.1 Layout

- Standard wizard centered (cf. §3.1)
- En haut : récap panier compact (avec lien "← Modifier le panier" qui retourne sur `/panier`)

```
┌─────────────────────────────────────────────┐
│ [Header global]                             │
├─────────────────────────────────────────────┤
│ ━●━━○━━○━━○                                 │
│                                             │
│ Votre commande                              │
│ ┌──────────────────────────────────────┐    │
│ │ Kit FemiGlow × 1            29,00 €  │    │
│ │ Livraison 24-48H               Gratuite │    │
│ │ ─────────────────────────────        │    │
│ │ Total                       29,00 €  │    │
│ │ ← Modifier le panier                 │    │
│ └──────────────────────────────────────┘    │
│                                             │
│ [Step content]                              │
│                                             │
└─────────────────────────────────────────────┘
```

### 13.2 Différences avec Mode A

| Aspect | Mode A (embed /kit) | Mode B (cart /commander) |
|---|---|---|
| Cart pré-rempli ? | Oui (1 kit) | Oui (déjà fait sur `/panier`) |
| `add_to_cart` émis ? | Oui à ouverture drawer | Non (déjà émis sur `/kit`) |
| `form_mode` event | `wizard_embed` | `wizard_cart` |
| Step 3 récap | Récap simple | Récap + lien "Modifier panier" |
| URL | `/[locale]/kit` (drawer overlay) | `/[locale]/commander` |
| Mobile UX | Drawer | Fullscreen wizard |

---

## 14. Accessibilité

### 14.1 Standards

- **WCAG 2.1 AA** minimum sur tout le wizard
- **WCAG 2.1 AAA** sur les contrasts (text et CTA)
- axe-core CI gate : 0 violation `critical` ou `serious`

### 14.2 Semantic HTML

- `<form>` englobe chaque step
- `<fieldset>` + `<legend>` pour groupes (rare ici)
- `<button type="submit">` pour CTA, jamais `<div onClick>`
- `<label>` toujours associé via `htmlFor`
- Progress : `<nav aria-label="Étapes du checkout">` + `<ol>` avec `aria-current="step"` sur l'actif

### 14.3 Focus management

- À l'arrivée sur un step : focus auto sur le **premier champ** (sauf en mobile : on attend le tap pour éviter zoom unwanted)
- À la transition step : focus sur le step title `<h2 tabIndex={-1}>`
- Modal/drawer ouvert : focus trap (React Aria `FocusScope`)
- Sur erreur submit : focus auto sur le **premier champ invalide**
- Ring focus visible obligatoire (jamais `outline: none` sans `box-shadow` remplaçant)

### 14.4 Annonces SR

- Step change : `aria-live="polite"` annonce "Étape 2 sur 4 : Adresse"
- Error toast : `role="alert"` + `aria-live="assertive"`
- Loading state CTA : `aria-busy="true"` sur button
- Combobox results : `aria-live="polite"` count "5 villes trouvées"
- Submit success : `aria-live="polite"` "Commande confirmée, redirection..."

### 14.5 Clavier

| Touche | Action |
|---|---|
| `Tab` | Navigation entre champs |
| `Shift+Tab` | Retour arrière |
| `Enter` sur input | Validate field, focus next (ou submit si dernier) |
| `Enter` sur CTA | Submit |
| `Esc` sur drawer/modal | Close (avec confirm si données saisies) |
| `↑↓` sur combobox | Navigate items |
| `Enter` sur combobox item | Select |
| `Esc` sur combobox | Close popover, focus retourne sur input |

### 14.6 Contrastes (vérifiés)

| Combo | Ratio | WCAG |
|---|---|---|
| `--foreground` (#0F172A) sur `--background` (#FFFFFF) | 16.78:1 | AAA |
| `--primary-foreground` (#FFF) sur `--primary` (#0F172A) | 16.78:1 | AAA |
| `--muted-foreground` (#64748B) sur `--background` | 4.78:1 | AA |
| `--destructive` (#DC2626) sur `--background` | 5.16:1 | AA |
| `--success` (#16A34A) sur `--background` | 3.97:1 | AA Large |

> Le success est AA Large uniquement : ne JAMAIS l'utiliser sur du texte < 18px regular.
> Pour les small texts on utilise `text-green-700` (#15803D) = 4.5:1 AA.

---

## 15. i18n FR + AR (RTL)

### 15.1 Stack

- `next-intl` (déjà en place)
- Messages : `apps/web/messages/fr/checkout.json`, `apps/web/messages/ar/checkout.json`
- Server-side : `locale` détecté dans URL `[locale]`, propagé via `getTranslations`
- Client-side : `useTranslations('checkout')`

### 15.2 Structure messages

```jsonc
// apps/web/messages/fr/checkout.json
{
  "wizard": {
    "step1": {
      "title": "Recevez votre kit FemiGlow en 24-48h",
      "subtitle": "Pas de carte. Pas de compte. 30 secondes.",
      "fields": {
        "firstName": { "label": "Prénom", "placeholder": "Sara" },
        "phone": { "label": "Téléphone", "helper": "On vous enverra un SMS de confirmation" }
      },
      "cta": "Continuer",
      "reassurance": [
        "Paiement à la livraison",
        "Livraison 24-48h partout au Maroc",
        "Garantie satisfait ou remboursé 14j"
      ]
    },
    "step2": { /* ... */ },
    "step3": { /* ... */ },
    "step4": { /* ... */ }
  }
}
```

### 15.3 RTL

**Activation** : si `locale === 'ar'`, le `<html dir="rtl">` est posé côté layout.

**Tailwind logical properties** :
- `me-2` (margin-inline-end) au lieu de `mr-2`
- `ps-4` (padding-inline-start) au lieu de `pl-4`
- Tout flippe automatiquement

**Cas spécifiques** :
- Progress bar : direction de la "filling" inversée (toujours du début vers la fin logique)
- Arrow CTA `→` devient `←` (utiliser `rtl:rotate-180` ou logical Arrow component)
- Phone prefix `+212` : reste LTR (numérique), c'est une exception RTL — utiliser `<bdi>` ou `unicode-bidi: isolate`
- Combobox popover : aligné droite en RTL

**Test obligatoire** : Playwright `wizard-rtl.spec.ts` couvre les 4 steps en `locale=ar`.

---

## 16. Copywriting source

### 16.1 Step 1 — Lead

| Élément | FR | AR |
|---|---|---|
| Title | Recevez votre kit FemiGlow en 24-48h | استلمي طقم FemiGlow في 24-48 ساعة |
| Subtitle | Pas de carte. Pas de compte. 30 secondes. | بدون بطاقة. بدون حساب. 30 ثانية. |
| Prénom label | Prénom | الاسم |
| Téléphone label | Téléphone | الهاتف |
| Téléphone helper | On vous enverra un SMS de confirmation | سنرسل لك رسالة SMS للتأكيد |
| Email link | + Ajouter mon email (optionnel) | + أضيفي بريدك الإلكتروني (اختياري) |
| CTA | Continuer | متابعة |
| Reassurance 1 | Paiement à la livraison | الدفع عند الاستلام |
| Reassurance 2 | Livraison 24-48h partout au Maroc | توصيل خلال 24-48 ساعة في كل المغرب |
| Reassurance 3 | Garantie satisfait ou remboursé 14j | ضمان الرضا أو استرداد المال خلال 14 يوم |
| SSL note | 🔒 Vos données sont sécurisées (SSL) | 🔒 بياناتك مؤمنة (SSL) |

### 16.2 Step 2 — Adresse

| Élément | FR | AR |
|---|---|---|
| Title | Où devons-nous livrer ? | إلى أين نوصل لك؟ |
| Subtitle | Livraison 24-48h dans tout le Maroc | توصيل في 24-48 ساعة في كل المغرب |
| Ville label | Ville | المدينة |
| Ville placeholder | Tapez votre ville | اكتبي اسم مدينتك |
| Adresse label | Adresse complète | العنوان الكامل |
| Adresse placeholder | Rue, immeuble, appartement | الشارع، العمارة، الشقة |
| Code postal label | Code postal (optionnel) | الرمز البريدي (اختياري) |
| Repère label | Repère (optionnel) | معلم قريب (اختياري) |
| Repère helper | Aide le livreur à vous trouver plus vite | يساعد عامل التوصيل على إيجادك بسرعة |
| CTA | Continuer | متابعة |
| Back link | ← Étape précédente | → الخطوة السابقة |

### 16.3 Step 3 — Paiement

| Élément | FR | AR |
|---|---|---|
| Title | Comment souhaitez-vous payer ? | كيف تفضلين الدفع؟ |
| Subtitle | Tous les modes sont sécurisés | كل طرق الدفع مؤمنة |
| Option COD label | À la livraison (recommandé) | عند الاستلام (موصى به) |
| Option COD desc | Réglez à la réception, en cash | ادفعي عند الاستلام، نقدًا |
| Option Bank label | Virement bancaire | تحويل بنكي |
| Option Bank desc | IBAN affiché après commande | IBAN يظهر بعد الطلب |
| Récap title | Récapitulatif | ملخص الطلب |
| Total | Total | المجموع |
| Promo placeholder | Entrez le code | أدخلي الكود |
| Promo apply | Appliquer | تطبيق |
| CTA | Confirmer ma commande | تأكيد طلبي |
| Consent disclaimer | En confirmant, vous acceptez nos CGV et politique de confidentialité. | بالضغط على "تأكيد"، تقبل الشروط وسياسة الخصوصية. |

### 16.4 Step 4 — Confirmation

| Élément | FR | AR |
|---|---|---|
| Title | Merci {firstName} ! 💗 | شكراً لك {firstName}! 💗 |
| Subtitle | Votre commande #{orderId} est confirmée | طلبك رقم #{orderId} مؤكد |
| Delivery info | On vous livre sous 24-48h à {city} | سنوصلك خلال 24-48 ساعة في {city} |
| SMS notice | Vous recevrez un SMS de confirmation au {phone} dans quelques minutes. | ستصلك رسالة تأكيد على {phone} خلال دقائق. |
| WhatsApp CTA | 💬 Discuter avec un expert | 💬 تحدثي مع خبير |
| Cross-sell title | Vous aimerez aussi | قد يعجبك أيضًا |

### 16.5 Erreurs

| Code | FR | AR |
|---|---|---|
| `firstName.min` | Minimum 2 caractères | حرفان على الأقل |
| `firstName.max` | Maximum 50 caractères | 50 حرفًا كحد أقصى |
| `phone.invalid` | Numéro marocain invalide (doit commencer par 06 ou 07) | رقم مغربي غير صالح (يجب أن يبدأ بـ 06 أو 07) |
| `email.invalid` | Email invalide | بريد إلكتروني غير صالح |
| `address.min` | Adresse trop courte | العنوان قصير جدًا |
| `city.required` | Veuillez sélectionner une ville | يرجى اختيار مدينة |
| `payment.required` | Veuillez choisir un mode de paiement | يرجى اختيار طريقة دفع |
| `promo.invalid` | Code expiré ou invalide | الكود منتهي أو غير صالح |
| `network.error` | Erreur réseau, vérifiez votre connexion | خطأ في الشبكة، تحققي من اتصالك |
| `server.error` | Une erreur est survenue. Réessayez ou contactez-nous. | حدث خطأ. أعيدي المحاولة أو اتصلي بنا. |
| `rate.limit` | Trop de tentatives. Patientez une minute. | محاولات كثيرة. انتظري دقيقة. |

---

## 17. Edge cases visuels

### 17.1 Cart vide en Mode B

Si user arrive sur `/commander` avec `cart.items.length === 0` :
- Wizard ne se monte pas
- Affiche une carte "Votre panier est vide" + CTA "Découvrir le kit FemiGlow →" qui pointe vers `/kit`

### 17.2 Lead déjà créé (retour après abandon)

Si cookie `fg_lead` présent au mount du wizard :
- `GET /api/checkout/lead/[id]` pour récupérer l'état
- Hydrate le store Zustand avec les data
- Saute directement au step adéquat (firstName+phone → Step 2, +address → Step 3)
- Affiche un badge subtle "Reprise de votre commande" pendant 4s puis disparaît

### 17.3 Tablet 768-1023px

- Wizard centered 640px max
- Pas de sidebar comme desktop (full mode wizard standalone)
- Sticky CTA footer comme mobile

### 17.4 Très petit écran (< 360px, ex: iPhone 4)

- Padding réduit à 12px
- Font sizes : title 22px au lieu de 24px
- CTA : reste 48px (non négociable a11y)

### 17.5 Bad/slow network (3G dégradé)

- Skeleton sur Step 1 si combobox pas encore chargé
- Retry x3 exponentiel (1s, 2s, 4s) avant fallback "On vous rappelle" (queue localStorage)
- Banner top "Connexion lente détectée, on prend notre temps..." après 5s loading

### 17.6 Browser autofill aggressive (Chrome MA)

- Tester avec autofill activé : firstName, phone, address doivent accepter le fill
- `autocomplete="given-name|tel-national|street-address|postal-code"` activé
- L'autofill ne doit pas casser la validation (trigger `onChange` puis Zod)

### 17.7 User agent suspect (bot)

- Honeypot field caché `<input name="website" tabIndex={-1} aria-hidden style="position:absolute;left:-9999px">` 
- Si rempli → discard côté serveur (silent)

### 17.8 JavaScript désactivé

- Le wizard est React-only (pas de SSR fallback HTML form)
- Mais le marketing SEO pointe `/kit` en SSR (PDP statique)
- Si JS off : `/commander` affiche message "Activez JavaScript pour finaliser votre commande" + lien WhatsApp

### 17.9 Print

- `@media print` : wizard hidden, affiche uniquement le récap (sur Step 4 / page merci)

### 17.10 Dark mode

- **Pas de dark mode au launch** (cohérent avec l'existant FemiGlow qui est light-only)
- Si futur dark : tokens `--background`/`--foreground` swapped via `:root.dark`
- Lottie : version dark à fournir par designer

---

## 18. Checklist de revue UI (avant merge PR)

Pour chaque PR qui touche au wizard, le reviewer coche :

- [ ] Tokens utilisés (pas de hex literal hardcodé)
- [ ] Spacing/typography respecte la scale §2
- [ ] **Icônes** : exclusivement Lucide stroke 1.5 (cf. §2.6) — aucun emoji UI affordance
- [ ] **Badges** : utilisent `trustBadgeVariants` (§2.7) — aucun badge custom one-off
- [ ] Tap targets ≥ 48px sur mobile
- [ ] Focus ring visible sur tous les éléments focusables (`ring-2 ring-primary/30 ring-offset-2`)
- [ ] Micro-interactions cohérentes (§2.8) — pas de glow néon, pas d'ombres colorées agressives
- [ ] axe-core 0 violation `critical`/`serious`
- [ ] RTL testé visuellement (locale `ar`)
- [ ] Animations respectent `prefers-reduced-motion` (translate-y et scale désactivés)
- [ ] Contrastes vérifiés (DevTools color picker ou axe) — viser AAA sur le texte body
- [ ] Copywriting matche `messages/{fr|ar}/checkout.json` (et "24-48h" partout, pas "48h" seul)
- [ ] Aucun référence "CB" / "carte bancaire" / "Credit card" (paiements = COD + Bank uniquement)
- [ ] Aucune checkbox CGV (consentement implicite sous le CTA Step 3)
- [ ] `<StockIndicator>` rendu en haut de Step 2 si produit a stock géré
- [ ] `<ThankYouEmailOptIn>` rendu sur Step 4 (optionnel, post-finalize)
- [ ] Storybook story ajoutée (si composant atomique)
- [ ] Tests Vitest+RTL+MSW couvrent les états (idle/focused/error/loading)
- [ ] Playwright happy path passe
- [ ] Lighthouse mobile ≥ 88 sur la page intégrant le composant
