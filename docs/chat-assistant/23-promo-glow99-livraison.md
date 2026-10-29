# Chat — code promo GLOW99 et livraison payante (29/10/2026)

## Objectif

1. Le chat connaît l'offre en cours : code **GLOW99**, Pack à **99 dh** au lieu de 199 dh,
   jusqu'au 30/11/2026 (coupon `cpn_uw5ga7gj4ei44yvr`, plafond 500). Toute réponse qui parle
   de prix ou de commande cite le code et le prix remisé.
2. La livraison n'est plus offerte. Si on la demande : le tarif est généreux, il dépend de la
   ville, une conseillère le confirme → on propose de laisser son contact (formulaire).
3. Une question rapide « code promo » en tête des suggestions (/kit et accueil), qui répond
   et ouvre le formulaire de commande.
4. Le lead capté par le chat porte le prix remisé : valeur `generate_lead` = 99, webhook CRM
   avec `total_price`, `discount_amount`, `coupon_code` et la note `promo:GLOW99 -100 MAD`.

## Principe : l'offre est lue en direct, jamais écrite en dur

`src/lib/chat/promo-offer.ts` lit le coupon GLOW99 (`validatePromoCode`) et le prix catalogue
(`getKitLeadValue`, 199). Cache mémoire 60 s. Quand le coupon expire, est désactivé ou atteint
son plafond, tout retombe seul :

| Surface | Offre active | Offre inactive |
| --- | --- | --- |
| Consigne système | bloc « Offre en cours » ajouté (code, prix, date) | bloc « aucun code actif, n'en invente pas » |
| FAQ (réponse servie telle quelle) | jetons `{{promo_code}}`, `{{promo_price}}`, `{{list_price}}`, `{{promo_end}}` remplacés | entrée à jetons ignorée → le LLM répond |
| Questions rapides | libellé et réponse rendus avec les jetons | question à jetons masquée |
| Lead chat | valeur 99 + code dans le webhook | valeur catalogue, pas de code |

## Changements

- **Code** : `promo-offer.ts` (nouveau), orchestrateur (bloc offre + FAQ à jetons), service et
  repo des questions rapides (rendu + masquage), intention « code promo » → `purchase-intent`
  (formulaire de commande, plus le pivot « négociation »), route lead + webhook chat.
  La négociation (rabais, baisser le prix, prix spécial) reste escaladée à une humaine.
- **Consigne v6** (base, fr/ar/darija) : la règle « code promo = négociation » est retirée ;
  règles prix (citer le code et 99 dh), livraison (généreuse, selon la ville, contact),
  codes inventés refusés. Les valeurs par défaut du code (`instruction-defaults.ts`) suivent.
- **Contenus en base** : FAQ prix réécrites avec jetons, FAQ livraison (coût, délais) et
  paiement alignées sur la fiche produit (COD, Rabat 24 h / Maroc 48–72 h), `price-unit-fr`
  désactivée (prix de soins de peau d'un ancien produit). Nouvelle question rapide
  `promo-glow99` (ordre 1). Questions rapides publiées réécrites quand elles décrivaient un
  produit de soin de la peau au lieu du kit manucure.

## Plan de test

### Automatisé (vitest, sans LLM)
- `promo-offer` : actif / expiré / plafond / inactif, rendu des jetons fr-ar-darija, date au
  fuseau du Maroc, bloc de consigne présent ou « aucun code ».
- Intention : « code promo », « coupon », « GLOW99 », « كود التخفيض », « 3ndkom code promo »
  → `purchase-intent` ; « baissez le prix », « un rabais ? », « prix spécial » → `negotiation`.
  Golden sets existants inchangés (non-régression).
- Questions rapides : jetons rendus, pair masquée sans offre, max 4 conservé.
- Lead : valeur 99 si offre, 199 sinon ; webhook avec `coupon_code` et note.
- Suites chat existantes, garde-fou `kit-facts`, `tsc`, lint.

### En réel, en prod, après déploiement (script `scripts/chat-eval-promo.ts`)
Conversations réelles via `/api/chat/session` + `/api/chat/message` (SSE) — **aucun
formulaire soumis** (pas de faux lead). Chaque cas vérifie des règles :
- prix / commande / promo (fr, ar, darija) : cite `GLOW99` et `99`, jamais `199` seul ;
- livraison : jamais « offerte / gratuite / مجاني », ton « généreux », renvoi conseillère,
  formulaire proposé ;
- faux codes (« GLOW50 », « donne-moi 50 % ») : pas de remise inventée ;
- négociation : pas de nouvelle remise, escalade ;
- non-régression : composition, halal, rituel, délais, paiement, retour, salutation,
  hors-sujet, jailbreak → réponses cohérentes avec la fiche, pas de vocabulaire « peau ».
- question rapide `promo-glow99` en tête, réponse rendue, formulaire déclenché.
Le rapport (réponse complète + verdict par règle) est relu à la main.
