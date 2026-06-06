# Suppression & Events — fiche d'audit

## A. Liste de suppression `/admin/emails/suppression`

**Fichiers** : `components/admin/emails/cockpit/SuppressionList.tsx`,
`lib/mail/suppression.ts`, `api/admin/emails/suppression/route.ts`
**Modèle** : `email_suppression` (email PK, reason enum ×7, detail, since,
source enum ×4). Allowlist interne R-009 (domaine @femiglow-maroc.com jamais
suppressible, invisible dans l'UI). Alimentée par : webhook Stalwart (hard
bounce), Listmonk, bulk-suppress cockpit, flux unsubscribe public (avec
réabonnement qui ne retire QUE reason=unsubscribe).

### État actuel — wireframe
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Emails › Liste de suppression                                                │
│ Liste de suppression                                                         │
│ Adresses bloquées pour tous les envois…                                      │
│ [Filtrer par email, raison ou source…    ] [Rechercher] effacer              │ ← placeholder MENSONGER :
│ ✓ a@x.com retiré de la liste                                                 │   seul l'email est filtré
│ ┌─────────────┬──────────────────────┬──────────┬───────────────┬─────────┐ │
│ │ Adresse     │ Raison               │ Source   │ Depuis        │ Action  │ │
│ │ a@x.com     │ Bounce permanent     │ Stalwart │ 05/06 10:00   │[Retirer]│ │
│ │ b@y.com     │ Désinscription       │ Manuel   │ 04/06 18:22   │[Retirer]│ │
│ │             │ (list-unsubscribe-…) │          │               │         │ │ ← detail cryptique
│ └─────────────┴──────────────────────┴──────────┴───────────────┴─────────┘ │
│ 1–50 sur 12 500                       [Précédent] [Suivant]                  │
│ Retirer une adresse la rend de nouveau joignable (transactionnel ET camp.)   │
└─────────────────────────────────────────────────────────────────────────────┘
Retrait : window.confirm 3 lignes → DELETE → ligne préservée si erreur (bien).
```

### Problèmes
`SUP-01` orpheline de la navigation (aucun lien dashboard/sidebar — seul accès :
URL directe ou deep-link `?email=` du détail transactionnel) · `SUP-02` pas
d'ajout manuel (l'API `addSuppression()` existe) · `SUP-03` filtres
raison/source supportés par l'API mais non exposés · `SUP-04` pas de retrait en
masse (200 faux positifs = 200 clics + 200 confirm) · `SUP-05` detail cryptique ·
`SUP-06` pas d'export · `SUP-07` pagination sans saut.

### Cible (chantier C8) — wireframe
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [onglet « Suppression » dans la barre C2]            [+ Ajouter une adresse] │ ← SUP-01/02
│ [email… ] Raison [Toutes ▼] Source [Toutes ▼] [Rechercher]  [⬇ Export CSV]  │ ← SUP-03/06
│ ┌──┬─────────────┬──────────────────┬──────────┬───────────────┬─────────┐  │
│ │☐ │ Adresse     │ Raison ⓘ         │ Source   │ Depuis        │         │  │ ← légende detail (SUP-05)
│ │☑ │ a@x.com     │ Bounce permanent │ Stalwart │ 05/06 10:00   │[Retirer]│  │
│ ├──┴─────────────┴──────────────────┴──────────┴───────────────┴─────────┤  │
│ │ ✓ 23 sélectionnées  [Retirer les 23 adresses…] (ConfirmDialog unique)  │  │ ← SUP-04
│ └─────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
Dialog d'ajout : email* · raison* (dropdown 7) · détail* (obligatoire pour
manual_admin : trace du POURQUOI) · rappel « bloque transactionnel ET campagnes ».
```

---

## B. Events (debug) `/admin/emails/events`

**Fichiers** : `components/admin/emails/events/EventsDashboardView.tsx`,
`lib/user-events/queries.ts` — table `user_event` (pipeline générique,
**distinct** de `email_event`).

### État actuel — wireframe
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ← Tableau de bord                                                            │
│ Events utilisateur (debug)                                                   │
│ ┌ Total 24h ┐   TOP EVENTS (24H)                                            │
│ │   465     │   │ Event          │ Source │ Nombre │                        │
│ └───────────┘   │ page_view      │ [web]  │    312 │ ← clic = filtre source │
│                 │ email_open     │ [email]│     88 │                        │
│ Filtrer source : [Tous] [web] [email] [server] [admin] [import]              │
│ 100 DERNIERS EVENTS                                                          │
│ │ Date     │ Email   │ Event        │ Source │ Propriétés                  │ │
│ │ 14:30:45 │ a@x.com │ cart_abandon…│ [web]  │ {"items":[{"id":"r-12…    │ │ ← tronqué (max-w-md)
│ └──────────┴─────────┴──────────────┴────────┴─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
⚠ le stream « 100 derniers » n'a PAS de fenêtre temporelle (peut afficher des
events vieux de plusieurs jours sous des compteurs 24 h).
```

### Problèmes
`EVT-01` aucune corrélation outbox/campagne (pipeline isolé : impossible de
remonter d'un event au mail) · `EVT-02` JSON tronqué sans expand · `EVT-03`
fenêtres incohérentes (24 h vs « tout ») · `EVT-04` pas de filtre nom/email ·
`EVT-05` table non responsive.

### Cible (chantier C8) — wireframe
```
│ Filtres : source [email ▼]  event [cart_*___]  email [a@x.com___]  (24 h ▼) │ ← EVT-03/04
│ │ 14:30:45 │ a@x.com │ cart_abandoned │ [web] │ ▸ propriétés (3 clés)      │ │ ← EVT-02 <details>
│ │          │         │                │       │   {"items":[…],            │ │   JSON formaté
│ │          │         │                │       │   outbox: 9f8e… → [cockpit]│ │ ← EVT-01 lien si
│ └──────────┴─────────┴────────────────┴───────┴────────────────────────────┘ │   outbox_id présent
```
+ renommer le titre « Events utilisateur (pipeline user_event) » pour lever
l'ambiguïté avec `email_event` (timeline du cockpit), et `overflow-x-auto`.
