# Plan de conception — Roadmap, dépendances, RACI, risques

> Le quoi/quand/qui de la v2. Phasing V5-V7, milestones datées, dépendances entre lots, matrice RACI, registre des risques. Source unique pour pilotage.

## Fichiers de cette section

- [`README.md`](README.md) — ce fichier
- [`phasing-roadmap.md`](phasing-roadmap.md) — vagues V5/V6/V7 détaillées
- [`milestones.csv`](milestones.csv) — liste milestones datés
- [`dependencies.puml`](dependencies.puml) — graphe dépendances entre lots
- [`raci.csv`](raci.csv) — matrice RACI exhaustive
- [`risks.csv`](risks.csv) — registre des risques + mitigations

## Vue d'ensemble — Phasing 3 vagues

```
[V5 - Wave Fondation]    "Le chat marche, est multilingue, basique conversion"
  └─ 2026-05-13 → 2026-06-10   (4 semaines)

[V6 - Wave Conversion]   "Optimisations conversion, tools enrichis, A/B"
  └─ 2026-06-10 → 2026-07-15   (5 semaines)

[V7 - Wave Avancée]      "Order status, promos, B2B avancé, dark mode"
  └─ 2026-07-15 → 2026-09-15   (8 semaines, été)
```

Total : 17 semaines (4 mois).

## Charge globale estimée

| Profil | V5 | V6 | V7 | Total |
|---|---|---|---|---|
| Dev senior (lead) | 80 h | 100 h | 120 h | 300 h |
| Dev intermédiaire | 60 h | 80 h | 100 h | 240 h |
| Designer UI/UX | 40 h | 30 h | 30 h | 100 h |
| Content (Yasmine) | 30 h | 20 h | 20 h | 70 h |
| Care (Karim) | 10 h | 15 h | 15 h | 40 h |
| PO (Selma) | 20 h | 25 h | 25 h | 70 h |
| **Total** | **240 h** | **270 h** | **310 h** | **820 h** |

## Hypothèses de planification

- 1 dev senior + 1 dev intermédiaire, full-stack TS/Next.js.
- Designer disponible 50% sur les 2 premières semaines de V5.
- Pas de chômage / congé bloquant prévu (à valider PO).
- Pas de dépendance externe critique (LLM providers déjà intégrés).
- Repository déjà setup avec CI Vercel, Sentry, Drizzle, etc.

## Critères de succès V5 (ship Wave 1)

1. [ ] 100% des paths critiques user-journey couverts (greeting, suggestion, message, lead).
2. [ ] Conversion rate baseline mesurée pendant ≥ 14 jours (= NS objectif 0.3% atteint ou plan B).
3. [ ] Service level 0/1 sur ≥ 95% du temps.
4. [ ] Admin permet édition canned + FAQ + intents sans intervention dev.
5. [ ] Test suite (unit + integration + E2E + ULTIMATE) verte sur CI.
6. [ ] Documentation runbook complet.

## Ce que V5 N'INCLUT PAS (downscope intentionnel)

- ❌ `get_order_status` (V7 quand tracking Sendit OK).
- ❌ `check_promo` (V7 quand promo engine refactor).
- ❌ Mode anonyme RGPD avancé (V6).
- ❌ Dark mode (V7).
- ❌ Multi-channel (WhatsApp, Messenger) (V7+).
- ❌ Audio TTS/STT (futur, hors roadmap).

Ces features sont **valides** mais hors scope V5 pour atteindre une date crédible.
