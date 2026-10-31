# 01 — Audit de l'étape 2

## 1. Méthode

| Source | Détail |
|---|---|
| Code | Branche `fix/hero-gallery-thumbnail-nav` (`f9ed0c0f`), celle qui tourne en prod |
| Données | Base de prod, requêtes en lecture seule, 30 jours au 31/10/2026 |
| Rendu | Copie locale avec base de test, Chromium en émulation mobile, parcours réel jusqu'à l'étape 2 |
| Prod | Aucun lead ni commande de test n'y a été créé |

## 2. Fonctionnement actuel

### Parcours

1. `/kit` affiche le formulaire dans la page. Le panneau (`BottomSheet`) existe aussi, mais le CMS est réglé sur `scroll`.
2. Étape 1, `LeadCaptureStep` : prénom, téléphone, consentement. `POST /api/checkout/lead` crée une ligne `chat_lead`, en tâche de fond (mode optimiste).
3. Étape 2, `AddressStep` : ville, adresse, note, code fidélité.
4. Un seul clic enchaîne trois appels dans `useAddressMutation` :
   - `PATCH /api/checkout/lead/[id]/address`, puis `address_completed` ;
   - `PATCH` paiement à la livraison, puis `add_payment_info` ;
   - `POST /api/checkout/order`, puis `purchase`.
5. `ThankYouStep` confirme et annonce le rappel.

### Composition de l'écran

Hauteurs relevées sur iPhone 14, à l'arrivée.

| Élément | Hauteur | Rôle |
|---|---|---|
| En-tête du site (collant) | ~64 px | Hors du formulaire |
| Récapitulatif panier (collant) | ~72 px | Passe sous l'en-tête |
| Indicateur d'étapes | ~90 px | 3 étapes et durées, sur 3 lignes |
| Titre et sous-titre | 58 px | |
| Stock | 24 à 27 px, plus marges | Laisse un vide au chargement |
| Ville et aide | 103 à 119 px | Aide sur 2 lignes |
| Adresse | 87 px | |
| **Mode de livraison** | 105 à 128 px | Information sans action |
| **Note au livreur** | 161 px | Facultatif, mais le plus grand bloc |
| Code de fidélité | 20 px | |
| Aucun paiement maintenant | 64 px | |
| Retour et CTA | 102 px | |
| Barre « Je commande » (fixe) | 73 px | Cache le bas de l'écran |

### Validation

- `react-hook-form` avec Zod, mode `onChange`.
- Client : ville de 2 à 80 caractères, adresse de 4 à 160.
- Serveur : `addressLine1` facultatif. Le client est donc plus strict que le serveur.
- Une ville hors catalogue reste acceptée en texte libre.
- Le CTA reste grisé (`opacity-40`) tant que le formulaire n'est pas valide.

## 3. Ce que disent les données

### Entonnoir sur 30 jours (sessions distinctes)

| Étape | Sessions | Passage |
|---|---|---:|
| `view_item` | 3 673 | |
| `add_to_cart` | 286 | 7,8 % |
| `form_start` | 185 | 64,7 % |
| `generate_lead` (étape 1 terminée) | 157 | 84,9 % |
| `address_completed` (étape 2 terminée) | 90 | **57,3 %** |
| `purchase` | 90 | 100 % |

**Recoupement avec la base :** `chat_lead` compte 161 lignes, dont 90 avec commande et 71 sans. La table `orders` compte 90 commandes. Les chiffres du tracking sont donc fiables à ce niveau.

### Par langue

| Langue | Étape 1 terminée | Étape 2 terminée | Passage |
|---|---:|---:|---:|
| Français | 80 | 46 | 57,5 % |
| Arabe | 67 | 40 | 59,7 % |
| Anglais | 10 | 4 | 40 % (trop peu de volume) |

La fuite est de même ampleur en français et en arabe. Elle ne vient donc pas d'abord de la langue.

### Autres chiffres

- **Volume :** 149 leads sur 157 datent de la semaine du 26/10.
- **Durée lead vers adresse :** médiane 61 s, 90e centile 125 s (83 sessions). L'interface annonce 30 s.
- **Panier :** moyenne 138 MAD, de 99 à 234 MAD.
- **Frais payés :** 35 MAD (47 commandes), 19 (19), 0 (11), 39 (6), 45 (6), 29 (1).
- **Catalogue :** 430 villes. 249 à 45 MAD, 128 à 39, 32 à 35, 20 à 29, 1 à 19.
- **Délais :** 48h-96h pour 183 villes, 24h-72h pour 141, 24h-48h pour 102, 24h pour 4.
- **Villes commandées :** Casablanca 21, Rabat 12, Marrakech 8, Tanger 6, Témara 6, Agadir 4.
- **Leads sans commande sur 7 jours :** 69.

