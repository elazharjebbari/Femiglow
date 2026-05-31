# Admin manager — Ergonomie

## 1. Layout général

### Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Logo FemiGlow              Tracking       elazhar@femiglow.ma  [⚙]   │ ← Top nav (existante)
├─────┬───────────────────────────────────────────────────────────────────┤
│     │                                                                   │
│  S  │              Main content                                         │
│  i  │                                                                   │
│  d  │  (wizard, expert, ou home)                                        │
│  e  │                                                                   │
│  b  │                                                                   │
│  a  │                                                                   │
│  r  │                                                                   │
│     │                                                                   │
└─────┴───────────────────────────────────────────────────────────────────┘
```

### Sidebar (240px fixe, masquable < md)

```
┌─────────────────┐
│ 📊 Vue d'ensemble │ ← /admin/tracking
│ 📋 Plans          │ ← /admin/tracking/plans
│ 🔄 Sync GTM       │ ← /admin/tracking/sync
│ 📜 Historique     │ ← /admin/tracking/history
│ 🧪 Diagnostics    │ ← /admin/tracking/diagnostics (mode expert)
│ ⚙️ Paramètres     │ ← /admin/tracking/settings
├─────────────────┤
│ 💬 Support       │ ← lien vers chat admin
└─────────────────┘
```

Active item : background `sauge-100` + bord gauche `sauge-600`.

## 2. Modes wizard vs expert

### Toggle entre modes

URL query param `?mode=wizard|expert`. Switch UI dans le header de la page édition de plan :

```
┌────────────────────────────────────────────────┐
│ Plan "Test campagne mai 2026"  [Wizard ▼]  ⓘ  │
│                                        ↑       │
│                              Dropdown: Wizard  │
│                                         Expert │
└────────────────────────────────────────────────┘
```

L'état (mode, draft) est persisté localStorage : `femiglow.tracking-plan-draft.v1`.

### Wizard layout (mode par défaut)

```
┌────────────────────────────────────────────────────────────┐
│  Stepper : ● ─── ● ─── ●3 ─── ○ ─── ○                      │
│           Outils  IDs  Events  Envs  Vérif                 │
├────────────────────────────────────────────────────────────┤
│                                                            │
│            Step content (centré, max-w-2xl)                │
│                                                            │
│  Title                                                     │
│  Description                                               │
│                                                            │
│  ┌──────────────────────────────────┐                      │
│  │  Card de saisie                  │                      │
│  └──────────────────────────────────┘                      │
│                                                            │
│  ┌──────────────────────────────────┐                      │
│  │  Card de saisie                  │                      │
│  └──────────────────────────────────┘                      │
│                                                            │
├────────────────────────────────────────────────────────────┤
│  [← Retour]              [Sauver brouillon] [Continuer →]  │
└────────────────────────────────────────────────────────────┘
```

### Expert layout (mode avancé)

```
┌────────────────────────────────────────────────────────────────────────┐
│  Plan "Production v9 draft"  [Expert ▼]   [Sauver] [Activer]           │
├──────────┬──────────────────────────────────────┬──────────────────────┤
│ Section  │  Main edit area                      │  JSON Preview        │
│ nav      │                                      │                      │
│          │  Selected section content            │  ┌──────────────────┐│
│ ● Outils │                                      │  │ {                ││
│ ○ IDs    │  (Provider cards, event matrix,      │  │   "providers":   ││
│ ○ Events │   env profiles selon section)        │  │   {              ││
│ ○ Envs   │                                      │  │     ...          ││
│ ○ Valid. │                                      │  │   }              ││
│          │                                      │  │ }                ││
│          │                                      │  └──────────────────┘│
└──────────┴──────────────────────────────────────┴──────────────────────┘
   240px              flex-1                          380px
