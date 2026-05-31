# Audit — Système de tracking, GTM et Google Ads

> Audit transversal · **non technique** : couvre backend / frontend / data / UI / UX /
> architecture. Sert de fondation au plan d'action correctif qui suivra.
>
> Périmètre : `/admin/tracking/*`, `lib/tracking/*`, `api/track`, providers, GTM export.
> Date : 2026-05-13 · Auteur : Claude (assisté)

---

## 0. TL;DR (à lire si pressé)

1. **Google Ads ne reçoit AUCUNE conversion serveur** — seulement le snippet client `gtag.js` côté navigateur. Pas de fallback en cas d'ad-blocker ou de consent denied. La promesse "conversion attribuée" est donc **partielle**.
2. **`begin_checkout` Meta `InitiateCheckout` est mal placé** — sur `/commander` il fire au mount du composant ; sur `/kit` (page avec wizard embarqué) il ne fire jamais alors que c'est techniquement le même état "user voit le formulaire de checkout". Il agit comme un `page_view` déguisé : signal pollué.
3. **Le formulaire GTM ne pré-remplit PAS depuis `/admin/tracking/pixels`** — l'admin doit ressaisir manuellement chaque ID (Meta Pixel, GA4 Measurement ID, Pinterest Tag, etc.) à chaque nouvelle version, alors que les pixels enregistrés via Providers contiennent déjà l'info.
4. **L'édition d'une version sauvegardée est lacunaire** — on peut activer/supprimer une version, mais pas la "rouvrir, modifier, créer une nouvelle version dérivée" en un clic. Le pattern actuel = repartir d'un template ou CSV.
5. **Pas de catégorisation des events par "type business"** — Google Ads attend des conversions classées (purchase / lead / contact / sign-up). Aujourd'hui le mapping est binaire (event → label) sans hiérarchie ni regroupement éditorial.
6. **Bug latent** : `lead_capture` est marqué `isConversion: true` dans le catalogue mais **n'est pas dans `CONVERSION_EVENTS`** côté `/api/track` → ne remonte pas dans les dashboards de conversion.

Détails sourcés ci-dessous.

---

## 1. État actuel — vue d'ensemble architecturale

```
┌────────────────────────────────────────────────────────────────────────┐
│                          BROWSER (client)                              │
│                                                                        │
│  PixelLoader  ←  fetch /api/track/pixels  →  inject <script> par kind │
│       │                                                                │
│       ├─ gtag.js (GA4 + Google Ads via gtag) ───→ region1.google-…   │
│       ├─ gtm.js (GTM-XXX) ─────────────────────→ datalayer            │
│       ├─ fbevents.js (Meta Pixel) ─────────────→ facebook.com         │
│       └─ TrackingClient.emit() ─────────────────┐                     │
│                                                  │                     │
│                                                  ▼                     │
└────────────────────────────────────────── POST /api/track ─────────────┘
                                                  │
┌─────────────────────────────────────────────────┼─────────────────────┐
│                           SERVEUR Next.js       │                     │
│                                                  ▼                     │
│  /api/track route                                                      │
│       │                                                                │
│       ├─ valide event-catalog schema                                  │
│       ├─ vérifie consent                                              │
│       ├─ dispatchToProviders(ctx)                                     │
│       │     ├─ Meta CAPI (POST → graph.facebook.com)       ✅         │
│       │     ├─ GA4 Measurement Protocol (POST → google-analytics)✅   │
│       │     ├─ TikTok CAPI                                  ✅         │
│       │     ├─ Snap CAPI                                    ✅         │
│       │     ├─ Pinterest CAPI                               ✅         │
│       │     └─ Google Ads ────────────────────────────  ❌ NO-OP      │
│       └─ INSERT tracking_events_log                                   │
└────────────────────────────────────────────────────────────────────────┘
```

**Lecture rapide** : tous les providers ont un dispatch serveur SAUF Google Ads (client-only). C'est le point névralgique de l'audit.

---

## 2. Volet Backend

### 2.1 Adapter pattern et dispatch

Le système suit un pattern adapter propre :

