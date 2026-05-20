# Audit application FemiGlow staging — 2026-05-14

> Périmètre : dépôt staging `/var/www/femiglow-staging`, branche `master`, HEAD `cb9693c`.
> Mode : audit rapide mais global, lecture du code et de `docs/`, sans modification applicative.
> Attention : le worktree contient déjà des changements non commités, notamment migrations/email automation/tracking. Cet audit ne les revert pas et ne les valide pas fonctionnellement.

---

## 1. Synthèse exécutive

FemiGlow n’est plus le prototype Phase 1 décrit par les premiers README. Le dépôt contient aujourd’hui une application Next.js 14 App Router avec un back-office complet, une base Postgres/Drizzle, un CMS de composants, un catalogue produit, un tunnel de commande, du tracking GTM/analytics, un assistant chat multi-provider, un système média, un module emailing Stalwart/Listmonk, des pages légales, un système de reset, des seeders et une documentation très vaste.

Quelques ordres de grandeur observés :

| Élément | Volume observé |
| --- | ---: |
| Fichiers `docs/` | 1117 |
| Fichiers TS/TSX sous `apps/web/src` | 1969 |
| Tests TS/TSX sous `apps/web/src` | 556 |
| Routes API `route.ts` | 271 |
| Migrations SQL Drizzle | 60+ fichiers, de `0000_initial.sql` à `0049c_tracking_component_enum_additions.sql` |
| Dossiers fonctionnels principaux | admin, analytics, chat, checkout, CMS composants, email, legal, media, products, reset, tracking |

Lecture globale : la base technique est ambitieuse et déjà structurée. Les forces principales sont la séparation App Router/lib/composants, la validation Zod, Drizzle, les seeders, l’outillage tests, la documentation par domaine et la charte visuelle forte. Les risques principaux sont l’écart entre la documentation initiale et le produit réel, l’hétérogénéité de certaines sécurités transverses, la complexité grandissante du back-office, et quelques points critiques encore visibles sur tracking, media, checkout et RBAC.

Scores indicatifs sur 5 :

| Axe | Score | Lecture courte |
| --- | ---: | --- |
| Architecture générale | 4.0 | Monorepo simple, couches lisibles, mais surface devenue très large |
| Backend/API | 3.8 | Routes nombreuses, Zod/Drizzle solides, guards variables selon modules |
| Data/DB | 4.0 | Migrations riches, index, audit, matviews ; drift schema/doc à surveiller |
| Frontend | 3.8 | Composants nombreux, data boundaries correctes, complexité client côté checkout/chat |
| UI/design | 4.2 | Charte claire, tokens CSS, identité cohérente |
| UX | 3.6 | Parcours B2C travaillés ; admin dense et parfois outil interne brut |
| Sécurité | 3.2 | CSP/session/rate-limit existent ; RBAC incomplet, GTM/media à durcir |
| Tests | 4.0 | Très bonne densité de tests unitaires ; E2E/perf/a11y à vérifier régulièrement |
| Documentation | 4.3 | Riche, mais dispersée et parfois désynchronisée |

---

## 2. Ce que raconte `docs/`

`docs/` est devenu un vrai système documentaire, pas seulement une annexe projet. On y trouve :

| Dossier | Rôle |
| --- | --- |
| `docs/preparation/` | Vision initiale : marque, design system, pages B2C, architecture, QA, roadmap |
| `docs/audit/` | Audit produit/code existant, dette, catalogue pages, recommandations contenu |
| `docs/admin/`, `docs/admin-config/` | Back-office, configuration, manuel fondatrice, RBAC/nav/branding |
| `docs/components-cms/`, `docs/component-media-system/` | CMS de composants, champs, live preview, media bindings |
| `docs/chat-assistant/`, `docs/dossier-chat-v2/` | Assistant conversationnel, RAG, providers, UX mobile, analytics |
| `docs/checkout-funnel/` | Tunnel commande, wizard, villes de livraison, tests |
| `docs/emailing/` | Architecture emailing, Stalwart, Listmonk, automation, admin emails |
| `docs/event-mappings/`, `docs/gtm/`, `docs/tracking*` | Tracking, GTM, mappings, consent, debug |
| `docs/media/`, `docs/images/`, `docs/videos/` | Pipeline média, rendu, lazy loading, overrides |
| `docs/legal-pages/`, `docs/seo-cms/`, `docs/products-cms/` | Modules spécialisés CMS/SEO/legal/products |
| `docs/reset-feature/` | Reset orchestré, phases, rollback, observabilité |

