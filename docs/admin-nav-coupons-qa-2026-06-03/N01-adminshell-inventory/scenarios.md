# Scénarios N01 — Inventaire & ordre des onglets (Gherkin FR)

Persona : **Karim**, opérateur back-office FemiGlow. Il scanne la sidebar admin pour trouver ses écrans.

## Scénario N01-S1 — Karim retrouve l'onglet Coupons à sa place (happy)

Contexte : un nouvel onglet « Coupons » vient d'être ajouté à la sidebar.

```
Étant donné que la sidebar admin est rendue (AdminShell, n'importe quelle page active)
Quand Karim parcourt la « Navigation principale »
Alors il voit exactement 21 onglets
  Et l'onglet « Coupons » est présent, libellé « Coupons », pointant vers /admin/coupons
  Et « Coupons » apparaît juste avant « Audit » (dans la zone commerce, après « Analytics »)
```

## Scénario N01-S2 — L'ordre ne dépend pas de la page courante (edge invariance)

Contexte : Karim navigue de « Leads » vers « Coupons » ; l'inventaire ne doit pas bouger.

```
Étant donné que la sidebar est rendue une fois avec active="leads"
  Et rendue une autre fois avec active="coupons"
Quand on relève la séquence des data-testid dans les deux rendus
Alors les deux séquences sont strictement identiques (mêmes onglets, même ordre)
  Et seul le surlignage diffère (couvert par N02)
```

## Scénario N01-S3 — Aucun doublon ni libellé dérivé (edge intégrité)

Contexte : un copier-coller maladroit pourrait dupliquer une entrée ou casser un accent.

```
Étant donné que la sidebar est rendue
Quand on cherche l'onglet "admin-nav-coupons"
Alors il n'en existe qu'un seul exemplaire
  Et les libellés à accents sont exacts : « Médias », « Pages légales », « Réglages »,
     « Rituels partagés », « Traductions / i18n »
  Et chaque href commence par « /admin »
```
