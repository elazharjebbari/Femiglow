# Wireframes textuels

> Représentations ASCII de chaque page admin. Servent de spécification
> non-ambigüe pour l'implémentation. Mesures indicatives, le pixel-perfect
> est dans le code Tailwind.

---

## /admin/login

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│                                                                │
│                                                                │
│                       FemiGlow                                 │
│                       (logo Pinyon Script, h-10)               │
│                                                                │
│                       ─── × ───                                │
│                                                                │
│                                                                │
│           ┌──────────────────────────────────┐                 │
│           │                                  │                 │
│           │  ESPACE ADMINISTRATION           │ ← kicker        │
│           │                                  │                 │
│           │  Adresse e-mail                  │ ← label Inter 13│
│           │  ┌────────────────────────────┐  │                 │
│           │  │                            │  │ ← input h-11    │
│           │  └────────────────────────────┘  │                 │
│           │                                  │                 │
│           │  Mot de passe                    │                 │
│           │  ┌────────────────────────────┐  │                 │
│           │  │                            │  │                 │
│           │  └────────────────────────────┘  │                 │
│           │                                  │                 │
│           │  ┌────────────────────────────┐  │                 │
│           │  │      Se connecter          │  │ ← button primary│
│           │  └────────────────────────────┘  │                 │
│           │                                  │                 │
│           └──────────────────────────────────┘                 │
│                                                                │
│                                                                │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Notes** :
- Card centrée, max-width 400 px, padding 32 px.
- Pas de Header/Footer marketing.
- Background `bg-creme`.
- Erreur générique sous le bouton si auth échoue : `text-[#A33A3A] text-sm`.

---

## /admin/dashboard

```
┌────────────────────────────────────────────────────────────────────────────┐
│ FemiGlow Admin              Tableau de bord            (avatar) Déconnexion│ ← header h-14
├──────────┬─────────────────────────────────────────────────────────────────┤
│          │                                                                 │
│ Tableau  │  Tableau de bord                                                │ ← h1
│  de bord │                                                                 │
│          │  ┌─────────────────┬─────────────────┬─────────────────────┐    │
│ Leads    │  │ LEADS 24 H      │ NON TRAITÉS     │ LIVRAISONS KO 24 H  │    │
│  Tous    │  │                 │                 │                     │    │
│  Nouv.   │  │      12         │      8          │       2             │    │ ← KPI cards
│          │  │ +3 vs hier      │ depuis 3 j      │ Voir détails →      │    │
│ Webhooks │  └─────────────────┴─────────────────┴─────────────────────┘    │
│          │                                                                 │
│          │  ─── Derniers leads ───                                         │
│          │                                                                 │
│ Compte   │  ┌────────────────────────────────────────────────────────────┐ │
│          │  │ Date          Nom            Type      Statut    Action    │ │
│          │  │ il y a 2 h    A. Bennani     Order     [new]     →         │ │
│          │  │ il y a 4 h    F. Tahiri      Contact   [new]     →         │ │
│          │  │ il y a 6 h    K. Idrissi     Order     [in_pr]   →         │ │
│          │  │ il y a 9 h    L. Zerouali    Newslet.  [new]     →         │ │
│          │  │ hier 18:42    M. Berrada     Order     [conv.]   →         │ │
│          │  └────────────────────────────────────────────────────────────┘ │
│          │  Voir tous les leads →                                          │
│          │                                                                 │
└──────────┴─────────────────────────────────────────────────────────────────┘
```

---

## /admin/leads

```
┌────────────────────────────────────────────────────────────────────────────┐
│ FemiGlow Admin              Leads                          Déconnexion     │
├──────────┬─────────────────────────────────────────────────────────────────┤
│          │                                                                 │
│  Sidebar │  Leads                              [Exporter en CSV]           │ ← h1 + bouton secondaire
│          │                                                                 │
│          │  ┌────────────────────────────────────────────────────────────┐ │
│          │  │ 🔍 Recherche...     [Type ▼] [Statut: new × in_progress ×] │ │ ← filtres
│          │  │                     [Période: 30 derniers jours ▼]         │ │
│          │  └────────────────────────────────────────────────────────────┘ │
│          │                                                                 │
│          │  47 résultats                                                   │
│          │                                                                 │
│          │  ┌─────────┬─────────┬──────────┬──────────┬──────────┬──────┐ │
│          │  │ ⇅ Date  │ Nom     │ Type     │ Email    │ Statut   │      │ │
│          │  ├─────────┼─────────┼──────────┼──────────┼──────────┼──────┤ │
│          │  │ 03 mai  │A.Bennani│ Order    │a.b@x.com │ ◯ new    │  →   │ │
│          │  │ 03 mai  │F.Tahiri │ Contact  │f.t@x.com │ ◯ new    │  →   │ │
│          │  │ 02 mai  │K.Idriss │ Order    │k.i@x.com │ ◑ in_pr  │  →   │ │
│          │  │   ...   │   ...   │   ...    │   ...    │  ...     │  →   │ │
│          │  └─────────┴─────────┴──────────┴──────────┴──────────┴──────┘ │
│          │                                                                 │
│          │              ‹ Précédent       1-25 sur 47       Suivant ›     │
│          │                                                                 │
└──────────┴─────────────────────────────────────────────────────────────────┘
```

