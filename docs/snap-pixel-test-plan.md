# Plan de test — Pixel Snapchat (Live)

## Contexte

Pixel Snapchat ID : `9bd26a82-3ecf-42aa-a3de-85df14c74a11`
Mode : Live (pas Test)
Date : 2026-05-17

## 1. Événements mappés FemiGlow → Snap

| # | Événement FemiGlow   | Événement Snap     | Type      | Identity Fields                  |
|---|-----------------------|--------------------|-----------|----------------------------------|
| 1 | `page_view`           | `PAGE_VIEW`        | Standard  | (aucun)                          |
| 2 | `view_item`           | `VIEW_CONTENT`     | Standard  | (aucun)                          |
| 3 | `add_to_cart`         | `ADD_CART`         | Standard  | (aucun)                          |
| 4 | `checkout_intent`     | `START_CHECKOUT`  | Standard  | (aucun)                          |
| 5 | `begin_checkout`      | `START_CHECKOUT`  | Standard  | (aucun)                          |
| 6 | `add_payment_info`    | `ADD_BILLING`      | Standard  | firstName, lastName, phone, city, country |
| 7 | `purchase`            | `PURCHASE`         | Standard  | email, phone, firstName, lastName, city, country |
| 8 | `generate_lead`       | `SIGN_UP`          | Standard  | email, phone, firstName          |
| 9 | `sign_up`             | `SIGN_UP`          | Standard  | email                            |
|10 | `chat_lead_form_submit` | `LEAD`          | Standard  | email, phone                     |

### Lacunes identifiées

| Événement FemiGlow   | Pourquoi pas mappé ?                                 | Recommandation               |
|-----------------------|------------------------------------------------------|------------------------------|
| `lead_capture`        | Pas de mapping Snap dans event-mapping.ts            | Mapper vers `LEAD` ou `SIGN_UP` |
| `contact_submit`      | Pas de mapping Snap                                  | Mapper vers `LEAD` si pertinent |
| `newsletter_submit`   | Pas de mapping Snap                                  | Mapper vers `SIGN_UP` si pertinent |
| `view_item_list`      | Pas de mapping Snap (manque dans e-commerce)         | Mapper vers `LIST_VIEW`      |
| `search`              | Pas de mapping Snap                                  | Mapper vers `SEARCH`         |

## 2. Architecture du tracking Snap

### Côté client (pixel navigateur)

1. `PixelLoader.tsx` charge `/api/track/pixels`
2. L'API retourne `{kind: 'snap', code: "snaptr('init','9bd26a82...');snaptr('track','PAGE_VIEW')"}`
3. Le snippet est injecté dans `<head>` comme `<script data-tracking-pixel="snap">`
4. Chaque navigation déclenche `PAGE_VIEW` automatiquement

### Côté serveur (CAPI v3)

1. Client envoie événement → `/api/track`
2. `dispatcher.ts` itère les providers activés
3. `snapAdapter.dispatch()` construit le payload CAPI v3
4. POST `https://tr.snapchat.com/v3/{pixelId}/events?access_token={token}`
5. Payload : `{data: [{event_name, event_time, event_id, event_source_url, action_source, user_data, custom_data}], test_event_code?}`

### Hashage PII

| Champ     | Normalisation                              | Hash     |
|-----------|---------------------------------------------|----------|
| `em`      | trim + lowercase                            | SHA-256  |
| `ph`      | chiffres seulement (`+212612345678` → `212612345678`) | SHA-256 |
| `fn`      | trim + lowercase                            | SHA-256  |
| `ln`      | trim + lowercase                            | SHA-256  |
| `ct`      | trim + lowercase                            | SHA-256  |
| `country` | trim + lowercase                            | SHA-256  |

## 3. Procédure de test

### 3.1 Test automatisé (Vitest + MSW)

```bash
pnpm --filter web exec vitest run src/test/integration/snap-pixel-live.test.ts
```

Couvre :
- Mapping complet des 10 événements
- Payload CAPI v3 (structure, PII hashé, custom_data)
- Click ID (`sccid`) dans `user_data`
- Test event code
- Skip conditions (consent denied, provider disabled, pixel absent, token absent)
- Client snippet (init + PAGE_VIEW)
- CSP hosts
- Retry sur 503, échec immédiat sur 400

### 3.2 Test live (script Node.js)

```bash
SNAP_CAPI_TOKEN="<votre_token>" npx tsx scripts/test-snap-pixel-live.ts
```

