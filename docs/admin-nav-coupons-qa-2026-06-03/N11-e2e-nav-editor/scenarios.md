# Scénarios N11 — NavEditor visibilité (Gherkin FR, best-effort)

Persona : **Karim**, opérateur. Il veut réordonner/renommer ses onglets depuis Réglages.

## Scénario N11-S1 — Ouvrir l'éditeur de navigation (happy best-effort)

Contexte : Karim ouvre l'éditeur de nav dynamique sous Réglages.

```
Étant donné que Karim est authentifié (storageState)
Quand il ouvre /admin/settings/navigation
Alors la table d'items (role grid) est visible
  Et les colonnes « Key », « Label », « Href », « Icon », « Rôle », « Actions » sont présentes
  Et au moins une ligne de données est rendue
  Et le bouton « + Ajouter un item » et le compteur « N items » sont visibles
```

## Scénario N11-S2 — L'éditeur vit sous l'onglet Réglages (edge actif)

Contexte : il n'y a pas d'onglet dédié à l'éditeur nav ; il est servi sous Réglages.

```
Étant donné que Karim est sur /admin/settings/navigation
Quand on inspecte la sidebar
Alors l'onglet "admin-nav-settings" porte aria-current="page"
  Et l'onglet "admin-nav-coupons" ne porte pas aria-current
```

## Scénario N11-S3 — Coupons listé dans la config par défaut (edge best-effort, non bloquant)

Contexte : la config résolue retombe au pire sur les défauts, qui incluent « Coupons ».

```
Étant donné la table d'items de l'éditeur
Quand on cherche une cellule Label « Coupons »
Alors si elle est visible, l'assertion confirme sa présence
  Sinon (config DB éditée) le test reste vert sans échouer
```