**Notes** :
- Filtres en chips dismissibles.
- Tri sur date par défaut (desc).
- Toute la ligne est cliquable (route → /admin/leads/[id]).
- Pagination cursor-based mais affichée en X-Y sur N pour confort.

---

## /admin/leads/[id]

```
┌────────────────────────────────────────────────────────────────────────────┐
│ FemiGlow Admin              Leads / Détail                  Déconnexion    │
├──────────┬─────────────────────────────────────────────────────────────────┤
│          │  ‹ Retour à la liste                                            │
│  Sidebar │                                                                 │
│          │  Aïcha Bennani                          ◯ new ▼                │ ← h1 + statut dropdown
│          │  ID cmokk1o9v08cer3tvasgohtw6 · Reçu le 3 mai 2026 à 15:32      │ ← métadonnées
│          │                                                                 │
│          │  ┌──────────────────────────┐  ┌─────────────────────────────┐ │
│          │  │ COORDONNÉES              │  │ COMMANDE                    │ │
│          │  │                          │  │                             │ │
│          │  │ Email a.b@example.com    │  │ Total      3 000 MAD        │ │
│          │  │ Téléphone +212 6 53 ...  │  │ Quantité   1                │ │
│          │  │ Ville Casablanca         │  │ Produit    Kit Principale   │ │
│          │  │ Adresse 12 rue X         │  │ Variant    Standard         │ │
│          │  │                          │  │ SKU        FG-KIT-PRINC     │ │
│          │  └──────────────────────────┘  └─────────────────────────────┘ │
│          │                                                                 │
│          │  ─── Note interne ───                                          │
│          │  ┌────────────────────────────────────────────────────────────┐ │
│          │  │ Aucune note pour le moment.                                │ │
│          │  │ [+ Ajouter une note]                                       │ │
│          │  └────────────────────────────────────────────────────────────┘ │
│          │                                                                 │
│          │  ─── Historique ───                                            │
│          │  ● Lead créé · 3 mai 2026, 15:32 · public                      │
│          │  │                                                              │
│          │  ● Webhook livré · 3 mai, 15:33 · CRM Hubspot · 200 OK         │
│          │                                                                 │
│          │  ─── Livraisons webhook ───                                    │
│          │  ┌──────────────┬─────────┬──────┬──────────┬──────────────┐   │
│          │  │ Destination  │ Statut  │ Att. │ Latence  │ Actions      │   │
│          │  │ CRM Hubspot  │ ✓ 200   │ 1    │ 432 ms   │ Voir / Rejouer│   │
│          │  └──────────────┴─────────┴──────┴──────────┴──────────────┘   │
│          │                                                                 │
│          │                          [Supprimer ce lead]  ← bouton danger   │
│          │                                                                 │
└──────────┴─────────────────────────────────────────────────────────────────┘
```

---

## /admin/webhooks

```
┌────────────────────────────────────────────────────────────────────────────┐
│ FemiGlow Admin              Webhooks                       Déconnexion     │
├──────────┬─────────────────────────────────────────────────────────────────┤
│          │                                                                 │
│  Sidebar │  Webhooks                          [+ Ajouter une destination]  │ ← h1 + bouton primary
│          │                                                                 │
│          │  ┌────────────────────────────────────────────────────────────┐ │
│          │  │ Destination       URL                Filtre   24 h         │ │
│          │  ├────────────────────────────────────────────────────────────┤ │
│          │  │ ● CRM Hubspot     https://crm.../v1   order    47/47 ✓     │ │
│          │  │ ● Notion log      https://notion../   tous     128/130 (2 ✗)│ │
│          │  │ ◯ Test staging    https://staging.../  tous     —    désact.│ │
│          │  └────────────────────────────────────────────────────────────┘ │
│          │                                                                 │
│          │  Légende : ● actif  ◯ désactivé                                 │
│          │                                                                 │
└──────────┴─────────────────────────────────────────────────────────────────┘
```

