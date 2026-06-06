# Dashboard `/admin/emails` — fiche d'audit

**Fichiers** : `app/admin/emails/{page,layout,loading,error}.tsx`, `kpi-format.ts`,
`components/admin/emails/{KpiCards,HealthBadge,DashboardFreshness,GlobalCommandPalette}.tsx`
**Rendu** : RSC `force-dynamic`, 4 requêtes serveur (KPI 7j, 8 derniers envois,
health 15 checks, infra checks). Aucun cache, aucun auto-refresh.

## 1. État actuel — wireframe

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Emails                                          [🟢 Système OK ▾]          │
│ Transactionnels envoyés via Stalwart.           Données à jour au 14:32    │
│ KPIs 7 derniers jours.                          [↻ Rafraîchir]             │
├────────────────────────────────────────────────────────────────────────────┤
│ ⚠ Livraison silencieuse: 42 email(s) envoyé(s) sur 7 j mais aucune        │   ← alerte conditionnelle
│   livraison confirmée — le webhook Stalwart est probablement muet.         │     (sent≥1 && delivered=0)
│   [Vérifier les events delivered →]                                        │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐          │
│ ENVOYÉS  │ LIVRÉS   │ ÉCHECS   │ DLQ      │ EN       │ TOTAL    │          │   ← 6 cartes, 1-5 cliquables
│ (7J)     │          │          │          │ ATTENTE  │ TENTAT.  │          │     (drill-down cockpit
│   42     │   0      │   3      │   0      │   12     │   45     │          │      avec ?status= pré-rempli)
│ sur 45   │ delivery │ 6.7% du  │ abandon- │ pickup   │ 7 dern.  │          │
│ tentat.  │ silencieux│ total   │ nés      │ cron 60s │ jours    │          │
│          │ ? webhook│          │          │          │          │          │
├──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘          │
│ [Liste transactionnel →] [Campagnes →] [Automatisations →] [Audiences →]  │   ← 7 quick-links
│ [Templates HTML →] [Listmonk (admin natif) →] [Events (debug) →]           │     ⚠ Suppression ABSENTE
│ Astuce : [⌘ K] / [Ctrl K] pour naviguer entre sections sans souris.       │
├────────────────────────────────────────────────────────────────────────────┤
│ DERNIERS ENVOIS                                  Voir tous les envois →    │
│ ┌──────────┬───────────┬──────────────────┬────────────┬───────┐          │
│ │ Date     │ Template  │ Destinataire     │ Statut     │       │          │
│ │ 06/06 14h│ welcome   │ a@exemple.com    │ ⏺ Envoyé   │ Voir  │          │   ← 8 lignes max
│ │ …        │           │                  │            │       │          │
│ └──────────┴───────────┴──────────────────┴────────────┴───────┘          │
└────────────────────────────────────────────────────────────────────────────┘

HealthBadge déplié (<details>) :  SMTP ✓ · DB ✓ · Outbox stuck: 0 · DLQ 24h: 0
  · Pending: 12 · Dernier livré: jamais · Fraîcheur livraison ✗ · Cron drain ✓
  · Webhook (delivered 7j) ✗ 0 reçu pour 42 envoyés [→] · File en retard ✓ · …
