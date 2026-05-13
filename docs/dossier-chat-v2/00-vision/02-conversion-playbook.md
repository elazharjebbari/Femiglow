# Conversion playbook — Comment ce chat fait monter le CR

> Le chat n'est pas un outil de support. C'est un **commercial silencieux**. Chaque décision design est lue par cette lentille.

---

## Modèle mental : Funnel chat

```
Visiteur sur page produit
        │
        │  P0 : ouvre-t-il le chat ?              ────►  KPI : open_rate
        ▼
Chat ouvert (premier écran)
        │
        │  P1 : interagit-il (pill OU tape) ?     ────►  KPI : engagement_rate
        ▼
Premier message envoyé
        │
        │  P2 : reçoit-il une réponse pertinente ? ───►  KPI : useful_reply_rate
        ▼
Conversation engagée
        │
        │  P3 : exprime-t-il une intention forte ? ───►  KPI : strong_intent_rate
        ▼
Lead form proposé
        │
        │  P4 : remplit-il le formulaire ?         ───►  KPI : lead_capture_rate
        ▼
Lead capturé
        │
        │  P5 : passe-t-il commande ?              ───►  KPI : lead_to_order_rate
        ▼
Commande
```

| Étape | Baseline estimée | Cible v2 | Levier principal |
|---|---|---|---|
| P0 open_rate | 12 % | 18 % | Launcher animation + greeting page‑spécifique |
| P1 engagement_rate | 35 % | 60 % | **Suggestions visuelles + greeting contextuel** |
| P2 useful_reply_rate | 70 % | 95 % | **Tools + RAG enrichi** |
| P3 strong_intent_rate | 8 % | 15 % | Intent cascade précise + canned pairs orientés conversion |
| P4 lead_capture_rate | 45 % | 65 % | Form pré‑rempli + auto‑capture phone CHA‑225 + microcopy |
| P5 lead_to_order_rate | 22 % | 30 % | Care callback < 1 h + tool `get_order_status` |

**Lecture business** : passer de 12 % × 35 % × 70 % × 8 % × 45 % × 22 % = **0.029 %** de conversion globale (commande / visite) à 18 % × 60 % × 95 % × 15 % × 65 % × 30 % = **0.3 %** = **× 10**.

---

## 12 patterns de conversion intégrés

### 1. **Greeting contextuel** (P0 → P1)
Si visiteur sur `/kit` : « Bonjour ! Vous êtes sur le Pack FemiGlow. Vous voulez en savoir plus ? »
Si visiteur sur `/`  : « Bienvenue ! Comment puis‑je vous aider ? »
→ Signal d'attention personnel, baisse l'abandon de 3‑5 pts.

### 2. **Pills incitatives orientées question payante** (P1 → P2)
Mauvais : « Plus d'infos »
Bon : « **Quel est le prix exact ?** »
Pourquoi : la pill doit représenter une **micro‑décision** déjà prise. Ce n'est pas un menu, c'est un script.

### 3. **Streaming local** (P2)
Même les réponses canned sont streamées progressivement (jitter 30‑50 ms). Le cerveau lit « ça réfléchit pour moi » → empathie.

### 4. **CTA inline dans canned** (P2 → P3)
Chaque canned se termine par soit (a) une question relance (« Voulez‑vous comparer avec X ? »), soit (b) un lien CTA (« Voir composition complète »).
Jamais de cul‑de‑sac.

### 5. **Tool transparency** (P2)
Quand `get_product` est appelé, on **affiche** la source : « Selon notre catalogue à jour, le Pack FemiGlow est à 199 dh… ». Signal de confiance.

### 6. **Social proof contextuel** (P3)
À la 2e ou 3e réponse, le LLM est invité (system prompt) à mentionner un témoignage **si l'intent est `objection-doubt` ou `social-proof`**. Exemple : « Hanane de Marrakech a écrit ‘j'ai vu un changement en 2 semaines’ ».

### 7. **Urgence douce** (P3)
Pas de fake urgency. Mais on intègre des faits réels :
- « Notre prix promo de 199 dh est valable ce mois‑ci »
- « Il reste 12 packs en stock à Casablanca » (si tool `get_stock` retourne < 20).

### 8. **Lead form micro** (P4)
3 champs max : prénom, téléphone, ville (auto‑complete delivery_cities). Email optionnel. Pas de RGPD lourde dans l'UI ; lien `politique` discret.

### 9. **Auto‑capture phone in‑chat** (P4)
CHA‑225 : si l'utilisateur écrit « voici mon 06… » dans le chat libre, on extrait + auto‑renseigne le form. Friction = 0.

### 10. **Confirmation chaleureuse post‑lead** (P4 → P5)
« Merci Soukaina ! Notre équipe vous rappelle d'ici 1 h sur le 06 XX XX XX XX. Vous voulez en attendant voir nos témoignages ? »
→ Pont vers contenu, garde le client engagé.

### 11. **Callback time SLA visible** (P5)
La promesse `< 1 h` est dans le confirmation message ET dans le mail de notification. Si dépassement, alerte ops.

### 12. **Suivi commande en libre‑service** (post‑P5)
Une fois la commande passée, l'utilisateur peut revenir et demander « où est ma commande ? ». Le tool `get_order_status(orderNumber, email)` répond. Ferme la boucle de satisfaction → bouche‑à‑oreille.

---

## Trade‑offs sensibles

| Tension | Notre choix | Justification |
|---|---|---|
| Conversion vs honnêteté | Pas de fake scarcity, pas de timer factices | Marque féminine de confiance ; le pari c'est la rétention long‑terme |
| Canned vs LLM | Canned uniquement sur questions fréquentes & factuelles | LLM garde la richesse conversationnelle |
| Tools vs hallucination | Tools obligatoires sur prix, stock, livraison, suivi | Erreur factuelle = perte de confiance immédiate |
| Multilingue vs effort | FR / AR / AR‑MA dès le jour 1 | Marché marocain = 40 % darija écrite |
| Lead form long vs court | Court (3 champs) | Friction tue plus que ROI marketing additionnel |
| Personnalisation vs vie privée | Pas de profiling persistant inter‑sessions | RGPD ; cookie `fg_v` (visiteur) éphémère 30 j |

---

## Anti‑patterns explicitement bannis

- ❌ Pop‑up agressif « VEUILLEZ NE PAS PARTIR »
- ❌ Bot qui se fait passer pour humain (« Hi, je suis Sarah ! »)
- ❌ Dark pattern lead form (champ pré‑coché consent newsletter)
- ❌ Réponses qui finissent en cul‑de‑sac (« voilà ! »)
- ❌ Streaming saccadé qui fait croire à un bug
- ❌ Suggestions identiques sur toutes les pages
- ❌ Témoignages inventés

---

## Mesure de l'impact conversion (synthèse)

Voir [`07-analytics/kpi-tree.md`](../07-analytics/kpi-tree.md) pour le détail.

| KPI | Baseline | T+30 j | T+90 j |
|---|---|---|---|
| Tx clic suggestion à l'ouverture | 0 % | ≥ 25 % | ≥ 35 % |
| Coût LLM moyen / session | €X | −15 % | −30 % |
| Tx réponses « ne diffuse pas » | ~30 % | ≤ 10 % | ≤ 3 % |
| Précision factuelle (audit) | 65 % | 90 % | 98 % |
| Lead capture rate (P4) | 45 % | 55 % | 65 % |
| Lead → order rate (P5) | 22 % | 26 % | 30 % |
| Conversion globale | 0.029 % | 0.1 % | 0.3 % |
