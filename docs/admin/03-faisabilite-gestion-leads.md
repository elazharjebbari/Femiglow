# Étude de faisabilité — Gestion des leads

> **Objet.** Concevoir l'interface et le stockage permettant à un
> administrateur FemiGlow de consulter, filtrer, qualifier et opérer les
> leads (commandes en cours, demandes contact, intérêts B2B). Évaluer trois
> approches couvrant **stockage**, **API**, **UI** et **ergonomie**, les
> comparer, et émettre une recommandation finale. Ce n'est **pas** un plan
> d'action.

---

## 1. Contexte & contraintes

### 1.1 Sources de leads identifiées dans l'audit

| Source | Schéma | Champs clés | Volume estimé / mois |
|---|---|---|---|
| `POST /api/contact` | `contactFormSchema` | `type` (question/order/professional), `firstName`, `email`, `phone`, `message`, `orderNumber?`, `companyName?`, `role?` | 50-200 |
| `POST /api/checkout` | `checkoutFormSchema` | `firstName`, `lastName`, `email`, `phone`, `address.line1`, `quartier`, `city`, `paymentMethod`, `total` | 100-500 |
| `POST /api/newsletter` | inline (email + consent) | `email`, `consent` | 100-1000 |

### 1.2 Format webhook cible (référence)

```json
{
  "id": "cmokk1o9v08cer3tvasgohtw6",
  "ip": "41.251.52.100",
  "ref": "cmokk1o9v08cer3tvasgohtw6",
  "city": "Casablanca",
  "note": "Lancer mon projet E-commerce",
  "email": "",
  "phone": "+212653014133",
  "address": "",
  "country": "Maroc",
  "currency": "MAD",
  "quantity": 1,
  "full_name": "Elhamidi Aziza",
  "product_sku": "ECOM-METHOD",
  "total_price": 3000,
  "product_name": "Formation Ecom Method",
  "source_channel": "site_web",
  "product_variant": "Débutant"
}
```

→ Un schéma interne `lead` doit pouvoir **être projeté vers ce format** sans
ambiguïté. Champs manquants côté checkout actuel : `note`, `ref`, `ip`,
`product_sku`, `product_variant`. À mapper.

### 1.3 Contraintes techniques

| Contrainte | Détail |
|---|---|
| Cible déploiement | Vercel (serverless) |
| Pas de DB existante | départ from scratch |
| Volume agrégé | 250 — 1700 leads/mois (faible à modéré) |
| Latence acceptable | < 300 ms pour afficher la liste, < 1 s pour filtres |
| Permanence | données conservées ≥ 12 mois pour rétention commerciale |
| Souveraineté | leads marocains (RGPD + loi 09-08 marocaine sur données personnelles) |
| Audit | qui a vu / qualifié / supprimé un lead, et quand |
| Voix de marque | UI cohérente avec la palette earthen, typographie Cormorant + Inter |

### 1.4 Contraintes fonctionnelles minimales

- Liste paginée triable (date desc par défaut).
- Filtres : type (contact/checkout/newsletter), statut (nouveau / en cours
  / converti / fermé), période, ville, source.
- Recherche full-text (nom, email, téléphone, message).
- Page détail lead avec historique (changements de statut, notes).
- Actions : changer statut, ajouter note interne, marquer doublon, exporter
  CSV.
- Compteurs en haut : leads non-traités, conversions du mois.

---

## 2. Approche A — *Postgres managé + Drizzle ORM + UI Next.js Server Components*

### 2.1 Description

Stockage : Postgres managé (Vercel Postgres, Neon, ou Supabase Postgres).
ORM : Drizzle (typé, léger, SQL-first). UI admin : Server Components Next.js
qui requêtent directement la DB côté serveur, avec actions serveur pour
mutations (changement de statut, ajout de note).

### 2.2 Schéma data proposé

