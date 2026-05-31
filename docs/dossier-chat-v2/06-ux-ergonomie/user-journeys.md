# User journeys — 6 parcours bout-en-bout

> Chaque parcours décrit : contexte, étapes, points de friction, mesures, optimisations. Cible : conversion ↑, friction ↓.

## Journey 1 — Soukaina (P1), curieuse, mobile, darija

**Contexte** : Soukaina, 24 ans, Casablanca, arrive sur l'Instagram FemiGlow → click sur lien bio → home `/`. Elle scrolle. Pas d'intention d'achat immédiate.

| Étape | Action visiteur | Trigger | UI affichée | Émotion | KPI |
|---|---|---|---|---|---|
| 1 | Atterrit home | — | Hero produit | Curiosité | `page_view` |
| 2 | Scroll, lit témoignages | — | Témoignages carousel | Intérêt | `scroll_50pct` |
| 3 | Note le launcher avec pulse | 30s inactivity | Launcher pulse + badge "1" | Curiosité | `launcher_seen` |
| 4 | Tap launcher | — | Panel slide-up + greeting darija | Surprise positive (sa langue!) | `chat_opened` |
| 5 | Lit greeting + 3 pills | — | "Marhba ! 💎 Pack | 📦 Toussil | 💬 ara" | Confiance | `suggestions_shown` |
| 6 | Tap "💎 Pack" | — | Réponse canned local stream (1.2s display) | Plaisir cadence | `suggestion_clicked` |
| 7 | Lit "Pack 199dh au lieu de 390dh, livraison offerte dès 300dh" | — | Bulle canned + CTA inline "chouf Pack" | Intérêt fort | `canned_used` |
| 8 | Tape "Wach halal ?" | — | User bubble + typing dots | Vérification ★ | `message_sent` |
| 9 | Reçoit réponse LLM darija "Iyeh, 100% halal..." | — | Stream LLM + 1 source (page produit) | Confiance ↑ | `assistant_reply` |
| 10 | Continue "chhal d toussil l Casa ?" | — | typing dots + bulle | Intérêt forte | `message_sent` |
| 11 | LLM appelle `get_delivery_info(Casa)` → "24h, 30 dh" | — | Stream LLM + tool badge | Information acquise | `tool_call` |
| 12 | LeadForm offert "Soyez rappelée" | purchase-intent detected | Form inline accent.50 | Hésitation léger | `lead_form_offered` |
| 13 | Remplit nom + phone, soumet | — | Success animation | Satisfaction | `lead_submitted` |
| 14 | "Choukran ! Ghantaslo bik lyoma" | — | Confirmation message | Confiance scellée | — |
| 15 | Ferme chat, retourne page | — | Panel slide-down | Mission accomplie | `chat_closed` |

**Durée totale** : ~3 min 40s.
**Conversion atteinte** : Lead capturé.
**Points de friction observables** :
- Étape 9 : si LLM met >3s avant 1er token → abandon possible. Mitigation : typing dots immédiat.
- Étape 12 : si LeadForm offert TROP tôt (avant info satisfaisante) → spammy. Mitigation : seuil "2 questions répondues" avant offer.

## Journey 2 — Hicham (P2), B2B salon, desktop, FR

**Contexte** : Hicham, gérant salon esthétique Rabat, recherche fournisseur. Arrive via Google ads "grossiste cosmétique maroc".

| Étape | Action | Trigger | UI | Émotion | KPI |
|---|---|---|---|---|---|
| 1 | Lands `/b2b` page | Google ads | Hero B2B "Devenez partenaire" | Mode pro | `page_view` |
| 2 | Lit conditions, marges | — | Tableau gros remises | Intérêt commercial | `scroll_50pct` |
| 3 | Voit pills B2B "Tarifs gros | Catalogue | Devenir revendeur" | — | Pills B2B-only (audience=b2b) | Pertinence | `suggestions_shown` |
| 4 | Tap "Devenir revendeur" | — | Canned : "Pour devenir partenaire FemiGlow, voici..." + CTA "Soyez rappelé" | Décision facilitée | `canned_used` |
| 5 | LeadForm B2B avec champ "Type établissement" | reason: b2b | Form étendu (nom, prénom, phone, email, ville, type) | Sérieux apprécié | `lead_form_offered` |
| 6 | Remplit, soumet | — | "Merci ! Notre équipe B2B vous recontacte sous 24h" | Confiance pro | `lead_submitted` |
| 7 | (24h plus tard) Email automatique récap | n8n workflow | — | Suivi | `lead_followup_email` |

**Durée totale** : ~2 min 15s.
**Conversion** : Lead B2B HOT.

## Journey 3 — Naima (P3), confuse, mobile, darija

**Contexte** : Naima, 28 ans, Tanger, a commandé hier, attend sa commande. Pas de SMS de tracking. Frustrée.

| Étape | Action | Trigger | UI | Émotion | KPI |
|---|---|---|---|---|---|
| 1 | Lands `/` via Google "femiglow tracking" | — | Home | Agacement | `page_view` |
| 2 | Cherche menu "Mon compte" / "Suivi" — pas trouvé | — | Nav scroll | Agacement ↑ | — |
| 3 | Tap launcher (badge "1" pulse) | 8s inactivity | Panel + greeting | Espoir | `chat_opened` |
| 4 | Tape "fin commandti ?" | — | User bubble + typing | Inquiétude | `message_sent` |
| 5 | Intent : `order-status` (V7 — actuellement V5 : pas de tool) | — | Réponse canned "Le suivi sera disponible bientôt. Pour le moment, contactez-nous." + CTA "Soyez rappelée" | Frustration légère | `canned_used` (V5) |
| 6 | LeadForm offert (callback-request) | — | Form simplifié (nom, phone, raison "suivi commande") | Acceptation pragmatique | `lead_form_offered` |
| 7 | Soumet | — | "Choukran ! Ghantaslo bik chwiya" | Soulagement | `lead_submitted` |
| 8 | (10 min plus tard) Care l'appelle, donne tracking | — | — | Confiance restaurée | — |

