# Plans d'exécution — pages B2C

Neuf plans détaillés, un par page (ou par tunnel). Chacun décline la
[stratégie d'itération](../preparation/15-strategie-iteration.md) sur une
surface précise du site, avec phases séquentielles, écarts spec/scaffold
résolus en amont, DoD spécifique, métriques avant/après et critère unique
de réussite.

## Comment lire ces plans

Chaque plan suit le **même gabarit** :

1. Objectif + KPIs cibles
2. Documents à relire avant de coder
3. Inventaire des dépendances (tokens, primitifs UI, layout, sections, données)
4. Écarts spec / scaffold à résoudre
5. Plan d'exécution en phases strictement séquentielles
6. Definition of Done spécifique à la page
7. Métriques avant / après (tableau à remplir)
8. Risques et mitigations
9. Estimation horaire récapitulative
10. Annexes — commandes utiles
11. Critère unique de réussite

## Index des plans

| #   | Plan                                                       | Page cible                | Spec source (§ 4)          | Charge nette |
| --- | ---------------------------------------------------------- | ------------------------- | -------------------------- | ------------ |
| 01  | [Page d'accueil](./01-page-home.md)                        | `/`                       | § 4.1                      | 22 h         |
| 02  | [Page Rituel](./02-page-rituel.md)                         | `/rituel`                 | § 4.2                      | 22-28 h      |
| 03  | [Page Kit](./03-page-kit.md)                               | `/kit`                    | § 4.3                      | 24-30 h      |
| 04  | [Hub Journal](./04-page-journal.md)                        | `/journal`                | § 4.4                      | 16-22 h      |
| 05  | [Article détail](./05-page-article.md)                     | `/journal/[slug]`         | déduit                     | 18-24 h      |
| 06  | [Page Maison](./06-page-maison.md)                         | `/maison`                 | § 4.5                      | 18-24 h      |
| 07  | [Page Contact](./07-page-contact.md)                       | `/contact`                | § 4.9                      | 14-20 h      |
| 08  | [Panier](./08-page-panier.md)                              | `/panier`                 | § 4.6                      | 12-18 h      |
| 09  | [Tunnel checkout](./09-tunnel-checkout.md)                 | `/commander` + `/merci`   | §§ 4.7 + 4.8               | 26-34 h      |

**Total estimé** : 172 à 222 heures de travail concentré
(≈ 4 à 6 semaines à temps plein, ou 8 à 12 semaines à mi-temps —
cohérent avec la cadence cible de la [stratégie d'itération § 12](../preparation/15-strategie-iteration.md)).

## Ordre d'exécution recommandé

L'ordre des numéros n'est **pas** un ordre d'exécution arbitraire. Il suit
la logique « fondations d'abord, conversion ensuite » :

1. **Home** (plan 01) — vitrine, première impression, pose tous les primitifs UI.
2. **Rituel** (02) — narration, vidéo, pose les patterns longs.
3. **Kit** (03) — fiche produit, pose le tunnel d'add-to-cart.
4. **Journal** (04) puis **Article** (05) — éditorial, SEO, capture email.
5. **Maison** (06) — institutionnel, dernière page éditoriale.
6. **Contact** (07) — pont conversationnel, bas de funnel B2C / haut de funnel B2B.
7. **Panier** (08) — pre-checkout, pose la mécanique cart store.
8. **Tunnel checkout** (09) — la page la plus haute valeur du site, à faire
   **en dernier** car elle dépend de tous les patterns établis dans les plans
   précédents (formulaires, boutons, validation, états async, accessibilité
   complète).

> *Une page n'est terminée que lorsqu'on n'a rien à excuser. Pas de « démo »,
> pas de « les images sont temporaires », pas de « la newsletter sera branchée
> plus tard ». Si vous devez excuser, le plan n'est pas fini.*
