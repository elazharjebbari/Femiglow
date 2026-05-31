# ADR‑003 — Canned pairs & FAQ gateway pour économie LLM et conversion

| Champ | Valeur |
|---|---|
| **Statut** | proposed |
| **Date** | 2026‑05‑13 |
| **Décideurs** | PO, content lead, tech‑lead |
| **Ticket** | CHA‑313, CHA‑314 |
| **Remplace** | rien — feature net‑new |

## Contexte

L'utilisateur a explicitement demandé :
1. Des **suggestions de messages par défaut** qui encouragent la conversion à l'ouverture du chat.
2. Des **réponses pré‑établies** pour ne pas consommer le budget LLM inutilement.
3. **Conserver l'effet de streaming progressif** (typewriter) même sur les canned.
4. Pas de **discontinuité** ou d'ambiguïté côté LLM quand l'utilisateur reprend en libre après un message automatique.

L'état actuel ne couvre **aucune** de ces demandes :
- `greeting: ''` et `suggestions: []` sont retournés hardcodés.
- Aucune table de canned response.
- Aucune logique de bypass LLM.
- Aucun streaming local côté client.

## Décision

Introduire **deux mécanismes complémentaires** :

### 1. Canned pairs visuelles (suggestions cliquables)

Table `chat_canned_pair` (key, page_pattern, audience, labels FR/AR/AR‑MA, scripted replies FR/AR/AR‑MA, CTA, `allow_followup_llm`, statut `draft/review/published`).

Flux :
1. Ouverture du chat → `themeService.resolveSalutations(pathname)` retourne greeting + 3 pills.
2. Clic pill → `POST /api/chat/canned-pair/:key`.
3. Backend insère `chat_message role=user (source='suggestion')` + `chat_message role=assistant (source='canned', pairKey)`.
4. Frontend `useLocalStream(text)` simule le typewriter (180 wpm + jitter ±15 ms).

### 2. FAQ gateway invisible (intercept message libre)

Table `chat_faq_entry` (key, language, question_canonical, question_embedding, scripted_reply, intent_hint, threshold, enabled).

Flux :
1. User tape un message libre.
2. Orchestrator embed la question, cosine vs `chat_faq_entry` matching language + intent_hint.
3. Si top‑1 ≥ 0.85 → bypass LLM, stream la réponse scripted.
4. Sinon → pipeline LLM normal.

### 3. Continuité conversationnelle

**C'est le point le plus subtil de la demande PO.**

Quand l'utilisateur tape un message libre après une canned :
- L'historique LLM inclut les deux messages canned (user + assistant) comme messages standards.
- Une **note système éphémère** (non persistée) est ajoutée au prompt LLM : « Les tours [N‑2, N‑1] proviennent d'un script de la maison. Tu peux assumer leur véracité et leur ton ».
- Le `scripted_reply` est rédigé en suivant un **guide éditorial** strict aligné sur le system prompt LLM (ton, longueur ≤ 90 mots, vocabulaire).
- Tous les faits affirmés dans une canned (prix, délai) sont **aussi** présents dans la KB pour que le LLM puisse les retrouver indépendamment.

## Alternatives considérées

### Alt A — « Suggestions statiques » seules
- ✅ Simple
- ❌ Pas de couverture des paraphrases (« combien ? » vs label exact « Quel est le prix »)

### Alt B — « FAQ gateway » seul (sans pills)
- ✅ Invisible, économe sur trafic spontané
- ❌ Pas de CTA visuel → impact conversion limité

### Alt C — « Hybride adopté » (les deux)
- ✅ Couvre clic ET tape libre
- ✅ Optimise budget (30‑45 % du trafic bypass LLM)
- ✅ Maximise conversion (CTAs visibles)
- ⚠️ Effort éditorial le plus élevé

## Garde‑fous éditoriaux et techniques

| Risque | Mesure |
|---|---|
| Rupture stylistique canned ↔ LLM | Guide éditorial obligatoire + revue PO avant publish |
| Canned obsolète (prix change) | Versioning table `chat_canned_pair_version` (snapshot par version, hash) |
| Faux positifs FAQ gateway | Seuil 0.85 + monitoring tx faux positifs ; seuils ajustables par entrée |
| Discontinuité conversation | Note système éphémère + tests E2E continuity |
| Drift KB ↔ canned | Cron sanity check : pour chaque canned active, le fait correspondant est‑il en KB ? |

## Conséquences

### Positives
- Tx clic suggestion ouverture : 0 % → ≥ 35 % cible.
- Coût LLM par session : −30 % cible.
- Conversion lead post‑clic suggestion : +20 % vs entry libre.
- Time‑to‑first‑answer : ≈ 0 ms sur canned (vs 1.2 s LLM).

### Négatives
- Effort éditorial : ~30 canned pairs initiales × 3 langues × 6 champs ≈ 540 entrées texte à rédiger et valider.
- Maintenance continue : revue mensuelle des canned + FAQ entries.
- Complexité admin : wizard + workflow draft/review/published.
- Risque d'incohérence si édité par plusieurs personnes : verrou optimistic + audit log.

### Neutres
- Aucune cassure de l'existant.
- L'historique LLM intègre naturellement les tours canned (pas de schéma data spécial pour le LLM).

## Décisions UX clés

| Choix | Raison |
|---|---|
| Pas de badge visuel « canned » côté user | Uniformité de marque, évite « suspicion bot » |
| Streaming local conservé pour canned | Maintient la magie perçue ; user ne distingue pas |
| 3 pills maximum à l'ouverture | Hick's law ; au‑delà, paralysie du choix |
| CTA inline dans chaque canned | Pas de cul‑de‑sac conversationnel |
| Reprise libre toujours possible | Composer toujours visible et actif |

## Métriques de succès

- Tx clic suggestion ouverture : ≥ 35 % à T+30 j
- Tx rupture conversationnelle perçue (audit qualitatif 50 conv) : < 5 %
- Coût LLM par session : −25 % à T+30 j, −30 % à T+90 j
- Tx faux positifs FAQ gateway : ≤ 5 %

## Plan d'implémentation

1. **V4 (sem 5)** : Canned pairs visuelles + admin CMS + wizard 6 étapes + streaming local.
2. **V6 (sem 7‑9)** : FAQ gateway invisible + calibrage seuils.
3. **V7 (sem 11+)** : Personnalisation contextuelle (suggestions adaptatives basées intent précédent).
