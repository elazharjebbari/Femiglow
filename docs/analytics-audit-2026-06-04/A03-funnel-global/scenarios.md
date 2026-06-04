# Scénarios — A03 Funnel global

Persona opérateur : **Karim** (regarde l'entonnoir et ne comprend pas pourquoi tout s'arrête à « View »).
Persona QA : **Sara** (sème un dataset calqué sur la prod et observe les compteurs).

## Scénario A03-S1 — L'entonnoir s'effondre après « View » (reproduction AN-02, GREEN now)
Contexte: en prod, les sessions émettent `view_item`, `begin_checkout`, `purchase` mais **aucun** event
d'engagement (`scroll_depth_50`/`cta_impression`/`video_user_play` = 0 en base).
Étant donné une session A avec `view_item` + `begin_checkout` + `purchase` (sans event engage)
Et que `aggregateSessions` pose `A.view=true, A.engage=false, A.cta=false, A.checkout=true, A.purchase=true`
Et que le cumul strict calcule `reached.engage = A.view && A.engage = true && false = false` (funnel.ts L188)
Quand Karim ouvre l'onglet Funnel
Alors il voit `view = 1` mais `engage = cta = checkout = purchase = 0`
Et le `begin_checkout` (DB=97) comme le `purchase` (DB=13) **n'apparaissent nulle part**, bloqués par le
`&&` amont — alors qu'ils sont bien classés par `classifyStage`.

## Scénario A03-S2 — Le panier ne fait pas avancer non plus (edge)
Contexte: certaines sessions n'ont que `view_item` + `add_to_cart`.
Étant donné une session B avec `view_item` + `add_to_cart`
Et que `reached.cta = view && engage && cta` exige `engage`, lui-même `false`
Quand Karim regarde l'étape CTA
Alors `cta = 0`, bien que l'intention d'achat (`add_to_cart`, DB=26) soit réelle.

## Scénario A03-S3 — Les conversions lead sont invisibles (edge AN-06)
Contexte: tunnel COD — la conversion utile est souvent un `generate_lead` (DB=17), pas un `purchase`.
Étant donné une session C avec `view_item` + `generate_lead`
Et que `classifyStage` ne mappe `generate_lead` vers aucune étape
Quand Karim compte ses conversions
Alors l'étape `purchase` ignore complètement les 17 `generate_lead` → conversion sous-comptée.

## Scénario A03-S4 — Après le fix, l'entonnoir reflète la réalité (spécification, RED→GREEN)
Contexte: fix AN-02 (étape par max-rank/OR) + AN-06 (purchase = purchase OR generate_lead).
Étant donné le dataset prod-like (A: view+begin_checkout+purchase ; B: view+generate_lead)
Quand Karim rouvre l'onglet Funnel
Alors `view ≥ engage ≥ cta ≥ checkout ≥ purchase` (monotone)
Et `checkout = 1` (begin_checkout de A reconnu sans exiger engage)
Et `purchase = 2` (purchase de A **OU** generate_lead de B)
Et le drop-off devient interprétable (cf. A04).
