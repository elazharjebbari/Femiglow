# 10 — Plan d'action

**Statut au 31/10/2026 : V2 activée pour 100 % des visiteuses, à la demande de l'utilisateur, sans test A/B ni recette préalable sur appareils.** Retour à l'ancienne version : `?step2=control` pour un visiteur, part CMS à 0 ou `CHECKOUT_STEP2_V2=off` pour toutes. L'effet se lit désormais en avant/après, à partir de la date de bascule.

| Phase | État | Branche |
|---|---|---|
| P0 Mesure | Développée, à déployer | `feat/step2-tracking` |
| P1 Bugs critiques | Développée, à déployer | `fix/step2-bugs` |
| P2 Récupération des leads | Attend la vérification juridique | — |
| P3 Observation | Démarre au déploiement de P0 | — |
| P4 V2 | Active à 100 % | `fix/phone-autofill` |
| P5 Recette sur appareils | À faire avec vous | — |
| P6 Test A/B | Remplacé par une comparaison avant/après | — |
| P7 Décision | Après lecture des chiffres | — |

### Écarts par rapport au plan initial

| Sujet | Plan | Réalisé | Raison |
|---|---|---|---|
| Faux CTA | Masquer dès l'étape 2 | Masqué si le formulaire engagé est à l'écran | Le store est persisté : une cliente revenue en haut de page aurait perdu la barre |
| Double prix | Vérifier à l'étape 1 | Même règle dès qu'une ville est connue | Retour à l'étape 1 après choix de la ville |
| Récapitulatif | Sous l'en-tête | Non collant en page, épinglé dans le panneau | La barre promo collante varie en hauteur : décaler `top` serait fragile |
| Plan de tracking (0.2) | Ajouter les événements | Sans objet | L'ingestion ne vérifie que les validateurs ; événements first-party |
| Assignation A/B | Côté serveur | Côté client, sur `fg_aid` | `fg_aid` vit dans le navigateur ; l'étape 2 n'est jamais rendue côté serveur, donc pas de clignotement |
| Coupe-circuit | Champ CMS ou variable | Les deux : `step2V2SharePct` (défaut 0), `CHECKOUT_STEP2_V2=off` | |
| Lien de retour | « Modifier mes coordonnées » | « Modifier », nom complet pour les lecteurs d'écran | Le long libellé tronquait la phrase de progression sur 360 px |

**Ajouts absents du dossier :** la bulle de chat s'efface pendant que la barre V2 est à l'écran (elle recouvrait le CTA) ; la barre V2 disparaît quand le formulaire quitte l'écran (sinon deux barres fixes) ; l'étape se recale sous les barres collées à l'arrivée ; verrou contre le double tap dans `useAddressForm`, valable pour les deux versions.

**Décision du 31/10/2026 :** l'adresse devient facultative dans la V2 : la ville suffit à commander. À suivre : colis non livrés et temps de confirmation au téléphone. La case de rappel revient cochée à chaque chargement de page.

**Prix promotionnel de la barre (31/10/2026) :** prix final grand, barré petit sur la même ligne, écart égal à la remise, couleur grenat à partir de 30 % de remise (`Pricing.pdf` p. 5, 10, 13, 15, 17, 23, 75). Le grenat n'est donc plus réservé au seul bouton. Le bandeau cookies passe au-dessus des barres fixes.

**Limite à arbitrer :** le bouton « Commander » de la barre promo reste visible à l'étape 2. Même défaut que le faux CTA, sur une zone que le plan ne couvrait pas.

## 1. Vue d'ensemble

| Phase | Contenu | Effort | Dépend de | Effet visible |
|---|---|---|---|---|
| P0 | Mesure | 1 jour | — | Aucun |
| P1 | Bugs critiques | 1 jour | — | Oui, sûr |
| P2 | Récupération des leads | 0,5 jour, plus décision juridique | Consentement | Hors site |
| P3 | Observation | 7 jours d'attente | P0 | Aucun |
| P4 | Construction de la V2 | 3 à 4 jours | P1 | Non, drapeau coupé |
| P5 | Recette sur appareils | 1 jour | P4, relecture arabe | Non |
| P6 | Test A/B | 2 à 5 semaines | P5 | Pour 50 % du trafic |
| P7 | Décision et nettoyage | 0,5 jour | P6 | Oui |

Le développement est estimé à 5 à 6 jours.

