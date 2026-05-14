# Wizard spec maître — Spécification UX détaillée

> Ce document est **la source de vérité UX** pour les écrans M5. Chaque
> wizard / écran est spécifié : flow, états, validations, interactions
> clavier, micro-copy, edge cases. L'implémentation suit ces specs au
> pixel près.

## Table des matières

- [Principes UX transverses](#principes-ux-transverses)
- [1. Cockpit transactionnel](#1-cockpit-transactionnel)
- [2. Audience builder](#2-audience-builder)
- [3. Campaign wizard V2](#3-campaign-wizard-v2)
- [4. Automation studio](#4-automation-studio)
- [Composants partagés](#composants-partagés)

---

## Principes UX transverses

### Style général
- **Ton** : sobre, professionnel, peu d'emoji (sauf chips de statut)
- **Densité** : tableau dense, mais espacement généreux dans les forms
- **Couleurs** : palette FemiGlow (stone-* sur Tailwind), accent vert sauge
- **Typo** : sans-serif système, mono pour les codes/slugs
- **Motion** : transitions 150ms, easing standard, respect
  `prefers-reduced-motion`

### Patterns récurrents
- **Sticky header** sur les tableaux (le filtre toujours visible)
- **Side drawer** pour édition (pas de full-page navigation pour
  éviter perte de contexte)
- **Toast undo** systématique sur action réversible (8s)
- **Modal de confirmation** sur action destructive
  (input "supprimer" requis sur suppression définitive)
- **Skeleton** sur loading > 200ms
- **Empty states** avec illustration + CTA
- **Error states** avec retry + lien support

### Raccourcis clavier (uniformes)
| Touche | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Ouvrir command palette |
| `?` | Cheat sheet raccourcis |
| `j` / `k` | Navigation ligne suivante/précédente |
| `Enter` | Ouvrir l'élément |
| `e` | Éditer |
| `/` | Focus search |
| `Esc` | Fermer modale/drawer |

---

## 1. Cockpit transactionnel

### 1.1 Layout général

```
┌────────────────────────────────────────────────────────────────────────┐
│ AdminShell › Emails › Transactional                              [⌘K] │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│ ╭─ KPI Header (last 1h, refresh 5s) ──────────────────────────────────╮│
│ │                                                                    ││
│ │   📨 1,243        ⏳ 12         ✗ 8           ⚠ 3                  ││
│ │   delivered      queued        failed         hard bounce         ││
│ │   ↑ +12% vs J-1  →             ↓ -23%         ⚠ 1 needs attention ││
│ │                                                                    ││
│ ╰────────────────────────────────────────────────────────────────────╯│
│                                                                        │
│ ┌──────────────────────┐ ┌──────────────────────────────────────────┐ │
│ │ 💾 Saved views       │ │ ⌘K   status:failed template:cart*        │ │
│ │  ▸ All today         │ │ ─────────────────────────────────────────│ │
│ │  ▸ Failed today (8)  │ │  [☐] Date        Recipient   Template..  │ │
│ │  ▸ Bounces 7d (3)    │ │  [☐] 22:14:03   user@x.y    welcome      │ │
│ │  ▸ Awaiting retry(0) │ │  [☐] 22:13:55   a@b.c       cart-aband.. │ │
│ │  ─────────────────   │ │  [☐] 22:13:42   c@d.e       order-conf   │ │
│ │  📁 My views         │ │   ...                                    │ │
│ │   ▸ VIP failures     │ │                                          │ │
│ │   + New view         │ │  [Selected: 0] [Bulk actions ▾]          │ │
│ └──────────────────────┘ └──────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

### 1.2 KPI Header — détail

| Élément | Spec |
|---|---|
| 4 chiffres | Counts last 1h : delivered / queued / failed / hard bounce |
| Refresh | Auto 5s + bouton "↻ rafraîchir" |
| Sparkline | Mini graphe sur 12h (12 buckets de 1h) sous chaque chiffre |
| Tendance | Comparaison vs J-1 (même fenêtre 1h hier) : ↑ vert, ↓ rouge, → gris |
| Alerte | Si `failed > 5` last 5min OR `hard_bounce > 2` last 1h → bordure rouge + badge "⚠ needs attention" + son léger (option) |
| Clic | Sur un chiffre → filtre auto le tableau sur ce statut |

### 1.3 Cmd-K palette — détail

```
┌─────────────────────────────────────────────────────────────────────┐
│ ⌘K    Type to filter, save view, or run action                  ⓘ  │
├─────────────────────────────────────────────────────────────────────┤
│ 🔍 Filters                                                          │
│   status:failed                          → filter by status         │
│   to:user@x.y                            → filter by recipient      │
│   template:welcome                       → filter by template       │
│   after:2026-05-01                       → filter by date           │
│   source:api.contact                     → filter by source         │
│                                                                     │
│ 💾 Saved views                                                       │
│   ▸ All today                                                       │
│   ▸ Failed today                                                    │
│                                                                     │
│ ⚡ Actions                                                           │
│   Retry selected (3)                                                │
│   Export selection to CSV                                           │
│   Save current view as...                                           │
└─────────────────────────────────────────────────────────────────────┘
```

#### Syntaxe de filtres
```
status:VALUE           # one of: pending|sending|sent|delivered|failed|bounced_soft|bounced_hard|suppressed
to:EMAIL_OR_GLOB       # user@x.y | *@bad.tld | *@*.fr
template:SLUG_OR_GLOB  # welcome | cart-* | order-*
source:SOURCE          # api.contact | api.newsletter | automation.cart-abandoned
after:DATE             # 2026-05-01 | yesterday | -7d | -1h
before:DATE
attempts:>N            # operators: >, >=, <, <=, =
has:error              # has lastError non null
```

Combinaisons : espace = AND. `OR` interdit en V1 (simplifie le parser).

#### Comportement
- **Enter** sur un suggestion → applique et ferme la palette
- **Tab** → autocomplete la valeur courante
- **Esc** → ferme sans changer
- **↑/↓** → naviguer les suggestions
- L'URL reflète l'état (`?status=failed&template=cart-*`) pour shareable
- Le filtre persiste dans `sessionStorage` jusqu'à reload

### 1.4 Saved Views — détail

| Type | Persistance | Visibilité |
|---|---|---|
| **Système** | hardcoded | Tous admins (`All today`, `Failed today`, `Bounces 7d`, `Awaiting retry`) |
| **My views** | `admin_email_view` table, scoped par admin | Créateur uniquement |

Création :
1. Filtres appliqués dans la palette
2. `⌘K → "Save view as..."` → input nom
3. Ajouté à "My views"
4. Toast "View saved" + bouton "Undo"

Édition :
1. Hover sur la view → 3-dots menu → "Rename" / "Delete"
2. Confirmation modal sur delete

### 1.5 Tableau — détail

#### Colonnes
| Col | Largeur | Contenu | Sort | Click |
|---|---|---|---|---|
| `[☐]` | 32px | Checkbox sélection | – | toggle |
| Date | 120px | `HH:mm:ss` ou `JJ/MM HH:mm` si J-1+ | ✓ DESC default | – |
| Destinataire | flex | email (tronqué + tooltip) | ✓ | filter by `to:` |
| Template | 180px | slug + version chip | ✓ | filter by `template:` |
| Sujet | flex | truncate | – | – |
| Statut | 120px | badge coloré | ✓ | filter by `status:` |
| Att. | 80px | `n/max` ; tooltip dernier error | – | – |
| Source | 140px | source chip | ✓ | filter by `source:` |
| Action | 48px | … menu (retry, view, suppress) | – | – |

#### Sélection
- Click sur checkbox → sélection
- Shift+click → range selection
- `⌘A` ou checkbox header → select all (avec confirmation si > 100)
- Selected count visible dans le footer : `[Selected: 12]`

#### Action `[Bulk actions ▾]`
- Retry selected
- Mark as suppressed (sur emails de bounced_hard uniquement)
- Export CSV
- Clear selection

#### Bouton ligne `…` (3-dots)
- View details
- Retry (si applicable)
- Copy recipient email
- View timeline
- Suppress this recipient

### 1.6 Empty states

| Cas | Affichage |
|---|---|
| Aucun email envoyé (DB vide) | Illustration + "Aucun email envoyé pour l'instant" + "Quand un email partira (formulaire contact, commande…), il apparaîtra ici" |
| Filtre sans résultat | "Aucun email ne correspond à ces filtres" + "Effacer les filtres" |
| Erreur chargement | Erreur + bouton "Réessayer" + lien support |

### 1.7 États de chargement

| Cas | Affichage |
|---|---|
| Initial load | Skeleton header + table (5 rows) |
| Refresh KPI | Subtle pulse sur les chiffres |
| Filter apply | Spinner inline dans la barre de filtre |
| Bulk retry | Toast persistant "Retry 12 emails…" → "Done" / "Failed: X" |

### 1.8 Edge cases

| Cas | Comportement |
|---|---|
| Filtre invalide (`status:foo`) | Souligner rouge dans la palette, message "Unknown status" |
| > 10k rows match | Toast "Showing first 1000. Refine filters or export CSV" |
| Retry sur > 50 emails | Modal "Vraiment retry 87 emails ?" + double confirmation |
| Permission revoked | Redirect /admin/login + toast "Session expirée" |

---

## 2. Audience builder

### 2.1 Layout — page liste

```
┌────────────────────────────────────────────────────────────────────────┐
│ AdminShell › Emails › Audiences                       [+ New audience]│
├────────────────────────────────────────────────────────────────────────┤
│ 🔍 Search...   Filter by: [Owner ▾]  [Sort ▾]                          │
├────┬────────────────────┬──────────────┬────────┬─────────┬───────────┤
│ ☐  │ Nom                │ Critères     │ Taille │ Snapshots│ Actions  │
├────┼────────────────────┼──────────────┼────────┼─────────┼───────────┤
│ ☐  │ 🎯 VIP             │ 3+ orders    │ 47     │ 2       │ ⋯         │
│ ☐  │ 🎯 Cart abandoners │ cart 7d      │ 312    │ 8       │ ⋯         │
│ ☐  │ 🎯 Newsletter      │ subscriber   │ 1,204  │ 15      │ ⋯         │
└────┴────────────────────┴──────────────┴────────┴─────────┴───────────┘
```

### 2.2 Wizard — création d'une audience (3 étapes)

#### Step 1 — Nom & description

```
╭──────────────────────────────────────────────────────────────╮
│ Nouvelle audience                                  Step 1/3  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Nom *                                                       │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Clientes VIP                                           │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  Slug (auto)                                                 │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ clientes-vip                                           │  │
│  └────────────────────────────────────────────────────────┘  │
│  ℹ Le slug ne peut plus changer après création               │
│                                                              │
│  Description (optionnel)                                     │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Clientes qui ont passé au moins 3 commandes            │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  [Annuler]                                  [Continuer →]    │
╰──────────────────────────────────────────────────────────────╯
```

Validations :
- Nom : 3-80 caractères
- Slug : auto-généré depuis le nom, kebab-case, unique (vérif backend)
- Description : max 500 chars

#### Step 2 — Définition des critères

```
╭──────────────────────────────────────────────────────────────────────╮
│ Nouvelle audience › Clientes VIP                          Step 2/3  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Inclure les contacts qui satisfont                                  │
│  ╭──────────────────────────────────────────────────────────────╮   │
│  │  [+ Ajouter un critère ▾]                                    │   │
│  │                                                              │   │
│  │  ┌────────────────────────────────────────────────────────┐  │   │
│  │  │ 🛒 Commerce                                            │  │   │
│  │  │ Nombre de commandes  [≥ ▾]  [3]  depuis [janvier 2025▾]│  │   │
│  │  │                                                   [✕] │  │   │
│  │  └────────────────────────────────────────────────────────┘  │   │
│  │                                                              │   │
│  │     Combinaison : (•) ET   ( ) OU                            │   │
│  │                                                              │   │
│  │  ┌────────────────────────────────────────────────────────┐  │   │
│  │  │ 🛒 Commerce                                            │  │   │
│  │  │ Total dépensé  [≥ ▾]  [1000]  MAD                      │  │   │
│  │  │                                                   [✕] │  │   │
│  │  └────────────────────────────────────────────────────────┘  │   │
│  │                                                              │   │
│  │  [+ Ajouter un critère ▾]                                    │   │
│  ╰──────────────────────────────────────────────────────────────╯   │
│                                                                      │
│  Exclure (toujours appliqué)                                         │
│  ☑ Hard bounces                                                      │
│  ☑ Unsubscribes                                                      │
│  ☑ Manual suppressions                                               │
│  ☐ Opt-out marketing global (consentMarketing=false)                 │
│                                                                      │
│  ╭─ Aperçu live ────────────────────────────────────────────────╮   │
│  │  🎯 47 contacts                                  [↻ Refresh] │   │
│  │  ▼ Voir 10 exemples                                          │   │
│  │     fatima@example.com  (4 commandes, 2 340 MAD)            │   │
│  │     hicham@example.com  (3 commandes, 1 120 MAD)            │   │
│  │     ...                                                      │   │
│  ╰──────────────────────────────────────────────────────────────╯   │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│  [← Retour]                              [Continuer →]               │
╰──────────────────────────────────────────────────────────────────────╯
```

#### Catalogue de critères proposés

Le bouton `[+ Ajouter un critère ▾]` ouvre un menu hiérarchique :

```
🧍 Identité
   • Email contient / commence / finit par
   • Pays
   • Langue
   • Date d'inscription
   • Consent marketing

🛒 Commerce
   • Nombre de commandes (≥, ≤, =, plage)
   • Total dépensé (MAD, plage)
   • A commandé le produit X
   • Date dernière commande
   • Mode de paiement utilisé

✉ Engagement email
   • A ouvert un email (any / template précis, fenêtre)
   • A cliqué un lien (any / URL précise)
   • A reçu N emails sans en ouvrir

📅 Activité
   • Inactif depuis N jours
   • Première visite (date)
   • Nombre de sessions

🏷 Tags
   • A le tag X
   • N'a pas le tag X
```

Pour chaque critère, le formulaire dynamique propose les bons opérateurs
et inputs.

#### Combinaison AND/OR
- AND par défaut entre tous les critères
- L'admin peut grouper avec OR via "[+ Ajouter un groupe OR]"
- Affiche les groupes par boîtes imbriquées

#### Preview live
- Recalcul automatique 1s après changement (debounce)
- Affiche count + bouton "Voir 10 exemples"
- Si > 50k → affiche "50k+, snapshot peut prendre du temps"
- Erreur si critère invalide : rouge inline + message

#### Step 3 — Récap + sauvegarde

```
╭──────────────────────────────────────────────────────────────────────╮
│ Nouvelle audience › Clientes VIP                          Step 3/3  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Récapitulatif                                                       │
│                                                                      │
│  Nom            : Clientes VIP                                       │
│  Slug           : clientes-vip                                       │
│  Description    : Clientes qui ont passé au moins 3 commandes        │
│                                                                      │
│  Critères :                                                          │
│   • Nombre de commandes ≥ 3 (depuis janv. 2025)                      │
│   ET                                                                 │
│   • Total dépensé ≥ 1000 MAD                                         │
│                                                                      │
│  Exclusions :                                                        │
│   ✓ Hard bounces, Unsubscribes, Manual suppressions                  │
│                                                                      │
│  Taille au moment de la création : 47 contacts                       │
│                                                                      │
│  Comportement à l'envoi (campagne) :                                 │
│   (•) Re-évaluer l'audience au moment de l'envoi (recommandé)        │
│   ( ) Figer la liste maintenant (snapshot statique)                  │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│  [← Retour]                              [✓ Créer l'audience]        │
╰──────────────────────────────────────────────────────────────────────╯
```

### 2.3 Page détail audience

```
┌────────────────────────────────────────────────────────────────────────┐
│ Audiences › Clientes VIP                          [Edit] [Delete] [⋯] │
├────────────────────────────────────────────────────────────────────────┤
│  📋 Description : Clientes 3+ commandes                                │
│  🎯 Taille actuelle : 47 contacts            [↻ Recompute]              │
│                                                                        │
│  📊 Critères                                                            │
│   • Commandes ≥ 3   ET   Total ≥ 1000 MAD                              │
│   - Hard bounces, Unsubscribes, Manual                                 │
│                                                                        │
│  📦 Snapshots (8)                                                       │
│   ┌──────────────────────────────────────────────────────────────┐    │
│   │ Date                 │ Taille │ Campagne associée │ Status   │    │
│   │ 2026-05-13 14:22     │ 47     │ Promo mai         │ active   │    │
│   │ 2026-05-01 09:00     │ 42     │ Welcome back      │ expired  │    │
│   │ ...                                                          │    │
│   └──────────────────────────────────────────────────────────────┘    │
│   [+ Snapshot maintenant]                                              │
│                                                                        │
│  📜 Historique modifications                                            │
│   13/05 22:30 — Created by elazhar@…                                   │
│   ...                                                                  │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.4 Validation backend (à respecter par le compiler)

| Critère | Validation |
|---|---|
| `orders.count >= N` | N entier 1-1000 |
| `orders.total >= N MAD` | N entier 0-10000000 |
| `email contains X` | X non vide |
| `date after/before` | Date valide ISO |
| Composition | Profondeur max 3 niveaux de groupes |

---

## 3. Campaign wizard V2

### 3.1 Changements vs V1

Le wizard 6 étapes existant reste. Modifications :
- **Step 2 (audience)** : remplace le multi-select Listmonk par le
  nouveau `AudienceSelector`
- **Step 6 (recap)** : affiche le snapshot d'audience (figé ou
  dynamique selon settings audience)

### 3.2 Step 2 — Audience (refonte)

```
╭──────────────────────────────────────────────────────────────╮
│ Nouvelle campagne › Promo Mai                      Step 2/6  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Cible de la campagne *                                      │
│                                                              │
│  ( ) Sélectionner une audience existante                     │
│      [ Audience ▾ ]                                          │
│      → 47 contacts (Clientes VIP)                            │
│                                                              │
│  ( ) Créer une nouvelle audience                             │
│      [Ouvrir le builder →]                                   │
│      (le builder ouvre une modale fullscreen, voir §2)       │
│                                                              │
│  ( ) Audience ad-hoc (one-shot, non sauvée)                  │
│      [ Définir des critères ▾ ]                              │
│      (mini-builder simplifié, mêmes critères que §2.2)       │
│                                                              │
│  ─────────────────────────────────────────────────────────   │
│                                                              │
│  Aperçu                                                      │
│   🎯 47 contacts seront ciblés                               │
│   ⚠ 3 hard bounces seront automatiquement exclus             │
│   📊 Taux d'engagement moyen sur cette audience : 12.4%      │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  [← Retour]                              [Continuer →]       │
╰──────────────────────────────────────────────────────────────╯
```

### 3.3 Step 6 — Recap (refonte)

```
... (autres infos identiques V1) ...

  🎯 Audience : Clientes VIP (47 contacts)
     ▸ Type : dynamique — re-évaluée au moment de l'envoi
     ▸ Au moment de l'envoi : nouveau snapshot créé, puis push
       vers Listmonk comme liste éphémère "fg-campaign-promo-mai-{ts}"
       (auto-supprimée à J+30)
  
  ✉ Envoi prévu : ...
```

---

## 4. Automation studio

### 4.1 Layout — page liste

```
┌────────────────────────────────────────────────────────────────────────┐
│ AdminShell › Emails › Automation                  [+ New automation]  │
├────────────────────────────────────────────────────────────────────────┤
│  Toutes  Actives  Inactives  Brouillons                                │
├──────────────────────┬────────────────┬──────────┬───────────┬────────┤
│  Slug                │ Trigger        │ Steps    │ État      │ Runs   │
├──────────────────────┼────────────────┼──────────┼───────────┼────────┤
│ 🤖 cart-abandoned-1h│ cart.abandoned │ 2        │ 🟢 active │ 142 ↗  │
│ 🤖 welcome-flow      │ lead.created   │ 4        │ 🟢 active │ 56     │
│ 🤖 vip-upsell        │ order.placed   │ 5        │ ⚪ draft  │ 0      │
└──────────────────────┴────────────────┴──────────┴───────────┴────────┘

🏃 Runs récentes (20 dernières)
┌──────────────────┬─────────────────┬─────────────┬───────────────────┐
│ Date             │ Email           │ Automation  │ Étape   Status    │
├──────────────────┼─────────────────┼─────────────┼───────────────────┤
│ 22:14            │ user@x.y        │ cart-1h     │ 2/2     ✓ done    │
│ 22:13            │ a@b.c           │ welcome     │ 3/4     ⏳ running │
│ ...                                                                  │
└──────────────────────────────────────────────────────────────────────┘
```

### 4.2 Wizard — création (5 étapes)

#### Step 1 — Métadonnées

```
╭──────────────────────────────────────────────────────────────╮
│ Nouvelle automation                              Step 1/5   │
├──────────────────────────────────────────────────────────────┤
│  Nom *               [Relance panier abandonné        ]      │
│  Slug *              [cart-abandoned-relance          ] ⓘ    │
│  Description         [...                              ]      │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                          [Continuer →]       │
╰──────────────────────────────────────────────────────────────╯
```

#### Step 2 — Trigger

```
╭──────────────────────────────────────────────────────────────────╮
│ Trigger                                              Step 2/5   │
├──────────────────────────────────────────────────────────────────┤
│  Type *                                                          │
│   (•) Événement (déclenche sur action user)                      │
│   ( ) Schedule (cron — déclenche périodiquement)                 │
│   ( ) Subscription (déclenche à l'inscription newsletter)        │
│                                                                  │
│  Événement *                                                     │
│   [ cart.abandoned                          ▾ ] (du catalogue)   │
│                                                                  │
│  Conditions optionnelles                                         │
│   ☑ Limiter à un événement par user / [24h ▾]                    │
│   ☑ L'utilisateur doit appartenir à l'audience                   │
│     [ Audience: VIP                       ▾ ]                    │
│   ☐ Filtrer sur propriétés de l'événement                        │
│     [+ Ajouter une condition]                                    │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│  [← Retour]                              [Continuer →]           │
╰──────────────────────────────────────────────────────────────────╯
```

#### Step 3 — Étapes (séquence)

```
╭───────────────────────────────────────────────────────────────────╮
│ Étapes                                                Step 3/5   │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Trigger: cart.abandoned                                          │
│   │                                                               │
│   ▼                                                               │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ 1. ⏳ Wait                                              [✕] │ │
│  │    Durée [1h ▾]                                              │ │
│  └──────────────────────────────────────────────────────────────┘ │
│   │                                                               │
│   ▼                                                               │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ 2. ✉ Send email                                         [✕] │ │
│  │    Template [cart-abandoned ▾]                               │ │
│  │    Variables auto-mapées :                                   │ │
│  │      firstName  ← lead.first_name                            │ │
│  │      cartTotal  ← trigger.payload.total                      │ │
│  │      resumeUrl  ← trigger.payload.resume_url                 │ │
│  └──────────────────────────────────────────────────────────────┘ │
│   │                                                               │
│   ▼                                                               │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ 3. ❓ Branch                                            [✕]  │ │
│  │    Condition : [user a ouvert step 2 ▾]                      │ │
│  │                                                              │ │
│  │    Si OUI                                                    │ │
│  │     ├ 3.1. ⏳ Wait [48h]                                     │ │
│  │     └ 3.2. ✉ Send template [welcome-back ▾]                  │ │
│  │                                                              │ │
│  │    Si NON                                                    │ │
│  │     └ 3.1. 🏷 Tag [cart_lost ▾]                              │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  [+ Ajouter une étape]                                            │
│    ▾ Choisir le type :                                            │
│       ⏳ Wait                                                     │
│       ✉ Send                                                      │
│       ❓ Branch                                                   │
│       🏷 Tag                                                      │
│       ✏ Update lead                                              │
│       🔗 Webhook                                                  │
│       ⏸ Wait for event                                            │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│  [← Retour]                              [Continuer →]            │
╰───────────────────────────────────────────────────────────────────╯
```

#### Spec par type de step

##### `wait`
- Durée : input chrono (1m, 5m, 1h, 24h, 7d, custom)
- Limite : 90 jours max

##### `send`
- Template : sélecteur (depuis `email_template_meta`)
- Mapping variables : auto-mappé depuis trigger.payload + lead.* ; éditable

##### `branch`
- Condition : ConditionBuilder réutilisable (audience match, event filter, field compare)
- Si OUI / NON : chacune contient une sous-séquence de steps

##### `tag`
- Action : add / remove
- Tag : autocomplete depuis `lead_tag` distinct

##### `update_lead`
- Champ : sélecteur (status, source, etc.)
- Valeur : input typé

##### `webhook`
- URL : URL valide HTTPS
- Méthode : POST / PUT
- Body : template variables

##### `wait_for_event`
- Événement : du catalogue
- Timeout : durée max (else continue)

#### Step 4 — Frequency & safety

```
╭──────────────────────────────────────────────────────────────╮
│ Sécurité & fréquence                              Step 4/5   │
├──────────────────────────────────────────────────────────────┤
│  ☑ Cooldown : ne pas re-trigger cette automation < [7d ▾]    │
│      pour le même user                                       │
│                                                              │
│  ☑ Respecter les quiet hours (8h-22h timezone Maroc)         │
│      Les sends nocturnes sont retardés au matin              │
│                                                              │
│  ☐ Limite globale : max [____] runs par jour                 │
│                                                              │
│  ☑ Exclure les emails en suppression list                    │
│                                                              │
│  ☐ Mode test : ne pas envoyer, simuler dans logs             │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  [← Retour]                              [Continuer →]       │
╰──────────────────────────────────────────────────────────────╯
```

#### Step 5 — Activation

```
╭──────────────────────────────────────────────────────────────╮
│ Activation                                       Step 5/5   │
├──────────────────────────────────────────────────────────────┤
│  Récapitulatif                                               │
│   Nom        : Relance panier abandonné                      │
│   Trigger    : cart.abandoned (audience VIP)                 │
│   Steps      : 5 (wait, send, branch[2,1])                   │
│   Cooldown   : 7 jours par user                              │
│                                                              │
│  Activation                                                  │
│   ( ) Brouillon (désactivé)                                  │
│   (•) Activer immédiatement                                  │
│   ( ) Activer à partir de [____]                             │
│                                                              │
│  ⚠ Estimation impact : ~30-50 runs/jour                      │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  [← Retour]                            [✓ Créer + activer]   │
╰──────────────────────────────────────────────────────────────╯
```

### 4.3 Page détail / édition

Mêmes étapes que création, pré-remplies. Bouton "Save" remplace
"Créer". Une fois sauvée, ouvrir page run history :

```
┌────────────────────────────────────────────────────────────────────────┐
│ Automation › Relance panier abandonné       [Edit] [Pause] [Delete]    │
├────────────────────────────────────────────────────────────────────────┤
│  🟢 Active   Created 13/05  Cooldown 7d  Last run 22:14                │
│                                                                        │
│  Trigger graph (lecture seule)                                          │
│  [voir wizard step 3]                                                  │
│                                                                        │
│  Runs (last 100)                                                       │
│   …tableau filtrable par status (running, completed, errored)…         │
│                                                                        │
│  Stats 30 derniers jours                                               │
│   Total runs       : 142                                               │
│   Completed        : 138 (97%)                                         │
│   Errored          : 4                                                 │
│   Avg duration     : 1h 12min                                          │
│   Emails sent      : 142 (step 2) + 89 (step 3.1 yes) = 231            │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.4 Vue détaillée d'une run

```
┌────────────────────────────────────────────────────────────────────────┐
│ Run #abc123 — user@x.y — cart-abandoned-relance                        │
├────────────────────────────────────────────────────────────────────────┤
│  Status : ⏳ running (step 3/5)                                         │
│  Started: 22:14:03 (3min ago)                                          │
│  Next   : step 3 at 23:14:03                                           │
│                                                                        │
│  Timeline                                                              │
│  ✓ 22:14:03 — Triggered by cart.abandoned                              │
│  ✓ 22:14:03 — Step 1 (wait 1h) started                                 │
│  ✓ 23:14:03 — Step 1 done                                              │
│  ✓ 23:14:03 — Step 2 (send cart-abandoned) → outbox#456                │
│  ⏳ Now    — Step 3 (branch) waiting for opened event…                  │
│                                                                        │
│  [Cancel run] [View outbox emails]                                     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Composants partagés

### `CommandPalette`
Voir [03-frontend/04-cmd-k-palette.md](../03-frontend/04-cmd-k-palette.md).

### `RulesBuilder` (réutilisé audience + automation conditions)
Voir [04-ui-ux/02-mockups/audience-builder.txt](02-mockups/audience-builder.txt).

### `EventCatalogPicker`
Autocomplete avec catégories, basé sur `tracking_event_definitions` +
events emailing hardcodés.

### `Drawer` (édition latérale)
Largeur 480px, slide-from-right, overlay 50% opacity, fermé par Esc /
clic overlay.

### `Toast`
Position bas-droite, durée 5s (8s si action undo), max 3 stacked.

### `EmptyState`
Illustration SVG (vector simple), title (semibold), description, CTA
button.

### `ErrorBoundary`
Wrap toutes les vues admin emails. Display : message + retry + lien
support.

---

## 📐 Tokens design rapides (référence)

Voir [05-design/](../05-design/) pour le détail. Référence courte :

```
Couleurs principales :
  --color-bg          stone-50
  --color-surface     white
  --color-border      stone-200
  --color-text        stone-900
  --color-muted       stone-500
  --color-accent      sage-600 (#7C9A8A approx)
  --color-success     emerald-600
  --color-warning     amber-500
  --color-danger      red-600

Espacements :
  --space-xs    0.25rem
  --space-sm    0.5rem
  --space-md    1rem
  --space-lg    1.5rem
  --space-xl    2rem

Typo :
  --font-sans   system-ui
  --font-mono   ui-monospace
  
  --text-xs     0.75rem
  --text-sm     0.875rem
  --text-base   1rem
  --text-lg     1.125rem
  --text-xl     1.25rem

Border radius :
  --radius-sm   0.25rem
  --radius-md   0.5rem
  --radius-lg   0.75rem

Motion :
  --duration-fast 150ms
  --duration-base 250ms
  --easing      cubic-bezier(0.4, 0, 0.2, 1)
```

---

## ✅ Checklist de validation UI par écran

Avant de valider un écran "terminé" :

- [ ] Mockup respecté (pixel-near)
- [ ] Empty state implémenté
- [ ] Error state implémenté
- [ ] Loading state (skeleton) implémenté
- [ ] Raccourcis clavier fonctionnels (`?` pour cheat sheet visible)
- [ ] A11y : focus visible, ARIA labels, contraste
- [ ] Responsive (>=1024px obligatoire ; mobile = nice to have)
- [ ] Tests RTL + Playwright passent
- [ ] Lighthouse a11y ≥ 95

---

_Spec UI maître. Toute déviation = mise à jour de ce doc._