```

Resize possible : drag handle entre panels (persisté).

## 3. Home page admin tracking

```
┌─────────────────────────────────────────────────────────────────┐
│  Tracking                                          [+ Nouveau]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────────────┐  ┌────────────────────────┐         │
│  │ ✓ Plan actif           │  │ ✓ Synchronisation      │         │
│  │                        │  │                        │         │
│  │ Production v8          │  │ 4 outils actifs        │         │
│  │ depuis le 12/05 14:21  │  │ Dernier ping il y a 2m │         │
│  │ par amal@femiglow.ma   │  │ Tout est OK            │         │
│  │                        │  │                        │         │
│  │ [Modifier mon tracking]│  │ [Voir détails sync]    │         │
│  └────────────────────────┘  └────────────────────────┘         │
│                                                                 │
│  ┌────────────────────────────────────────────────────┐         │
│  │ Historique des versions                            │         │
│  │                                                    │         │
│  │ • Production v8 (actif)   12/05  amal             │         │
│  │ • Production v7 (archivé) 10/05  amal             │         │
│  │ • Production v6 (archivé) 03/04  amal             │         │
│  │                                          [Tout →] │         │
│  └────────────────────────────────────────────────────┘         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 4. Sync page

```
┌─────────────────────────────────────────────────────────────────┐
│  Synchronisation GTM ← Tracking                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Dernière mise à jour du JSON GTM : il y a 2 minutes            │
│                                                                 │
│  ┌────────────────────────────────────────────────┐             │
│  │  Statut par environnement                      │             │
│  │                                                │             │
│  │  ✓ Production    Bundle 4dc5...   2m           │             │
│  │  ✓ Staging       Bundle a91f...   1h           │             │
│  │  ⚠ Local         Aucun ping reçu depuis 24h    │             │
│  │                                                │             │
│  └────────────────────────────────────────────────┘             │
│                                                                 │
│  ┌────────────────────────────────────────────────┐             │
│  │  Activité des outils (24h)                     │             │
│  │                                                │             │
│  │   Provider │ Events │ Taux succès │ Dernier   │             │
│  │   GA4      │ 1247   │  100%       │  2m       │             │
│  │   Meta     │ 1247   │  100%       │  2m       │             │
│  │   Ads      │   234  │  100%       │  5m       │             │
│  │                                                │             │
│  └────────────────────────────────────────────────┘             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 5. Persistance d'état

### LocalStorage

```typescript
// Clé : femiglow.tracking-plan-draft.v1
{
  draftPlanId: 'plan-xxx',
  lastSavedAt: '2026-05-14T14:23:12Z',
  expandedSections: ['providers', 'identifiers'],
  ui: {
    mode: 'wizard',  // ou 'expert'
    density: 'standard',  // ou 'compact'
    previewVisible: true,
    sidebarCollapsed: false
  }
}
```

### Recovery après crash navigateur

Si Amal ferme l'onglet par accident pendant un wizard :
1. Au retour, banner en haut : *"Reprise de votre brouillon en cours — modifications du 14/05 14:23"*.
2. Bouton "Reprendre" / "Repartir de zéro".

### Cross-tab sync

Si Amal ouvre 2 onglets sur le même plan :
- Banner dans le 2e : "Ce plan est déjà ouvert dans un autre onglet."
- Bouton "Forcer ouverture" (perd les modifs non sauvées de l'autre onglet).
- Tab actif → édition possible. Tab inactif → mode lecture jusqu'à reprise focus.

## 6. Auto-save

| Trigger | Délai | Indicateur |
|---|---|---|
| Modification d'un champ | 5s after last keystroke | "Sauvegardé il y a 1s" en haut |
| Click hors champ (blur) | Immédiat (si dirty) | Idem |
| Click sur step suivant | Immédiat (forcé) | "Sauvegardé" puis transition |
| Tab close | Force sync (beforeunload) | Notif "Sauvegarde en cours…" |

Statuts :
- `idle` (aucune modif) → invisible.
- `dirty` (modifs non sauvées) → "Modifications non sauvegardées" en orange.
- `saving` (en cours) → spinner + "Sauvegarde en cours…".
- `saved` (succès) → ✓ "Sauvegardé à 14:23".
- `error` (échec) → ✗ "Erreur de sauvegarde — [Réessayer]".

Position : badge fixe haut droit, à côté du nom du plan.

## 7. Raccourcis (Power user)

Voir [keyboard-shortcuts.csv](keyboard-shortcuts.csv) pour la liste exhaustive.

Les essentiels :
- `Cmd/Ctrl + S` : sauver brouillon.
- `Cmd/Ctrl + K` : command palette (jump section / action).
- `Cmd/Ctrl + Enter` : activer (avec confirmation).
- `Cmd/Ctrl + /` : toggle JSON preview.
- `Esc` : fermer modale / quitter section.

## 8. Quick wins de productivité

### 8.1 Command palette (Cmd+K)

```
┌─────────────────────────────────────────┐
│ 🔍 Que voulez-vous faire ?              │
├─────────────────────────────────────────┤
│ Récents                                 │
│   → Aller à Step 3 — Événements         │
│   → Activer le plan                     │
│   → Télécharger le JSON                 │
├─────────────────────────────────────────┤
│ Actions                                 │
│   → Sauver brouillon         Cmd+S      │
│   → Activer le plan          Cmd+Enter  │
│   → Toggle JSON preview      Cmd+/      │
│   → Mode expert              Cmd+E      │
├─────────────────────────────────────────┤
│ Plans                                   │
│   → Production v8 (actif)               │
│   → Production v7 (archivé)             │
│   → Test refonte purchase params (draft)│
└─────────────────────────────────────────┘
```

### 8.2 Smart paste

Si Amal copie-colle "G-5VHP17SDZM" dans n'importe quel champ ID, l'app détecte le format et l'assigne automatiquement à `ga4.measurementId`.

Idem pour :
- "AW-12345" → `googleAds.conversionId`
- "GTM-M8K7V88D" → `gtm.containerId`
- 15-16 chiffres pure → `meta.pixelId`

Si plusieurs IDs matchent, propose un choix.

### 8.3 Bulk operations

Sur la matrice d'événements (Step 3) :
- "Cocher tout pour GA4" en haut de colonne.
- "Activer le preset standard" (boutton qui charge les 15 events FemiGlow par défaut).
- "Désactiver tous les events de TikTok" si dépréciation.

### 8.4 Diff avant activation

Avant d'activer un plan, modale qui montre **uniquement les changements** vs version actuelle :
```
+ Pixel ID Meta : 1234567890 → 9876543210
- Event tiktok.AddToCart : retiré
+ Event ga4.purchase : ajout du param `shipping_country`
```

Empêche d'activer "à l'aveugle".

## 9. Erreurs et récupération

| Scénario | Comportement |
|---|---|
| Network error pendant save | Retry auto 3× (espacés 1s, 3s, 10s) + banner si échec définitif |
| Validation server fail | Banner + erreurs inline + scroll vers premier champ en erreur |
| Concurrent edit (autre admin modifie le plan) | Toast + bouton "Recharger" + diff visible |
| Activation fail (server down) | Toast + lien "Voir logs" + retry après 30s auto |
| Browser offline | Banner "Pas de connexion — modifications conservées localement" |

## 10. Onboarding nouveau admin

Premier accès à `/admin/tracking` après création du compte :

```
┌──────────────────────────────────────────────┐
│   Bienvenue dans Tracking — FemiGlow         │
│                                              │
│   Vous allez gérer ici la collecte de        │
│   données analytics (GA4, Meta, Ads…).       │
│                                              │
│   3 étapes pour démarrer :                   │
│                                              │
│   1. Créer votre premier plan                │
│   2. Configurer les outils                   │
│   3. Importer dans GTM                       │
│                                              │
│         [Voir le tutoriel]  [Démarrer]       │
└──────────────────────────────────────────────┘
```

Tutoriel : tour guidé léger (5 popovers, < 2 min). Skippable.

## 11. Mobile / tablette

L'admin tracking n'est **pas** conçu pour mobile (cas d'usage Amal = desktop). Le layout reste lisible jusqu'à `md` (768px) mais :
- < `md` : avertissement "Cette page est optimisée pour ordinateur. Certaines fonctions peuvent être limitées."
- < `sm` (640px) : redirection vers une vue lecture seule simplifiée.

Tablette (`md`–`lg`) : layout 1 colonne sur step content, sidebar masquable.
