# Cockpit transactionnel `/admin/emails/transactional` — fiche d'audit

**Fichiers** : `components/admin/emails/cockpit/{TransactionalCockpit,FilteredTable,
KpiHeader,BulkActionsBar,SavedViewsSidebar,CommandPalette}.tsx`,
`lib/mail/transactional/{search,summary,bulk-actions,filters-parser}.ts`
**Rendu** : RSC mince (vues sauvegardées) → app client ; recherche `POST /search`
(offset, 50/page, troncature à 5 000) ; KPI auto-refresh 5 s.
**Verdict** : l'interface la plus aboutie de la section — sert de référence aux autres.

## 1. État actuel — wireframe

```
┌──────────────┬─────────────────────────────────────────────────────────────┐
│ VUES SYSTÈME │ ┌─────────┬─────────┬─────────┬───────────┐                 │
│  Échecs 24h  │ │DÉLIVRÉS │ EN FILE │ ÉCHECS  │HARD BOUNCE│  [↻ rafraîchir]│ ← 4 KPI, clic = filtre
│  DLQ         │ │  1 204  │   12    │ ⚠ 7     │  ⚠ 2      │   auto 5 s     │   sparkline+tendance vs J-1
│ MES VUES     │ │ ▂▄▆▅▇  │ (vide)  │ ▁▂▁▁▃  │  ▁▁▂▁▁   │                 │   seuils: échecs≥5, hard>0
│  Relances ⋮  │ │ +4% J-1 │         │ +40% J-1│           │                 │
│  [+ Nouvelle │ └─────────┴─────────┴─────────┴───────────┘                 │
│     vue]     │ [⌘K pour filtrer] · [DLQ] [Soft bounces]                    │ ← quick filters
│              │ [Libérer les envois bloqués] · 2 filtres actifs [effacer]   │ ← reap-stuck (confirm)
│              ├─────────────────────────────────────────────────────────────┤
│              │ ✓ 3 ligne(s) sélectionnée(s) [↻ Retry (3)]                  │ ← bulk bar (si sélection)
│              │   [⊘ Marquer en suppression] [⬇ Exporter CSV] [✕]           │
│              ├──┬───────┬──────────────┬──────────┬─────────┬────────┬────┤
│              │☐ │ Date ▾│ Destinataire │ Template │ Sujet    │ Statut │Att.│ ← tri aria-sort
│              │☑ │14:32:08│ a@x.com     │ welcome  │ Bienven… │⏺ Échec │ 3/5│
│              │☑ │14:31:50│ b@y.com  •─────────────── clic → page détail    │
│              │☐ │06/06 9h│ c@z.com     │ cart-1h  │ Votre p… │⏺ Livré │ 1/5│
│              ├──┴───────┴──────────────┴──────────┴─────────┴────────┴────┤
│              │ 1–50 sur 5 000+        [Précédent] [Suivant]                │ ← "+" = tronqué (≥5000)
└──────────────┴─────────────────────────────────────────────────────────────┘

Palette ⌘K : grammaire  status:dlq  to:*@bad.tld  template:cart-*  source:api.…
             after:-7d  before:today  attempts:>3  has:error  + texte libre
             autocomplétion entités (templates/destinataires/sources, debounce+abort)
             + actions contextuelles (retry/suppress/export si sélection)

Détail /transactional/[id] : breadcrumb · métadonnées (3 col : template v, from,
reply-to, idempotency, SMTP message-id/réponse, livré à, dernière erreur rouge)
· [Relancer] si failed|dlq|bounced_soft · iframe snapshot HTML 600px ·
timeline email_event (badge source bleue=webhook / grise=app, payload <details>)
· payload JSON.
```

## 2. Forces (à généraliser ailleurs)

- Bulk actions honnêtes : « 2 relancés · 1 ignoré (wrong_status) », sélection
  préservée en cas d'erreur réseau + bouton Réessayer.
- Confirm suppress compte les **adresses distinctes** (UX-COCKPIT-007).
- Export CSV RFC 4180 + BOM Excel FR.
- A11y exemplaire : `aria-sort`, `role="toolbar"`, `aria-busy`, labels par ligne.
- Erreurs HTTP traduites en consignes (401 → « reconnecte-toi », réseau → …).

## 3. Problèmes (cf. matrice)

`CKPT-01` **export CSV = page visible seulement, sans avertissement (critique)** ·
`CKPT-03` erreurs de parsing de filtres calculées mais jamais montrées · `CKPT-04`
select-all limité à la page · `CKPT-02` raisons skip en anglais · `CKPT-05`
sparkline « En file » vide ≈ bug · `CKPT-06` « 5 000+ » inexpliqué · `CKPT-07`
reap-stuck sans statut résultant · `CKPT-08` sent vs delivered opaque ·
`CKPT-09` détail sans retour bas de page · `CKPT-12` pagination sans saut.

## 4. Améliorations proposées (chantier C3) — wireframes cibles

**a) Sélection globale + export serveur (CKPT-01/04)**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ✓ Les 50 emails de cette page sont sélectionnés.                            │
│   [Sélectionner les 5 312 emails correspondant aux filtres]                 │ ← pattern Gmail
├─────────────────────────────────────────────────────────────────────────────┤
│ ✓ 5 312 emails sélectionnés (filtre : status:failed after:-7d) [annuler]   │
│ [↻ Retry (5 312)] [⊘ Suppression] [⬇ Exporter CSV (serveur, ~5 312 lignes)]│
└─────────────────────────────────────────────────────────────────────────────┘
→ nouvelles routes : POST /bulk-retry-by-filter, POST /export (stream CSV).
→ tant que l'export serveur n'existe pas : bouton renommé « Exporter CSV (page) ».
```

**b) Erreurs de filtre visibles (CKPT-03)**
```
┌ ⌘K ─────────────────────────────────────────────────┐
│ > status:failed attempts:abc                         │ ← liseré rouge
│ ⚠ « attempts:abc » ignoré — attendu : >N, <N, =N    │ ← section warning
│ 🔍 FILTRES   status:failed ✓                         │
└──────────────────────────────────────────────────────┘
```

**c) Timeline pédagogique (CKPT-08) — page détail**
```
│ DÉROULÉ                                  Légende : 📡 webhook Stalwart · ⚙ app │
│ 14:32:08  ⚙ sent        accepté par le relais SMTP (250)                      │
│ 14:32:09  📡 delivered   remis en boîte (webhook delivery.delivered)           │
│   ⓘ Un mail peut rester « Envoyé » si le destinataire est une boîte locale    │
│     (delivery.completed non suivi) ou si le webhook est muet.                  │
```

**d) Micro-correctifs** : map FR `{not_found: "non trouvé", wrong_status: "statut
non relançable"}` ; tooltip « + » = « >5 000 résultats, affinez » ; placeholder
« — » + title sur la sparkline file ; feedback reap « N libérés → re-mis en file
(ou DLQ si plafond) » ; saut de page `[1] … [12] [Aller à : __]` ; lien retour
sticky en bas du détail.
