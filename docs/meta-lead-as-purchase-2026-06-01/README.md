# Lead → Meta Purchase (sans doublon) — analyse + plan (2026-06-01)

## Objectif métier
Compter les **leads chat** + **leads panier abandonné (wizard étape 1)** dans les
campagnes Meta optimisées sur **Purchase**. Confusion VOLONTAIRE `generate_lead`→`Purchase`
côté Meta, MAIS **jamais de doublon** : si un vrai `purchase` suit (dernière étape),
il ne doit pas ajouter un 2e Purchase Meta pour le même parcours.

Côté GA4/analytics : **aucune confusion** — `generate_lead` et `purchase` restent distincts
(sinon le revenu réel serait faussé).

## Dissection du système actuel

### Émission (client)
| Source | Event émis | value | Fichier |
|--------|-----------|-------|---------|
| Lead chat | `generate_lead` (`method:'chat'`, `lead_id`, value=prix kit) | ✓ | `components/chat/LeadFormBubble.tsx:258` |
| Panier abandonné (wizard étape 1) | `lead_capture` + `generate_lead` (value=total panier) | ✓ | `components/commerce/CheckoutFlow.tsx:317,329` |
| Contact / Newsletter | `generate_lead` | — | `components/forms/*` |
| Achat (dernière étape) | `purchase` (value, transaction_id) | ✓ | `CheckoutFlow` |

### Mapping (event-mapping.ts)
- `generate_lead.meta = 'Lead'`, `purchase.meta = 'Purchase'`.
- ⇒ Aujourd'hui les leads NE comptent PAS comme Purchase → stats biaisées (le but n'est pas atteint).
- ⚠️ `generate_lead` est partagé (chat + panier + contact + newsletter) → un remap GLOBAL
  `generate_lead.meta='Purchase'` compterait aussi les newsletters comme achats. **À proscrire.**

### Dédup (event-id.ts + server/dedup.ts)
- `deriveEventId(eventName, sessionId, pageId, bucket5min)` → dédup Pixel↔CAPI du **même** event.
- `eventName` est dans le hash ⇒ `generate_lead` et `purchase` ⇒ **event_id différents** ⇒
  Meta les compte **séparément**. C'est exactement la cause du futur doublon une fois la
  confusion activée.
- `server/dedup.ts` : ledger TTL (mémoire/Redis) clé=event_id, TTL 60 s → trop court et
  mauvaise clé pour dédupliquer un parcours lead→achat (peut s'étaler sur plusieurs minutes).

## Conception cible (robuste / paramétrable / modulable / déboggable)

### Principe : un event canonique dédié + un event_id de PARCOURS partagé

**1) Mapping ciblé (maintenable, évolutif) — Layer « sémantique »**
Introduire un event canonique dédié **`lead_purchase_proxy`** (nom indicatif), émis
UNIQUEMENT par le lead chat + le lead panier-abandonné (pas Contact/Newsletter). Mapping :
```
lead_purchase_proxy:
  meta:        { name: 'Purchase' }   ← compte dans les campagnes Purchase
  google_ga4:  { name: 'generate_lead' }   ← GA4 reste propre (pas de revenu fictif)
  google_ads / tiktok / snap: { name: 'Lead'/'SubmitForm'/… }  ← inchangé
```
→ La confusion est **isolée dans UN event nommé** : lisible, testable, réversible, et
n'affecte pas les autres `generate_lead`. (Les sources continuent d'émettre `generate_lead`
pour GA4/Ads ; on émet EN PLUS `lead_purchase_proxy` pour le pont Meta — OU on route via
un flag, cf. §Paramétrable.)

**2) Dédup par event_id de PARCOURS (fiable) — Layer « dédup »**
Nouvelle dérivation **`deriveMetaPurchaseProxyId({ visitorId | cartId | leadId })`** SANS
`eventName` ni bucket 5 min, avec une **fenêtre large paramétrable** (ex. 24 h). Les DEUX
events Meta `Purchase` (le proxy lead ET le vrai purchase) calculent le **même event_id**
→ Meta **déduplique nativement** (Pixel + CAPI) → **1 seul Purchase compté**. Le premier
reçu gagne (= le lead, ce qui est voulu : « le purchase qui suit n'est pas pris en compte »).

**3) Garde-fou serveur (déboggable, déterministe) — Layer « ledger »**
En complément (au cas où la fenêtre Meta est dépassée), un **ledger de suppression**
(extension de `server/dedup.ts`, clé = `meta_purchase_proxy:<visitorId>`, TTL = fenêtre
paramétrable, Redis en prod) : quand un vrai `purchase` arrive et qu'un `lead_purchase_proxy`
a déjà compté pour ce visiteur dans la fenêtre → on **skip le Purchase Meta** du vrai purchase
(GA4/Ads continuent normalement). Log structuré `meta_purchase_dedup: counted|suppressed:<reason>`.

