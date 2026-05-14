# ADR‑001 — Cascade pour la détection d'intention

| Champ | Valeur |
|---|---|
| **Statut** | proposed |
| **Date** | 2026‑05‑13 |
| **Décideurs** | PO, tech‑lead |
| **Ticket** | CHA‑310 |
| **Remplace** | (rien — extension de CHA‑225) |

## Contexte

L'intent detector actuel ([`intent.ts:1‑347`](../../../apps/web/src/lib/chat/services/intent.ts)) est une heuristique régex pondérée v2 (CHA‑225). Il est rapide (< 1 ms), multilingue (FR/AR/AR‑MA inline), couvre 16 intents avec négateurs et seuil minimal.

**Limites identifiées** :
- Aucun fuzzy matching ⇒ `comamnder` retombe sur `misc`.
- Pas de généralisation sémantique aux paraphrases (`« je suis pas convaincu »` rate `objection-doubt`).
- Pas de calibrage formel (aucun dataset annoté, aucune mesure précision/rappel).
- Plafond rapide au‑delà de 20 intents.

Or l'intent est **le pivot du pipeline** : il pilote le routing de retrieval (Axe 2), le déclenchement du lead form (10 règles de lead‑decision), et bientôt les suggestions adaptatives. Toute imprécision se répercute sur la conversion.

## Décision

Adopter une **cascade hybride à trois niveaux**, du moins coûteux au plus précis :

```
   user msg
      │
      ▼
   ┌─────────────────────────────┐
   │ Niveau 1 — Régex++           │  toujours actif
   │  fuzzy + synonymes + biais   │
   └──────────┬───────────────────┘
              │
              ├─ score ≥ 2  ──────►  ✓ retour direct
              │
              ▼
   ┌─────────────────────────────┐
   │ Niveau 2 — Embeddings        │  fallback si score < 2
   │  cosine vs 16 centroïdes     │  flag CHAT_INTENT_USE_EMBEDDINGS
   └──────────┬───────────────────┘
              │
              ├─ top1 ≥ 0.78 ────►  ✓ retour
              │
              ▼
   ┌─────────────────────────────┐
   │ Niveau 3 — LLM mini          │  uniquement si intent critique ambigu
   │  Haiku / gpt-4o-mini         │  flag CHAT_INTENT_USE_LLM_FALLBACK
   └──────────┬───────────────────┘
              │
              └────────────────►  ✓ retour final
```

Critères de cascade :
- **Niveau 2 actif** si `regex_score < MIN_CONFIDENCE_SCORE` ou si intent retourné = `misc`.
- **Niveau 3 actif** uniquement si intent top‑1 est dans `{purchase-intent, frustration, b2b, callback-request}` ET top‑2 − top‑1 < 0.05 (ambiguïté forte).
- Le résultat final est journalisé en `chat_message.meta.intentSource = "regex" | "embedding" | "llm"`.

## Alternatives considérées

### Alt A — « Régex++ seul »
- ✅ Coût zéro
- ❌ Plafond connu, pas de généralisation
- ❌ Insuffisant pour atteindre 92 % précision

### Alt B — « LLM classifier dédié »
- ✅ Meilleure compréhension contextuelle
- ❌ Latence +200‑500 ms sur 100 % du trafic
- ❌ Coût LLM ~5× supérieur
- ❌ Casse l'observabilité (non‑déterministe)

### Alt C — « Cascade adoptée » 
- ✅ Coût quasi‑nul sur 80 % du trafic (régex)
- ✅ Précision ≥ 88 % sur 100 % du trafic
- ✅ Coût LLM marginal (<5 % du trafic)
- ✅ Kill‑switch granulaire par niveau
- ⚠️ Complexité d'implémentation modérée

## Conséquences

### Positives
- Précision globale projetée : 73 % → 92 % (sur dataset annoté de 500 messages, à constituer en V1).
- Recall `purchase-intent` projeté : 80 % → 95 %.
- Coût LLM additionnel : < 1 % du budget mensuel.
- Latence p95 ajoutée : ≤ 150 ms (acceptable vs ~2 s d'attente réponse).

### Négatives
- Nouvelle table `chat_intent_centroid` à maintenir (16 vecteurs).
- Dépendance provider embeddings (mitigée par fallback Ollama local).
- Calibrage du seuil 0.78 et de l'écart 0.05 demande des cycles de tuning.

### Neutres
- Rétro‑compatibilité totale : `detectIntent()` garde sa signature publique, la cascade est interne.
- Tests existants (34 cas régex) restent comme régression.

## Métriques de succès

- Précision globale ≥ 88 % à T+30 j (mesurée sur dataset annoté constitué en V1).
- Rappel `purchase-intent` ≥ 95 % à T+30 j.
- Latence p95 niveau 2 ≤ 150 ms.
- Taux de fallback niveau 3 ≤ 5 % du trafic.

## Plan d'implémentation (résumé)

1. **V1 (sem 1)** : Constituer dataset annoté de 500 messages prod.
2. **V2 (sem 1‑2)** : Niveau 1 Régex++ (fuzzy + synonymes + biais contextuel).
3. **V5 (sem 5‑7)** : Niveau 2 Embeddings centroïdes + table + cron recompute hebdomadaire.
4. **V7 (sem 9+)** : Niveau 3 LLM mini sur cas critiques.

Détails dans [`08-plan-conception/phasing-roadmap.md`](../../08-plan-conception/phasing-roadmap.md).

## Notes & questions ouvertes

- Provider embeddings recommandé : OpenAI `text-embedding-3-small` (meilleur ratio qualité/coût/multilingue). Alternative locale Ollama `multilingual-e5` à valider sur darija.
- Stratégie de re‑calibration : recompute centroïdes hebdo via cron + recalibration manuelle quand un intent atteint un seuil bas de précision (< 80 %).
