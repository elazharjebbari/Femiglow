# Résumé exécutif — Chat FemiGlow v2

## Le problème en une phrase

Le chat actuel est techniquement solide (pipeline orchestrator, RAG, lead‑decision, multilingue FR/AR/AR‑MA) **mais il ne convertit pas** : suggestions vides, knowledge base creuse, intents détectés sur 16 catégories sans données live, et aucun système économique pour les questions répétitives.

## La proposition de valeur en trois axes

| Axe | Promesse | Effet conversion attendu |
|---|---|---|
| **1. Intent** | Détection précise à 92 % grâce à une cascade régex++ → embeddings → LLM mini sur les cas critiques | +15 % de déclenchements `purchase-intent` corrects → +15 % de leads qualifiés |
| **2. Knowledge** | Sync auto produits/villes/promos + outils typés (tool calls) pour prix/livraison/suivi commande temps réel | Taux « ne diffuse pas » : 30 % → < 3 % · Précision factuelle : 65 % → ≥ 98 % |
| **3. Suggestions** | Pills cliquables par page + canned responses zéro‑coût LLM + FAQ gateway invisible | Tx clic suggestion ≥ 35 % · Coût LLM −30 % · Conversion lead après clic +20 % |

## Le « pari » conversion

> Un visiteur qui ouvre le chat sans cliquer **part dans 70 % des cas en moins de 30 s** (estimation à confirmer par event tracking). Le levier le plus rapide est donc le **premier écran du chat** : greeting personnalisé par page + 3 suggestions contextuelles + réponse immédiate au clic (effet streaming local pour conserver la magie).

Nous misons sur :
1. **Réduction du « blank page anxiety »** : le visiteur ne se demande plus « qu'est‑ce que je peux demander ? ».
2. **CTA implicites** : chaque suggestion mène à une réponse qui pousse vers une étape suivante (composition → délai → lead form).
3. **Économie de budget** : 30‑45 % des messages servis sans LLM → on peut **se permettre** un fallback LLM mini sur les cas ambigus sans exploser le budget.

## Ce qui est nouveau, ce qui ne l'est pas

| Conservé | Étendu | Nouveau |
|---|---|---|
| `providerRouter` + breaker | Pipeline orchestrator | `chat_canned_pair` + admin CMS |
| pgvector / HNSW | RAG avec re‑rank | `chat_intent_centroid` |
| `lead-decision` 10 règles | `intent` 16 → cascade | Tool calls `get_product`, `get_delivery_info` |
| Charter filter | Sync cron knowledge base | `chat_faq_entry` gateway |
| iron‑session admin | Wizards admin (intents, suggestions, tools) | Stream local typewriter client |

## Coût et planning

- **Effort total** : ≈ 10 à 12 semaines à 2 EFT (1 fullstack + 1 frontend) + 0.3 EFT design + 0.2 EFT copy FR/AR.
- **Coût LLM en régime** : baisse nette estimée à **−30 %** vs aujourd'hui à trafic équivalent, malgré la cascade.
- **Vagues** : 7 vagues (cf. [`08-plan-conception/phasing-roadmap.md`](../08-plan-conception/phasing-roadmap.md)).
- **Premier livrable visible** : Vague V3 (semaine 3) → KB enrichie. Premier impact conversion : Vague V4 (semaine 5) → suggestions visuelles.

## Risques majeurs

1. **Continuité conversationnelle canned → LLM** — mitigé par note système éphémère + guide éditorial strict.
2. **Drift KB ↔ DB produits** — mitigé par cron sync + alerte Sentry + dashboard de fraîcheur.
3. **Support tools hétérogène par provider** — mitigé par fallback RAG transparent et `CHAT_TOOL_ALLOWLIST`.

## Décision attendue

> **PO** : approuver la roadmap globale + ouvrir les 6 nouveaux tickets `CHA‑310` → `CHA‑315`.
> **Tech‑lead** : valider les 4 ADRs ([`01-architecture/adr/`](../01-architecture/adr/)).
> **Designer** : valider design tokens + wireframes ([`05-design-ui/`](../05-design-ui/)).
> **Date cible décision** : 2026‑05‑20.
