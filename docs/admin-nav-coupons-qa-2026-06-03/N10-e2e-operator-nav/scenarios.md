# Scénarios N10 — Parcours opérateur nav (Gherkin FR)

Persona : **Karim**, opérateur, session admin déjà ouverte (storageState `.auth/admin.json`).

## Scénario N10-S1 — Arriver sur Coupons puis naviguer ailleurs (happy)

Contexte : Karim ouvre l'écran Coupons puis revient au tableau de bord ; l'onglet actif suit.

```
Étant donné que Karim est authentifié (storageState)
Quand il ouvre /admin/coupons
Alors le conteneur "coupons-manager" est visible
  Et l'onglet "admin-nav-coupons" porte aria-current="page"
Quand il clique sur l'onglet "admin-nav-dashboard"
Alors l'URL devient /admin
  Et "admin-nav-dashboard" porte aria-current="page"
  Et "admin-nav-coupons" ne porte plus aria-current="page"
```

## Scénario N10-S2 — Réversibilité du surlignage (edge)

Contexte : revenir sur Coupons re-surligne l'onglet, preuve que l'actif est recalculé par page.

```
Étant donné que Karim est sur /admin (dashboard actif)
Quand il clique sur l'onglet "admin-nav-coupons"
Alors l'URL devient /admin/coupons
  Et "admin-nav-coupons" porte de nouveau aria-current="page"
```

## Scénario N10-S3 — La navigation n'altère pas le pricing (edge périmètre / INV-PRICE)

Contexte : on affirme explicitement que naviguer dans la nav ne crée pas de coupon ni ne change le prix /kit.

```
Étant donné le parcours nav N10 (Coupons -> dashboard -> Coupons)
Quand il se déroule
Alors aucune commande/coupon n'est créé
  Et le spec ne consulte jamais /kit ni "pack-price-line"
  Et la parité prix (199) reste hors scope (couverte par les E2E coupon/fidélité F16/F19)
```
