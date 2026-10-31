# 09 — Plan de tests

## 1. Critères de mise en ligne

Aucune phase ne part en prod sans :

- tests unitaires et composants au vert ;
- suite existante sans nouvel échec, par rapport à la liste de référence ;
- `pnpm typecheck` et lint propres sur les fichiers touchés ;
- E2E du parcours complet en FR et AR ;
- commande réelle de test sur iPhone et Android, puis annulée ;
- arabe relu.

## 2. Tests unitaires

| Fichier | Cas |
|---|---|
| `use-address-reveal.test.ts` | Ville de la liste, correspondance exacte, `blur` avec 2 caractères, `blur` avec 1 caractère, reprise de brouillon, jamais de refermeture |
| `derive-address-phase.test.ts` | Tous les états de 03 §2 |
| `address-form-schema.test.ts` | Messages en FR, AR, EN ; limites 1, 2, 80, 81 ; 3, 4, 160, 161 ; caractères arabes |
| `shipping-fee.test.ts` | Total client égal au total serveur : ville à 19, 29, 35, 39, 45 ; gratuit ; hors liste à 45 |
| `dictionary.test.ts` | Aucune clé manquante dans les 3 langues |
| `tracking/schemas.test.ts` | Chaque nouvel événement accepté ; adresse, prénom et téléphone refusés |

## 3. Tests de composants

| Composant | Cas |
|---|---|
| `AddressStepV2` | Un seul champ à l'arrivée ; adresse absente avant la ville ; révélation ; focus déplacé ; bloc livraison absent ; ligne de frais ; note repliée ; promo visible |
| `AddressStepV2` | Tap incomplet : focus sur le bon champ, aucun appel API |
| `AddressStepV2` | Valide : un seul appel, même avec un double tap |
| `AddressStepV2` | Erreur réseau : message, saisie conservée, nouvel essai possible |
| `AddressStepV2` | Reprise après rechargement : valeurs et adresse visibles |
| `ConfirmOrderButton` | 4 libellés ; `aria-busy` ; pas de `disabled` hors envoi ; texte d'envoi traduit |
| `StepActionBar` | Total absent sans ville ; total recalculé ; assurance masquée clavier ouvert |
| `StickyCartCTA` | Visible à l'étape 1, masquée à l'étape 2 et après ; visible hors du wizard |
| `CityAutocomplete` | Nom arabe affiché sur `/ar` ; tarif conservé ; 3 suggestions en mode compact |
| `Button` | `loadingLabel`, valeur par défaut inchangée |

Chaque correction de bug s'accompagne d'un test qui échoue sur l'ancien code.

## 4. Tests de bout en bout (Playwright)

| Scénario | FR | AR | EN |
|---|---|---|---|
| Parcours complet avec ville de la liste | ✓ | ✓ | ✓ |
| Ville hors catalogue : adresse visible, 45 MAD | ✓ | ✓ | |
| Code promo GLOW99 : remise visible et total exact | ✓ | ✓ | |
| Crédit fidélité : `loyalty-*.spec.ts` | ✓ | | |
| Retour à l'étape 1, puis étape 2 : données conservées | ✓ | ✓ | |
| Rechargement à l'étape 2 | ✓ | ✓ | |
| Erreur API 500, puis réussite | ✓ | | |
| Connexion perdue, puis rétablie | ✓ | | |
| Double tap : une seule commande | ✓ | | |
| Mouvement réduit : pas de reflet | ✓ | | |
| Mode panneau `?cta=sheet` | ✓ | | |
| Variantes `?step2=v2` et `?step2=control` | ✓ | | |

### Géométrie

Test sans clavier, sur 360×640, 375×667, 390×844, 412×915, FR et AR :

- le CTA est entièrement dans la fenêtre, sans défilement ;
- aucun débordement horizontal ;
- aucun élément ne recouvre le CTA : `document.elementFromPoint` renvoie bien le bouton ;
- `CLS` inférieur à 0,1 pendant la révélation.

## 5. Appareils réels

