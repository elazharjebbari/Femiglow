# Scénarios N03 — Intégration onglet Coupons (Gherkin FR)

Persona : **Karim**, opérateur. Il ouvre l'écran Coupons et s'attend à voir l'onglet Coupons surligné.

## Scénario N03-S1 — Montage de l'écran Coupons surligne le bon onglet (happy, niveau composant)

Contexte : on reproduit le contrat de montage du RSC `/admin/coupons` (active="coupons" + CouponsManager).

```
Étant donné AdminShell rendu avec active="coupons" et pour enfant CouponsManager (initialCoupons=[])
Quand on inspecte la nav et le contenu
Alors l'onglet "admin-nav-coupons" porte aria-current="page" et la classe bg-stone-900
  Et le conteneur "coupons-manager" est présent dans le main
```

## Scénario N03-S2 — Anti-régression : Réglages n'est plus surligné par erreur (edge)

Contexte : avant correctif, la page passait active="settings" et surlignait Réglages à tort.

```
Étant donné AdminShell rendu avec active="coupons"
Quand on inspecte l'onglet "admin-nav-settings"
Alors il ne porte pas aria-current
  Et l'onglet surligné est bien "admin-nav-coupons"
```

## Scénario N03-S3 — Réalité RSC via E2E (renvoi N10)

Contexte : seul l'E2E exécute requireAdmin + accès DB ; la frontière unité ne rend pas le RSC.

```
Étant donné une session admin (storageState)
Quand Karim ouvre /admin/coupons
Alors "coupons-manager" est visible
  Et "admin-nav-coupons" porte aria-current="page"
  (détail complet dans N10-e2e-operator-nav)
```
