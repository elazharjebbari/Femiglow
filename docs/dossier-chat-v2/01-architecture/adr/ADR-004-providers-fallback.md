# ADR‑004 — Stratégie multi‑provider LLM avec breaker et fallback gracieux

| Champ | Valeur |
|---|---|
| **Statut** | accepted (renforce l'existant) |
| **Date** | 2026‑05‑13 |
| **Décideurs** | tech‑lead, ops |
| **Ticket** | (extension de l'existant, pas de nouveau ticket) |
| **Remplace** | rien — formalise et durcit |

## Contexte

L'app intègre déjà 6 providers LLM via LangChain ([`apps/web/package.json:40-46`](../../../apps/web/package.json)) et un `providerRouter` avec circuit breaker (3 fails / 30 s cooldown). Mais :
- Le **support function calling** est hétérogène par provider (cf. [`tech-stack.yaml`](../tech-stack.yaml)).
- Aucune **politique formelle** n'est documentée pour : quel provider en priorité, quand basculer, quoi désactiver si tools indisponibles.
- La **résilience budget** n'est pas codifiée : que se passe‑t‑il si le budget mensuel est dépassé ?

Pour v2 (hybrid retriever + tools), ces points deviennent critiques.

## Décision

Formaliser **5 niveaux de dégradation** :

```
   Niveau 0 — NOMINAL
   ───────────────────────────────────────────────
   Provider primary = CHAT_DEFAULT_PROVIDER (openai)
   Tools activés selon CHAT_TOOL_ALLOWLIST
   RAG normal + FAQ gateway + canned

   ▼ (provider primary KO 3× en 30 s)

   Niveau 1 — FAILOVER PROVIDER
   ───────────────────────────────────────────────
   Bascule sur secondary (anthropic) via breaker
   Vérifier support tools du secondary
   Si secondary ne supporte pas tools → niveau 2

   ▼ (provider secondary KO ou tools non supportés)

   Niveau 2 — RAG ONLY
   ───────────────────────────────────────────────
   Tools désactivés
   LLM continue, RAG fallback systématique sur intents catalog
   Si user demande prix → réponse canned « voir page kit »
   Bandeau admin discret « mode dégradé »

   ▼ (tous providers KO OU budget mensuel > 100 %)

   Niveau 3 — CANNED ONLY
   ───────────────────────────────────────────────
   LLM totalement coupé
   Seuls canned pairs + FAQ gateway répondent
   Sinon message standard « Notre assistant
   est momentanément indisponible, laissez vos
   coordonnées et nous vous rappelons sous 2 h »
   Auto-déclenche lead form CHA-225

   ▼ (panne complète Postgres / app)

   Niveau 4 — STATIC
   ───────────────────────────────────────────────
   Widget affiche message statique sans backend
   Lien WhatsApp / téléphone direct
```

### Règles de transition

| De | Vers | Trigger | Auto/Manuel |
|---|---|---|---|
| 0 → 1 | Breaker open primary | Auto |
| 1 → 0 | Breaker half‑open + 3 succès | Auto (cooldown 60 s) |
| 1 → 2 | Secondary aussi KO OU tool support absent | Auto |
| 2 → 3 | Tous providers KO OU `budget.spent > budget.cap` | Auto |
| 3 → 0 | Reset manuel via `/api/admin/chat/health/reset` + budget OK | Manuel |
| * → 4 | DB indisponible | Auto (côté infra) |

### Allowlist tools par provider (matrice)

| Tool | OpenAI | Anthropic | Mistral | Gemini | Ollama | Qwen | DeepSeek | Zhipu |
|---|---|---|---|---|---|---|---|---|
| `get_product` | ✅ | ✅ | ✅ | ✅ | ⚠️* | ⚠️* | ❌ | ❌ |
| `get_delivery_info` | ✅ | ✅ | ✅ | ✅ | ⚠️* | ⚠️* | ❌ | ❌ |
| `search_faq` | ✅ | ✅ | ✅ | ✅ | ⚠️* | ⚠️* | ❌ | ❌ |
| `check_promo` | ✅ | ✅ | ✅ | ⚠️ | ❌ | ❌ | ❌ | ❌ |
| `get_order_status` | ✅ | ✅ | ✅ | ⚠️ | ❌ | ❌ | ❌ | ❌ |

\* Selon modèle (Qwen 2.5 7B+ supporte le function calling de manière fiable, < 7B non).

Si provider sélectionné ne supporte pas un tool de la requête → l'orchestrator **désactive le tool** pour cette requête (l'envoie pas dans `tools[]`) et augmente le RAG (top_K +2).

## Alternatives considérées

### Alt A — « Provider unique »
- ✅ Simple
- ❌ Aucune résilience
- ❌ Coût élevé si provider unique cher

### Alt B — « Fallback chain illimitée »
- ✅ Maximum de redondance
- ❌ Couts qualité (les providers low‑end retournent moins bien)
- ❌ Difficile à debugger

### Alt C — « 5 niveaux de dégradation adoptés »
- ✅ Politique claire et auditable
- ✅ Mode `canned only` permet de **continuer à convertir** même budget dépassé
- ✅ Préserve l'expérience user en niveau 3 (réponses scripted + lead form)
- ⚠️ Plus de logique d'état à maintenir

## Conséquences

### Positives
- Uptime perçu ≥ 99.5 % même en cas de panne provider (niveau 2/3 servent quand même).
- Budget garde‑fou actif : impossible de dépasser le cap mensuel.
- Mode `canned only` transforme une panne en **opportunité de capture de lead** (au lieu d'une erreur 500).

### Négatives
- Nouvelle responsabilité ops : surveiller le niveau actif et alerter sur transitions.
- Plus de cas à tester (5 niveaux × 7 providers).

### Neutres
- Le breaker existant reste, juste enrichi.

## Implémentation

Étendre `apps/web/src/lib/chat/providers/router.ts` avec :
- `getServiceLevel(): 0 | 1 | 2 | 3 | 4`
- `shouldDisableTools(provider, level): boolean`
- Event `chat_service_level_changed` émis à chaque transition.

Étendre admin :
- Page `/admin/chat/health` qui affiche le niveau actif + historique des transitions + bouton reset.

## Métriques de succès

- Uptime perçu ≥ 99.5 % / 30 j
- MTTR transition automatique ≤ 60 s
- Aucune session ne tombe en erreur 500 (niveau 3/4 sert quand même)
- Taux de leads en mode `canned only` reste ≥ 80 % du baseline

## Notes

- Mode canned only est **explicitement marketing‑safe** : le user voit un message courtois, pas une erreur technique. Important pour la marque.
- Le bandeau admin « mode dégradé » est interne uniquement, jamais visible côté user.
