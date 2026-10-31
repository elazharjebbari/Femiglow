# Étape 2 du formulaire de commande — dossier de refonte

Audit, recherche, conception et plan d'action. **Rien n'a été modifié sur le site.** Date : 31/10/2026.

## En bref

- **Le problème est réel et chiffré.** Sur 30 jours, 157 personnes ont terminé l'étape 1 et 90 ont commandé. L'étape 2 en perd donc **43 %**, contre 15 % pour l'étape 1.
- **L'écran ne montre pas le vrai bouton.** Sur iPhone 14, l'étape 2 mesure de 926 à 965 px pour 844 px d'écran. Sur tous les formats testés, le CTA arrive de 228 à 308 px sous le bord de l'écran.
- **Un faux bouton est affiché à sa place.** La barre « Je commande » reste à l'écran pendant l'étape 2. Un tap ne valide rien, il fait seulement défiler la page.
- **Une autre cause possible est le prix.** Les frais de 19 à 45 MAD n'apparaissent qu'à l'étape 2. Sur un panier à 99 MAD, 35 MAD représentent 35 % de plus. Aucune donnée ne permet encore de mesurer ce poids, d'où la priorité donnée au tracking.
- **69 numéros en 7 jours** sont restés sans commande. C'est le levier le plus rapide, indépendant de la refonte.

## Ce que propose le dossier

1. Un champ visible à l'arrivée, la ville. L'adresse apparaît une fois la ville choisie.
2. Le bloc « Mode de livraison » disparaît. Les frais et le délai tiennent sur une ligne, sous la ville.
3. La note au livreur et le code de fidélité passent derrière un lien discret.
4. Une barre d'action unique, toujours visible, y compris au-dessus du clavier, avec le total réel.
5. Un bouton grenat pleine largeur, avec une icône de colis et une micro-animation sobre.
6. Des textes revus en français, arabe et anglais, et des messages d'erreur enfin traduits.

**Gain :** à l'arrivée, 356 px au lieu de 965 px. Une fois tout rempli, 494 px. Tout tient donc sans défiler, même sur un écran de 640 px.

## Lire le dossier

| Fichier | Contenu |
|---|---|
| [01-audit.md](01-audit.md) | Fonctionnement réel, données, mesures, 17 anomalies |
| [02-recherche.md](02-recherche.md) | Kolenda page par page, autres sources, niveau de preuve |
| [03-conception-ux.md](03-conception-ux.md) | Parcours, états, règles de révélation, budget de hauteur |
| [04-design.md](04-design.md) | Couleurs, polices, bouton, icône, animation, RTL |
| [05-textes.md](05-textes.md) | Tous les textes en FR, AR et EN |
| [06-frontend.md](06-frontend.md) | Composants, fichiers, clavier mobile, accessibilité |
| [07-backend-tracking.md](07-backend-tracking.md) | API, base, événements, récupération des leads |
| [08-pourquoi-ca-va-marcher.md](08-pourquoi-ca-va-marcher.md) | Justification, hypothèses, ce qui peut échouer |
| [09-tests.md](09-tests.md) | Plan de test complet |
| [10-plan-action.md](10-plan-action.md) | Plan d'exécution par phases, à valider avant de démarrer |
| [maquettes/index.html](maquettes/index.html) | Maquettes animées, à ouvrir dans un navigateur |
| [maquettes/apercu-complet.png](maquettes/apercu-complet.png) | Les mêmes maquettes en image |
| `maquettes/actuel/` | Captures de l'étape 2 actuelle |

## Vos demandes, et où elles sont traitées

| Demande | Réponse | Détail |
|---|---|---|
| Cacher « Mode de livraison » | Bloc retiré ; les frais restent affichés sur une ligne, sinon ils deviendraient une surprise | 03 §3 |
| Adresse visible après la ville | Oui, avec une exception pour les villes hors liste, sinon ces clientes seraient bloquées | 03 §4 |
| Tout voir sans défiler | Oui : barre fixe et hauteur réduite | 03 §5 |
| CTA plus incitant | Couleur, icône, fond, micro-animation | 04 §3 à §6 |
| Textes dans les langues | FR, AR, EN, relecture arabe requise | 05 |
| Audit et bugs | 17 anomalies, dont 5 critiques | 01 §5 |
| Kolenda, sur tous les aspects | 8 PDF lus, références aux pages | 02 |
| Justification | Par décision, avec le niveau de preuve | 08 |
| Tests | Unitaires, E2E, appareils réels, A/B | 09 |
| Plan d'action sans exécution | Rien n'est lancé | 10 |

## Décisions à prendre

| # | Décision | Recommandation |
|---|---|---|
| 1 | Valider le plan et son ordre | Oui, en commençant par le tracking |
| 2 | Couleur du bouton | Grenat (`#8E3F3B` à `#A34A45`) |
| 3 | Rappeler les leads sans commande | Oui, après vérification juridique du consentement |
| 4 | Stratégie sur les frais de livraison | Mesurer une semaine avant de décider |
| 5 | Relecture de l'arabe par une personne native | Obligatoire avant la mise en ligne |

## Limites

- Les mesures d'écran viennent d'une copie locale sous Chromium : ni clavier réel, ni iPhone réel, ni navigateur intégré Instagram ou Facebook.
- Le volume reste faible : 149 des 157 leads datent de la semaine du 26/10, et aucune saisonnalité n'est connue.
- La base ne contient pas le statut de livraison : le taux de colis livrés ne peut pas être suivi aujourd'hui.
- Kolenda ne traite ni le paiement à la livraison, ni l'arabe, ni le RTL, ni le clavier mobile. Ces points viennent d'autres sources ou de déductions, signalées comme telles.
