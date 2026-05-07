# 00 — Cahier des charges

> *Exigences fonctionnelles, non-fonctionnelles, KPIs, RGPD, scope*

---

## 1. Vision

Une **maison de soin se reconnaît à l'attention qu'elle porte à
ses initiées**. Le chat de la landing page n'est ni un argumentaire
publicitaire, ni un help desk anonyme : c'est **la voix de la
maison**, à l'écoute, qui répond, propose un rituel, oriente, parle
trois langues, ne brusque jamais.

Trois invariants président à toute décision :

1. **Discrétion choisie, présence garantie.** Le widget se devine
   plus qu'il ne s'impose. Mais quiconque le cherche le trouve en
   moins d'une seconde, sans cliquer sur trois menus.
2. **Une réponse, jamais une argumentation.** L'assistant n'est
   pas un commercial : il informe, propose, écoute. La conversion
   est une conséquence, jamais un objectif visible.
3. **Une maison, plusieurs langues.** Français, arabe classique,
   darija marocaine. Le visiteur n'a pas à demander : la maison
   sait reconnaître la langue du premier message et y répondre.

## 2. Périmètre fonctionnel

### 2.1 Côté visiteur

| Fonctionnalité                                     | Description                                                                                                          | Priorité |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------- |
| Widget persistant                                  | Visible sur toutes les pages publiques. Position bottom-right desktop, bottom-center mobile. Bouton flottant rond.   | P0       |
| Ouverture / fermeture animée                       | 240 ms ease-out. Le widget se déploie en panneau latéral (desktop) ou plein écran (mobile).                          | P0       |
| Salutation contextuelle                            | Premier message adapté à la page (`/`, `/kit`, `/journal`, `/panier`, `/commander`) et au moment de la journée.      | P0       |
| Détection automatique de langue                    | Sur le premier message ou via `navigator.language`. Bascule à chaud si le visiteur change.                           | P0       |
| Streaming des réponses                             | Affichage caractère par caractère, cadence variable, voyant « en train d'écrire » crédible.                          | P0       |
| Persistance de session                             | La conversation reprend là où le visiteur l'a laissée (cookie + serveur, 30 jours).                                  | P0       |
| Indicateur de lecture                              | Le visiteur sait que son message a été lu (« vu à 16:42 »).                                                          | P1       |
| Réactions / feedback                               | Pouce vert / rouge sur chaque réponse, ouverture optionnelle d'un champ texte.                                       | P1       |
| Pièces jointes                                     | Image (capture d'écran de panier, photo d'ongles) — Phase 2.                                                         | P2       |
| Voix (STT / TTS)                                   | Hors scope V1. À envisager Phase 3.                                                                                  | P3       |
| Suggestions rapides                                | Trois puces de réponses contextuelles sous la salutation, qui disparaissent dès que le visiteur écrit.               | P0       |
| Reprise par email                                  | Si le visiteur quitte avec une question en cours, la maison peut lui proposer (opt-in) une reprise par email.        | P2       |
| Mode lecture seule                                 | Si le quota provider est dépassé, message courtois et lien vers le formulaire de contact.                            | P1       |

### 2.2 Côté admin

