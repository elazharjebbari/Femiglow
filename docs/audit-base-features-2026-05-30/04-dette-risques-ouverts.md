# 04 — Dette & risques ouverts

Ce que les nouvelles features doivent **respecter ou traiter**. Tri par sévérité. Chaque risque
indique l'impact concret sur l'ajout de fonctionnalités.

---

## 1. Risques P0/P1 hérités de l'audit du 18 mai

| # | Risque | Sévérité | État au 30 mai | Impact sur une nouvelle feature |
|---|---|---|---|---|
| R1 | **PII leads en clair** : `leads.email`, `leads.phone`, `leads.name`, adresses livraison stockés en `text` (`schema.ts:57-62`). `lib/crypto` (AES-256-GCM) n'est branché que sur les secrets `webhook_endpoints` et `tracking/providers`. | 🔴 **P0** | **ouvert** | Toute feature collectant des coordonnées (formulaire, quiz, prise de RDV, abonnement) aggrave l'exposition. À chiffrer **avant** d'élargir la collecte. |
| R2 | **Observabilité prod faible** : `lib/logging/logger.ts` (logs structurés) + dashboards `/admin/live-health`, mais **pas de Sentry/APM**, pas de métriques exportées, pas d'alerting sur erreurs. | 🟠 **P1** | partiellement traité | Une feature qui casse en prod ne sera vue qu'a posteriori. Brancher la capture d'erreurs dès la conception. |
| R3 | **Rate-limiting partiel** : chat (session+IP) et mail couverts ; routes publiques comme `/api/contact`, `/api/newsletter`, `/api/checkout/lead` moins protégées. | 🟠 **P1** | partiel | Toute **nouvelle route publique** doit poser son rate-limit (Redis dispo). |
| R4 | **Pas de branch protection** sur `master`, pas de hook `commit-msg`. | 🟠 **P1** | ouvert | Pas de garde-fou PR/CI obligatoire — discipline manuelle. À activer si l'équipe grandit. |
| R5 | **Composants « godzilla »** : `CheckoutFlow` (~625), `RitualsWizard` (~1017), `DeliveryCitiesEditor` (~1117), `LeadFormBubble` (~451) LOC. | 🟠 **P1** | ouvert | Toute feature touchant tunnel/wizard part d'un fichier difficile à tester. Extraire hooks/sous-composants **en passant**. |

---

## 2. Risques secondaires (P2)

| Sujet | Détail | Impact |
|---|---|---|
| Droit à l'oubli RGPD | Pas d'endpoint `/api/admin/data-subject/delete` (cascade + pseudonymisation) ; soft-delete absent sur `leads`/`orders`/`chat_lead`. | Obligation légale dès qu'on collecte plus de PII. |
| MFA admin | Pas de MFA TOTP sur `/admin/login` ; pas d'IP binding session. | Surface d'attaque back-office. |
| `dangerouslyAllowSVG: true` | XSS résiduel via SVG. | À surveiller si upload d'assets ouvert au public. |
| CSP `'unsafe-inline'` (scripts) | Limitation Next.js 14 RSC. | Résolu par upgrade Next 15 + `strict-dynamic`. |
| Pas de queue durable | Retries différés via crons uniquement. | Une feature à fort volume async aura besoin d'une vraie queue (BullMQ/pg-boss). |
| `console.log` résiduels | Quelques logs bruts en prod. | Bruit ; migrer vers `logger`. |
| i18n non finalisé | Phase 8 en cours (cf. doc `03`). | Une UI publique non trilingue crée de la dette immédiate. |

---

## 3. Contraintes d'architecture à ne pas violer

Ces invariants protègent la maintenabilité. Les casser = dette immédiate.

1. **Une string a une seule source** (doc `02 §2.4`). Pas de duplication entre `messages`, CMS,
   seed et override admin.
2. **Composants de présentation « dumb »** : pas de `getTranslations` direct ; strings en props
   avec défaut FR, résolues par un `*Bound` server (doc `02 §2.3`).
3. **Garde FR-default** : en locale non-défaut, refuser tout fallback FR hardcodé.
4. **Admin 100 % FR** (ADR-008) — ne pas i18n-iser le back-office.
5. **Seed = mécanisme de déploiement du contenu** : idempotent, locale-aware, parité avec les
   mocks dev. Toute donnée éditoriale en prod passe par le seed, pas par les mocks.
6. **Mutations sensibles idempotentes + transactionnelles**, état partagé via Redis (pas de `Map`
   locale pour dédup/breaker) — leçon live-systems.
7. **Tout événement marketing déclaré dans le plan de tracking** versionné, mappé par provider.

---

## 4. Ordre de traitement conseillé avant d'élargir

| Étape | Action | Effort | Débloque |
|---|---|---|---|
| 1 | **Sentry** (R2) — capture erreurs + alerting | ~0,5 j | Observabilité de tout ce qui suit |
| 2 | **Rate-limit middleware** sur routes publiques (R3) via Redis | ~0,5 j | Sécurise les nouvelles routes |
| 3 | **Chiffrement PII leads** (R1) — réutiliser `lib/crypto`, migration + backfill | ~2 j | Conformité avant d'élargir la collecte |
| 4 | **Merger le socle i18n** (Phases 1-7) | cadrage | UI trilingue par défaut |
| 5 | Refactor « godzilla » au fil de l'eau (R5) | continu | Testabilité du tunnel |

> R1 + R2 + R3 sont les pré-requis « hygiène » avant toute feature qui collecte des données ou
> expose une route publique. Le reste se traite en passant.
