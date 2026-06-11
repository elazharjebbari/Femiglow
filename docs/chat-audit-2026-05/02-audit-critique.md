# 02 — Audit critique du code

Audit indépendant réalisé par lecture directe du code, sans regarder les docs au préalable.
Confronté ensuite aux promesses ADR (voir [03-adr-vs-realite.md](03-adr-vs-realite.md)).

**Sévérités** :
- **C** (CRITIQUE) — corruption, bug prod, sécurité, KPI faux
- **I** (IMPORTANT) — dette technique sérieuse, gaps fonctionnels majeurs
- **M** (MOYEN) — qualité code, observabilité incomplète
- **Mi** (MINEUR) — style, naming, micro-optimisations

## A. Findings par sévérité

### CRITIQUE

#### C1. Tools framework ADR-002 totalement absent

**Localisation** : `apps/web/src/lib/chat/providers/types.ts:32-50`

`ChatStreamRequest` n'expose aucun champ `tools[]`. `ChatProvider.streamChat` n'a pas de
surface tools. Aucun fichier `tool.ts`, aucune table `chat_tool_call_log` dans `schema.ts`.

ADR-002 promet 5 tools (`get_product`, `get_delivery_info`, `search_faq`, `check_promo`,
`get_order_status`) — **rien n'est câblé**.

**Impact** : la promesse "factualité prix/livraison ≥98 %" (cible ADR) est non atteignable.
Toutes les questions factuelles passent par RAG dont la KB n'est pas auto-synchronisée.

**Effort** : 3-4 semaines (schemas Zod tools + dispatch + audit log + tests + matrice par provider).

---

#### C2. Modération outbound advisory — réponse toxique livrée au client

**Localisation** : `apps/web/src/lib/chat/services/orchestrator.ts:415-433`

La modération outbound s'exécute APRÈS que tous les chunks soient déjà yieldés au client
(`for await chunk … yield`). Quand `outboundMod.flagged === true`, un event `error` est
loggé mais le contenu **a déjà été streamé**.

Le commentaire ligne 412 admet le bug :
> *"la réponse aggregée est déjà envoyée au client via stream — on ne peut pas la reprendre"*

Seule la modération **inbound** est bloquante.

**Impact** : sécurité éditoriale + risque légal/marque. Le pipeline modère pour le KPI, pas
pour la protection visiteur.

**Effort** : 1 semaine (buffer stream → moderate → yield, ou yield partiel + replace).

---

#### C3. Cascade fallback 5 niveaux ADR-004 non implémentée

**Localisation** : `apps/web/src/lib/chat/services/provider-router.ts:121-148`,
`apps/web/src/app/api/chat/health/route.ts`

`provider-router.ts` fait UNIQUEMENT le multi-provider failover (Niveau 0 → 1).
Aucun code ne bascule en `RAG_ONLY`, `CANNED_ONLY` ou `STATIC`.

