# Audit — Pipeline tracking « valeur → fournisseurs publicitaires »

> Date : 2026-05-31 · Périmètre : `apps/web/src/lib/tracking/**` + émission events
> (`components/**`) + routes d'export GTM. Déclencheur : ROAS Meta/Google
> incohérent, balise de linkage, events manquants à l'export, conversion chat.
>
> **Statut : AUDIT — exécution en attente de feu vert** (option « dossier d'abord »).

## 1. Objectif

Tracer de bout en bout la **valeur de conversion** (`value`/`currency`) depuis
l'émission client jusqu'aux pixels/CAPI (Meta, Google Ads, GA4, TikTok, Snap,
Pinterest), identifier pourquoi le ROAS observé est faux, et fiabiliser la
**génération du container GTM**.

## 2. Décisions (validées avec le PO)

- **Exporter canonique = `plan/exporter.ts`** (`exportPlan`, route
  `POST /api/admin/tracking/plans/[id]/export`). On corrige celui-ci, on y
  branche le drift-detector, et on marque/retire les deux autres générateurs.
- Livrable : ce dossier d'audit **avant** toute modification de code.

## 3. Cartographie du pipeline

```
emit(event, params)                      ← components (CheckoutFlow, LeadFormBubble, …)
  └─ TrackingClient.emit  (client.ts)
       ├─ getDataLayer().push(entry)      → window.dataLayer  → tags GTM client (gaawe/awct/html)
       └─ POST /api/track (batch)         → dispatchToProviders → CAPI serveur (meta/google/tiktok/snap)
```

**Schéma réel de l'entry dataLayer** (`datalayer.ts` + `client.ts:154-180`) :

```jsonc
{
  "event": "purchase",
  "event_id": "…",          // top-level
  "page": { … }, "user": { … }, "consent": { … },
  "user_data": { sha256_… }, // advanced matching / enhanced conversions
  "attribution": { channel, is_paid, … },
  "params": {                // ⚠️ value/currency/items/transaction_id VIVENT ICI
    "value": 199, "currency": "MAD", "transaction_id": "…", "items": [ … ]
  }
}
```

> ❗ Aucun bloc `ecommerce` n'est jamais poussé (vérifié). Toute variable GTM
> lisant `ecommerce.*` résout à `undefined`. La bonne racine est `params.*`.

## 4. Les 3 générateurs de container (problème de fond)

| Module | Câblé sur | Verdict |
|---|---|---|
| `plan/exporter.ts` | `POST /plans/[id]/export` | **Canonique** — à corriger |
| `mappings/gtm-export.ts` | `POST /mappings/[id]/export-gtm` (`MappingExportButton`) | Cassé (F4) → legacy |
| `gtm/builders.ts` | aucune route, mais **drift-detector** (`snapshot.ts:17`) | Incomplet → legacy |

Conséquence : le **drift** est calculé contre un container que personne
n'exporte. À reconverger sur l'exporter canonique.

## 4bis. État d'exécution (2026-05-31)

Branche `fix/tracking-value-2026-05`. TDD, suite tracking **78 fichiers / 1248
tests verts**.

| Finding | État | Note |
|---|---|---|
| T-01 | ✅ Fait | DLV → `params.*` + constante `datalayer-paths.ts` + test contractuel |
| T-02 | ✅ Fait | `gaawe` `eventSettingsTable` value/currency/transaction_id (events monétaires) |
| T-03 | ✅ Fait | Meta `custom_data` value/currency (purchase, generate_lead, lead_capture) |
| T-06 | ✅ Fait | `getKitLeadValue()` (prix kit promo) → route lead chat → `LeadFormBubble` |
| T-07 | ✅ Fait | `googleAdapter.supports` = events server-scope only (GA4 client-only) |
| T-05 | 🔁 Re-scopé | Pinterest = **CAPI-only par design v2** (hors `PROVIDER_IDS`), pas un bug. Le ré-ajouter au container = **feature** (schéma+UI+DB) → décision PO |
| T-04 | 🟡 Partiel | `buildGtmContainer` marqué `@deprecated`. Retrait route/UI = follow-up |
| T-09 | 🟡 Partiel | `gtm/builders.ts` marqué `@deprecated`. Rebranche drift→`exportPlan` = follow-up (refactor non trivial) |

**Follow-ups documentés** (non faits, à valider séparément car risque drift/UI) :
rebrancher `gtm/snapshot.ts` sur `exportPlan`, retirer la route `export-gtm` +
`MappingExportButton`, supprimer `gtm/builders.ts`.

## 5. Synthèse des findings

| ID | Sev | Titre | Impact ROAS |
|----|-----|-------|-------------|
| **T-01** | P0 | DLV `ecommerce.*` au lieu de `params.*` (awct) | Google Ads : value/currency/orderId vides → ROAS faux **+ doublons** |
| **T-02** | P0 | Tag GA4 `gaawe` sans value/currency/items | Revenu GA4 = 0 |
| **T-03** | P0 | Pixel Meta `custom_data = {}` (pas de value) | Purchase/Lead Meta sans valeur côté pixel |
| **T-04** | P1 | Exporter `mappings` : pas de linker + awct invalide | Si utilisé : Google Ads ne compte rien correctement |
| **T-05** | P1 | Pinterest absent du plan exporter | Events Pinterest jamais générés |
| **T-06** | P1 | `generate_lead` chat sans `value` | Leads chat valorisés à 0 ; `currency` orphelin |
| **T-07** | P2 | Double-fire GA4 (client `gaawe` + serveur MP) | Sur-comptage GA4 possible (pas de dedup natif) |
| **T-08** | P2 | DLV mal pathés dans l'exporter `mappings` | idem T-01 sur le chemin legacy |
| **T-09** | P2 | 3 exporters divergents + drift sur builders.ts | Drift non fiable, dette de maintenance |

Détail complet (preuve `file:line`, cause racine, correctif, test) :
[`00-audit/findings-detail.md`](00-audit/findings-detail.md) ·
registre machine : [`00-audit/findings-register.csv`](00-audit/findings-register.csv).

Plan d'exécution TDD : [`20-plan-action.md`](20-plan-action.md) ·
Runbook (code + validation GTM/Tag Assistant) : [`30-runbook.md`](30-runbook.md).

## 6. Décisions (tranchées avec le PO — 2026-05-31)

- **T-06 — valeur du lead chat = prix du kit AVEC la promotion.**
  Source serveur-authoritative : prix public effectif du kit
  `effectiveCents = promoPriceCents ?? priceCents` (`products/public.ts:52-64`),
  exposé en `value = effectiveCents / 100` + `currency` produit (MAD).
  Câblage : `/api/chat/lead/contact/route.ts` (réponse `{ ok, leadId,
  outcomeMessage }` L247-250) renvoie aussi `{ value, currency }` → `LeadFormBubble`
  émet `generate_lead` avec. Pas de duplication de prix côté client.
- **T-07 — GA4 = client GTM uniquement.** Le dispatch serveur GA4 MP
  (`googleAdapter`) est réservé aux events **server-scope** (`purchase_server`).
  Garde-fou : `googleAdapter.supports` ne route pas les events déjà couverts par
  le tag `gaawe` client → supprime le double-comptage.
