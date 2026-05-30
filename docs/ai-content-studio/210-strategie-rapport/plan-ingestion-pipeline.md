# Plan — Rendre le rapport stratégique digeste pour la pipeline de génération

> **État : LIVRÉ (option a).** Les 8 documents réécrits sont codés en seed et
> rechargeables en un clic depuis l'UI. Détails en §4bis « Implémentation livrée ».
>
> **But.** Transformer le rapport monolithique
> [`rapport-strategique-femiglow.md`](./rapport-strategique-femiglow.md) (≈ 7 000 mots,
> un seul bloc) en **knowledge documents** structurés, nettoyés et routés vers les
> bonnes collections RAG, afin que la pipeline LangGraph génère du contenu de **très
> haute qualité** — puis disposer d'un **protocole de test réel** pour vérifier la
> qualité soi-même.

---

## 1. Pourquoi on ne peut pas ingérer le rapport tel quel

La pipeline (`apps/web/src/lib/ai-engine/`) fonctionne ainsi :

| Étage | Fichier | Comportement |
|---|---|---|
| Découpage | `knowledge/ingestion.ts` | `RecursiveCharacterTextSplitter` — **1000 caractères / 200 overlap**, embedding `text-embedding-3-small` (1536 dim) |
| Récupération | `knowledge/retrieval.ts` | recherche cosinus pgvector, **top k=5–8**, **seuil de similarité 0.7** |
| Routage | `nodes/enrich-knowledge.ts` | choisit les collections selon `platform` × `objective` × `contentType` |
| Injection | `nodes/generate-script.ts`, `generate-caption.ts`, `generate-variants.ts` | concatène les chunks récupérés (tronqués à ~1500–4000 chars) dans le system/user prompt |

Conséquences directes sur la façon de préparer le contenu :

1. **Un document = un thème homogène.** Si on colle tout le rapport dans un seul document `brand-femiglow`, le splitter coupe à l'aveugle tous les 1000 caractères. Une requête « hooks TikTok » peut alors remonter un chunk qui parle d'AI Act ou de palette indigo → bruit, contexte dilué, génération moins précise.
2. **Les marqueurs `cite…turn…` polluent les embeddings.** Ils n'ont aucune valeur sémantique et faussent la similarité. → **À stripper.**
3. **Le seuil 0.7 est sélectif.** Un chunk trop générique (« la beauté évolue ») ne sera jamais récupéré. → Il faut des chunks **denses et actionnables**, avec un vocabulaire proche des requêtes réelles (`enrich-knowledge.ts` construit la requête à partir de `platform + contentType + objective + keyMessage + productFocus`).
4. **Le routage est piloté par collection.** Mettre le bon morceau dans la bonne collection garantit qu'il sera récupéré pour le bon type de génération.

---

## 2. Découpage cible : 1 rapport → 8 knowledge documents

Le rapport couvre **exactement** le périmètre des 9 collections déjà seedées
(`knowledge/seed-data.ts`). On le redécoupe donc en documents alignés sur ces
collections — en **complément** (pas remplacement) des seeds existants.

| # | Document (titre) | Collection cible (slug) | Sections sources du rapport | Sera récupéré quand… |
|---|---|---|---|---|
| D1 | Psychologie & charge cognitive — beauté | `neuromarketing` | « Psychologie du consommateur et mécaniques cognitives » | `objective ∈ {conversion, engagement, education}` |
| D2 | Viralité, hooks & storytelling — STEPPS | `viral-content` | « Viralité, storytelling et conversion » | `objective ∈ {engagement, awareness}`, `contentType=tendance` |
| D3 | Règles algorithmiques par plateforme | `platform-algorithms` | « Règles éditoriales par plateforme » + tableau | toute génération (mappé sur Instagram/TikTok/FB/Pinterest/LinkedIn) |
| D4 | Stratégie J-Beauty traduite (piliers + saisonnalité) | `jbeauty-strategy` | « Stratégie J-Beauty pour Femiglow » | `contentType ∈ {rituel, education}` |
| D5 | Doctrine IA « assistée, preuve humaine » + transparence | `ai-content-rules` | « IA, tendances… » (partie IA + AI Act) | toute génération (garde-fous) |
| D6 | Tendances beauté/skincare 2025-2026 | `emerging-trends` | « Tendances beauté et skincare structurantes » | `contentType=tendance`, `objective=awareness` |
| D7 | Positionnement & grammaire de marque Femiglow | `brand-femiglow` | Résumé exécutif + grammaire visuelle + check-list | **toujours** (collection ajoutée par défaut) |
| D8 | Formules de hooks & CTA prêts à l'emploi | `copywriting` | hooks de tension, exemples CTA, check-list | `objective=conversion` |