Constat important : les documents initiaux parlent encore d’une Phase 1 prototype avec mock data et CMS futur. Le code réel a dépassé ce stade. Le prochain travail devrait donc distinguer clairement :

- les documents historiques à conserver comme vision,
- les documents opérationnels qui décrivent le code actuel,
- les documents de planification pour systèmes futurs.

---

## 3. Architecture applicative

Stack effective :

| Couche | Implémentation |
| --- | --- |
| App | Next.js 14.2.15, App Router, React 18 |
| Langage | TypeScript strict, modules ESM |
| Workspace | pnpm monorepo, app unique `apps/web` |
| DB | Drizzle ORM, Postgres/postgres-js ou Neon HTTP |
| Validation | Zod |
| Auth admin | Session signée, `iron-session`/cookie maison via `decodeSession` |
| State client | Zustand, React Hook Form |
| UI | Tailwind + tokens CSS custom properties |
| Media | Sharp, ffmpeg, Vercel Blob/local/external selon env |
| Chat | LangChain + providers OpenAI, Anthropic, Gemini, Mistral, Ollama, etc. |
| Email | Nodemailer/Stalwart/Listmonk, outbox, templates |
| Tests | Vitest, Testing Library, Playwright, axe |

Points forts :

- `apps/web/src/app` suit bien l’App Router avec séparation marketing, commerce, admin et API.
- `apps/web/src/lib` contient des modules métier isolés : `checkout`, `chat`, `tracking`, `media`, `legal`, `mail`, `reset`, `products`, etc.
- `db()` dans `apps/web/src/lib/db/client.ts` est pragmatique : `DATABASE_URL` absent = fallback `memoryStore()` utile pour dev/tests ; URL Neon = driver Neon ; sinon postgres-js.
- Les variables d’environnement sont centralisées dans `apps/web/src/lib/env.ts` avec Zod.
- Le middleware centralise CSP, HSTS, robots/no-store admin, auth admin page, cookies de click ID.

Risques :

- Surface API très large : 271 routes `route.ts`, dont beaucoup d’admin, de cron et d’intégrations.
- Plusieurs générations de modules cohabitent : README Phase 1, CMS composants, chat v2, emailing M5, tracking additions.
- Le fallback mémoire facilite les tests mais peut masquer des divergences DB réel vs mémoire si les repositories ne sont pas testés contre Postgres.
- Certains chemins admin utilisent `getAdminSession`, d’autres `requireAdmin`, d’autres `requireAdminApi`, d’autres helpers spécialisés.

---

## 4. Backend et API

Forces :

- Validation aux frontières fréquente via Zod.
- Erreurs typées dans `lib/errors/http-error.ts`.
- Idempotence checkout via `withIdempotency`.
- Audit logs présents dans plusieurs modules.
- Rate-limit déjà utilisé sur login admin, tracking, media admin, endpoints mail, chat et rituals.
- Webhooks outbound et email outbox structurés.

Points de vigilance :

