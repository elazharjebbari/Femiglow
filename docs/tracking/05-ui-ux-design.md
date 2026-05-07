# 05 — UI / UX & design

## 1. Principes directeurs

- **Densité maîtrisée** : la console manipule beaucoup d'objets
  (composants, events, providers). On va vers la dense info-table
  d'admin pro plutôt que vers le marketing-style aéré.
- **Lecture verticale** : sidebar fixe gauche → vue principale →
  panneau détail à droite (drawer ou split).
- **Couleurs charte** : palette stone (existante) + 2 accents
  fonctionnels :
  - `--success-600 #047857` (event ok, provider ok)
  - `--warning-600 #b45309` (drift inventory, consent denied dominant)
  - `--danger-600 #b91c1c` (provider error, validation fail)
  - `--info-600 #1d4ed8` (mode test/dry-run)
- **Typographie** : Inter pour la console (variable, weights 400/500/600).
  Cormorant **interdit** côté admin (lisibilité écran prio).
- **Spacing** : grille 4px (4/8/12/16/24/32). Densité tableaux 36–40px
  par ligne.
- **Pas d'emoji** dans les UI ; icônes Lucide (déjà OK avec Tailwind).
- **Tutoiement** dans les libellés métier (charte FemiGlow).

## 2. Layout `/admin/tracking`

```
┌──────────────────────────────────────────────────────────────────┐
│ [AdminShell sidebar]   Console tracking                          │
│   ┌ Tableau de bord                                              │
│   ├ Inventaire                                                   │
│   ├ Composants                  ┌──────────────────────────────┐ │
│   ├ Events catalogue            │  Vue principale (split / list)│ │
│   ├ Providers                   │                               │ │
│   ├ Logs                        │  + Drawer détail (slide right)│ │
│   ├ Test                        │                               │ │
│   └ Réglages                    └──────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

Sous-route `/admin/tracking` → onglet "Tableau de bord" par défaut.

## 3. Tableau de bord (`/admin/tracking`)

Cinq tuiles KPI + 2 graphes :

```
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│ Events   │ Conv.    │ Cons. OK │ Coverage │ Erreurs  │
│  24 132  │   84     │  62 %    │  78 %    │   3      │
└──────────┴──────────┴──────────┴──────────┴──────────┘
┌─────────────────────────────┬──────────────────────────┐
│  Top 10 events 24h          │ Providers santé          │
│  bar chart sparkline        │  • Meta   ✓ 12 ms        │
│                             │  • TikTok ✓ 18 ms        │
│                             │  • Google ✓ 9 ms         │
│                             │  • Snap   ⚠ 2 erreurs    │
│                             │  • Pin    – désactivé    │
└─────────────────────────────┴──────────────────────────┘
┌────────────────────────────────────────────────────────┐
│  Activité récente (timeline 50 derniers events)        │
│  10:24  view_item    /kit       Meta+Google ok         │
│  10:24  add_to_cart  /kit       Meta+Google ok         │
│  10:23  page_view    /journal   GA4 ok                 │
└────────────────────────────────────────────────────────┘
```

Composants UI : `<KpiTile>`, `<SparklineBar>`, `<ProviderHealthList>`,
`<EventActivityFeed>`.

## 4. Inventaire (`/admin/tracking/inventory`)

Vue arborescente :

```
[ Filtres : page • catégorie composant • status ]   [ Recharger ]

▾ /  (Accueil)                                           [ 12 c. ]
   Hero               • CTA  • view_promotion   ✓ activé
   GestesGrid         • carousel • engagement   ✓ activé
   Manifeste          • content                  ○ non config
   AvisStrip          • testimonial • engagement ✓ activé
   …

▾ /journal                                                [ 8 c. ]
   JournalHero        …
   JournalGrid        …
   …

▾ /kit                                                    [ 14 c. ]
   HeroProduit        • hero • view_promotion    ✓
   CompositionReveal  • content                  ✓
   AddToCartButton    • CTA • add_to_cart        ✓ ⚡ critique
   FAQAccordion       • faq • engagement         ✓
   …
