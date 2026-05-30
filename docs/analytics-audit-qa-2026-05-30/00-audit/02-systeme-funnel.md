# 02 — Système Funnel (`/admin/analytics/funnel`)

Fichiers : `lib/analytics/queries/funnel.ts` (485) · `app/api/admin/analytics/funnel/route.ts` +
`/sankey` · `components/admin/analytics/funnel/{FunnelDashboard,FunnelGlobal,FunnelDropOff,
FunnelByPageSankey,FunnelDataTable}.tsx`.

## 1. Ce que l'onglet doit faire (fonctionnement optimal)

Visualiser le parcours visiteur en **5 étapes session-level** :
`View → Engage → CTA → Checkout → Purchase`, avec pour chaque étape le **nombre de sessions**, la
**progression** depuis l'étape précédente, le **drop-off** vers la suivante, et la **médiane du
temps** jusqu'à l'étape suivante. Plus : une **table « par page d'entrée »** (views, view→cta,
cta→buy, purchases) et un **Sankey** first_page → étape max atteinte (top 20 + « Autres »).

Classification des étapes (`classifyStage`, `funnel.ts:137`) :
| Étape | Events déclencheurs |
|---|---|
| view | `view_item` ; `page_view` sur `/kit` ou `/kit/*` |
| engage | `scroll_depth_50`, `video_user_play`, `cta_impression` |
| cta | `add_to_cart` ; `cta_click` avec `payload.cta_intent='purchase'` |
| checkout | `begin_checkout` |
| purchase | `purchase` |

## 2. Justesse — analyse

✅ **Robuste aux doublons et à l'ordre** : flags OR par session, médianes calculées sur le 1er
timestamp de chaque étape (`stageFirstTs`). `time-to-next` ne compte que si `tb ≥ ta`.

✅ **Cumul strict cohérent en interne** : `reached[purchase] = view∧engage∧cta∧checkout∧purchase`
(`funnel.ts:181`). Garantit `step_n ≤ step_(n-1)` → drop-off toujours dans `[0,1]`.

⚠️ **AF-03 (incohérence inter-onglets)** : ce cumul strict **diffère** du Checkout (non-cumulatif).
Un opérateur qui compare « Purchase » du Funnel et « Purchase » du Checkout verra des **nombres
différents** pour la même réalité (le Funnel exige la chaîne complète, le Checkout non).

⚠️ **F-FUN-02 (sous-comptage purchase)** : une session qui achète mais dont les events
`engage`/`cta` n'ont pas été tracés (ad-blocker, consent partiel, event manquant) **ne compte pas**
en Purchase du Funnel (rompt la chaîne). Le Funnel mesure donc « parcours complet observé », pas
« achats réels ». À documenter dans l'UI (sinon écart inexpliqué avec les commandes réelles).

⚠️ **F-FUN-03 (first_page = page du 1er event tracké)** : si le 1er event d'une session est un
event non-page (`scroll_depth_50` sans `page_view` préalable), `firstPage` prend le `pageRoute` de
cet event. Généralement cohérent, mais sensible à l'ordre d'émission côté client.

⚠️ **AF-04 (fuseau horaire)** : périodes `today`/`yesterday` calées sur l'UTC serveur (cf.
`06-transverse`). Impacte le rattachement des sessions aux jours.

## 3. Réactivité & UI

🔴 **AF-01** : `FunnelDashboard.tsx:47` fige `useState(initialFilters)`. Changer un filtre ne
relance pas les 3 fetch (`/funnel`, `/funnel/sankey`, `/funnel?view=table`). Voir
`01-architecture-flux.md §5`.

⚠️ **Double fetch au mount** (`FunnelDashboard.tsx:58`) : le RSC a déjà pré-chargé `initialOverview/
initialSankey/initialByPage`, mais le `useEffect` refetch immédiatement les 3 endpoints → calcul
serveur ×2 (coûteux, cf. perf).

✅ États `loading` (skeleton par sous-bloc) et `error` présents. Sankey tronqué signalé
(`truncated`).

## 4. Points à vérifier / tester (tous points de vue)

| PoV | À garantir |
|---|---|
| **Fonctionnel UI** | Changer period/device/traffic **rafraîchit** les 3 blocs (KPI, Sankey, table). État `loading` visible pendant le refetch, `error` si l'API échoue, `EmptyState` si 0 session. |
| **Précision data** | `step_n ≤ step_(n-1)` toujours ; `dropoffToNext ∈ [0,1]` ou null ; `progressionFromPrevious` null sur la 1ère étape ; médiane = vraie médiane (pair/impair). |
| **Sémantique** | Sankey : une session n'apparaît qu'à son étape **max** ; somme des volumes Sankey = sessions avec `view`. Top 20 + « Autres » ; `truncated` correct. |
| **Edge cases** | Sessions sans `view` exclues du Sankey ; page d'entrée `/` par défaut ; events hors période exclus ; consent non-granted exclu. |
| **Backend/API** | `view=table` renvoie la DataTable ; auth requise (401 sans session) ; filtres invalides → comportement défini (cf. AF côté UX). |
| **UX/Design** | Drop-off lisible (couleur/flèche), nombres formatés FR (`12 340`, `12,4 %`, `2m 5s`), tooltips explicatifs, responsive. |
| **a11y** | Tableau avec en-têtes, contraste, navigation clavier sur la table, `aria` sur le Sankey/chart. |

## 5. Findings (extrait — détail dans `findings-register.csv`)

| ID | Sév. | Résumé |
|---|---|---|
| AF-01 | P0 | Filtres ne rafraîchissent pas le dashboard |
| AF-03 | P1 | Modèle de funnel ≠ Checkout (cumul strict vs indépendant) |
| AF-04 | P1 | Fuseau horaire serveur sur today/yesterday |
| F-FUN-02 | P2 | Sous-comptage purchase (chaîne rompue) — à documenter |
| F-PERF-01 | P2 | Double fetch + agrégation in-memory de toute la période |