| Sujet | Constat | Priorité |
| --- | --- | --- |
| Checkout lead | `POST /api/checkout/lead` est idempotent mais aucun rate-limit n’est visible dans la route | Haute |
| GTM provider | `pixelId` est injecté dans un snippet JS en chaîne ; le schéma admin accepte seulement `z.string().max(255)` | Haute |
| Media public | `/api/media/[idOrSlug]` expose les métadonnées prêtes en JSON ; `MEDIA_SIGNED_URL_SECRET` existe mais n’est pas utilisé ici | Haute selon politique média |
| Healthcheck | `/api/health` renvoie `ok` sans vérifier DB, mail, blob, cron ou migrations | Moyenne |
| RBAC | Matrice RBAC existe, mais l’enforcement runtime observé est surtout légal ; la majorité admin reste session = accès | Haute |
| Admin API | Beaucoup de routes sensibles, droits fins peu uniformisés | Haute |

Note positive depuis l’ancien audit : `POST /api/newsletter` et `POST /api/contact` utilisent désormais `enforceMailRateLimit`, donc ces deux routes sont mieux protégées qu’auparavant.

---

## 5. Données et base

Le modèle de données couvre désormais beaucoup plus que le shop initial :

- `admin_users`, sessions, login attempts.
- `leads`, `lead_events`, `lead_tag`.
- `orders`, `order_items`, extensions funnel et chat lead.
- `checkout_idempotency`, stock produit, villes de livraison.
- tracking events, providers, consent snapshots, event mappings.
- CMS composants, bindings, history, animations, media bindings.
- media, variants, tags, usages, jobs.
- analytics et insights, matviews.
- chat sessions, messages, providers, FAQ, intents, leads, budget/rate.
- email outbox, events, templates, audiences, campaigns, suppressions, automations.
- legal pages, placements, redirects, health checks.
- reset phases et seeders.

Forces :

- Drizzle donne une source typée lisible.
- Beaucoup d’index ciblent les lectures admin et analytics.
- Plusieurs modules ont une logique d’audit/versioning.
- Les migrations racontent bien l’évolution produit.

Risques :

- Nommage migration avec suffixes parallèles (`0023_*`, `0029_*`, `0030_*`, `0031_*`, `0032_*`, `0033_*`, `0036_*`, `0037_*`, `0047*`, `0049*`) : acceptable si le journal Drizzle est cohérent, mais fragile à maintenir.
- `schema.ts` et `schema-emails.ts` grossissent ; il faudra surveiller la lisibilité et les imports croisés.
- La documentation initiale des modèles (`docs/preparation/07-*`) ne reflète plus la réalité.
- Les modules à forte volumétrie potentielle, notamment events/tracking/email/history, doivent avoir politiques de rétention vérifiables et crons surveillés.

---

## 6. Frontend

L’UI publique est structurée autour de :

- routes marketing : home, rituel, kit, journal, maison, contact ;
- routes commerce : panier, commander, merci ;
- composants de sections éditoriales dans `components/sections` ;
- composants commerce dans `components/commerce` ;
- composants chat, tracking, forms, layout, legal, UI primitives.

Forces :

- Beaucoup de composants ont leurs tests.
- Les composants `Bound` suggèrent une bonne séparation données/rendu.
- Les primitives `Button`, `Container`, `Heading`, `Kicker`, `Text`, `Image` favorisent la cohérence.
- `SkipLink` existe et la classe CSS est visible au focus.
- Gestion mobile spécifique : checkout bar, mini cart, chat launcher mobile, focus guard iOS.

Risques :

- Les composants admin sont nombreux et probablement moins homogènes visuellement que le B2C.
- Le checkout et le chat ont une partie client significative : local state, persistence, SSE, feedback, lead flow.
- Les pages dev (`/dev/checkout-wizard`, `/dev/media-demo`) doivent rester fermées ou non indexables en staging/prod selon le besoin.
- Les imports LangChain/providers peuvent peser lourd si mal séparés côté bundles, même si la majorité devrait rester serveur.

---

## 7. Design, UI et charte graphique

La charte est forte et bien documentée :

- palette crème, encre, sauge, pétale, ciel, champagne ;
- typographies Inter et Cormorant ;
- maison de soin, rituel, luxe accessible ;
- refus du marketing agressif ;
- microcopy sobre : pas de « Acheter maintenant », pas de countdown, pas de promesse excessive ;
- images mains, gestes, détails, lumière naturelle.

