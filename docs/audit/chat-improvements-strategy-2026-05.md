# Plan d'amélioration du chat FemiGlow — Analyse stratégique

> **Date** : 2026‑05‑13
> **Auteur** : Tech‑lead audit (Claude Opus 4.7)
> **Statut** : Document de cadrage **READ‑ONLY** — aucune modification de code.
> **Scope** : 3 axes prioritaires demandés par le PO (détection intention, récupération informations métier, suggestions d'accueil).
> **Format** : Pour chaque axe → état des lieux concis ▸ 3 approches conceptuelles ▸ matrice comparative ▸ recommandation finale ▸ esquisse UI/UX (wireframes ASCII).
> **Convention** : Citations `path/file.ts:line` partout où l'évidence du code est convoquée. Pas de code écrit, des schémas et tableaux.

---

## Table des matières

- [§ 0 — Préambule & cadre de lecture](#0-préambule)
- [§ 1 — Axe « Détection des intentions »](#1-axe--détection-des-intentions-)
- [§ 2 — Axe « Récupération des informations métier »](#2-axe--récupération-des-informations-métier-)
- [§ 3 — Axe « Suggestions de messages & engagement »](#3-axe--suggestions-de-messages--engagement-)
- [§ 4 — Synthèse globale, architecture cible, roadmap](#4-synthèse-globale)
- [§ A — Annexes](#a-annexes)

---

<a id="0-préambule"></a>
## § 0 — Préambule & cadre de lecture

### 0.1 Pourquoi ces 3 axes en même temps

Les trois sujets sont **structurellement couplés** côté pipeline conversationnel :

```
                ┌──────────────────────────────────────────────────┐
                │  message user → [INTENT] → [CONTEXT] → [REPLY]  │
                └──────────────────────────────────────────────────┘
                          ↑              ↑              ↑
                       Axe 1          Axe 2          Axe 3
                  (détection)     (knowledge)    (suggestions
                                                  & canned)
```

- **L'intent** conditionne ce que l'on va chercher comme contexte (un `pricing` n'a pas besoin d'un RAG « ingrédients ») et **conditionne** aussi les suggestions de relance.
- **La récupération d'information** alimente la réponse, et son **format** (structurée vs RAG markdown) dicte la qualité d'engagement.
- **Les suggestions** doivent être cohérentes avec l'intent détecté tour précédent, et doivent pouvoir « précâbler » des réponses sans casser la continuité conversationnelle quand l'utilisateur reprend en libre.

> ⇒ Améliorer les trois en silos = effet sub‑additif. Le document propose donc en § 4 une **roadmap phasée** qui rend les efforts cumulatifs.

### 0.2 Contraintes héritées du projet

| Contrainte | Source | Impact |
|---|---|---|
| Budget LLM mensuel `CHAT_TOTAL_BUDGET_EUR_MONTHLY` | [`env.ts:32`](apps/web/src/lib/env.ts:32) | Chaque option doit chiffrer son surcoût marginal par message. |
| Multilingue natif FR / AR / AR‑MA (darija) | [`instruction-defaults.ts`](apps/web/src/lib/chat/instruction-defaults.ts), [`lead-form-copy.ts`](apps/web/src/components/chat/lead-form-copy.ts) | Toute nouvelle table de copy doit être trilingue dès le jour 1. |
| Persistance Drizzle dual‑driver (memoryStore + Postgres) | [`client.ts:155`](apps/web/src/lib/db/client.ts:155) | Toute nouvelle table doit avoir son équivalent Map en mémoire pour les tests Vitest. |
| Streaming SSE avec effet typewriter | [`humanize.ts`](apps/web/src/lib/chat/services/humanize.ts) | Les réponses « pré‑câblées » doivent **simuler** le streaming pour ne pas casser l'UX. |
| Charter filter inbound + outbound | [`charter.ts`](apps/web/src/lib/chat/services/charter.ts) | Les canned responses passent **aussi** par le filter pour cohérence sécurité. |
| Lead‑decision engine déclenche formulaire | [`lead-decision.ts`](apps/web/src/lib/chat/services/lead-decision.ts) | L'amélioration intent doit nourrir le lead‑decision sans casser les 10 règles existantes. |

### 0.3 Lecture du document

Chaque axe suit le même squelette :

```
État des lieux  ─►  3 approches A/B/C  ─►  Matrice comparative  ─►  Recommandation finale  ─►  Wireframes
   (constat)        (concept + forces/      (forces, faiblesses,     (justification +          (admin & user-
                     faiblesses)             coût, pertinence)        scope phasé)              facing UI)
```

Les notations dans les matrices :

- **Effort eng.** : `S` (≤2 j), `M` (3‑5 j), `L` (1‑2 sem.), `XL` (≥3 sem.)
- **Coût marginal LLM** : `€` (≤+1 %), `€€` (+1‑5 %), `€€€` (+5‑15 %), `€€€€` (>15 %)
- **Pertinence FemiGlow** : `★☆☆☆☆` → `★★★★★`

---

<a id="1-axe--détection-des-intentions-"></a>
## § 1 — Axe « Détection des intentions »

### 1.1 État des lieux

| Aspect | Constat | Référence |
|---|---|---|
| **Mécanisme** | Heuristique régex à scoring pondéré (v2, CHA‑225). Patterns forts +2 pt, standards +1 pt, négateurs annulent. Seuil minimal `MIN_CONFIDENCE_SCORE = 1`. | [`intent.ts:1‑347`](apps/web/src/lib/chat/services/intent.ts) |
| **Cardinalité** | **16 intents** : `pricing`, `objection-price`, `objection-doubt`, `purchase-intent`, `order-status`, `greeting`, `b2b`, `callback-request`, `social-proof`, `comparison`, `routine`, `ingredient`, `shipping`, `support`, `misc`, `frustration`, `after-hours`. | [`intent.ts:26‑46`](apps/web/src/lib/chat/services/intent.ts:26) |
| **Multilingue** | Patterns inline FR + AR (script arabe) + Darija (script latin). Indépendant de `detectLanguage()`. | [`intent.ts:176`](apps/web/src/lib/chat/services/intent.ts:176) |
| **Latence** | ~< 1 ms (régex synchrones), aucune mesure formelle. | — |
| **Précision/rappel** | Aucune métrique en code, aucun dataset d'évaluation, aucune annotation prod. | (manque) |
| **Tests** | 34 cas (`intent.test.ts`), dont bloc adversarial CHA‑225 (priorité `purchase-intent` vs `order-status`, mixtes multilingues). | [`intent.test.ts`](apps/web/src/lib/chat/services/intent.test.ts) |
| **Limites connues** | Typos non gérés (`comamnder` → `misc`), ambiguïté « commande », fragilité phrases complexes, pas d'apprentissage. | [`intent.ts:2‑24`](apps/web/src/lib/chat/services/intent.ts:2) (commentaires CHA‑035/161/225) |

### 1.2 Approche A — « Régex++ » : enrichissement de l'heuristique

**Concept**

Garder le moteur regex existant, l'enrichir de trois couches :

1. **Fuzzy matcher** côté pré‑traitement : passer le texte dans un normaliseur Levenshtein ≤ 2 (mots > 5 caractères) contre un dictionnaire de tokens connus → corrige `comamnder` → `commander`, `kif` → `kifach`.
2. **Synonymes** : table `intent_synonyms` (`canonical, variants[]`) injectée au démarrage. Exemples : `tarif ⇔ prix ⇔ combien ⇔ ghali` ; `livraison ⇔ shipping ⇔ tawsil ⇔ توصيل`.
3. **Contexte conversationnel** : pondérer +0.5 pt l'intent matché si il était déjà actif au tour précédent (continuation), pondérer −0.3 pt s'il s'agissait d'un intent terminé (`order-status` suivi de remerciements).

**Schéma de flux**

```
   user msg ──► [normalize] ──► [fuzzy fix] ──► [synonym expand] ──► [regex score] ──► [context bias] ──► intent
                                                                                          ↑
                                                                                   prev intent
                                                                                  (from session)
```

**Forces**

- **Zéro coût LLM**, latence < 2 ms.
- Debug trivial (on log les patterns matchés).
- S'intègre sans toucher la signature publique `detectIntent()` — rétro‑compatible.
- Tests existants (34 cas) restent valides comme régression.

**Faiblesses**

- Plafond connu : au delà de 25‑30 intents et de variations linguistiques riches, le maintien du dictionnaire devient chronophage.
- Pas de généralisation sémantique : `« je suis pas convaincu par votre histoire »` restera dans `misc` même si l'humain devine `objection-doubt`.
- Le tuning Levenshtein peut sur‑corriger des noms propres (`« Casa »` → `« case »`).

**Coût** : Effort `S‑M` · Coût LLM `€` · Pertinence `★★★☆☆`

### 1.3 Approche B — Embeddings + centroïdes (« k‑NN sémantique »)

**Concept**

Construire offline un **prototype d'embedding par intent** :

- Pour chaque intent, on collecte 20‑30 phrases canoniques en FR + AR + AR‑MA (300 phrases × 16 intents ≈ 4 800 vecteurs, mais on les agrège en **centroïde** par intent → 16 vecteurs).
- Stockés en table `chat_intent_centroid (intent, vector pgvector(1536), updatedAt)`.
- À runtime : embed user message (1 appel embedding, ~$0.00002), `cosine` vs 16 centroïdes, retourne top‑1 si score > 0.78, sinon `misc`.
- **Hybride avec A** : régex en premier (cas évidents), embedding en fallback uniquement si score régex < 2.

**Schéma de flux**

```
   user msg ──► [regex score] ──► high ? ──► return
                                    │
                                    └─ low ? ──► [embed msg] ──► cosine vs centroids ──► top1
                                                       ↑
                                                centroids (16, pre-computed)
```

**Forces**

- **Généralisation sémantique** : paraphrases inconnues sont correctement classées (`« j'ai pas envie de payer si ça marche pas »` → `objection-doubt`).
- Multilingue gratuit (les embeddings modernes `text-embedding-3-small` ou `multilingual-e5` connaissent FR/AR/Darija romanisée).
- Amélioration continue : ajouter une phrase = re‑calcul centroïde, pas de re‑deploy.
- Pgvector déjà en place pour RAG ([`schema.ts:242‑328`](apps/web/src/lib/chat/db/schema.ts:242)), aucune infra nouvelle.

**Faiblesses**

- Latence +30‑120 ms par message (1 appel embedding réseau).
- Coût marginal : ~$0.02 / 1 000 messages avec OpenAI `text-embedding-3-small`. Négligeable mais existant.
- Dépendance fournisseur d'embeddings (cassure si OpenAI down). Mitigeable via fallback Ollama local.
- Calibrage seuil `0.78` empirique, demande dataset d'évaluation.

**Coût** : Effort `M` · Coût LLM `€` · Pertinence `★★★★☆`

### 1.4 Approche C — LLM classifier dédié (« mini‑LLM intent »)

**Concept**

Confier la détection à un petit LLM (Haiku 4.5 ou GPT‑4o‑mini, voire un Qwen2.5‑3B local via Ollama) avec prompt structuré :

```
SYSTEM: Tu es un classifieur d'intention. Réponds en JSON strict.
INTENTS_AVAILABLES: [pricing, shipping, ingredient, ...]
USER_MESSAGE: <texte>
HISTORIQUE_RÉCENT: <3 derniers tours>
OUTPUT: {"intent": "<one>", "confidence": <0..1>, "alternatives": [...]}
```

**Forces**

- Compréhension fine du contexte (sarcasme, double sens, mixte d'intents).
- Robuste aux fautes de frappe et registres mélangés (darija + emoji + français).
- Multi‑intent natif (un message peut être `pricing` + `objection-price` simultanément).

**Faiblesses**

- Coût marginal **non négligeable** : ~$0.0001‑0.0003 par message classifié (vs $0.00002 pour embeddings).
- Latence +200‑500 ms (appel LLM additionnel **avant** l'appel principal).
- Double‑facturation si l'utilisateur a un quota strict.
- Casse l'observabilité (debugger « pourquoi cet intent » est moins déterministe).

**Coût** : Effort `S` · Coût LLM `€€€` · Pertinence `★★★☆☆`

### 1.5 Matrice comparative — Axe 1

| Critère | A — Régex++ | B — Embeddings | C — LLM mini |
|---|---|---|---|
| **Effort eng.** | S‑M | M | S |
| **Latence ajoutée / message** | +0 ms | +30‑120 ms | +200‑500 ms |
| **Coût LLM marginal** | € (nul) | € (~$0.02 / 1k msg) | €€€ (~$0.20 / 1k msg) |
| **Généralisation paraphrases** | Faible | Forte | Très forte |
| **Robustesse typos** | Moyenne (fuzzy) | Forte | Forte |
| **Robustesse multilingue** | Forte (patterns) | Forte (embedding) | Très forte |
| **Observabilité / debug** | Excellente | Bonne | Faible |
| **Évolution & maintenance** | Manuelle (dict) | Auto (ajout phrase) | Auto (prompt) |
| **Dépendance externe** | Aucune | Provider embeddings | Provider LLM |
| **Risque budget mensuel** | Aucun | Très faible | Modéré |
| **Pertinence FemiGlow** | ★★★☆☆ | ★★★★☆ | ★★★☆☆ |

### 1.6 Recommandation finale — Axe 1

> **Cascade hybride A → B, avec C en option ciblée**

**Phasing** :

- **Phase 1.1 (jour 1‑3, effort S)** : Adopter Approche A en isolation. Brancher fuzzy + synonymes + biais conversationnel. Mesure baseline sur **dataset annoté** (échantillon 500 messages prod taggés à la main par le PO/Care).
- **Phase 1.2 (jour 4‑8, effort M)** : Adjoindre Approche B en **fallback** quand le score régex est < 2 (estimé 15‑25 % du trafic). Centroïdes stockés en `chat_intent_centroid`, recalculables via une route admin `/admin/chat/intents/recompute`. Évaluation A/B sur le dataset.
- **Phase 1.3 (jour 9‑12, optionnelle)** : Approche C uniquement pour les **intents critiques** (purchase‑intent, frustration, b2b) en cas d'ambiguïté détectée (top‑1 et top‑2 séparés de moins de 0.05 en cosine). 5 % du trafic au plus.

**Justification** :

1. Régex++ est nécessaire indépendamment : c'est le filet pour tous les messages non‑ambigus. Très bon ROI.
2. Embeddings est l'investissement avec le meilleur ratio qualité / coût / robustesse. Pgvector déjà en place.
3. LLM mini est utile uniquement en surface de décision sensible (lead capture, frustration) où la précision vaut le surcoût.

**Métrique cible** :

- Précision globale ≥ 88 % (vs ~73 % estimés actuels sur intent autres que `misc`).
- Rappel `purchase-intent` ≥ 95 % (sensible pour conversion).
- Latence p95 ≤ 150 ms ajoutée (acceptable vs ~2 s d'attente LLM réponse).

**Garde‑fous** :

- L'intent issu de B/C doit pouvoir être **« forcé »** par les patterns A forts (« je veux commander » → toujours `purchase-intent` quel que soit l'embedding).
- Tous les passages B/C journalisés dans `chat_message.meta.intentSource = 'regex' | 'embedding' | 'llm'` pour audit.
- Kill‑switch env `CHAT_INTENT_USE_EMBEDDINGS=false` pour revert instantané.

### 1.7 Wireframe admin — Console intents

```
┌───────────────────────────────────────────────────────────────────────┐
│  Admin ▸ Chat ▸ Intentions                          [ + Nouvel intent]│
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──── Statistiques 30 derniers jours ─────────────────────────────┐  │
│  │  Total messages : 12 384  ·  Couverture intent : 94.2 %         │  │
│  │  Top 5 :  pricing 18 % · routine 14 % · shipping 11 %           │  │
│  │           greeting 9 %  · purchase-intent 7 %                    │  │
│  │  Bas du tableau : after-hours 0.4 % · b2b 0.8 %                 │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌──── Table des 16 intents ────────────────────────────────────────┐ │
│  │ Intent          │ Vol. │ Préc.│ Rappel│ Source dominante │ Actions│ │
│  │ ─────────────── │ ──── │ ──── │ ───── │ ──────────────── │ ──────│ │
│  │ pricing         │ 2231 │ 91 % │ 88 %  │ regex (78%)      │ ✎ ⚙   │ │
│  │ purchase-intent │  876 │ 95 % │ 92 %  │ embedding (43%)  │ ✎ ⚙   │ │
│  │ objection-doubt │  412 │ 74 % │ 61 %  │ embedding (67%)  │ ✎ ⚙ ⚠ │ │
│  │ misc            │ 1024 │  —   │  —    │ —                │ ✎ ⚙   │ │
│  │ ...                                                               │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  [ Recalculer centroïdes ]  [ Exporter dataset ]  [ Lancer évaluation]│
└───────────────────────────────────────────────────────────────────────┘
```

**Wizard de re‑training des centroïdes** (5 étapes guidées) :

```
Étape 1/5  ▸ Sélection intent à enrichir   [ objection-doubt ▾ ]
Étape 2/5  ▸ Ajouter des exemples FR / AR / AR-MA (≥ 20 par langue)
Étape 3/5  ▸ Vérifier qu'aucun exemple ne chevauche d'autres intents
            ↳ détection auto : "ça marche pas chez moi" → 0.81 avec frustration ⚠
Étape 4/5  ▸ Recalcul du centroïde (preview score-confusion)
Étape 5/5  ▸ Tirage A/B sur 1000 messages historiques + validation
```

---

<a id="2-axe--récupération-des-informations-métier-"></a>
## § 2 — Axe « Récupération des informations métier »

### 2.1 État des lieux

| Aspect | Constat | Référence |
|---|---|---|
| **Mécanisme** | RAG pgvector avec embeddings, top‑K=5 cosine ≥ 0.55, re‑rank heuristique (boost mots clés > 4 char, pénalité > 1500 char). | [`rag/service.ts:198‑216`](apps/web/src/lib/chat/rag/service.ts:198) |
| **Sources DB** | 3 tables : `chat_knowledge_source` (kind url/md/pdf/docx/faq/snippet), `chat_knowledge_chunk`, `chat_knowledge_embedding` (pgvector 1536d). | [`schema.ts:242‑328`](apps/web/src/lib/chat/db/schema.ts:242) |
| **Function calling** | **Absent**. Adapter OpenAI lit `tool_calls` mais aucun `tools[]` n'est jamais envoyé. | [`providers/openai.ts`](apps/web/src/lib/chat/providers/openai.ts) |
| **Sync produits** | **Absente**. Produits vivent dans Sanity → DB `products`. Aucun cron / hook ne pousse vers KB. | (manque) |
| **Sync villes livraison** | **Absente**. `delivery_cities` (~430 villes Sendit) jamais ingérées dans la KB chat. | [`delivery-cities.ts`](apps/web/src/lib/seeders/items/delivery-cities.ts) |
| **Promotions** | **Aucune table** chat ni produit. Si user demande promo → hallucination potentielle. | (manque) |
| **État de KB en prod** | Vide ou minimaliste. Garde‑fou prompt : « la maison ne diffuse pas cette info » si zéro chunk. | [`09-knowledge-base-rag.md:187`](docs/chat-assistant/09-knowledge-base-rag.md:187) |
| **Suivi commandes** | Mentionné dans la demande PO (« plus tard ») — aucune table de tracking n° de suivi. | (à concevoir) |

### 2.2 Approche A — « RAG enrichi & auto‑sync »

**Concept**

On reste dans le paradigme RAG existant et on l'**alimente automatiquement** à partir des sources de vérité métier :

1. Un **générateur Markdown** transforme chaque entité produit / ville / promo en fiche Markdown structurée :
   ```
   # Pack FemiGlow (slug: pack-femiglow)
   - Prix : 199 dh (anchor 390 dh)
   - Composition : Soin A + Soin B + Tonique
   - Public : peau sensible, post‑pelage
   - FAQ : ...
   ```
2. Un **cron quotidien** (`/api/cron/chat-knowledge-sync`) liste les entités modifiées (timestamp `updatedAt`), régénère les Markdown, ré‑injecte via le pipeline `ragService.ingest()` existant — idempotence garantie par `rawHash`.
3. Une **table de mapping** `chat_knowledge_origin` (sourceId, entityType `product`/`city`/`promo`, entityId, lastSyncAt) permet de tracer la provenance et de purger les fiches orphelines.

**Schéma de flux**

```
   [Sanity products] ┐
   [DB products]     ├──► [generator MD] ──► [hash check] ──► [ingest if changed] ──► pgvector
   [delivery_cities] ┘                                ↑
                                                     │
                                              cron 02:00 UTC
```

**Forces**

- **Zéro changement d'architecture LLM**. Tout l'existant RAG (router embedding, charter, audit) continue de marcher.
- Multilingue géré : on génère 3 versions de la fiche (FR/AR/AR‑MA) à partir des champs `nameFr/nameAr` déjà en DB.
- Pas de dépendance fournisseur LLM (fonctionne avec n'importe quel provider de chat).

**Faiblesses**

- **Latence d'information** : info change à 14 h, propagée seulement à 02 h le lendemain. Inacceptable pour stocks ou promos flash.
- **Redondance données** : même prix dans `products.priceMad` et dans une fiche MD. Risque de divergence.
- **Pas de query temps réel** : on ne peut pas répondre « est‑ce qu'il vous reste 3 packs en stock ce soir ? ». La donnée stock n'a sa place que dans une fiche figée.
- **Bruit RAG** : 430 villes × 3 langues = 1 290 chunks dédiés livraison. Pollue le top‑K du retrieve.

**Coût** : Effort `M‑L` · Coût LLM `€` · Pertinence `★★★☆☆`

### 2.3 Approche B — « Function calling » (tools structurés natifs)

**Concept**

On bascule sur le paradigme **agentic** : le LLM **décide** d'appeler des outils typés (`OpenAI tools` / `Anthropic tool_use` / `Mistral function_calling`) qui interrogent la base métier en direct.

**Outils proposés (catalogue minimal viable)** :

| Outil | Paramètres | Retour | Source DB |
|---|---|---|---|
| `get_product` | `slug` | `{name, priceMad, anchorMad, composition, claims[], imageUrl}` | table `products` |
| `list_products` | `category?, audience?` | `Product[]` (3 max) | table `products` |
| `get_delivery_info` | `city` | `{city, eta, priceMad, source}` | table `delivery_cities` |
| `check_promo` | `code` | `{valid, discountPct, expiresAt, conditions[]}` | (à créer) `promo_codes` |
| `get_order_status` | `orderNumber, email` | `{status, trackingNumber, eta, carrier}` | (à créer) `orders.tracking_*` |
| `search_faq` | `query` | `{chunks: [{title, url, content}]}` | fallback RAG existant |

**Schéma de flux**

```
   user msg ──► LLM (with tools) ──┬─► reply (text)
                                   │
                                   └─► tool_call(get_product, {slug:"pack-femiglow"})
                                          │
                                          └─► backend exec ──► result (JSON) ──► LLM (2nd turn)
                                                                                     │
                                                                                     └─► reply (text)
```

**Forces**

- **Temps réel** : la requête tape directement la DB, pas de désynchro.
- **Données structurées** : le LLM peut composer plusieurs sources (« je vous compare pack vs unitaire ») en un tour avec deux tool calls parallèles.
- **Économie tokens** : on n'embarque pas tout le catalogue dans le system prompt, juste les schémas tools.
- **Évolutif** : ajouter un outil = ajouter une route + un schéma JSON, le LLM apprend automatiquement quand l'utiliser.

**Faiblesses**

- **Support hétérogène des providers** : OpenAI / Anthropic / Mistral OK natifs ; Ollama variable selon le modèle ; Qwen / DeepSeek / Zhipu nécessitent adaptateur custom. Pourrait restreindre le choix d'`CHAT_DEFAULT_PROVIDER`.
- **Latence doublée** : tour 1 (LLM choisit l'outil) + exécution + tour 2 (LLM compose la réponse). +1 à 2 s en moyenne.
- **Sécurité tools** : chaque outil exécute du code serveur. Doit être **strictement** typé (Zod schema), rate‑limited, et auditable.
- **Hallucination de paramètres** : LLM peut inventer un `slug` (« pack‑gold ») qui n'existe pas. Besoin de fallback explicite.
- **Tooling à 0 dans le code actuel** : effort de mise en place non négligeable.

**Coût** : Effort `L‑XL` · Coût LLM `€€` (tokens dépend du nb de tool calls) · Pertinence `★★★★☆`

### 2.4 Approche C — « Hybrid retriever » (RAG + tools, routing intent‑based)

**Concept**

On combine les deux mondes avec un **routeur pré‑LLM** basé sur l'intent (Axe 1) :

```
   intent ──► routing decision ──┬─► RAG seul          (ingredient, routine, social-proof)
                                  ├─► Tool seul         (order-status, check_promo)
                                  ├─► Tool + RAG        (pricing, comparison, purchase-intent)
                                  └─► RAG fallback      (misc, frustration)
```

- L'orchestrator garde la pleine main : il décide en amont quoi charger en contexte.
- Le LLM reçoit un contexte enrichi : `[Données tool: ...] + [Extraits KB: ...]` et compose la réponse.
- Le LLM peut quand même appeler des tools supplémentaires si besoin (mode mixte).

**Schéma de flux**

```
       user msg ──► [intent detect] ──► [pre-routing]
                                            │
              ┌─────────────────────────────┼─────────────────────────────┐
              ▼                             ▼                             ▼
       [ RAG retrieve ]              [ Tool exec ]                 [ RAG + Tool ]
              │                             │                             │
              └─────────────────────────────┴─────────────────────────────┘
                                            │
                                            ▼
                                  [ LLM stream reply ]  (avec tools optionnels)
```

**Forces**

- **Meilleure latence moyenne** : 60 % des cas servis par RAG seul (rapide) ou Tool seul (1 call DB).
- **Précision factuelle maximale** sur prix, stocks, suivi (Tool) + bonne sur explications, ingrédients (RAG).
- **Tolérance providers** : si un provider ne supporte pas tools, on rabat sur RAG.
- **Observabilité fine** : `chat_message.meta.retrievalStrategy = 'rag' | 'tool' | 'hybrid'`.

**Faiblesses**

- **Complexité orchestrateur** : passage d'un pipeline linéaire à un graphe à 4 branches. Plus de tests E2E nécessaires.
- **Surface d'audit plus large** : 2 systèmes à monitorer (RAG hits + tool calls).
- **Garde‑fous redoublés** : un tool foireux peut bloquer la réponse, un RAG vide aussi. Besoin de timeout strict et fallback.

**Coût** : Effort `XL` · Coût LLM `€€` · Pertinence `★★★★★`

### 2.5 Matrice comparative — Axe 2

| Critère | A — RAG auto‑sync | B — Function calling | C — Hybrid retriever |
|---|---|---|---|
| **Effort eng.** | M‑L | L‑XL | XL |
| **Latence ajoutée** | +0 ms (pré‑calculé) | +1 à 2 s (2 tours LLM) | +0 à 1 s (selon route) |
| **Temps réel données** | ❌ (cron 24 h) | ✅ direct DB | ✅ direct DB |
| **Précision prix / stock** | Moyenne | Excellente | Excellente |
| **Précision routine / ingrédients** | Bonne (RAG) | Faible (pas de tool) | Bonne (RAG) |
| **Support multi‑provider** | ✅ universel | ⚠️ dépendant | ✅ avec fallback |
| **Suivi commande (futur)** | ❌ impossible | ✅ natif | ✅ natif |
| **Coût LLM marginal** | € | €€ (tokens 2×) | €€ |
| **Complexité observabilité** | Faible | Moyenne | Élevée |
| **Risque hallucination factuelle** | Modéré (KB obsolète) | Faible (données live) | Très faible |
| **Pertinence FemiGlow** | ★★★☆☆ | ★★★★☆ | ★★★★★ |

### 2.6 Recommandation finale — Axe 2

> **Approche C en 3 vagues** ; les vagues 1 et 2 livrent déjà la majorité de la valeur.

**Phasing** :

**Vague 2.1 — RAG enrichi minimum viable (jour 1‑7)**

- Mise en place du **générateur de fiches Markdown** pour `products` et `delivery_cities` (script `pnpm chat:sync-knowledge`).
- Run unique manuel → ingestion seed FR (et placeholders AR/AR‑MA).
- Cron `daily 02:00` activé via `/api/cron/chat-knowledge-sync`.
- ⇒ Le chat connaît désormais le catalogue et les délais Casablanca/Rabat/... même sans tools.

**Vague 2.2 — Tools structurés P0 (jour 8‑18)**

- Implémentation backend de 3 tools : `get_product`, `get_delivery_info`, `search_faq` (RAG wrapper).
- Adapter OpenAI / Anthropic / Mistral pour `tools[]`.
- Router intent‑based simple : `pricing | purchase-intent | comparison` → tools ; reste → RAG.
- Feature flag `CHAT_TOOLS_ENABLED=true` pour rollback.

**Vague 2.3 — Promos + Suivi commande (jour 19‑30, dépend du backend commande)**

- Table `promo_codes` + tool `check_promo`.
- Extension `orders` avec `trackingNumber`, `carrier`, `trackingStatus`, `trackingUpdatedAt` + webhook Sendit → tool `get_order_status`.
- Politique d'authentification : `get_order_status(orderNumber, email)` ne renvoie le suivi que si l'email matche celui de la commande (anti‑énumération).

**Justification** :

1. La vague 1 (RAG enrichi) **est nécessaire de toute manière** : sans données dedans, ni RAG ni tools ne suffisent. Elle livre une vraie valeur dès la fin de la semaine 1.
2. La vague 2 (tools P0) déverrouille la précision prix / livraison qui est le **principal motif d'abandon** lu dans les conversations existantes.
3. La vague 3 traite les futures fonctionnalités (suivi commande) avec une dette technique nulle : on aura le bon foundation.

**Métrique cible** :

- Taux de réponses « la maison ne diffuse pas » ÷ messages : < 3 % (vs estimé 25‑40 % aujourd'hui sur catalog).
- Taux de réponses contenant un prix correct (audit échantillon 100 messages) : ≥ 98 %.
- Latence p95 réponse complète : ≤ 4 s (vs ~3 s actuels).

**Garde‑fous** :

- Tous les tools sont **typés Zod en entrée et en sortie**, exécution dans un sandbox `try/catch` avec timeout 2 s.
- Schéma de retour de `get_product` n'expose **jamais** `costMad` ou `marginPct` (anti‑fuite info commerciale).
- Logs `chat_tool_call` (tool, params, durée, statut, error) → indexés dans une table dédiée pour audit + budget.
- Kill‑switch par tool : `CHAT_TOOL_ALLOWLIST=get_product,get_delivery_info`.

### 2.7 Wireframe admin — Console knowledge & tools

```
┌───────────────────────────────────────────────────────────────────────┐
│  Admin ▸ Chat ▸ Sources & Outils                  [+ Source] [+ Outil]│
├───────────────────────────────────────────────────────────────────────┤
│  ┌──── Onglets ───────────────────────────────────────────────────┐   │
│  │  Sources RAG  │  Auto‑sync  │  Outils (tools)  │  Logs tool    │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ── Auto‑sync ─────────────────────────────────────────────────────── │
│                                                                       │
│  Source           Statut           Dernière sync      Fiches gen.     │
│  ─────────────    ──────           ──────────────     ──────────      │
│  products (DB)    ✓ actif          12 min ago         28 fiches × 3   │
│  delivery_cities  ✓ actif          12 min ago         430 fiches × 3  │
│  promo_codes      ⚙ à activer      —                  —               │
│                                                                       │
│  [ Forcer sync maintenant ]   [ Voir le diff dernière run ]           │
│                                                                       │
│  ── Outils (tools) ────────────────────────────────────────────────── │
│                                                                       │
│  Tool                   Statut    Calls 24 h   p95 lat.   Err.        │
│  ─────────────────────  ──────    ──────────   ────────   ────        │
│  get_product            ✓ on        427         180 ms     0          │
│  get_delivery_info      ✓ on        311         220 ms     0          │
│  check_promo            ⚙ off        —          —          —          │
│  get_order_status       ⚙ off        —          —          —          │
│                                                                       │
│  [Tester sandbox]  [Voir logs détaillés]  [Exporter Zod schémas]      │
└───────────────────────────────────────────────────────────────────────┘
```

**Wizard d'ajout d'un outil** (5 étapes) :

```
Étape 1/5  ▸ Nom + description (vue par le LLM)
            ↳ "get_product : retourne les infos publiques d'un produit"
Étape 2/5  ▸ Paramètres (Zod schema) — bloc JSON édité avec auto-complete
            ↳ { slug: z.string().min(3).max(60) }
Étape 3/5  ▸ Mapping handler backend (fichier + fonction)
            ↳ apps/web/src/lib/chat/tools/get-product.ts → getProductTool
Étape 4/5  ▸ Retour (Zod schema) + champs à masquer (cost, margin)
Étape 5/5  ▸ Test sandbox avec valeurs réelles + activation feature flag
```

---

<a id="3-axe--suggestions-de-messages--engagement-"></a>
## § 3 — Axe « Suggestions de messages & engagement »

### 3.1 État des lieux

| Aspect | Constat | Référence |
|---|---|---|
| **Suggestions actuelles** | Tableau **toujours vide** `suggestions: []` retourné par `sessionService.snapshot()`. | [`sessionService` ligne 72`](apps/web/src/lib/chat/services/session.ts) (estimation, à confirmer) |
| **Greeting actuel** | `greeting: ''` hardcodé empty. | (idem) |
| **Infrastructure existante** | Table `chat_theme_preset.pageSalutations` JSONB (`pathPattern`, `fr`, `ar`, `arMa`). | [`schema.ts:76‑84`](apps/web/src/lib/chat/db/schema.ts:76) |
| **Schéma DTO** | `ChatSessionSnapshot.suggestions: z.array(z.string()).max(3)` (max 3). | [`contracts.ts:70‑80`](apps/web/src/lib/chat/contracts.ts:70) |
| **Composant client** | `SuggestionPill` (rendu si `messages.length === 0`) pré‑remplit le composer. | [`MessageList.tsx:54‑85`](apps/web/src/components/chat/MessageList.tsx:54) |
| **Canned responses / scripted** | **Aucune table**, aucun système de court‑circuit du LLM. Toutes les réponses passent par LLM. | (manque) |
| **Streaming local** | Le humanize handler côté serveur ajoute jitter / pauses ponctuation. Si on bypass LLM, il faut **reproduire** cet effet côté client. | [`humanize.ts`](apps/web/src/lib/chat/services/humanize.ts) |
| **Persistance après bypass** | Aucune logique pour distinguer un message envoyé via suggestion vs libre, ni un assistant message canned vs LLM. | (manque) |

### 3.2 Critère utilisateur clé

L'utilisateur a exprimé **trois contraintes simultanées** :

> 1. Encourager la conversion via des suggestions par défaut à l'entrée du chat.
> 2. Réponses pré‑établies aux suggestions pour ne pas consommer le solde LLM.
> 3. Garder l'effet de réponse progressive (typewriter / streaming).
> 4. Si l'utilisateur reprend en libre après une suggestion, **pas d'ambiguïté côté LLM**, pas de discontinuité.

C'est le critère 4 qui est le plus subtil : le LLM, au tour suivant, voit l'historique. Si le tour précédent contient `[assistant]: <réponse canned très formelle>`, le LLM doit poursuivre **dans le même registre**, **avec la même connaissance** que ce qui a été dit, et **sans détecter** qu'il y a eu un saut.

### 3.3 Approche A — « Suggestions statiques pré‑canned »

**Concept**

- En DB : table `chat_canned_pair` (key, label_fr/ar/arMa, expected_user_msg_fr/ar/arMa, scripted_reply_fr/ar/arMa, cta_label?, cta_url?, allow_followup_llm bool, page_pattern, audience).
- À l'ouverture du chat : `themeService.resolveSalutations(pathname)` retourne le greeting + 3 paires `chat_canned_pair` matchant la page.
- Frontend : 3 pills cliquables. Click → POST `/api/chat/canned-pair/:key`.
- Backend : route récupère la paire, **persiste deux messages** dans `chat_message` :
  - `role=user, content=<expected_user_msg>, meta={ source: 'suggestion', pairKey: <key> }`
  - `role=assistant, content=<scripted_reply>, meta={ source: 'canned', pairKey: <key> }`
- Streaming local : le frontend ne demande pas le SSE LLM, il déclenche un mini‑typewriter local (split par mot, ~30 ms entre mots, jitter ±15 ms) pour conserver l'UX.
- Si l'utilisateur tape ensuite un message libre, l'orchestrator LLM appelle normalement et voit dans l'historique les deux messages canned ⇒ il les traite comme des messages standards. Le **system prompt v3** est étendu d'une ligne : « tes réponses précédentes peuvent venir d'un script — assume‑les ».

**Schéma de flux**

```
┌─ ouverture chat ─────────────────────────────────────────────────┐
│ GET /api/chat/session                                             │
│   ↳ greeting = "Bienvenue ! Comment puis-je aider…"               │
│   ↳ suggestions = [                                                │
│       { key:"price-kit", label:"Quel est le prix du kit ?" },     │
│       { key:"city-eta", label:"Vous livrez à ma ville ?" },       │
│       { key:"how-use", label:"Comment l'utiliser ?" }              │
│     ]                                                              │
└───────────────────────────────────────────────────────────────────┘

  click "Quel est le prix du kit ?"
        │
        ▼
  POST /api/chat/canned-pair { key: "price-kit", sessionId }
        │
        ├─► persiste msg user : "Quel est le prix du kit ?" + meta.source='suggestion'
        ├─► persiste msg asst : "<scripted body>" + meta.source='canned'
        ├─► event KPI chat_canned_used
        └─► return { reply, persistedIds }
        │
        ▼
  Frontend simule streaming local :
   word by word, jitter 30±15 ms, retour visuel = celui du LLM
        │
        ▼
  Utilisateur tape « combien pour 2 packs ? »  ← message libre
        │
        ▼
  POST /api/chat/message (pipeline LLM normal)
   historique inclut les 2 messages canned, LLM reprend la conv'
```

**Forces**

- **Coût LLM ≈ 0** sur les chemins canned.
- Latence quasi instantanée (un SELECT DB, pas de réseau LLM).
- Greeting + suggestions deviennent un véritable **vecteur de conversion** (CTA visibles dès le launcher).
- Maintenance simple : éditeur CMS admin.

**Faiblesses**

- **Rigide** : si l'utilisateur reformule légèrement (« combien coûte le kit ? » au lieu du label exact), le tour 1 retombe sur LLM standard.
- Cohérence stylistique scriptée vs LLM : risque de rupture de ton si rédaction pas alignée.
- Maintenance multilingue : chaque paire = 6 champs texte (3 langues × 2 rôles), volume modéré.

**Coût** : Effort `M` · Coût LLM `€` (négatif net) · Pertinence `★★★★☆`

### 3.4 Approche B — « FAQ gateway invisible »

**Concept**

Pas de pills visibles ; on **intercepte côté serveur** chaque message user :

- Si l'intent + similarité embedding matche fortement une entrée FAQ → on bypass le LLM et on stream la réponse scripted.
- Sinon → pipeline LLM normal.

Table `chat_faq_entry` (key, question_canonical_fr/ar/arMa, question_embedding pgvector, scripted_reply_fr/ar/arMa, intent_hint).

**Schéma de flux**

```
   user msg ──► [embed] ──► cosine vs FAQ entries ──► top1
                                                          │
                                                          ├─ score > 0.85 ──► serve scripted
                                                          └─ score ≤ 0.85 ──► LLM standard
```

**Forces**

- **Invisible** : pas d'UI nouvelle, l'utilisateur tape ce qu'il veut.
- Économie réelle sur le **trafic spontané** (le user n'a pas besoin de cliquer pile sur le label).
- Couvre les paraphrases.

**Faiblesses**

- **Aucune incitation à la conversion** : pas de CTA visuels, le user doit deviner les questions disponibles.
- Latence : 1 appel embedding ajouté avant le LLM (mais évité si match).
- Calibrage du seuil 0.85 délicat : trop bas = faux positifs (« combien de stress ? » mappé à « combien de soin ? »).
- Si la FAQ matche **partiellement**, on rate la nuance de la vraie question.

**Coût** : Effort `M` · Coût LLM `€‑€€` · Pertinence `★★★☆☆`

### 3.5 Approche C — « Hybride : suggestions + canned + transition LLM fluide »

**Concept**

C'est l'union des deux mondes plus un **module de continuité conversationnelle** :

1. **Suggestions visuelles** (comme A) : greeting + 3 pills contextuels par page.
2. **FAQ gateway** (comme B) : sur message libre, recherche FAQ avant LLM.
3. **Continuité LLM** : quand l'utilisateur reprend en libre après une canned, le LLM reçoit :
   - L'historique complet (canned messages compris).
   - Une **note system éphémère** : `« les tours [N‑2, N‑1] sont issus d'un script de la maison FemiGlow. Tu peux assumer leur véracité et leur ton. »` (cette note est ajoutée seulement pour ce tour, pas persistée).
   - Le contexte RAG / Tools (Axe 2) normalement.

**Anti‑confusion design** :

- Aucun marqueur visuel canned vs LLM côté user (uniformité d'expérience).
- Côté DB : `chat_message.meta.replyType = 'llm' | 'canned' | 'tool-augmented'`, mais ce champ n'est **jamais** sérialisé vers le LLM (privacy by design).
- Si une canned reply contient un fait (« le pack coûte 199 dh »), ce fait est aussi dans la KB pour que le LLM puisse le retrouver indépendamment au tour suivant.
- Le `cannedPair.scripted_reply` est rédigé en suivant un **guide de style** strict (ton, longueur, vocabulaire) aligné sur le system prompt LLM. Une revue éditoriale est nécessaire avant publication.

**Schéma de flux**

```
                       ┌──────── Ouverture du chat ─────────┐
                       │  greeting + 3 suggestions (pills)  │
                       └────────────────────────────────────┘
                                       │
              ┌─── click pill ─────────┼──── tape libre ─────┐
              │                        │                     │
              ▼                        │                     ▼
       Canned pair instant             │           [intent + faq embed lookup]
       (server persists,               │                     │
        client streams local)          │             ┌───────┴───────┐
              │                        │        score > seuil   score ≤ seuil
              │                        │             │                │
              ▼                        │             ▼                ▼
       message libre suivant ──────────┴────► canned response  ── LLM full pipeline
       (LLM avec note éphémère)                 (local stream)     (RAG + tools)
              │                                       │                │
              └───────────────────────────────────────┴────────────────┘
                                  Historique unifié, ton continu
```

**Forces**

- **Couvre les deux modes** d'entrée (clic incitatif + tape libre).
- **Optimisation budget maximale** : 30‑45 % des conversations attendues bypass le LLM en partie.
- Conversion explicitement boostée (les pills sont des CTA).
- Continuité LLM solide grâce à la note éphémère + alignement éditorial.
- Observable : KPI `% messages servis canned` mesurable par session.

**Faiblesses**

- **Effort éditorial le plus élevé** : chaque canned pair doit être écrite avec soin, en 3 langues, alignée stylistiquement.
- Complexité backend : routing canned vs FAQ vs LLM, gestion d'idempotence côté client.
- Nécessite un système de **versioning canned** (table `chat_canned_pair_version`) sinon une modif texte invalide l'historique.

**Coût** : Effort `L` · Coût LLM `€` (économie net) · Pertinence `★★★★★`

### 3.6 Matrice comparative — Axe 3

| Critère | A — Suggestions statiques | B — FAQ gateway | C — Hybride |
|---|---|---|---|
| **Effort eng.** | M | M | L |
| **Effort éditorial** | Moyen (3 paires × pages) | Élevé (large FAQ) | Élevé |
| **Coût LLM marginal** | € (négatif net) | € (négatif net) | € (négatif net, max éco) |
| **Conversion (CTA visibles)** | ✅ | ❌ | ✅ |
| **Couverture paraphrases** | ❌ (label exact) | ✅ | ✅ |
| **Continuité LLM après canned** | Risque modéré | N/A (LLM standard) | Excellente (note système éphémère) |
| **Effet streaming progressif** | Simulé client | Simulé serveur | Hybride |
| **Multilingue** | Forte (chaque pair × 3) | Forte (embeddings) | Forte |
| **Observabilité KPI** | Excellente | Bonne | Excellente |
| **Risque incohérence stylistique** | Modéré | Faible | Faible si guide style |
| **Pertinence FemiGlow** | ★★★★☆ | ★★★☆☆ | ★★★★★ |

### 3.7 Recommandation finale — Axe 3

> **Approche C en 2 vagues**

**Phasing** :

**Vague 3.1 — Suggestions visuelles + canned (jour 1‑10)**

- Table `chat_canned_pair` + admin CMS (création / édition / activation par page).
- `themeService.resolveSalutations(pathname)` branché.
- Route `/api/chat/canned-pair/:key` + persistance pair (user + assistant) + KPI.
- Frontend : `SuggestionPill` cliquable + `useLocalStream(text)` hook qui simule un typewriter avec jitter.
- Système prompt LLM v3 étendu d'une ligne sur les tours canned.

**Vague 3.2 — FAQ gateway invisible (jour 11‑20)**

- Table `chat_faq_entry` + embeddings persistés.
- Hook pré‑LLM dans l'orchestrator : si `cosine > 0.85` sur top‑1 FAQ → stream FAQ scripted.
- Seuils calibrés sur dataset annoté.
- Kill‑switch env `CHAT_FAQ_GATEWAY_ENABLED=true`.

**Vague 3.3 — Personnalisation contextuelle (jour 21‑28, optionnel)**

- Suggestions adaptatives par intent **précédent** (si dernier intent = `pricing`, montrer pills sur livraison / délai / promo).
- A/B testing infra (table `chat_canned_pair_variant`).

**Justification** :

1. La vague 1 est la **clé conversion** demandée par le PO. Visible immédiatement.
2. La vague 2 amplifie l'économie sans nuire à l'UX (invisible).
3. La vague 3 est la cerise itérative qui se mesure sur conv rate.

**Métrique cible** :

- Taux de clic sur suggestion à l'ouverture : ≥ 35 %.
- Coût LLM moyen par session : −25 % vs baseline.
- Taux de rupture conversationnelle perçue (audit qualitatif sur 50 conversations post‑canned) : < 5 %.
- Conversion (lead capture) après clic suggestion : +20 % vs entry text libre.

**Garde‑fous** :

- **Guide éditorial canned** : ton, longueur (≤ 90 mots), pas de promesses non vérifiées, **toujours** une CTA implicite ou explicite vers une question suivante.
- Revue **PO obligatoire** avant publication de chaque pair (workflow `draft → review → published`).
- Versioning canned : si une réponse est éditée, **l'ancien `bodyHash`** reste référencé dans les messages persistés (pour audit & RGPD).
- Charter filter passe sur les canned avant publication (cohérence sécurité).

### 3.8 Wireframe admin — Console suggestions & canned

```
┌────────────────────────────────────────────────────────────────────────┐
│  Admin ▸ Chat ▸ Suggestions                          [ + Nouvelle paire]│
├────────────────────────────────────────────────────────────────────────┤
│  ┌─ Onglets ──────────────────────────────────────────────────────┐    │
│  │   Suggestions par page  │  Bibliothèque paires  │  FAQ gateway │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                        │
│  ── Suggestions pour : /kit ─────────────────────────────────────────  │
│                                                                        │
│  Greeting (FR) :  Bienvenue sur le kit FemiGlow. Comment puis-je…      │
│  Greeting (AR) :  مرحباً بكم في طاقم فيميغلو...                            │
│  Greeting (AR-MA): Marhba bik ! Kifach n3awnek f9addiya dyalk ?        │
│                                                                        │
│  Ordre  │ Paire                            │ Statut    │ Score conv.   │
│  ─────  │ ─────────────────────────────────│ ────────  │ ───────────   │
│   1     │ price-kit  "Quel est le prix"    │ ✓ publié  │ 38 % click    │
│   2     │ city-eta   "Vous livrez à…"      │ ✓ publié  │ 21 % click    │
│   3     │ how-use    "Comment l'utiliser"  │ ⏳ draft   │ —             │
│                                                                        │
│  [ Réordonner ]  [ Ajouter une paire à cette page ]                    │
└────────────────────────────────────────────────────────────────────────┘
```

**Wizard de création d'une paire canned** (6 étapes) :

```
Étape 1/6  ▸ Clé technique (unique)
            ↳ price-kit-200-mad

Étape 2/6  ▸ Label visible (FR / AR / AR-MA)
            ↳ FR : "Quel est le prix du kit ?"
              AR : "ما هو سعر الطاقم ؟"
              AR-MA : "Chhal taman dyal pack ?"

Étape 3/6  ▸ Réponse scriptée (FR / AR / AR-MA)
            ↳ FR : "Le pack FemiGlow est à 199 dh (au lieu de 390 dh
                    en prix de référence). Souhaitez-vous que je vous
                    explique ce qui est inclus ?"
            ↳ Compteur : 27 mots / 90 max ✓
            ↳ Charter filter : ✓ aucun signal bloquant

Étape 4/6  ▸ CTA inline (optionnel)
            ↳ Label : "Voir la composition"
            ↳ URL : /kit#composition

Étape 5/6  ▸ Continuation LLM
            ↳ Permettre au LLM de répondre librement
              au tour suivant ?  [ Oui ▾ ]
            ↳ Notes pour le LLM (system prompt) :
              "Tu peux mentionner le pack et la composition,
              mais ne dévoile pas la marge."

Étape 6/6  ▸ Pages associées + audience
            ↳ Pages : [/kit, /, /kit/*]
            ↳ Audience : tous / b2c / b2b
            ↳ Ordre dans le panel : 1
            [ Prévisualiser dans le widget ]  [ Publier ]
```

**Wireframe user — Ouverture du chat (mobile, /kit)** :

```
┌─────────────────────────────────────┐
│  ⓘ FemiGlow assistance      ✕      │
├─────────────────────────────────────┤
│                                     │
│  Marhba bik !                       │
│  Kifach n3awnek f9addiya dyalk ?    │
│                                     │
│                                     │
│  ╭─────────────────────────────╮    │
│  │ Chhal taman dyal pack ?     │    │  ← pill 1 (canned price-kit)
│  ╰─────────────────────────────╯    │
│                                     │
│  ╭─────────────────────────────╮    │
│  │ Wach tdkhel l-mdinti ?      │    │  ← pill 2 (canned city-eta)
│  ╰─────────────────────────────╯    │
│                                     │
│  ╭─────────────────────────────╮    │
│  │ Kifach kayt'9addem ?         │    │  ← pill 3 (canned how-use)
│  ╰─────────────────────────────╯    │
│                                     │
├─────────────────────────────────────┤
│ [📎] [ Tapez votre message…   ] [→] │
└─────────────────────────────────────┘
```

---

<a id="4-synthèse-globale"></a>
## § 4 — Synthèse globale & roadmap

### 4.1 Architecture cible (vue d'ensemble)

```
                          ┌──────────────────────────────┐
                          │   Utilisateur (FR/AR/AR-MA)  │
                          └──────────────┬───────────────┘
                                         │
                                         ▼
               ┌─────────────────────────────────────────────────┐
               │  Widget chat (greeting + suggestions par page)  │
               │  ─ click pill = canned local stream             │
               │  ─ tape libre = pipeline LLM                    │
               └────────────────┬──────────────────────────┬─────┘
                                │                          │
                  ┌─────────────┘                          │
                  ▼                                        ▼
        ┌────────────────────┐               ┌─────────────────────────┐
        │  POST canned-pair  │               │  POST /api/chat/message │
        │  (persists 2 msgs) │               │  (orchestrator pipeline)│
        └────────────────────┘               └────────────┬────────────┘
                                                          │
                                                          ▼
                                          ┌────────────────────────────┐
                                          │ Sanitize + Lang detect      │
                                          └─────────────┬──────────────┘
                                                        ▼
                                          ┌────────────────────────────┐
                                          │  INTENT (Axe 1)            │
                                          │  cascade regex++ → emb → llm│
                                          └─────────────┬──────────────┘
                                                        ▼
                                          ┌────────────────────────────┐
                                          │  FAQ gateway (Axe 3.2)     │
                                          │  cosine >0.85 → canned     │
                                          └──────┬──────────────┬──────┘
                                          match  │              │ no match
                                                 ▼              ▼
                                ┌────────────────────┐  ┌────────────────────┐
                                │  Stream FAQ canned │  │  CONTEXT (Axe 2)   │
                                │  (local typewriter)│  │  routing intent-based│
                                └────────────────────┘  │  ┌──────┬───────┐ │
                                                         │  │ RAG  │ Tools │ │
                                                         │  └──────┴───────┘ │
                                                         └─────────┬─────────┘
                                                                   ▼
                                                         ┌────────────────────┐
                                                         │  LLM stream reply  │
                                                         │  + humanize jitter │
                                                         └─────────┬──────────┘
                                                                   ▼
                                                         ┌────────────────────┐
                                                         │  Persist + KPI     │
                                                         │  + Lead-decision   │
                                                         └────────────────────┘
```

### 4.2 Roadmap consolidée — 6 vagues sur 10‑12 semaines

| Vague | Sem. | Axe | Contenu | Livrable mesurable |
|---|---|---|---|---|
| **V1** | 1 | Tous | Dataset annoté de 500 messages + baseline KPI (intent precision, % réponses « ne diffuse pas », tx clic suggestion *post‑mock*) | Tableau de bord baseline figé |
| **V2** | 1‑2 | Axe 1 | Régex++ (fuzzy + synonymes + biais contextuel) | Précision intent ≥ 82 % |
| **V3** | 2‑3 | Axe 2.1 | RAG enrichi & auto‑sync (produits, villes) | KB peuplée ≥ 200 chunks utiles |
| **V4** | 3‑5 | Axe 3.1 | Suggestions visuelles + canned + admin CMS + wizard | Tx clic ≥ 25 %, coût LLM −10 % |
| **V5** | 5‑7 | Axe 1.2 + 2.2 | Embeddings centroïdes + tools P0 (`get_product`, `get_delivery_info`) | Précision intent ≥ 88 % ; tx « ne diffuse pas » < 5 % |
| **V6** | 7‑9 | Axe 3.2 | FAQ gateway invisible + calibrage seuils | Coût LLM −25 %, latence FAQ p95 < 800 ms |
| **V7** | 9‑12 | Axe 2.3 | `check_promo`, `get_order_status` (dépend du backend commande) + LLM mini intent sur cas critiques | Suivi commande opérationnel |

### 4.3 Métriques de succès consolidées

```
                                Baseline (est.)    Cible V7      Méthode mesure
                                ────────────────   ──────────    ────────────────
 Précision intent (global)       73 %               92 %          Dataset annoté 500 msg
 Rappel purchase-intent          80 %               95 %          Idem
 Tx « ne diffuse pas »           ~30 %              < 3 %         Audit 100 msg / mois
 Tx clic suggestion à l'ouverture  0 % (absent)     ≥ 35 %        Event KPI chat_suggestion_clicked
 Coût LLM moyen / session         baseline €X       −30 %         Sum cost / count sessions
 Conversion lead-capture / session  baseline %      +20 %         Event chat_lead_completed
 Latence p95 réponse              ~3 s              ≤ 4 s         SSE timing
 Satisfaction qualitative         (non mesurée)    ≥ 4/5         Sondage NPS in-widget
```

### 4.4 Risques & garde‑fous

| Risque | Probabilité | Sévérité | Mitigation |
|---|---|---|---|
| Tools function calling cassent sur Ollama/Qwen | Élevée | Moyenne | Fallback RAG transparent, `tool_calls_enabled` par provider |
| Canned responses obsolètes (prix change) | Élevée | Élevée | Versioning + revue mensuelle + monitoring drift KB ↔ DB |
| Hallucination de slug `get_product("pack-gold")` inexistant | Moyenne | Faible | Tool retourne `{found:false, did_you_mean:[]}` ; LLM compose excuse |
| Discontinuité ton canned → LLM | Moyenne | Moyenne | Guide éditorial + note système éphémère + audit qualitatif post-déploiement |
| Coût embeddings intent dépasse budget | Faible | Faible | Kill-switch `CHAT_INTENT_USE_EMBEDDINGS=false`, throttle si >X req/min |
| Fuite données par tool mal scopé | Faible | Critique | Schemas Zod stricts, allowlist tools, audit log obligatoire |
| Sur-déclenchement FAQ gateway | Moyenne | Moyenne | Seuil 0.85 + monitoring tx faux positifs, calibrage A/B |
| Cron sync KB échoue silencieusement | Moyenne | Élevée | Alerte Sentry + dashboard last successful run |

### 4.5 Décisions à prendre avant de coder

1. **Provider embeddings privilégié** : OpenAI `text-embedding-3-small` (qualité+coût) vs `multilingual-e5` local Ollama (souveraineté+latence) ?
2. **Allowlist tools par provider** : tolère‑t‑on de désactiver les tools si le client choisit Mistral ?
3. **Versioning canned** : full snapshot par version (lourd mais audit‑friendly) ou diff (léger mais reconstitution complexe) ?
4. **Multilingue AR/AR‑MA** : on rédige nous‑mêmes les canned ou on commande à un copywriter natif (qualité varie énormément) ?
5. **Métriques satisfaction** : on installe un mini‑sondage `👍 / 👎` après chaque tour assistant, ou un NPS de session ?

### 4.6 Ce qu'on **ne fait pas** (anti‑scope)

- Pas de fine‑tuning de LLM custom : trop cher, trop d'incertitude, OpenAI / Anthropic / Mistral à jour suffisent.
- Pas de chatbot vocal / TTS : hors scope demandé.
- Pas de routing à plusieurs agents (« CSR Agent », « Sales Agent »…) : un seul système prompt unifié reste plus simple à maintenir.
- Pas de RAG sur le forum / blog : non demandé, et faible ROI tant que les fiches produits / livraison ne sont pas en KB.
- Pas de migration provider : on conserve l'architecture `providerRouter` + breaker existante.

---

<a id="a-annexes"></a>
## § A — Annexes

### A.1 Glossaire

| Terme | Définition |
|---|---|
| **Canned response** | Réponse pré‑écrite par l'admin, servie sans appel LLM. |
| **Centroïde** | Vecteur moyen d'un ensemble d'embeddings ; représente l'intent. |
| **FAQ gateway** | Court‑circuit serveur qui détecte une question fréquente et sert sa réponse scriptée. |
| **Function calling / tools** | Mécanisme où le LLM appelle des outils backend typés au lieu d'inventer. |
| **Humanize** | Stream avec jitter et pauses ponctuation pour effet « typewriter humain ». |
| **Pair canned** | Couple (label suggestion, réponse scriptée) consommé en un click. |
| **RAG** | Retrieval‑Augmented Generation. |
| **Re‑rank** | Réordonnancement des chunks RAG par heuristique secondaire. |
| **Tool call** | Appel typé du LLM vers un endpoint backend. |
| **Intent** | Catégorie sémantique d'un message utilisateur. |

### A.2 Mapping tickets CHA (existant + proposés)

| Ticket | Statut | Axe |
|---|---|---|
| CHA‑035 | Done | Axe 1 — Intent v1 (régex base) |
| CHA‑096 | Done | Axe 2 — RAG re‑rank heuristique |
| CHA‑161 | In progress | Axe 1 — Élargissement intents v1.5 |
| CHA‑162 | In progress | Axe 2 — Instructions v2 |
| CHA‑164 | Proposed | Axe 2 — Sandbox d'ingestion KB |
| CHA‑165 | Proposed | Axe 3 — Lead‑form trigger rules |
| CHA‑225 | Done | Axe 1 — Intent v2 scoring + purchase‑intent |
| CHA‑257 | Proposed | Axe 2 — Function calling Phase 3 |
| **CHA‑310 (à créer)** | — | Axe 1 — Embeddings centroïdes |
| **CHA‑311 (à créer)** | — | Axe 2 — Auto‑sync KB cron |
| **CHA‑312 (à créer)** | — | Axe 2 — Tools `get_product`, `get_delivery_info` |
| **CHA‑313 (à créer)** | — | Axe 3 — Canned pairs admin + wizard |
| **CHA‑314 (à créer)** | — | Axe 3 — FAQ gateway invisible |
| **CHA‑315 (à créer)** | — | Axe 2 — Tools promos & order tracking |

### A.3 Comparatif providers — Support tools natif

| Provider | Tools natif | Streaming + tools | Langues fortes | Coût indicatif |
|---|---|---|---|---|
| OpenAI gpt‑4o‑mini | ✅ | ✅ | FR/AR/Darija | $0.15/M in, $0.60/M out |
| Anthropic Claude 3.5 Haiku | ✅ | ✅ | FR/AR/Darija | $0.80/M in, $4/M out |
| Mistral Large | ✅ | ✅ | FR/AR | $2/M in, $6/M out |
| Gemini 1.5 Flash | ✅ | ⚠️ partiel | FR/AR/Darija | $0.075/M in, $0.30/M out |
| Qwen 2.5 (Ollama local) | ⚠️ via adapter | ⚠️ | FR/AR | $0 (CPU/GPU local) |
| DeepSeek | ⚠️ via adapter | ⚠️ | FR | $0.14/M in, $0.28/M out |
| Zhipu GLM‑4 | ⚠️ via adapter | ⚠️ | FR limité | $0.10/M in |

### A.4 Tables DB à créer (synthèse)

```sql
-- Axe 1
chat_intent_centroid          (intent, vector pgvector(1536), updatedAt, sampleCount)
chat_intent_example           (intent, language, text, addedBy, addedAt)

-- Axe 2
chat_knowledge_origin         (sourceId, entityType, entityId, lastSyncAt, sourceHash)
chat_tool_call_log            (id, sessionId, tool, params, result, duration, status, error)
promo_codes                   (code, discountPct, conditions, validFrom, validTo, ...)
-- + extension table `orders` : trackingNumber, carrier, trackingStatus, trackingUpdatedAt

-- Axe 3
chat_canned_pair              (key, pagePattern, audience, label_fr/ar/arMa,
                               scripted_reply_fr/ar/arMa, ctaLabel, ctaUrl,
                               allowFollowupLLM, status, currentVersionId)
chat_canned_pair_version      (id, pairId, body_fr/ar/arMa, bodyHash, publishedAt, publishedBy)
chat_faq_entry                (key, language, questionCanonical, questionEmbedding,
                               scriptedReply, intentHint, threshold, enabled)
```

### A.5 Env variables à ajouter (synthèse)

```dotenv
# Axe 1
CHAT_INTENT_USE_EMBEDDINGS=true
CHAT_INTENT_USE_LLM_FALLBACK=false
CHAT_INTENT_EMBEDDING_THRESHOLD=0.78

# Axe 2
CHAT_TOOLS_ENABLED=true
CHAT_TOOL_ALLOWLIST=get_product,get_delivery_info,search_faq
CHAT_KB_SYNC_CRON_ENABLED=true

# Axe 3
CHAT_SUGGESTIONS_ENABLED=true
CHAT_FAQ_GATEWAY_ENABLED=false   # actif post-V6
CHAT_FAQ_GATEWAY_THRESHOLD=0.85
CHAT_CANNED_STREAM_WPM=180
```

---

**Fin du document.**

> Prochaine étape attendue : validation PO des recommandations finales (1, 2, 3) puis ouverture des tickets CHA‑310 à CHA‑315 et planification de la Vague V1 (dataset baseline).
