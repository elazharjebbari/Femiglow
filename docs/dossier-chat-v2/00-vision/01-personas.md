# Personas & cas d'usage

> Trois personas utilisateurs (chat) + deux personas internes (admin). Construits sur la base du marché FemiGlow (cosmétique pour peau pelée post‑épilation, marché marocain principalement urbain) et de l'expérience admin existante.

---

## Personas utilisateurs

### P1 — Soukaina, 28 ans, Casablanca

> « Je veux comprendre si ça va marcher pour moi avant de payer. »

| Attribut | Valeur |
|---|---|
| Langue préférée | FR avec quelques mots darija |
| Device | Mobile iPhone, Safari, 4G |
| Moment | Soir 21 h‑23 h, scrolling Instagram |
| Sensibilité prix | Forte (199 dh est un seuil psychologique) |
| Sensibilité preuve sociale | Très forte (témoignages, avant/après) |
| Comportement chat | Pose 1 question puis observe la réponse ; relance si c'est concret |
| Intent dominant | `pricing`, `ingredient`, `social-proof`, puis `purchase-intent` |
| Frein principal | Doute sur l'efficacité, peur de l'arnaque |
| Levier conversion | Témoignage + composition transparente + livraison rapide |

**Parcours type (durée 3‑5 min)** :
1. Arrive sur `/kit` depuis Instagram.
2. Ouvre le chat → voit greeting + 3 pills.
3. Clique « Chhal taman ? » → reçoit prix + composition (canned).
4. Tape « ça marche en combien de temps ? » → LLM avec contexte RAG.
5. Clique « Voir les témoignages » (CTA inline canned) → page social proof.
6. Revient au chat, déclenche lead form (`purchase-intent`) → laisse téléphone.

### P2 — Hicham, 35 ans, Rabat, professionnel pressé

> « Si on peut me livrer rapidement et c'est sérieux, j'achète. »

| Attribut | Valeur |
|---|---|
| Langue préférée | FR pur |
| Device | Desktop, Chrome, fibre |
| Moment | Pause déjeuner 13 h |
| Sensibilité prix | Faible si valeur perçue claire |
| Sensibilité preuve sociale | Moyenne (préfère arguments factuels) |
| Comportement chat | Pose des questions précises, en mode transactionnel |
| Intent dominant | `shipping`, `order-status`, `purchase-intent` |
| Frein principal | Délai de livraison flou, manque de coordonnées humaines |
| Levier conversion | ETA précise + callback bouton + confirmation paiement |

**Parcours type (durée 90 s)** :
1. Vient via Google Ads sur `/kit`.
2. Ouvre le chat → tape « livraison Rabat en combien de temps ? »
3. FAQ gateway match → réponse canned avec ETA Rabat 24‑48 h.
4. Tape « ok je commande, comment ? » → LLM detect `purchase-intent` → lead form.
5. Laisse téléphone → callback dans l'heure (KPI Care).

### P3 — Naima, 42 ans, Tanger, achète pour sa fille

> « Je veux parler à quelqu'un pour comprendre. »

| Attribut | Valeur |
|---|---|
| Langue préférée | Darija parlée → écrite en script latin (« Chhal », « kifach ») |
| Device | Mobile Android entry‑level, Chrome, 3G |
| Moment | Matin 9 h, après les enfants à l'école |
| Sensibilité prix | Forte |
| Sensibilité preuve sociale | Très forte (avis de mères) |
| Comportement chat | Conversation longue, beaucoup de paraphrases, parfois faute de frappe |
| Intent dominant | `support`, `routine`, `ingredient`, `callback-request` |
| Frein principal | Peur de mal utiliser, méfiance internet |
| Levier conversion | Rappel humain + langue darija + témoignages mères |

**Parcours type (durée 6‑10 min)** :
1. Arrive sur `/` (homepage), navigue, ouvre le chat.
2. Greeting darija → « Marhba bik ! » → relâche tension.
3. Pose 4‑5 questions paraphrasées sur la routine.
4. Mix RAG + canned car beaucoup de variations.
5. Demande explicitement « bghit ntkellem m3a wahed mn 3ndkom » → `callback-request` → lead form.
6. Lead form en darija → conversion.

---

## Personas internes (admin)

### A1 — Yasmine, content & community manager, 26 ans

> « Je dois pouvoir éditer un wording en 2 minutes sans peur de tout casser. »

| Attribut | Valeur |
|---|---|
| Compétence tech | Faible (utilise Notion, Canva) |
| Tâches récurrentes | Édition greeting / suggestions / canned pairs ; revue conversations |
| Fréquence | 30 min/jour |
| Frustrations actuelles | Pas d'UI pour suggestions ; doit demander à un dev pour changer du texte |
| Attentes admin | Wizard guidé, preview live, validation copy multilingue assistée |
| Risque côté outil | Publier une faute → impact réputation immédiat |

**Workflows critiques** :
- Création paire canned en 6 étapes guidées (cf. wizard `05-design-ui/wireframes-admin.md`).
- Bouton « test dans le widget réel » (sandbox).
- Workflow `draft → review → published` avec validation PO.

### A2 — Karim, customer care lead, 33 ans

> « Je veux que les conversations IA m'arrivent quand le bot ne sait plus quoi faire — pas avant, pas après. »

| Attribut | Valeur |
|---|---|
| Compétence tech | Moyenne (CRM, dashboards) |
| Tâches récurrentes | Reprendre les conversations marquées `escalation`, traiter les leads |
| Fréquence | Continue (sa journée) |
| Frustrations actuelles | Trop de leads non qualifiés (out‑of‑knowledge faux positifs) |
| Attentes admin | Vue temps réel des conversations actives, filtres par intent / langue |
| Risque côté outil | Manquer un lead chaud > 30 min |

**Workflows critiques** :
- Tableau de bord live conversations avec filtres (`intent`, `language`, `unresolved`).
- Notification push si lead `purchase-intent` > 5 min sans suivi.
- Vue séquentielle conversation avec marqueurs (`canned`, `llm`, `tool`).

---

## Matrice persona × axe d'amélioration

| Persona | Axe 1 — Intent | Axe 2 — Knowledge | Axe 3 — Suggestions |
|---|---|---|---|
| **P1 Soukaina** | Détection `ingredient` + `social-proof` fine | RAG composition + témoignages | Suggestions ciblées « kit pour peau sensible » |
| **P2 Hicham** | Détection `shipping` + `order-status` rapide | Tool `get_delivery_info(Rabat)` | Suggestion « livraison à ma ville » |
| **P3 Naima** | Détection darija robuste, tolérance fautes | Canned darija + RAG FAQ | Greeting darija + pills darija |
| **A1 Yasmine** | — | UI dataset intent gérable | Wizard canned pair |
| **A2 Karim** | Intents `frustration` / `callback-request` fiables | Logs tool calls auditables | Vue conversations par type de réponse |

---

## Cas d'usage non couverts (anti‑scope)

- Pas d'agent vocal / téléphonique (IVR).
- Pas de chatbot pour les marketplaces B2B internationales (uniquement Maroc / Tunisie / Algérie demandé).
- Pas de gestion de comptes connectés côté chat (anonyme + lead capture suffisent).
- Pas de paiement intégré dans le chat (toujours redirection vers la page commande).