`/api/chat/health/route.ts` calcule un `serviceLevel` 1-5 mais c'est **purement observable**
(pas connecté à l'orchestrator).

`getServiceLevel()` promis par l'ADR-004 n'existe pas dans le code.

Quand tous providers chat sont KO, `providerRouter.choose` throw → orchestrator yield
`event: error` → **widget bloqué**. Aucun fallback canned-only n'attrape les leads pendant
l'outage.

**Impact** : panne provider = perte sèche de leads. La promesse "uptime perçu ≥99,5 % /
mode canned-only convertit pendant panne" est **non tenue**.

**Effort** : 2 semaines.

---

#### C4. Budget guard `assertBudget` défini mais jamais appelé

**Localisation** : `apps/web/src/lib/chat/services/billing.ts:52`

`grep -r "assertBudget" apps/web/src/ --include="*.ts"` retourne 2 résultats :
la déclaration + un commentaire. **Aucun appel runtime**, ni dans `orchestrator.ts` ni
dans `/api/chat/message/route.ts`.

Le budget global mensuel n'est PAS appliqué — seul `budget-watch.ts` (cron horaire)
désactive a posteriori. **Entre deux runs de cron**, n providers peuvent dépasser librement.

**Impact** : risque financier. Une fuite (boucle bug client, attaque coût, scrappers) peut
consommer 1 h de budget avant désactivation. Pire encore si le service ne se contente pas
de la stricte rule "désactivation à 100 %" mais devrait avoir un cap dur.

**Effort** : 30 min (ajouter `await billing.assertBudget()` dans route avant streamReply +
tests).

---

#### C5. SSE event `message_complete` non contractuel — widget peut rester bloqué

**Localisation** : `apps/web/src/lib/chat/services/orchestrator.ts:332-342`,
`apps/web/src/lib/chat/contracts.ts:251-310`

Quand la modération inbound flag, on yield `{ event: 'message_complete', data: {...} }`
puis return. Or `ChatStreamEvent` Zod liste uniquement
`start | chunk | source | end | error | lead-form-offer`.
**`message_complete` n'existe pas** dans le contrat.

Aucun `start` ni `end` n'est émis dans cette branche.

**Impact** : selon l'implémentation client, le composer reste en état "streaming"
indéfiniment. Le test `orchestrator.test.ts` ne couvre pas ce code path.

**Effort** : 30 min (renommer en `event: 'end'` après un `event: 'chunk'` avec le message
scripté + ajouter test).

---

#### C6. Race condition sur breaker memory ↔ Redis

**Localisation** : `apps/web/src/lib/chat/services/provider-router.ts:77-98`

`recordFailure` met à jour la map mémoire **immédiatement** ET fire-and-forget la mise à
jour Redis. Deux conséquences :
- Sur Vercel cold start, la mémoire repart à 0 mais Redis conserve l'état `OPEN` →
  contradictions.
- `await isOpenAsync` (ligne 131) lit Redis si flag v2, mais `isOpenMemory` (path par
  défaut) ne voit pas les fails des autres lambdas.

Le pattern actuel = "best effort" sans synchronisation. **Pas de test unitaire** pour
`provider-router.ts` (voir I5).

**Impact** : sous charge multi-lambda, le breaker s'ouvre trop tard ou pas du tout →
cascade d'appels vers un provider down.

**Effort** : 1 semaine (un seul backend de truth + tests).

---

### IMPORTANT

#### I1. Dette `attributeConversion` toujours dead code

**Localisation** : `apps/web/src/lib/chat/services/session-service.ts:96-102`

Aucun appelant runtime. `grep -r "attributeConversion"` retourne 3 hits : la définition,
son JSDoc, et un commentaire dans `admin/queries.ts:87` qui l'admet :
> *"rien n'appelle attributeConversion en runtime aujourd'hui"*

`chatSession.convertedAt` et `chatSession.convertedOrderId` ne sont jamais écrits côté
visiteur. Le KPI conversion s'appuie sur `chatLead.outcome='converted'` (admin-marqué via
`/api/admin/chat/leads/[id]/outcome/route.ts:67`).

**Audit 2026-05-17 #1.1 — toujours OUVERT au 2026-05-25.**

**Impact** : KPI conversion sous-comptabilise les conversions auto (commande sans lead
chat) + dette de lecture chaque audit.

**Effort** : 1 jour (soit câbler webhook order → session, soit supprimer méthode + colonnes).

---

#### I2. Cascade intent niveau 3 (LLM mini) ADR-001 non implémentée

**Localisation** : `apps/web/src/lib/chat/services/orchestrator.ts:80-135`,
`intent-vector.ts`

Cascade actuelle : **2 niveaux** seulement.
- N1 : regex score (`intent.ts:detectIntent`)
- N2 : si `misc`, embedding centroid (`intent-vector.ts:classifyByEmbedding`, seuil 0,55)

ADR-001 promet **N3 LLM mini** sur top-2 vs top-1 < 0,05.