```
┌────────────────────────────────┐
│ leads                          │
├────────────────────────────────┤
│ id            text PK (cuid)   │
│ source        text [contact|   │
│                checkout|       │
│                newsletter]     │
│ status        text [new|in_    │
│                progress|won|   │
│                lost|spam]      │
│ full_name     text             │
│ email         text             │
│ phone         text             │
│ city          text             │
│ country       text default 'Maroc' │
│ note          text (message)   │
│ product_sku   text NULL        │
│ product_variant text NULL      │
│ quantity      int default 1    │
│ total_price   int (centimes)   │
│ currency      text default 'MAD' │
│ source_channel text default    │
│                'site_web'      │
│ ip            inet             │
│ user_agent    text             │
│ ref           text             │
│ raw_payload   jsonb            │
│ created_at    timestamptz      │
│ updated_at    timestamptz      │
└────────────────────────────────┘

┌────────────────────────────────┐
│ lead_events  (audit / activité)│
├────────────────────────────────┤
│ id            text PK          │
│ lead_id       FK → leads(id)   │
│ kind          text [created|   │
│                status_changed| │
│                note_added|     │
│                webhook_sent|   │
│                webhook_failed] │
│ actor         text (admin id)  │
│ payload       jsonb            │
│ created_at    timestamptz      │
└────────────────────────────────┘

┌────────────────────────────────┐
│ webhook_deliveries (cf. doc 04)│
└────────────────────────────────┘
```

### 2.3 API & flux

```
[Site public] ─POST─→ /api/contact ──► drizzle.insert(leads)
                                       └─► trigger lead_events.created
                                       └─► enqueue webhook (cf. doc 04)

[Admin] ─SC fetch─► /admin/leads ──► drizzle.select(leads).where(...)
                                     SSR rendering (table)

[Admin] ─Server Action─► /admin/leads/[id] ──► drizzle.update(leads).set
                                               └─► insert(lead_events)
```

### 2.4 UI proposée

**`/admin` (dashboard)**
- 3 cartes en haut : *Leads non traités* (compteur), *Conversions du mois*,
  *Taux de conversion 30j*. Typo Cormorant 32 px pour les chiffres, Inter
  micro-caps pour les libellés.
- Une chronologie courte des 5 derniers leads (titre + ville + date
  relative en Pinyon).

**`/admin/leads` (liste)**
- Filtres en haut, en barre fine : `Période`, `Source`, `Statut`,
  `Recherche`. Inputs sobres (border 1 px `encre/15`, focus ring
  `encre`).
- Table dense mais respirée : colonnes *Date / Nom / Source / Statut /
  Ville / Total*. Lignes 56 px, font Inter 13 px, statut en pill
  colorée (palette earthen — pas de rouge agressif).
- Pagination en bas (`mt-12`), 25 par page par défaut.
- Bouton *Exporter (.csv)* en haut à droite.

**`/admin/leads/[id]` (détail)**
- Colonne gauche (60 %) : carte d'identité du lead (nom, contacts cliquables
  `tel:` `mailto:`, ville, source, ref), puis la note/message en Cormorant
  italique sur fond `creme/warm`, puis l'historique des événements
  (chronologie verticale typée).
- Colonne droite (40 %) : actions — changer statut (radio group), ajouter
  une note interne (textarea), marquer comme doublon, supprimer (avec
  `ConfirmationModal`). Toutes les actions sont des Server Actions.

### 2.5 Forces

- **Postgres = standard de l'industrie**. Pas de surprise. Toute personne
  qui reprend le projet est en territoire connu.
- **Drizzle** : types TypeScript inférés depuis le schéma SQL, migrations
  versionnées (`drizzle-kit`), pas de runtime overhead.
- **Server Components** : pas d'API REST / tRPC à concevoir. Les
  requêtes vivent dans le composant qui les consomme. Bundle client
  léger.
- **Filtres + recherche full-text** quasi-gratuits avec un index
  `tsvector` Postgres (recherche sur nom/email/note).
- **Évolutivité** : passage à 100 K leads sans souci (Postgres tient).
- **Conformité RGPD** : DELETE ON CASCADE simple à mettre en place pour
  effacement à la demande ; backups gérés par le provider.
- **Coût raisonnable** : Vercel Postgres ou Neon ont un tier gratuit
  largement suffisant (256 Mo, 1 Go transit/mois).

### 2.6 Faiblesses

- **Cold start serverless** : la première requête peut prendre 200-500 ms
  (ouverture connexion). Mitigeable avec connection pooling
  (`@neondatabase/serverless` HTTP) qui ramène à <50 ms.
