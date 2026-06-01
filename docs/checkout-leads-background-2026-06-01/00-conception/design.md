# 00 — Plan de conception

## 1. Contexte & problème

Le funnel principal (wizard checkout) gèle l'UI à chaque étape : `use-wizard-mutations.ts`
fait `await wizardClient.<mutation>()` **puis** `goToStep()`. L'utilisateur subit
donc **1 RTT réseau complet par étape** vers une origine LiteSpeed **mono-région, sans
CDN**, souvent sur **mobile/Maroc**. Trois étapes = trois gels → friction →
**paniers abandonnés**.

Diagnostic détaillé : voir l'audit amont (conversation) et [`../02-data-flow/flows.md`](../02-data-flow/flows.md).
Le travail serveur par étape est **léger** (2–4 requêtes Prisma + idempotence,
aucun webhook/email par étape). **La latence est structurelle (réseau + gating UI),
pas algorithmique.**

## 2. Objectifs (Goals)

- **G1** — L'avancement entre étapes est **perçu comme instantané** (p95 du temps « clic → étape suivante visible » < 50 ms, indépendant du réseau).
- **G2** — **Zéro perte** de donnée lead validée (y compris fermeture d'onglet en plein vol).
- **G3** — **Idempotence** totale : N rejeux ⇒ 1 effet.
- **G4** — **Préserver** la détection d'abandon + l'analytics de funnel (rows partielles).
- **G5** — Conversion (commande) **fiable** et indépendante des écritures de fond.
- **G6** — Effets de bord lourds (tracking serveur, webhook) **durables** (retry, survie au restart).
- **G7** — Déploiement **réversible** (flag + kill-switch), **observable**, **testable**.

## 3. Non-objectifs (Non-Goals)

- N1 — Mise en place d'un CDN externe (refusé : tout reste sur le serveur).
- N2 — Réécriture du moteur de tracking ou du système de webhook (on les **réutilise**).
- N3 — Support offline complet (PWA/Background Sync) — repoussé (cf. ADR-0005, option future).
- N4 — Refonte de l'UI/UX visuelle du wizard (on ne touche qu'au *timing* de transition).

## 4. Principes directeurs

1. **Optimiste par défaut, durable en dessous.** L'UI fait confiance ; la durabilité est garantie par la file client + l'idempotence serveur + l'outbox.
2. **Réutiliser l'existant** : `Idempotency-Key`, `createId`, `wizard-store`, blueprint `email_outbox`, dispatcher webhook. Aucune nouvelle dépendance runtime.
3. **Séparation stricte des responsabilités** : *transition UI* ≠ *persistance* ≠ *effets de bord*. Chaque couche testable isolément.
4. **Le réseau est faillible** : tout chemin réseau a un retry, un backoff, et un flush de secours.
5. **Sans surprise** : le serveur reste autoritaire ; le client ne « décide » jamais d'un état métier irréversible (la conversion reste serveur).
6. **Feature-flaggé** : le legacy (await bloquant) reste le fallback exact tant que le flag est OFF.

## 5. Exigences non-fonctionnelles (résumé, détail en `requirements.md`)

| NFR | Cible |
|---|---|
| Latence transition UI (p95) | < 50 ms |
| Perte de lead validé | 0 (garantie beacon + idempotence) |
| Disponibilité capture lead | ≥ 99.9 % (file résiliente, l'origine peut être lente) |
| Délai max persistance background (p95) | < 5 s en conditions normales |
| Délai max effet outbox (webhook/tracking) | < 90 s (worker cron 60 s + 1 cycle) |
| Couverture tests unités (mutations/queue/repo) | ≥ 90 % lignes |
| Réversibilité | kill-switch < 1 min (flag OFF, sans redeploy) |

## 6. Vue d'ensemble de la solution

Trois couches, faiblement couplées :

```
┌────────────────────────── CLIENT (navigateur) ──────────────────────────┐
│  wizard-store  ──(optimistic goToStep)──►  UI avance immédiatement        │
│       │                                                                   │
│       └─ enqueue(envelope) ─► lead-sync-queue ─┬─ fetch keepalive (live)  │
│                                                └─ sendBeacon (pagehide)   │
└───────────────────────────────────┬───────────────────────────────────--┘
                                     │ HTTP (idempotent)
┌───────────────────────────────────▼──────────────────── SERVEUR ─────────┐
│  /api/checkout/lead[...]  +  /api/checkout/lead/sync (batch)              │
│       │ upsert-by-leadId (idempotent)                                     │
│       ├─► chat_lead  (rows partielles → scanner abandon + funnel)         │
│       └─► lead_event_outbox  (effets durables: tracking serveur, webhook) │
│                    ▲                                                       │
│   /api/cron/lead-outbox  ──(FOR UPDATE SKIP LOCKED, retry/backoff)──┘     │
└───────────────────────────────────────────────────────────────────────--┘
```

Décisions structurantes : voir les **ADR** ([`decisions/`](decisions/)).
Architecture détaillée (modules, interfaces, erreurs, observabilité) : [`../01-architecture/architecture.md`](../01-architecture/architecture.md).

## 7. Alternatives écartées (synthèse)

| Alternative | Raison du rejet | Réf |
|---|---|---|
| Persist différé unique (tout client, écriture à la fin) | Casse le scanner d'abandon + perte d'analytics par étape | ADR-0001 |
| `after()` / `waitUntil` seul | N'adresse ni le gating UI ni la durabilité (in-process, perdu au restart) | ADR-0004 |
| File durable client (IndexedDB + Background Sync) | Sur-ingénierie ; Chromium-only ; reportée | ADR-0005 |
| File externe (BullMQ/Redis) | Nouvelle dépendance infra ; l'outbox DB+cron suffit et existe déjà | ADR-0004 |