### Pourquoi 2 couches de dédup ?
- event_id partagé = dédup **native Meta** (idéale, Pixel+CAPI, zéro état serv.) mais bornée à
  la fenêtre Meta.
- ledger serveur = garantie **déterministe + auditable** (logs), borne configurable, gère le
  CAPI-only. Les deux sont **idempotentes** et se renforcent.

## Paramétrable / modulable
- Flag `META_LEAD_AS_PURCHASE_ENABLED` (on/off global, défaut OFF → zéro régression).
- `META_LEAD_PURCHASE_DEDUP_WINDOW_HOURS` (fenêtre parcours, défaut 24).
- Liste des **sources** éligibles (chat, abandoned_cart) configurable (pas Contact/Newsletter).
- Choix de la **clé de parcours** (visitorId par défaut ; cartId/leadId si dispo) centralisé
  dans une seule fonction → 1 point de changement.

## Déboggable
- Chaque décision tracée dans `tracking_events_log.providers_results.meta.note` :
  `lead_as_purchase` / `purchase_suppressed_dedup:<key>` / `purchase_counted`.
- Un endpoint/質 admin (debugger tracking existant) montre, par visiteur, la chaîne
  lead_proxy→purchase et la décision de dédup.

## Plan d'action
| # | Étape | Fichiers |
|---|-------|----------|
| A1 | Event `lead_purchase_proxy` + mapping (meta=Purchase, ga4=generate_lead) derrière flag | `event-mapping.ts`, `event-catalog` |
| A2 | Émettre `lead_purchase_proxy` depuis le lead chat + abandoned-cart (en + de `generate_lead`) | `LeadFormBubble.tsx`, `CheckoutFlow.tsx` |
| A3 | `deriveMetaPurchaseProxyId` (clé parcours, sans eventName/bucket) + l'appliquer aux 2 events Meta Purchase | `event-id.ts`, `server/server-fire.ts`, client emit |
| A4 | Ledger suppression serveur (clé parcours, TTL flag) + skip Purchase Meta du vrai purchase si lead déjà compté | `server/dedup.ts`, `server/dispatcher.ts` |
| A5 | Flags + config (window, sources) | `env.ts`, settings tracking |
| A6 | Logs structurés de décision | dispatcher + events_log |
| A7 | Export GTM : router le proxy → tag Meta Purchase, et le vrai purchase Meta derrière la condition de non-dédup | `plan/exporter.ts` |

## Décisions VERROUILLÉES (2026-06-01)
1. **Valeur comptée = prix du produit /kit** : `promoPriceCents` si défini, sinon
   `priceCents` (devise MAD). Valeur **déterministe**, identique au lead et au purchase.
   ⇒ **Plus besoin de réconciliation différée / cron** : la valeur ne dépend pas de
   « qui gagne la dédup ». On fire le lead-proxy immédiatement et on **supprime** le
   Purchase Meta du vrai purchase qui suit (1 seul Purchase, toujours au prix du kit).
   Source déjà dispo : le serveur valorise déjà `generate_lead` au prix du kit (T-06,
   cf. `LeadFormBubble`). On centralise dans `getKitPurchaseValue()`.
2. **Clé de parcours = `visitorId`** (fenêtre 24 h).
3. **Fenêtre de dédup = 24 h** (paramétrable `META_LEAD_PURCHASE_DEDUP_WINDOW_HOURS`).
4. **GA4 NON conflaté** : `generate_lead` et `purchase` restent distincts, valeurs réelles.

### Design final (simplifié, sans cron)
- Lead chat / panier → `lead_purchase_proxy` → **Meta `Purchase`** (value = prix kit),
  event_id de parcours `purchase-journey:<visitorId>` (24 h), + marque le ledger.
- Vrai `purchase` → **Meta Purchase SUPPRIMÉ** si le ledger a un proxy pour ce visiteur
  dans la fenêtre (sinon fire normal). GA4/Ads inchangés. Même event_id de parcours →
  dédup native Meta en renfort (Pixel ↔ CAPI).
- Flag `META_LEAD_AS_PURCHASE_ENABLED` (défaut OFF). Sources éligibles = {chat, abandoned_cart}.

Voir `TESTS.md` pour la batterie de vérification.
