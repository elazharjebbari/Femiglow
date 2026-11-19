# 04 — Développement

Aucune migration, aucune dépendance, aucune variable d'environnement obligatoire.

## 1. Fichiers

| Fichier | Rôle |
|---|---|
| `src/lib/checkout/step2-ack.ts` | Qui voit l'accusé : part réglée, `?ack=`, tirage stable par visiteuse |
| `src/components/checkout/wizard/LeadAckNotice.tsx` | La carte et la ligne repliée |
| `src/components/checkout/wizard/steps/AddressStepV2.tsx` | Affichage, repli, sous-titre |
| `src/lib/checkout/helpers/phone-mask.ts` | `formatLeadPhoneForDisplay` : `06 12 34 56 78`, ou rien si le numéro est incomplet |
| `src/lib/checkout/kit-checkout-config.ts`, `.server.ts` | Réglage `step2AckSharePct`, coupe-circuit `CHECKOUT_STEP2_ACK=off` |
| `src/lib/components/registry.ts` | Champ de l'admin, composant `kit-checkout` |
| `src/components/sections/KitCommanderSection.tsx` | Résolution côté navigateur, transmise au formulaire |
| `src/lib/checkout/state/wizard-store.ts`, `form-context-sync.ts` | `formContext.step2Ack` |
| `src/lib/checkout/i18n/` | Textes en trois langues |
| `src/lib/tracking/schemas.ts`, `use-address-step-tracking.ts` | `step2_ack` dans la mesure |
| `src/styles/globals.css` | Animation d'entrée |

Chemins relatifs à `apps/web`.

## 2. Conditions d'affichage

```
accusé affiché = formContext.step2Ack
              ET fiche non signalée en échec (store.syncDegraded = false)
              ET numéro de l'étape 1 lisible (0 puis 5, 6 ou 7, puis 8 chiffres)

carte complète = accusé affiché
              ET jamais repliée
              ET champ adresse pas encore ouvert
              ET champ ville vide
```

Repli : premier focus du champ ville sur écran tactile (`pointer: coarse`), première lettre tapée, ville déjà connue à l'arrivée.

## 3. Réglages

| Réglage | Où | Effet |
|---|---|---|
| `step2AckSharePct` | Admin, composant `kit-checkout`, groupe « Comportement » | 100 : toutes. 0 : aucune. Entre les deux : test, chaque visiteuse garde sa version |
| `CHECKOUT_STEP2_ACK=off` | `.env` du serveur, puis redémarrage | Coupe tout, sans passer par l'admin |
| `?ack=on`, `?ack=off` | URL | Force l'affichage pour une visite (recette, comparaison) |

Le champ de l'admin n'apparaît qu'après synchronisation du registre des composants (bouton de l'admin, route `POST /api/admin/components/sync-registry`). Sans synchronisation, la valeur par défaut s'applique : 100.

Clé de tirage : `kit-step2-ack`. Ne jamais la changer après le lancement d'un test.

## 4. Mesure

| Événement | Ajout |
|---|---|
| `address_step_view` | `step2_ack` : vrai si la visiteuse est dans le bras « avec accusé » |
| `address_step_abandon` | `step2_ack` |

Aucun prénom ni numéro dans les événements. Ces événements dépendent du consentement aux cookies ; la part de commandes, elle, se lit en base sans cette limite.

## 5. Ce qui n'est pas touché

- Création de la fiche et de la commande, calcul des frais, devis signé, stock.
- Envoi au CRM, délai d'abandon, webhooks.
- Achats et prospects envoyés à Meta, TikTok, Google.
- Étape 1, écran de remerciement, ancienne étape 2 (`AddressStep`).
- Formulaire de `/commander` : il ne reçoit pas `step2Ack`, donc pas d'accusé.

## 6. Compatibilité au moment de la bascule

| Cas | Effet |
|---|---|
| Onglet ouvert avec l'ancien code, serveur nouveau | L'ancien code n'envoie pas `step2_ack` : champ facultatif, accepté |
| Retour à l'ancienne version, onglet ouvert avec le nouveau code | Les événements `address_step_view` et `address_step_abandon` de ces onglets sont refusés par l'ancien serveur (champ inconnu). Seule la mesure est touchée, pas la commande |
