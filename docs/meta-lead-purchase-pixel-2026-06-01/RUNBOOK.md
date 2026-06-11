# Runbook — Lead → Meta Purchase **pixel + CAPI** dédupliqué (parcours unique)

Date : 2026-06-01. Suite de `docs/meta-lead-as-purchase-2026-06-01`.

## Besoin (verrouillé avec le client)
Sur `/kit`, les events **`lead_capture` & `generate_lead`** doivent faire fire la
balise **Purchase** Meta (avec value/currency), **en pixel ET en CAPI**, et il
ne doit JAMAIS y avoir de doublon, sur ces séquences :
- **S1** (wizard) : `lead_capture` + `generate_lead` (étape 1) → `purchase` (étape 2) ⇒ **1 Purchase**.
- **S2** (chat→commande) : `generate_lead` (chat) → plus tard `lead_capture`+`generate_lead`+`purchase` (wizard, même visiteur) ⇒ **1 Purchase**.
- Garder le pixel **Lead** pour les campagnes Lead (Lead + Purchase pour un lead éligible).
- Newsletter/contact : **jamais** Purchase.

## Principe robuste : un `event_id` de PARCOURS partagé (jpid)
Tous les signaux Purchase d'un même visiteur (lead_capture, generate_lead, et même
le purchase) portent **le même `eventID`** ⇒ Meta **déduplique nativement** (Pixel↔Pixel,
Pixel↔CAPI) ⇒ **1 seul Purchase**.

- **Source de vérité = cookie `fg_meta_lead_purchase`** : à la 1ʳᵉ émission Purchase-éligible,
  le client génère un `uuidv7` (le **jpid**) et le stocke en cookie (TTL 24 h **glissant**
  depuis le 1ᵉʳ contact — donc robuste à cheval sur minuit, contrairement à un bucket fixe).
  Tous les events suivants RÉUTILISENT ce jpid.
- Le jpid est : (a) poussé en dataLayer `params.meta_purchase_eid` (→ pixel `eventID`),
  (b) envoyé à `/api/track` (→ CAPI `event_id`).
- **Défense en profondeur conservée** : le cookie (non vide) bloque toujours le pixel
  Purchase du **vrai achat** (trigger `BLK`) et le ledger supprime sa CAPI → l'achat réel
  ne ré-ajoute rien après un lead. La dédup native jpid couvre en plus les multi-signaux lead.

## Matrice de dédup (cible)
| Séquence | Pixels Purchase | CAPI Purchase | Compté Meta |
|---|---|---|---|
| S1 wizard | lead_capture(jpid)+generate_lead(jpid) ; purchase **bloqué** | generate_lead(jpid) ; purchase **supprimé** | **1** |
| S2 chat→commande | chat gl(jpid) + wizard lc/gl(jpid même cookie) ; purchase bloqué | gl(jpid) (chat & wizard, dédupés) ; purchase supprimé | **1** |
| Achat direct (sans lead) | purchase(event_id client) | purchase(event_id client, Fix A) | **1** |
| Newsletter | — (pas de tag Purchase) | Lead | 0 Purchase |

## Plan d'action (phases)
- **P1 — Client jpid** : `journey-purchase-id.ts` (`getJourneyPurchaseId()` : lit/crée le cookie,
  retourne le jpid). Brancher chat (`LeadFormBubble`) + wizard (`CheckoutFlow`) : passer
  `meta_purchase_eid` dans les params de `generate_lead`/`lead_capture`.
- **P2 — Schemas** : autoriser `meta_purchase_eid` (string) dans generate_lead + lead_capture.
- **P3 — DataLayer** : `DATALAYER_PATHS.metaPurchaseEid='params.meta_purchase_eid'`, `.method='params.method'`.
- **P4 — Exporter** : variables `{{DLV - meta_purchase_eid}}` + `{{DLV - method}}` ; tags pixel
  **Purchase** sur `generate_lead` (filtre method ∈ {chat,abandoned_cart}) et `lead_capture`
  (method=wizard), `eventID={{DLV - meta_purchase_eid}}`, value/currency, **broadcast**.
- **P5 — Dispatcher** : `as_purchase` → `eventID = params.meta_purchase_eid` si présent (sinon journeyId).
- **P6 — Tests** : Vitest (dispatcher), MSW (séquences S1/S2 via /api/track), Playwright (pixels
  multi-signaux partagent l'eventID → dédup ; vrai achat bloqué), + exporter tests MAJ.
- **P7 — Build + re-export + restart + validation** ; runbook log ci-dessous.

## Rollback
- Flags `META_LEAD_AS_PURCHASE_ENABLED` / `NEXT_PUBLIC_*` → `false` → build → restart.
- Ré-importer le conteneur GTM précédent (backup étape 0).

## Journal d'exécution (2026-06-01)
- **P1** ✅ `lead-purchase-cookie.ts` → `getJourneyPurchaseId()` (cookie = jpid uuid, 24 h
  glissant) + `readJourneyPurchaseId()` (lecture seule, achat). Chat (`LeadFormBubble`) +
  wizard (`CheckoutFlow`) : `meta_purchase_eid` porté sur generate_lead/lead_capture, et
  sur `purchase` UNIQUEMENT si un lead a précédé (robustesse ledger).
- **P2** ✅ schemas : `meta_purchase_eid` autorisé sur generate_lead, lead_capture, purchase.
- **P3** ✅ `DATALAYER_PATHS.metaPurchaseEid` + `.method`.
- **P4** ✅ exporter : variables `{{DLV - meta_purchase_eid}}` + `{{DLV - method}}` ; tags pixel
  Purchase sur generate_lead (`^(chat|abandoned_cart)$`) + lead_capture (`^(wizard)$`),
  `eventID={{DLV - meta_purchase_eid}}`, value/currency, broadcast. (+2 tags → 106 total.)
- **P5** ✅ dispatcher : `as_purchase` → `eventID = meta_purchase_eid` (fallback journeyId) ;
  `purchase` passthrough avec jpid (lead précédent, ledger perdu) → `eventID = meta_purchase_eid`.
- **P6** ✅ tests : Vitest **1320** verts (exporter +4, cookie +4, intégration MSW +5 dont S2 &
  ledger-loss & achat direct, contract DLV) ; **Playwright pixel 8/8** (multi-signaux S1/S2 →
  1 eventID, filtre newsletter, blocage achat réel). typecheck 0.
- **P7** ⏳ build + re-export (`container.production.lead-purchase-bridge.json`, 106 tags) + restart.