---

## /admin/webhooks/new (et /admin/webhooks/[id])

```
┌────────────────────────────────────────────────────────────────────────────┐
│ FemiGlow Admin              Webhooks / Nouveau              Déconnexion    │
├──────────┬─────────────────────────────────────────────────────────────────┤
│          │                                                                 │
│  Sidebar │  Nouvelle destination                                           │ ← h1
│          │                                                                 │
│          │  Nom de la destination                                          │
│          │  ┌────────────────────────────────────────────────────────────┐ │
│          │  │ CRM Hubspot                                                │ │
│          │  └────────────────────────────────────────────────────────────┘ │
│          │  Utilisé pour vous repérer dans la liste.                       │
│          │                                                                 │
│          │  URL du serveur partenaire                                     │
│          │  ┌────────────────────────────────────────────────────────────┐ │
│          │  │ https://crm.partenaire.com/webhooks/femiglow               │ │
│          │  └────────────────────────────────────────────────────────────┘ │
│          │  Adresse complète, en HTTPS.                                    │
│          │                                                                 │
│          │  Secret de signature                                           │
│          │  ┌──────────────────────────────────────┬──────────┬─────────┐│ │
│          │  │ ●●●●●●●●●●●●●●●●●●●●●●●●●●          │ [Voir]   │ [Copier]││ │
│          │  └──────────────────────────────────────┴──────────┴─────────┘│ │
│          │  [Générer un nouveau secret]                                    │ │
│          │  Clé partagée pour signer chaque livraison.                     │
│          │                                                                 │
│          │  Filtrer les leads transmis                                    │ │
│          │  (○) Tous les leads                                             │
│          │  (●) Seulement le type :  ☑ order  ☐ contact  ☐ newsletter      │
│          │                                                                 │
│          │  ─── × ───                                                      │
│          │                                                                 │
│          │                              [Annuler]  [Enregistrer]           │
│          │                                                                 │
└──────────┴─────────────────────────────────────────────────────────────────┘
```

---

## /admin/webhooks/[id]/deliveries

```
┌────────────────────────────────────────────────────────────────────────────┐
│ FemiGlow Admin   Webhooks / CRM Hubspot / Livraisons       Déconnexion     │
├──────────┬─────────────────────────────────────────────────────────────────┤
│          │  ‹ Retour                                                       │
│  Sidebar │                                                                 │
│          │  Livraisons — CRM Hubspot                                       │ ← h1
│          │                                                                 │
│          │  ┌───────────────────────────────────────────────────────────┐  │
│          │  │ [Statut: tous ▼] [Période: 7 jours ▼]                     │  │
│          │  └───────────────────────────────────────────────────────────┘  │
│          │                                                                 │
│          │  ┌──────────┬─────────┬──────┬──────────┬──────────┬─────────┐ │
│          │  │ Date     │ Lead    │ Att. │ Statut   │ Latence  │ Actions │ │
│          │  ├──────────┼─────────┼──────┼──────────┼──────────┼─────────┤ │
│          │  │ il y a 2m│ A.Bennan│  1   │ ✓ 200    │ 432 ms   │ Voir    │ │
│          │  │ il y a 5h│ K.Idriss│  3   │ ✗ 503    │ 12 s     │ Voir    │ │
│          │  │          │         │      │          │          │ Rejouer │ │
│          │  └──────────┴─────────┴──────┴──────────┴──────────┴─────────┘ │
│          │                                                                 │
│          │  Cliquez une ligne pour voir le payload, la réponse et         │
│          │  l'erreur éventuelle.                                           │
│          │                                                                 │
└──────────┴─────────────────────────────────────────────────────────────────┘
```

**Détail expand (au clic d'une ligne)** :
```
┌─ Payload envoyé ──────────────────────────────────────────────────────┐
│ {                                                                     │
│   "id": "cmokk1o9v08cer3tvasgohtw6",                                  │
│   "ip": "41.251.52.100",                                              │
│   ...                                                                 │
│ }                                                                     │
├─ Réponse partenaire ──────────────────────────────────────────────────┤
│ HTTP 503 Service Unavailable                                          │
│ retry-after: 30                                                       │
├─ Erreur ──────────────────────────────────────────────────────────────┤
│ Upstream returned 5xx, will retry at 2026-05-03 20:32:00              │
└───────────────────────────────────────────────────────────────────────┘
```
