# 01 — Cartographie fonctionnelle

Inventaire des capacités existantes, pour qu'une nouvelle feature **réutilise** au lieu de
recréer. Trois plans : pages publiques, domaines métier (`src/lib`), back-office (`src/app/admin`).

---

## 1. Pages publiques (front B2C)

Routes migrées sous `app/[locale]/` (i18n actif) : `contact`, `journal` + `journal/[slug]`,
`kit`, `legal/[slug]`, `maison`, `rituel`, et la home `/[locale]`. Le funnel (`/panier`, `/merci`)
et les routes legacy `(marketing)/*` cohabitent le temps de la migration.

| Page | Rôle | Données | Statut i18n |
|---|---|---|---|
| `/[locale]` (home) | Hero, gestes, manifeste, avis, extraits journal | CMS + mocks locale-aware | 🟡 Phase 8 |
| `/[locale]/kit` | **Page de conversion** (hero, compo, vidéo gestes, rituels, FAQ, wizard commande) | CMS + seed + feed produit | 🟡 la plus profonde, en finition |
| `/[locale]/rituel` | Éditorial rituel | CMS | 🟡 |
| `/[locale]/journal` + `[slug]` | Magazine / articles | CMS articles locale-aware | 🟡 |
| `/[locale]/maison` | Manifeste de marque | CMS | 🟡 |
| `/[locale]/contact` | Formulaire de contact (POC i18n) | form + mail | 🟢 POC validé |
| `/[locale]/legal/[slug]` | Mentions, CGV, confidentialité, cookies, livraison, retours | seed legal | 🟡 |
| `/panier`, `/merci` | Tunnel checkout standalone | checkout state | 🟡 couplé 8A.2 |

> Pour une nouvelle page publique : la créer **directement** sous `app/[locale]/`, brancher les
> patterns i18n (doc `05 §1`), poser le tracking `view_*` (doc `05 §2`).

---

## 2. Domaines métier (`src/lib`)

Quarante-deux domaines isolés. Les plus structurants pour bâtir dessus :

| Domaine | Ce qu'il offre | Réutilisable pour |
|---|---|---|
| `checkout` | State machine wizard, idempotence commande, i18n dédié (`dictionary.ts`) | Tout flux multi-étapes (devis, prise de RDV, abonnement) |
| `chat` | Orchestrator SSE, RAG/FAQ vectorielle, providers (OpenAI/Anthropic/Gemini/Mistral…), moderation, lead capture, rate-limit, breaker Redis | Assistant produit, support, qualification de lead |
| `tracking` | Dispatcher fan-out CAPI (Meta/GA4/TikTok/Snap/Pinterest), consent, attribution v2, dédup, batching | Mesurer toute conversion / événement marketing |
| `social-publishing` | Adapters Postiz/dry-run, scheduler, retry/idempotence, carrousels, alertes Slack | Diffusion de contenu sur réseaux |
| `content-studio` / `content-studio-v2` | Génération de contenu IA, drafts, publication directe | Studio éditorial, calendrier de posts |
| `cms` + `components` | `component_field_bindings` (override champ × locale), résolution locale-aware | Éditer du contenu sans déployer, par locale |
| `webhooks` | HMAC entrant/sortant, idempotence, engine de delivery | Intégrations tierces (CRM, ERP, notifications) |
| `tracking-plan` (schema) | Plans d'événements versionnés en base | Gouvernance analytics |
| `mail` (Stalwart) + `emails` (Listmonk) | Transactionnel SMTP + campagnes | Notifications, séquences, newsletters |
| `media` | Sharp + BlurHash, optimisation cron | Toute image produit/éditoriale |
| `seo` | Defaults + overrides, JSON-LD, hreflang | Métadonnées de toute page |
| `rituals`, `products`, `kit`, `composition`, `video` | Données + builders du cœur produit | Variantes produit, nouveaux packs |
| `promo-slide-header` | Bandeau promo géo | Promos contextuelles |
| `reset` | Réinitialisation de données de démo | Environnements / seed |
| `redis` | `dedup`, `circuit-breaker`, `idempotency`, `client` | Dédup, breakers, idempotency keys de toute route |
| `feature-flags` | `attribution`, `kit-layout`, `live-systems` | Déploiement progressif d'une feature |
| `crypto` | AES-256-GCM (chiffre secrets webhook/tracking — **pas les leads**) | Chiffrer des secrets / PII (à étendre) |
| `auth` | iron-session chiffrée, Argon2id | Session admin / accès protégé |
| `rate-limit` | Token bucket DB (+ Redis dispo) | Protéger une route publique |
| `audit` | Journal d'audit (`audit_log`) | Traçabilité d'actions sensibles |
| `logging` | `logger.ts` structuré | Logs — **brancher Sentry par-dessus** |

---

## 3. Back-office (`src/app/admin`, 141 pages)

| Section | Capacité |
|---|---|
| `analytics` | Tableaux de bord conversion / funnel |
| `chat` | Instructions, providers, FAQ, leads, analytics chat |
| `components` | Édition CMS des champs de composants (par locale) |
| `content-studio` / `-v2` / `-legacy` | Studio de contenu IA + publication sociale |
| `products`, `kit`, `rituals` | Catalogue et pages produit |
| `seo` | Métadonnées, defaults, overrides |
| `media` | Bibliothèque d'assets |
| `leads` | Gestion des prospects (⚠ PII en clair) |
| `emails` | Campagnes / transactionnel |
| `tracking` | Plans d'événements, mappings providers |
| `webhooks` | Endpoints, secrets, deliveries |
| `live-health` | **Santé temps réel** chat/publishing/tracking (livré live-systems) |
| `legal` | Pages légales |
| `audit` | Journal d'audit |
| `settings` | Configuration générale |

> Pour exposer une nouvelle capacité en back-office : suivre le pattern d'une section existante
> (page RSC + route API `/api/admin/<x>` + query Drizzle + tests). L'admin reste **100 % FR**
> (ADR-008) — pas d'i18n à prévoir côté back-office.

---

## 4. Intégrations externes (déjà câblées)

| Service | Usage | Auth |
|---|---|---|
| OpenAI / Anthropic / Gemini / Mistral / DeepSeek / Qwen | Chat + embeddings + moderation | clés chiffrées en DB |
| Meta CAPI, GA4 MP, TikTok, Snap, Pinterest, Google Ads | Tracking conversions | tokens chiffrés |
| Postiz | Publishing social | API key |
| Stalwart (SMTP) | Mail transactionnel | compte dédié |
| Listmonk | Campagnes email | self-hosted |
| Slack | Alertes (publishing, digests) | webhook |
| Redis (Upstash-compatible) | dédup / breaker / idempotency | URL + token |
| Neon Postgres | Base de données | connection string |

> Une feature qui a besoin d'IA, de mesure, de mail ou de diffusion sociale **a déjà son
> intégration** : on étend, on n'ajoute pas de nouveau fournisseur sans raison.
