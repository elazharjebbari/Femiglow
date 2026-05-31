# 5. UI / UX — intégration dans l'admin

## Points d'intégration

### 1. Onglet "Attribution" dans `TrackingShell`

Ajout d'un onglet dans la barre de sous-navigation existante :

```
[ Vue d'ensemble | Plans (unifié) | Inventaire | Événements | Mappings | ★ Attribution ★ | Tester | Logs | Réglages ]
```

Route : `/admin/tracking/attribution`

### 2. Page Attribution — structure

```
┌──────────────────────────────────────────────────────────────────┐
│ Attribution multi-canal                                          │
│ Comment FemiGlow décide à quel canal publicitaire envoyer        │
│ chaque conversion.                                               │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  📖 Guide : comprendre l'attribution multi-canal           ▶   │
│  └─ (panneau replié, identique pattern TrackingHelpPanel)        │
│                                                                  │
│ ───────────────────────────────────────────────────────────────  │
│                                                                  │
│  ⚙️ Stratégie active                                             │
│                                                                  │
│  ◉ Dernier-clic payant      ★ Recommandé                         │
│     Crédite le dernier canal payant connu (Google Ads, Meta…).   │
│     Idéal pour l'attribution standard et le Smart Bidding.       │
│                                                                  │
│  ○ Premier-clic payant                                           │
│     Crédite le premier canal payant qui a amené le visiteur.     │
│     Pour les funnels longs où l'acquisition compte plus que la   │
│     conversion.                                                  │
│                                                                  │
│  ○ Dernière interaction                                          │
│     Crédite le dernier canal connu, payant ou non. Inclut SEO    │
│     et direct.                                                   │
│                                                                  │
│  ○ Première interaction                                          │
│     Crédite l'acquisition initiale, payante ou non.              │
│                                                                  │
│  ○ Broadcast (déconseillé)                                       │
│     Tous les pixels reçoivent toutes les conversions.            │
│     Double-comptage garanti.                                     │
│                                                                  │
│  [ Enregistrer ]                                                 │
│                                                                  │
│ ───────────────────────────────────────────────────────────────  │
│                                                                  │
│  📊 Politique par event (lecture seule v1)                       │
│                                                                  │
│  Events alimentant les audiences (tous les pixels) :             │
│   • page_view    • view_item     • view_item_list                │
│   • add_to_cart  • view_cart                                     │
│                                                                  │
│  Events de conversion (canal attribué uniquement) :              │
│   • purchase     • lead_capture     • checkout_intent            │
│   • sign_up      • contact_submit   • generate_lead              │
│   • newsletter_submit  • chat_lead_form_submit                   │
│                                                                  │
│ ───────────────────────────────────────────────────────────────  │
│                                                                  │
│  🔍 Debugger — vérifier l'attribution d'un visiteur              │
│                                                                  │
│  Visitor ID : [ v_xxx_yyy______________________ ] [ Inspecter ]  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Snapshot                                                │    │
│  │   first_touch : { channel: 'meta', is_paid: true,...}   │    │
│  │   last_touch  : { channel: 'direct', is_paid: false,...}│    │
│  │   paid_hist   : [ {meta, 2026-05-10}, {google_ads, …} ] │    │
│  │                                                         │    │
│  │ Résolu avec stratégie « last_paid_touch » :             │    │
│  │   → canal : meta                                        │    │
│  │   → reason: last_paid_touch:fbclid                      │    │
│  │                                                         │    │
│  │ Pixels qui fire pour `purchase` :                       │    │
│  │   ✓ GA4     ✓ Meta     ✗ Ads     ✗ TikTok               │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 3. Intégration dans la page existante `/admin/tracking/plans/[id]`

Sur le détail du plan, ajout d'une carte « Attribution active » qui
résume l'état :

```
┌─────────────────────────────────────────────┐
│ Attribution multi-canal                     │
│ Stratégie : last-paid-touch  [Modifier →]   │
│ Politique par event : 4 audiences / 8 conv. │
└─────────────────────────────────────────────┘
```

Lien direct vers `/admin/tracking/attribution`.

### 4. Indicateur dans le funnel `/admin/tracking/logs`

Pour chaque event de conversion loggé, afficher dans les colonnes :

| Event | Visitor | Attribution | Pixels fired |
|---|---|---|---|
| purchase | v_abc | meta (fbclid) | GA4, Meta |
| purchase | v_def | google_ads (gclid) | GA4, Ads |
| purchase | v_xyz | direct | GA4, Meta, Ads, TikTok |

### 5. Documentation embarquée (nouveau panneau ou extension)

Le `TrackingHelpPanel` existant gagne une nouvelle section #8 :

```
8. 🎯 Attribution multi-canal — comment FemiGlow choisit le canal
   à créditer pour chaque conversion (lien vers /admin/tracking/
   attribution pour la config).