P0 et P1 sont sans risque et utiles quelle que soit la suite : ils peuvent être déployés ensemble.

## 2. Règles de travail

- Une branche et une PR par phase, depuis `fix/hero-gallery-thumbnail-nav` ou la branche servie à ce moment.
- Aucun déploiement sans accord explicite.
- Migration : aucune prévue.
- Après chaque déploiement, relancer le préchauffage des images : le cache `.next` est remplacé.
- Ne rien changer aux publicités Meta pendant le test sans le noter.

## 3. P0 — Mesure

**But :** savoir où et pourquoi les gens partent.

| # | Tâche | Fichiers |
|---|---|---|
| 0.1 | Déclarer les événements de 07 §3 | `lib/tracking/schemas.ts` |
| 0.2 | Les ajouter au plan de tracking actif | Seed, admin |
| 0.3 | Émettre vue, focus, ville, erreurs, tap incomplet | `AddressStep.tsx` |
| 0.4 | Émettre `address_cta_visible` | `AddressStep.tsx` |
| 0.5 | Émettre `address_step_abandon` | `AddressStep.tsx` |
| 0.6 | Requêtes de suivi | `docs/`, `07 §7` |

**Tests :** 09 §2 et §8.

**Terminé si :** tous les événements sont visibles en prod, sans `unknown_event`, sans donnée personnelle.

**Retour arrière :** redéploiement. Aucun effet sur les clientes.

## 4. P1 — Bugs critiques

**But :** retirer ce qui trompe la cliente. Ces changements ne passent pas par l'A/B, car ils corrigent des erreurs.

| # | Tâche | Anomalie | Fichiers |
|---|---|---|---|
| 1.1 | Masquer `StickyCartCTA` dès l'étape 2 | A2, A3 | `StickyCartCTA.tsx` |
| 1.2 | Vérifier le prix de la barre à l'étape 1 | A3 | `StickyCartCTA.tsx` |
| 1.3 | Traduire les erreurs | A6 | `AddressStep.tsx`, dictionnaires |
| 1.4 | Ajouter `loadingLabel` | A7 | `Button.tsx`, wizard |
| 1.5 | Traduire les textes figés | A10 | `AddressStep.tsx`, `WizardShell.tsx` |
| 1.6 | Corriger le récapitulatif sous l'en-tête | A8 | `WizardCartRecap.tsx` |
| 1.7 | Afficher la ville en arabe, sans perdre le tarif | A9 | `AddressStep.tsx` |
| 1.8 | Retirer le vide du stock | A14 | `StockIndicator.tsx` |
| 1.9 | Retirer « 30 s » | A13 | Dictionnaires, `WizardShell.tsx` |

**Tests :** 09 §3, plus E2E FR et AR. Chaque bug a un test qui échoue sur l'ancien code.

**Terminé si :** sur `/ar/kit`, aucun texte français en erreur, un seul prix affiché, aucune barre « Je commande » à l'étape 2.

**Risque :** l'étape 2 montre moins de bas d'écran, mais le vrai CTA reste à trouver en défilant, jusqu'à la V2. Le passage peut bouger : **notez la date du déploiement**, car elle crée une rupture dans les données.

## 5. P2 — Récupération des leads

**But :** contacter les clientes qui ont laissé leur numéro.

| # | Tâche | Responsable |
|---|---|---|
| 2.1 | Valider le consentement et la formulation | Vous, conseil juridique |
| 2.2 | Filtre « sans commande » dans l'admin | Développement |
| 2.3 | Définir le script d'appel et le délai | Vous |
| 2.4 | Mesurer joignabilité, commandes, plaintes | Vous et développement |

**Attention :** cette action augmente les commandes indépendamment de la V2. Si elle démarre pendant l'A/B, il faut l'appliquer aux deux bras à l'identique, ou mesurer les commandes sans rappel.

## 6. P3 — Observation

**Durée :** 7 jours après P0.

| Question | Décision qui en découle |
|---|---|
| Quel abandon par niveau de frais ? | Faut-il un test sur les frais ? |
| Où s'arrêtent-elles : ville, adresse, bouton ? | Priorités de la V2 |
| Taps sur bouton incomplet ? | Confirme le problème du bouton grisé |
| Combien voient le CTA ? | Confirme H1 |
| Écart FR/AR ? | Priorité de la relecture |

**Point d'arrêt :** relire le plan avec ces chiffres. Si les frais expliquent l'essentiel, les traiter avant ou avec la V2.