Flag `CHAT_INTENT_USE_LLM_FALLBACK` mentionné dans l'ADR : **absent du code**.

**Impact** : précision intent reste ~73 % (cible 92 %). Recall `purchase-intent ≥95 %` non
démontré ni mesurable.

**Effort** : 1 semaine.

---

#### I3. Seuil FAQ default DB / commentaire code en contradiction

**Localisation** : `db/schema.ts:765`, `orchestrator.ts:182-184`

- Schema : `threshold: numeric('threshold').notNull().default('0.85')`
- Commentaire orchestrator : *"calibré ~0,60 pour text-embedding-3-small"*

`faq.ts:matchByEmbedding` utilise le `threshold` PAR LIGNE. Si un seeder oublie ce champ,
**le default 0,85 s'applique**, alors que les vecteurs OpenAI typiques font 0,55-0,70 sur
paraphrase. **Ces entrées seront toujours sous le seuil** → FAQ silencieusement morte.

**Impact** : 30-45 % économie LLM promise (ADR-003) jamais atteinte si seeders oublient le
threshold.

**Effort** : 1 h (forcer threshold dans tous les seeders + test régression).

---

#### I4. Visitor rate-limit déclaré mais jamais appliqué

**Localisation** : `apps/web/src/lib/chat/services/rate-limit.ts:29-33`,
`apps/web/src/app/api/chat/message/route.ts:83-104`

```typescript
// rate-limit.ts
const LIMITS = { ip: 60, session: 30, visitor: 90 };
```

`/api/chat/message/route.ts` consomme uniquement `'session'` et `'ip'`.
`rateLimit.consume('visitor', visitorId)` n'est jamais appelé.

**Impact** : un attaquant qui tourne sur IP + session-vivante peut épuiser les ressources
d'un visiteur. Et un visiteur honnête peut être bloqué par session sans recourse. La
couche "visitor" est documentation morte.

**Effort** : 30 min.

---

#### I5. `provider-router.ts` — aucun test unitaire

**Localisation** : `apps/web/src/lib/chat/services/provider-router.ts` (152 lignes)

Pas de fichier `.test.ts` à côté. C'est le **seul module critique sans tests**.

La logique (breaker + multi-provider failover + Redis-vs-memory state + quota check) n'est
pas exercée → toute régression silencieuse.

**Impact** : couverture des failure modes (breaker open, quota exceeded, all providers
down, Redis down) inexistante.

**Effort** : 1 jour.

---

#### I6. RAG sans `minScore` — chunks médiocres injectés dans le prompt

**Localisation** : `orchestrator.ts:265-289`, `rag/service.ts:63`

`ragService.retrieve` est appelé avec `topK: 4` sans `minScore`. Si l'index contient des
chunks médiocres (score 0,1), ils sont **injectés dans le prompt LLM** comme s'ils étaient
pertinents.

`RetrieveInput.minScore` existe (`rag/service.ts:63`) mais n'est pas utilisé. Les sources
émises au widget contiennent `score` mais **aucun filtrage**.

**Impact** : prompt pollué → hallucinations + augmentation tokensIn (coût).

**Effort** : 30 min (passer `minScore: 0.3` par défaut).

---

#### I7. Sanitize PII — regex `phone` gourmand cassant les patterns suivants

**Localisation** : `sanitize.ts:18-31`, test `sanitize.test.ts:37-54`

La boucle séquentielle applique les patterns dans l'ordre. Le test confirme :
> *"la regex phone actuelle est très permissive et capture souvent IBAN/CB/CNI avant que
> leur regex spécifique ne s'exécute"*

Conséquence : `iban FR7630006000011234567890189` est masqué `[téléphone]`, donc le label
IBAN est faux dans `redactions: ['phone']`.

**Impact** : KPI qualité PII trompeur, le label "phone" est sur-représenté. Le test
actuel "accepte" le bug avec un commentaire défensif au lieu de le corriger.