```

Interactions :

- Click ligne composant → drawer droit "Détail composant".
- Drag-drop pour réordonner (persisté `tracking_pages_components.position`).
- Recherche fulltext (page route + nom composant + event name).
- Filtre `Diff` : montre uniquement les composants en drift
  (manifeste vs BDD).

États visuels :

- ✓ vert : enabled, ≥ 1 event configuré.
- ○ gris : detected mais non configuré.
- ⚠ orange : enabled mais 0 event actif.
- ✗ rouge : detected en code mais supprimé en BDD (orphan).
- ⚡ violet : event critique conversion (purchase, lead).

## 5. Détail composant (drawer)

```
┌─ HeroProduit ────────────────────────────[ × ]┐
│ src/components/sections/HeroProduit.tsx       │
│ Catégorie : section_hero                      │
│                                               │
│ [ Toggle global : Activer le tracking  ●○ ]   │
│                                               │
│ Events configurés (3)                         │
│ ┌─────────────────────────────────────────┐   │
│ │ ☑ view_promotion                        │   │
│ │   promotion_id : kit-hero               │   │
│ │   promotion_name : Le kit FemiGlow      │   │
│ │   Providers : Meta, GA4 ▼ tester ↻      │   │
│ ├─────────────────────────────────────────┤   │
│ │ ☑ select_promotion                      │   │
│ │   …                                     │   │
│ ├─────────────────────────────────────────┤   │
│ │ ☐ scroll_depth                          │   │
│ │   (cliquer pour configurer)             │   │
│ └─────────────────────────────────────────┘   │
│                                               │
│ + Ajouter un event applicable                 │
│                                               │
│ [ Annuler ]                  [ Enregistrer ]  │
└───────────────────────────────────────────────┘
```

Comportements :

- Le drawer est **persistant** (URL `?component=tc_xxx`).
- Sauvegarde optimiste avec rollback si erreur API.
- Le toggle d'event ouvre un sous-formulaire :
  - select des paramètres requis (auto-rempli depuis defaults).
  - select des providers (multi).
  - bouton "Tester maintenant".

## 6. Catalogue d'events (`/admin/tracking/events`)

Tableau lecture seule (les events sont du code, pas de la config) :

```
┌────────────────────┬──────────┬──────────┬─────────┬──────┐
│ Nom                │ Catégorie│ Conv.    │ Scope   │ Apl. │
├────────────────────┼──────────┼──────────┼─────────┼──────┤
│ page_view          │ page     │ –        │ both    │ all  │
│ view_item          │ ecom     │ –        │ both    │ 12   │
│ add_to_cart        │ ecom     │ –        │ both    │ 5    │
│ begin_checkout     │ ecom     │ ✓        │ both    │ 1    │
│ purchase           │ ecom     │ ✓        │ both    │ 1    │
│ generate_lead      │ lead     │ ✓        │ both    │ 3    │
│ scroll_depth       │ engmt    │ –        │ web     │ all  │
│ video_progress     │ engmt    │ –        │ web     │ 6    │
│ fg_journal_read_75 │ engmt    │ –        │ web     │ 4    │
│ …                  │          │          │         │      │
└────────────────────┴──────────┴──────────┴─────────┴──────┘
```

Click ligne → modal lecture seule avec :

- description longue (FR),
- params requis/optionnels (table),
- mapping providers (Meta → ViewContent, TikTok → AddToCart…),
- exemple JSON payload.

## 7. Providers (`/admin/tracking/providers`)

Cartes empilées (1 carte = 1 provider) :

```
┌── Meta (Facebook) ────────────────────────────┐
│ Pixel ID  [123456789012345]                   │
│ CAPI token [●●●●●●●●●●●●●]   [ Modifier ]     │
│ Test code  [TEST12345]                        │
│ Status : ● Activé   Dernier event : il y a 4 s│
│ Erreurs 24h : 0                               │
│ Code custom (head) : [ouvrir éditeur ▾]       │
│                                               │
│ [ Désactiver ]  [ Tester ]  [ Modifier ]      │
└───────────────────────────────────────────────┘

┌── TikTok ─────────────────────────────────────┐
│ … (idem)                                      │
└───────────────────────────────────────────────┘

┌── Google (Ads + GA4) ─────────────────────────┐
│ Measurement ID  [G-XXXXXXXXXX]                │
│ API Secret      [●●●●●●●●]                    │
│ GADS Conv. ID   [AW-XXXXXXXXX]                │
│ GADS Conv. Lab. [abcdEFGH]                    │
│ …                                             │
└───────────────────────────────────────────────┘

┌── Snap ───────────────────────────────────────┐  
┌── Pinterest ──────────────────────────────────┐
```

Modal "Modifier" : formulaire avec sections :

1. Identifiants (pixel ID, token).
2. Code custom (header / body) — éditeur Monaco mini avec
   sécurité regex.
3. Mapping events (table cochable des events de notre catalogue
   → activé/désactivé pour ce provider).
4. Test events (bouton "Envoyer un PageView de test").

## 8. Logs (`/admin/tracking/events`, sous-onglet)

Timeline temps réel (SSE optionnel, sinon polling 5 s) :

```
[ Filtres : event • page • provider • consent • depuis 1h ▾ ]
[ Pause / Reprendre ]                  [ Exporter CSV ]

10:24:15  view_item     /kit               Meta✓ Google✓ TikTok✓
10:24:14  page_view     /kit               Google✓
10:24:12  add_to_cart   /kit               Meta✓ Google✓
10:24:10  scroll_depth  /journal/x         (pas de provider)
10:24:08  view_item     /rituel            Meta✓ Google✓
…
```

Click ligne → drawer "Détail event" :

- payload JSON pretty-printed,
- consent state au moment de l'event,
- résultats par provider (status, latency, error si KO).

## 9. Test (`/admin/tracking/test`)

Outil de validation pixel par pixel :

```
┌── Choisir un event ────────────────────────┐
│  view_item ▾                                │
└─────────────────────────────────────────────┘