- **Registry** (`lib/tracking/providers/registry.ts`) : map `kind → ProviderAdapter`
- **Interface `ProviderAdapter`** :
  - `supports(eventName)` → boolean (l'adapter accepte-t-il cet event ?)
  - `dispatch(provider, ctx)` → POST CAPI serveur, retourne success/skipped/error
  - `clientSnippet(provider)` → string JS injecté côté browser
  - `cspHosts()` → hosts à whitelist dans la CSP

**Adapters présents** (8) : `meta`, `google_ga4`, `google_ads` (récemment ajouté), `tiktok`, `snap`, `pinterest`, `gtm`, `custom`

### 2.2 Google Ads : exception majeure

`google-ads.ts` (lib/tracking/providers/) :

```typescript
supports(): boolean { return false; }
async dispatch(): Promise<TrackingProviderResult> {
  return { status: 'skipped', error: 'client_only_provider' };
}
clientSnippet(...) { return "<script gtag(config, AW-...)>"; }
```

→ Google Ads ne reçoit JAMAIS de conversion depuis le serveur. Toute attribution dépend du tag client.

**Conséquence concrète** :
- Si l'utilisateur a un ad-blocker (uBlock, Brave) → conversion perdue
- Si consent denied au moment de l'achat → conversion perdue (les autres providers reçoivent quand même via CAPI avec consent management)
- Si JavaScript échoue sur la page `/merci` → conversion perdue

**Solution standard** : Google Ads Enhanced Conversions / Offline Conversions API. Nécessite OAuth pour Google Ads Customer ID. Non implémenté.

### 2.3 Event-catalog vs CONVERSION_EVENTS

`lib/tracking/event-catalog.ts` définit 71 events. Certains sont `isConversion: true` :
- `purchase`, `begin_checkout`, `generate_lead`, `sign_up`, `lead_capture` (wizard CHA-230)

Mais `app/api/track/route.ts:22` :
```typescript
const CONVERSION_EVENTS = new Set(['purchase', 'generate_lead', 'sign_up']);
```

→ `lead_capture` et `begin_checkout` sont **absents**. Conséquences :
- `tracking_events_log.isConversion` mis à `false` pour ces events
- Dashboards `/admin/analytics` sous-comptent les conversions
- Routing CAPI moins prioritaire (le batcher peut les dropper si quota dépassé)

### 2.4 Path serveur quand commande passe

Quand `POST /api/checkout/order` réussit :
1. Réponse au client OK
2. Client émet `purchase` → batcher `TrackingClient` → POST `/api/track`
3. `/api/track` dispatche à Meta (CAPI), GA4 (MP), TikTok, Snap, Pinterest
4. **Google Ads = skipped** côté serveur. Si le tag `gtag.js` côté client a tourné OK → conversion enregistrée par Google. Sinon → perdue.

---

## 3. Volet Frontend

### 3.1 PixelLoader & consent

`components/tracking/PixelLoader.tsx` :
- Au mount : `loadConsent()` ; si `DENIED_CONSENT` → ne fait rien
- Écoute `fg:consent-changed` → fetch `/api/track/pixels` → inject snippets

`TrackingProvider.tsx` :
- Lit `consent_banner_enabled` + `consent_default_granted` depuis `tracking_settings`
- Si `banner=false && default=granted` → injecte `GRANTED_CONSENT` au mount + dispatche l'event
- Sinon → attend interaction utilisateur

État serveur actuel :
- `consent_banner_enabled = false` → pas de bannière
- `consent_default_granted = true` → consent accordé d'office (legal RGPD : juridiction à vérifier)
- → les 3 pixels (GA4, GTM, Google Ads) sont effectivement injectés au mount

### 3.2 Event emission côté wizard

**Sur `/kit` (Mode A, wizard_embed)** :
- Aucun `begin_checkout` n'est émis quand le user voit la page
- `lead_capture` fire seulement quand l'user submit le step 0 (nom + tel + consent)
- → bon signal "intent" mais on perd la visibilité "qui a vu le formulaire"

**Sur `/commander` (Mode B, wizard_cart)** :
- `begin_checkout` fire **au mount du composant** `CheckoutFlow` (useEffect)
- Mapping Meta : `InitiateCheckout`. Donc dès qu'un user arrive sur `/commander`, Meta reçoit un `InitiateCheckout` → contamine les segments d'audience "intent élevé"

### 3.3 Problème de fond — sémantique de `begin_checkout`

Le standard GA4/GTM : `begin_checkout` = utilisateur a INITIÉ une action de checkout (clic "Commander", focus premier champ, etc.). Pas un page view.

Actuellement :
- `/commander` → fire au mount = équivalent page view = **faux positif InitiateCheckout** pour Meta
- `/kit` → fire jamais = **vrai négatif** alors que la landing page contient bien le formulaire visible

→ Soit on harmonise les deux pour qu'ils émettent `begin_checkout` au PREMIER input focus / first interaction, soit on remplace `begin_checkout` Meta par un event custom moins fort sémantiquement.

L'**utilisateur propose** : remplacer le mapping Meta `begin_checkout → InitiateCheckout` par un event custom `form_start`. Bonne idée car :
- `form_start` est moins "money event" pour Meta → ne pollue pas les audiences Lookalike
- On garde quand même le signal GA4 / Google Ads (où `begin_checkout` reste pertinent)
- Le custom event `form_start` peut être ciblé séparément dans GTM si besoin (Meta Custom Event)

---

## 4. Volet Data

### 4.1 Table `tracking_providers`

Colonnes clés :
- `id`, `kind` (enum), `status` (enabled/disabled/error)
- `pixel_id` : **un seul ID par provider, sans variation par environnement**
- `capi_token`, `capi_token_iv`, `capi_token_tag` : token CAPI chiffré
- `config` : JSONB libre (placeholder pour métadonnées custom)
- `enabled_events` : array d'event names autorisés à dispatch via ce provider
- `last_event_at`, `error_count_24h`, `last_error` : monitoring runtime

**Limitations** :
- Pas de séparation prod/stage/preview au niveau du pixel (un seul ID actif à la fois)
- `enabled_events` est plat (pas de catégorisation purchase/lead/contact)
- `config` JSONB libre → pas de schéma typé pour les conversion labels par event

### 4.2 Table `tracking_settings` + GTM versions

Pas de table dédiée `gtm_configs`. Tout stocké dans `tracking_settings` avec clé `gtm.config_versions` :

```json
{
  "activeId": "uuid-v1",
  "versions": [
    {
      "id": "uuid-v1",
      "name": "v1 - pixels initiaux",
      "perEnv": {
        "production": {
          "metaPixelId": "...",
          "ga4MeasurementId": "...",
          "tiktokPixelId": "",
          ...
          "googleAdsCustomerId": "...",
          "googleAdsConvLabels": {}
        },
        "stage": { ... },
        "preview": { ... },
        "dev": { ... }
      },
      "createdAt": "...",
      "createdBy": "u_..."
    }
  ]
}
```

**Trade-offs de cette approche** :
- ✅ Simple : pas de schéma DB dédié à maintenir, pas de migration
- ✅ Versionnage facile, atomic CRUD
- ❌ Pas de requêtes SQL fines (filtrer par env, par pixel, etc.)
- ❌ FIFO max 50 versions — pas d'archivage
- ❌ Pas de FK vers `tracking_providers` → désynchronisation possible (un pixel supprimé reste dans une vieille version GTM)

### 4.3 Décorrélation entre Providers et GTM config

C'est l'observation centrale de cet audit :

```
/admin/tracking/pixels         /admin/tracking/gtm
  (tracking_providers)             (tracking_settings.gtm.config_versions)
        │                                  │
        └────────── ❌ aucune ──────────────┘
                      synchronisation
```

Quand l'admin ajoute un pixel dans `/admin/tracking/pixels` (table `tracking_providers`), cette info n'est PAS récupérée par le formulaire GTM. L'admin doit re-saisir le même Meta Pixel ID des deux côtés.

Pire : si une valeur diverge (typo dans l'une), on a du tracking double mais avec deux IDs différents → segmentation Meta/GA cassée.

---

## 5. Volet UI/UX Admin

### 5.1 `/admin/tracking/pixels` — Providers panel

- Liste les 8 kinds avec status toggle
- Affiche : pixel_id, présence CAPI, count d'events autorisés, last_event_at, errors_24h
- Form d'édition par provider (Meta a un onglet CAPI, GA a un onglet Measurement Protocol secret, etc.)

**Limitations UX** :
- Pas d'aperçu "qui dispatche quoi" — il faut ouvrir chaque provider pour voir `enabled_events`
- Pas de bouton "tester ce pixel" depuis l'interface (envoyer un event test)
- L'admin ne voit pas que google_ads est client-only et n'a pas de CAPI implémentée

### 5.2 `/admin/tracking/gtm` — Config export

Le composant `GtmConfigForm.tsx` :
- 4 onglets environnement (`production`, `stage`, `preview`, `dev`)
- Champs par env : Meta Pixel ID, GA4 Measurement ID, TikTok, Snap, Pinterest, GAds Customer + Conv Labels
- Boutons "Broadcast prod → autres envs" pour propager
- `GtmTemplatePicker` : charge un template prédéfini (4 templates : "minimal", "ga-only", "ga-meta", "full")
- `GtmCsvImport` : import depuis CSV (`env,key,value`)
- Validation Zod côté client + serveur

**Pas d'édition d'une version sauvegardée existante** :
- Lister les versions ✅
- Activer / désactiver ✅
- Supprimer ✅
- **Rouvrir et modifier en place** ❌ — il faut soit (a) repartir d'un template, soit (b) copier-coller le JSON. C'est un trou UX majeur.

### 5.3 UX de l'export

- `GtmExportPanel.tsx` affiche : preview JSON, stats (#tags, #triggers, #variables), lint report
- Boutons : copier JSON, télécharger `.json`, télécharger `.zip` (avec README)
- Ne montre PAS le diff entre la version courante et la précédente

---

## 6. Volet Architecture — points de divergence

### 6.1 Deux mondes parallèles : Providers (runtime) vs GTM (export statique)

```
┌─────────────────────────────────┐    ┌─────────────────────────────────┐
│  MONDE 1 — Runtime              │    │  MONDE 2 — Export GTM           │
│  (tracking_providers)           │    │  (tracking_settings.gtm)        │
├─────────────────────────────────┤    ├─────────────────────────────────┤
│  • PixelLoader inject           │    │  • Génère container.json        │
│  • /api/track dispatch CAPI     │    │  • Admin télécharge + upload    │
│  • Status enabled/error/24h    │    │  • Versions, broadcast, valid.  │
│  • Stockage : DB tracking_*     │    │  • Stockage : DB tracking_set.  │
└─────────────────────────────────┘    └─────────────────────────────────┘
            │                                            │
            └────────── PAS DE LIAISON ──────────────────┘
                          (sauf via humain qui re-saisit)
```

C'est par design (Providers = runtime ; GTM export = artefact statique pour upload manuel dans Tag Manager UI), mais l'UX n'expose pas ce fossé : l'admin a l'impression que tout est connecté.

### 6.2 Conversions et catégorisation business

L'event-catalog a un champ `category` (engagement / ecommerce / lead / custom / admin) mais :
- Pas de catégorisation par **type de conversion business** (purchase / lead / contact / signup / view-content)
- Google Ads attend ces catégories pour ses Conversion Actions (Smart Bidding s'appuie dessus)
- Aujourd'hui, l'admin doit deviner que `lead_capture` doit pointer vers la Conversion Action `[Lead]` de Google Ads (via le `googleAdsConvLabels.lead`), mais rien dans l'UI ne le guide

### 6.3 Pas de "single source of truth" pour les pixel IDs

Les Meta Pixel ID, GA4 Measurement ID, etc. peuvent être déclarés à 3 endroits :
1. `tracking_providers.pixel_id` (DB)
2. `tracking_settings.gtm.config_versions[].perEnv.production.metaPixelId` (DB)
3. Variables d'env `.env` (legacy, encore utilisé par certains fallbacks)

→ aucune SSOT, divergence possible.

---

## 7. Volet sécurité / conformité

### 7.1 Consent Mode v2

Le snippet GA4 commence par `gtag('consent','default',{ad_storage:'denied',...})` — bonne pratique.

Mais l'event `saveConsent()` côté frontend appelle `gtag('consent','update', state)`. Si Google Ads pixel a été chargé via un autre snippet, le `consent.update` peut ne pas l'atteindre (les deux scripts partagent `window.dataLayer` théoriquement, mais la séquence d'init est sensible).

→ Risque : Google Ads reste en `denied` même après consent granted. À tester.

### 7.2 Tag Assistant et CSP

CSP actuelle (post-fix précédent) :
- `connect-src` inclut `*.google-analytics.com`, `*.googletagmanager.com`, `*.analytics.google.com`, `*.g.doubleclick.net`
- `script-src` inclut `googletagmanager.com`, `tagassistant.google.com`
- `style-src-elem` inclut `fonts.googleapis.com`, `tagassistant.google.com`

→ Tag Assistant devrait fonctionner. Si le user ne voit pas les balises = soit Tag Assistant teste sans clicker l'iframe consent, soit le tag injection est tardive (PixelLoader attend `requestIdleCallback`).

---

## 8. Volet observabilité

### 8.1 Logs tracking

Table `tracking_events_log` :
- `event_name`, `received_at`, `anonymous_id`, `session_id`
- `is_conversion` (boolean — bug identifié plus haut)
- `providers_dispatched` : array des kinds qui ont été tentés
- `providers_results` : JSONB avec status/error/latency par provider

**Bonne base** mais pas exploitée :
- Pas de dashboard "% de conversions Google Ads dispatched OK" (impossible : c'est toujours skipped)
- Pas d'alerting "GA4 CAPI error rate > 5%"
- Pas de retry queue pour les CAPI échouées

### 8.2 Visibilité côté admin

`/admin/tracking` dashboard affiche :
- 24h KPIs (count, conversions, errors)
- 10 derniers events
- Top events

Mais pas de :
- Vue par provider ("Meta dispatch a 12% d'erreur en 24h")
- Diff entre client-side et server-side (combien d'events arrivent côté client mais pas côté serveur ?)
- Quality score Tag Assistant intégré

---

## 9. Questions soulevées par cet audit

À discuter avant le plan d'action :

1. **Est-il acceptable que les conversions Google Ads dépendent UNIQUEMENT du gtag.js client** ? Si oui, OK. Si non, il faut implémenter Google Ads Enhanced Conversions ou Offline Conversion API.

2. **`begin_checkout` → on harmonise comment ?**
   - Option A : fire au mount du wizard sur `/kit` ET `/commander` (cohérent mais signal pollué)
   - Option B : fire au premier input focus du wizard partout (cohérent, plus précis, mais perd la fenêtre "vu mais pas interagi")
   - Option C : remplacer le mapping Meta par `form_start` custom event (la proposition user) — bonne option par défaut pour Meta, garde `begin_checkout` GA4/Google Ads.

3. **Google Ads conversion categories** : comment les exposer en admin ?
   - Option A : un nouvel onglet `/admin/tracking/conversions` avec mapping `[event_name × category] → conversion_label`
   - Option B : enrichir l'event-catalog avec un champ `googleAdsCategory: 'purchase' | 'lead' | 'contact' | 'signup' | 'view'`
   - Option C : laisser ça dans la config GTM existante (`googleAdsConvLabels`) mais améliorer l'UX du formulaire pour les rendre lisibles par catégorie

4. **Pré-remplissage GTM depuis Providers** : automatique ou opt-in ?
   - Automatique : à chaque création de version, on lit `tracking_providers` et on pré-remplit les pixel IDs correspondants
   - Opt-in : un bouton "Importer depuis Providers" dans le formulaire GTM
   - Synchronisation bidirectionnelle : modifier dans Providers ↔ modifier dans GTM versions actives (risqué)

5. **Édition de versions sauvegardées** :
   - Cloner + modifier (toujours créer une nouvelle version) ?
   - Édition in-place avec audit trail (qui a modifié quoi) ?
   - Mode "draft" avec promotion vers "active" ?

6. **Granularité par environnement** :
   - Aujourd'hui : un pixel = un ID global. Mais GTM config a 4 envs.
   - Faut-il que `tracking_providers.pixel_id` devienne un objet `{ production, stage, preview, dev }` ?

---

## 10. Cartographie des fichiers à toucher (pour référence du plan d'action futur)

| Sujet                          | Fichiers concernés                                                                                                   |
|--------------------------------|---------------------------------------------------------------------------------------------------------------------|
| Google Ads server CAPI         | `lib/tracking/providers/google-ads.ts`, `lib/tracking/server/dispatcher.ts`, table `tracking_providers` (token chiffré) |
| begin_checkout → form_start    | `lib/tracking/providers/event-mapping.ts:64-152` (mapping Meta), `lib/tracking/event-catalog.ts` (catalogue), composants wizard |
| `CONVERSION_EVENTS` bug        | `app/api/track/route.ts:22`                                                                                          |
| GTM pre-fill from Providers    | `components/admin/tracking/gtm/GtmConfigForm.tsx` + nouvelle route `GET /api/admin/tracking/providers/snapshot`      |
| Edit saved GTM version         | `lib/tracking/gtm/config-store.ts` (méthode `update`), `GtmConfigForm.tsx` (mode `edit` vs `create`)                 |
| Google Ads categories admin    | Nouveau composant `GtmGoogleAdsConversionsEditor.tsx` + schéma JSON                                                  |
| Per-env pixel IDs              | Migration DB (nouveau champ `pixel_id_per_env`), refactor `tracking_providers` queries                               |
| Observabilité conversions      | `app/admin/tracking/page.tsx` (KPIs), `lib/tracking/server/dispatcher.ts` (logs structurés)                          |

---

## 11. Score de maturité par axe (1 = jeune / 5 = mature)

| Axe                                          | Score | Commentaire                                                                                       |
|----------------------------------------------|-------|---------------------------------------------------------------------------------------------------|
| **Architecture adapter pattern**             | 4/5   | Propre, testable, extensible. Manque juste Google Ads server-side.                                |
| **Backend CAPI** (Meta, GA4, …)              | 4/5   | Solide pour Meta/GA4/TikTok/Snap/Pinterest. Trou : Google Ads.                                    |
| **Backend Google Ads conversion**            | 1/5   | Client-only. Pas de fallback.                                                                     |
| **Catalogue d'events**                       | 4/5   | 71 events catégorisés. Manque `googleAdsCategory` et alignement avec `CONVERSION_EVENTS`.         |
| **GTM export tooling**                       | 4/5   | Versions, broadcast, CSV import, validation. Mature.                                              |
| **Pré-remplissage GTM ← Providers**          | 1/5   | Inexistant. L'admin re-saisit tout.                                                               |
| **Édition de versions sauvegardées**         | 2/5   | Activer / supprimer OK. Pas de rouvrir-modifier.                                                  |
| **UX admin Providers**                       | 3/5   | Fonctionnel mais sans guidance (pas de "tester ce pixel").                                        |
| **Consent Mode v2**                          | 3/5   | Snippets corrects. Risque de sync sur Google Ads à valider.                                       |
| **Observabilité runtime**                    | 3/5   | Logs DB présents. Pas de dashboards par provider, pas d'alerting.                                 |
| **Conformité conversions Google Ads**        | 2/5   | Pas d'offline conversions, pas d'Enhanced Conversions, pas de cohabitation propre avec consent.   |

---

## 12. Annexe — Glossaire rapide

- **CAPI (Conversion API)** : endpoint serveur d'un provider pour recevoir les conversions sans dépendre du JS browser (bypass ad-blockers, consent denied).
- **Enhanced Conversions** : feature Google Ads qui envoie le hash de l'email/téléphone au serveur Google pour matcher la conversion à un compte Google sans cookie.
- **Offline Conversions** : conversions importées par batch (CSV, API) vers Google Ads, attribuées via `gclid` capturé en amont. Utile pour les funnels long (lead → call → contract).
- **Custom Event Meta** : event nommé librement (vs les events standards `Purchase`, `Lead`, `InitiateCheckout`). Permet du tracking spécifique métier sans polluer les events standards.
- **Conversion Action** : entité côté Google Ads, par exemple "Achat Pack FemiGlow" avec une valeur, un label, une catégorie. Plusieurs Conversion Actions peuvent être déclarées (purchase, lead, contact).
- **gclid** : Google click ID, query parameter ajouté par Ads aux landing URLs. Sert à matcher la conversion au clic Ads source. À capturer côté serveur.

---

**Fin de l'audit.**

Sur cette base, le plan d'action correctif sera structuré en 4 chantiers (proposition à valider avec toi avant lancement) :
1. **Google Ads server-side** — implémenter dispatch CAPI / Enhanced Conversions
2. **Catalogue & mapping** — fixer `lead_capture`, replacer `begin_checkout`, ajouter `form_start`
3. **Admin UI cohérence** — pré-remplir GTM depuis Providers + édition de versions
4. **Catégorisation conversions** — exposer Google Ads conversion categories dans le formulaire
