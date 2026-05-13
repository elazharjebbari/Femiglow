# ADR-003 — Stratégie de placement : zones configurables

> **Statut** : Proposed
> **Date** : 2026-05-13

## Contexte

Une page légale peut apparaître à plusieurs endroits du site :
- Footer principal
- Footer bottom bar
- Bannière de consentement cookies
- Checkout consent
- Mobile menu

Comment l'admin configure quels liens à quels endroits ?

## Options évaluées

### Option 1 — Hardcoded en code

❌ Pas configurable sans deploy

### Option 2 — Une liste plate `footer_links`

⚠ Pas de granularité par zone

### Option 3 — Multi-zones avec matrice ★ retenu

Table `legal_zones` (catalog) + table `legal_page_placements`
(page × zone × order × visible).

## Décision

**Option 3** — zones configurables, matrice page × zone.

## Schéma

```
legal_zones
  - key TEXT PK (footer-main, footer-bottom-bar, cookie-banner-links,
                  checkout-consent, signup-consent, mobile-menu,
                  chat-disclaimer)
  - label TEXT (libellé admin)
  - description TEXT
  - max_items_recommended INT (ex: footer-bottom-bar = 3)

legal_page_placements
  - page_slug TEXT FK
  - zone_key TEXT FK
  - display_order INT (ordre dans la zone)
  - is_visible BOOLEAN DEFAULT TRUE
  - PRIMARY KEY (page_slug, zone_key)
```

## UI admin

Page `/admin/legal/placements` affiche une matrice :

```
                    footer  bottom  cookie  checkout  signup  mobile
Mentions légales      ✅      ✅                                ✅
CGV                   ✅                       ✅
Politique conf.       ✅              ✅                  ✅      ✅
Cookies                       ✅      ✅
Retours               ✅                       ✅                ✅
Livraison             ✅
Sécurité produits     ✅                                          ✅
CGU                   ✅                                          ✅
FAQ                   ✅                                          ✅
```

Click sur une case = toggle is_visible. Drag-drop = display_order.

## Public consumption

```typescript
// FooterLegalLinks.tsx
const links = await fetchPlacements('footer-main');
// SELECT p.* FROM legal_pages p
// JOIN legal_page_placements pl ON pl.page_slug = p.slug
// WHERE pl.zone_key = 'footer-main' AND pl.is_visible = true
//   AND p.status = 'published'
// ORDER BY pl.display_order
```

## Zones préconfigurées (seed)

| Key | Label | Max items recommandés |
|---|---|---|
| `footer-main` | Footer — colonne légale | 8 |
| `footer-bottom-bar` | Footer — ligne en bas (© FemiGlow · Mentions) | 3 |
| `cookie-banner-links` | Bannière cookies — liens | 2 |
| `checkout-consent` | Checkout — "J'accepte CGV + Conf." | 2 |
| `signup-consent` | Signup — "J'accepte les conditions" | 1 |
| `mobile-menu` | Menu burger mobile | 5 |
| `chat-disclaimer` | Disclaimer pied du chat | 1 |

## Validation

- Au moins 1 placement obligatoire par page publiée (warning si 0)
- Page `published` sans placement visible = alerte dashboard
- Page `published` avec placement vers page `draft` = erreur (rejet)

## Suivi

- CF.3, CL.1 (cf. success-criteria.md)