**Effort** : 1 jour (réordonner + tester strict).

---

#### I8. `visitor-cookie` peut générer plusieurs IDs en SSR concurrent

**Localisation** : `visitor-cookie.ts:15-39`

Si appelé depuis un Server Component (read-only context), le `cookies().set()` throw
silencieusement (catch vide), et un fresh ID est retourné. Sur la même page
parallel-loadée, chaque call peut produire un nouvel ID si aucune Route Handler ne persiste
auparavant.

**Impact** : KPI sessions et A/B variants assignés dérivent.

**Effort** : 1 jour (forcer le `Set-Cookie` via Route Handler + tests SSR).

---

### MOYEN

#### M1. 14 events sur 27 jamais émis backend

**Localisation** : `db/schema.ts:339-378` (enum), grep des `emit(...)` dans services

Le schéma déclare 27 enum values, mais le backend ne montre que 13 emit sites. Les 14
autres sont soit émis côté front via la pipeline `tracking-attribution` (pas vers
`chat_conversation_event`), soit jamais émis du tout (`message_complete`,
`chat_lead_webhook_sent`, `inline_contact_webhook_sent`).

**Impact** : agrégats KPI admin retournent 0 ou données partielles ; observabilité
incomplète vs promesse.

---

#### M2. P95 latency mesurée mais pas exposée

**Localisation** : `streaming-health.ts:101-165, 182-207`

`p95InterChunkMs` est calculé correctement et push samples dans Redis list. Mais
`getRecentStreamingHealth` retourne seulement `dropRate`, pas le P95. Le code calcule
sample-par-sample mais ne l'agrège jamais sur la fenêtre.

**Impact** : KPI "first chunk p95" n'est ni stocké en agrégé ni lisible côté admin.

---

#### M3. Lead webhook retry — pas de back-off ni schedule retry

**Localisation** : `lead-webhook.ts:40-51`, `lead.ts:186-197`

`lead-webhook.ts` est une façade. `markWebhookFailed` incrémente un compteur sans
déclencher retry. Aucun cron `retryFailedLeadWebhooks` n'apparaît dans le code.

**Impact** : un webhook qui échoue à T0 n'est jamais re-tenté.

---

#### M4. Charter-filter outbound — même problème que C2

**Localisation** : `orchestrator.ts:399-407`

`charterFilter.outbound(aggregated)` détecte mais ne fait que logger. La réponse déjà
streamée passe. Cumul avec C2 (modération).

---

#### M5. `recordFailure` async fire-and-forget peut perdre des fails

**Localisation** : `provider-router.ts:90-97`

`void getRedisBreaker(id).recordFailure().catch(...)`. Si le process Vercel terminate avant
résolution (timeout 30 s, fail à T=29,9 s), le compteur Redis n'est jamais incrémenté.

---

#### M6. Lead-decision "engagement" — `reason` ambigu

**Localisation** : `lead-decision.ts:286-293`

`reason: 'long-no-progress'` mais `trigger: 'engagement'` dans debug. L'analytics ne peut
séparer "long-no-progress vrai" de "engagement" sans regarder `debug.trigger`. Sous-label
dans payload mais pas dans l'enum `LeadFormReason`.

---

### MINEUR

#### Mi1. Tests orchestrator mockent tout

**Localisation** : `orchestrator.test.ts:27-138`

Mocke session, message, event, instruction, provider, lead, runtime, rag, provider-router.
Seul OpenAI HTTP passe par MSW. Les tests valident essentiellement l'ordre des yields mais
pas l'interaction réelle des couches.

#### Mi2. `_unusedTypeKeeper` dead code

**Localisation** : `orchestrator.ts:683`

Function définie pour "garder" un type. À remplacer par un `// eslint-disable-next-line` ou
import-only.

#### Mi3. Comment trompeur sur seuil FAQ

**Localisation** : `orchestrator.ts:182` (lié à I3)

Commentaire dit "calibré ~0,60", schéma default 0,85. Harmoniser.