> Les ingrédients héros (riz fermenté, camélia, matcha, yuzu) sont déjà couverts par
> le seed `products-ingredients`. On **n'écrase pas** — on ajoute seulement une note
> « preuves mesurées, jamais de promesse miracle » si elle manque.

---

## 3. Règles de réécriture de chaque chunk (qualité RAG)

Pour chaque document Dx, réécrire les sections sources selon ces règles — c'est
**l'étape qui fait la qualité** :

**a. Nettoyage.** Supprimer tous les `cite…turn…`, les renvois « (voir section…) »,
et la méta sur « le fichier joint demande… ». Garder le contenu, jeter l'échafaudage.

**b. Densité actionnable.** Chaque chunk doit tenir en **600–900 caractères** (sous la
limite de 1000 du splitter → un chunk = une idée complète, jamais coupée au milieu).
Ouvrir chaque chunk par une **phrase-thèse** qui contient les mots-clés de requête
probables (ex. « Sur TikTok, … », « Hook de conversion : … », « Pilier rituel : … »).

**c. Format directif.** Préférer des **règles impératives** aux paragraphes narratifs :
> ❌ « Les créations qui surperforment n'essaient pas de faire tenir tout le produit. »
> ✅ « Règle : un post = une idée + une preuve + un seul CTA. Ne jamais empiler 5 bénéfices, une promo et 2 CTA dans un asset. »

Le modèle de génération suit beaucoup mieux des règles que de la prose.

**d. Exemples concrets conservés.** Les exemples « Femiglow » du rapport (hooks,
séquences multi-plateformes) sont de l'**or pour le few-shot** — les garder en l'état,
balisés `Exemple :`.

**e. Métadonnées riches** (champ `metadata` JSONB à l'ingestion) pour traçabilité :
```json
{ "category": "strategic-brief", "priority": "high",
  "source": "rapport-strategique-2026-05", "pillar": "viralite",
  "validFrom": "2026-05-29" }
```

---

## 4. Procédure d'ingestion (2 voies)

### Voie A — UI admin (recommandée pour vérifier soi-même)
1. Aller sur `/admin/content-studio-v2/ai-engine/knowledge`.
2. Pour chaque collection cible, ouvrir → **Ajouter un document** → coller le texte réécrit du document Dx, titre + metadata.
3. L'ingestion chunk + embed automatiquement (retour `{documentId, chunkCount}`).

### Voie B — API / script (reproductible, versionnable)
`POST /api/admin/ai-engine/knowledge/{slug}/documents`
```json
{ "sourceType": "text",
  "title": "Viralité, hooks & storytelling — STEPPS",
  "content": "...texte réécrit du document D2...",
  "metadata": { "category": "strategic-brief", "pillar": "viralite", "priority": "high" } }
```
→ Un **script de seed dédié** (`scripts/seed-strategic-brief.ts` ou extension de
`knowledge/seed-data.ts`) rend l'opération idempotente et rejouable sur prod/staging.
C'est l'option à privilégier pour que le contenu survive à un reset de base.

---

## 4bis. Implémentation livrée

Les 8 documents réécrits (D1→D8), nettoyés et localisés à l'univers FemiGlow
(ongles/mains J-Beauty), vivent désormais dans le code :

| Élément | Chemin |
|---|---|
| 8 documents + seeder idempotent | `apps/web/src/lib/ai-engine/knowledge/seed-strategic-brief.ts` (`STRATEGIC_BRIEF_DOCUMENTS`, `seedStrategicBrief()`) |
| Export public | `apps/web/src/lib/ai-engine/knowledge/index.ts` |
| Endpoint « charger tout » | `POST /api/admin/ai-engine/knowledge/seed-defaults` (base + brief) |
| Bouton UI | « Charger les connaissances par défaut » — page `…/ai-engine/knowledge` (header + état vide) |
| Tests | `seed-strategic-brief.test.ts` (7 tests : périmètre, anti-citations, idempotence, erreurs) |

**Idempotence** — `seedStrategicBrief()` n'insère un document que si aucun document de
même titre n'existe déjà dans la collection cible. On peut donc cliquer le bouton autant
de fois que voulu sans doublon (les `seedKnowledgeBase` de base sautent les collections
déjà peuplées ; le brief saute au niveau document). C'est pourquoi le brief contourne la
limite « skip si collection non vide » qui aurait sinon ignoré `brand-femiglow`,
`neuromarketing` et `platform-algorithms` (déjà peuplées par le seed de base).

**Comment recharger** : page Base de connaissances → bouton « Charger les connaissances
par défaut ». Le bandeau de résultat indique `N collections · X docs de base · Y docs
stratégiques chargés (Z ignorés)`. L'ingestion chunk + embed immédiatement (clé OpenAI
résolue via `AI_ENGINE_OPENAI_API_KEY || CONTENT_STUDIO_OPENAI_API_KEY || OPENAI_API_KEY`).

