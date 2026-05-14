# Wireframes — Admin manager (chat-v2 dashboard)

> Ergonomie maximale pour les opérateurs (content, care, PO). Navigation latérale + breadcrumbs + actions inline. Tous les écrans sont desktop-first (PO travaillent depuis laptop).

## Architecture de navigation

```
Sidebar (fixed-left, 240px)
├─ 📊 Vue d'ensemble       /dashboard/chat-v2
├─ 💬 Conversations         /dashboard/chat-v2/conversations
├─ 🎯 Intents               /dashboard/chat-v2/intents
├─ ✨ Suggestions canned    /dashboard/chat-v2/suggestions
├─ ❓ FAQ entries           /dashboard/chat-v2/faq
├─ 🔧 Tools                 /dashboard/chat-v2/tools
├─ 📚 Knowledge base        /dashboard/chat-v2/knowledge
├─ 👥 Leads                 /dashboard/chat-v2/leads
├─ 📈 Analytics             /dashboard/chat-v2/analytics
├─ 🏥 Health & service      /dashboard/chat-v2/health
├─ 🔐 RGPD                  /dashboard/chat-v2/gdpr
└─ ⚙ Settings               /dashboard/chat-v2/settings
```

## 1. Vue d'ensemble (overview)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ☰  FemiGlow Admin > Chat v2                          Yasmine ▼  [☀]      │
├──────────┬──────────────────────────────────────────────────────────────────┤
│ 📊 Vue    │  Vue d'ensemble — 30 derniers jours          [ 7j ▼ ]   [ ⟳ ]  │
│ 💬 Convs  │                                                                  │
│ 🎯 Intents│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────┐│
│ ✨ Suggs  │  │ Conversations│ │ Réponses    │ │ Conversion  │ │ Coût mois  ││
│ ❓ FAQ    │  │   1,247     │ │   8,521     │ │   3.2%      │ │  142 USD   ││
│ 🔧 Tools  │  │ +18% sem.   │ │ +12% sem.   │ │ ★ +0.8 pts  │ │ 47% budget ││
│ 📚 KB     │  └─────────────┘ └─────────────┘ └─────────────┘ └────────────┘│
│ 👥 Leads  │                                                                  │
│ 📈 Anal.  │  ┌─────────────────────────────────┐  ┌────────────────────────┐│
│ 🏥 Health │  │ Service level historique 7j     │  │ Top 5 intents          ││
│ 🔐 RGPD   │  │  ▁▂▂▁▁▂▃▂▁                       │  │ pricing       412 ◼◼◼◼││
│ ⚙ Set.    │  │  ●  Nominal (94%)               │  │ shipping      287 ◼◼◼ ││
│           │  │  ●  Failover (4%)               │  │ purchase      156 ◼◼  ││
│           │  │  ●  Canned (2%)                 │  │ social-proof  121 ◼   ││
│           │  └─────────────────────────────────┘  │ misc           87 ◼   ││
│           │                                       └────────────────────────┘│
│           │  ┌─────────────────────────────────┐  ┌────────────────────────┐│
│           │  │ Derniers leads                  │  │ Alertes actives        ││
│           │  │ • Hicham, Rabat  — il y a 12m  │  │ ⚠ FAQ obsolète (24h+)  ││
│           │  │ • Soukaina, Casa — il y a 24m  │  │ ⚠ Provider Mistral 3% ││
│           │  │ • Naima, Tanger  — il y a 1h   │  │   error rate           ││
│           │  │ [ Voir tous → ]                 │  │ ⓘ Budget à 47% (mois) ││
│           │  └─────────────────────────────────┘  └────────────────────────┘│
└──────────┴──────────────────────────────────────────────────────────────────┘
```

## 2. Conversations — Liste

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Conversations                          [ + Nouveau filtre ] [ Export CSV ]│
├─────────────────────────────────────────────────────────────────────────────┤
│ Filtres : [Intent ▼] [Langue ▼] [Resolved ▼] [Date ▼]    Search [_______]🔍│
├─────────────────────────────────────────────────────────────────────────────┤
│ ▼ Date     │ Intent       │ Lang   │ Messages │ Resolved │ Latency │ Action │
├────────────┼──────────────┼────────┼──────────┼──────────┼─────────┼────────┤
│ 13/05 14:23│ pricing      │ ar-MA  │   6      │ ✓        │ 1.8 s   │ [👁]   │
│ 13/05 13:42│ purchase     │ fr     │   8      │ ✓ Lead   │ 2.1 s   │ [👁]   │
│ 13/05 12:11│ frustration  │ fr     │   4      │ ⚠ Manual│ 3.4 s   │ [👁]   │
│ 13/05 11:55│ shipping     │ ar     │   2      │ ✓ Tool  │ 0.9 s   │ [👁]   │
│ 13/05 10:30│ misc         │ fr     │  12      │ ✗       │ 2.7 s   │ [👁]   │
│ ...                                                                          │
│                                                                              │
│ Pagination : ◀ 1 2 3 ... 49 ▶              Affichage : 50 par page          │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 3. Conversation — Détail

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ◀ Retour   Conversation #c7f3...4a82          [ Anonymiser ] [ Export ]   │
├─────────────────────────────────────────────────────────────────────────────┤
│ Visitor: ◯ Anonyme  Audience: b2c  Langue: ar-MA  Démarrée: 13/05 14:18    │
│ Intent principal: pricing (87%)  Provider: openai (1× failover)            │
│ Service level: 0 nominal                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [14:18:02] Visitor → "Salam, chhal kaykell pack ?"                         │
│     Intent: greeting (confidence 0.92, source: regex)                       │
│                                                                              │
│  [14:18:03] Assistant → "Marhba bik ! Pack FemiGlow b 199 dh hada..."      │
│     Source: faq (entry-key: kit-price), Latency: 89 ms                     │
│     👍 (rating: +1)                                                         │
│                                                                              │
│  [14:19:11] Visitor → "OK ana brit nchri, kifach n3mel ?"                  │
│     Intent: purchase-intent (confidence 0.81, source: embedding)            │
│                                                                              │
│  [14:19:12] Assistant (stream OpenAI) → "Mzyan ! Bach tchri..."            │
│     Provider: openai gpt-4o-mini                                            │
│     Tools: get_product(pack-femiglow)=OK, get_delivery_info(Casa)=OK       │
│     RAG: 2 chunks (page produit + FAQ livraison)                            │
│     Latency: 1.8 s (first token 612 ms)                                     │
│     Cost: $0.0014                                                           │
│                                                                              │
│  [14:19:43] LeadForm offered (reason: purchase-intent)                      │
│                                                                              │
│  [14:20:02] Lead submitted → "Soukaina, +212 6 12 34 56 78, Casablanca"   │
│     Webhook n8n: SUCCESS (2 retries)                                        │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  [ Marquer comme escalation ]  [ Convertir tour en FAQ ]  [ ⓘ Debug full ]  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 4. Intents — Catalogue

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Intents                                              [ + Nouvel intent ]  │
├─────────────────────────────────────────────────────────────────────────────┤
│ ▼ Nom              │ Exemples │ Confiance moy. │ Volume 30j │ Actions       │
├────────────────────┼──────────┼────────────────┼────────────┼───────────────┤
│ pricing            │  42      │ 0.87           │ 412        │ [✎] [📊]      │
│ purchase-intent    │  31      │ 0.79           │ 156        │ [✎] [📊]      │
│ objection-price    │  28      │ 0.82           │ 89         │ [✎] [📊]      │
│ shipping           │  35      │ 0.85           │ 287        │ [✎] [📊]      │
│ social-proof       │  19      │ 0.74           │ 121        │ [✎] [📊]      │
│ ...                                                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  [ ⟳ Recomputer centroïdes ]  Dernière recompute : 13/05 02:00 UTC          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Détail d'un intent

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ◀ Intents > pricing                                  [ Supprimer intent ]  │
├─────────────────────────────────────────────────────────────────────────────┤
│  Description : "Question sur le prix du Pack ou d'un produit"               │
│                                                                              │
│  Exemples FR (14) :                                                          │
│  ┌──────────────────────────────────────────────────────────────┐          │
│  │ • "C'est combien le pack ?"                       [✎] [×]   │          │
│  │ • "Combien coûte ?"                               [✎] [×]   │          │
│  │ • "Quel est le prix ?"                            [✎] [×]   │          │
│  │ • ...                                                          │          │
│  └──────────────────────────────────────────────────────────────┘          │
│  [ + Ajouter exemple FR ]                                                    │
│                                                                              │
│  Exemples AR (13), Exemples AR-MA (15) — sections identiques                │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────┐          │
│  │ Statistiques 30j                                              │          │
│  │                                                                │          │
│  │  Volume: 412 (+12% sem.)                                      │          │
│  │  Confiance moy.: 0.87                                         │          │
│  │  False negatives: 4% (à inspecter)                            │          │
│  │  Source détection : regex 42% | embedding 51% | llm-mini 7%   │          │
│  └──────────────────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 5. Suggestions canned — Éditeur

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ◀ Suggestions > Édition : "kit-price-question"                              │
│                                                  Status: ● review    [ ⟳ ]  │
├─────────────────────────────────────────────────────────────────────────────┤
│  Métadonnées                                                                 │
│  Key:      kit-price-question                                                │
│  Audience: ( ◯ ) all  ( ● ) b2c  ( ◯ ) b2b                                  │
│  Pages:    /kit, /kit/*, /                                                   │
│  Ordre:    1 (le plus haut affiché en premier)                              │
│  Activé:   [ ✓ ]                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  Contenu                                                                     │
│  ─── Onglets : [ FR active ] [ AR ] [ AR-MA ] ─────                         │
│                                                                              │
│  Label pill (≤ 30 char):                                                     │
│  < 💎 Voir le Pack                                              >          │
│                                                                              │
│  Réponse scriptée (markdown OK):                                             │
│  ┌────────────────────────────────────────────────────────────┐            │
│  │ Le **Pack FemiGlow** est à **199 dh** au lieu de 390 dh.   │            │
│  │ Livraison offerte dès 300 dh.                              │            │
│  │                                                              │            │
│  │ Il contient 4 produits :                                    │            │
│  │ - Sérum éclat                                               │            │
│  │ - Crème jour                                                │            │
│  │ - Crème nuit                                                │            │
│  │ - Masque hebdomadaire                                       │            │
│  └────────────────────────────────────────────────────────────┘            │
│                                                                              │
│  Aperçu en chat : [ Ouvrir aperçu live ▶ ]                                  │
│                                                                              │
│  CTA (optionnel)                                                             │
│  Label: < Voir le Pack                                          >          │
│  URL:   < /kit                                                  >          │
│  [ ✓ ] Autoriser LLM follow-up après cette réponse                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  Historique versions                                                         │
│  v3 (current draft) — 13/05 14:23 par Yasmine                              │
│  v2 (published)     — 10/05 09:15 par Karim                                 │
│  v1 (archived)      — 02/05 11:30 par Yasmine                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  [ Annuler ]  [ Sauvegarder brouillon ]  [ → Soumettre review ]  [ Publier ]│
└─────────────────────────────────────────────────────────────────────────────┘
```

