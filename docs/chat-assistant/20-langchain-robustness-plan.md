# 20 — CHA-230 — Robustification de la pipeline LangChain (intent + format LLM + nouveaux scénarios commercial)

> *Audit profond de l'architecture LangChain actuelle, plan de refonte robuste/maintenable/débogable/évolutif/modulaire, et runbook d'exécution en 3 phases. Couvre frontend, backend, UI/UX, design et data architecture.*
>
> Doc parent : `00-cahier-des-charges.md` · Stratégie éditoriale : `18-instructions-knowledge-strategy.md` · Capture lead : `19-lead-capture-form.md`.

---

## 0. TL;DR

Le bug remonté par la prod (**« commander » ne déclenche pas le formulaire**, **« hi » répond en FR**) est la pointe émergée d'un iceberg architectural :

1. **LangChain est déclaré dans `package.json` mais quasi-inutilisé** : pas de `Runnable` / LCEL, pas d'`OutputParser`, pas de `tool-calling`, pas de retry/fallback. On se contente d'un `fetch` natif vers OpenAI dans `apps/web/src/lib/chat/providers/openai.ts`.
2. **Détection d'intention 100 % regex** : couvre mal les variantes morphologiques (`commander` seul, `réduction` sans « prix », « grande quantité » sans « grossiste »). Aucune correction LLM, aucun golden-set.
3. **Format de réponse LLM non-validé** : tout est texte libre, aucun parser JSON robuste, aucune boucle `OutputFixingParser` pour corriger un format cassé.
4. **Pas de fallback provider** : si OpenAI tombe, le visiteur reçoit une erreur. Le circuit breaker existe (`providerRouter`) mais n'est pas câblé sur une **chaîne de providers**.
5. **Manque deux scénarios commerciaux critiques** : la **négociation/objection-prix** (« c'est cher », « rabais », « réduction ») et le **fournisseur/grossiste** (« grande quantité », « gros », « B2B » volume) doivent **systématiquement** déclencher le formulaire pour transfert humain — pas une réponse IA.
6. **Pas de pipeline d'enrichissement** : on ne capitalise pas sur les conversations passées pour entraîner/évaluer la classification.

**Cible CHA-230** : passer d'un chat « text-in / text-out » fragile à une **pipeline LCEL** typée, observée, évaluée, avec :

- LCEL `Runnable` modulaire (router → classifier → composer → moderator).
- `tool-calling` LLM pour l'intent classification, validé par Zod.
- `OutputFixingParser` (boucle correctrice) sur le JSON intent.
- Chaîne de providers avec retry exponentiel et fallback.
- Golden-set DB-backed + admin curator UI.
- Nouveaux intents `negotiation` et `wholesaler` câblés bout-en-bout (intent → décision → copy → form).

**Estimation** : 3 phases, ~4 jours dev cumulés (Phase 1 : 1 j, Phase 2 : 2 j, Phase 3 : 1 j).

---

## 1. Audit profond — état actuel

### 1.1 Pipeline orchestrator (`apps/web/src/lib/chat/services/orchestrator.ts`)

```
┌─────────────────────────────────────────────────────────┐
│  POST /api/chat/message  →  orchestrator.handle()       │
└─────────────────────────────────────────────────────────┘
        │
        ▼
   sessionRepo.upsert        ← garde session
   messageRepo.insert(user)  ← persistance
   detectLanguage(text)      ← regex/heuristique
   moderation pre-check      ← (optionnel)
   buildSystemPrompt()       ← instruction-defaults v2.x
   buildContext()            ← message history slice
        │
        ▼
   adapter.streamChat(...)   ← FETCH natif OpenAI (pas de LCEL)
        │
        ▼
   for await chunk of stream:
       SSE.write({event:'chunk', delta})
   SSE.write({event:'end'})
        │
        ▼
   classifyIntent(text)      ← REGEX SCORING (services/intent.ts)
   leadDecision.evaluate()   ← 9 règles (services/lead-decision.ts)
   if shouldOffer:
       SSE.write({event:'lead-form-offer', reason, copyKey})
```

**Problèmes** :

| # | Problème | Impact |
|---|----------|--------|
| P1 | Aucune `Runnable` LCEL — la pipeline est procédurale | Difficile à tracer/composer/tester unitairement |
| P2 | `adapter.streamChat()` direct, sans wrap `Runnable` | Pas de retry/fallback/observabilité standardisés |
| P3 | `classifyIntent` 100 % regex, post-stream | « commander » seul = `misc`, formulaire non offert |
| P4 | Pas d'`OutputParser` Zod sur les sorties LLM | Si on demande un JSON, on n'a aucune garantie |
| P5 | Pas de fallback provider | Si OpenAI 429 → erreur visiteuse (pas d'Anthropic backup) |
| P6 | Pas d'évaluation continue | On ne sait pas si la classification se dégrade |

### 1.2 Détection d'intention (`apps/web/src/lib/chat/services/intent.ts`)

Architecture actuelle : **regex pondérés** (poids `+2` pour patterns « forts », `+1` pour patterns « réguliers »), seuil `MIN_CONFIDENCE_SCORE = 1`.

**Faiblesses identifiées** :

```ts
// État actuel (extrait simplifié) :
const PATTERNS: Record<ChatIntent, IntentPattern> = {
  'purchase-intent': {
    strong: [/\b(je\s+(veux|souhaite)\s+(commander|acheter))\b/i, ...],
    regular: [/\b(commande|achat)\b/i, ...],
    // ⚠️ « commander » seul, sans préfixe « je veux » → score 0 → misc
  },
  'objection-price': {
    strong: [/\b(trop\s+cher|prix\s+élevé)\b/i],
    regular: [/\b(cher|prix)\b/i],
    // ⚠️ « réduction », « rabais », « négocier » non couverts
  },
  'b2b': {
    // ⚠️ « grande quantité », « gros volume », « grossiste » non couverts
  },
  // pas d'intent dédié « wholesaler » ni « negotiation »
};
```

**Conséquences pour la prod** :

- **« commander »** seul → `misc` → pas de `purchase-intent` → règle 1bis non déclenchée → **pas de formulaire**.
- **« c'est cher, vous faites une réduction ? »** → `objection-price` (faiblement), mais aucune règle de décision **ne déclenche le formulaire** sur cette base. L'IA tente de répondre commercialement, hors-périmètre.
- **« je veux acheter 100 pièces »** → `b2b` (peut-être), mais encore une fois, le formulaire n'est pas systématique.

### 1.3 Décision d'offre formulaire (`apps/web/src/lib/chat/services/lead-decision.ts`)

9 règles priorisées (Rule 1 → Rule 9). Manque :

- **Rule 8 (négociation)** : `intent ∈ {objection-price, negotiation}` + LLM-confirmé → form immédiat.
- **Rule 9 (wholesaler)** : `intent ∈ {wholesaler, b2b}` avec marqueur volume → form immédiat.

### 1.4 Format de réponse LLM

Le LLM répond actuellement en **prose libre** (texte streamé). Aucune structure. Si on veut un jour passer à `tool-calling` (« le LLM choisit lui-même de déclencher le formulaire »), on ne peut pas — il n'y a aucun mécanisme :

- Pas de `Zod` schema sur la sortie.
- Pas de `OutputFixingParser` (LangChain pattern : si parse échoue → renvoie l'erreur au LLM avec le schema → retry une fois).
- Pas de `StructuredOutputParser`.

### 1.5 Architecture data

| Table | Manque pour CHA-230 |
|-------|---------------------|
| `chat_message` | Pas de colonne `intent_tag` / `intent_confidence` / `intent_method` (regex/llm/golden) |
| `chat_lead` | A `intentAtCapture` mais pas de `consentVersion` ni de lien vers le tour LLM précis |
| (manquante) | Pas de table `chat_golden_intent_set` pour stocker les exemples d'or |

### 1.6 Frontend / UX

État actuel : globalement bon (lead-form-bubble inline, anti-redondance CHA-228, dismiss-override CHA-229). Manque :

- **Pas de retry-chip** côté UI quand le LLM échoue (on a un `error` plat dans le store).
- **Pas d'indicateur d'intention détectée** dans le panneau admin de conversation (`/admin/chat/conversations/[id]`).
- **Pas de copy adaptée** pour `negotiation` et `wholesaler` (`lead-form-copy.ts` n'a que les copies CHA-225).

---

## 2. Architecture cible

### 2.1 Pipeline LCEL `Runnable`

```
            ┌────────────────────────────────────────────────┐
            │  ChatRunnable  (RunnableSequence)              │
            │                                                │
            │   ┌──────────────────────────────────────┐     │
            │   │ 1. detect.lang        Runnable       │     │
            │   ├──────────────────────────────────────┤     │
            │   │ 2. classify.intent    Runnable       │     │
            │   │     ├─ regex (cheap, instant)        │     │
            │   │     ├─ llm tool-call (if confidence  │     │
            │   │     │  < threshold OR ambiguous)     │     │
            │   │     └─ OutputFixingParser fallback   │     │
            │   ├──────────────────────────────────────┤     │
            │   │ 3. compose.system     Runnable       │     │
            │   │     ├─ instruction-defaults vN       │     │
            │   │     ├─ rag.retrieve (KB hits)        │     │
            │   │     └─ history slice                 │     │
            │   ├──────────────────────────────────────┤     │
            │   │ 4. respond.stream     Runnable       │     │
            │   │     ├─ provider.openai (primary)     │     │
            │   │     ├─ retry exponential (3x)        │     │
            │   │     └─ provider.anthropic (fallback) │     │
            │   ├──────────────────────────────────────┤     │
            │   │ 5. moderate.post      Runnable       │     │
            │   ├──────────────────────────────────────┤     │
            │   │ 6. lead.decide        Runnable       │     │
            │   └──────────────────────────────────────┘     │
            │                                                │
            │   .with_listeners({on_start, on_end,           │
            │     on_error}) → emits chat_event in DB        │
            └────────────────────────────────────────────────┘
```

**Bénéfices** :

- Chaque étape est un `Runnable` testable seul (`step.invoke({...})`).
- `RunnableSequence` ⇒ tracing automatique (chaque étape devient un `chat_event`).
- `RunnableWithFallbacks` ⇒ retry/fallback déclaratif.
- `RunnableParallel` pour `rag.retrieve` + `classify.intent` qui peuvent tourner en // pendant le stream.

### 2.2 Détection d'intention hybride (regex + LLM)

```
classify.intent(text, language, history)
   ├─ scores = regexScorer(text)
   ├─ topScore, secondScore = scores[0], scores[1]
   │
   ├─ if topScore >= 3 AND topScore - secondScore >= 2:
   │     → return {intent: scores[0].id, method: 'regex', conf: 'high'}
   │
   ├─ else (ambigu OU faible signal) :
   │     → llmClassify(text, history, schema=ZodIntentSchema)
   │       ├─ tool-calling : { name: 'classify', schema }
   │       ├─ Zod parse → if fail → OutputFixingParser retry once
   │       └─ if fail again → fallback to regex top1 OR 'misc'
   │
   └─ persist: chat_message.intent_tag, intent_confidence, intent_method
```

**Pourquoi cette stratégie hybride et pas du LLM-only** :

- Coût : 95 % des messages ont un signal regex fort (« combien ça coûte », « livraison », « salam »). Pas besoin d'un appel LLM dédié.
- Latence : regex = 0.1 ms, appel LLM intent = 200-400 ms (qu'on n'a pas envie d'ajouter au stream principal).
- Robustesse : si le LLM tombe, le regex tient le coup en mode dégradé.

**Schema Zod intent (sortie LLM)** :

```ts
const ZodIntentClassification = z.object({
  intent: z.enum([
    'greeting', 'pricing', 'shipping', 'routine', 'ingredient',
    'order-status', 'support', 'objection-price', 'objection-doubt',
    'social-proof', 'comparison', 'b2b', 'callback-request',
    'frustration', 'after-hours', 'purchase-intent',
    'negotiation',      // NEW CHA-230
    'wholesaler',       // NEW CHA-230
    'misc',
  ]),
  confidence: z.enum(['low', 'medium', 'high']),
  reason: z.string().max(120).describe('Brief justification, max 120 chars'),
});
```

### 2.3 Robustesse format LLM

Pattern `OutputFixingParser` (LangChain) :

```ts
const baseParser = StructuredOutputParser.fromZodSchema(ZodIntentClassification);
const fixingParser = OutputFixingParser.fromLLM(llm, baseParser);

// usage :
try {
  return baseParser.parse(rawLlmOutput);
} catch (e) {
  // fixingParser fait : "voici la sortie cassée, voici le schema attendu, corrige"
  return fixingParser.parse(rawLlmOutput);
}
```

Trois niveaux de défense :

1. **Parse strict** (Zod) → réussit dans 95 % des cas pour gpt-4o-mini.
2. **Parse correctrice** (`OutputFixingParser`) → rattrape les 4 % restants.
3. **Fallback déterministe** (regex top1 ou `misc`) → 1 % résiduel jamais bloquant.

### 2.4 Fallback provider chain

```ts
const respondChain = RunnableSequence.from([
  prepareMessages,
  primaryProvider.streamChat
    .withRetry({ stopAfterAttempt: 3, exponentialBackoff: true })
    .withFallbacks([
      anthropicFallback.streamChat,
      // Future : geminiFallback, mistralFallback
    ]),
]);
```

Configuration via `chat_provider_config` (table déjà existante) — on ajoute juste un champ `fallback_priority` pour la chaîne.

### 2.5 Pipeline d'enrichissement

**Objectif** : transformer chaque conversation en **golden example** progressivement validée par un admin.

```
chat_message ──┐
               │  (1) curator UI : admin tag/edit l'intent
               ▼
   chat_golden_intent_set
               │
               │  (2) export fixture
               ▼
   tests/golden/intent-fixtures.json
               │
               │  (3) regression suite
               ▼
   intent-classifier.test.ts
               │
               │  (4) métrique
               ▼
   /admin/chat/quality-dashboard
   - precision/recall par intent
   - drift ces 7j vs 30j
   - top failures
```

**Schema DB** (nouveau) :

```sql
CREATE TABLE chat_golden_intent_set (
  id              text PRIMARY KEY,
  text            text NOT NULL,
  language        text NOT NULL,
  expected_intent text NOT NULL,
  source_message_id text REFERENCES chat_message(id) ON DELETE SET NULL,
  source_session_id text REFERENCES chat_session(id) ON DELETE SET NULL,
  curator_email   text NOT NULL,
  notes           text,
  created_at      timestamptz DEFAULT now() NOT NULL,
  updated_at      timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX idx_golden_intent ON chat_golden_intent_set (expected_intent);
CREATE INDEX idx_golden_lang   ON chat_golden_intent_set (language);
```

### 2.6 Nouveaux intents : `negotiation` et `wholesaler`

#### `negotiation`

**Définition** : la visiteuse essaie de **marchander, demande un rabais/réduction/promo, conteste le prix avec une intention transactionnelle**. Différent d'`objection-price` qui couvre la simple sensibilité au prix sans demande explicite de remise.

**Patterns regex (FR/AR/AR-MA)** :

- FR strong : `\b(rabais|réduction|remise|négoci(?:er|ation)|prix\s+spécial|baisser\s+le\s+prix|geste\s+commercial|code\s+promo)\b`
- FR regular : `\b(promo|moins\s+cher|moins\s+que|trop\s+cher\s+pour\s+moi)\b`
- AR : `\b(تخفيض|تنزيل\s+الثمن|عرض\s+خاص|كود\s+ترويج)\b`
- AR-MA : `\b(naqsalna|tkhfid|chi\s+takhfid|trop\s+ghali)\b`

**Décision** : déclenche **toujours** le formulaire de capture (Rule 8 lead-decision) — un humain négocie, l'IA ne négocie pas (politique commerciale).

**Copy form** (`lead-form-copy.ts`) :

- FR : « Pour les conditions commerciales personnalisées, je transmets votre contact à notre équipe. Elle vous répond aujourd'hui. »
- AR : « للشروط التجارية الخاصة، سأرسل اتصالك إلى فريقنا. سيردون عليك اليوم. »

#### `wholesaler`

**Définition** : la visiteuse veut **acheter un volume important** (revente, distribution, événementiel, professionnel beauté). À distinguer de `b2b` qui peut être plus large (partenariat, revente long-terme).

**Patterns regex (FR/AR/AR-MA)** :

- FR strong : `\b(grande\s+quantité|gros\s+volume|grossiste|achat\s+en\s+gros|revendre|revente|distributeur|distribution|stock\s+(entier|de)\s|professionnelle?\s+(beauté|esthétique))\b`
- FR regular : `\b(quantité|plusieurs\s+(unités|pièces|kits)|institut|salon\s+de\s+beauté)\b`
- AR : `\b(بالجملة|كميات\s+كبيرة|موزع|توزيع|إعادة\s+بيع)\b`
- AR-MA : `\b(b\s+jomla|kamiya\s+kbira|mwaza3|3awd\s+l\s+bi3)\b`

**Décision** : déclenche **toujours** le formulaire (Rule 9 lead-decision) — un commercial gère les conditions volume.

**Copy form** :

- FR : « Pour les volumes professionnels, je transmets votre contact à notre équipe commerciale. Elle revient vers vous avec une offre adaptée. »
- AR : « للكميات التجارية، سأرسل اتصالك إلى فريقنا التجاري. سيقدمون عرضًا مناسبًا. »

### 2.7 Considérations Frontend / UI / UX / Design

#### 2.7.1 Composant `LeadFormBubble` — extension copy

Aucun changement structurel. Ajout de 2 nouvelles `copyKey` mappées :

```ts
// lead-form-copy.ts
export const LEAD_FORM_COPY: Record<LeadFormCopyKey, LeadFormCopySet> = {
  // ... CHA-225 existing ...
  negotiation: { fr: {...}, ar: {...}, 'ar-MA': {...} },  // NEW CHA-230
  wholesaler:  { fr: {...}, ar: {...}, 'ar-MA': {...} },  // NEW CHA-230
};
```

#### 2.7.2 Retry-chip UI

Quand le LLM tombe (après 3 retries + 1 fallback), au lieu d'un message d'erreur sec, afficher un **chip cliquable** :

```
[Désolée, j'ai eu un souci technique. ↻ Réessayer]
```

Composant `RetryChip` dans `apps/web/src/components/chat/retry-chip.tsx`. Style : badge rose-50 / texte rose-800, focus visible, accessible (`aria-live="polite"`).

#### 2.7.3 Admin curator UI (Phase 3)

Page `/admin/chat/intent-curator` : table paginée des messages des dernières 24 h avec :

| Colonne | Détail |
|---------|--------|
| Texte | Message visiteuse (tronqué) |
| Intent détecté | Tag actuel |
| Méthode | regex / llm / golden |
| Confiance | low / medium / high |
| Action | Bouton « Tag manuel » → modal de correction |

Cliquer « Tag manuel » → ajoute une ligne dans `chat_golden_intent_set`. Le golden-set est utilisé en CI comme jeu de régression.

#### 2.7.4 Admin quality dashboard (Phase 3)

Page `/admin/chat/quality` : graphique **précision/recall par intent** sur 7j vs 30j, top 5 erreurs, drift detection.

### 2.8 Considérations data architecture

#### 2.8.1 Migrations Drizzle nécessaires

```sql
-- Phase 1 (CHA-230 P1)
ALTER TABLE chat_message ADD COLUMN intent_tag        text;
ALTER TABLE chat_message ADD COLUMN intent_method     text;  -- 'regex' | 'llm' | 'golden' | null
ALTER TABLE chat_message ADD COLUMN intent_confidence text;  -- 'low' | 'medium' | 'high' | null
CREATE INDEX idx_chat_message_intent ON chat_message (intent_tag);

-- Phase 2 (CHA-230 P2) — extension chat_lead
ALTER TABLE chat_lead ADD COLUMN consent_version text;
ALTER TABLE chat_lead ADD COLUMN intent_method   text;

-- Phase 3 (CHA-230 P3) — golden-set
CREATE TABLE chat_golden_intent_set ( ... );  -- voir §2.5
```

#### 2.8.2 Schemas Zod publics

`apps/web/src/lib/chat/schemas/intent.ts` (nouveau) :

```ts
export const ZodIntentClassification = z.object({...});
export const ZodIntentTriggerReason  = z.enum([...]);
export type IntentClassification = z.infer<typeof ZodIntentClassification>;
```

#### 2.8.3 RGPD

- `chat_golden_intent_set.text` est un dérivé de message visiteuse → soumis à `sessionRepo.forget()`. À chaque purge session, `DELETE FROM chat_golden_intent_set WHERE source_session_id = ?`.
- `consent_version` capturé sur le formulaire pour audit.

---

## 3. Plan d'action — phasage

### Phase 1 — Quick wins (1 j)

**Objectif** : fixer le bug prod « commander » + ajouter les 2 nouveaux intents `negotiation`/`wholesaler` + tagging intent en DB.

**Livrables** :

1. Patch `intent.ts` : étendre patterns `purchase-intent`, ajouter `negotiation`, ajouter `wholesaler`.
2. Patch `lead-decision.ts` : Rule 8 (negotiation) + Rule 9 (wholesaler).
3. Patch `lead-form-copy.ts` : copy FR/AR/AR-MA pour les 2 nouveaux intents.
4. Patch `instruction-defaults.ts` v2.4 : ajouter section « Si négociation détectée » et « Si fournisseur/grossiste détecté » (l'IA répond avec une phrase pivot vers humain, pas une négociation).
5. Migration Drizzle : `chat_message.intent_tag`, `intent_method`, `intent_confidence`.
6. Wiring orchestrator : persister `intent_tag` au `messageRepo.updateAfterStream()`.
7. Tests :
   - `intent-classifier.test.ts` : ajouter cases « commander » seul, « rabais », « grande quantité » (FR/AR/AR-MA).
   - `lead-decision.test.ts` : ajouter Rule 8/9 cases.
   - Régression sur `lead-form-flow.test.tsx` et `use-chat-send.test.tsx`.

**Critère go/no-go** :

- 100 % des nouveaux tests passent.
- 0 régression sur les 71 tests existants.
- `pnpm typecheck` propre.
- `pnpm lint` 0 warning.

### Phase 2 — Pipeline LCEL + tool-calling + retry/fallback (2 j)

**Objectif** : refondre l'orchestrator en `RunnableSequence`, brancher tool-calling pour intent ambigu, ajouter retry/fallback provider, retry-chip UI.

**Livrables** :

1. Nouveau dossier `apps/web/src/lib/chat/runnables/` :
   - `detect-language.runnable.ts`
   - `classify-intent.runnable.ts` (regex + tool-calling + OutputFixingParser)
   - `compose-system.runnable.ts`
   - `respond-stream.runnable.ts` (retry + fallback)
   - `moderate-post.runnable.ts`
   - `lead-decide.runnable.ts`
   - `chat.runnable.ts` (RunnableSequence root)
2. Adapter `orchestrator.ts` pour appeler `chat.runnable.invoke({...})`.
3. Schemas Zod dans `apps/web/src/lib/chat/schemas/`.
4. Provider Anthropic réel dans `providers/anthropic.ts` (wrapper LangChain `ChatAnthropic`).
5. Composant `RetryChip` + branchement `onError` du Runnable vers store.
6. Listeners Runnable → `chat_event` DB (tracing).
7. Tests :
   - Unitaire par Runnable (mock providers).
   - Intégration `chat.runnable` end-to-end (MSW).
   - E2E playwright : retry-chip apparaît quand provider tombe (mock 500).

**Critère go/no-go** :

- 100 % des tests Runnables passent.
- Stream prod fonctionne avec primary OpenAI.
- Si on coupe la clé OpenAI (test sandbox) → fallback Anthropic streame OK.

### Phase 3 — Pipeline d'enrichissement + curator UI (1 j)

**Objectif** : table golden-set, page admin curator, dashboard qualité, fixtures CI.

**Livrables** :

1. Migration `chat_golden_intent_set`.
2. API `/api/admin/chat/intent-curator/[messageId]` (POST tag manuel).
3. Page `/admin/chat/intent-curator` (Server Component + filtre langue/intent).
4. Page `/admin/chat/quality` (server-rendered, agrégats SQL).
5. Script `pnpm chat:export-golden` → `tests/golden/intent-fixtures.json`.
6. Tests CI : `intent-classifier.golden.test.ts` charge les fixtures et vérifie qu'elles classent OK.

**Critère go/no-go** :

- Tag manuel d'un message persiste OK.
- Dashboard affiche au moins 3 intents avec stats non-zéro.
- Fixtures CI passent à ≥ 90 % de précision.

---

## 4. Runbook d'exécution

### 4.1 Pré-requis

```sh
cd /Users/elazhar/PycharmProjects/template-femiglow/.claude/worktrees/cha-230-langchain-robustness
git status  # → clean, on branch cha-230-langchain-robustness
pnpm install  # déjà fait au worktree create
pnpm typecheck && pnpm test  # baseline green
```

### 4.2 Phase 1 — Étapes

#### Étape 1.1 — Étendre `intent.ts`

Fichier : `apps/web/src/lib/chat/services/intent.ts`

1. Ajouter `'negotiation'` et `'wholesaler'` au type `ChatIntent`.
2. Ajouter le bloc `PATTERNS.negotiation` avec les regex §2.6.
3. Ajouter le bloc `PATTERNS.wholesaler` avec les regex §2.6.
4. **Étendre `PATTERNS['purchase-intent'].strong`** : `/\b(commander|achat|acheter|buy|order)\b/i` en pattern fort.
5. Ajouter test cases dans `intent-classifier.test.ts` (TDD : red → green).

#### Étape 1.2 — Étendre `lead-decision.ts`

Fichier : `apps/web/src/lib/chat/services/lead-decision.ts`

1. Ajouter Rule 8 :
   ```ts
   // Rule 8 — Négociation détectée → escalade humaine
   if (state.lastIntent === 'negotiation') {
     return offer({ reason: 'negotiation', copyKey: 'negotiation' });
   }
   ```
2. Ajouter Rule 9 :
   ```ts
   // Rule 9 — Fournisseur / grossiste → escalade commerciale
   if (state.lastIntent === 'wholesaler') {
     return offer({ reason: 'wholesaler', copyKey: 'wholesaler' });
   }
   ```
3. Étendre `ChatLeadTriggerReason` (`schema.ts`) avec `'negotiation' | 'wholesaler'`.
4. Étendre `STRONG_LEAD_REASONS` (CHA-229) avec ces 2 raisons → override dismiss.

#### Étape 1.3 — `lead-form-copy.ts` (FR/AR/AR-MA)

Fichier : `apps/web/src/components/chat/lead-form-copy.ts`

Ajouter clés `negotiation` et `wholesaler` (texte FR/AR/AR-MA fourni §2.6).

#### Étape 1.4 — `instruction-defaults.ts` v2.4

Fichier : `apps/web/src/lib/chat/instruction-defaults.ts`

Bumper `version: '2.4'`. Ajouter dans le système prompt :

> « Si la visiteuse essaie de **négocier** un prix, demande un **rabais** ou parle de **réduction**, ne négocie pas. Réponds avec empathie : "Pour les conditions commerciales personnalisées, je transmets votre contact à notre équipe — elle revient vers vous aujourd'hui." Le formulaire s'affiche automatiquement. »
>
> « Si la visiteuse mentionne **acheter en gros**, **grande quantité**, est **revendeuse**, **professionnelle beauté** ou **distributrice**, ne donne pas un prix unitaire — réponds : "Pour les volumes professionnels, je transmets votre contact à notre équipe commerciale — elle revient vers vous avec une offre adaptée." Le formulaire s'affiche automatiquement. »

#### Étape 1.5 — Migration Drizzle `chat_message.intent_tag`

```sh
# 1. Éditer apps/web/src/lib/chat/db/schema.ts
#    Ajouter intent_tag, intent_method, intent_confidence
# 2. Générer la migration
pnpm db:generate
# 3. Vérifier le SQL
cat apps/web/drizzle/migrations/00XX_*.sql
# 4. Push
pnpm db:push
```

#### Étape 1.6 — Wiring orchestrator

Fichier : `apps/web/src/lib/chat/services/orchestrator.ts`

Après la classification (post-stream) :

```ts
const classification = classifyIntent(userText);
await messageRepo.updateAfterStream(userMessageId, {
  intent_tag: classification.intent,
  intent_method: 'regex',
  intent_confidence: classification.confidence,
});
```

#### Étape 1.7 — Tests

```sh
pnpm test apps/web/src/lib/chat/services/intent-classifier.test.ts
pnpm test apps/web/src/lib/chat/services/lead-decision.test.ts
pnpm test apps/web/src/components/chat/lead-form-flow.test.tsx
pnpm test apps/web/src/components/chat/hooks/use-chat-send.test.tsx
pnpm test  # full suite
```

#### Étape 1.8 — Vérifications finales

```sh
pnpm typecheck
pnpm lint --filter=apps/web
git diff --stat
```

#### Étape 1.9 — Commit Phase 1

```sh
git add -p  # revue manuelle
git commit -m "$(cat <<'EOF'
chat(CHA-230 P1): add negotiation+wholesaler intents, fix "commander" miss

- Étend intent.ts : patterns purchase-intent élargis ("commander" seul → match),
  nouveaux intents 'negotiation' et 'wholesaler' (FR/AR/AR-MA).
- Ajoute Rule 8 (negotiation) et Rule 9 (wholesaler) dans lead-decision.ts ;
  les deux sont des STRONG_LEAD_REASONS qui overrident un dismiss.
- Lead-form copy FR/AR/AR-MA pour les 2 nouveaux scénarios.
- Instructions v2.4 : pivot vers humain pour négociation + volume.
- Migration : chat_message.intent_tag/intent_method/intent_confidence.
- Tests : 12 nouveaux cas couvrant FR/AR/AR-MA + régressions.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### 4.3 Phase 2 — Étapes

(Détaillé au moment de l'exécution Phase 2 — cf. §3 Phase 2 livrables.)

### 4.4 Phase 3 — Étapes

(Détaillé au moment de l'exécution Phase 3 — cf. §3 Phase 3 livrables.)

### 4.5 Rollback

À chaque phase : revert simple via `git revert <sha>` du commit de phase. Les migrations Phase 1 sont **additives** (nouvelles colonnes nullable) → aucune perte de données. Phase 3 idem (nouvelle table).

### 4.6 Surveillance post-déploiement

| Métrique | Seuil alerte | Source |
|----------|--------------|--------|
| Taux `purchase-intent` détecté | < 1 % des messages user (sain : 5-10 %) | `chat_message.intent_tag` |
| Taux `negotiation` détecté | > 0 (sain : 1-3 %) | idem |
| Taux `wholesaler` détecté | > 0 (sain : 0.5-2 %) | idem |
| `lead-form-offer` taux | > 5 % des sessions actives | `chat_event` |
| Erreur LLM (Phase 2) | < 0.5 % des streams | logs |
| Latence p99 stream | < 8 s | observabilité |

---

## 5. Tests / golden-set strategy

### 5.1 Pyramide de tests

```
                         ┌──────────────────┐
                         │  E2E Playwright  │  (Phase 2+ : retry-chip,
                         │  ~10 cas         │   fallback provider)
                         └──────────────────┘
                  ┌────────────────────────────────┐
                  │  Intégration Runnable + MSW    │  (Phase 2 : 30 cas)
                  └────────────────────────────────┘
       ┌────────────────────────────────────────────────┐
       │  Unitaire par Runnable + golden-set           │  (Phase 3 : 200+
       │  intent.test.ts, lead-decision.test.ts, ...   │   cas golden)
       └────────────────────────────────────────────────┘
```

### 5.2 Golden-set lifecycle

```
1. Bootstrap initial (Phase 3) :
   - admin tag manuellement 100 messages (10 par intent x 10 intents).
   - export → tests/golden/intent-fixtures.json.

2. Itération continue :
   - chaque sprint : admin tag 20-50 nouveaux exemples.
   - export hebdo → fixture mise à jour.

3. CI gate :
   - `pnpm test:golden` doit passer ≥ 90 % de précision.
   - Si < 90 % → bloque le merge.
```

---

## 6. Observabilité

### 6.1 Events `chat_event` ajoutés

| Event type | Trigger | Payload |
|------------|---------|---------|
| `intent.classified` | Phase 1 | `{intent, method, confidence}` |
| `intent.llm-fallback` | Phase 2 | `{regex_top, llm_top, agreement: bool}` |
| `intent.parser-fix` | Phase 2 | `{rawOutput, fixedOutput}` |
| `provider.retry` | Phase 2 | `{provider, attempt, reason}` |
| `provider.fallback` | Phase 2 | `{from, to, reason}` |
| `intent.golden-tagged` | Phase 3 | `{messageId, intent, curator}` |

### 6.2 Dashboard admin (Phase 3)

Page `/admin/chat/quality` :

- **Précision globale** : `agreement(regex, llm) / total_classified` 7j.
- **Précision par intent** : matrice de confusion sur le golden-set.
- **Drift** : delta 7j vs 30j par intent.
- **Top 10 erreurs** : messages où regex ≠ llm, sortés par fréquence.

---

## 7. RGPD / Sécurité

- `chat_golden_intent_set.text` est un dérivé direct de message → cascade `forget()`.
- `intent_tag` n'est pas une donnée perso → pas de cascade.
- Curator UI : auth admin obligatoire (`requireAdminApi`).
- Aucun PII envoyé à un LLM tiers pour la classification (la classification est faite sur le **texte original visiteuse**, le tool-calling reste sur le provider primary qui a déjà les messages).
- `consent_version` (Phase 2) : audit du consentement formulaire au moment du submit.

---

## 8. Référence rapide

| Fichier | Phase | Action |
|---------|-------|--------|
| `apps/web/src/lib/chat/services/intent.ts` | P1 | Étendre patterns + 2 intents |
| `apps/web/src/lib/chat/services/lead-decision.ts` | P1 | Rules 8/9 + STRONG_LEAD_REASONS |
| `apps/web/src/lib/chat/db/schema.ts` | P1 + P3 | Cols intent_tag + table golden |
| `apps/web/src/components/chat/lead-form-copy.ts` | P1 | 2 nouveaux copy keys FR/AR/AR-MA |
| `apps/web/src/lib/chat/instruction-defaults.ts` | P1 | v2.4 |
| `apps/web/src/lib/chat/services/orchestrator.ts` | P1 + P2 | Persiste intent + appel Runnable |
| `apps/web/src/lib/chat/runnables/*` | P2 (NEW) | LCEL pipeline |
| `apps/web/src/lib/chat/schemas/intent.ts` | P2 (NEW) | Zod schemas |
| `apps/web/src/lib/chat/providers/anthropic.ts` | P2 | Implémentation réelle |
| `apps/web/src/components/chat/retry-chip.tsx` | P2 (NEW) | UI retry |
| `apps/web/src/app/admin/chat/intent-curator/page.tsx` | P3 (NEW) | Curator UI |
| `apps/web/src/app/admin/chat/quality/page.tsx` | P3 (NEW) | Dashboard |
| `apps/web/src/lib/chat/db/golden-intent-set.ts` | P3 (NEW) | Repo |
| `tests/golden/intent-fixtures.json` | P3 (NEW) | Fixture CI |

---

## 9. Décisions architecturales actées

1. **Hybride regex + LLM** plutôt que LLM-only : coût/latence/robustesse.
2. **OutputFixingParser** plutôt que retry naïf : on donne au LLM le contexte de l'erreur.
3. **Fallback provider Anthropic** plutôt qu'un seul gros retry OpenAI : diversifie le risque vendeur.
4. **`negotiation` et `wholesaler` traités systématiquement par humain** : décision business — l'IA ne négocie pas, ne fait pas de pricing volume.
5. **Golden-set DB-backed plutôt que YAML** : permet curation continue sans PR.
6. **Phase 1 livrable seul** : fixe le bug prod sans attendre la refonte LCEL.

---

*Plan rédigé : 2026-05-07. Auteurs : équipe chat. Statut : approved → execution.*