---

## 5. Protocole de test réel — vérifier la qualité soi-même

L'objectif : pouvoir **comparer avant/après ingestion** sur des cas concrets et juger
la qualité à l'œil. Trois niveaux.

### Niveau 1 — La récupération fonctionne (RAG)
Pour chaque collection alimentée, lancer une requête test et vérifier que les chunks
remontent au-dessus du seuil 0.7 :
- `neuromarketing` ← requête « hook attention 3 secondes charge cognitive »
- `platform-algorithms` ← « TikTok signaux For You partages »
- `jbeauty-strategy` ← « pilier rituel routine peau sensible »
→ Vérifiable via un test ciblé sur `searchByCollections()` ou un log dans `enrich-knowledge.ts` qui imprime les titres de documents récupérés.

### Niveau 2 — A/B de génération (le vrai juge)
Sur `/admin/content-studio-v2/ai-engine/create` (ou `/create`), lancer **le même brief deux fois** : une fois avant ingestion (état actuel), une fois après.

Brief de référence suggéré (à figer pour comparer) :
- Platform = `instagram`, Format = `reel`, contentType = `rituel`
- objective = `engagement`, productFocus = « Sérum Éclat Naturel »
- keyMessage = « double hydratation, peau qui ne tiraille plus »

Grille de notation manuelle (avant/après) :
| Critère | Attendu post-ingestion |
|---|---|
| Hook | tension légère en 1ʳᵉ ligne (style « Pourquoi votre peau tire après le nettoyage ? ») |
| Une seule idée | pas d'empilement de bénéfices/CTA |
| Preuve concrète | geste / texture / ordre mentionné |
| Ton | sobre, sans emoji, sans promesse médicale (conforme `brand-femiglow`) |
| CTA | « Sauvegardez… » / « Découvrir le rituel » selon objective |
| Traduction J-Beauty | bénéfice d'usage, pas de cliché décoratif |

### Niveau 3 — Cohérence des variantes
Vérifier que les 3 variantes (`generate-variants.ts`) restent **vraiment différentes**
(hook alternatif / CTA différent / registre émotionnel) tout en gardant la grammaire
de marque. C'est le signal que le contexte injecté est assez riche sans être contradictoire.

### Régression automatisée (optionnel mais conseillé)
Ajouter un test d'intégration qui, sur le brief de référence, asserte des invariants
**robustes** (pas le texte exact) : absence d'emoji, présence d'un CTA, longueur de
caption dans les bornes plateforme, ≥ 8 hashtags pour Instagram. Cela protège contre
une régression de qualité lors de futurs changements de prompt.

---

## 6. Ordre d'exécution proposé

| # | Étape | Sortie |
|---|---|---|
| 1 | Réécrire D1→D8 selon §3 (nettoyage + densité + règles impératives) | 8 textes prêts |
| 2 | Snapshot « avant » : générer le brief de référence, archiver le résultat | baseline |
| 3 | Ingérer D7 (`brand-femiglow`) + D3 (`platform-algorithms`) d'abord — impact le plus large | 2 docs |
| 4 | Test Niveau 1 + Niveau 2 partiel | validation précoce |
| 5 | Ingérer D1, D2, D4, D5, D6, D8 | 6 docs |
| 6 | Test Niveau 2 complet (avant/après) + Niveau 3 | grille remplie |
| 7 | (option) script de seed idempotent + test de régression | reproductible |

> **Décision à confirmer avant d'exécuter :** veux-tu que je (a) réécrive les 8 documents
> et fournisse le script de seed idempotent prêt à lancer, ou (b) que je commence par
> ingérer manuellement D7+D3 et te montre l'A/B sur le brief de référence avant d'aller
> plus loin ? Le présent fichier est le plan ; l'exécution attend ton feu vert.

---

## 7. Hors-scope (notes pour plus tard)
- Ré-indexation incrémentale automatique quand le rapport est mis à jour (pour l'instant : ré-ingestion manuelle du document concerné).
- Pondération par `priority` dans le scoring de récupération (le retrieval actuel ne lit pas `metadata.priority`).
- Collection campagne saisonnière dédiée (ex. `campaign-printemps-sakura`) — utile quand on activera le calendrier saisonnier du rapport.