## 6. FAQ entries — Liste

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FAQ entries                          [ + Nouvelle entrée ]  [ Import CSV ] │
├─────────────────────────────────────────────────────────────────────────────┤
│ ▼ Question                       │ Langue │ Intent     │ Score moy │ Actions│
├──────────────────────────────────┼────────┼────────────┼───────────┼────────┤
│ Quel est le prix du pack ?       │ fr     │ pricing    │ 0.91      │ [✎]    │
│ Halal ?                          │ fr     │ ingredient │ 0.88      │ [✎]    │
│ Wach halal ?                     │ ar-MA  │ ingredient │ 0.86      │ [✎]    │
│ هل المنتج حلال ؟                  │ ar     │ ingredient │ 0.83      │ [✎]    │
│ Livraison Casablanca combien ?   │ fr     │ shipping   │ 0.89      │ [✎]    │
│ ...                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 7. Tools — Sandbox

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Tools — Statistiques 24h                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ ▼ Tool             │ Appels │ Success │ Avg lat │ Cache hit │ Last error  │
├────────────────────┼────────┼─────────┼─────────┼───────────┼─────────────┤
│ get_product        │ 412    │ 99.8%   │ 142 ms  │ 67%       │ —           │
│ get_delivery_info  │ 287    │ 100%    │ 89 ms   │ 81%       │ —           │
│ search_faq         │ 156    │ 98.1%   │ 312 ms  │ —         │ Timeout x3  │
│ check_promo        │ 0      │ —       │ —       │ —         │ DISABLED V7 │
│ get_order_status   │ 0      │ —       │ —       │ —         │ DISABLED V7 │
├─────────────────────────────────────────────────────────────────────────────┤
│  [ ▶ Sandbox test ]                                                          │
│                                                                              │
│  Tool: [ get_product ▼ ]                                                     │
│  Input JSON:                                                                 │
│  ┌────────────────────────────────────────────────────────────┐            │
│  │ {                                                            │            │
│  │   "slug": "pack-femiglow"                                   │            │
│  │ }                                                            │            │
│  └────────────────────────────────────────────────────────────┘            │
│                                                                              │
│  [ ▶ Exécuter ]                                                              │
│                                                                              │
│  Résultat :                                                                  │
│  ┌────────────────────────────────────────────────────────────┐            │
│  │ ✓ Success (142 ms, cache miss)                              │            │
│  │ {                                                            │            │
│  │   "found": true,                                            │            │
│  │   "slug": "pack-femiglow",                                  │            │
│  │   "nameFr": "Pack FemiGlow",                                │            │
│  │   "priceMad": 199,                                          │            │
│  │   "anchorMad": 390,                                         │            │
│  │   ...                                                       │            │
│  │ }                                                            │            │
│  └────────────────────────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 8. Leads — Inbox

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Leads — 47 cette semaine, 12 non contactés     [Filtres] [Export] [+ Manuel]│
├─────────────────────────────────────────────────────────────────────────────┤
│ Statut : [ Non contacté (12) ] [ Contacté (24) ] [ Converti (8) ] [ Hot (3)]│
├─────────────────────────────────────────────────────────────────────────────┤
│ ▼ Date       │ Nom        │ Phone           │ Ville   │ Source       │ Tag  │
├──────────────┼────────────┼─────────────────┼─────────┼──────────────┼──────┤
│ 13/05 14:20  │ Soukaina   │ +212 6 12 34 56 │ Casa    │ purchase-int │ HOT  │
│ 13/05 13:50  │ Hicham     │ +212 6 87 65 43 │ Rabat   │ b2b          │      │
│ 13/05 12:11  │ (anonyme)  │ +212 6 55 44 33 │ Tanger  │ frustration  │ HOT  │
│ ...                                                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ Soukaina, +212 6 12 34 56 — Casa                                            │
│ Conversation associée : #c7f3...4a82  [ Voir → ]                            │
│ Webhook n8n : ✓ envoyé 14:20:03                                             │
│ Notes internes : (vide) [ ✎ ]                                                │
│ [ Marquer contactée ] [ Marquer convertie ] [ RGPD: anonymiser ]            │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 9. Health & Service Level

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Health & Service                                  Auto-refresh: ON [⟲]    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Service level actuel :  ●  0 - Nominal                                     │
│                                                                              │
│  Providers status                                                            │
│  ┌──────────────────────────────────────────────────────────────────┐      │
│  │ OpenAI         ● UP    (success: 99.8%, avg lat: 612 ms)        │      │
│  │ Anthropic      ● UP    (success: 99.5%, avg lat: 891 ms)        │      │
│  │ Mistral        ⚠ DEGRADED (success: 97.0%, avg lat: 1.2 s)     │      │
│  │ Gemini         ● UP    (success: 100%, avg lat: 423 ms)         │      │
│  └──────────────────────────────────────────────────────────────────┘      │
│                                                                              │
│  Budget mensuel : 142 USD / 300 USD  (47%)                                  │
│  ▒▒▒▒▒▒▒▒▒▒░░░░░░░░░░░░ (graph)                                            │
│                                                                              │
│  Historique service level (24h)                                              │
│  ──● 12:30 sl 0→1 (OpenAI 502 x4)                                          │
│  ──● 12:32 sl 1→0 (OpenAI recovered)                                       │
│                                                                              │
│  [ Reset service level manuel ▼ ]                                            │
│  [ Kill switch : SL=3 forcé ]   ⚠ Use with caution                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 10. Knowledge base — Sources

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Knowledge base                  Last sync : 13/05 02:00 UTC  [ ⟳ Sync now ]│
├─────────────────────────────────────────────────────────────────────────────┤
│ ▼ Source                       │ Type      │ Chunks │ Last update │ Status  │
├────────────────────────────────┼───────────┼────────┼─────────────┼─────────┤
│ Produit pack-femiglow (fr)     │ snippet   │ 4      │ 12/05 14:00 │ ● Fresh │
│ Produit pack-femiglow (ar)     │ snippet   │ 4      │ 12/05 14:00 │ ● Fresh │
│ Produit pack-femiglow (ar-MA)  │ snippet   │ 4      │ 12/05 14:00 │ ● Fresh │
│ Ville Casablanca (fr)          │ snippet   │ 1      │ 12/05 14:00 │ ● Fresh │
│ Politique RGPD                 │ document  │ 12     │ 28/03 10:00 │ ⚠ Stale │
│ ...                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Patterns d'ergonomie admin

1. **Inline edit** : tout label/short text doit être éditable inline (click → input).
2. **Action buttons à droite** des lignes (consistance).
3. **Filtres persistés** dans l'URL (`?intent=pricing&lang=fr`) pour partage de vue.
4. **Confirmation dialogs** uniquement pour actions destructives (delete, RGPD forget).
5. **Toast bottom-right** pour confirmations non-destructives (save, publish).
6. **Breadcrumbs** sur tous les écrans nested.
7. **Loading skeleton** dans les tables (jamais de blank screen).
8. **Empty states explicites** avec CTA d'action ("Aucune entrée FAQ — [+ Créer la première]").