Le code reflète une grande partie de cette charte :

- tokens CSS dans `apps/web/src/styles/tokens.css`,
- Tailwind mappé sur variables,
- `prefers-reduced-motion`,
- focus visible,
- classes utilitaires pour skip link,
- z-index documenté pour chat overlay.

Points de vigilance design :

- Le fichier `globals.css` met `letter-spacing: -0.02em` sur tous les titres, alors que la consigne de design système initiale limite les variations typographiques. À auditer visuellement.
- Certains tokens de doc et de code divergent (`--color-encre-claire` dans docs vs `--color-encre-soft` dans code, par exemple).
- L’admin peut dériver vers une interface dense et utilitaire ; c’est acceptable pour l’usage interne, mais il faut une charte admin distincte : densité, tables, filtres, actions destructives, confirmations.
- Les couleurs champagne/sauge dark doivent rester hors corps de texte courant pour respecter les contrastes.

---

## 8. UX et parcours

Parcours publics :

- Le site raconte bien une progression : maison → rituel → kit → commander → merci.
- Le kit est le pivot de conversion.
- Le checkout est devenu un wizard plus avancé que le panier prototype.
- Les formulaires contact/newsletter ont validation, honeypot et rate-limit mail.
- Le chat ajoute une couche d’assistance et de capture de lead.

Parcours admin :

- L’admin couvre beaucoup de domaines : leads, composants, media, legal, tracking, emails, produits, chat, webhooks, audit, réglages.
- La navigation est configurable via admin-config.
- La matrice RBAC est affichable/configurable, mais pas encore appliquée partout.

Risques UX :

- L’admin risque de devenir une juxtaposition de consoles spécialisées. Il faut une architecture d’information admin orientée tâches : publier, corriger, suivre, relancer, diagnostiquer.
- Les flows sensibles doivent avoir confirmations claires : seeders, reset, bulk actions, publish, delete, webhook, emails.
- Le chat mobile a déjà eu un runbook de correction ; c’est un signe que les overlays/sticky bars doivent être testés en mobile réel.
- Le checkout doit éviter les identifiants sensibles en URL ou localStorage lorsque possible.

---

## 9. Sécurité, RGPD et conformité

Forces :

- CSP centralisée, HSTS en production, `frame-ancestors` durci sauf preview admin.
- Admin noindex/no-store.
- Secrets env typés avec tailles minimales.
- Rate-limit sur plusieurs surfaces.
- HMAC et tokens présents pour webhooks/email.
- Docs RGPD/retention présentes dans plusieurs modules.

Risques prioritaires :

1. GTM `pixelId` : regex stricte par provider à ajouter avant injection dans un snippet.
2. RBAC : généraliser l’enforcement par ressource/action, pas seulement pour legal.
3. Media : clarifier public vs privé ; si privé, implémenter réellement URLs signées et expirations.
4. Checkout lead : ajouter rate-limit IP + téléphone + session.
5. Health/ops : ajouter endpoint full health pour DB, migrations, mail queue, blob/media, cron secrets.
6. Data retention : vérifier que les crons de purge email/tracking/chat/legal/history sont actifs en staging/prod.

---

## 10. Performance et observabilité

Forces :

- App Router et RSC permettent de garder beaucoup de logique côté serveur.
- Media pipeline outillé avec optimisation et healing.
- Tracking et analytics internes riches.
- Logger JSON avec redaction PII.
- Mécanismes de cache/revalidation présents dans plusieurs modules.

À vérifier :

- Lighthouse sur home, kit, commander, journal article, admin dashboard.
- Bundles publics : vérifier que chat/providers/admin/email ne fuient pas dans le JS public.
- Images LCP : formats, dimensions, preload, fallback.
- Crons : logs, alertes, retry, dernier succès visible dans admin.
- Email outbox : DLQ, retries, suppressions, webhooks Stalwart/Listmonk.

