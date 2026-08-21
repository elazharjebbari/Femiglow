# Migration compte Google Ads — `18136327114` → `18401598819`

**Date** : 2026-08-21 · **Auteur** : audit tracking · **Scope** : conteneur GTM `GTM-M8K7V88D` + config `tracking_plans`.

## Contexte

Vérification demandée : les conversions Google Ads (Ajout au panier, Paiement initié, Page
vue, Contact, Achat) partent-elles correctement ? **Non.** Le décodage des libellés a prouvé
que **tout le système pointait sur l'ancien compte `18136327114`** alors que les conversions
actives vivent désormais sous **`18401598819`**. Résultat : aucune conversion n'arrivait dans
le bon compte, Google Ads optimisait sur des conversions abandonnées.

> Décodage protobuf du libellé gtag (base64) : champ 2 = ID de conversion. Tous les libellés
> fournis décodent vers `18401598819` ; tous ceux du conteneur vers `18136327114`.

## Ce qui a été modifié (dans le repo)

### 1. `gtm-container-production.json` (export à réimporter dans GTM)
- **Tag `Ads Cfg` (googtag)** : `AW-18136327114` → `AW-18401598819`
- **`CONST - Google Ads Conversion ID`** : `18136327114` → `18401598819` (numérique nu — voir note*)
- **Libellés migrés** :

| Événement | Clé libellé | Ancien | **Nouveau** |
|---|---|---|---|
| Ajout au panier | `add_to_cart` | `ZVduCOeh1q0cEMrHichD` | **`CuuWCIb2yeUcEOO6yMZE`** |
| Paiement initié | `checkout_intent` | `ZTOlCKWt1q0cEMrHichD` | **`kmgRCN2V1eUcEOO6yMZE`** |
| Contact (chat) | `chat_contact` | `2KJSCJScv60cEMrHichD` | **`ebUoCP-MyuUcEOO6yMZE`** |
| Achat | `purchase` | `UGxLCMGJv6wcEMrHichD` | **`tG9FCLK21OUcEOO6yMZE`** |
| Envoi de formulaire de lead | `lead` | `6KMGCKHB1q0cEMrHichD` | **`s1O3CI3OyuUcEOO6yMZE`** |
| Page vue *(nouveau, secondaire)* | `page_view` | — | **`SDU7CMrM2OUcEOO6yMZE`** |

- **Nouveau tag** `Ads Conv — page_view → page_view (secondaire)` — déclencheur `50` (CE page_view),
  sans valeur ni orderId (événement secondaire / observation).
- **Ponts lead → Achat** (2 nouveaux tags awct, label = Achat) :
  - `Ads Conv — generate_lead→Achat` — trigger `82` (generate_lead, method chat/abandoned_cart)
  - `Ads Conv — lead_capture→Achat` — trigger `83` (lead_capture, method wizard)
  - `orderId = {{DLV - meta_purchase_eid}}` (jpid) → dédup Google Ads par orderId.
- **Anti-double-comptage** : le tag `Ads Conv — purchase → purchase` reçoit
  `blockingTriggerId = [79]` (BLK — cookie `fg_meta_lead_purchase` présent). Réplique exacte du
  pont Meta : si un lead a déjà compté l'Achat, l'achat réel ne le recompte pas.
- **7 conversions orphelines retirées** (absentes du nouveau compte) : `chat_widget_open`,
  `contact_submit`, `fg_journal_read_100`, `file_download`, `newsletter_submit`, `sign_up`,
  `video_complete`. Leurs libellés pointaient l'ancien compte ; réactivables si recréées côté Ads.
- **Conversion Linker ajouté** (`gclidw`, All Pages, priorité 100) — il manquait. Indispensable
  pour capter le `gclid` dans les cookies first-party `_gcl_*` et attribuer les conversions aux
  clics Ads. Fire avant les tags de conversion.

### 2. Config `tracking_plans.env_profiles[production].config` (DB)
`googleAdsConversionId` → `AW-18401598819`, libellés alignés sur le tableau ci-dessus,
orphelins supprimés. (Config d'outillage app ; le runtime réel = le conteneur GTM.)

### 3. `infra/gtm/container.production.json` (généré) — ID + libellés alignés.

> **\*Note format** : les tags de conversion (`awct`) exigent le `conversionId` **numérique nu**
> (`18401598819`). Seul le tag `googtag` (Ads Cfg) porte le préfixe `AW-`. Passer `AW-…` à un awct
> produit `AW-AW-…` et Google ne compte rien (cf. commentaire `plan/exporter.ts`).

## Dédup lead → Achat (comment ça marche)

Le cookie `fg_meta_lead_purchase` (jpid, TTL 24 h, flag `NEXT_PUBLIC_META_LEAD_AS_PURCHASE_ENABLED=true`
**actif en prod**) sert de clé de parcours :

- **Parcours avec lead chat** → le lead tire `Achat` (`orderId = jpid`). L'achat réel est **bloqué**
  (trigger 79). → **1 seul Achat**.
- **Achat direct (sans lead)** → cookie vide → l'achat réel tire `Achat` (`orderId = transaction_id`). → **1 seul Achat**.
- **Plusieurs events lead même parcours** (generate_lead + lead_capture) → même `orderId = jpid` →
  Google Ads déduplique. → **1 seul Achat**.

## Validation effectuée
- Décodage : les 6 libellés → `18401598819` ✅
- Intégrité conteneur : JSON valide, 109 tags, **toutes** les références (triggers/folders/variables) résolues ✅
- `18136327114` : **0 occurrence** dans les 2 conteneurs ✅
- Suite de tests tracking : **357/357 verts** ✅
- Émission app confirmée « comme Meta » : add_to_cart (clic CTA→form), checkout_intent (1ʳᵉ frappe),
  chat_message_sent (chat), purchase (page merci) — mêmes déclencheurs que les tags Meta.

## ⚠️ Actions restantes (côté toi — je ne peux pas les faire)

1. **GTM** : importer `gtm-container-production.json` dans l'espace de travail `GTM-M8K7V88D`
   (Admin → Importer un conteneur → *Fusionner* → *Écraser les conflits*), vérifier l'aperçu, **publier**.
2. **Google Ads (compte `18401598819`)** :
   - Classer **« Page vue » en action secondaire** (Objectifs → Achat/… → configuration objectif : secondaire/observation).
   - Vérifier que **Enhanced Conversions** est activé sur Achat/Lead (les tags l'ont en mode auto).
   - Confirmer que Achat/Ajout panier/Paiement initié/Lead sont bien **primaires**.
3. **Test** : parcours `/kit` avec **Google Tag Assistant** → vérifier les pings
   `AW-18401598819/<libellé>` (et un seul Achat sur un parcours chat→commande).

## Rollback
`git checkout -- gtm-container-production.json infra/gtm/container.production.json` puis restaurer
la config DB (ancien ID `AW-18136327114`). L'ancien conteneur reste dans l'historique GTM (versions).

## Points hérités à surveiller (hors scope de cette migration)
- `checkout_intent` et `chat_message_sent` ont `orderId = transaction_id` (vide au moment du tir)
  → pas de dédup native ⇒ potentiel sur-comptage si l'event se répète. Comportement préexistant.
