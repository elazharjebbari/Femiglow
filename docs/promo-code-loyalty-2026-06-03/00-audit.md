# 00 — Audit du système de codes promo / crédit fidélité

## Besoin cible
À la fin de la commande, remettre à la cliente un **code mémorable** qui :
- **s'active après X jours** dépendant de la **ville de livraison** (durée max de livraison) ;
- est **réutilisable plus tard** pour une autre commande avec une réduction ;
- est **unique par numéro de téléphone**.
Plus : pilotage admin (visibilité/gestion des codes émis), surface visiteur (affichage du code en fin de commande).

## État actuel (Phase 3 — `coupon_grants`)
Briques présentes : table `coupon_grants` (code, leadId, sourceOrderId, valueCents, status issued/redeemed/expired, expiresAt) ; `issueGrant` (émis à la commande, idempotent par order) ; `validateGrant`/`redeemGrant` (usage unique + expiration) ; repricing `couponCode` au checkout (server-authoritative) ; template `post_purchase` piloté en admin (valeur).

## Matrice de couverture

| Exigence | Actuel | Verdict | Action |
|---|---|---|---|
| Code remis en fin de commande | `issueGrant` émet (serveur) | ⚠️ émis mais **non affiché** | Renvoyer le code dans la réponse + l'afficher (ThankYouStep) |
| Code **mémorable** | `FG-XXXXXX` aléatoire | ⚠️ semi | Générateur mémorable `FG-<MOT>-<NNNN>` |
| **Activation différée** (X j) | `expiresAt` seulement, pas de date de début | ❌ | Champ `activates_at` + contrôle dans `validateGrant` |
| Délai = **durée max livraison ville** | `deliveryEta` = texte | ❌ | Parser ETA → jours max + buffer → `activates_at` |
| Réutilisable avec réduction | `redeemGrant` + repricing | ✅ | — |
| **Unique par téléphone** | code unique global, pas par phone | ❌ | `phone_e164` sur grant + index unique partiel (1 actif/phone) |
| Usage unique + expiration | `redeemed` + `expiresAt` | ✅ | — |
| **Gestion admin** des codes | aucune (templates seulement) | ❌ | Route + écran liste/recherche des grants |

## Risques & invariants
- **Server-authoritative** : la valeur et l'activation sont validées serveur (jamais de remise non méritée).
- **Anti-fraude** : 1 code actif par téléphone (pas de farming) ; le code ne devient utilisable qu'après la fenêtre de livraison (la cliente a reçu sa 1ʳᵉ commande).
- **Idempotence** : 1 grant par commande source (déjà en place).
- **Non-régression** : champs additifs (migration sans downtime) ; comportement inchangé si le template post_purchase est inactif.