---

## 11. Tests et qualité

Très bon signal : 556 fichiers de tests TS/TSX sous `apps/web/src`. On voit des tests pour auth, checkout, tracking, legal, components, chat, rituals, reset, email, analytics.

Risques et manques possibles :

- Les tests unitaires ne remplacent pas un smoke staging contre la vraie DB.
- Les E2E Playwright doivent couvrir les flux critiques : kit → checkout → merci, contact, newsletter, chat lead, admin login, publish component, upload media, tracking provider.
- Les migrations récentes non commitées doivent être validées avec `db:validate:strict` puis migration sur staging.
- A11y : axe est présent, mais il faut des parcours clavier réels sur chat, checkout, admin tables, modales et drawers.

---

## 12. Priorités recommandées

### Priorité 0 — sécuriser le socle avant nouveaux systèmes

| Action | Impact | Effort |
| --- | --- | --- |
| Ajouter validation stricte des IDs tracking par provider, surtout GTM | Sécurité haute | Court |
| Ajouter rate-limit à `/api/checkout/lead` | Anti-spam/funnel | Court |
| Définir et appliquer une policy RBAC transverse admin | Sécurité/admin | Moyen |
| Décider public/privé pour media et aligner `MEDIA_SIGNED_URL_SECRET` | Sécurité/data | Moyen |
| Créer un `/api/health/full` utilisé par ops avec DB/mail/media/cron | Ops | Court |

### Priorité 1 — reprendre la documentation comme source de pilotage

| Action | Impact | Effort |
| --- | --- | --- |
| Marquer `docs/preparation/` comme vision historique | Clarté | Court |
| Créer un index “état actuel” qui pointe vers les docs opérationnels | Onboarding | Court |
| Maintenir un inventaire modules : owner, routes, tables, crons, tests | Gouvernance | Moyen |
| Ajouter une matrice décisions ouvertes / décisions actées | Pilotage | Court |

### Priorité 2 — durcir l’expérience produit

| Action | Impact | Effort |
| --- | --- | --- |
| Audit mobile réel chat + checkout + sticky headers | UX conversion | Moyen |
| Audit contraste/typographie vs tokens | Accessibilité/design | Court |
| Audit admin IA : tâches fréquentes, bulk actions, erreurs, empty states | Productivité fondatrice | Moyen |
| Tests E2E staging sur flux publics et admin critiques | Qualité release | Moyen |

---

## 13. Décision de cadrage pour la suite

Avant d’ajouter de nouveaux systèmes, je recommande de figer une carte d’application en 10 modules :

1. Site public B2C.
2. Checkout et leads.
3. Produits et stock.
4. CMS composants et design content.
5. Media.
6. Tracking, GTM, analytics.
7. Chat assistant.
8. Emailing et automations.
9. Admin-config, RBAC, audit.
10. Legal, SEO, reset, ops.

Pour chaque module, le prochain document utile serait une fiche courte : objectifs, routes, tables, crons, permissions, risques, tests, owner métier. Cela évitera que les futures solutions s’ajoutent par-dessus une complexité déjà élevée sans contrat clair.

---

## 14. Références principales lues

- `README.md`
- `apps/web/README.md`
- `apps/web/package.json`
- `apps/web/src/app/**`
- `apps/web/src/lib/**`
- `apps/web/src/components/**`
- `apps/web/src/styles/tokens.css`
- `apps/web/src/styles/globals.css`
- `apps/web/src/middleware.ts`
- `apps/web/src/lib/env.ts`
- `apps/web/src/lib/db/client.ts`
- `apps/web/src/lib/db/schema.ts`
- `apps/web/src/lib/db/schema-emails.ts`
- `apps/web/drizzle/migrations/*.sql`
- `docs/audit/audit-global-2026-05.md`
- `docs/audit/README.md`
- `docs/preparation/00-executive-summary.md`
- `docs/preparation/01-marque-vision-voix.md`
- `docs/preparation/02-design-system.md`
