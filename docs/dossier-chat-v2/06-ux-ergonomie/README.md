# UX & Ergonomie — Parcours et microcopy

> L'UX est la **première arme de conversion**. L'ergonomie de l'admin est la **première arme de productivité**. Les deux sont étudiées et chiffrées ici.

## Approche

1. **Parcours documentés** pour chaque persona (P1/P2/P3 user + A1/A2 admin).
2. **Service blueprint** pour visualiser front-stage / back-stage / pilotage.
3. **Microcopy externalisée** en CSV trilingue, prête à i18n.
4. **Ergonomie admin** : checklist Nielsen + Norman Group + métriques d'efficience.

## Fichiers de cette section

- [`README.md`](README.md) — ce fichier
- [`user-journeys.md`](user-journeys.md) — 6 parcours détaillés bout-en-bout
- [`service-blueprint.puml`](service-blueprint.puml) — diagramme de service blueprint
- [`microcopy.csv`](microcopy.csv) — toutes les chaînes UI (trilingue)
- [`admin-ergonomy.md`](admin-ergonomy.md) — ergonomie admin (Nielsen + métriques)

## Principes UX

### Côté visiteur

1. **3 clics maximum** pour atteindre un produit ou une info clé.
2. **0 frustration ≤ 5 s** : la 1ère réponse arrive en ≤ 5 s **ou** un placeholder rassurant.
3. **Pas de cul-de-sac** : toute réponse propose au moins 1 action (pill, CTA, lead).
4. **Réversibilité partout** : annuler, revenir, recommencer.
5. **Réveil contextuel** : si le visiteur reste 30 s sur une page produit sans interaction → suggestion proactive dans le launcher (badge "1").

### Côté admin

1. **Une tâche = 3 clics max** depuis dashboard d'accueil.
2. **Aperçu live** systématique pour tout contenu (pas de "publier puis voir si ça marche").
3. **Bulk actions** sur tableaux (sélection multi-lignes + apply action).
4. **Filtres persistés URL** pour partage de vue entre opérateurs.
5. **Pas de modal pour les actions courantes** : inline ou drawer right.

## Métriques d'ergonomie (objectifs)

| Métrique | Cible | Mesure |
|---|---|---|
| Time-to-first-meaningful-action visiteur | < 12 s p50 | RUM + event |
| Composer focus → 1er message envoyé | < 8 s p50 | event |
| 1er token affiché (LLM) | < 800 ms p50 | KPI |
| Lead form complete (mobile) | < 25 s p50 | event |
| Admin : édition canned → publish | < 90 s | session replay |
| Admin : trier 10 leads | < 60 s | session replay |
| Admin : taux d'erreur (action ratée) | < 2% | event |
