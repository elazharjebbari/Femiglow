# 00.2 — Glossaire

## Conversions & tracking

**CAPI (Conversion API)** — Endpoint serveur d'un provider (Meta, Google Ads,
TikTok, …) pour recevoir des conversions sans dépendre du JS browser.
Bypass des ad-blockers, fiable même si consent JS denied (selon le mode).

**Enhanced Conversions (Google Ads)** — Feature qui envoie un **hash SHA-256
de l'email/téléphone** au serveur Google Ads pour matcher la conversion à un
compte Google connu, sans cookie ni cross-site tracking.

**Offline Conversions (Google Ads)** — Import par batch (CSV ou API) de
conversions qui se produisent **après** le clic initial. Attribuées au `gclid`
capturé à l'arrivée. Utile pour les funnels long (lead → call → contract).

**gclid** — *Google Click ID*, query param ajouté par Google Ads aux URLs de
landing. Ex : `?gclid=Cj0KCQjw...`. À capturer côté serveur (cookie session)
puis renvoyer avec la conversion.

**event_id** — UUID v4 généré côté client pour chaque événement de conversion.
Envoyé en parallèle au tag client (gtag) ET au backend (POST /api/track). Les
deux POSTs à Google portent le même `event_id` → Google déduplique automatiquement.

**Consent Mode v2** — Standard Google introduit 2024 pour respecter la directive
ePrivacy. Le tag `gtag('consent', 'default', { ... })` annonce un état initial
DENIED, puis `gtag('consent', 'update', { ... })` autorise après accord user.
Les états : `ad_storage`, `analytics_storage`, `ad_user_data`, `ad_personalization`,
`functional_storage`.

## Évènements

**Event canonique** — Nom interne FemiGlow (ex : `purchase`, `lead_capture`,
`form_start`). Défini dans `event-catalog.ts`. Mappé vers les noms attendus
par chaque provider.

**Custom Event Meta** — Event nommé librement (non-standard). Permet du
tracking métier-spécifique sans polluer les events standards Meta Pixel
(`Purchase`, `Lead`, `InitiateCheckout`).

**`begin_checkout`** — Standard GA4 : indique que l'utilisateur a initié un
processus de checkout. Sémantique forte (intent élevé). Le mapping Meta natif
est `InitiateCheckout`. **Doit fire sur action utilisateur**, pas au mount d'une
page (sinon = pageview déguisé).

**`form_start`** *(custom)* — Nouvel event qui fire au **premier focus** d'un
champ d'un formulaire. Sémantique plus faible que `begin_checkout`. Permet de
mesurer "l'engagement formulaire" sans déclencher les conversions Meta.

**Conversion Action (Google Ads)** — Entité côté Google Ads avec un nom, une
valeur, une catégorie (Purchase, Lead, Contact, Signup, View). Plusieurs
Conversion Actions par compte. Chaque action a un Label
(ex : `AbCdEfGh123`).

**Conversion Category (Google Ads)** — Catégorie attribuée à une Conversion
Action. Sert au Smart Bidding pour optimiser les enchères selon le type
d'action. Valeurs : `purchase`, `lead`, `contact`, `sign_up`, `view_content`,
`other`.

## Infrastructure FemiGlow

**Provider** *(tracking)* — Ligne dans `tracking_providers`. Représente une
config de pixel/CAPI pour un kind donné (`meta`, `google_ga4`, `google_ads`,
`gtm`, `tiktok`, `snap`, `pinterest`, `custom`).

**Adapter** — Module TS dans `lib/tracking/providers/` qui implémente
l'interface `ProviderAdapter` : `supports`, `dispatch`, `clientSnippet`,
`cspHosts`.

**Dispatcher** — Fonction serveur (`lib/tracking/server/dispatcher.ts`) qui
boucle sur les providers enabled et appelle leur `dispatch` pour chaque event
reçu sur `/api/track`.

**TrackingClient** — Singleton côté navigateur (`lib/tracking/client.ts`).
Batches les events et POSTe à `/api/track` toutes les 1500 ms.

**PixelLoader** — Composant React (`components/tracking/PixelLoader.tsx`) qui
fetch `/api/track/pixels` au mount + sur changement de consent, et injecte les
snippets clients (`gtag.js`, `fbevents.js`, `gtm.js`).

**GTM Config** — Snapshot d'une configuration GTM (pixels, conv labels, custom
HTML) versionné dans `tracking_settings.gtm.config_versions`. Exportable en
JSON pour upload manuel dans Tag Manager UI.

**GTM Container** — Le JSON résultat de l'export, conforme au format
import/export de Google Tag Manager.

## Architecture

**SSOT (Single Source of Truth)** — Le lieu unique de vérité pour une donnée.
Le débat : `tracking_providers` est-il SSOT pour les pixels, ou bien chaque
version GTM peut-elle override ?

**ADR (Architecture Decision Record)** — Doc figée qui acte une décision
architecturale : contexte, options évaluées, choix retenu, conséquences.
Stocké dans `10-architecture/adr-*.md`.

**Dual-track tracking** — Pattern où une conversion est envoyée à la fois côté
client (tag JS) ET côté serveur (CAPI). Déduplication via `event_id` partagé.

## Sécurité

**OAuth Customer ID (Google Ads)** — Procédure d'autorisation où l'admin
Google Ads accorde à FemiGlow le droit d'uploader des conversions sur son
compte. Génère un refresh token à stocker chiffré dans `tracking_providers`.

**Developer Token (Google Ads)** — Token au niveau MCC (Manager Account)
nécessaire pour appeler l'API Google Ads. À stocker dans `.env`.

**CAPI Token (Meta / autres)** — Token d'accès à l'API CAPI du provider.
Stocké chiffré dans `tracking_providers.capi_token` (champs `capi_token_iv`,
`capi_token_tag` pour AES-GCM).

## A11y / UX

**WCAG SC 2.4.7** — Focus visible. Tout élément focusable doit avoir un focus
ring visible.

**WCAG SC 1.4.4** — Resize text. La page doit fonctionner à 200% zoom sans
perte de fonctionnalité.

**Mobile focus zoom** — Comportement iOS Safari de zoomer auto sur les inputs
au focus si font-size < 16px. Fix : forcer ≥ 16px OU modifier viewport
dynamiquement (cf. `MobileFocusGuard`).
