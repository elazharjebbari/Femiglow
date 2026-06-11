# 00 — Analyse du besoin

## 1. Le besoin

Le coupon d'accueil auto-appliqué (−90 MAD) est **visible sur la page `/kit`** (module `CouponWelcomeNote` dans le bloc « Le Pack ») mais **disparaît dans le tunnel de paiement** (`KitCommander`/wizard). Or le wizard est **la seconde zone de décision** (Kolenda §4.6) : c'est là que la cliente engage l'achat. Ne pas y rappeler le geste d'accueil, c'est :
- perdre le **renfort de valeur** au moment le plus sensible (douleur de paiement, Pricing §10/§12) ;
- créer une **incohérence narrative** (le « geste d'accueil » vu plus haut s'évapore) ;
- laisser le récap panier afficher une remise « nue » (199 barré 289) **sans histoire**, exactement le travers que `coupon-auto-appliqué.md` dénonce (« remise permanente / prix gonflé »).

**Besoin** : rappeler, dans le récap du wizard, que **le prix 199 est un geste d'accueil** et matérialiser **l'économie (90 MAD)** — sobrement, sans transformer le tunnel en page promo.

## 2. La tension centrale (à tenir)

| Mandat | Ce qu'il pousse | Risque de dérive |
|---|---|---|
| **Convertir** (Kolenda Pricing/Attention) | Rappeler l'économie absolue, ancrer 289→199 au paiement | Empiler un 2ᵉ objet saillant → dilue le CTA |
| **Préserver l'identité** (Kolenda Luxury + coupon-doc) | Voix « geste/accueil », calme, adossé à la preuve | Sticker « promo », rouge, countdown → trahit la maison |

## 3. Contraintes croisées (non négociables)

### Issues de `FEMIGLOW-KIT-PLAYBOOK.md`
- **Une seule zone saillante par viewport** (§2.4, Attention §6) → le CTA reste dominant ; la mention coupon est calme.
- **Un seul point chaud (terracotta) sur la page** (Color §1) → MAIS §4.6 autorise explicitement l'« Économie » en terracotta comme **seul mot chaud de la zone deal**. Le wizard étant une zone de décision focalisée, un **accent terracotta minimal sur « Économie 90 MAD »** est admissible et cohérent.
- **Économie absolue > %** (Pricing §6) → afficher « Économie 90 MAD », **jamais** « −31 % ».
- **`tabular-nums`** sur tous les chiffres (Pricing, §2.3).
- **Anchoring horizontal** 289 barré (≈60 %) / 199 (Pricing §1-2) — déjà en place dans le récap.
- **Voix** (§2.1) : pas d'exclamation, pas d'emoji, pas de majuscules d'emphase, pas de « promo/deal/VIP ». Vocabulaire « geste / accueil / maison ».
- **Anti-patterns** (§6) : pas de countdown, pas de « −X% » seul, pas de rouge, pas de sticker, pas de prix `199,00`.
- **Trust row collée** (Copywriting §6) : la mention vit **près** de la réassurance.

### Issues de `coupon-auto-appliqué.md`
- **Module inline calme**, « un coupon, un endroit, une histoire de prix » (§Guidelines 1).
- Auto-appliqué de type **« Votre geste d'accueil est appliqué »**, **prix final immédiat** (§Guidelines, pattern).
- **Adossé à la preuve/réassurance** (§Guidelines 4).
- **Pas de friction** : aucun champ ouvert par défaut ; pas de pop-up agressif.
- **Sobriété visuelle** : crème/encre, accent sauge/champagne parcimonieux, filet fin, pas de rouge retail, pas de countdown, pas d'emoji (§Guidelines 5).

## 4. État actuel (ce qui existe)

- `WizardCartRecap` (`apps/web/src/components/checkout/wizard/WizardCartRecap.tsx`) : affiche `199 MAD` + `289 MAD` barré (`compareAt`) + ligne crédit fidélité (Phase 3) si applicable. **Ne mentionne pas** le geste d'accueil.
- Le coupon welcome_auto est résolu côté serveur pour `/kit` (`ProductFeedSectionBound`) mais **pas** transmis au wizard.
- `KitCommanderSectionBound` (server) construit `initialCart` via `projectCartSnapshotFromVariant` et le passe au wizard. Le snapshot porte `totalCents` (199) + `compareAtTotalCents` (289) → **l'économie 90 est déjà calculable** (compareAt − total).

## 5. Formulation du besoin résolu (acceptance)

> Quand un coupon `welcome_auto` est **actif** (treatment), le récap du wizard affiche une **mention « geste d'accueil » calme** avec l'**économie absolue (90 MAD)**, adossée à la trust row, en tokens maison + `tabular-nums`, sans créer de second élément saillant ni aucun marqueur « promo ». Quand le coupon est inactif, le récap reste **strictement inchangé** (non-régression). Le tout piloté par l'admin (activer/pauser/valeur) et cohérent avec l'affichage `/kit`.
