# Tracking — Quickstart fondatrice

> **Pour qui :** Yasmine, fondatrice de FemiGlow.
> **Objectif :** comprendre ce qui se passe sous le capot, savoir où regarder pour vérifier que tes pixels marchent, savoir comment activer/désactiver chaque outil sans toucher au code.

---

## 1. Le grand principe

Le tracking de FemiGlow suit **trois règles** :

1. **Rien ne part avant ton accord.** Tant que la cliente n’a pas cliqué sur « Tout accepter » dans le bandeau, aucun événement n’est envoyé à Meta, Google, TikTok… Le mode est *« denied »* par défaut (Consent Mode v2).
2. **Tout passe par notre serveur.** Quand un événement se produit côté navigateur (ex. ajout au panier), il est d’abord envoyé à `/api/track` (notre serveur). C’est ensuite **notre serveur** qui parle aux pixels via leurs APIs (CAPI Meta, MP Google, TikTok Events API…). Avantage : les bloqueurs de pubs et iOS ne suppriment plus rien.
3. **Tu pilotes depuis l’admin.** Tu n’as **pas besoin** de toucher au code pour activer Meta, désactiver TikTok, ou tester un event. Tout est dans `/admin/tracking`.

---

## 2. Le tableau de bord

L’admin tracking a 7 onglets (`/admin/tracking`) :

| Onglet | À quoi ça sert |
|---|---|
| **Vue d’ensemble** | KPI 24 h : nombre d’events, conversions, pixels actifs. |
| **Inventaire** | Liste des composants/pages détectés automatiquement. |
| **Événements** | Catalogue complet des events suivis (taxonomie GA4). |
| **Pixels** | Activer/configurer Meta, Google, TikTok, Snap, Pinterest, GTM, custom. |
| **Tester** | Envoyer un event simulé pour voir s’il arrive bien chez Meta/Google. |
| **Logs** | Flux temps réel des events (rafraîchi toutes les 5 s). |
| **Réglages** | Vérifier l’environnement (clés, cron, consent). |

---

## 3. Activer un pixel — exemple : Meta

1. Aller dans `/admin/tracking/providers`.
2. Cliquer sur **Configurer** à côté de *Meta (Facebook/Instagram)*.
3. Renseigner :
   - **Pixel ID** : 16 chiffres, donné dans Business Manager.
   - **CAPI Token** : généré dans *Events Manager > Paramètres > Conversions API > Générer un token*.
   - **Test Event Code** : `TEST12345` pendant le réglage, à vider en production.
   - **Events activés** : laisser vide pour tout suivre, ou cocher uniquement `purchase, generate_lead, add_to_cart`.
4. Cliquer **Enregistrer**, puis **Activer**.
5. Aller dans `/admin/tracking/test`, choisir `purchase`, cocher *« Mode dry-run »* pour vérifier que le format est bon, puis décocher pour envoyer pour de vrai.
6. Dans **Events Manager Meta > Tester les événements**, vérifier que l’event apparaît avec le code de test.

> 💡 Le token CAPI est **chiffré** en base avec AES-256-GCM. Personne (même les développeurs) ne peut le relire en clair après enregistrement.

---

## 4. Lire les logs

`/admin/tracking/logs` affiche les 100 derniers events.

Chaque ligne :

- **Reçu** : heure d’arrivée serveur.
- **Event** : nom standardisé (`page_view`, `add_to_cart`, `purchase`…).
- **Route** : chemin de la page.
- **Conv.** : ✦ vert si conversion (purchase, generate_lead, sign_up).
- **Providers** : pixels qui ont reçu l’event avec succès.

Cliquer sur une ligne ouvre un panneau latéral avec :
- L’`eventId` unique (utile pour dédupliquer côté Meta).
- Le détail de chaque provider : statut (`sent` / `skipped` / `failed`), code HTTP, latence, message d’erreur.

> ⚠ Si tu vois `skipped: consent_denied`, c’est normal : la cliente n’a pas accepté le pixel concerné.

---

## 5. Tester un événement

`/admin/tracking/test` permet de simuler n’importe quel event :

1. Choisir l’event dans la liste (ex. `purchase`).
2. Modifier le JSON des paramètres si tu veux tester avec une autre valeur.
3. **Mode dry-run coché** : aucun appel réel — juste pour valider le format.
4. **Décoché** : envoie pour de vrai aux pixels actifs (utile pour matcher dans Meta/Google).

L’`eventId` retourné est ton numéro de série pour vérifier dans le dashboard du pixel.

---

## 6. Ce qui se passe côté cliente

| Action de la cliente | Event émis | Provider concerné |
|---|---|---|
| Ouvre une page | `page_view` | tous |
| Lit ≥ 75 % d’un article | `journal_read_75` | GA4 |
| Clique « Ajouter au rituel » | `add_to_cart` | Meta + Google + TikTok |
| Soumet la newsletter | `newsletter_submit` puis `generate_lead` | tous (conv.) |
| Soumet le formulaire contact | `contact_submit` puis `generate_lead` | tous (conv.) |
| Termine la commande | `purchase` | tous (conv.) |

Tu peux désactiver event par event dans **Pixels > Events activés**.

---

## 7. Erreurs et erreurs persistantes

Dans `/admin/tracking/providers`, chaque pixel affiche :

- **Statut** : `enabled`, `disabled`, `error`.
- **Erreurs 24 h** : compteur (idéalement 0).
- **Dernière erreur** : message brut renvoyé par l’API du pixel.

Un statut `error` signifie qu’un appel a échoué (token expiré, pixel ID invalide…). Réouvrir le panneau de configuration, vérifier les valeurs, sauver.

---

## 8. Confidentialité — ce qui n’est jamais envoyé

- ❌ L’adresse IP complète (anonymisée à `203.0.113.0` / IPv4 dernier octet à 0).
- ❌ L’user-agent brut (haché en SHA-256 32 caractères).
- ❌ Les emails / téléphones en clair (toujours hachés SHA-256 avant départ).
- ❌ Les events si la cliente n’a pas consenti.

---

## 9. Cron de purge

Tous les jours à 03 h, le cron `/api/cron/tracking-purge` supprime les événements de plus de **180 jours** pour respecter le RGPD. Tu peux changer la durée dans `apps/web/src/app/api/cron/tracking-purge/route.ts` si besoin.

---

## 10. En cas de doute

Aller dans `/admin/tracking/settings` : la liste des checks environnement te dit si quelque chose manque (clés, secrets, providers).

Si rien ne remonte du tout, ouvrir la console navigateur sur la home — tu dois voir `window.dataLayer` rempli automatiquement. Si tu vois des events s’y empiler mais rien dans les logs admin, c’est que `/api/track` n’est pas appelé : vérifier `/admin/tracking/settings` puis le bandeau consentement.

> Pour aller plus loin : `docs/tracking/11-runbook.md` contient les procédures techniques (rotation des tokens, debug avancé).
