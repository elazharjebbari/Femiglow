# 00 — Synthèse exécutive

**Projet** : FemiGlow — maison de soin des ongles, Casablanca/Maroc. E-commerce paiement à la
livraison (COD/transfert), voix éditoriale « maison / rituel / initiée », multilingue FR/AR/EN
en cours d'industrialisation.
**Date** : 2026-05-30 · **Base** : `master` + `feat/i18n-foundation`.

---

## 1. Verdict

> Codebase de qualité professionnelle, posée sur une stack moderne bien tenue, avec une
> documentation interne hors-norme. Depuis l'audit du 18 mai, le chantier **systèmes live** a été
> intégralement livré, ce qui retire les trois risques bloquants de prod qui pesaient sur le chat,
> le publishing et le tracking. Restent ouverts les risques **data/conformité** (PII en clair,
> droit à l'oubli) et **observabilité prod** (pas d'APM). L'i18n FR/AR/EN est le grand chantier en
> cours, bien architecturé mais non encore mergé.

**Score de maturité produit estimé : 7,7 / 10** (vs 7,4 le 18 mai).

| Dimension | 18 mai | Aujourd'hui | Mouvement |
|---|---|---|---|
| Robustesse systèmes live (chat/publishing/tracking) | 🟡 | 🟢 | **+** moderation, Redis, crons, batching CAPI livrés |
| Observabilité prod | 🔴 3/10 | 🟡 4/10 | logger structuré + dashboards admin, mais pas de Sentry/APM |
| Conformité RGPD (PII, droit oubli) | 🔴 6/10 | 🔴 6/10 | inchangé — PII leads toujours en clair |
| Internationalisation | 🟡 partiel | 🟡 en cours | next-intl + 3 locales + scanner, Phase 8 non mergée |
| Typage & validation | 🟢 9/10 | 🟢 9/10 | `typecheck` vert |
| Tests automatisés | 🟡 6,5/10 | 🟡 7/10 | ≈787 fichiers test unit + 95 e2e |
| Documentation interne | 🟢 9/10 | 🟢 9/10 | maintenue |

---

## 2. Ce qui a changé depuis le 18 mai (acquis à ne pas refaire)

| Chantier | Doc source | État | Détail |
|---|---|---|---|
| **Systèmes live** | `live-systems-fix-2026-05/` | 🟢 mergé `master` | Sprints 1-7. Moderation OpenAI câblée (`orchestrator.ts:321`), `maxDuration` sur SSE+ingest, `lib/redis/{dedup,circuit-breaker,idempotency}`, crons `social-publish-scheduler` + `capi-flush` dans `vercel.json`, batching Meta CAPI, dashboards `/admin/live-health`, fallback multi-provider chat |
| **Attribution** | `attribution-fix-2026-05/` | 🟢 mergé | helpers `enrichEvent`/taxonomy unifiée |
| **Pages légales** | `pages-legales-fix-2026-05/` | 🟢 quasi | anonymisation marketing, privacy, drift corrigé |
| **Pollution chat/leads** | `fix/chat-conversations-leads-pollution` | 🟢 | dédup multi-identité |
| **i18n FR/AR/EN** | `i18n-strategy-2026-05/` | 🔄 actif | next-intl, 797 clés × 3, RTL/Cairo, scanner FR, seed bindings — **Phase 8, non mergé** |

> Conséquence pour les nouvelles features : **les systèmes live sont désormais une fondation
> solide** (idempotence, dédup partagée Redis, observabilité d'événements). On construit dessus.

---

## 3. Top 5 forces structurelles (socle réutilisable)

1. **Commerce robuste** — idempotence (`withIdempotency` sur lead/order/address/payment),
   réservation stock CAS, transactions Drizzle. Le tunnel d'achat est fiable.
2. **Chat IA multi-provider industriel** — orchestrator SSE, RAG + FAQ vectorielle, lead capture
   inline, moderation, breaker/dédup Redis, fallback Anthropic. Réutilisable pour toute
   assistance conversationnelle.
3. **Tracking multi-canaux mûr** — fan-out CAPI Meta/GA4/TikTok/Snap/Pinterest, consent Mode v2,
   attribution v2, dédup `eventId`, batching, plans versionnés en base. Toute nouvelle conversion
   se branche sur l'API existante.
4. **CMS de composants + content-studio** — `component_field_bindings` (override par champ et par
   locale), seed idempotent, publishing social. Permet d'éditer sans déployer.
5. **Discipline d'ingénierie** — TS strict (`noUncheckedIndexedAccess`), Zod systématique, husky
   gitleaks + migration validator, ≈787 fichiers de tests, gabarit doc reproductible par module.

---

## 4. Top 5 contraintes qui pèsent sur les prochaines features

| # | Contrainte | Sévérité | Impact sur une nouvelle feature | Doc |
|---|---|---|---|---|
| C1 | **PII leads (`email`/`phone`/`name`) en clair** en base (`schema.ts:57-62`). `lib/crypto` ne sert qu'aux secrets webhook/tracking. | 🔴 P0 | Toute feature qui collecte des coordonnées hérite du risque. Chiffrer **avant** d'élargir la collecte. | [04](04-dette-risques-ouverts.md) |
| C2 | **Pas de Sentry/APM** — `lib/logging/logger.ts` maison, pas de capture d'erreurs prod ni d'alerting. | 🟠 P1 | Une feature qui casse en prod ne sera vue qu'a posteriori. Brancher l'obs dès la conception. | [04](04-dette-risques-ouverts.md) |
| C3 | **Composants « godzilla »** : `CheckoutFlow`, `RitualsWizard`, `DeliveryCitiesEditor`, `LeadFormBubble` (> 600 LOC). | 🟠 P1 | Toute feature touchant le tunnel/wizard part d'un terrain fragile à tester. | [04](04-dette-risques-ouverts.md) |
| C4 | **i18n non finalisé** (Phase 8 en cours, non mergé). | 🟡 | Une feature avec UI publique doit être trilingue dès le départ (sinon dette immédiate). | [03](03-chantiers-en-cours.md) |
| C5 | **Rate-limiting partiel** — chat/mail couverts, mais quelques routes publiques (`/api/contact`, `/api/newsletter`) exposées. | 🟠 P1 | Une nouvelle route publique doit poser son rate-limit (Redis dispo). | [04](04-dette-risques-ouverts.md) |

---

## 5. Recommandation de cadrage

Avant d'ouvrir la prochaine vague de features :

1. **Décider du sort de l'i18n** — merger `feat/i18n-foundation` (au moins le socle Phases 1-7)
   pour que toute nouvelle UI naisse trilingue. Sinon figer une convention « FR d'abord, AR/EN
   en suivi ».
2. **Traiter C1 (PII)** si la feature touche la collecte de données — c'est le seul P0 restant.
3. **Brancher Sentry** (C2) — quelques heures, débloque l'observabilité de tout ce qui suit.
4. Pour le reste, **construire sur le socle** : le guide `05` montre comment câbler i18n,
   tracking, admin CMS, seed et tests pour une feature « DoD-complete » dès la première PR.

Le backlog d'opportunités priorisées est en [`06-opportunites-features.md`](06-opportunites-features.md).
