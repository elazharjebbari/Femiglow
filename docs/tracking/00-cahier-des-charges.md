# 00 — Cahier des charges

## 1. Contexte

FemiGlow expose un site Next.js 14 (App Router) composé de pages
landing, content (journal), commerce (kit, rituel, panier, checkout)
et d'une console admin (leads, médias, webhooks). L'analytics actuelle
se limite à **Plausible** (page views) et un **stub GA4** sur la page
`/merci`. Aucun datalayer structuré, aucun pixel publicitaire, aucune
console pour configurer le tracking.

L'objectif est d'industrialiser le tracking pour :

- alimenter les algorithmes des plateformes pub (Meta, TikTok, Google
  Ads, Snap, Pinterest) avec des signaux riches et fiables,
- mesurer le funnel marketing complet (acquisition → engagement →
  conversion → fidélisation),
- offrir à la fondatrice une **console métier** pour piloter le
  tracking sans toucher au code (toggle composants, ajout pixel,
  test).

## 2. Exigences fonctionnelles (F)

### F1 — Inventaire & catégorisation
- F1.1 Le système recense automatiquement (build-time) toutes les
  pages publiques (`src/app/**/page.tsx`).
- F1.2 Le système recense tous les composants instrumentables
  (`src/components/**/*.tsx`).
- F1.3 Chaque composant est rattaché à une **catégorie** (CTA, form,
  navigation, media, list, filter, search, social, pricing).
- F1.4 Chaque catégorie expose un set d'**événements applicables**
  (ex : un CTA → `cta_click`, `view_promotion`).

### F2 — Catalogue d'événements
- F2.1 Référentiel GA4 selon
  [data.ga4spy.com](https://data.ga4spy.com/ga4-events-parameters)
  (page_view, view_item, add_to_cart, begin_checkout, purchase, etc.).
- F2.2 Événements custom FemiGlow préfixés `fg_*` (ex : `fg_journal_read_75`).
- F2.3 Chaque event possède : nom, paramètres requis/optionnels,
  description FR, scope (web, server, both), conversion flag.
- F2.4 Validation Zod côté serveur avant push au datalayer.

### F3 — Console admin `/admin/tracking`
- F3.1 Vue d'ensemble : nombre d'events 24h, top events, taux de
  consent, couverture composants.
- F3.2 Vue **inventaire arborescent** : page → sections → composants,
  avec status (actif/inactif/non configuré) et badge events.
- F3.3 Vue **détail composant** : toggle global, sélection des events,
  override de paramètres, test en live (mode dry-run).
- F3.4 Vue **providers** : liste des pixels (Meta, TikTok…), toggle,
  ID/Pixel ID, code custom optionnel, état (chargé / erreur).
- F3.5 Vue **logs** : timeline temps réel filtrable par
  page/event/provider/consent.
- F3.6 Vue **debug** : injection d'un mode debug visuel (overlay sur
  le site qui surligne les composants trackés).

### F4 — Configuration runtime
- F4.1 Les toggles s'appliquent sans redéploiement (lecture en BDD).
- F4.2 Cache 60s (revalidate) pour éviter les requêtes par event.
- F4.3 Possibilité de définir un **environnement** (dev / preview /
  production) avec config indépendante.

### F5 — DataLayer
- F5.1 Une variable globale `window.femiglowDataLayer: Event[]` (compatible
  Google Tag Manager).
- F5.2 Schéma typé : tous les events partagent une enveloppe
  (`event`, `event_id`, `timestamp`, `consent`, `page`, `user`,
  `ecommerce?`, `engagement?`).
- F5.3 Anti-redondance : déduplication par `event_id`
  (page_view dans la même session, view_item du même item < 5s, etc.).
- F5.4 Queue offline : si le réseau est coupé, les events sont
  bufferisés en localStorage et rejoués au retour réseau.

### F6 — Providers / pixels
- F6.1 Activation par toggle, ID configuré dans la console.
- F6.2 Code custom (head/body) optionnel, sandboxé (pas d'`eval`,
  CSP nonce).
- F6.3 Mapping automatique GA4 → format propriétaire (Meta, TikTok…).
- F6.4 Server-side ingestion via `/api/track` pour CAPI Meta, Events
  API TikTok (déduplication client/server par `event_id`).
- F6.5 Test pixel : bouton "Envoyer un event de test" dans la console.

### F7 — Consentement
- F7.1 Banner cookies (séparé de ce module mais consommé par lui).
- F7.2 Aucun event/pixel non-essentiel ne s'exécute avant
  `consent.granted = true`.
- F7.3 Snapshot du consent stocké côté serveur pour preuve d'audit.
- F7.4 Mode "Consent Mode v2" Google géré via `gtag('consent','update', …)`.

### F8 — Visualisation
- F8.1 Page admin avec arbre interactif (collapse/expand).
- F8.2 Pour chaque composant tracké : liste des events configurés,
  paramètres par défaut, dernière émission, taux d'erreur.
- F8.3 Heatmap couverture : % composants instrumentés par page.
- F8.4 Diff entre l'inventaire détecté (build) et la config en BDD
  (orphelins, manquants).

## 3. Exigences non-fonctionnelles (NF)

### NF1 — Performances
- NF1.1 Overhead client : ≤ 8 KB gzip (script tracking core hors pixels).
- NF1.2 Pixels chargés en `defer` après `load`, ou à la première
  interaction utilisateur.
- NF1.3 LCP non impacté (mesure avant/après).
- NF1.4 API `/api/track` : p95 ≤ 50 ms (write asynchrone).