```

## UX choices

### Pourquoi des radio buttons (et pas un select) ?

- 5 stratégies, descriptions importantes → visibles d'un coup
- Pattern admin courant pour les choix "exclusifs avec contexte"
- Recommandation marquée par un ★ et un texte d'aide explicite

### Pourquoi pas d'édition de la politique par-event en v1 ?

- 90% des cas couverts par le défaut (primary attribution-gated /
  broadcast pour tout le reste — cf. §"Gating per-provider" dans
  `03-architecture.md`)
- Le mapping `event-mapping.ts → getAttributionMode(event, provider)`
  détermine la politique de manière déterministe :
  - Google Ads : depuis `recommendedRole` (cohérence avec UI Ads)
  - Meta : depuis set `{ Purchase, Lead }`
  - TikTok : depuis set `{ CompletePayment, SubmitForm }`
- Évite un éditeur complexe qu'on devrait re-tester

→ Si besoin futur (override par-event), on ajoutera une UI table-edit
qui surchargerait localement la décision retournée par
`getAttributionMode`.

### Debugger en standalone (pas en modal)

Permet de copier-coller l'URL pour partager un cas avec un collègue.

### Pas de "preview live" sur la home

- Tentation : afficher en temps réel l'attribution du visiteur courant
- Réponse : trop technique pour cet écran ; le visiteur courant peut
  ouvrir DevTools et taper `document.cookie` ou `localStorage.fg_attr`.

## Wireframe du Debugger (détail)

```
┌─────────────────────────────────────────────────────────────────┐
│ Visitor ID                                                      │
│ [ v_____________________________________ ] [Inspecter]          │
│                                                                 │
│ ─ ou ─                                                          │
│                                                                 │
│ Session ID                                                      │
│ [ s_____________________________________ ] [Inspecter]          │
└─────────────────────────────────────────────────────────────────┘

Après [Inspecter] :

┌─ Attribution snapshot ──────────────────────────────────────────┐
│ ┌─ first_touch ──────────────────────────────────────────────┐  │
│ │ channel       meta                                         │  │
│ │ is_paid       ✓                                            │  │
│ │ click_id      fbclid: IwY2xjawDc…                          │  │
│ │ utm           source: facebook, medium: cpc                │  │
│ │ landing_path  /kit                                         │  │
│ │ detected_at   2026-05-10 14:32:18 (5j 21h ago)             │  │
│ └────────────────────────────────────────────────────────────┘  │
│                                                                 │
│ ┌─ last_touch ───────────────────────────────────────────────┐  │
│ │ channel       direct                                       │  │
│ │ is_paid       ✗                                            │  │
│ │ referrer      (none)                                       │  │
│ │ landing_path  /                                            │  │
│ │ detected_at   2026-05-15 09:14:02 (28m ago)                │  │
│ └────────────────────────────────────────────────────────────┘  │
│                                                                 │
│ ┌─ paid_history (3) ─────────────────────────────────────────┐  │
│ │ 1. google_ads (gclid)   2026-05-12 10:08                   │  │
│ │ 2. meta (fbclid)        2026-05-11 18:22                   │  │
│ │ 3. meta (fbclid)        2026-05-10 14:32                   │  │
│ └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─ Résolution avec stratégie active : last_paid_touch ────────────┐
│ Canal attribué      google_ads                                  │
│ Reason              last_paid_touch:gclid (#1 dans paid_history)│
│ Pixels qui fire     ✓ GA4      ✓ Google Ads                     │
│                     ✗ Meta     ✗ TikTok                         │
└─────────────────────────────────────────────────────────────────┘

┌─ Simulation autres stratégies ──────────────────────────────────┐
│ first_paid_touch    → meta (fbclid 2026-05-10)                  │
│ last_touch          → direct                                    │
│ first_touch         → meta                                      │
│ broadcast           → tous les pixels                           │
└─────────────────────────────────────────────────────────────────┘
```

## Cohérence visuelle

- Réutilise les primitives existantes : `TrackingShell`, panneau
  collapsible (cf. `TrackingHelpPanel`), badges, chips
- Couleurs : sky (info) / amber (warning) / emerald (configuré) /
  stone (neutre)
- Police : Inter (admin standard)
- Espacement : grid de 8px, padding rythmé 4/3/2

## Accessibilité

- Radio buttons avec `<fieldset>` + `<legend>`
- Helpers `aria-describedby` sur chaque option
- Focus visible sur tous les contrôles
- Tableau du debugger avec en-têtes liés (`scope="col"`)
- `<details>` natif pour les sections collapsibles
