# Mise en production : correctifs du tunnel /kit et « Ma ville »

Runbook préparé le 11/11/2026. Branche `fix/kit-bugs-graves`, partie de `4e44ec07` (la prod sert `962d9219` + scripts d'exploitation de `fix/stock-visible-admin`).

## 1. Ce qui part en production

| Commit | Contenu |
|---|---|
| `25b3e81a` | Six bugs graves : erreurs 409/422 plus rejouées, téléphone haché avec 212, `view_item` serveur supprimé, commande passée figée, devis de prix signé, limite de débit |
| `543872b6`, `dcde6e45` | Script d'import du contenu prod vers la base locale (outil, rien en prod) |
| `bb6f485e` | « Ma ville » : livraison chiffrée sous le prix, panneau de ville, total exact, ville reprise à l'étape 2, bouton de confirmation dans le formulaire |
| à commiter | Prix barré du récapitulatif aligné sur l'étape 2 avec un code promo, scénario e2e GLOW99 |

**Ce qui ne change pas** : aucune migration, aucune dépendance, ni `middleware.ts` ni `next.config.mjs`. Retour arrière = remettre l'ancien `.next`.

**Nouvelle variable** : `PRICE_QUOTE_SECRET` (≥ 32 caractères). Sans elle, le site marche, mais le devis signé est inactif (la commande reprice comme avant).

**Coupe-circuit** : `CHECKOUT_RATE_LIMIT_OFF=1` dans `.env` puis redémarrage désactive la limite de débit.

## 2. Effets attendus après mise en ligne

| Indicateur | Attendu |
|---|---|
| Erreurs 409/422 rejouées | Disparaissent |
| ViewContent côté serveur (Meta, TikTok) | Baissent : seul le navigateur l'envoie, relayé par `/api/track`. Normal |
| Qualité de correspondance Lead/Purchase (Meta EMQ, Google EC) | Monte : téléphone haché avec 212 |
| Clientes qui voient leurs frais | Avant le formulaire, sous le prix |
| Panier moyen affiché | Inchangé (même prix, mêmes frais) |

## 3. Préparation (sur le Mac, la veille ou une heure avant)

1. **Commiter** le dernier correctif (prix barré + e2e GLOW99).
2. **Relecture indépendante** des deux derniers commits (`bb6f485e` et le correctif), corrections éventuelles, tests relancés.
3. **Pousser** la branche : `git push -u origin fix/kit-bugs-graves`. Ouvrir une PR vers `fix/stock-visible-admin` pour la trace.
4. **Écarter la config locale** : `mv apps/web/.env.production.local ~/femiglow-env-local.bak`. ⚠️ Sinon `next build` la lit : le build embarquerait l'adresse de la base de test et les pages statiques seraient générées avec les données locales.
5. **Compiler** : `bash bin/compiler-mac.sh` (Node 22, variables `NEXT_PUBLIC_` lues sur le serveur).
6. **Contrôler le build** :
   - `grep -rl "55432\|femiglow_test" apps/web/.next | head` doit être vide ;
   - `grep -rl "delivery-estimate" apps/web/.next/static | head -1` doit trouver un fichier.

## 4. Fenêtre de mise en ligne

Heure creuse (avant 9 h ou après 23 h, heure du Maroc), hors pic de campagne. Prévenir les autres sessions et worktrees (`femiglow-wt-stock`, `Femiglow-kit-cro`, `Femiglow-tiktok-tracking`) : aucun déploiement d'une autre branche ensuite, sous peine de retirer ces correctifs. `fix/tiktok-tracking` n'est pas incluse.

### 4.1 Sur le serveur, avant la bascule

```bash
ssh alfenna
cd /var/www/femiglow
df -h / | tail -1                       # au moins 3 Go libres
sudo -u postgres pg_dump -Fc femiglow > /var/backups/femiglow/pre-ma-ville-$(date -u +%Y%m%dT%H%M%SZ).dump
cp apps/web/.env apps/web/.env.pre-ma-ville
# Secret du devis, généré sur place (ne transite pas) :
grep -q '^PRICE_QUOTE_SECRET=' apps/web/.env || echo "PRICE_QUOTE_SECRET=$(openssl rand -hex 32)" >> apps/web/.env
# Source alignée sur ce qui va tourner (pas de build sur le serveur) :
git fetch -q origin fix/kit-bugs-graves && git checkout -q -B fix/kit-bugs-graves origin/fix/kit-bugs-graves
git log --oneline -1
```

### 4.2 Installation sans coupure (depuis le Mac)

`bash bin/deployer-stock.sh installer` envoie le `.next` compilé, le démarre sur le port 8019, vérifie `/`, `/kit`, `/ar/kit`, l'admin, le stock et un chunk JS, puis bascule et redémarre. En cas d'échec à l'essai : aucune bascule. En cas d'échec après bascule : retour automatique à `.next-prev`.

À ajouter à l'essai sur 8019 avant la bascule (à intégrer au script ou à lancer à la main pendant l'essai) :