### NF2 — Robustesse
- NF2.1 Aucune erreur tracking ne casse le rendu (try/catch + report Sentry).
- NF2.2 Réémission idempotente (server gère doublons via `event_id`).
- NF2.3 Schéma versionné (`schema_version: 1`) pour évolutions futures.

### NF3 — Sécurité
- NF3.1 CSP : pixels whitelistés explicitement (Meta, TikTok…).
- NF3.2 Pas d'`unsafe-inline` ; code custom admin nonce-protégé.
- NF3.3 Validation Zod stricte des payloads ingérés.
- NF3.4 Rate-limit `/api/track` : 60 req/min/IP.

### NF4 — RGPD / privacy
- NF4.1 Pas de PII en clair dans le datalayer (email haché SHA-256
  avant CAPI).
- NF4.2 IP anonymisée (last octet zéro) pour les events internes.
- NF4.3 TTL 13 mois sur `tracking_events_log` (purge automatique).
- NF4.4 Export / suppression sur demande utilisateur (lien lead).

### NF5 — Observabilité
- NF5.1 Métriques Prometheus-style (events count, errors, dedup hits).
- NF5.2 Logs structurés (logger existant) avec corrélation ID.
- NF5.3 Sentry breadcrumbs pour les erreurs tracking.

### NF6 — Accessibilité (console admin)
- NF6.1 WCAG 2.1 AA, jest-axe sur toutes les pages admin.
- NF6.2 Navigation clavier complète (tree view, modals, toasts).
- NF6.3 Annonces SR pour les actions async (`role="status"`).

## 4. KPI cibles

| KPI | Cible 30j post-launch |
|---|---|
| Couverture composants instrumentés | ≥ 85 % |
| Events / session (médiane) | ≥ 12 |
| Taux d'erreur ingestion `/api/track` | ≤ 0.1 % |
| Déduplication CAPI Meta | ≥ 98 % match rate |
| Consent rate (granted) | ≥ 60 % |
| LCP delta avant/après tracking | ≤ +50 ms |

## 5. Scope IN

- Toutes les pages publiques + checkout + post-purchase.
- Console admin complète (config, test, logs, visualisation).
- 5 providers : Meta, TikTok, Google Ads, Snap, Pinterest.
- Server-side CAPI pour Meta + TikTok (les + critiques iOS 14.5+).
- Consent Mode v2 Google.

## 6. Scope OUT (Phase ultérieure)

- A/B testing intégré (peut s'appuyer sur le datalayer mais hors
  périmètre).
- Heatmaps utilisateur (Hotjar/Microsoft Clarity).
- Session replay.
- Attribution multi-touch maison (utiliser GA4 + plateformes).
- App mobile native (le datalayer est web-only).

## 7. Contraintes

- **Stack imposée** : Next.js 14 App Router, TypeScript strict,
  Drizzle (Postgres Neon), iron-session, Tailwind, Zod.
- **Pas d'ajout de dépendance lourde** : GTM optionnel (loaded via
  notre script), pas de SaaS analytics propriétaire intermédiaire.
- **Charte UI** : palette stone, typographie Cormorant + Inter,
  spacing dense (8/16/24/32), pas d'emoji dans les UI.
- **Voix** : tutoiement fondatrice, vocabulaire métier marketing
  expliqué (pas de jargon GA4 brut, ex : "vue produit" plutôt que
  `view_item`).

## 8. Risques & mitigations

| Risque | Impact | Mitigation |
|---|---|---|
| Adblockers cassent les pixels | Perte signal | Fallback CAPI server-side |
| Consent rate < 50 % | Mesure dégradée | Consent Mode v2 (modeling Google) |
| Surcoût LCP | SEO / UX | Defer + interaction-load des pixels |
| Schema drift entre code et BDD | Bugs silencieux | Test contract `inventory diff` en CI |
| Code custom admin malveillant | XSS | Sandbox iframe + CSP strict + audit log |
| Doublons events client/server | Coût pub mal calculé | `event_id` UUID v7 partagé client/server |

## 9. Critères d'acceptation (release Go-Live)

- [ ] 100 % des composants commerce instrumentés (kit, rituel,
      panier, checkout).
- [ ] 100 % des events GA4 e-commerce critiques actifs (view_item,
      add_to_cart, begin_checkout, purchase).
- [ ] Meta CAPI dedup > 95 % sur 7 jours de données réelles.
- [ ] Console admin testable par fondatrice sans assistance dev.
- [ ] Tests : 100 % des routes API, ≥ 90 % couverture composants
      tracking, 5 scénarios E2E Playwright (purchase complet, debug,
      consent toggle, pixel test, inventaire diff).
- [ ] Doc fondatrice "Mon premier pixel" lue + validée.
- [ ] Audit RGPD interne signé.

## 10. Glossaire

- **DataLayer** : queue JS globale (`window.femiglowDataLayer`) où
  s'empilent les events, lue par les pixels (GTM-compatible).
- **CAPI** : Conversion API (server-side) — Meta, TikTok…
- **Pixel** : script client d'une plateforme pub.
- **Consent Mode v2** : protocole Google où chaque event embarque
  un état de consentement (`granted` / `denied`) ; les plateformes
  modélisent les conversions manquantes.
- **Dedup** : déduplication. Si un event part client (pixel) ET
  server (CAPI), Meta/TikTok ne le compte qu'une fois grâce à
  `event_id`.
- **Inventaire** : liste détectée par scan du code (build-time) des
  pages et composants instrumentables.
- **Provider** : une plateforme cible (Meta, TikTok…).