#### Mi4. `instantiateProvider` exhaustivité non testée

**Localisation** : `factory.ts:23-50`

Le `default: never` est élégant mais aucun test ne vérifie que toutes les
`ChatProviderKind` du contracts sont gérées par switch.

#### Mi5. Convention nommage events incohérente

`chat_message_sent_user` vs `chat_widget_open` vs `lead_form_displayed` — pas de préfixe
unique. Documentation type-events à fournir.

---

## B. Risques cachés non documentés

### R1. User message persisté AVANT modération inbound

**Localisation** : `orchestrator.ts:138-153` (persist) vs `:321` (moderation)

Le message visitor est persisté + event `message_sent_user` émis AVANT la modération
inbound. Si modération flag, le contenu est déjà en DB avec status `sent`. L'admin voit
dans l'historique un message visitor flagged sans indication.

**Impact RGPD** : stockage de signal abusif. **Impact UX admin** : confusion.

---

### R2. FAQ branch court-circuite moderation et lead-decision

**Localisation** : `orchestrator.ts:189-251`

Quand le FAQ matche, on yield la réponse scripted directement, on appelle
`maybeBuildLeadOfferAndCaptureInline` à la fin. MAIS : **aucune modération inbound**
n'est exécutée sur cette branche.

Si un visiteur tape un contenu toxique qui matche une FAQ par hasard (ex. message
contenant à la fois insulte + mot-clé "livraison"), la réponse scripted est servie sans
filtre. Modération contournée.

---

### R3. `MEMORY_WINDOW = 12` sans cap tokens — coût peut exploser

**Localisation** : `orchestrator.ts:60, 165, 290-299`

`MEMORY_WINDOW = 12` (6 user + 6 assistant typiquement). **Pas de cap sur la longueur
cumulée**. Un visiteur écrivant 12 × 2 000 chars = 24 k chars envoyés en prompt à chaque
appel. À 4 chars/token = 6 k tokens IN par tour.

Sur GPT-4o-mini c'est OK mais sur Anthropic Claude 4 (ratio €/token plus élevé), le coût
**explose silencieusement**. Pas de tronquage par tokens.

---

### R4. `intentSource='vector'` est trompeur quand le vecteur n'a pas matché

**Localisation** : `orchestrator.ts:81, 135`

Si regex retourne `misc` et le vecteur retourne `null` (pas de match), `intentSource` reste
à `'vector'` (initialisé ligne 81). L'event `message_sent_user.intentSource='vector'` ne
reflète pas la réalité — c'est "regex puis vector ont tous deux échoué".

**Impact** : KPI "intent par source" biaisé.

---

### R5. Le SSE writer dans `stream.ts` swallow errors silencieusement

**Localisation** : `stream.ts:22-29`

Si `controller.enqueue` throw (client a fermé entre deux chunks), on logge un warn et on
continue à boucler. Le `for await chunk of stream` côté orchestrator continue à pull du
provider → **tokens consommés sans bénéfice**. Pas de propagation `abort` au stream
provider.

**Impact** : coût LLM gaspillé sur abandons utilisateur.

---

## Synthèse audit

| Sévérité | Count |
|----------|-------|
| CRITIQUE | 6 |
| IMPORTANT | 8 |
| MOYEN | 6 |
| MINEUR | 5 |
| Risques cachés | 5 |
| **Total** | **30** |

Dette technique relativement élevée pour un système en production. Le **happy path
fonctionne** mais les **failure modes** sont massivement sous-couverts (modération
outbound, fallback multi-niveau, budget guard, race conditions multi-lambda).

La qualité documentaire (ADRs, plans, runbook) **dépasse largement** la qualité de
l'implémentation : phases marquées ✅ DONE qui contiennent en réalité du dead code ou des
ADRs non implémentés. Cela suggère un **manque de "definition of done" claire**.

Action prioritaire : voir [04-recommandations.md](04-recommandations.md).
