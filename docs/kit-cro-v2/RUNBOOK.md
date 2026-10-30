# Kit CRO v2 — runbook

Worktree : `/Users/ahmedelazharjebbari/PycharmProjects/Femiglow-kit-cro`, branche `feat/kit-cro-v2`.
Base : `feat/kit-coherence` (9634f247), le build en prod.

## Étapes et état

| # | Étape | Responsable | Critère de fin | État |
|---|---|---|---|---|
| 1 | Audit du code et conception (`DESIGN.md`) | Claude | Choix arrêtés pour les 4 chantiers | Fait |
| 2 | Vitesse : bulles des stories, rewrite `/kit`, polices, Web Vitals, Lighthouse mobile | Claude | Tests unitaires verts, aucune `.webm` avant interaction | Fait |
| 3 | Formulaire au clic : `BottomSheet`, `openCommander`, composant CMS `kit-checkout`, A/B | Claude | Tests unitaires + e2e sheet/scroll verts | Fait |
| 4 | Titre par angle : composant CMS `kit-hero-angles`, résolution dans la page | Claude | Tests de résolution verts, `?utm_content=E-darija` affiche l'angle E | Fait |
| 5 | Ton direct : composant CMS `kit-cta`, « pâte / poudre » | Claude | Garde-fou `kit-facts` et parité i18n verts | Fait |
| 6 | Vérification complète : typecheck, lint, tests, build | Claude | Tout vert | Fait |
| 7 | Revue de code de la branche | Claude | Aucun problème bloquant ouvert | Fait (10 retours corrigés) |
| 8 | PR vers la branche de prod | Claude | PR ouverte, description avec plan de recette | Fait : PR #12 |
| 9 | Synchronisation du registre en prod (`sync:components`) puis publication des textes dans l'admin | Utilisateur ou Claude sur accord | Champs visibles dans `/admin/components` | Accord requis |
| 10 | Déploiement en prod (script de bascule sans coupure) | Claude sur accord explicite | Page `/fr/kit` et `/ar/kit` OK, commande test OK | Accord requis |
| 11 | Activation : `kit-checkout.ctaMode = ab`, `sheetSharePct = 50` | Utilisateur dans l'admin | Variante B visible pour la moitié des visiteurs | Accord requis |
| 12 | Lecture des résultats à J+7 | Claude | Taux page vue → 1re saisie et commandes par variante et par angle | — |

## Commandes

```bash
cd /Users/ahmedelazharjebbari/PycharmProjects/Femiglow-kit-cro
pnpm --filter @femiglow/web typecheck
pnpm --filter @femiglow/web lint
pnpm --filter @femiglow/web test
pnpm --filter @femiglow/web build
```

## Recette manuelle (mobile 375 px)

1. `/kit?code=GLOW99` : pas de redirection (200 direct), prix 99 visible, aucune vidéo téléchargée avant interaction.
2. `/fr/kit?code=GLOW99&cta=sheet` : chaque bouton « Je commande » ouvre le panneau ; Échap et le bouton retour le ferment ; les champs saisis sont conservés à la réouverture ; commande complète possible.
3. `/fr/kit?code=GLOW99&cta=scroll` : comportement actuel inchangé.
4. `/fr/kit?utm_content=E-darija` puis `/fr/kit` sans paramètre : le titre de l'angle E s'affiche les deux fois (cookie).
5. `/ar/kit?utm_content=D-darija` : titre AR de l'angle D si publié, sinon titre AR par défaut.
6. Admin `/admin/components/kit-checkout`, `kit-hero-angles`, `kit-cta` : modifier, publier, vérifier sur le site.

## Retour arrière

- Formulaire au clic : `kit-checkout.ctaMode = scroll` dans l'admin (effet immédiat, sans déploiement).
- Titres par angle : vider les champs de l'angle dans l'admin (repli sur le titre par défaut).
- Rewrite `/kit` : variable d'environnement `KIT_ROOT_REWRITE=off`, puis redémarrage du serveur (obligatoire : la variable est lue dans l'environnement du processus par le middleware ; sans redémarrage, `/kit` reste servi par rewrite). Aucun redéploiement de code n'est nécessaire.
- Retour complet : redéployer le build `feat/kit-coherence` avec le script de bascule.