Envoie 9 événements réels au pixel Snap :
1. PAGE_VIEW
2. VIEW_CONTENT
3. ADD_CART
4. START_CHECKOUT
5. ADD_BILLING
6. PURCHASE
7. SIGN_UP (generate_lead)
8. LEAD (chat_lead_form_submit)
9. PURCHASE avec sccid (attribution Snap)

### 3.3 Vérification dans Snap Ads Manager

Après exécution du script live :

1. Aller sur [Snap Ads Manager](https://ads.snapchat.com/)
2. Events Manager > Sélectionner le pixel `9bd26a82-3ecf-42aa-a3de-85df14c74a11`
3. Vérifier dans l'onglet **Test Events** que les événements apparaissent
4. Pour chaque événement, vérifier :
   - Le nom correspond au mapping (PAGE_VIEW, VIEW_CONTENT, etc.)
   - `custom_data` contient les bonnes valeurs (currency, value, transaction_id)
   - `user_data` contient les hashes SHA-256 (em, ph, fn, ln, ct, country)
   - L'event_source_url est `https://femiglow-maroc.com/...`

### 3.4 Test côté client (navigateur)

1. Ouvrir `https://femiglow-maroc.com/kit` dans Chrome
2. Ouvrir DevTools > Network > filtrer `snap`
3. Vérifier que `scevent.min.js` est chargé depuis `sc-static.net`
4. Vérifier que la requête `v3/{pixelId}/events` est envoyée
5. Dans Console, taper `snaptr('track', 'PURCHASE', {currency: 'MAD', value: 290})`
6. Vérifier l'événement dans Network et Snap Events Manager

### 3.5 Test de parcours utilisateur complet

| Action utilisateur                          | Événement Snap attendu   | Vérification                          |
|---------------------------------------------|--------------------------|----------------------------------------|
| Visite page d'accueil                      | `PAGE_VIEW`              | Pixel chargé, événement envoyé         |
| Visite page produit                        | `VIEW_CONTENT`           | custom_data avec item_ids              |
| Clic "Ajouter au panier"                   | `ADD_CART`               | custom_data avec value=290, currency   |
| Clic "Commander" (1er char formulaire)     | `START_CHECKOUT`         | Identité partielle ou complète         |
| Remplissage infos paiement                 | `ADD_BILLING`            | PII hashé dans user_data               |
| Confirmation achat                         | `PURCHASE`               | transaction_id, value, items           |
| Chat : formulaire lead soumis              | `LEAD`                   | email + phone hashés                   |
| Chat : numéro tapé dans le chat            | `SIGN_UP` (generate_lead) | PII auto-extrait                     |

## 4. Problèmes courants et diagnostics

| Symptôme                                    | Cause probable                           | Solution                                |
|---------------------------------------------|------------------------------------------|-----------------------------------------|
| Pas d'événements dans Events Manager        | Pixel ID incorrect ou token expiré       | Vérifier ID + regénérer token           |
| Événements en "Test" mais pas en "Live"     | Mode Test activé                         | Désactiver Test Mode dans Snap Manager  |
| `custom_data` vide                          | Params non passés côté client            | Vérifier le schema de `/api/track`      |
| `user_data` sans hashes                    | Consent `ad_storage` denied              | Vérifier le consent banner              |
| Événements doublonnés                      | Double envoi (client + serveur)         | Vérifier la dédup event_id              |
| `401 Unauthorized`                          | CAPI token invalide                      | Regénérer le token dans Snap Manager     |
| `400 Bad Request`                           | Payload invalide                         | Vérifier les champs requis manquants    |
| Événements non-mappés apparaissent comme `CUSTOM_EVENT` | Mapping manquant              | Ajouter le mapping dans event-mapping.ts|

## 5. Fichiers modifiés / créés

| Fichier | Description |
|---------|-------------|
| `src/test/integration/snap-pixel-live.test.ts` | Tests d'intégration complets (MSW) |
| `scripts/test-snap-pixel-live.ts` | Script de test live (envoi réel au pixel) |
| `docs/snap-pixel-test-plan.md` | Ce document |

## 6. Checklist pré-déploiement

- [ ] Pixel ID configuré dans la table `tracking_providers`
- [ ] CAPI token configuré et valide
- [ ] Provider `snap` activé (`status = 'enabled'`)
- [ ] Domaine `femiglow-maroc.com` autorisé dans Snap Ads Manager
- [ ] Consent banner inclut `ad_storage` pour activer le pixel
- [ ] CSP headers incluent `sc-static.net` (script) et `tr.snapchat.com` (connect)
- [ ] Tests MSW passent
- [ ] Script live exécuté avec succès
- [ ] Événements visibles dans Snap Events Manager