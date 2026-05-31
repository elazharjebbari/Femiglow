# 40.1 — Components inventory

## Nouveaux composants

### Admin

#### `LegalPagesListTable`
Tableau de toutes les pages légales avec filtres (status), tri, KPIs.
- Props : `pages: AdminLegalPage[]`, `onEdit`, `onView`
- État : filtre status, tri

#### `LegalPageEditor`
Éditeur MD split-pane (gauche : raw MD, droite : preview live).
- Props : `page: AdminLegalPage`, `vars: TemplateVarsMap`, `onSave`, `onPublish`
- État local : `bodyMd`, `dirty`, `lastSaved`
- Auto-save toutes les 30s pour drafts

#### `LegalPageEditorToolbar`
Toolbar utilitaire (Bold, Italic, H1, H2, Link, List, …).
- Props : `onInsert(text)`, `selection`

#### `LegalPagePreview`
Rendu HTML du MD avec substitution variables. Synchronisé avec
l'éditeur.
- Props : `bodyMd: string`, `vars: TemplateVarsMap`, `mode: 'preview' | 'production'`
- Highlight variables manquantes en mode preview

#### `LegalPagePlacementsPanel`
Section de l'éditeur où l'admin coche les zones.
- Props : `zones: Zone[]`, `placements: Placement[]`, `onChange`

#### `LegalPlacementsMatrix`
Page dédiée : matrice complète pages × zones, draggable + togglable.
- Props : `pages`, `zones`, `placements`, `onUpdate`

#### `LegalTemplateVarsEditor`
Page dédiée à éditer les variables (`{{COMPANY_RC}}`, `{{ICE}}`, …).
- Props : `vars: TemplateVar[]`, `onUpdate`
- Validation par champ selon `is_required`

#### `LegalHealthDashboard`
Page santé des liens.
- Props : `data: HealthSnapshot`
- Refresh auto 30s

#### `LegalHistoryDrawer`
Drawer latéral affichant l'historique des versions.
- Props : `slug: string`, `history: HistoryEntry[]`
- Bouton "Restaurer cette version"

#### `LegalReviewBanner`
Banner en haut de l'éditeur "Cette page nécessite une revue juriste".
- Props : `requireLegalReview: boolean`, `lastReviewAt: Date | null`

#### `LegalSyncIndicator`
Indicateur (✏/✅/⚠) à côté de chaque variable dans l'éditeur.
- Props : `varKey: string`, `value: string | null`, `isRequired: boolean`

### Public

#### `LegalPageLayout`
Layout dédié `/app/legal/[slug]/layout.tsx`.
- Style FemiGlow : Cormorant Garamond pour H1, Inter body, max-w-prose
- "Date de mise à jour" en haut
- Liens "Voir aussi" en bas

#### `FooterLegalLinks`
Liens du footer principal (colonne légale).
- Props : `zone: 'footer-main'`
- Data : SWR fetch `/api/legal/placements/footer-main`

#### `FooterBottomBarLinks`
Liens de la ligne © FemiGlow · Mentions · CGV en bas du footer.
- Props : `zone: 'footer-bottom-bar'`

#### `CookieBannerLegalLinks`
Liens dans la bannière cookies.
- Props : `zone: 'cookie-banner-links'`

#### `CheckoutConsentText`
Texte "J'accepte les CGV et la politique de confidentialité" au checkout.
- Props : `linkRenderer: (slug, label) => ReactNode`

## Composants modifiés

### `MobileMenu`
Refactor pour lire les liens légaux depuis API (zone `mobile-menu`).

### `Footer` (composant principal)
Refactor pour utiliser `FooterLegalLinks` + `FooterBottomBarLinks` au lieu
de hardcoded.

### `ConsentBanner`
Utiliser `CookieBannerLegalLinks` pour les liens.

### `WizardShell` (checkout)
Utiliser `CheckoutConsentText` pour le consentement.

## Hooks à créer

### `useLegalPagesList()`
SWR hook pour la liste des pages.

### `useLegalPage(slug)`
SWR hook pour une page (admin view).

### `useLegalPageHistory(slug)`
SWR hook pour l'historique.

### `useLegalTemplateVars()`
SWR hook pour les variables (cache long, 5min).

### `useLegalPlacements(zone)` (public)
SWR hook pour les liens d'une zone.

### `useLegalHealth()`
SWR hook pour le dashboard santé (refresh 30s).

### `useLegalEditorAutoSave(slug, body)`
Auto-save toutes les 30s pour drafts. Annule si la page passe en review.

### `useLegalRenderer()`
Hook qui retourne une fonction `render(md, vars) → html` mémoïzée.

## Pages admin à créer

```
app/admin/legal/
├── page.tsx                       (liste des pages)
├── [slug]/
│   ├── edit/page.tsx              (éditeur MD)
│   └── history/page.tsx           (historique versions)
├── placements/page.tsx            (matrice page × zone)
├── template-vars/page.tsx         (variables)
├── health/page.tsx                (dashboard santé)
└── wizard/new/page.tsx            (wizard création)
```

## Pages publiques à créer / refactor

```
app/(marketing)/
├── mentions-legales/              ❌ DELETE (was hardcoded)
├── cgv/                           ← NEW (dynamic via [slug])
└── ... 

app/[slug]/page.tsx                ← NEW catch-all pour pages légales
```

OR alternative : préfixe `/legal/[slug]` :

```
app/legal/
├── [slug]/
│   └── page.tsx                   ← NEW dynamic public render
└── layout.tsx                     ← LegalPageLayout
```

Choix recommandé : **préfixe `/legal/`** pour éviter conflits avec autres
routes du site. Migration soft : `/mentions-legales` → 301 redirect vers
`/legal/mentions-legales`.

ALTERNATIVE B : pas de préfixe, mais ajouter chaque slug en routes statiques.
Plus de friction mais URL plus courtes (`/cgv` vs `/legal/cgv`).

**Décision** : pas de préfixe pour les pages standard (slugs propres), avec
fallback `[slug]/page.tsx` catch-all qui résout via DB.

```
app/[slug]/page.tsx  ← lookup slug dans legal_pages, render si trouvé
```

Important : ce catch-all doit être **après** toutes les autres routes
statiques (`/kit`, `/journal`, `/admin`, etc.) dans la priorité.