### Ce qui n'est pas mesuré

L'entonnoir s'arrête à `generate_lead`, puis saute à `address_completed`. On ignore donc :

- combien de personnes voient l'étape 2 ;
- combien saisissent une ville, et laquelle ;
- si l'abandon suit l'affichage des frais ;
- si le CTA a été touché en étant grisé ;
- quelles erreurs apparaissent.

**On connaît la fuite, pas sa cause.** C'est pourquoi le plan commence par la mesure.

## 4. Mesures de rendu

Position du vrai CTA à l'arrivée sur l'étape 2, adresse vide.

| Appareil simulé | Écran | Hauteur étape | Haut du CTA | Sous le bord | Sous la barre fixe |
|---|---:|---:|---:|---:|---:|
| iPhone 14, FR | 844 | 965 | 1 072 | 228 px | 301 px |
| iPhone SE, FR | 667 | 965 | 961 | 294 px | 367 px |
| Android 360, FR | 640 | 965 | 948 | 308 px | 381 px |
| iPhone 14, AR | 844 | 955 | 1 085 | 241 px | 315 px |

Après sélection d'une ville, le CTA recule encore sur iPhone 14 (1 098 px au lieu de 1 072).

Sur iPhone 14, le haut et le bas fixes prennent environ 209 px, soit 25 % de l'écran.

Captures : `maquettes/actuel/`.

## 5. Anomalies

### Critiques, liées directement à la conversion

| # | Anomalie | Preuve | Fichier |
|---|---|---|---|
| A1 | Le vrai CTA est hors écran sur tous les formats | §4 | `AddressStep.tsx` |
| A2 | **Faux CTA** : « Je commande » reste visible à l'étape 2. Le tap déplace seulement la page (de 2 126 à 2 345 px sur iPhone 14) sans valider | Test navigateur | `StickyCartCTA.tsx` |
| A3 | **Deux prix à l'écran** : 218 dans le récapitulatif, 199 dans la barre, une fois la ville choisie (constaté en arabe) | `ar-iphone14-rempli.jpg` | `StickyCartCTA.tsx` |
| A4 | Le CTA paraît cassé : grisé à 40 %, aucune explication au tap | Code | `Button.tsx`, `AddressStep.tsx` |
| A5 | Frais découverts au dernier moment : jusqu'à 45 MAD, soit 45 % d'un panier à 99 MAD | Données §3 | Parcours |

### Majeures

| # | Anomalie | Preuve | Fichier |
|---|---|---|---|
| A6 | Erreurs de validation en français, quelle que soit la langue | Textes figés dans `addressFormSchema` | `AddressStep.tsx` |
| A7 | « Un instant… » figé en français pendant l'envoi | Texte figé | `Button.tsx` |
| A8 | L'indicateur d'étapes et le récapitulatif passent sous l'en-tête, texte flouté illisible | Captures | `WizardCartRecap.tsx` |
| A9 | Après choix de la ville en arabe, le champ affiche « Casablanca » en latin | `ar-iphone14-rempli.jpg` | `AddressStep.tsx` |
| A10 | « Code appliqué » et « code de fidélité » n'existent qu'en français et en arabe : la version anglaise affiche du français | Conditions `isArabic` | `AddressStep.tsx`, `WizardShell.tsx` |
| A11 | Aucun suivi entre étape 1 et étape 2 | §3 | Tracking |
| A12 | La liste de villes s'ouvre sur 288 px et couvre l'adresse. Avec le clavier, seule une partie reste visible | Capture | `CityAutocomplete.tsx` |

### Mineures

| # | Anomalie | Preuve | Fichier |
|---|---|---|---|
| A13 | 30 s annoncées, 61 s en médiane | §3 | Dictionnaires |
| A14 | Vide réservé au chargement du stock | Capture | `AddressStep.tsx` |
| A15 | « N° et nom de rue » ne convient pas aux adresses par quartier, fréquentes au Maroc (déduction) | Texte | Dictionnaires |
| A16 | La note de 161 px propose un code d'interphone, peu pertinent pour une partie de la clientèle (déduction) | Texte | Dictionnaires |
| A17 | Le commentaire de `AddressStep.tsx` annonce une livraison gratuite, alors que le texte réel parle de frais | Code | `AddressStep.tsx` |

## 6. Points à conserver

- La ville en texte libre : elle évite de bloquer une ville absente du catalogue.
- La recherche FR/AR et les villes populaires de `CityAutocomplete`.
- L'indication « paiement à la livraison ».
- La taille de 16 px sur les champs, qui évite le zoom automatique d'iOS.
- La reprise automatique du brouillon.
- `visualViewport` déjà géré dans `BottomSheet.tsx`, à réutiliser.