- **Migrations à gérer** : il faut une discipline (`drizzle-kit
  generate` + `migrate` au déploiement). Surcoût opérationnel léger.
- **Setup initial** : ~4-6 heures (provisioning DB, schéma, migrations,
  client, premières pages).
- **Plus lourd** que SQLite local pour un volume aussi modeste (overkill
  technique).

### 2.7 Coût

- **Provider** : Vercel Postgres (Hobby) gratuit jusqu'à 256 Mo / 60 h
  compute/mois. Neon : 0,5 Go gratuit + scale-to-zero. Suffisant.
- **Setup** : 4-6 h.
- **Maintenance** : 1 h/trimestre (suivre les migrations, monitorer
  taille).

---

## 3. Approche B — *SQLite / Turso (libsql) + Drizzle + UI server components*

### 3.1 Description

Idem A mais avec SQLite distribué via **Turso** (libsql) au lieu de
Postgres. Turso est un fork SQLite « edge-first », gratuit jusqu'à 9 Go et
500 réplicas. Drizzle supporte libsql nativement. Possibilité d'avoir une
copie locale (`file:./data/dev.db`) en dev et la base distante en prod
sans changer de code.

### 3.2 Schéma data

Identique à l'approche A, traduit en syntaxe SQLite (`text` au lieu de
`varchar`, `integer` pour les timestamps Unix au lieu de `timestamptz`,
`json` (texte) au lieu de `jsonb`).

### 3.3 UI proposée

Identique à l'approche A. Le choix de DB n'impacte pas l'UI.

### 3.4 Différenciateurs vs A

- **Recherche full-text** via FTS5 SQLite (très bon, intégré nativement).
- **Pas de connexion à pooler** : libsql est HTTP, chaque requête est
  indépendante (parfait serverless).
- **Latence p95 < 50 ms** (réplicas en bordure).
- **Backups par snapshot** automatique chez Turso.

### 3.5 Forces

- **Ultra léger** : un fichier `.db` ou un endpoint Turso, c'est tout.
- **Performance edge** : meilleur que Postgres en lecture pour notre
  volume.
- **Moins de configuration**.
- **Local-first dev** : la DB tient dans le repo en dev (1 fichier).
- **Coût** : gratuit jusqu'à des volumes très supérieurs à nos besoins.
- **Évolutivité horizontale** native (réplicas read-only multi-régions).

### 3.6 Faiblesses

