# Métriques de succès

> Toute métrique listée ici doit être (1) **mesurable automatiquement**, (2) **liée à un événement** dans la taxonomie, (3) **adressable** par une action concrète. Pas de vanity metrics.

---

## Pyramide des métriques

```
                          ╱╲
                         ╱  ╲          Métriques business
                        ╱ N1 ╲         (CA, conversion, LTV)
                       ╱──────╲
                      ╱        ╲       Métriques produit
                     ╱   N2     ╲      (engagement, satisfaction)
                    ╱────────────╲
                   ╱              ╲    Métriques système
                  ╱      N3        ╲   (latence, coût, erreur)
                 ╱──────────────────╲
                ╱                    ╲ Métriques opérationnelles
               ╱         N4           ╲ (uptime, alertes, MTTR)
              ╱──────────────────────╲╱
```

---

## N1 — Métriques business

| Métrique | Définition | Baseline (est.) | Cible 90 j | Source |
|---|---|---|---|---|
| **Conversion chat → commande** | `count(orders attributed to chat) / count(sessions)` | 0.029 % | 0.30 % | DB `orders.attribution = 'chat'` |
| **CA généré par chat** | Somme des commandes attribuées | ~ baseline | × 10 | DB |
| **LTV des leads chat** | Valeur 12 mois des leads issus du chat | inconnu | mesuré | DB cohort |
| **Coût d'acquisition chat** | (coût LLM mensuel) / (commandes chat mensuel) | inconnu | ≤ 30 dh / commande | DB + budget LLM |

## N2 — Métriques produit (engagement & satisfaction)

| Métrique | Définition | Baseline | Cible 90 j | Source |
|---|---|---|---|---|
| **open_rate** | sessions ouvertes / visiteurs uniques | 12 % | 18 % | event `chat_opened` |
| **engagement_rate** | sessions avec ≥ 1 message / sessions ouvertes | 35 % | 60 % | event `message_sent_user` |
| **suggestion_click_rate** | sessions avec ≥ 1 pill cliquée / sessions ouvertes | n/a | 35 % | event `suggestion_clicked` |
| **useful_reply_rate** | réponses notées 👍 / réponses notées | ~75 % | ≥ 90 % | event `feedback_thumbs` |
| **strong_intent_rate** | sessions avec ≥ 1 intent dans {`purchase-intent`,`callback-request`,`b2b`} / sessions engagées | 8 % | 15 % | event `intent_detected` |
| **lead_capture_rate** | leads soumis / leads proposés | 45 % | 65 % | events `lead_offered` + `lead_completed` |
| **avg_msg_per_session** | messages utilisateur moyens par session engagée | 3.2 | 5.5 | DB `chat_message` |
| **drop_after_canned** | sessions qui partent après une canned / sessions avec canned | n/a | < 20 % | event séquence |

## N3 — Métriques système (qualité technique)

| Métrique | Définition | Baseline | Cible 90 j | Source |
|---|---|---|---|---|
| **intent_accuracy** | précision sur dataset annoté (n=500) | 73 % | 92 % | dataset offline + script eval |
| **intent_recall_purchase** | recall `purchase-intent` sur dataset | 80 % | 95 % | idem |
| **factual_accuracy** | audit manuel sur 100 réponses / mois | 65 % | 98 % | audit |
| **dontknow_rate** | réponses contenant « ne diffuse pas » | 30 % | < 3 % | regex sur `chat_message.content` role=assistant |
| **canned_share** | messages servis canned ou FAQ‑gateway / total | 0 % | 40 % | meta `replyType` |
| **tool_call_success** | tool calls 2xx / tool calls totaux | n/a | ≥ 99 % | log `chat_tool_call_log` |
| **p95_latency_first_token** | temps avant 1er token streamé | 1.2 s | ≤ 1.0 s | SSE timing |
| **p95_latency_complete** | temps total réponse | 3.0 s | ≤ 4.0 s | idem |
| **llm_cost_per_session** | coût LLM total / sessions | €X | −30 % | DB `chat_message.cost` |

## N4 — Métriques opérationnelles

| Métrique | Définition | Cible |
|---|---|---|
| **uptime SSE** | % de minutes sur 30 j avec streaming OK | ≥ 99.5 % |
| **uptime cron sync KB** | % de runs cron quotidiens réussis | ≥ 99 % |
| **MTTR incident chat** | temps moyen de résolution | ≤ 30 min |
| **alerts noise rate** | alertes faux positifs / alertes totales | ≤ 10 % |
| **time to publish canned edit** | éditeur clic publier → live en prod | ≤ 10 s |

---

## Indicateurs de garde‑fou (red flags)

Ces métriques **ne doivent jamais** dépasser un seuil, sinon kill‑switch automatique :

| Garde‑fou | Seuil | Action automatique |
|---|---|---|
| Provider error rate (par provider) | > 5 % sur 5 min | Bascule provider via breaker |
| Budget mensuel LLM | > 100 % de `CHAT_TOTAL_BUDGET_EUR_MONTHLY` | Mode dégradé : canned uniquement, LLM coupé |
| Charter filter outbound trigger | > 5 % des réponses | Alerte ops + revue prompt |
| Tool error rate (par tool) | > 10 % sur 1 h | Disable tool via allowlist + alerte |
| Embedding rate limit | > 80 % du quota provider | Throttle + alerte |
| Hallucination prix (audit) | > 1 / 100 | Investigate KB sync + alerte |

---

## Rituel de revue des métriques

| Cadence | Audience | Format | Décision attendue |
|---|---|---|---|
| Quotidien | Care lead (A2) | Dashboard live | Réagir aux leads chauds |
| Hebdomadaire | Tech‑lead + PO | Tableau N3 + N4 | Ajuster prompts, calibrer seuils |
| Bi‑mensuel | PO + Growth | Tableau N2 | Itérer sur canned pairs, suggestions |
| Mensuel | Direction | Tableau N1 | Décisions budget / roadmap |
| Trimestriel | Tous | Rapport complet + audit qualitatif 50 conversations | Réorientation |

---

## Anti‑métriques (à ignorer délibérément)

- ❌ Nombre total de messages (vanity)
- ❌ Durée moyenne de session (peut indiquer confusion)
- ❌ Mots prononcés par le bot (n'a aucun sens)
- ❌ Diversité du vocabulaire (n'aide pas la conversion)

---

## Lien vers la suite

- Événements détaillés : [`07-analytics/event-taxonomy.csv`](../07-analytics/event-taxonomy.csv)
- Dashboards : [`07-analytics/dashboards.md`](../07-analytics/dashboards.md)
- A/B testing : [`07-analytics/ab-testing.md`](../07-analytics/ab-testing.md)