**Indispensable, car Chromium ne simule ni le clavier ni les navigateurs intégrés.**

| Appareil | Navigateurs |
|---|---|
| iPhone récent (iOS 18+) | Safari, navigateur Instagram, navigateur Facebook |
| iPhone ancien ou petit | Safari |
| Android milieu de gamme | Chrome, Instagram, Facebook |
| Android d'entrée de gamme | Chrome |

À contrôler sur chacun :

- [ ] Barre au-dessus du clavier, sans saut visible
- [ ] Le clavier reste ouvert après le choix de la ville
- [ ] La zone de saisie n'est pas cachée
- [ ] Autofill d'adresse
- [ ] Clavier arabe et bascule de langue
- [ ] Encoche et barre d'accueil
- [ ] Bouton retour du système
- [ ] Rotation
- [ ] Reflet fluide sur l'appareil d'entrée de gamme
- [ ] Couleur grenat fidèle à la maquette
- [ ] Taille de texte système agrandie à 130 %

## 6. Accessibilité

| Contrôle | Outil |
|---|---|
| Analyse automatique | `jest-axe`, `@axe-core/playwright` |
| Contraste | Ratios de 04 §1, à recontrôler sur les rendus finaux |
| Lecteur d'écran | VoiceOver et TalkBack : champ révélé annoncé, erreurs lues |
| Clavier physique | Parcours complet sans souris |
| Focus visible | Jamais caché par la barre (WCAG 2.4.11) |
| Zoom à 200 % | Contenu utilisable |

## 7. Performance

| Mesure | Seuil |
|---|---|
| `First Load JS` de `/kit` | +3 Ko au maximum |
| INP au tap sur le CTA | Moins de 200 ms |
| Animation | Aucune image perdue visible sur Android d'entrée de gamme |
| LCP de `/kit` | Inchangé |

## 8. Contrôle du tracking

- Chaque événement apparaît dans `tracking_events_log`.
- `tracking.ingest.unknown_event` et `invalid_params` restent à zéro pour ces événements.
- Aucune donnée personnelle dans `payload`.
- `step2_variant` présent de `address_step_view` à `purchase`.
- Répartition proche de 50/50.
- Une même visiteuse garde la même variante.

## 9. Test A/B

### Mesure principale

**Taux de passage de `address_step_view` à `purchase`**, par visiteuse unique.

### Garde-fous

| Indicateur | Seuil d'alerte |
|---|---|
| Erreurs serveur sur `/api/checkout/*` | Hausse nette |
| Écart entre totaux affichés et commandés | Zéro toléré |
| Taux de confirmation au téléphone | Baisse de plus de 10 points |
| Taux de livraison | Baisse de plus de 10 points |
| Doublons de commande | Aucun |

### Volume

Base de 57 %, puissance de 80 %, risque de 5 %, deux bras égaux.

| Gain à détecter | Par bras | Total | Durée à 150 leads par semaine |
|---|---:|---:|---:|
| +15 points | ~155 | ~310 | ~2 semaines |
| +10 points | ~365 | ~730 | ~5 semaines |
| +5 points | ~1 500 | ~3 000 | ~20 semaines |

### Règles

- Fixer la durée à l'avance : au moins 2 semaines complètes.
- Ne pas s'arrêter au premier résultat favorable.
- Ne pas modifier l'offre, le prix ou les campagnes pendant le test, ou le noter.
- Comparer aussi par langue, à titre indicatif, sans conclure sur un petit groupe.
- Avec ce volume, tester **le bloc V2 entier**. La couleur ou le texte se testeront ensuite séparément.
- Un écart de moins de 10 points restera difficile à confirmer en moins d'un mois.

## 10. Après la mise en ligne

| Délai | Vérification |
|---|---|
| 1 h | Commandes réelles, erreurs serveur, événements |
| 24 h | Répartition A/B, écart FR/AR, retours service client |
| 7 jours | Abandon par phase et par frais |
| Fin du test | Décision, nettoyage, retour d'expérience |