**Évolution V7** : étape 5 devient appel `get_order_status` → tracking inline → Naima n'a pas besoin d'être rappelée. Lead évité, frustration zéro.

## Journey 4 — Visiteur curieux qui change de langue mid-chat

**Contexte** : Yasmine arrive en FR par défaut, mais préfère darija pour parler de produits "comme à la maison".

| Étape | Action | Trigger | UI | KPI |
|---|---|---|---|---|
| 1 | Greeting FR par défaut | — | "Bonjour ! Comment puis-je vous aider ?" | `chat_opened` |
| 2 | Tape "wach kayn une crème pour peau grasse ?" | — | LLM détecte AR-MA via mots-clés ("wach", "pour"), répond en mix FR/darija | `message_sent` |
| 3 | LLM répond en darija pure pour matcher | — | "Iyeh, kayn la crème jour, b'al-Niacinamide..." | `language_adapted` |
| 4 | User confirme ressenti naturel | — | Continue darija | satisfaction |

**Note** : Le `language` de la session est mis à jour automatiquement si le LLM détecte un switch durable (≥ 2 messages consécutifs dans nouvelle langue).

## Journey 5 — Erreur provider mid-stream

**Contexte** : LLM OpenAI tombe en panne au milieu d'une réponse. Service level passe 0→1 (failover Anthropic) puis 1→3 (canned only) en moins de 2 minutes.

| Étape | Côté serveur | Côté visiteur | UX choice |
|---|---|---|---|
| 1 | Stream OpenAI démarre | Voir delta apparaitre | — |
| 2 | OpenAI 502 mid-stream | Stream tronqué net | — |
| 3 | breaker open OpenAI → fallback Anthropic | (rien) | — |
| 4 | Anthropic démarre un nouveau stream | Toast top "Notre assistant a eu une difficulté, nouvelle réponse en cours" + nouvelle bulle assistant | Transparence légère, pas de panic |
| 5 | Anthropic répond OK | Stream se termine normalement | — |
| 6 | (Quelques minutes plus tard) Anthropic aussi en panne → sl=3 | Toast "Réponses pré-écrites" | Information honnête sans détails techniques |
| 7 | Composer reste actif mais redirige vers canned | Si user tape une question → canned match si possible, sinon "Notre assistant rencontre une difficulté…" + lead form | Service degradé mais conversion préservée |

## Journey 6 — Admin Yasmine, mise à jour rapide d'une suggestion canned

**Contexte** : Yasmine, content manager, doit corriger une typo dans la pill "Pack 199dh" et ajouter une suggestion seasonal "Soldes -20%".

| Étape | Action admin | UI | Temps cumulé |
|---|---|---|---|
| 1 | Login dashboard admin | iron-session | 0s |
| 2 | Navigate `/dashboard/chat-v2/suggestions` | Tableau filtrable | 12s |
| 3 | Tap row "kit-price-question" | Drawer right ouvre avec preview | 15s |
| 4 | Onglet FR active, scroll au label | Champ label éditable | 18s |
| 5 | Corrige typo | Inline edit avec auto-save banner | 25s |
| 6 | Tap "Soumettre review" | Toast bottom-right "Soumis pour review" | 28s |
| 7 | Navigate "[ + Nouvelle suggestion ]" | Wizard 3 étapes (Meta, Contenu, CTA) | 35s |
| 8 | Wizard step 1 : key + audience + pages | Validation inline | 45s |
| 9 | Wizard step 2 : labels + body trilingues (templates pre-fills) | Onglets FR/AR/AR-MA | 80s |
| 10 | Wizard step 3 : CTA + preview live | Preview side-by-side | 95s |
| 11 | Sauvegarder draft | Toast "Brouillon sauvegardé" | 100s |
| 12 | Demander review à un collègue | Lien partagé URL filtre `?status=review&assignee=karim` | 105s |

**Temps total** : ~1 min 45s pour 2 modifs distinctes.
**Conformité cible** : édition + publish < 90 s — ici un peu plus parce que création nouvelle entrée trilingue.

## Modèle d'optimisation — Heuristique "Friction Score"

Pour chaque parcours, on calcule un **Friction Score** (FS) :

```
FS = Σ (étapes × poids)
poids :
  - Étape critique conversion : 1.0
  - Étape de saisie : 0.5
  - Étape de lecture passive : 0.2
  - Étape de décision : 0.8
  - Étape d'erreur / retry : 2.0
```

Objectif : Journey 1 FS ≤ 8.
Journey actuel calculé : 7.4 ✅
Mitigation principale : réduire l'étape 9 (latence LLM) → typing dots immédiat + first token < 800 ms.

## Heatmaps & enregistrements

Outils : Microsoft Clarity (gratuit, RGPD-OK) ou Hotjar (payant).
- Heatmap pills home (% click par pill).
- Heatmap composer focus rate.
- Session replay anonymisé sur abandon mid-chat.

Cible : tous les éléments conversion-critical (★ dans wireframes) ont un click rate mesuré.

## Rituels UX (cadence)

- **Hebdo** : revue 5 sessions chat random + 5 sessions abandon (Naima style).
- **Mensuel** : refresh Friction Score sur top 3 journeys.
- **Trimestriel** : test utilisateur live (5 visiteurs) — 1h, gratitude offerte (kit produit).