```

## 2. Fonctionnement & états

| État | Implémentation | Qualité |
|---|---|---|
| Loading | skeleton 6 cartes + 6 lignes, `role="status"` sr-only | ✅ |
| Erreur | boundary rose, digest, Réessayer + retour admin | ✅ (mais message présume la DB — DASH-09) |
| Vide | ligne de table « Aucun envoi sur la période. » + lien cockpit | ⚠ faible (DASH-05) |
| Fraîcheur | timestamp + bouton manuel uniquement | ⚠ pas d'auto-refresh (DASH-03) |

Palette ⌘K : 12 routes + 4 actions, fuzzy, focus trap, aria-activedescendant — très bon.

## 3. Problèmes (cf. matrice)

`DASH-01` fenêtre 7j figée · `DASH-02` KPI Livrés contradictoire · `DASH-03` pas
d'auto-refresh · `DASH-04` pending sans âge · `DASH-05` empty state faible ·
`DASH-06` pas de tendance · `DASH-07` « Bounce perm. » · `DASH-08` pas de TZ ·
`DASH-09` message d'erreur présomptueux · `DASH-10` placeholder Cmd-K only ·
`DASH-11` contraste HealthBadge · `DASH-12` deep-links santé sans contexte ·
`TRV-07` StatusBadge dupliqué ici · `SUP-01` Suppression absente des quick-links.

## 4. Améliorations proposées (chantier C3 + C2) — wireframe cible

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Emails  [Dashboard]·[Transactionnel ⚠3]·[Campagnes]·[Automations]·         │  ← C2 : onglets persistants
│         [Audiences]·[Templates]·[Suppression]·[Events]·[Listmonk]          │     + badges compteurs
├────────────────────────────────────────────────────────────────────────────┤
│ Tableau de bord            Fenêtre : (24 h) (•7 j) (30 j)   [🟢 Santé ▾]  │  ← DASH-01 : sélecteur
│                            ↻ auto · à jour il y a 38 s (Casablanca)        │  ← DASH-03/08 : auto-refresh
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐          │     60 s + âge + TZ
│ ENVOYÉS  │ LIVRÉS   │ ÉCHECS   │ DLQ      │ EN FILE  │ TOTAL    │          │
│   42     │   38     │   3      │   0      │   12     │   45     │          │
│ ▁▂▄▆▅▇   │ ▁▂▄▆▅▇  │ ▁▁▂▁▁▁  │          │ relevé   │          │          │  ← DASH-06 : sparklines +
│ +12% vs  │ 90% des  │ +1 vs    │ —        │ il y a   │          │          │     tendance vs période préc.
│ 7j préc. │ envoyés  │ 7j préc. │          │ 38 s ·   │          │          │  ← DASH-04 : âge du relevé
│          │          │          │          │ drain 60s│          │          │
├──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘          │
│ Si webhook muet, carte LIVRÉS devient :                                    │
│ │ LIVRÉS   │                                                               │
│ │ 0        │   ← DASH-02 : sous-texte DÉTERMINISTE                         │
│ │ ⚠ webhook muet depuis 06/06 16:49 — [diagnostiquer →]                   │
├────────────────────────────────────────────────────────────────────────────┤
│ DERNIERS ENVOIS                                  Voir tous les envois →    │
│  (si vide)      ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐                             │
│                 │        📨                    │  ← DASH-05 : <EmptyState>  │
│                 │  Aucun envoi sur 7 jours    │     unifié (TRV-09)        │
│                 │  [Ouvrir le cockpit →]      │                             │
│                 └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘                             │
└────────────────────────────────────────────────────────────────────────────┘
Arrivée depuis un deep-link santé (DASH-12) — bannière contextuelle cockpit :
┌────────────────────────────────────────────────────────────────────────────┐
│ ℹ Vous arrivez depuis le check santé « DLQ 24h : 3 » (relevé 14:32) [✕]   │
└────────────────────────────────────────────────────────────────────────────┘
```

**Détail des actions proposées**
1. Sélecteur de fenêtre (`?window=24h|7d|30d`) partagé avec l'API summary du cockpit.
2. Auto-refresh 60 s (`router.refresh()` sous `useEffect` + visibilitychange pour
   suspendre onglet caché) ; composant `<Freshness>` (C1).
3. Carte Livrés tri-état : normale / « webhook muet depuis {ActiveEnter du
   dernier silence} » / « non suivi » — réutilise `checkEmailingInfraHealth`.
4. Sparklines + tendances : l'endpoint summary du cockpit expose déjà séries et
   comparaison ; l'appeler ici plutôt que dupliquer.
5. Supprimer la map locale de `KpiCards.tsx` au profit de `STATUS_META` (TRV-07).
6. Quick-links remplacés par les onglets C2 (suppression du doublon de navigation).
