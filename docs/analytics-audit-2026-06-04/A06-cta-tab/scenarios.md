# Scénarios — A06 Onglet CTA

Persona opérateur : **Karim** (veut savoir quel bouton « Commander » convertit).
Persona QA : **Sara** (sème un dataset prod-like et observe l'onglet CTA).

## Scénario A06-S1 — L'onglet CTA est entièrement vide (reproduction AN-03, GREEN now)
Contexte: en prod, les boutons émettent `pack_cta_click` (rejeté à l'ingestion, cf. A00) ; `cta_click`
et `cta_impression` ont **0** event en base.
Étant donné un dataset réaliste : session A avec `view_item` + `begin_checkout` + `purchase { value: 320 }`,
mais **aucun** `cta_click` ni `cta_impression`
Et que `getCtaData` n'incrémente `impressions`/`clicks` que sur ces deux noms (cta.ts L127-128)
Et que `attributePurchases` n'indexe que les `cta_click` (L277) — donc index vide
Quand Karim ouvre l'onglet CTA
Alors `totals.impressions = 0`, `totals.clicks = 0`, `totals.revenueAttributedCents = 0`,
`conversionRate = null`
Et `rows`, `topMessages`, `topPages` sont **vides** (filtre `>0`, L143/L185/L218)
Et le `purchase` réel (DB en compte 13) n'est attribué à aucun CTA.

## Scénario A06-S2 — Le revenu, lui, est dans la bonne unité (non-régression AN-08)
Contexte: AN-08 (revenu ÷100) était un finding 2026-05-30 ; `readValueCents` multiplie désormais par 100 (L549).
Étant donné un composant `c1` avec un `cta_click` puis un `purchase { value: 320 }` dans la même session
Quand `getCtaData` attribue l'achat à `c1`
Alors `c1.revenueAttributedCents = 32000` (320 MAD exprimés en cents) — **pas** `3` ni `32 000 000`
Et un `purchase { amount_cents: 32000 }` reste `32000` (déjà en cents, non remultiplié).
Note QA : tout résidu ÷100 serait désormais en couche d'**affichage** (format MAD), pas dans `cta.ts`.

## Scénario A06-S3 — Après le fix taxonomie, l'attribution last-click fonctionne (spécification, RED→GREEN)
Contexte: fix AN-03 — `cta_click`/`cta_impression` schématisés et émis (ou `pack_cta_click` normalisé).
Étant donné `c1` (clic 10:01) puis `c2` (clic 10:05), puis un `purchase { value: 320 }` à 10:10 (même session)
Quand `getCtaData` applique le last-click
Alors l'achat est attribué à **c2** (dernier clic avant l'achat), `c1.purchasesAttributed = 0`
Et `c2.revenueAttributedCents = 32000`
Et `totals.impressions`/`totals.clicks` reflètent enfin les events réels.

## Scénario A06-S4 — Fallback 7 jours et sa borne (spécification edge)
Contexte: parcours multi-sessions COD.
Étant donné un `cta_click` sur `c1` 3 jours avant un `purchase` (même `anonymous_id`, autre session, sans clic intra-session)
Quand l'attribution échoue en session puis tente le fallback (L298-305)
Alors l'achat est attribué à `c1` (dans la fenêtre 7j)
Mais si le clic datait de **8 jours**, `lastBefore(…, ts - ATTRIBUTION_WINDOW_MS)` l'exclut ⇒ aucune attribution.
