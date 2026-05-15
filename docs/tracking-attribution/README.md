# Tracking attribution — système d'envoi sélectif de conversions par canal

> **Statut** : en cours d'implémentation
> **Owner** : tracking team
> **Dernière maj** : 2026-05-15

## Pourquoi

Aujourd'hui, chaque event de conversion (purchase, lead_capture, …) est poussé
**à tous les pixels** (Google Ads, Meta, TikTok, …). Conséquences :

- Une même conversion comptée 4× par des plateformes qui se créditent toutes
- Les algos Smart Bidding de chaque canal sont brouillés (Meta s'attribue des
  ventes venues de Google Ads et vice-versa)
- ROAS dilué et incomparable entre canaux
- Audiences Lookalike polluées par des signaux faux-positifs

## Le besoin

Quand un visiteur clique sur une pub Google Ads et achète :

1. La conversion doit être **comptée chez Google Ads uniquement** (pour le bidding)
2. Meta / TikTok peuvent recevoir un signal pour **alimenter leurs audiences**
   (retargeting) mais **pas pour compter une conversion**

Quand un visiteur arrive en **direct** sans canal identifiable : appliquer une
**stratégie configurable** (dernier-clic payant, premier-clic, etc.) avec une
valeur par défaut recommandée.

## Pile de docs

| # | Fichier | Sujet |
|---|---|---|
| 0 | [README.md](./README.md) | Index + diagrammes |
| 1 | [01-audit-and-needs.md](./01-audit-and-needs.md) | État de l'art interne + cartographie du besoin |
| 2 | [02-approaches-comparison.md](./02-approaches-comparison.md) | 3 approches évaluées + verdict |
| 3 | [03-architecture.md](./03-architecture.md) | Architecture cible (approche C hybride) |
| 4 | [04-data-and-engine.md](./04-data-and-engine.md) | Schéma BDD + moteur d'attribution |
| 5 | [05-ui-ux-integration.md](./05-ui-ux-integration.md) | UI admin (settings + debug) |
| 6 | [06-runbook.md](./06-runbook.md) | Plan d'exécution par phases |
| 7 | [07-testing.md](./07-testing.md) | Tests unit / integration / E2E |

## Diagramme de haut niveau (cible)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Visiteur arrive  ←─ gclid=…  (Google Ads click)                        │
└────────────┬────────────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  AttributionCaptureBridge (client)                                      │
│  • lit URL → détecte canal (gclid/fbclid/ttclid/utm…)                   │
│  • écrit cookie `fg_attr` (first_touch préservé, last_touch refresh)    │
│  • POST /api/track/attribution → upserts `visitor_attribution`          │
└────────────┬────────────────────────────────────────────────────────────┘
             │
             ▼ (à chaque emit)
┌─────────────────────────────────────────────────────────────────────────┐
│  TrackingClient.emit()                                                  │
│  • lit attribution courante (cookie ou contexte)                        │
│  • applique stratégie (last_paid_touch par défaut)                      │
│  • annote dataLayer.push({ ..., attribution: {                          │
│      channel: 'google_ads', click_id: '<gclid>',                        │
│      strategy: 'last_paid_touch', is_paid: true                         │
│    }})                                                                  │
└────────────┬────────────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  GTM (côté navigateur)                                                  │
│                                                                         │
│  Tag GA4 Event ─────────────────► fire toujours (analytics neutre)      │
│                                                                         │
│  Tag Meta Pixel (Lead/Purchase)                                         │
│    condition: attribution.channel IN ['meta','direct','organic']        │
│    → fire seulement si attribué Meta ou sans canal payant identifié     │
│                                                                         │
│  Tag Google Ads Conversion (awct)                                       │
│    condition: attribution.channel IN ['google_ads','direct','organic']  │
│    → fire seulement si attribué Google Ads ou sans canal payant         │
│                                                                         │
│  Tag TikTok Pixel                                                       │
│    condition: attribution.channel IN ['tiktok','direct','organic']      │
│    → idem                                                               │
│                                                                         │
│  Audiences events (page_view, view_item)                                │
│    pas de condition → fire toujours sur tous les pixels                 │
└─────────────────────────────────────────────────────────────────────────┘
```

## Principe directeur

**1 visiteur = 1 canal attribué à la conversion**.
Les autres canaux reçoivent **les signaux d'audience** (page_view, view_item)
mais **pas la conversion**.

Le visiteur "direct" (sans gclid/fbclid/…) est traité comme un fallback :
- soit attribué au **dernier canal payant connu** dans sa session/historique
  (stratégie par défaut `last_paid_touch`)
- soit attribué à **aucun canal** → tous les pixels reçoivent la conversion
  (stratégie `broadcast`, déconseillée mais disponible)

Voir [03-architecture.md](./03-architecture.md) pour le détail.