- **Moins répandu que Postgres** — la fondatrice ou un futur dev devra
  apprendre Turso (pas catastrophique, mais c'est un coût cognitif).
- **Vendor jeune** : Turso a 2-3 ans. Le projet est sain, mais moins
  battle-tested qu'un Postgres managé.
- **Pas de jsonb-niveau-Postgres** : on stocke du JSON en TEXT. Acceptable
  mais moins puissant pour des requêtes profondes (pas un cas FemiGlow).
- **Migration vers Postgres plus tard** demande conversion (ce n'est pas un
  lock-in fort, mais ça existe).
- **Écriture concurrente** : SQLite ne gère qu'un writer à la fois. Pour
  notre volume (250-1700 leads/mois ≈ 1/heure max), c'est non-sujet.

### 3.7 Coût

- **Provider** : Turso free tier : 9 Go, 500 réplicas, 1 milliard de lignes
  lues/mois. **Gratuit jusqu'à des volumes 100x supérieurs aux besoins.**
- **Setup** : 3-4 h.
- **Maintenance** : minimale.

---

## 4. Approche C — *Stockage tiers (Airtable / Notion / Google Sheets) + UI custom limitée*

### 4.1 Description

On ne stocke pas la donnée chez nous. À chaque lead reçu, on l'envoie
dans une base **Airtable** (ou Notion DB, ou Google Sheets) via leur API.
La fondatrice consulte et qualifie les leads **directement dans
Airtable** (interface mobile + desktop incluse). Du côté FemiGlow, on
n'a qu'un endpoint qui pousse, et éventuellement une mini-page
`/admin/dashboard` qui lit l'API tiers pour afficher des compteurs.

### 4.2 Schéma data

Côté Airtable, une table `Leads` avec les colonnes équivalentes
(`source`, `status`, `full_name`, …). Vues prédéfinies : *Nouveaux*, *En
cours*, *Convertis*, *Spam*. Statut = single-select coloré.

### 4.3 API & flux

```
[Site public] ─POST─→ /api/contact ──► airtable.create({...})
                                       └─► return 200
[Admin] ──ouvre Airtable mobile/web──► consulte, qualifie, exporte
[Admin] ──optionnel──► /admin (dashboard maison)
                       └─► airtable.list(...) (compteurs lecture seule)
```

### 4.4 UI proposée

- **L'UI principale = Airtable** : tableaux, kanban, calendrier, formulaires
  d'édition tout faits, application iOS/Android officielle, historique des
  modifications, partage entre admins.
- **`/admin` côté FemiGlow** = simple page de bienvenue avec 3 compteurs
  lus en temps réel via l'API Airtable, et un lien « Ouvrir Airtable » qui
  bascule.

### 4.5 Forces

- **Time-to-market record** : 2-3 heures pour avoir un système fonctionnel.
- **Pas de DB à maintenir** : ni schéma, ni migration, ni backup.
- **UI puissante gratuite** : tri, filtre, vues kanban/calendrier, export
  CSV/JSON, formulaires d'édition mobile.
- **Multi-utilisateurs natif** : la fondatrice + assistante peuvent
  collaborer sans toucher au code.
- **Notifications & automatisations Airtable** : règles « si statut →
  envoyer email » incluses.
- **Coût zéro** jusqu'à 1 200 enregistrements (Airtable Free) ou 1 000
  rows (Notion Free) ou illimité (Google Sheets).

### 4.6 Faiblesses

- **Souveraineté** : leads marocains stockés chez Airtable (US) ou Notion
  (US) ou Google (US/EU). RGPD + loi 09-08 marocaine : DPA tiers à signer,
  consentement explicite à logger.
- **Vendor lock-in** : si Airtable change de pricing (cas avéré 2023, x2
  sur certains plans), migration douloureuse.
- **Latence webhook outbound** : à chaque lead, appel API Airtable
  (~200-500 ms). À gérer en async sinon ralentit `/api/contact`.
- **Intégration au site** limitée : pas d'authentification unifiée
  (l'admin a un compte Airtable séparé du compte site).
- **Voix de marque** : l'admin vit dans une UI Airtable générique. Aucune
  cohérence avec FemiGlow ; perte d'unité visuelle.
- **API Airtable** : rate-limit 5 req/sec/base. Suffisant mais pas
  illimité.
- **Plafond Free** : 1 200 records → on dépasse au bout de 6-12 mois,
  bascule en plan payant 10 $/user/mois.
- **Pas de webhook structuré sortant facile** : pour relayer vers le
  serveur cible (cf. doc 04), il faut Zapier/Make en intermédiaire (coûts
  additionnels) OU coder un poller depuis FemiGlow.

### 4.7 Coût

- **Airtable Free** : 0 € jusqu'à 1 200 records, puis 10 $/user/mois pour
  le plan Team (50 K records).
- **Setup** : 2-3 h.
- **Maintenance** : très faible côté code, dépendance vendor à monitorer.

---

## 5. Tableau comparatif

| Critère | A — Postgres + Drizzle | B — Turso + Drizzle | C — Airtable / Notion / Sheets |
|---|:---:|:---:|:---:|
| Temps de mise en route | 4-6 h | 3-4 h | 2-3 h |
| Coût récurrent (volume FemiGlow) | 0 € (free tier) | 0 € (free tier) | 0 € jusqu'à 6-12 mois, puis 10 $/u/mois |
| Cohérence UI avec la marque | excellente (custom) | excellente (custom) | nulle (UI Airtable) |
| Souveraineté / RGPD | bonne (Vercel/Neon EU) | bonne (Turso EU possible) | mauvaise (US, DPA à signer) |
| Vendor lock-in | faible (SQL standard) | moyen (libsql) | **fort** |
| Évolutivité (100 K+ leads) | excellente | excellente | dégradée (plan payant + lenteur) |
| Recherche full-text | excellente (`tsvector`) | bonne (`FTS5`) | bonne (intégrée) |
| Backups | inclus (provider) | inclus (Turso) | inclus (Airtable) |
| Multi-utilisateurs admin | à coder | à coder | natif |
| App mobile pour admin | à coder (PWA) | à coder | **incluse** (Airtable iOS/Android) |
| Webhook outbound vers serveur cible | code maison (cf. doc 04) | code maison (cf. doc 04) | nécessite Zapier/Make ou poller |
| Audit / logs / historique | à coder (table `lead_events`) | à coder | inclus (Airtable revisions) |
| Latence p95 | < 100 ms (HTTP pool) | < 50 ms (edge) | 200-500 ms (API) |
| Maturité technique | très élevée (Postgres) | bonne (jeune) | très élevée |
| Complexité opérationnelle | moyenne (migrations) | faible | très faible |

---

## 6. Lecture transversale

- **Le choix se joue principalement sur deux axes** :
  - **Souveraineté + cohérence de marque** (favorise A ou B).
  - **Time-to-market + zéro maintenance** (favorise C).
- **La capacité de l'admin à s'auto-servir** (sans dev) est meilleure dans
  C ; mais elle reste très bonne dans A/B avec une UI custom soignée.
- **La projection vers le webhook cible** (format JSON donné en intro) est
  immédiate dans A/B (mapping direct depuis la table `leads`) ; elle
  demande un intermédiaire (Zapier/Make/poller) dans C.
- **Le contrôle éditorial sur l'expérience admin** (la fondatrice qualifie
  ses leads dans une UI à l'image de la marque, avec ses mots, sa
  typographie) n'existe que dans A/B.
- **A vs B** : Postgres est plus standard, plus enseignable ; Turso est
  plus performant et plus simple à opérer. Les deux sont équivalents en
  qualité technique pour notre volume.

## 7. Recommandation pour la gestion des leads

> **Recommandée : A — Postgres managé (Vercel Postgres ou Neon) + Drizzle
> ORM + UI Next.js Server Components.**

**Justification synthétique :**

1. **Cohérence marque** : l'admin vit dans une UI dessinée à l'image de
   FemiGlow — Cormorant pour les titres, Inter pour les tableaux, palette
   earthen. La fondatrice est chez elle dans son admin comme dans son
   atelier.
2. **Souveraineté RGPD/09-08** : leads marocains chez un provider EU
   (Neon UE, Vercel Postgres EU). Pas de DPA tiers à signer.
3. **Postgres = lingua franca** : si l'équipe grossit, n'importe quel dev
   est productif immédiatement. Turso (B) demanderait un apprentissage.
4. **Évolutivité illimitée** : pas de plafond `record` à craindre.
5. **Webhook outbound trivial** : depuis Postgres + Drizzle, projeter une
   ligne `leads` vers le format webhook cible est 15 lignes de code (cf.
   doc 04).
6. **Audit gratuit** : la table `lead_events` donne historique et
   traçabilité indispensables pour qualifier sans perdre la main.
7. **Coût zéro** sur tier gratuit Vercel/Neon, largement suffisant pour
   le volume.

**Ce que cette recommandation implique d'accepter :**

- ~4-6 heures de setup initial (provisioning, schéma, migrations,
  premières pages SSR).
- Discipline de migrations versionnées (`drizzle-kit`), à intégrer au
  pipeline de déploiement.
- Pas d'application mobile native pour l'admin — mais l'UI web responsive
  (mobile-first) couvre 100 % des cas.

**Pourquoi pas Turso (B) :** Turso est techniquement excellent et sans
doute légèrement plus rapide. Le seul critère qui fait choisir Postgres
est la **familiarité** : le savoir Postgres est universel, le savoir
libsql est encore de niche. Pour un projet qu'une fondatrice doit pouvoir
faire reprendre par n'importe quel dev senior, ce choix d'écosystème
prime sur 30 ms de latence.

**Pourquoi pas Airtable (C) :** Airtable serait excellent **si la fondatrice
voulait expédier en 48 h sans coder d'admin**. Mais l'objectif déclaré est
*« une interface complète, ergonomique et opérationnelle »* — donc cohérente
avec la voix de la marque. Une UI Airtable trahirait l'ambition éditoriale.

> Le détail d'implémentation (schéma SQL exact, écrans, server actions,
> tests) est hors scope de cette étude. Voir la **recommandation finale**
> consolidée dans `recommandation-finale.md`.
