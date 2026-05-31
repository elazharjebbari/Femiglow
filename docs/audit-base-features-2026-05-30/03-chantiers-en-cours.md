# 03 — Chantiers en cours

État des branches et des dossiers de travail, pour savoir ce qui est **acquis**, ce qui est
**en vol**, et ce qu'il **reste à finir** avant d'empiler de nouvelles features.

---

## 1. Branches actives

| Branche | Dernier commit | Écart `master` | Rôle |
|---|---|---|---|
| `master` | 2026-05-25 | — | Référence. Inclut live-systems + attribution + légales |
| `feat/i18n-foundation` | 2026-05-30 | **40 commits, ~177 fichiers WIP** | Chantier i18n FR/AR/EN (Phases 1-8) |
| `fix/legal-pages-pollution-and-privacy` | 2026-05-27 | ancêtre d'i18n | Anonymisation marketing + privacy |
| `fix/chat-conversations-leads-pollution` | 2026-05-27 | ancêtre d'i18n | Dédup conversations/leads chat |

> Les deux branches `fix/*` sont des ancêtres d'`i18n-foundation` (leurs commits y figurent déjà).
> Le vrai sujet ouvert est **i18n**.

---

## 2. Live-systems — 🟢 livré et mergé (ne pas rouvrir)

Audit `live-systems-audit-2026-05` (24 mai) → fix `live-systems-fix-2026-05`, livré en 7 sprints
et mergé sur `master`. Vérifié dans le code au 30 mai :

| Risque audité | Correctif en place | Preuve |
|---|---|---|
| Cron scheduler social absent | crons ajoutés | `vercel.json` → `social-publish-scheduler`, `capi-flush` |
| Moderation chat jamais appelée | câblée inbound+outbound | `orchestrator.ts:321` `moderateChatText` |
| SSE coupé (pas de `maxDuration`) | configuré | `api/chat/message/route.ts`, `api/track/route.ts` |
| Dédup/breaker in-memory | externalisés Redis | `lib/redis/{dedup,circuit-breaker,idempotency}` |
| Pas de batching Meta CAPI | buffer + cron flush | `capi-flush` |
| Carrousels Insta 1 image | multi-média | content-builder publishing |
| Pas de dashboard santé | livré | `/admin/live-health` |
| Pas de fallback chat | Anthropic fallback | provider-router |

> Acquis pour les nouvelles features : **état partagé Redis, idempotency keys, observabilité
> d'événements et dashboards santé sont disponibles**. On construit dessus.

---

## 3. i18n FR/AR/EN — 🔄 chantier actif (Phase 8)

Dossier `docs/i18n-strategy-2026-05/` (+ `i18n-content-2026-05/` pour les traductions).

### Acquis (Phases 1-7)
- next-intl + middleware `[locale]`, locales `fr` (défaut), `ar` (RTL, Cairo), `en`.
- Catalogues `messages/{fr,ar,en}.json` : **797 clés × 3 locales**, même shape.
- Routes migrées sous `app/[locale]/` : home, contact, kit, journal(+slug), maison, rituel, legal.
- RTL : Tailwind logical properties (106/107 composants), police Cairo conditionnelle, zéro flash
  (script SSR inline `lang/dir`).
- LocaleSwitcher éditorial public, persistance cookie `NEXT_LOCALE`.
- Outillage : `scripts/i18n-scan-fr.mjs` (`pnpm i18n:scan-fr`), `seed-i18n-bindings.ts`
  (`component_field_bindings.locale`), admin saisie par locale (tabs FR/AR/EN).
- Admin reste **100 % FR** (ADR-008).

### Reste à faire (Phase 8 — `PHASE-8-FINITION-100PCT.md`)
| Tâche | Prio | Risque |
|---|---|---|
| 8A.2 Wizard checkout i18n + `en.ts` (funnel = revenu) | P0 | **élevé** — exige E2E commande sur 3 locales |
| 8A.1 RitualsModule : seed AR/EN + labels | P0 | moyen (DB) |
| 8B Audit profond des autres pages (home/journal/maison/contact/rituel/légales) | P0 | moyen |
| 8C Garde-fous : scanner FR en CI, ESLint no-raw-jsx, parité catalogues, E2E par locale, visual RTL | P0/P1 | faible |
| 8D Polish RTL/typo/switcher/a11y | P1 | faible |
| 8E Seed AR/EN + parité mocks↔seed + runbook remote | P0 deploy | moyen |

### Decision point
**Merger le socle i18n (au moins Phases 1-7) avant la prochaine vague de features**, pour que
toute nouvelle UI publique naisse trilingue. À défaut, figer la convention « FR d'abord, AR/EN en
suivi immédiat » — et l'appliquer (sinon dette i18n qui s'accumule à chaque feature).

---

## 4. Autres dossiers récents (contexte)

| Dossier | Nature | Lien features |
|---|---|---|
| `chat-audit-2026-05`, `chat-test-strategy-2026-05` | Audit + stratégie de test chat | Base si on étend le chat |
| `pages-legales-audit/fix-2026-05` | Conformité pages légales | Acquis |
| `test-strategy-2026-05` | Stratégie de test transverse | Cadre pour tester une feature |
| `meta-quality-audit-2026-05` | Qualité données Meta CAPI | Acquis (enrich purchase) |
| `kit-hero-optim`, `wizard-kit-optim`, `kit-landing-reorder` | Optimisations conversion `/kit` | Terrain des features conversion |

---

## 5. Travail non commité (working tree, 30 mai)

177 fichiers modifiés (43 non suivis) sur `feat/i18n-foundation`, concentrés sur le **wiring i18n
Phase 8B** : `components/sections` (53), `components/commerce` (11), `components/checkout` (10),
`app/[locale]` (8), `lib/chat` (7), `test/factories` (11). `typecheck` reste vert.

> À cadrer : committer/merger ce WIP avant d'ouvrir un nouveau chantier, pour ne pas empiler deux
> fronts sur les mêmes fichiers (sections, checkout, commerce).