| Fonctionnalité                                     | Description                                                                                                                          | Priorité |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| Édition de l'instruction système                   | Versionnée, immutable, diff visuel. Hot-reload côté serveur sans redéploiement.                                                      | P0       |
| Gestion des sources de connaissance                | URL, fichier (md, pdf, docx), FAQ structurée, snippet libre. Tagging, langue, fraîcheur.                                              | P0       |
| Configuration des providers                        | Ajouter / activer / prioriser OpenAI, Gemini, Anthropic, Qwen, DeepSeek, Ollama. Clés chiffrées. Fallback en cascade.                | P0       |
| Configuration des modèles                          | Par provider : modèle de chat, modèle d'embedding, température, top_p, max_tokens, timeout, coût/1k tokens.                          | P0       |
| Configuration du style                             | Couleurs, typographies (héritage charte par défaut), animations, position desktop/mobile, salutations par page.                      | P0       |
| KPIs d'engagement                                  | Ouvertures, conversations démarrées, messages échangés, durée moyenne, taux d'abandon, taux de réponse < 5 s.                        | P0       |
| KPIs de conversion                                 | Conversion attribuée au chat (cookie d'attribution 30 j), panier moyen, produits cités, types de questions convertissantes.          | P0       |
| Segmentation temporelle                            | Aujourd'hui, hier, 7 j, 30 j, 90 j, custom, tout.                                                                                    | P0       |
| Gestion des conversations                          | Liste, recherche plein texte, filtres (durée, conversion, langue, satisfaction), lecture intégrale, export JSON / CSV.               | P0       |
| Catégories automatiques                            | Court (< 3 messages), moyen (3-10), long (> 10), avec / sans conversion, satisfait / insatisfait, abandon précoce.                   | P1       |
| Modération                                         | Bannir IP / cookie, censurer un message, supprimer une conversation, réponse manuelle (override).                                    | P1       |
| Visualisation graphique du système                 | Schéma interactif des flux (entrée → modération → routing → RAG → génération → modération sortie → streaming).                       | P1       |
| Tests A/B                                          | Comparer deux instructions ou deux providers sur un échantillon de trafic.                                                           | P2       |
| Audit log                                          | Toute modification admin est tracée (acteur, action, diff, timestamp).                                                               | P0       |

## 3. Exigences non fonctionnelles

| Exigence              | Cible                                                                                                       | Mesure                                          |
| --------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Latence first-token   | < 1.2 s p50, < 2.5 s p95                                                                                    | Trace OpenTelemetry par message                 |
| Latence full-response | < 6 s p95 pour réponse moyenne (250 tokens)                                                                 | Trace OpenTelemetry                             |
| Disponibilité         | 99.5 % mensuel (hors fenêtre de maintenance annoncée)                                                       | Monitoring synthétique Vercel + healthcheck     |
| Fallback provider     | Bascule automatique vers provider secondaire en < 800 ms si erreur 5xx ou timeout > 4 s                     | Logs + alerte                                   |
| Performance widget    | TTI widget < 200 ms après hydratation page, JS shipping < 35 kB gzip                                        | Lighthouse + bundle analyzer                    |
| CLS                   | Le widget ne provoque jamais de CLS > 0.001 sur les pages publiques                                         | Lighthouse / Web Vitals RUM                     |
| Accessibilité         | WCAG 2.2 AA. Navigation clavier complète. Lecteur d'écran : annonces de nouveau message, focus management.  | axe-core + tests manuels NVDA / VoiceOver       |
| RTL                   | Bascule complète arabe : direction, alignement, ordre des bulles, animations symétriques                    | Test visuel manuel + Playwright snapshot RTL    |
| Sécurité              | Pas d'exécution de code utilisateur, pas de fuite de prompt système, modération obligatoire                 | Pentest interne + tests de prompt injection     |
| Coût                  | Budget par défaut < 0.05 € par conversation moyenne (provider Tier-2)                                       | Comptable interne par session                   |
| Maintenabilité        | Couplage provider via adapter, schémas Zod, pas de logique dans les composants, tests > 80 % services       | Audit code + couverture                         |
| Évolutivité           | Ajouter un provider en < 1 jour ; ajouter une langue en < 3 jours                                           | Documentation runbook + revue                   |

## 4. KPIs métiers

### 4.1 Engagement

| KPI                                | Définition                                                                                  | Cible (3 mois)        |
| ---------------------------------- | ------------------------------------------------------------------------------------------- | --------------------- |
| Taux d'ouverture                   | Sessions visiteurs ayant ouvert le widget / sessions visiteurs                              | ≥ 8 %                 |
| Taux d'engagement                  | Sessions ayant envoyé ≥ 1 message / sessions ayant ouvert le widget                         | ≥ 55 %                |
| Messages par conversation          | Médiane                                                                                     | ≥ 4                   |
| Durée moyenne de conversation      | Médiane (du premier message au dernier)                                                     | ≥ 90 s                |
| Taux de satisfaction               | Pouces verts / (verts + rouges) sur réponses ayant reçu un feedback                         | ≥ 80 %                |
| Taux d'abandon précoce             | Conversations < 1 message visiteur après salutation                                         | ≤ 30 %                |

### 4.2 Conversion

| KPI                                | Définition                                                                                                         | Cible (3 mois) |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------- |
| Taux de conversion chat            | Sessions ayant converti après ≥ 1 message / total sessions ayant chatté                                            | ≥ 6 %          |
| Lift de conversion                 | (conv. avec chat − conv. sans chat) / conv. sans chat sur cohorte comparable                                       | ≥ +25 %        |
| Panier moyen chat                  | Panier moyen des commandes attribuées au chat                                                                      | ≥ panier site  |
| Délai chat → conversion            | Médiane du temps entre dernier message et `purchase`                                                               | ≤ 24 h         |

### 4.3 Qualité

| KPI                                | Définition                                                                                  | Cible          |
| ---------------------------------- | ------------------------------------------------------------------------------------------- | -------------- |
| Taux de réponse hors-charte        | Réponses signalées par modération de sortie / total réponses                                | ≤ 0.5 %        |
| Taux d'hallucination détectée      | Audits manuels mensuels (échantillon 100)                                                   | ≤ 2 %          |
| Taux de bonne langue               | Réponses dans la langue attendue / total réponses                                           | ≥ 99 %         |
| Taux de réponse RAG                | Réponses citant ≥ 1 chunk de la base / total réponses substantielles                        | ≥ 70 %         |

## 5. Périmètre exclu (V1)

| Hors scope V1                         | Pourquoi                                                                              |
| ------------------------------------- | ------------------------------------------------------------------------------------- |
| Voix (STT / TTS)                      | Coût provider et complexité UX, repoussé Phase 3                                      |
| Co-browsing / partage d'écran         | Pas de besoin métier exprimé                                                          |
| Hand-off agent humain temps réel      | Pas d'équipe support 24/7. Reprise par email suffit en V1                             |
| Application mobile native             | Site responsive d'abord                                                               |
| Génération d'images                   | Hors périmètre maison de soin                                                         |
| Rendez-vous calendrier                | Maison sans réservation V1 ; le contact reste par formulaire                          |
| Paiement intégré dans le chat         | Tunnel de checkout reste la source de vérité commerciale                              |

## 6. Contraintes structurantes

- **Charte FemiGlow inviolable.** Tons sauge / crème / encre /
  pétale / ciel / champagne rare. Typographies Cormorant Garamond,
  Inter. Pas d'emoji, pas d'urgence, pas d'exclamations, pas de
  réductions. Le ton « maison » prévaut sur le ton « marque ».
- **Composants découplés.** Aucune logique métier dans les
  composants UI. Tout transite par des hooks et des stores. Les
  données sont injectées par props ou par fetcher SWR.
- **Schémas Zod portables.** Tous les payloads (entrée API, sortie,
  config admin) sont validés Zod. Les types TypeScript sont dérivés.
- **Adapter pattern.** Aucun appel direct à `openai` / `@google/genai` / etc. dans
  le code applicatif : tout passe par `lib/chat/providers/<name>.ts`
  qui implémente l'interface `ChatProvider`.
- **Streaming SSE same-origin.** Pas de WebSocket. Server-Sent
  Events via `/api/chat/message` pour rester compatible serverless
  Vercel et CDN.
- **Aucune dépendance UI tierce lourde.** Le widget est construit
  avec les primitives existantes (Tailwind, framer-motion, design
  tokens FemiGlow). Pas de `react-chat-widget`, `livechat`, etc.
- **LangChain.js comme couche d'orchestration.** Permet plus tard
  d'enrichir le pipeline (chains, agents, tools, mémoire avancée)
  sans réécrire.

## 7. Risques majeurs

| Risque                                                    | Sévérité | Mitigation                                                                                       |
| --------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------ |
| Hallucination sur des informations critiques (prix, COD)  | Élevée   | Champs critiques figés en post-prompt « ground truth » (cf. RAG `09`), refus si non disponible   |
| Prompt injection dans message visiteur                    | Élevée   | Sanitisation, isolation contexte, prompt système réinjecté à chaque tour, modération entrée      |
| Fuite de données personnelles (PII) vers provider externe | Élevée   | PII redaction côté serveur avant envoi provider, opt-in admin par provider                       |
| Drift visuel (chat ne ressemble plus à FemiGlow)          | Moyenne  | Tokens uniquement, presets versionnés, snapshot Storybook                                        |
| Coût provider explose (visiteur abusif)                   | Moyenne  | Rate-limit IP + session, cap mensuel par provider, dégradation gracieuse vers modèle moins cher  |
| Dégradation perf landing                                  | Moyenne  | Widget chargé en `next/dynamic` après idle, payload < 35 kB                                      |
| Mauvaise détection de darija                              | Moyenne  | Heuristique Maroc (lexique) + fallback explicite « tu préfères en français ou en darija ? »      |
| Surfacturation Vercel (SSE long)                          | Faible   | Timeout serveur 45 s strict, reprise client, idle close                                          |

## 8. Critères d'acceptation V1

L'implémentation est considérée comme livrable lorsque :

1. Le widget s'ouvre, se ferme, persiste sur toutes les pages
   publiques sans CLS visible.
2. Une conversation peut être menée du début à la fin en français,
   arabe classique et darija sans bug visible.
3. Un admin peut éditer l'instruction système et voir l'effet
   sur la conversation suivante (hot reload < 30 s).
4. Trois providers sont configurables et la bascule de l'un à
   l'autre se fait sans redéploiement.
5. Les KPIs sont calculés et exposés sur les fenêtres
   `aujourd'hui`, `hier`, `7j`, `30j`, `90j`, `custom`, `tout`.
6. La recherche plein texte sur les conversations retourne en
   < 1 s sur 10 000 conversations.
7. Les tests Playwright (parcours visiteur), Vitest (services,
   stores, hooks) et MSW (mocks providers) sont verts.
8. Lighthouse sur `/` reste ≥ 90 / 95 / 95 / 95 (perf, a11y, BP, SEO).
9. Un audit RGPD interne valide la PII redaction et le droit à l'oubli.
10. Le runbook permet à un nouveau membre de l'équipe d'ajouter
    un provider en < 1 jour sans assistance.

## 9. Lecture suivante

- [01 — Architecture](01-architecture.md) pour la vue d'ensemble
  et les flux temps réel.
- [05 — UI / UX & design](05-ui-ux-design.md) pour les choix de
  design (le « comment ça se voit »).
- [15 — Plan d'action](15-plan-action.md) pour la séquence
  d'exécution par ticket.
