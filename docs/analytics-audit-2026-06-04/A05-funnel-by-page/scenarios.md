# Scénarios — A05 Funnel par page d'entrée

Persona opérateur : **Karim** (veut savoir quelle landing convertit le mieux).
Persona QA : **Sara**.

## Scénario A05-S1 — Le tableau « par page » n'a que des views (reproduction AN-02, GREEN now)
Contexte: en prod, les sessions entrent par `/kit` (premier event = `view_item` sur `/kit`).
Étant donné une session A `firstPage = /kit` avec `view_item` + `begin_checkout` + `purchase` (sans engage)
Et que `getFunnelByPage` calcule `ctas` et `purchases` avec le **même cumul strict** que le funnel global
(`s.view && s.engage && s.cta …`, funnel.ts L256-257) et que `s.engage = false`
Quand Karim ouvre la table « par page d'entrée »
Alors la ligne `/kit` affiche `views = 1`, `viewToCta = 0`, `ctaToBuy = —` (null), `purchases = 0`
Et c'est le symptôme exact rapporté : « funnel par page vide, sauf views ».

## Scénario A05-S2 — Aucune landing ne montre une conversion (edge)
Contexte: il y a pourtant 13 purchases réels en base.
Étant donné plusieurs sessions `/kit` ayant acheté
Quand Karim trie par `purchases`
Alors toutes les lignes ont `purchases = 0` — impossible de classer les landings par performance d'achat.

## Scénario A05-S3 — Une page sans vue produit disparaît du tableau (edge)
Contexte: une session entre par `/rituel` sans `view_item` (et `/rituel` n'est pas `/kit`).
Étant donné `isViewEvent` ne reconnaît ni `view_item` ni `page_view` sur `/rituel` ⇒ `s.view = false`
Et que `getFunnelByPage` filtre `views > 0` (L262)
Quand Karim cherche `/rituel`
Alors la ligne est **absente** — l'opérateur ne sait pas si la page n'a pas de trafic ou n'est pas instrumentée.

## Scénario A05-S4 — Après le fix, les landings deviennent comparables (spécification, RED→GREEN)
Contexte: fix AN-02 (modèle corrigé, partagé avec A03).
Étant donné le dataset prod-like (sessions `/kit` converties)
Quand Karim rouvre la table « par page »
Alors `/kit` affiche `purchases ≥ 1`, `viewToCta > 0`, `ctaToBuy` exploitable (non null)
Et `Σ rows.purchases === steps.purchase.sessions` (cohérence avec le funnel global)
Et il peut enfin classer ses landing pages par taux de conversion réel.
