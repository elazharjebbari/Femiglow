# Chat ergonomics — Intégration tracking ↔ chat

L'utilisateur a souligné l'importance d'une "ergonomie maximale du chat et du gestionnaire admin". Ce document décrit l'intersection : comment le module tracking interagit avec le module chat (support FemiGlow) **dans les deux sens**.

## 1. Surface chat → admin tracking

### 1.1 Events tracking déclenchés depuis le chat (public)

Le chat support de FemiGlow déclenche des événements analytiques. Ces events doivent être :
- **Définis dans le tracking plan** (admin) → garantit qu'ils sont catalogués.
- **Validés par le plan actif** → un event hors plan logue un warning serveur.

Liste des events chat émis (existants) :

| Event | Quand | Providers cibles |
|---|---|---|
| `chat_open` | Ouverture du widget chat | ga4 |
| `chat_message_sent` | Message user envoyé | ga4 |
| `chat_message_received` | Message bot reçu | ga4 |
| `chat_lead_form_shown` | Formulaire lead apparait dans chat | ga4, meta |
| `chat_lead_form_submitted` | Lead submit | ga4, ads, meta |
| `chat_handoff_to_human` | Bascule vers agent humain | ga4 |
| `chat_session_end` | Fin de session | ga4 |

Tous ces events sont **pré-cochés** par défaut dans un nouveau plan (preset standard FemiGlow). Si l'admin les décoche, le chat continuera à les émettre côté client, mais GTM ne les enverra pas aux outils.

### 1.2 Notifications chat admin

Le chat admin (interface support) reçoit des notifications inline liées au tracking :

```
┌──────────────────────────────────────────────────────┐
│ 💬 Chat admin                                        │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Conversation avec Khadija (cliente)                 │
│  ─────────────────────────────                       │
│  Khadija : Bonjour, j'ai un souci avec ma commande   │
│  Vous    : Bonjour Khadija, je vous écoute           │
│                                                      │
│  ┌────────────────────────────────────────────────┐ │
│  │ ⚠ Le tracking GTM montre un drift critique     │ │  ← notif inline
│  │   depuis 14:32. Les conversions de cette        │ │     côté admin
│  │   conversation peuvent ne pas remonter.         │ │     (pas visible
│  │   [Voir tracking →]                             │ │     côté client)
│  └────────────────────────────────────────────────┘ │
│                                                      │
└──────────────────────────────────────────────────────┘
```

L'agent humain qui chatte avec une cliente sait immédiatement si le tracking de cette conversation pourrait ne pas remonter, pour préventivement noter le lead manuellement.

### 1.3 Quick-link tracking depuis chat

Footer du chat admin :
```
┌──────────────────────────────────────┐
│ [📊 Voir tracking]  [📋 Plans]       │
└──────────────────────────────────────┘
```

## 2. Surface admin tracking → chat

### 2.1 Lien retour vers chat

Sidebar admin tracking : item "💬 Support" → ouvre chat admin dans nouvel onglet (pas de SPA navigation pour préserver l'état du plan en cours d'édition).

### 2.2 Test live d'un event chat

Sur la page sync de l'admin tracking, bouton :
```
[ Tester un event chat ]
```

Click ouvre un side panel :
```
┌─────────────────────────────────────┐
│  Test live d'un event chat          │
│                                     │
│  Event : [chat_lead_form_submitted ▼]│
│  Channel : [whatsapp ▼]              │
│  Source : [google_ads ▼]             │
│                                     │
│  ┌─────────────────────────────────┐│
│  │ Payload résolu :                ││
│  │ {                               ││
│  │   event: 'lead_form_submit',    ││
│  │   form_source: 'chat-pair',     ││
│  │   channel: 'whatsapp',          ││
│  │   ...                           ││
│  │ }                               ││
│  └─────────────────────────────────┘│
│                                     │
│  Providers ciblés :                 │
│    ✓ ga4    ✓ ads    ✓ meta         │
│                                     │
│         [ Envoyer event test ]      │
└─────────────────────────────────────┘
```

L'event part en mode `?debug=true` : GTM ne déclenche pas les tags pour vrai (no-op au niveau pixel) mais l'admin voit le flux complet dans le network tab.

### 2.3 Bandeau de canned chat dans tracking

Quand un drift critique est détecté, en plus du bandeau standard, un quick action :
```
┌──────────────────────────────────────────────────────┐
│ ✗ Drift critique depuis 14:32                        │
│   [Comprendre]  [Re-télécharger JSON]                │
│   [💬 Prévenir l'équipe sur le chat interne]         │
└──────────────────────────────────────────────────────┘
```

Click → ouvre chat interne avec message pré-rempli : *"Heads-up : drift tracking détecté sur prod, je m'en occupe. Lien : /admin/tracking/sync."*

## 3. Cohérence visuelle entre chat et tracking

