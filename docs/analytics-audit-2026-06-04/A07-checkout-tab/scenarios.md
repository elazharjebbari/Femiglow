# Scénarios A07 — Onglet Checkout

Persona : **Karim**, opérateur FemiGlow, veut comprendre pourquoi peu de clientes finalisent le tunnel COD.
Horloge figée `NOW = 2026-06-03T12:00:00Z`. Les `begin_checkout` « anciens » sont à `NOW − 2 h` (fenêtre
d'abandon de 60 min écoulée). Les fixtures filtrent en période custom couvrant la plage.

## Scénario A07-S1 — L'étape Adresse paraît morte (reproduction, rouge avant fix)
Contexte: le wizard émet `address_completed` (15 en base), mais `classifyEvent` n'attend que
`add_shipping_info` (4 en base).
Étant donné un `memoryStore` semé avec `prod_realistic` (15 `address_completed` + 4 `add_shipping_info`)
Quand Karim ouvre l'onglet « Checkout »
Alors l'étape « Add Shipping » affiche 4 sessions au lieu de 19
Et il conclut à tort que presque personne ne renseigne son adresse
Et [SPEC après-fix] `address_completed` est mappé sur `add_shipping` → l'étape affiche 19.

## Scénario A07-S2 — La première barre du funnel est vide (reproduction)
Contexte: aucun `view_cart` n'est émis par l'app.
Étant donné `prod_realistic` (view_cart=0, begin_checkout>0)
Quand Karim regarde le funnel
Alors l'étape « View Cart » affiche 0 et la progression de « Begin Checkout » est `null` (prev=0)
Et la lecture du funnel est trompeuse (1ère étape à zéro alors que le tunnel tourne)
Et [SPEC après-fix] soit `view_cart` est émis (page panier au mount) et l'étape se remplit, soit l'UI
explique que l'entrée se fait directement en `begin_checkout`.

## Scénario A07-S3 — 84 abandons invisibles deviennent visibles (reproduction → spécification)
Contexte: 97 `begin_checkout` anciens, 13 `purchase`.
Étant donné `prod_realistic` avec 84 sessions `begin_checkout` à `NOW − 2 h` sans purchase et 13 converties
Quand `getCheckoutData` est appelé
Alors `totals.abandons` reflète les begin_checkout non convertis dont la fenêtre 60 min est écoulée (84)
Et l'opérateur peut chiffrer la perte
Et [edge] une session `begin_checkout` à `NOW − 10 min` sans purchase n'est PAS comptée abandon (fenêtre
non écoulée).

## Scénario A07-S4 — Submit n'est qu'un double de Purchase (reproduction)
Contexte: aucun event `checkout_submit`/`submit` n'est émis ; le code pose `submit=true` à l'arrivée du
`purchase`.
Étant donné `prod_realistic` (begin_checkout + purchase, sans submit)
Quand Karim compare les étapes « Submit » et « Achat »
Alors elles affichent exactement le même nombre de sessions (submit recopie purchase)
Et il ne peut pas mesurer le décrochage entre soumission du formulaire et confirmation
Et [SPEC après-fix] un vrai `checkout_submit` est émis → « Submit » (5) > « Achat » (3), le drop devient
mesurable.

## Scénario A07-S5 — Time-to-submit exploitable (spécification + edges)
Contexte: 3 sessions converties à +120 s, +300 s, +600 s après `begin_checkout`.
Étant donné `tts_sample`
Quand `getCheckoutData` est appelé
Alors l'histogramme est rempli, `p50` est un nombre (≈ 300 s), `sampleSize === 3`
Et [edge bot] une conversion à +0,5 s est exclue (`MIN_TTS_SECONDS`) → `sampleSize === 0` sur `tts_bot`
Et [edge outlier] une conversion à +45 min est plafonnée à 30 min (`MAX_TTS_SECONDS`).

## Scénario A07-S6 — Le consentement est respecté (edge, contraste avec overview)
Contexte: un `begin_checkout` consenti + un `begin_checkout` `denied`.
Étant donné `mixed_consent`
Quand `getCheckoutData` est appelé
Alors `totals.beginCheckout === 1` (la session `denied` est exclue), contrairement à l'onglet Vue
d'ensemble qui la compterait (AN-07/A01).
