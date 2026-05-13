# M5 — Évolution de l'UI emailing : analyse conceptuelle

> Document de conception (phase 1 / 2). Pas de code, pas d'API détaillée.
> L'objectif est de poser les **problèmes**, comparer plusieurs **approches**,
> arrêter une **proposition finale** par aspect. Le dossier technique
> détaillé (data, backend, frontend, tests, runbook) viendra en phase 2,
> après validation.

---

## Table des matières

- [0. Synthèse exécutive](#0-synthèse-exécutive)
- [1. Méthodologie & cadre d'analyse](#1-méthodologie--cadre-danalyse)
- [2. État actuel — l'audit](#2-état-actuel--laudit)
- [3. Section A — Inbox transactionnelle](#3-section-a--inbox-transactionnelle)
  - [3.1 Diagnostic](#31-diagnostic)
  - [3.2 Approches comparées](#32-approches-comparées)
  - [3.3 Proposition finale](#33-proposition-finale)
- [4. Section B — Campaigns & audience builder](#4-section-b--campaigns--audience-builder)
  - [4.1 Diagnostic](#41-diagnostic)
  - [4.2 Approches comparées](#42-approches-comparées)
  - [4.3 Proposition finale](#43-proposition-finale)
- [5. Section C — Automation studio](#5-section-c--automation-studio)
  - [5.1 Diagnostic](#51-diagnostic)
  - [5.2 Approches comparées](#52-approches-comparées)
  - [5.3 Proposition finale](#53-proposition-finale)
- [6. Aspects transverses](#6-aspects-transverses)
  - [6.1 Modèle d'événements unifié](#61-modèle-dévénements-unifié)
  - [6.2 Performance, temps réel, fraîcheur](#62-performance-temps-réel-fraîcheur)
  - [6.3 Ergonomie & accessibilité](#63-ergonomie--accessibilité)
  - [6.4 i18n & contenu rédactionnel](#64-i18n--contenu-rédactionnel)
  - [6.5 Sécurité, RGPD, audit](#65-sécurité-rgpd-audit)
- [7. Synthèse & roadmap conceptuelle](#7-synthèse--roadmap-conceptuelle)
- [8. Annexes](#8-annexes)

---

## 0. Synthèse exécutive

L'admin emailing actuelle est livrée comme un **MVP fonctionnel mais
incomplet**. Les trois écrans (transactional / campaigns / automation)
remplissent le scénario heureux mais laissent l'admin :

- **Aveugle sur la transactionnelle** dès que le volume monte : ni
  recherche, ni filtre fin, ni vue agrégée — juste une liste linéaire de
  200 lignes max.
- **Dépendant de Listmonk** pour les audiences : on ne peut pas
  segmenter les clients FemiGlow par comportement (acheteurs, paniers
  abandonnés, inactifs 30j…) — il faut passer par l'iframe Listmonk, ce
  qui casse le flux et n'a pas accès aux events FemiGlow.
- **Spectateur des automations** : les workflows sont seed-only via SQL,
  l'UI ne sert qu'à toggler `active=true/false`.

L'objectif de la M5 est de **fermer ces trois trous** en gardant
l'esprit du produit : **un cockpit admin où on tient les opérations
emailing sans changer d'onglet**.

### Les 3 décisions de fond proposées

| # | Décision | Pourquoi |
|---|---|---|
| 1 | **Inbox transactionnelle "command-K + saved views"** | Le cas d'usage admin = chercher pourquoi *un email précis n'est pas arrivé*, pas naviguer 50 pages. Une UX type Linear/Vercel logs (recherche full-text + filtres typés + saved views) est strictement plus puissante qu'un tableau paginé pour un coût de dev contenu. |
| 2 | **Audiences natives FemiGlow avec snapshot au moment de l'envoi** | Construire les audiences dans FemiGlow (où vivent les events comportementaux) puis pousser dans Listmonk juste au moment de l'envoi via l'API. On garde Listmonk comme moteur de delivery mais on récupère le contrôle sur la sélection. La snapshot évite les divergences entre "estimation de taille" et "envoi réel". |
| 3 | **Automation studio "visual + YAML round-trip"** | Canvas visuel (drag-drop nodes) pour 80% des cas, mais avec export/import YAML lisible pour les power-users + le versioning git. C'est le sweet spot entre la convivialité (Zapier) et le sérieux (n8n). |

### Cadre d'effort

| Aspect | Effort relatif | Risque |
|---|---|---|
| Inbox transactionnelle | 🟢 Petit (1-2 sem) | Faible — extension de l'existant |
| Campaigns + audience builder | 🔴 Gros (4-6 sem) | Moyen — nouveau modèle de données, sync Listmonk |
| Automation studio | 🟠 Moyen-gros (3-5 sem) | Moyen-élevé — éditeur visuel + nouveaux types de steps |
| Aspects transverses (events unifiés, ergonomie) | 🟠 Moyen (2-3 sem) | Faible — refactor data layer |

> **Note d'humilité.** Ces estimations supposent qu'on accepte les
> simplifications proposées (pas de A/B testing en V1, pas de "send-time
> optimization" par utilisateur, etc.). Si le scope grossit, multiplier
> par 1,5 à 2.

---

## 1. Méthodologie & cadre d'analyse

### 1.1 Grille d'évaluation

Chaque approche est notée sur **5 axes** (1 = faible, 5 = excellent) :

| Axe | Question |
|---|---|
| **Puissance admin** | L'admin peut-il accomplir *finement* ce qu'il veut ? |
| **Courbe d'apprentissage** | Combien de minutes avant d'être autonome ? |
| **Coût de dev V1** | Effort relatif pour livrer une première version utilisable |
| **Coût de maintenance** | Qu'est-ce qui casse quand le schéma DB ou Listmonk change ? |
| **Évolutivité** | À 10× le volume / 5× les use-cases, ça tient ? |

### 1.2 Périmètre

Le périmètre est **les écrans admin** + ce qui est strictement
nécessaire côté backend pour les alimenter. Hors périmètre :

- Refonte de la pile de delivery (Stalwart + Listmonk restent)
- Migration vers un autre ESP
- Refonte du data model client (orders/leads/sessions) au-delà des vues
  d'agrégation nécessaires

### 1.3 Public cible

Un admin **non-développeur** (toi). Pas de SQL à écrire. Pas de YAML à
éditer à la main pour le scénario heureux. Tout ce qui est éditable doit
l'être par formulaire ou canvas visuel — mais **un export texte
inspectable** doit toujours exister pour debug & git.

---

## 2. État actuel — l'audit

### 2.1 Section A — Transactional

**Vue liste** (`/admin/emails/transactional`) :

```
┌────────────────────────────────────────────────────────────────┐
│ Statut: [Tous ▼]                                               │
├────────────┬─────────────────┬───────────────┬─────────┬───────┤
│ Date       │ Template        │ Destinataire  │ Statut  │ Att.  │
├────────────┼─────────────────┼───────────────┼─────────┼───────┤
│ 22:14:03   │ contact-ack     │ a@b.c         │ sent    │ 1/3   │
│ 22:13:55   │ cart-aband…     │ user@x.y      │ failed  │ 3/3   │
│ ...        │                 │               │         │       │
└────────────┴─────────────────┴───────────────┴─────────┴───────┘
```

**Ce qui manque** :
- Pas de recherche par email
- Pas de filtre par template / date / source
- Pas d'export CSV
- Pas d'actions de masse (retry 50 mails d'un coup)
- Pas de vue agrégée ("combien d'echecs aujourd'hui ?")
- Pas de notification temps-réel sur les nouveaux échecs

**Vue détail** (`/admin/emails/transactional/[id]`) — déjà solide :
métadonnées complètes, retry, HTML preview, timeline d'events, raw
payload. Peu de gaps ici.

### 2.2 Section B — Campaigns

**Wizard 6 étapes** : nom → audience → template → sujet → planning →
recap. L'étape "audience" est le talon d'Achille : elle propose les
**listes Listmonk** uniquement. Or, les listes Listmonk sont alimentées
par double opt-in newsletter — elles n'ont aucun lien avec les
acheteurs FemiGlow, les paniers abandonnés, les inactifs.

**Conséquence concrète** : pour envoyer "promo VIP" aux 50 clients qui
ont commandé 3+ fois, il faut :

1. Aller dans Listmonk
2. Créer un segment SQL (compétence DBA)
3. Croiser à la main avec les emails de la table `orders`
4. Importer la liste statique
5. Revenir dans FemiGlow pour créer la campagne

Aucun de ces clics n'apparaît dans le wizard. C'est le point #2
prioritaire.

### 2.3 Section C — Automation

**État** : 100% read-only. La liste affiche 1 seed (`cart-abandoned-1h`)
et permet de toggler `active`. Les runs s'affichent en lecture seule.

**Le data model** est déjà presque assez riche (`steps` jsonb avec
discriminated union `wait | send`, `triggerType` enum, `triggerConfig`
jsonb). Mais il manque :

- **Types de steps** : pas de `branch` (if/else), pas de `tag`, pas de
  `webhook`, pas de `update_lead`
- **Types de triggers** : seul `event` est utilisé. `schedule` (cron),
  `subscription`, `webhook` sont déclarés mais non implémentés
- **Conditions sur trigger** : pas de "uniquement si le user a fait X
  fois Y dans les Z jours"
- **UI** : pas de création/édition

### 2.4 Couche de données — ce qu'on a et ce qu'on n'a pas

#### Tables disponibles (et utilisables pour segmentation)

| Domaine | Table | Colonnes pertinentes |
|---|---|---|
| Identité | `leads` | email, phone, status, source, consentMarketing, createdAt |
| Commerce | `orders` | leadId, totalCents, currency, paymentMethod, createdAt |
| Engagement email | `email_event` | type (opened/clicked/…), subscriberId, ts, linkUrl |
| Suppression | `email_suppression` | email, reason |
| Subscriber link | `email_subscriber_link` | email, listmonkSubscriberId, status, optinAt |
| Lead history | `lead_events` | type, payload, createdAt |
| Tracking définitions | `tracking_event_definitions` | name, scope, category, funnelStage |
| Tracking agrégé | `insights_event_daily`, `insights_page_daily` | counts par jour |

#### Tables manquantes / lacunes

| Manque | Conséquence pour l'audience builder / automations |
|---|---|
| **Pas de table `sessions`** unifiée par email | Impossible de filtrer "users avec ≥ 3 sessions dans les 7 derniers jours" — il faudrait reconstruire depuis matview |
| **Pas de table `cart_events`** explicite | "Panier abandonné" est inféré côté scanner mais pas requêtable directement |
| **Pas de table `email_engagement_agg`** | À chaque sélection d'audience il faudrait scanner `email_event` (~potentiel gros) — pas viable à plus de quelques centaines de milliers d'events |
| **Pas de "user_traits"** | Pour des segments custom du type "intéressé par produit X" (déduit), aucun endroit où stocker le trait |

> **Décision implicite à prendre.** Soit on accepte le coût d'un scan
> récursif au moment de la sélection d'audience, soit on matérialise.
> La proposition section 4 tranche.

---

## 3. Section A — Inbox transactionnelle

### 3.1 Diagnostic

Le besoin réel admin sur la transactionnelle est en **trois temps** :

1. **Surveillance** — "y a-t-il des soucis en cours ?" (monitoring
   passif, idéalement une vue/widget toujours visible)
2. **Recherche ciblée** — "le client Untel n'a pas reçu son mail de
   confirmation de commande, qu'est-ce qui s'est passé ?" (drill-down
   par email / template / fenêtre temporelle)
3. **Action corrective** — retry, ajout en suppression, copier le HTML
   rendu pour debug (déjà couvert par la page détail)

Le besoin n°1 est **mal couvert** (rien de proactif). Le besoin n°2 est
**très mal couvert** (filtre statut seul, pas de recherche par email).
Le besoin n°3 est **bien couvert**.

### 3.2 Approches comparées

#### Approche A1 — "Tableau étendu" (extension incrémentale)

> Ajouter au tableau actuel : barre de recherche par email, filtres
> dropdown template / source / date range, bouton CSV. Pas de
> refactor.

```
┌──────────────────────────────────────────────────────────────────────┐
│ 🔍 [recherche email/template..]   Statut [Tous▼]  Template [Tous▼]   │
│ Période: [7j ▼]   Source: [Toutes ▼]   [⬇ Export CSV]                │
├────────────┬─────────────┬──────────────┬─────────┬────────┬────────┤
│ Date       │ Template    │ Destinataire │ Statut  │ Att.   │ Source │
└────────────┴─────────────┴──────────────┴─────────┴────────┴────────┘
```

| Axe | Note | Commentaire |
|---|---|---|
| Puissance admin | 3/5 | Couvre 70% des besoins |
| Courbe | 5/5 | Zéro apprentissage |
| Coût V1 | 5/5 | 3-5 jours |
| Maintenance | 5/5 | Mêmes patterns existants |
| Évolutivité | 2/5 | Casse à 100k+ rows / besoin temps réel |

**Forces** : ROI immédiat, zéro risque, on garde la base existante.
**Faiblesses** : Plafonnement de puissance, pas de UX "premium" type
inbox.

---

#### Approche A2 — "Inbox" (UX Gmail-like)

> Réorganiser autour de la notion d'**email envoyé** (≈ thread) avec
> sidebar de filtres prédéfinis (Failed, Bounced today, To VIPs…), liste
> dense de "conversations" groupées par destinataire ou template, panneau
> de détail à droite (preview HTML, timeline) — pas de navigation
> push/page.

```
┌──────────────────┬──────────────────────────────┬──────────────────┐
│  📥 Boîte         │ ▼ Today (43)                 │ ✉ contact-ack     │
│  🔴 Échecs (12)   │ ────────────────────────────  │ To: a@b.c         │
│  ⚠ Bounces (3)    │ ✓ contact-ack  a@b.c   3min  │ Status: delivered │
│  🟡 Soft (5)      │ ✓ order-conf   c@d.e   8min  │ Subject: Merci…   │
│  ─────────        │ ✗ cart-aband   u@x.y   15min │ ───────           │
│  Templates        │ ⚙ welcome      m@n.o   22min │ [HTML preview]    │
│  • contact-ack    │ ─ Yesterday ─               │                   │
│  • order-conf     │ ✓ ...                       │ Timeline:         │
│  • welcome        │                              │  queued 22:14:03  │
│  ─────────        │                              │  sent   22:14:05  │
│  💾 Vues sauvées  │                              │  delivered 22:14:08│
│  • VIP failures   │                              │                   │
└──────────────────┴──────────────────────────────┴──────────────────┘
```

| Axe | Note | Commentaire |
|---|---|---|
| Puissance admin | 4/5 | UX premium, attractif |
| Courbe | 3/5 | Familier mais nouveaux raccourcis à apprendre |
| Coût V1 | 2/5 | Refonte UI complète (~2 sem dev) |
| Maintenance | 3/5 | Plus de composants à maintenir |
| Évolutivité | 4/5 | Pattern éprouvé chez Linear/Front/Mailtrap |

**Forces** : Cohérence visuelle forte, raccourcis clavier naturels,
gestion fluide du volume.
**Faiblesses** : Coût initial, et l'admin manipule rarement des
"threads" (chaque email transactionnel est indépendant), donc le
parallèle avec Gmail est imparfait.

---

#### Approche A3 — "Cockpit ops + recherche commande" (Linear/Vercel logs)

> Header avec KPIs **en temps réel** (queued/sending/failed last 1h,
> taux de bounce J-1, latence p95), barre de **commande globale** (⌘K /
> CtrlK) pour recherche + actions, liste tabulaire dense en bas avec
> filtres typés inline (style Linear : `status:failed template:cart-*
> after:yesterday`), saved views.

```
┌──────────────────────────────────────────────────────────────────────┐
│ 📨 1,243 sent · ⚠ 12 failed · 🔴 3 hard bounces · p95 9.2s · J-1 +5%│
├──────────────────────────────────────────────────────────────────────┤
│ ⌘K   status:failed template:cart* after:yesterday               42  │
├──────────────────────────────────────────────────────────────────────┤
│ 💾 Saved views: [All] [Failed today] [Bounces 7d] [Awaiting retry]   │
├────────────┬──────────────┬─────────────┬──────────┬────────────────┤
│ Date       │ Recipient    │ Template    │ Status   │ Last error     │
├────────────┼──────────────┼─────────────┼──────────┼────────────────┤
│ 22:13      │ user@bad.tld │ welcome     │ ✗ failed │ 550 mailbox… │
│ 21:50      │ a@b.c        │ cart-aband  │ ⚠ soft   │ 421 try again  │
└────────────┴──────────────┴─────────────┴──────────┴────────────────┘
[Bulk: 12 selected] [Retry all] [Mark as suppressed] [Export]
```

| Axe | Note | Commentaire |
|---|---|---|
| Puissance admin | 5/5 | Tous besoins couverts, plus le 1) monitoring |
| Courbe | 4/5 | Syntaxe `key:value` rapide à apprendre |
| Coût V1 | 3/5 | Cmd-K + parser de filtres + KPI header ~ 1.5 sem |
| Maintenance | 4/5 | Parser à tester, mais isolé |
| Évolutivité | 5/5 | Pattern parfait pour high-volume |

**Forces** : Puissance maximale, "power user friendly", scaling.
**Faiblesses** : Plus de chrome UI à designer.

---

#### Approche A4 — "Live tail + dashboard widgets"

> Vue principale = un graphe temps-réel (live tail style `tail -f`) avec
> métriques dashboard au-dessus. Pas de pagination, on filtre en
> "streaming". Inspiration : Vercel Realtime Logs, datadog.

| Axe | Note | Commentaire |
|---|---|---|
| Puissance admin | 4/5 | Top pour observabilité, médiocre pour recherche historique |
| Courbe | 3/5 | UX inhabituelle |
| Coût V1 | 1/5 | WebSocket/SSE + nouveau backend de streaming |
| Maintenance | 2/5 | Stream sur prod = nouveau backbone |
| Évolutivité | 4/5 | OK à grande échelle |

**Forces** : Sensation temps réel, sentiment de contrôle.
**Faiblesses** : Trop d'overhead pour le besoin réel, casse l'usage
"recherche après coup".

---

### 3.3 Proposition finale

> **Recommandation : Approche A3 (Cockpit ops + recherche commande)**,
> avec une phase incrémentale qui ressemble à A1 (les filtres de base
> sortent en premier).

**Pourquoi A3 plutôt qu'A1/A2/A4** :
- A1 plafonne vite et ne couvre pas la surveillance proactive.
- A2 est sympa mais l'analogie inbox n'apporte pas grand chose pour
  des messages transactionnels (pas de thread, pas de "lecture").
- A4 est trop d'infrastructure pour le bénéfice ; la sensation "temps
  réel" sera atteinte par un auto-refresh toutes les 5s, suffisant.

**UX clé** :
- **Cmd-K** ouvre une palette qui sait :
  - filtrer (`status:failed`, `to:user@x.y`, `template:cart*`)
  - sauvegarder la vue courante
  - exécuter des actions sur la sélection (retry, suppress, export)
- **Saved views** : `Failed today`, `Bounces 7d`, `Awaiting retry`,
  custom user-defined.
- **KPI header** : 4 chiffres clés au-dessus, refresh 5s. Alerte
  visuelle (badge rouge) si `failed > threshold`.
- **Bulk actions** : sélection multi-ligne (shift-click + checkbox),
  bouton "Retry 12 selected", "Add to suppression", "Export selected".

**Wizard / mockup UX détaillée** :

```
Étape 1 — Vue par défaut (chargement de la page)
─────────────────────────────────────────────────
L'admin arrive sur /admin/emails/transactional. Affichage :
   KPI header (last 1h)
   Saved view "Today" activée par défaut
   Tableau dense, 50 lignes, sticky header

Étape 2 — Recherche ciblée (cas : "où est le mail à user@x.y ?")
─────────────────────────────────────────────────
   Cmd-K
   l'admin tape "user@x.y"
   filtre auto-suggéré : `to:user@x.y`
   Enter
   le tableau filtre instantanément, 3 résultats
   clic sur la ligne pertinente → page détail

Étape 3 — Action de masse (cas : "retry tous les soft bounces 4xx")
─────────────────────────────────────────────────
   Cmd-K
   l'admin tape `status:bounced_soft`
   Enter
   filtre appliqué, ligne header affiche "47 résultats"
   bouton "Sélectionner tout (47)"
   bouton "Retry sélectionnés"
   modale de confirmation (au cas où)
   action exécutée, toast "47 retry queued"

Étape 4 — Sauver une vue récurrente
─────────────────────────────────────────────────
   filtre courant : status:failed template:cart-*
   Cmd-K → "Save view..."
   nom : "Cart failures"
   ajouté à la sidebar, accessible en 1 clic
```

**Implications backend** (pas de tech détaillée ici, juste signal) :
- Endpoint de recherche avec parser de query string typé
  (`status:failed`, `to:*@bad.tld`, `template:welcome` etc.)
- Endpoint `bulk_retry(ids[])`
- Endpoint `metrics_summary(window)` pour le KPI header
- Indexes DB sur `(status, createdAt)`, `(toEmail)`, `(template)`

**Implications data** :
- Stocker les "saved views" par admin → nouvelle table
  `admin_email_view`
- Pas de nouveau modèle d'événement

**Implications frontend** :
- Composant `CommandPalette` réutilisable (utile aussi pour les autres
  sections)
- Composant `KpiHeader` réutilisable
- Composant `BulkActionsBar`
- État global de la "vue courante" (URL-synced pour partage de lien)

---

## 4. Section B — Campaigns & audience builder

### 4.1 Diagnostic

C'est **la plus grosse pièce manquante**. Le wizard actuel suppose que
l'audience existe déjà côté Listmonk — or, le seul mécanisme
d'alimentation de Listmonk depuis FemiGlow est le **double opt-in
newsletter**. Donc Listmonk ne connaît que les "subscribers
newsletter".

L'admin a besoin de cibler :

| Cible | Source données | Tables clés |
|---|---|---|
| Clients (1+ commande) | `orders` joint `leads` | orders, leads |
| Clients VIP (3+ commandes) | `orders` | orders + agrégation |
| Paniers abandonnés J-1 | events `cart.abandoned` | event log (à concevoir) |
| Inactifs 30j | `last_seen_at` | sessions (manquantes), email_event |
| Engagés (ouverture last 7j) | `email_event` type=opened | email_event |
| Newsletter only | `email_subscriber_link` | email_subscriber_link |
| Combos (VIP ET engagé) | jointures | toutes |

Aucune de ces cibles n'est constructible aujourd'hui dans
FemiGlow → l'utilisateur doit faire ça en SQL.

### 4.2 Approches comparées

#### Approche B1 — "Push to Listmonk lists" (sync unidirectionnel)

> FemiGlow définit l'audience via UI → on crée une **liste Listmonk**
> et on y pousse les emails matchant. La campagne dans le wizard cible
> ensuite cette liste. Refresh manuel ou planifié.

```
┌───────────┐  build segment   ┌──────────────┐   push 1× ou cron
│ FemiGlow  │ ─── filters ──→  │ Audience def │ ──────────────────→ ┌──────────┐
│ DB        │                  │ (saved)      │                     │ Listmonk │
└───────────┘                  └──────────────┘                     │ list     │
                                                                    └──────────┘
                                                                          │
                                                                  used by campaign
```

**Forces** :
- Architecture simple, Listmonk reste source de delivery
- Réutilise l'infra existante
- L'admin peut aussi consulter la liste côté Listmonk

**Faiblesses** :
- **Divergence garantie** entre snapshot DB et liste Listmonk (si on
  ajoute une commande à 14h32 et que l'envoi est à 14h33, ce nouveau
  client n'y est pas)
- Doublonne le stockage des emails (FemiGlow + Listmonk)
- Si on supprime un user RGPD côté FemiGlow, il faut aussi le retirer
  côté Listmonk — synchro fragile

| Axe | Note |
|---|---|
| Puissance | 3/5 |
| Courbe | 4/5 |
| Coût V1 | 4/5 |
| Maintenance | 2/5 (drift) |
| Évolutivité | 3/5 |

---

#### Approche B2 — "Audiences natives FemiGlow, snapshot à l'envoi"

> Les audiences sont définies et stockées dans FemiGlow uniquement
> (table `email_audience` avec règles JSON). Au moment de l'envoi
> d'une campagne, FemiGlow **matérialise la liste** (snapshot
> versionné), la pousse en bloc dans Listmonk comme liste éphémère,
> déclenche la campagne, puis supprime la liste Listmonk après J+30.

```
┌───────────┐  define segment   ┌──────────────┐
│ FemiGlow  │ ←──── UI ────→    │ email_audience│
│ DB        │                   │ (rules JSON)  │
└─────┬─────┘                   └───────────────┘
      │
      │ snapshot at send time
      ▼
┌──────────────┐  push  ┌──────────────┐  send  ┌──────────┐
│ snapshot     │ ─────→ │ Listmonk     │ ─────→ │ Recipient│
│ list (10k)   │        │ list (eph.)  │        │          │
└──────────────┘        └──────────────┘        └──────────┘
                                 │
                                 ▼ after 30d
                              cleanup
```

**Forces** :
- **Une seule source de vérité** : FemiGlow DB
- L'audience est figée au moment de l'envoi → reproductible, auditable
- Le wizard devient cohérent : "définir audience → lancer envoi"
- RGPD : suppression user FemiGlow = audiences futures excluent
- Snapshot offre un "qui a reçu quoi" historique

**Faiblesses** :
- Effort dev moyen (snapshot machinery, sync Listmonk éphémère)
- Listmonk liste devient un détail d'implémentation cachée à l'admin
  → ça enlève l'option "consulter cette liste dans Listmonk"
- Si Listmonk meurt en pleine snapshot push, retry / idempotency à
  gérer

| Axe | Note |
|---|---|
| Puissance | 5/5 |
| Courbe | 4/5 |
| Coût V1 | 3/5 |
| Maintenance | 4/5 |
| Évolutivité | 5/5 |

---

#### Approche B3 — "Bypass Listmonk pour les sends in-DB"

> Pour les audiences natives, on **n'utilise plus du tout Listmonk** :
> on enqueue directement dans `email_outbox` en bulk, et la batterie
> SMTP existante fait le delivery. Listmonk ne sert plus que pour les
> campagnes "broadcast" (newsletter génériques).

**Forces** :
- Indépendance vis-à-vis de Listmonk
- Cohérence complète avec le pipeline transactionnel (mêmes events,
  mêmes retries, mêmes suppression checks)
- Pas de sync Listmonk à gérer

**Faiblesses** :
- On perd les **stats campagnes natives Listmonk** (clicks/opens
  agrégés par campagne, A/B, etc.)
- On perd l'éditeur visuel de templates Listmonk
- On doit construire un dashboard de stats campagne nous-même
- Pour 50k+ destinataires d'un coup, la file `email_outbox` n'est pas
  dimensionnée

| Axe | Note |
|---|---|
| Puissance | 3/5 |
| Courbe | 4/5 |
| Coût V1 | 2/5 |
| Maintenance | 4/5 |
| Évolutivité | 3/5 (file outbox saturable) |

---

#### Approche B4 — "Hybride par taille d'audience"

> Si audience < 500 : bypass Listmonk (B3).
> Si audience ≥ 500 : snapshot + push Listmonk (B2).
> L'admin ne voit pas la différence — sélection auto.

**Forces** : combine le meilleur des deux selon échelle.
**Faiblesses** : complexité accrue (deux chemins à maintenir + à
tester), divergence possible des stats.

| Axe | Note |
|---|---|
| Puissance | 4/5 |
| Courbe | 4/5 |
| Coût V1 | 2/5 |
| Maintenance | 2/5 |
| Évolutivité | 5/5 |

---

### 4.3 Proposition finale

> **Recommandation : Approche B2 (audiences natives FemiGlow + snapshot
> au moment de l'envoi)**

**Pourquoi B2** :
- Résout le besoin d'origine (cibler par comportement) sans casser
  l'archi delivery
- Reste 1 source de vérité (la DB FemiGlow)
- Reproductibilité audit : "qui a reçu la campagne X le 13 mai ?" →
  réponse exacte via snapshot
- L'effort B2 est notablement plus prévisible que B3 ou B4

**Composant clé : l'audience builder**

```
┌─────────────────────────────────────────────────────────────────────┐
│ 📋 Définir une audience                          [ 💾 Sauvegarder ] │
├─────────────────────────────────────────────────────────────────────┤
│ Nom: [VIP engagés]                                                  │
│                                                                     │
│ ╭─ Inclure ────────────────────────────────────────────────────────╮│
│ │ Tous les contacts qui satisfont :                                ││
│ │                                                                  ││
│ │  [✓] A passé [ ≥ 3   ] commandes [ depuis ✓ janvier 2025 ▾ ]      ││
│ │  [✓] Total dépensé [ ≥ ▾ ] [ 1000 ] MAD                          ││
│ │  [ ] A ouvert un email [ depuis ≤ ▾ ] [ 30 ] jours              ││
│ │  [ ] Est inscrit à la newsletter (consent valide)                ││
│ │  [+ Ajouter un critère]                                          ││
│ │                                                                  ││
│ │  Combinaison : [ AND ▾ ] [ OR ▾ ]                                ││
│ ╰──────────────────────────────────────────────────────────────────╯│
│                                                                     │
│ ╭─ Exclure (suppression list automatique) ────────────────────────╮ │
│ │  ✓ Hard bounces   ✓ Unsubscribes   ✓ Manual suppressions       │ │
│ │  [ ] Aussi : opt-out marketing global (consentMarketing=false)  │ │
│ ╰─────────────────────────────────────────────────────────────────╯ │
│                                                                     │
│ ╭─ Aperçu ────────────────────────────────────────────────────────╮ │
│ │  🎯 1 247 contacts matchent                       [ ⟳ Refresh ] │ │
│ │  ▼ Voir un échantillon de 10                                    │ │
│ │     fatima@example.com  (4 commandes, 2 340 MAD, opened 12d ago)│ │
│ │     hicham@example.com  (3 commandes, 1 120 MAD, …)             │ │
│ │     …                                                           │ │
│ ╰─────────────────────────────────────────────────────────────────╯ │
└─────────────────────────────────────────────────────────────────────┘
```

**Wizard intégré au flow campagne** :

```
Étape 1 — Nom de campagne
Étape 2 — Audience           ←─── changement majeur ici
   Choix : [ Sélectionner une audience sauvée ▾ ]
           OU
           [ Construire une nouvelle audience → ouvre le builder ci-dessus ]
   Aperçu : 1 247 contacts. [⟳ Snapshot maintenant pour figer]

Étape 3 — Template
Étape 4 — Sujet
Étape 5 — Planning
Étape 6 — Recap
   Audience: VIP engagés (1 247 contacts, snapshot du 13/05 22:30)
   → Au moment de l'envoi : sera re-snapshot OU envoyé tel quel
```

**Catalogue de critères proposés en V1**

| Catégorie | Critère | Source |
|---|---|---|
| Identité | Email contient / commence / finit par | `leads.email` |
| Identité | Pays / langue | `leads.country` |
| Identité | Date d'inscription | `leads.createdAt` |
| Identité | Consent marketing | `leads.consentMarketing` |
| Commerce | Nb commandes total | agrégation `orders` |
| Commerce | Total dépensé | agrégation `orders` |
| Commerce | A commandé produit X | `orders` + joint produit |
| Commerce | Date dernière commande | `orders` (max) |
| Engagement | A ouvert email (template / global) | `email_event` |
| Engagement | A cliqué un lien | `email_event` |
| Suppression | A unsubscribed | `email_suppression` |
| Suppression | Bounced (any / hard / soft) | `email_suppression` |
| Custom | Tag manuel | nouvelle table `lead_tag` |

> En V2 on ajoutera : sessions, pages vues, panier abandonné, temps
> passé. Ça nécessite d'abord la table d'événements unifiée (cf §6.1).

**Implications backend** :
- Nouvelle table `email_audience` (id, name, rules jsonb, createdAt,
  ownerEmail)
- Nouvelle table `email_audience_snapshot` (audienceId, snapshotAt,
  emailsBytea ou jsonb array, campaignId nullable)
- Moteur de compilation `rules → SQL/Drizzle query` (parseur typé,
  testable)
- API `previewAudienceSize(rules)` (count rapide, max 5s)
- API `previewAudienceSample(rules, limit=10)`
- API `snapshotAudience(audienceId)` → matérialise
- API `pushSnapshotToListmonk(snapshotId)` → liste éphémère
- Cron de cleanup des listes Listmonk éphémères > 30j

**Implications data** :
- Index `(leadId, createdAt)` sur `orders`
- Vue / matview `lead_orders_agg` (count, total) pour preview rapide
- Index sur `email_event(subscriberId, ts, type)` (peut-être déjà
  présent ; vérifier)

**Implications frontend** :
- Composant `AudienceRulesBuilder` (form dynamique)
- Composant `AudiencePreview` (count + sample)
- Composant `AudienceSelector` (sélecteur dans le wizard)
- Page `/admin/emails/audiences` (list + create)
- Page `/admin/emails/audiences/[id]` (edit + snapshots history)

---

## 5. Section C — Automation studio

### 5.1 Diagnostic

Le besoin est très clair côté utilisateur : pouvoir **configurer
finement** des workflows automatisés basés sur les **événements**.
Concrètement :

- *"Quand un user a ajouté au panier 3 fois sans acheter en 7 jours,
  envoie-lui un mail avec 10% de réduction"*
- *"Quand un user ouvre l'email de welcome mais ne clique pas, attend
  48h puis envoie une relance"*
- *"Tous les premiers du mois, à tous les clients VIP, envoie un
  digest"*

Aujourd'hui : seul `cart-abandoned-1h` existe en seed SQL. Pas
d'éditeur, pas de UI de création, pas de conditions.

Le data model est déjà sain (steps jsonb avec types discriminés). Le
gap est :
1. **Vocabulaire de steps trop restreint** (wait + send seulement)
2. **Vocabulaire de triggers trop restreint** (event simple sans
   conditions)
3. **Aucune UI** de création/édition
4. **Pas de catalogue d'événements** accessible à l'admin (il devrait
   pouvoir piocher dans une liste connue)

### 5.2 Approches comparées

#### Approche C1 — "Liste de steps typés" (extension incrémentale)

> Garder le data model en jsonb mais étendre les types de steps (wait,
> send, branch, tag, webhook, update_lead). L'UI est une **liste
> verticale d'étapes** avec un formulaire par type.

```
Trigger: [event: cart.abandoned] [si: count(cart.added,7d) >= 3]
   ↓
1. ⏳ Wait 24h
   ↓
2. ✉ Send template: cart-abandoned-discount
   ↓
3. ❓ Branch : if opened
       ├─ Yes → 4a. Wait 48h → 5a. Send : welcome-back
       └─ No  → 4b. Tag "cart_lost"
   ↓
4. End
```

Édition : on clique sur un step pour ouvrir le formulaire correspondant
(modale ou drawer).

| Axe | Note |
|---|---|
| Puissance | 4/5 |
| Courbe | 5/5 |
| Coût V1 | 4/5 |
| Maintenance | 4/5 |
| Évolutivité | 3/5 (linéaire ; les branches imbriquées deviennent dures à lire) |

---

#### Approche C2 — "Visual flow builder" (n8n/Zapier)

> Canvas drag-drop. Chaque step est une node. Connexions à la souris.
> Branches visibles comme des arborescences. Panneau de propriétés à
> droite quand on clique sur une node.

```
   ┌─────────────────┐
   │ ⚡ cart.abandoned │  (trigger)
   └────────┬────────┘
            │
            ▼
   ┌─────────────────┐
   │ ⏳ Wait 24h     │
   └────────┬────────┘
            │
            ▼
   ┌─────────────────┐
   │ ✉ cart-disc.    │
   └────────┬────────┘
            │
            ▼
   ┌─────────────────┐         ┌─────────────────┐
   │ ❓ opened ?     │ ─ yes ─→│ ⏳ Wait 48h     │
   └────────┬────────┘         └────────┬────────┘
        no  │                           │
            ▼                           ▼
   ┌─────────────────┐         ┌─────────────────┐
   │ 🏷 tag "lost"  │         │ ✉ welcome-back  │
   └─────────────────┘         └─────────────────┘
```

| Axe | Note |
|---|---|
| Puissance | 5/5 |
| Courbe | 4/5 (intuitif) |
| Coût V1 | 1/5 (canvas + zoom + connecteurs + persist position…) |
| Maintenance | 2/5 (lib canvas à maintenir) |
| Évolutivité | 5/5 |

---

#### Approche C3 — "Éditeur DSL textuel" (YAML/JSON sérialisé)

> L'admin édite un YAML qu'on parse + valide. Pas d'UI graphique.
>
> ```yaml
> trigger:
>   event: cart.abandoned
>   condition: count(cart.added, 7d) >= 3
> steps:
>   - wait: 24h
>   - send: cart-abandoned-discount
>   - branch:
>       if: opened
>       then:
>         - wait: 48h
>         - send: welcome-back
>       else:
>         - tag: cart_lost
> ```

| Axe | Note |
|---|---|
| Puissance | 5/5 |
| Courbe | 1/5 (admin non-dev = inutilisable) |
| Coût V1 | 5/5 (juste un parseur) |
| Maintenance | 5/5 |
| Évolutivité | 5/5 |

**Forces** : ultime puissance, versionnable git, copy-paste entre
environnements.
**Faiblesses** : exclut l'utilisateur non-dev.

---

#### Approche C4 — "Hybride visuel + YAML round-trip"

> Canvas visuel (comme C2) pour 90% des cas, mais **export YAML
> en 1-click** et **import YAML** possible. Les deux représentations
> sont équivalentes (la source de vérité est le YAML, le canvas est
> un rendu).

| Axe | Note |
|---|---|
| Puissance | 5/5 |
| Courbe | 4/5 (canvas pour débuter, YAML pour power) |
| Coût V1 | 2/5 (toutes les complexités de C2 + parsing YAML) |
| Maintenance | 3/5 |
| Évolutivité | 5/5 |

---

### 5.3 Proposition finale

> **Recommandation : Approche C1 (liste de steps typés) en V1**, avec
> **migration vers C4 (visuel + YAML) en V2** quand le besoin est
> validé.

**Pourquoi C1 d'abord** :
- L'inconnue principale est *quels types de steps sont utiles en
  pratique* — il faut itérer rapidement, et C1 permet d'ajouter un
  nouveau type de step en 1-2 jours
- Le canvas C2/C4 a un coût d'entrée énorme et risque d'être
  sur-engineering si le besoin réel est 5 automatisations
- Le data model jsonb est déjà adapté à C1 ; passer à C4 plus tard ne
  nécessite pas de migration de données (juste un nouveau renderer
  visuel par-dessus)

**Wizard de création d'une automation** :

```
Étape 1 — Métadonnées
  Nom : [Relance panier abandonné]
  Slug : [cart-abandoned-relance]  (auto-suggéré)
  Description : (optionnelle) [...]

Étape 2 — Trigger
  Type : ( ) Schedule   (•) Event   ( ) Subscription
  
  [Event ▾]
   • Sélection événement : [ cart.abandoned ▾ ]
     (liste pioche dans tracking_event_definitions)
   
  Conditions sur le trigger (optionnel) :
   [ ] Limiter à : intervalle min depuis dernier trigger [24h ▾]
   [✓] User doit satisfaire un segment :
       [ Audience: VIP ▾ ]  (lien vers audience builder !)

Étape 3 — Étapes (séquence)
  1. ⏳ Wait              [ 1h ▾ ]                                  [✕]
  2. ✉ Send template     [ cart-abandoned ▾ ]
       Variables : firstName, cartItemsLabel, resumeUrl              [✕]
  3. ❓ Branch — Did user open step 2 email?
       Yes:
         3a. ⏳ Wait [ 48h ]
         3b. ✉ Send template [ welcome-back ▾ ]
       No:
         3a. 🏷 Tag [ cart_lost ]
                                                                     [✕]
  [ + Ajouter une étape ▾ ]    [ + Wait ] [ + Send ] [ + Branch ]
                                [ + Tag ] [ + Update lead ] [ + Webhook ]

Étape 4 — Frequency / safety
  [✓] Ne pas envoyer si l'user a déjà reçu cette automation < 7 jours
  [✓] Respecter les quiet hours (8h-22h timezone Maroc)
  [ ] Limite globale d'envois / jour : [____]

Étape 5 — Activation
  ( ) Désactivée (brouillon)
  (•) Activée immédiatement
  ( ) Activée à partir de [ 14/05/2026 09:00 ]
```

**Catalogue d'événements proposé** :

L'admin doit pouvoir **piocher dans une liste connue d'événements** —
qu'on alimente depuis `tracking_event_definitions` + on ajoute les
événements emailing.

| Catégorie | Événements |
|---|---|
| Lifecycle | `lead.created`, `lead.confirmed`, `lead.churned` |
| Commerce | `cart.added`, `cart.abandoned`, `order.placed`, `order.delivered`, `order.cancelled` |
| Email | `email.sent`, `email.opened`, `email.clicked`, `email.bounced` |
| Engagement web | `page.viewed` (avec filtre URL), `session.started`, `session.idle_30min` |
| Forms | `contact.submitted`, `newsletter.subscribed`, `quiz.completed` |
| Custom | (extensible via `tracking_event_definitions`) |

**Types de steps proposés** :

| Step | Paramètres | Cas d'usage |
|---|---|---|
| `wait` | duration (1h, 24h, …) ou until (cron expr) | Attendre N temps |
| `send` | template, vars | Envoyer un mail |
| `branch` | condition (event filter, audience match, var compare) | If/else |
| `tag` | tag name, add/remove | Ajouter étiquette au lead |
| `update_lead` | field, value | Modifier un attribut lead |
| `webhook` | URL, body | Notifier un système externe |
| `wait_for_event` | event name, timeout | Attendre jusqu'à event ou timeout |

**Types de conditions disponibles dans `branch`** :

| Condition | Exemple |
|---|---|
| Email event | `did open last sent email` |
| Audience match | `is in audience VIP` |
| Field compare | `lead.total_spent > 1000` |
| Event count | `count(cart.added, last 7d) >= 3` |
| Time since event | `days_since(order.placed) > 90` |

**Implications backend** :
- Extension de `steps` jsonb : ajout des nouveaux discriminants
- Extension du runner pour gérer `branch`, `tag`, `update_lead`,
  `webhook`, `wait_for_event`
- Évaluateur de conditions (un mini-DSL booléen sérialisé en jsonb)
- API `previewAutomationFlow(definition)` (validation + estimation
  d'impact)
- API `cloneAutomation(id)` (utile pour faire des variations)
- Lien avec audiences : un step `branch` peut tester appartenance à une
  audience → réutilise le compileur de §4.3

**Implications data** :
- Nouvelle table `lead_tag` (leadId, tag, createdAt) pour les steps
  `tag`
- Audit log par run : `email_automation_run_step` (runId, stepIndex,
  status, output, ts) — pour debug "pourquoi cet user a eu telle
  branche"

**Implications frontend** :
- Composant `AutomationStepEditor` (factory de form selon kind)
- Composant `EventCatalogPicker` (autocomplete sur événements)
- Composant `ConditionBuilder` (réutilisable dans audiences ET steps)
- Page `/admin/emails/automation/new` (wizard)
- Page `/admin/emails/automation/[id]/edit` (édition)
- Vue détaillée d'une run : `/admin/emails/automation/run/[id]` avec
  timeline step-par-step

---

## 6. Aspects transverses

### 6.1 Modèle d'événements unifié

L'audience builder (§4) et l'automation studio (§5) ont tous deux
besoin d'**interroger les événements utilisateur**. Aujourd'hui les
events sont éparpillés :

| Lieu | Type d'event |
|---|---|
| `email_event` | events emailing (sent, opened, clicked, bounced) |
| `lead_events` | actions admin sur un lead |
| `insights_event_daily` (matview) | tracking web agrégé |
| `tracking_event_definitions` | catalogue mais pas les events bruts |
| (manquant) | sessions, pages vues, cart events |

**Décision proposée** : créer une **table unifiée `user_event`** (ou
réutiliser l'existante si elle convient) avec schéma :

| Colonne | Type | Note |
|---|---|---|
| id | uuid | PK |
| email | text | clé de jointure principale |
| event_name | text | référence `tracking_event_definitions.name` |
| ts | timestamptz | quand |
| properties | jsonb | payload event (URL, productId, cartValue, …) |
| session_id | text nullable | lien session |
| source | enum | web / server / email / admin |

Et alimenter cette table depuis :
- les bridges tracking GTM existants
- les webhooks SMTP (events emailing)
- les actions admin (lead_events)
- les actions order/cart côté serveur

C'est la **fondation** pour que les segments audience et conditions
automation soient riches. Sans ça, la V1 sera limitée aux jointures
sur orders/leads/email_event.

> **Choix séquentiel** : on peut sortir audience V1 et automation V1
> sans cette table (juste sur orders + leads + email_event). Mais V2
> exige cette table. La décision : faire la table maintenant, ou
> faire V1 partielle puis migrer.
>
> **Recommandation** : faire la table maintenant en parallèle de
> l'audience builder (M5.1) — alimenter au fur et à mesure des
> sources, et les segments avancés se débloquent au fur et à mesure.

### 6.2 Performance, temps réel, fraîcheur

| Vue / action | Latence attendue | Implication |
|---|---|---|
| Liste transactionnelle (50 rows) | < 500ms | Index sur (status, createdAt) |
| KPI header (counts last 1h) | < 200ms | Matview rafraîchie 1min |
| Preview audience (count) | < 3s | Query compilée optimisée, max 5s timeout |
| Preview audience (sample 10) | < 1s | LIMIT 10 sur la même query |
| Snapshot audience (10k rows) | < 30s | INSERT … SELECT, async avec status |
| Push Listmonk (10k rows) | < 5min | bulk import API Listmonk, idempotent |
| Création automation | instant | juste un INSERT |
| Run d'automation (1 user) | < 1s | déjà OK |

**Temps réel** : pour la transactionnelle, auto-refresh 5s (polling
suffit, pas besoin de WebSocket en V1). Pour les KPIs, idem.

### 6.3 Ergonomie & accessibilité

Principes UX qui couvrent les 3 sections :

1. **Cmd-K partout** — palette de commandes universelle.
2. **Saved views** — chaque liste a son système de vues nommées.
3. **Empty states pédagogiques** — pas de tableau vide muet, mais
   "Aucune campagne — créez votre première campagne".
4. **Confirmations destructives** — modale avec input "tape DELETE
   pour confirmer" sur suppression définitive (audience, automation).
5. **Undo dans le toast** — toute action réversible (toggler active,
   archiver) a un toast "Annuler" pendant 8s.
6. **Bulk actions** systématiques.
7. **Raccourcis clavier** : `?` pour cheat-sheet, `j/k` navigation,
   `e` édition, `/` recherche.
8. **A11y AA minimum** : contraste, focus visible, ARIA labels sur
   icon-only buttons, keyboard nav complète.

### 6.4 i18n & contenu rédactionnel

Tout est en français côté admin. Pas d'i18n prévu. Les libellés
techniques (event names, slugs) restent en anglais pour cohérence
git/dev.

### 6.5 Sécurité, RGPD, audit

- Toute création/modif d'audience, automation, campagne **audit log**
  (qui, quoi, quand).
- Quand un user demande effacement (CNDP), purger : `leads`, `orders`
  (anonymiser), `user_event`, `email_subscriber_link`,
  `email_audience_snapshot` (retirer email), `email_outbox` (purger
  payloads contenant l'email après J+90).
- Listes éphémères Listmonk supprimées automatiquement à J+30.
- Pas de PII (email) dans les logs applicatifs (déjà policy).
- L'audience preview n'expose l'email complet qu'à un admin
  authentifié (déjà le cas).

---

## 7. Synthèse & roadmap conceptuelle

### 7.1 Récap des choix

| Aspect | Choix | Justification courte |
|---|---|---|
| Transactional | **A3** Cockpit + Cmd-K + saved views | Puissance max, courbe douce |
| Campaigns audience | **B2** Audiences natives + snapshot | 1 source de vérité, RGPD propre |
| Automation | **C1** Step-list typée + V2 visuel | Itérer rapidement avant de canvas-iser |
| Modèle d'events | Table `user_event` unifiée | Fondation pour V2+ |

### 7.2 Roadmap conceptuelle suggérée

**Phase M5.1 — Inbox transactionnelle (1-2 semaines)**
- KPI header
- Recherche Cmd-K
- Saved views
- Bulk retry / export

**Phase M5.2 — Modèle d'events unifié (1-2 semaines, en parallèle de
M5.1)**
- Création `user_event`
- Bridges depuis sources existantes
- Backfill historique optionnel

**Phase M5.3 — Audience builder (2-3 semaines)**
- Schema `email_audience` + snapshots
- Builder UI avec preview live
- Page `/admin/emails/audiences`

**Phase M5.4 — Wizard campagne avec audiences (1 semaine)**
- Intégration de l'audience builder dans le wizard
- Mécanisme snapshot+push Listmonk éphémère
- Cleanup cron

**Phase M5.5 — Automation studio V1 (2-3 semaines)**
- Extension types de steps
- UI création/édition (step-list)
- Catalogue d'événements
- Conditions

**Phase M5.6 — Polish ergonomie globale (1 semaine)**
- Cmd-K universel
- Empty states
- Raccourcis clavier
- A11y audit

**Total estimé** : 8-13 semaines pour la V1 complète.

### 7.3 Risques principaux

| Risque | Mitigation |
|---|---|
| **Sync FemiGlow ↔ Listmonk fragile** | Idempotency keys sur push, cleanup cron, alerting drift |
| **Performance preview audience sur DB lourde** | Query compiler optimisé, index dédiés, cache court (60s) |
| **Complexity automation studio explose** | Tenir la ligne C1 (liste typée) jusqu'à validation |
| **Drift entre catalogue events et events réels** | Validation au moment de l'enregistrement step (event name doit exister) |
| **RGPD : audiences snapshots historiques** | Cron purge J+90, anonymisation à la demande |

---

## 8. Annexes

### 8.1 Lexique

| Terme | Définition |
|---|---|
| **Audience** | Définition de qui doit recevoir (règles + nom). Ré-évaluable. |
| **Snapshot** | Matérialisation figée d'une audience à un instant T. |
| **Liste Listmonk éphémère** | Liste créée temporairement pour un envoi unique, purgée à J+30. |
| **Step typé** | Action discrète d'une automation (wait, send, branch, …). |
| **Trigger** | Événement ou condition qui démarre une automation run. |
| **Run** | Exécution d'une automation pour un user particulier. |
| **Saved view** | Combinaison sauvée de filtres + tri + colonnes. |
| **Cmd-K palette** | Surface de commande universelle (recherche + actions). |

### 8.2 Anti-design : ce qu'on ne fait PAS en V1

- **A/B testing sur campagnes** — pertinent mais V2.
- **Send-time optimization** (envoyer à l'heure où le user ouvre le
  plus) — V2.
- **Multi-canal** (SMS, push) — hors scope.
- **Templates rich-editor WYSIWYG** — Listmonk a déjà le sien, on
  réutilise.
- **Reporting multi-campagne consolidé** — V2.
- **Permissions fine-grain** (role-based access par section) — un seul
  niveau "admin" suffit pour l'instant.
- **Mode dark/light forcé** — suit la préférence système.

### 8.3 Questions ouvertes pour discussion

1. **Bouton "test send"** sur l'audience builder — envoyer juste à
   l'admin pour QA ? Probablement oui mais à confirmer.
2. **Limite max d'audience** — 50k ? 100k ? Au-delà on doit batcher
   l'import Listmonk.
3. **Audiences "dynamiques"** (re-évaluées à chaque envoi automation)
   vs **statiques** (figées) ? Recommandation : les deux, l'admin
   choisit par audience.
4. **Persistence des positions canvas** (si C4 plus tard) — on stocke
   par admin ou globalement ?
5. **Multilingue templates** (mêmes campagne, plusieurs langues) — V2 ?

### 8.4 Maquettes de référence à étudier

- [Linear](https://linear.app/) — pour Cmd-K et saved views
- [Postmark Activity](https://postmarkapp.com/blog/postmark-activity-redesign) — pour la transactional inbox
- [Mailchimp Audience Builder](https://mailchimp.com/help/about-segments/) — pour la grammaire des règles
- [n8n](https://n8n.io/) — pour le visuel C2/C4
- [Customer.io](https://customer.io/) — pour les flows automation

---

## 🔚 Prochaine étape

Si cette analyse te convient, je passe en **phase 2 — dossier technique
complet** : sous-dossier `docs/emailing/admin-evolution-tech/` avec :

- `data/` (PUML schémas, SQL migrations DDL, queries de base)
- `backend/` (specs API par endpoint, types Drizzle, contrats Zod)
- `frontend/` (specs composants React, props, state, routes Next)
- `analytics/` (events à tracker côté admin pour métriques d'usage)
- `ui-ux/` (Figma/maquettes ASCII, guide UX, palette, états)
- `design/` (tokens, typo, spacing, motion)
- `ergonomie/` (raccourcis clavier, a11y checklist, empty states)
- `plan-conception/` (décisions architecturales, ADRs)
- `plan-developpement/` (découpage en tickets, dépendances)
- `plan-action/` (ordre d'exécution semaine par semaine)
- `architecture/` (diagrammes systèmes, séquences, états)
- `runbook/` (incidents probables et résolution, ops)
- `tests/` (specs unit Jest, integration MSW, E2E Playwright, plus le
  test ultime de bout en bout)

Dis "go" et j'attaque.

— Fin du document de conception M5.
