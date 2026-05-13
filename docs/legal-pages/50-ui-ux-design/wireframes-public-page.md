# 50.5 — Wireframe : page publique

## Vue : `/legal/cgv` (desktop)

```
┌────────────────────────────────────────────────────────────┐
│  Logo FemiGlow                          Menu  Compte  Pan. │
├────────────────────────────────────────────────────────────┤
│                                                            │
│                                                            │
│         ◀ Retour                                           │
│                                                            │
│                                                            │
│         Conditions Générales de Vente                      │
│         Mis à jour le 11 mai 2026 · Version 5              │
│                                                            │
│         ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔                  │
│                                                            │
│         > Les présentes Conditions Générales de Vente      │
│         > régissent les relations contractuelles entre…    │
│                                                            │
│                                                            │
│         1. Préambule                                       │
│         ─────────────────────────────────────              │
│                                                            │
│         Les présentes CGV s'appliquent à toute commande    │
│         passée sur femiglow.ma, édité par FemiGlow Sàrl,   │
│         RC 123456, ICE 002000000123456…                    │
│                                                            │
│         Toute commande implique l'acceptation pleine,      │
│         entière et sans réserve des présentes CGV…         │
│                                                            │
│                                                            │
│         2. Produits                                        │
│         ─────────────────────────────────────              │
│                                                            │
│         Les produits proposés sur le Site sont des         │
│         cosmétiques destinés à l'hygiène et au soin du     │
│         corps, conformes à la loi 24-99…                   │
│                                                            │
│         …                                                  │
│                                                            │
│         ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔                  │
│                                                            │
│         Voir aussi :                                       │
│         → Politique de retours et remboursements           │
│         → Politique de confidentialité                     │
│         → Mentions légales                                 │
│                                                            │
│         Une question ? hello@femiglow.ma · +212 6XX XX XX  │
│         Mise à jour le 11/05/2026 · v5                     │
│                                                            │
├────────────────────────────────────────────────────────────┤
│         FemiGlow                                           │
│         Footer principal (cf. wireframe footer)            │
└────────────────────────────────────────────────────────────┘
```

## Vue mobile (375px)

```
┌──────────────────────┐
│ ☰ FemiGlow      🛒 │
├──────────────────────┤
│ ◀ Retour             │
│                      │
│ Conditions Générales │
│ de Vente             │
│ Mis à jour 11/05/2026│
│ ─────────────────────│
│                      │
│ > Les présentes CGV  │
│ > régissent…         │
│                      │
│ 1. Préambule         │
│ ─────────────────────│
│                      │
│ Les présentes CGV    │
│ s'appliquent à toute │
│ commande passée sur  │
│ femiglow.ma…         │
│                      │
│ …                    │
│                      │
│ Voir aussi :         │
│ → Pol. retours       │
│ → Pol. confidentia.  │
│ → Mentions légales   │
│                      │
│ Une question ?       │
│ hello@femiglow.ma    │
│                      │
│ ┌──────────────────┐│
│ │ Footer 5 liens   ││
│ └──────────────────┘│
└──────────────────────┘
```

## Style éditorial

### Typo

```
H1
"Conditions Générales de Vente"
Cormorant Garamond, 500, 44px (desktop) / 32px (mobile), tracking -0.02em, color stone-900

Last-updated subtitle
"Mis à jour le 11 mai 2026 · Version 5"
Inter, 400, 14px, color stone-500, marginBottom 32px

H2
"1. Préambule"
Cormorant Garamond, 500, 26px, marginTop 40px, marginBottom 16px
borderBottom 1px stone-200, paddingBottom 8px

Body
Inter, 400, 17px, line-height 1.75, color stone-700, max-width 65ch

Blockquote intro
italic, color stone-600, borderLeft 4px rose-200, paddingLeft 16px

Liens
underline, color rose-700, hover rose-800, font-weight 500
```

### Espaces

- Padding latéral : 24px mobile, 48px desktop
- Top : 48px desktop, 32px mobile
- Bottom : 64px desktop (avant footer)
- Entre H2 : 40px
- Entre § : 16px

## "Voir aussi"

Composant `LegalRelatedLinks` : automatique selon catégorie de page.

```typescript
const RELATED = {
  'conditions-generales-de-vente': ['politique-retours', 'politique-confidentialite', 'mentions-legales'],
  'politique-confidentialite': ['politique-cookies', 'mentions-legales'],
  'politique-cookies': ['politique-confidentialite'],
  // ...
};
```

## Microcopy contact

```
Une question ? hello@femiglow.ma · +212 6XX XX XX XX
Mise à jour le 11/05/2026 · Version 5
```

## SEO

- `<meta robots>` = noindex par défaut
- `<title>` = "Conditions Générales de Vente — FemiGlow"
- `<meta description>` = la propriété `description` de la page (160 car max)
- `<link rel="canonical">` self-ref

## A11y

- `<main id="main">` pour skip link
- Heading hierarchy strict
- `<table>` avec `<thead>`, `<th scope="col">`
- Contraste AAA pour body
- Tab order : header → main → footer
- Focus visible

## ISR & cache

- `revalidate = 3600` (1h)
- Statiquement généré au build
- Sur publish : `revalidatePath('/legal/[slug]')` purge immédiate
- ETag pour conditionalrequest
