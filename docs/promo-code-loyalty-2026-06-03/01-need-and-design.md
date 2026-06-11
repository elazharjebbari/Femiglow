# 01 — Besoin, résolution, UX/UI, design

## 1. Besoin résolu (acceptance)
> À la création d'une commande, le serveur émet **un** code de fidélité **mémorable**, rattaché au **téléphone** de la cliente (un seul code actif par téléphone), **activable à `commande + durée_max_livraison(ville) + 1 j`**, **valable N jours** après activation. Le code est **affiché en fin de commande** (et stocké) ; il est **réutilisable une fois** sur une commande ultérieure, validé et consommé **côté serveur**. L'admin **voit et gère** les codes émis.

## 2. Décisions de conception
- **Format mémorable** : `FG-<MOT>-<NNNN>` où `<MOT>` ∈ liste voix maison (`RITUEL, ATLAS, SAUGE, ECLAT, ACCUEIL, MAISON, GESTE, ATELIER, LUMIERE, SAISON`) et `<NNNN>` = 4 chiffres. Ex. `FG-ATLAS-2048`. Prononçable, dictable au téléphone, faible collision (10 mots × 10⁴ = 10⁵, + unicité DB).
- **Activation** : `activates_at = orderDate + maxDeliveryDays(ville) + 1 j` (buffer). `maxDeliveryDays` = parse de `delivery_eta` (ex. « 48 à 72 h » → 3 j) ; défaut sûr 3 j capitale / 4 j reste si non parsable.
- **Validité** : `expires_at = activates_at + 60 j` (fenêtre d'usage après activation, pas dès l'émission).
- **Unicité par téléphone** : `phone_e164` sur le grant + index unique partiel `(phone_e164) WHERE status='issued'` → un seul code actif par téléphone. À l'émission, si un grant `issued` existe déjà pour ce téléphone, on le **réutilise** (pas de doublon).
- **Server-authoritative** : `validateGrant` contrôle `not_found / already_redeemed / expired / not_yet_active`. Le repricing au checkout n'applique que si valide.

## 3. UX / UI — surface visiteur (fin de commande)
Sur le **ThankYouStep**, sous la confirmation, un bloc calme « geste de fidélité » :

```
┌───────────────────────────────────────────────┐
│  ✓ Votre commande est confirmée                 │
│                                                 │
│  Un geste pour votre prochaine visite           │
│  ┌───────────────────────────────┐             │
│  │      FG-ATLAS-2048            │  (copiable)  │
│  └───────────────────────────────┘             │
│  20 MAD sur votre prochaine commande.           │
│  Utilisable à partir du 12 juin · valable 60 j. │
│  Gardez-le — il est lié à votre numéro.         │
└───────────────────────────────────────────────┘
```
- Code en **médaillon crème/filet sauge**, `tabular-nums`, gros, **bouton copier** discret (icône, pas d'emoji).
- Mention activation civile (« à partir du 12 juin ») — **pas de countdown**.
- Voix maison : « Un geste pour votre prochaine visite », « Gardez-le ». Pas de « promo/code promo ».
- Accent terracotta uniquement sur la valeur (« 20 MAD »), cohérent Kolenda §4.6.

## 4. UX / UI — surface admin (`/admin/coupons` → onglet « Codes émis »)
- Table : code · téléphone (masqué partiel) · valeur · statut (émis/activé/utilisé/expiré) · activation · expiration · commande source/redeem.
- Filtres : par téléphone, par statut. Lecture seule (V1) + action « invalider » (P2).
- Stat rapide : émis / activés / utilisés (taux de réutilisation).

## 5. Tokens & charte
- Médaillon code : `bg-creme/60`, `border border-sauge/40`, `rounded-md`, code `font-display tabular-nums tracking-wide text-encre`.
- Valeur : terracotta `#C28A6E`. Activation/validité : `text-encre/55`, `text-xs`.
- Bouton copier : `text-sauge`, icône SVG, `:active` feedback. `prefers-reduced-motion` respecté (feedback « Copié » sans animation agressive).
- **Interdits** : countdown, rouge, sticker, emoji, « promo/deal », majuscules d'emphase.
