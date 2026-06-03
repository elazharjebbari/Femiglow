# Scénarios N04 — A11y, responsive & déconnexion (Gherkin FR)

Persona : **Karim**, opérateur, parfois sur mobile en boutique, parfois sur desktop au bureau.

## Scénario N04-S1 — Coquille accessible avec l'onglet Coupons rendu (happy a11y)

Contexte : on veut s'assurer que l'ajout de Coupons (actif) n'introduit aucune régression a11y.

```
Étant donné AdminShell rendu avec active="coupons"
Quand on analyse l'arbre accessible
Alors il existe une navigation nommée « Navigation principale »
  Et axe ne remonte aucune violation critique/serious
  Et chaque onglet est un lien natif focusable (href non vide)
```

## Scénario N04-S2 — Layout responsive porté par les classes (edge responsive)

Contexte : jsdom n'évalue pas les media-queries ; on vérifie les classes Tailwind responsables du comportement.

```
Étant donné AdminShell rendu
Quand on lit les classes de structure
Alors la liste d'onglets porte « flex gap-2 » (rangée en mobile) et « lg:flex-col lg:gap-1 » (colonne en desktop)
  Et l'aside porte « lg:w-60 » (sidebar fixe à partir du breakpoint lg)
```

## Scénario N04-S3 — Déconnexion en desktop, masquée en mobile (edge logout)

Contexte : le bouton de déconnexion est visible en sidebar desktop, caché dans la barre mobile.

```
Étant donné AdminShell rendu
Quand on inspecte le formulaire de déconnexion
Alors son action cible /api/admin/logout en method POST
  Et il contient un bouton « Se déconnecter »
  Et il porte les classes « hidden lg:block » (caché en mobile, visible en desktop)
```