## 7. P4 — Construction de la V2

Drapeau coupé en prod pendant toute la phase.

| # | Tâche | Fichiers | Effort |
|---|---|---|---|
| 4.1 | Jetons `action`, `notice` | `tokens.css`, `tailwind.config.ts` | 0,25 j |
| 4.2 | Schéma et règle de révélation, avec tests | `lib/checkout/address/*` | 0,5 j |
| 4.3 | `ConfirmOrderButton`, états, icône, animation | Nouveau composant | 0,5 j |
| 4.4 | `StepActionBar`, clavier, encoche | Nouveau composant, `use-visual-viewport` | 0,75 j |
| 4.5 | `StepProgressLine` | Nouveau composant | 0,25 j |
| 4.6 | `AddressStepV2`, note et code repliés | Nouvelle étape | 0,75 j |
| 4.7 | Mode compact de `CityAutocomplete` | Composant | 0,25 j |
| 4.8 | Textes FR, AR, EN | Dictionnaires | 0,25 j |
| 4.9 | Assignation A/B et drapeau | `KitCommanderSection.tsx`, `WizardShell.tsx` | 0,25 j |
| 4.10 | E2E et géométrie | `e2e/` | 0,5 j |

**Tests :** 09 §2, §3, §4, §6, §7.

**Terminé si :** tests au vert, `?step2=v2` fonctionne, la prod reste inchangée sans ce paramètre.

## 8. P5 — Recette

| # | Tâche | Responsable |
|---|---|---|
| 5.1 | Relecture arabe, darija ou standard | Personne native |
| 5.2 | Validation visuelle sur téléphone | Vous |
| 5.3 | Tableau d'appareils de 09 §5 | Développement et vous |
| 5.4 | Commandes de test FR et AR, annulées ensuite | Développement |
| 5.5 | Accessibilité, VoiceOver, TalkBack | Développement |

**Point d'arrêt :** votre validation est nécessaire avant P6. La barre au-dessus du clavier dans le navigateur Instagram est le risque technique principal.

## 9. P6 — Test A/B

| Jour | Action |
|---|---|
| J0 | Déployer, drapeau coupé, préchauffer les images |
| J0 | Tester `?step2=v2` en prod |
| J0 | Activer à 10 % |
| J1 | Vérifier commandes, erreurs, répartition |
| J2 | Passer à 50 % |
| J3 | Vérifier les garde-fous |
| J14 ou plus | Lire le résultat selon 09 §9 |

**Coupe-circuit :** champ CMS ou variable d'environnement, retour immédiat à la version actuelle.

**Arrêt immédiat si :** écart entre totaux, doublons de commande, baisse des commandes de plus de 30 % sur 24 h à volume comparable, panne sur un navigateur.

## 10. P7 — Décision

| Résultat | Action |
|---|---|
| V2 nettement meilleure, livraison stable | Passer à 100 %, supprimer l'ancienne étape |
| Pas de différence | Conserver la version la plus simple, puis tester les frais |
| V2 moins bonne | Couper, analyser par phase |
| V2 meilleure, livraison dégradée | Revoir les champs d'adresse, nouveau test |

Ensuite, et par test séparé :

1. Stratégie des frais.
2. Texte « Recevoir mon kit ».
3. Couleur encre contre grenat.
4. Miniature produit à côté du total.

## 11. Risques principaux

| Risque | Probabilité | Impact | Parade |
|---|---|---|---|
| Barre instable au clavier iOS ou Instagram | Moyenne | Élevé | Recette sur appareils, repli en barre non fixe |
| Cliente bloquée à la révélation | Faible | Élevé | Condition au `blur`, tests hors liste |
| Total affiché faux | Faible | Élevé | Test client égal serveur |
| Faible volume, test non concluant | Élevée | Moyen | Bloc entier, 5 semaines si besoin |
| Autre session qui redéploie une branche | Moyenne | Élevé | Coordination avant tout déploiement |
| Arabe mal formulé | Moyenne | Moyen | Relecture |
| Changement de campagne pendant le test | Moyenne | Moyen | Journal des changements |

## 12. Décisions attendues avant de démarrer

- [ ] Plan et ordre validés
- [ ] P0 et P1 autorisés
- [ ] Couleur grenat validée sur maquette
- [ ] Responsable de la relecture arabe désigné
- [ ] Source des statuts de livraison identifiée
- [ ] Vérification juridique du rappel lancée