Les deux modules partagent les mêmes patterns :

| Pattern | Chat | Tracking | Identique ? |
|---|---|---|---|
| `StatusCard` | "Chat : 4 conversations actives" | "Tracking : Plan actif Production v8" | ✓ |
| `Badge active` | "Live" | "Actif" | ✓ |
| `Badge draft` | "Brouillon" | "Brouillon" | ✓ |
| Toasts | success/info/warning/error | Idem | ✓ |
| Modales destructive | Saisie du nom pour confirmer | Idem | ✓ |
| Sidebar items | Icon + label | Icon + label | ✓ |
| Color scheme | sauge/crème/encre | sauge/crème/encre | ✓ |
| Typography | Inter | Inter | ✓ |
| Density (compact/standard) | Toggle | Toggle | ✓ |

L'admin qui passe de chat à tracking et vice versa ne ressent **pas de rupture cognitive**.

## 4. Persistance d'état partagée

LocalStorage :

```typescript
// Clé : femiglow.admin.ui.v1
{
  density: 'standard',     // partagé chat + tracking
  sidebarCollapsed: false, // partagé
  theme: 'auto',           // partagé
  // Modules spécifiques :
  chat: {
    notificationsEnabled: true,
    autoFocus: false
  },
  tracking: {
    mode: 'wizard',
    previewVisible: true,
    // ...
  }
}
```

L'admin règle "compact" une fois, c'est appliqué partout.

## 5. Notifications cross-module

Sources de notifications :

| Source | Cible | Quand |
|---|---|---|
| Tracking → Chat admin | Toast haut droit | Drift critique détecté |
| Tracking → Chat admin | Banner inline conversation | Drift actif pendant conv en cours |
| Chat admin → Tracking | Toast | Lead form submitted (info) |
| Chat admin → Tracking | Toast critical | Lead form submit échoue (warning admin) |

Les notifications ne sont **pas** des modales bloquantes. Toast 5s + bouton "Voir" pour acter.

## 6. Recherche globale

Cmd+K dans n'importe quelle page admin propose des résultats des deux modules :

```
┌──────────────────────────────────────────┐
│ 🔍 production v8                         │
├──────────────────────────────────────────┤
│ Tracking                                 │
│   → Plan "Production v8" (actif)         │
│   → Historique des versions Production   │
│                                          │
│ Chat                                     │
│   → Conv. avec "Production v8"-mentioned │
│     (1 résultat)                         │
└──────────────────────────────────────────┘
```

Recherche full-text via API endpoint `/api/admin/search?q=...`.

## 7. Cohérence sémantique

Termes harmonisés entre chat et tracking :

| Terme | Définition partagée |
|---|---|
| **Plan** | Conteneur d'événements (tracking) ou de canned messages (chat) |
| **Version** | Snapshot immuable d'un plan |
| **Actif** | Version en production |
| **Brouillon** | Version éditable, non-publiée |
| **Archivé** | Version inactive, conservée historiquement |
| **Publier / Activer** | Verbe d'action pour passer brouillon → actif |
| **Ping** | Signal client réception (tracking) ou heartbeat connexion (chat) |
| **Drift** | Écart entre attendu et observé |

Pas de "deploy" vs "publish" vs "activate" en désordre — un seul terme : **activer**.

## 8. Ergonomie spécifique chat (déjà existant, à préserver)

L'interface chat existante est ergonomique sur ces points :
- Lazy loading des messages anciens.
- Focus auto sur input après envoi.
- Indicateur typing en temps réel.
- Raccourcis : Enter envoie, Shift+Enter saut de ligne.
- Pre-canned suggestions selon contexte.
- Notifications sonores désactivables.

**Ne pas régresser** ces patterns en ajoutant les notifs tracking. Test E2E à prévoir.

## 9. Cas limite : admin gère tracking pendant une conv

```
Scénario :
1. Amal est en train de gérer un client sur le chat admin.
2. Elle reçoit notification "Drift critique".
3. Elle clique "Voir tracking" → nouvel onglet.
4. Elle fix le drift (re-télécharge le JSON, importe GTM).
5. Elle revient au chat.
6. Le chat doit retrouver son état exact (conv ouverte, scroll position, draft message si pas envoyé).
```

Implémentation : chat utilise `sessionStorage` pour préserver l'état pendant la session, + heartbeat WebSocket pour ne pas couper la conv.

## 10. Anti-patterns à éviter

- **Notifications spam** : si 10 events trackés sont validés en 1 minute, ne pas afficher 10 toasts. Group + count.
- **Quitter le chat sans confirm** : si conv en cours + bouton "Voir tracking" → modal "Cette conversation est active. Continuer ?"
- **Drift banner persistant** dans chat alors que c'est OK : nettoyage agressif (polling 30s du status).
- **Termes incohérents** : ne pas dire "déployer" dans tracking et "publier" dans chat. Un seul terme.