┌── Paramètres ──────────────────────────────┐
│  currency  EUR                              │
│  value     39.00                            │
│  items     [editor JSON]                    │
└─────────────────────────────────────────────┘

┌── Providers à tester ──────────────────────┐
│  ☑ Meta (test code TEST12345)               │
│  ☑ Google                                   │
│  ☐ TikTok                                   │
│  ☐ Snap                                     │
│  ☐ Pinterest                                │
└─────────────────────────────────────────────┘

[ Mode dry-run ●○ ]    [ Envoyer ]
```

Résultats affichés en temps réel :

```
✓ Meta CAPI  HTTP 200  142 ms
   payload : { … }
✓ GA4 MP    HTTP 204   89 ms
✗ TikTok    HTTP 401   token invalide
   error : Authorization failed
```

## 10. Réglages (`/admin/tracking/settings`)

- Texte du banner consent (i18n FR).
- Préférence consent par défaut (`denied` recommandé en EU).
- Sélection environnement actif (dev / preview / prod).
- TTL events log (read-only, configuré via env).
- Mode debug global on/off.
- Alias dataLayer (`window.dataLayer` ON/OFF pour GTM).

## 11. Composants réutilisables UI

À ajouter dans `src/components/admin/tracking/`:

- `<TrackingShell>` — header sticky + breadcrumbs.
- `<TreeView>` — collapsible, virtualisé (≥ 200 nodes).
- `<DrawerSheet>` — panel slide-right.
- `<SwitchToggle>` — switch accessible (espace/enter, aria-pressed).
- `<EventBadge>` — badge coloré par catégorie d'event.
- `<ProviderCard>` — carte provider.
- `<TimelineFeed>` — liste virtualisée auto-refresh.
- `<JsonEditor>` — éditeur Monaco light (params + custom code).
- `<KpiTile>` — tuile KPI avec sparkline.
- `<StatusDot>` — indicateur ● colored avec label.

## 12. Patterns d'interaction

- **Sauvegarde optimiste** : on update l'UI tout de suite, on rollback
  si l'API renvoie 4xx/5xx + toast erreur.
- **Toasts** : positionnés bottom-right, max 3, auto-dismiss 4 s
  (utiliser `<Toast>` existant).
- **Confirmation modal** pour actions irréversibles (désactiver
  provider production).
- **Skeletons** pour les listes longues.
- **Empty states** illustrés (mais sobres) : "Aucun event tracké pour
  ce composant" + bouton "Configurer".
- **Aide contextuelle** : icône `?` qui ouvre un popover avec
  explication métier (ex : "Qu'est-ce que `view_item` ?").

## 13. Tokens design (Tailwind config)

À ajouter dans `tailwind.config.ts` :

```ts
extend: {
  colors: {
    tracking: {
      success: { 50: '#ecfdf5', 600: '#047857' },
      warning: { 50: '#fffbeb', 600: '#b45309' },
      danger:  { 50: '#fef2f2', 600: '#b91c1c' },
      info:    { 50: '#eff6ff', 600: '#1d4ed8' },
      neutral: { 50: '#fafaf9', 100: '#f5f5f4', 800: '#292524' }, // alias stone
    },
  },
  fontFamily: { admin: ['Inter Variable', 'system-ui', 'sans-serif'] },
}
```

## 14. Accessibilité

- Tous les contrôles accessibles clavier (Tab, Enter, Espace,
  Esc fermeture drawer).
- Tree view : `role="tree"`, `role="treeitem"`, `aria-expanded`.
- Switches : `role="switch"`, `aria-checked`.
- Toasts : `role="status"` (info), `role="alert"` (erreurs).
- Focus visible sur tous les éléments interactifs.
- jest-axe sur chaque page admin.
- Contraste min AA (4.5:1 texte, 3:1 graphique).

## 15. Micro-animations

- Drawer slide 180 ms `ease-out`.
- Toggle switch 120 ms.
- Skeleton shimmer 1.4 s loop.
- Timeline auto-scroll smooth (option pause).
- Pas de Lottie / motion lib lourde — Framer Motion (déjà présent)
  utilisé avec parcimonie (drawer, toast).

## 16. Responsive

- Desktop priorité (admin = bureau).
- Tablette (≥ 768px) : sidebar collapsible.
- Mobile (< 768px) : navigation drawer ; tableaux scroll horizontal ;
  drawer detail full-screen modal. Mais cas d'usage rare → polish
  Phase 7.

## 17. Maquettes / wireframes

Stockés dans `docs/tracking/wireframes/` (à produire en Figma puis
exporter PNG). Phases :

- W1 dashboard, W2 inventaire, W3 detail composant, W4 providers,
  W5 logs, W6 test.

(Hors-scope de ce document : produire les wireframes — listés dans
`10-plan-action.md` comme tâche `TRK-D01..D06`.)