```bash
curl -s http://127.0.0.1:8019/kit | grep -c 'data-testid="delivery-estimate"'   # ≥ 1
curl -s http://127.0.0.1:8019/kit | grep -o '19 à 45 MAD[^<]*' | head -1         # fourchette lue en base
curl -s http://127.0.0.1:8019/kit | grep -c 'priceQuote'                          # ≥ 1 : secret chargé
```

## 5. Contrôles juste après la bascule (15 minutes)

1. **Pages** : `/kit` et `/ar/kit` en 200, en navigation privée sur un vrai téléphone.
2. **Ligne livraison** : « Livraison 19 à 45 MAD selon votre ville » sous le prix.
3. **Panneau** : « Ma ville » → Marrakech → « Total à la réception 234 MAD » ; la barre fixe affiche 234.
4. **Formulaire** : étape 2 avec la ville déjà cochée ; l'adresse saisie fait apparaître le bouton intégré.
5. **Code promo** : `/kit?code=GLOW99` → 99 MAD ; Marrakech → 134 MAD partout ; prix barré 234 au récapitulatif et à l'étape 2.
6. **Une commande test réelle** (prénom « TEST », ton numéro) : vérifier en base `total_cents`, `shipping_cents`, `discount_cents`, puis annuler la carte Trello et la commande Baiti.
7. **Limite de débit** (prouve que l'IP réelle est lue derrière LiteSpeed) :

   ```bash
   for i in $(seq 1 11); do curl -s -o /dev/null -w '%{http_code} ' -X POST https://femiglow-maroc.com/api/checkout/stock-notify -H 'content-type: application/json' -d '{}'; done
   ```

   Attendu : dix réponses 400 puis un 429. Si les onze sont en 400, l'IP n'est pas transmise et la limite est inactive (sans danger pour les clientes ; corriger la config LiteSpeed plus tard).
8. **Préchauffage des images** `/_next/image` (le cache est remplacé à chaque installation).

## 6. Surveillance

**Premières heures** :
- commandes par heure contre le même jour de la semaine précédente ;
- journal du service : `journalctl -u femiglow --since "-1h" | grep -E "checkout.order|rate_limited|error"` ;
- aucun `price_mismatch` ni `stock_insufficient` en rafale.

**48 heures** :
- part des commandes à 19 / 35 / 39 / 45 MAD ;
- abandons après le choix de la ville (requête prête dans le rapport d'audit) ;
- Meta Events Manager : ViewContent serveur en baisse (attendu), EMQ Lead/Purchase en hausse.

**Une à deux semaines** : taux de colis livrés et refusés, à comparer aux deux semaines d'avant. C'est le vrai critère.

## 7. Retour arrière

| Situation | Action | Délai |
|---|---|---|
| Problème général | `cd /var/www/femiglow/apps/web && mv .next .next-failed && mv .next-prev .next && systemctl restart femiglow` | < 1 min |
| Limite de débit gênante | `CHECKOUT_RATE_LIMIT_OFF=1` dans `.env`, redémarrage | < 1 min |
| Devis signé en cause | retirer `PRICE_QUOTE_SECRET` de `.env`, redémarrage | < 1 min |
| Données | restaurer le dump `pre-ma-ville-…` (aucune migration : peu probable) | 10 min |

Après un retour arrière, remettre la source du serveur sur l'ancien commit (`git checkout -q fix/stock-visible-admin`) pour garder source et build alignés.

## 8. Après la mise en ligne

- Mettre à jour la mémoire : branche servie `fix/kit-bugs-graves`, commit et build.
- Admin (sans déploiement) : retirer « Livraison partout au Maroc » de la réassurance du hero (`kit-hero-produit`), redondante avec la ligne chiffrée.
- Suites prévues : ligne unique de remise avec GLOW99, événement de mesure `delivery_city_selected`, test A/B mesuré sur les commandes livrées, relecture de l'arabe.
- Remettre la config locale : `mv ~/femiglow-env-local.bak apps/web/.env.production.local`.
