# Audit UX/UI/Design — Content Studio (FemiGlow)

**Date** : 2026-05-22
**Auteur** : agent (sur sollicitation de l'utilisateur)
**Périmètre** : module Content Studio (`/admin/content-studio` + sous-routes), dans `apps/web`
**Statut** : draft, à valider avant exécution du plan de solutions

## 0. Note méthodologique

L'audit s'appuie sur :
1. Lecture exhaustive du code des composants admin (`apps/web/src/components/admin/content-studio/*`), des routes API utilisées par l'UI, du modèle métier (`lib/content-studio/types.ts`), et de l'orchestrateur de page (`ContentStudioClient.tsx`).
2. Cartographie par sous-agent Explore (très thorough) — voir annexe A pour le résumé brut.
3. Historique git pour identifier la croissance organique (commits successifs ajoutant des panneaux sans refactor global).
4. **Limite** : pas de screenshots live (le `global.setup.ts` Playwright flake en local, blocage orthogonal au périmètre). L'analyse repose donc sur le code + le DOM résultant déduit du JSX. Recommandation : compléter l'audit par 5-10 screenshots côté staging via session admin manuelle, à joindre en annexe B.

Tous les pointeurs sont sous la forme `fichier:ligne` pour vérification directe.

## 1. Résumé exécutif

Le Content Studio est **techniquement fonctionnel** (chaîne idée → publication réelle livrée, observabilité S3 en place, deux pipelines convergent vers `social_publish_job` post S2.3 phase e). Côté UX en revanche, il porte les stigmates classiques de la **croissance organique** : un orchestrateur de 331 lignes avec 15 `useState`, un éditeur de 785 lignes qui imbrique trois sous-systèmes (génération IA, sélecteur média, panneau Postiz legacy), un calendrier en lecture-seule, et un dashboard administrateur **orphelin** (pas linké depuis le studio principal).

Les conséquences mesurables :
- **Charge cognitive élevée** : un débutant ne sait pas par où commencer (4 onglets sans hiérarchie, pas de stepper, le `StudioGuide` est replié par défaut).
- **Friction sur la tâche dominante** (créer + publier un post) : 1 écran unique stacké verticalement, 6 sections empilées, scroll obligatoire.
- **Gestion média sous-développée** : pas d'UI d'upload, pas de cropping, aspect 4:5 hardcodé, **zéro support vidéo** (alors que le type `StudioMediaItem.kind` autorise théoriquement `'video'`).
- **Bugs latents** : caption locale non resynchronisée lors d'un switch de draft (perte silencieuse de travail), états dupliqués (`scheduledAt` existe à 2 endroits).
- **Patterns datés** : `window.confirm()` pour publication, pas de skeleton loaders, messages auto-dismiss absents.

**Verdict synthétique** : le module est passé du prototype à la production sans refactor de l'IA (Information Architecture) ni du design system. Une refonte est justifiée et le ROI est élevé parce que le flux de création est la valeur produit centrale du module.

## 2. Cartographie de l'existant

### 2.1 Information architecture actuelle

```
/admin/content-studio                  ← StudioClient (4 onglets, pas de breadcrumb)
├── [Tab] Pipeline (défaut)
│   └── Grille 2-col XL : [IdeasPanel + IdeaForm + PostizPanel] | [DraftEditor + SocialPublishingPanel + UtmBuilder + LearningNoteForm]
├── [Tab] Calendrier  → EditorialCalendar + PostizHealthPanel (lazy)
├── [Tab] Analytics   → AnalyticsDashboard (lazy)
└── [Tab] Budget      → BudgetSummary (lazy)

/admin/content-studio/dashboard        ← Page séparée, AUCUN LIEN depuis StudioClient
                                          (orphan : seule URL directe la rend visible)
```

Constats :
- L'onglet **Pipeline** est l'écran principal mais empile 6 sections + 2 colonnes : c'est l'écran le plus complexe du module et c'est le défaut au load.
- L'onglet **Calendrier** est en lecture-seule (cliquer un post = retour à Pipeline avec le draft sélectionné). Aucun drag-and-drop, aucune création depuis le calendrier.
- L'onglet **Analytics** double partiellement le dashboard `/admin/content-studio/dashboard` (deux écrans différents pour des métriques proches, sans cohérence).
- L'onglet **Budget** est isolé : il ne devrait probablement pas être un onglet de niveau 1 mais une carte du dashboard.
- Le `StudioGuide` est un `<details>` replié par défaut (`StudioGuide.tsx:5`). Un nouveau collaborateur peut ne jamais le voir.

### 2.2 Cycle de vie métier (rappel)

Le modèle (`lib/content-studio/types.ts`) :
```
ContentIdea  → ContentBrief → ContentDraft (×N variantes)
                                  │ approve
                                  ▼
                             ContentPost ──── SocialPublishJob (×N comptes, ×N modes)
                                                    │
                                                    ▼
                                              SocialPublication
```

Sept entités côté UI (idée, brief, draft, post, asset, delivery legacy, publish job nouveau). L'utilisateur doit comprendre :
- Qu'un draft a un statut (`generated`, `needs_review`, `approved`, `scheduled`, `published`, `failed`, `rejected`, `cancelled`).
- Qu'un post hérite du statut du draft, mais aussi peut transiter via un job (`queued`, `publishing`, `published`, `failed`, `cancelled`).
- Qu'un draft Postiz crée *aussi* un publication "réussie" sans rien publier sur le réseau social.

Cette complexité est exposée brute dans l'UI : aucun glossaire, aucun affichage simplifié des statuts pour le métier.

### 2.3 Composants par taille (signaux de monolithe)

| Composant | Lignes | useState | Sous-composants imbriqués |
|---|---|---|---|
| `DraftEditor.tsx` | **785** | 8 | `VisualGenerator` (3 useState), `MediaPicker` (1 useState), `DeliveryPanel` legacy |
| `SocialPublishingPanel.tsx` | 446 | 6 | — |
| `EditorialCalendar.tsx` | 383 | 4 | `Metric` (atom) |
| `ContentStudioClient.tsx` | 331 | **15** | orchestre 12+ composants |
| `PostizHealthPanel.tsx` | 216 | ? | — |

> Heuristique : un composant > 300 lignes ou > 7 `useState` est candidat à un découpage. Ici 4 composants dépassent les seuils.

## 3. Audit par couche

### 3.1 Backend / données

**Forces** :
- Modèle solide post-S2.3 phase e (`social_publish_job` est la source de vérité unique, `publishMode: 'now'|'schedule'|'draft'`).
- Idempotence et state machine bien testés (258+ tests vitest sur le scope).
- Observabilité en place (audit events, alertes, dashboard ops).

**Faiblesses pour l'UI** :
1. **Pas de "view model" agrégé** : l'UI doit composer manuellement post + draft + brief + asset + deliveries + jobs (cf. `ContentStudioClient.tsx:71-78`). Chaque sélection de draft re-fetch le brief (`DraftEditor.tsx:79-93`). Pas de GraphQL ni de route REST qui retourne le "context complet d'un draft".
2. **Liste paginée idées seulement** : `nextIdeaOffset` (`ContentStudioClient.tsx:65`). Pas de pagination drafts/posts → si > 500 drafts, l'UI charge tout. Pas catastrophique aujourd'hui mais limite de scale.
3. **Pas d'évènement temps-réel** : aucun SSE/WebSocket pour les jobs en cours. L'UI doit "Rafraîchir" manuellement (`SocialPublishingPanel.tsx:218`).
4. **Pas de bulk operations** : approuver 5 drafts d'une campagne demande 5 clics individuels.

### 3.2 Frontend / architecture composants

**Faiblesses majeures** :
1. **`DraftEditor.tsx` est un monolithe** : 785 lignes, 3 sous-composants (`VisualGenerator`, `MediaPicker`, `DeliveryPanel`) **définis dans le même fichier**. Conséquences :
   - Tests difficiles (les sous-composants ne sont pas exportés).
   - Réutilisation impossible (impossible d'avoir un `MediaPicker` ailleurs).
   - Lecture difficile (scroll de 700 lignes pour comprendre le flux).
2. **Props drilling massif** dans `ContentStudioClient` (`ContentStudioClient.tsx:227-264`) — 11 props passés à `DraftEditor`, chaque sub-state remonté manuellement. Pas de Context, pas de reducer.
3. **Duplication d'état** :
   - `scheduledAt` existe dans `DraftEditor.DeliveryPanel` (`DraftEditor.tsx:648`) ET dans `SocialPublishingPanel` (`SocialPublishingPanel.tsx:66`). Deux états indépendants, deux UI distinctes.
   - `mediaId` est local au `DraftEditor` (l.71) mais l'asset sélectionné (`selectedAsset`) vient de `ContentStudioClient`. Bug latent (cf. §3.4 friction 3).
4. **`useState` dans l'orchestrateur** : 15 (`ContentStudioClient.tsx:53-69`). Quand l'utilisateur publie, 4-5 setters sont appelés en cascade (`setPosts`, `setDrafts`, `setDeliveries`, `setMediaItems`). Source de re-renders inutiles et de bugs de race.
5. **Aucune machine à états côté UI** : les transitions (idea→generating→generated, draft→approving→approved, post→publishing→published) sont implicites, gérées par des `disabled` booleans sur des boutons. Risque : double-clic = double action.

### 3.3 UI / design visuel

**Patterns présents** :
- Couleurs sectorielles (rose pour idées, sky pour drafts, emerald pour publishing, teal pour calendrier, violet pour visuels IA, amber pour médias). Ça crée un balisage chromatique cohérent.
- Tailwind, design system implicite (`stone-*` pour les neutres).
- Badges de statut (`DeliveryStatusBadge`, `StatusBadge` inline).

**Faiblesses** :
1. **Pas de système de tokens documenté** : les couleurs sectorielles sont en classes Tailwind éparpillées, pas centralisées. Risque de dérive (ex: certains badges utilisent `bg-emerald-100 text-emerald-800`, d'autres `bg-emerald-50/40 border-emerald-100 text-emerald-950`).
2. **Density élevée + hiérarchie visuelle faible** : 6 sections empilées dans `Pipeline`, chaque section a son propre `border + bg-tone-50/40 + p-4`. Pas de séparateur visuel fort, pas de "zone primaire" mise en avant.
3. **Typographie unique** : tout est en `font-sans` (Inter probable, via Next defaults). Pas de hiérarchie typographique distinctive — un titre H2 est juste `text-sm font-semibold`. Le `SectionTitle` introduit un "eyebrow" mais reste discret.
4. **Aucune iconographie cohérente** : pas d'icons (Lucide, Heroicons) côté admin. Tous les boutons sont texte. Cognitivement plus lent à scanner.
5. **Pas de mode sombre** ni de skin alternatif. Cohérent avec l'admin global mais limite l'identité du module.
6. **Pas d'animations** : tous les changements d'état (sélection draft, switch tab) sont instantanés. Pas de transitions douces. Sentiment "ancien" vs apps modernes (Buffer, Later, Linear).

### 3.4 UX / parcours utilisateur

**Friction #1 — Aucun stepper / fil d'Ariane.**
L'utilisateur arrive sur Pipeline. Quels sont les étapes du flux ? Le `StudioGuide` est replié (`StudioGuide.tsx:5`). Le draft sélectionné par défaut est `drafts[0]` (`ContentStudioClient.tsx:60`) sans indication de pourquoi celui-là. Aucun écran "onboarding" pour un nouvel admin.

**Friction #2 — La création d'une idée se fait dans le même écran que la révision.**
`IdeaForm` est dans la colonne gauche, le `DraftEditor` dans la droite. Quand on remplit l'idée, le DraftEditor de droite reste figé sur l'ancien draft. Ergonomiquement, créer une idée est une tâche distincte de réviser un draft — mais elles partagent l'écran.

**Friction #3 — Sélection média désynchronisée du state global.**
Quand l'utilisateur clique un media dans `MediaPicker` (`DraftEditor.tsx:587`), `setSelectedMediaId(media.id)` est appelé. Mais le warning "Associez un média avant Postiz" (`DraftEditor.tsx:345`) lit `selectedAsset && !mediaId` — qui pointe sur le `mediaId` local du DraftEditor (l.71), pas sur celui du MediaPicker. Deux états distincts qui devraient être un seul.

**Friction #4 — Caption non resynchronisée lors d'un switch de draft.**
`DraftEditor.tsx:70` : `const [caption, setCaption] = useState(selectedDraft?.caption ?? '');`. Pas de `useEffect` qui re-synchronise quand `selectedDraft.id` change. Si l'utilisateur édite la caption d'un draft, switche vers un autre draft puis revient, **la caption originale du draft sera ré-affichée** — la modification non sauvegardée est perdue silencieusement.

**Friction #5 — Publication via `window.confirm()`.**
`SocialPublishingPanel.tsx:205` : `if (window.confirm('Publier maintenant en dry-run depuis Femiglow ?'))`. Ce dialog natif :
- Bloque le thread JS, casse l'UX moderne.
- Pas stylable, pas a11y-conforme.
- Texte limité, pas d'aperçu de ce qui va partir.

**Friction #6 — Pas de feedback de progression pour les actions longues.**
Génération IA d'un visuel = ~10-20s via DALL-E. L'utilisateur a `isPending` qui désactive les boutons (`ContentStudioClient.tsx:69`) — c'est tout. Pas de skeleton, pas de progress bar, pas d'estimation de durée. L'utilisateur peut croire que l'app a planté.

**Friction #7 — Messages globaux non auto-dismiss.**
`ContentStudioClient.tsx:216-225` : `message` et `error` sont rendus en haut de la section droite. Pas de timer pour les masquer. Si l'utilisateur fait 3 actions, le message reste collé jusqu'au prochain `run()` qui le clear. Pollution visuelle.

**Friction #8 — Pas de raccourcis clavier.**
Aucun shortcut (Cmd+Enter pour générer, Cmd+S pour sauvegarder, j/k pour naviguer drafts). Le module est entièrement dépendant de la souris.

**Friction #9 — Calendrier en lecture-seule.**
`EditorialCalendar.tsx` permet de filtrer et naviguer (semaine/mois) mais **aucune action depuis le calendrier** : pas de drag-and-drop pour reprogrammer, pas de "+ Créer un post à cette date", pas de bulk-select. Le calendrier est une vue, pas un outil.

**Friction #10 — Dashboard orphelin.**
`/admin/content-studio/dashboard` (livré en S3.3) n'a **aucun lien depuis `/admin/content-studio`**. L'admin doit connaître l'URL. L'inverse existe (bouton "← Studio" sur le dashboard, `dashboard/page.tsx:37-42`). Asymétrie. Le dashboard d'analytics interne (onglet "Analytics") double partiellement les widgets sans cohérence.

**Friction #11 — Aucune indication de coût en temps réel.**
La génération IA consomme du budget (`CONTENT_STUDIO_DAILY_GENERATION_BUDGET_CENTS=500`). Le `BudgetSummary` est dans un onglet séparé. L'utilisateur ne voit pas avant de cliquer "Générer" combien il a déjà dépensé aujourd'hui ni combien il reste.

**Friction #12 — Pas de comparaison de variants.**
La génération produit 3 brouillons (variantes A/B/C). L'UI les liste verticalement dans la sidebar gauche du DraftEditor (`DraftEditor.tsx:113-260`) — pour comparer A et B, il faut alterner les clics. Pas de vue côte-à-côte.

### 3.5 Gestion média (image / vidéo)

C'est la **zone la plus sous-développée** du module, alors que l'utilisateur l'a identifiée comme priorité.

**État actuel** :
- `MediaPicker` (`DraftEditor.tsx:448-627`) : grid 3 colonnes, 2 compartments (Importés / Générés IA), recherche par slug/alt/caption.
- Pas d'upload UI : les médias arrivent par d'autres voies (médiathèque FemiGlow ailleurs, génération IA dans le studio).
- Pas de cropping ni édition.
- Aspect ratio **hardcodé à 4:5** (`PlatformPreview.tsx:23`, `aspect-[4/5]`). Un post carré 1:1 ou paysage 16:9 est rogné à l'affichage.
- **Pas de support vidéo** : `MediaPicker` rend uniquement des `<img>` (l.596). Le type `StudioMediaItem.kind` autorise `'video'` mais la rendition n'a pas de branche `<video>`.
- **Pas de preview multi-plateforme** : `PlatformPreview` (40 lignes) affiche un mockup IG. Pas de preview FB, pas de Story (9:16), pas de Reel, pas de carousel.
- **VisualGenerator** propose 3 sizes (1:1, 4:5, paysage) mais aucun lien avec le format réel du post (un Reel devrait imposer 9:16, par exemple).

**Conséquences** :
- Impossible d'uploader une nouvelle image depuis le Studio (il faut quitter pour la médiathèque FemiGlow).
- Impossible de préparer un Reel ou une Story.
- Impossible de prévisualiser sur le format réel cible (un Story rendu en 4:5 dans le studio sera décevant en production).

### 3.6 Calendrier / planning

**Présent** :
- `EditorialCalendar` (383 lignes) : modes semaine/mois, filtres plateforme/statut, navigation prev/next/today, badges de statut par item.
- Métriques en haut : approuvés / planifiés / sent.
- Click item → switch tab Pipeline + sélectionne le draft.

**Absent** :
- Aucune action depuis le calendrier (pas de "+", pas de drag).
- Aucun affichage des slots horaires (un post à 9h vs 14h vs 20h n'est pas distingué visuellement).
- Aucune recommandation de "best time to post".
- Pas d'overlay du contenu (juste un titre + statut), donc impossible de juger de l'équilibre éditorial (ex: 3 posts "rituel" en 2 jours).
- Pas de drag-and-drop pour reprogrammer.
- Pas de duplication ("clone ce post pour une autre date").
- Pas d'export iCal/Google Calendar.

### 3.7 Conception / modèle mental

**Problème central** : le modèle métier (7 entités) est exposé brut. Un nouveau collaborateur doit comprendre la différence entre :
- "Idée" (la file d'attente d'intentions)
- "Brief" (le cadrage généré)
- "Draft" (la variante texte + score)
- "Post" (l'enveloppe approuvée prête à publier)
- "Asset" (le binding média)
- "Delivery legacy" (l'ancien chemin Postiz draft)
- "Job" (la tentative de publication réelle)

→ **5 statuts différents** coexistent (statut idea, statut draft, statut post, statut delivery, statut job). Aucun glossaire dans l'UI.

**Vocabulaire mélangé** : "Brouillon" (draft Postiz, draft éditorial), "Publié" (post.status='published', job.status='published'), "Programmé" (post.status='scheduled', job.status='queued' avec scheduledAt). Le sens est contextuel mais le UI ne l'explicite pas.

**Modèle mental absent du flux** : il n'y a pas de "campagne → publication → résultat" tangible. L'utilisateur ne voit pas, depuis le post, combien il a coûté à générer, combien d'impressions il a fait, combien il en reste à publier dans la campagne.

### 3.8 a11y / mobile / dark mode

- **a11y** : OK partiel — `role="alert"` et `role="status"` présents, `aria-live="polite"`. Mais `window.confirm()` casse l'a11y, et plusieurs `<button>` sans label explicite (ex: navigation calendrier `←` `→`). Focus visible pas testé.
- **Mobile** : l'UI utilise `lg:grid-cols-[260px_1fr]` et `xl:grid-cols-[minmax(320px,420px)_1fr]` — sur tablet ou mobile, tout collapse en une seule colonne. La densité d'information rend le scroll très long. Aucune optimisation mobile spécifique.
- **Dark mode** : non implémenté.

## 4. Croisé : signaux de croissance organique

| Signal | Évidence |
|---|---|
| Monolithe `DraftEditor` (785L) | Le fichier accueille 3 sous-systèmes (VisualGenerator, MediaPicker, DeliveryPanel) au lieu d'être splitté |
| 15 `useState` dans `ContentStudioClient` | `ContentStudioClient.tsx:53-69` |
| Duplication `scheduledAt` | `DraftEditor.tsx:75` + `SocialPublishingPanel.tsx:66` |
| Duplication publication path | `DraftEditor.DeliveryPanel` (legacy) + `SocialPublishingPanel` (new) — coexistent même après S2.3 phase e |
| 4 onglets + 1 dashboard orphelin | `StudioTabs.tsx:5-10` + `/admin/content-studio/dashboard` |
| 2 entrées du `BudgetSummary` | Onglet "Budget" + carte dans dashboard |
| Flags ENV multiples | `CONTENT_STUDIO_ENABLED`, `CONTENT_STUDIO_LEGACY_POSTIZ_DISABLED`, `CONTENT_STUDIO_IMAGE_PROVIDER`, `CONTENT_STUDIO_TEXT_MODEL`, etc. — signe que des features ont été ajoutées sous feature flag puis jamais "promues" en valeur permanente |
| 2 systèmes de delivery (postiz-draft + draft-on-provider) | Migration en cours documentée dans `plan-s2.3-phase-e-draft-mode.md` |

## 5. Sévérité et priorisation

Échelle : **P0** bloquant ou perte de données, **P1** friction quotidienne majeure, **P2** friction occasionnelle, **P3** dette technique sans impact direct.

| # | Sujet | Sévérité | Impact si non corrigé |
|---|---|---|---|
| 1 | Caption perdue au switch de draft | **P0** | Perte silencieuse de travail rédactionnel |
| 2 | Aucun support vidéo / cropping / multi-format | **P0** | Impossible de produire Reels, Stories propres |
| 3 | Pas d'upload média depuis le Studio | **P0** | Workflow cassé : quitter studio pour ajouter une image |
| 4 | Monolithe DraftEditor + props drilling | **P1** | Maintenance coûteuse, tests difficiles, bugs latents |
| 5 | Pas de stepper / hiérarchie de tâches | **P1** | Onboarding lent, charge cognitive élevée |
| 6 | Calendrier en lecture-seule | **P1** | Frustration : "je vois mes posts mais ne peux rien y faire" |
| 7 | `window.confirm()` pour publication | **P1** | UX datée, casse l'a11y |
| 8 | Pas de comparaison de variants A/B/C | **P1** | Le multi-variant perd la moitié de sa valeur |
| 9 | Dashboard orphelin + Analytics dupliqué | **P2** | Confusion, métriques inconsistentes |
| 10 | Pas de feedback de progression IA | **P2** | Sentiment "ça plante" sur 10-20s |
| 11 | Messages globaux non auto-dismiss | **P2** | Pollution visuelle |
| 12 | Pas de raccourcis clavier | **P3** | Power users freinés |
| 13 | Pas de tokens design centralisés | **P3** | Dérive visuelle future |
| 14 | Mobile non optimisé | **P3** | Admin desktop-only (acceptable selon usage) |

## 6. Recommandation de cadrage pour la suite

L'audit indique trois axes à travailler en parallèle :

**Axe A — Mental model & IA (Information Architecture)**
Repenser la nav, les statuts exposés, le placement du dashboard, l'onboarding. Objectif : qu'un nouveau collaborateur publie un post sans aide en < 5 min.

**Axe B — Création de contenu (image / vidéo / preview)**
Refondre la gestion média : upload natif, cropping multi-format, support vidéo, preview fidèle par plateforme (post / story / reel / carousel). Objectif : couvrir 100% des formats Instagram + Facebook sans quitter le Studio.

**Axe C — Architecture composants & state**
Découper le monolithe DraftEditor, centraliser le state (Context ou Zustand), instaurer une machine d'états UI explicite. Objectif : code maintenable, bugs latents fermés, base prête pour les axes A et B.

L'**axe B** est explicitement la priorité produit (citée par l'utilisateur). Les axes A et C sont prérequis pour que B soit faisable proprement.

Le document de solutions `solutions-content-studio-ux-2026-05-22.md` traite chaque problème de §3 avec 3 options + analyse comparative + recommandation, et conclut par une proposition d'interface intégrée.

## Annexe A — Cartographie brute (extrait du sous-agent Explore)

> Voir conversation. Points clés :
> - 12 composants admin, 3 sous-composants imbriqués dans `DraftEditor`.
> - 4 onglets : Pipeline (défaut), Calendrier, Analytics, Budget.
> - Flow minimal pour publier : 1 écran, 6 étapes, 5-6 clics (sans visuel IA).
> - 10 frictions UX listées (voir §3.4 ici, version normalisée).

## Annexe B — Screenshots à joindre (TODO opérateur humain)

À capturer en session admin sur staging :
1. `/admin/content-studio` — onglet Pipeline avec ≥ 3 drafts visibles.
2. Idem, après click sur un draft : voir DraftEditor déplié.
3. `MediaPicker` ouvert avec compartment "Importés".
4. `MediaPicker` ouvert avec compartment "Générés IA".
5. `EditorialCalendar` mode semaine avec ≥ 5 posts répartis.
6. `EditorialCalendar` mode mois.
7. `SocialPublishingPanel` avec radio "Brouillon Postiz" cochée (note amber visible).
8. `/admin/content-studio/dashboard` — vue complète.
9. Comparaison d'écrans entre l'onglet "Analytics" et `/admin/content-studio/dashboard` (mise en évidence de la duplication).
10. Vue mobile (responsive 375px) — démonstration de la longueur du scroll.

## Annexe C — Fichiers cités

- `apps/web/src/app/admin/content-studio/page.tsx`
- `apps/web/src/app/admin/content-studio/dashboard/page.tsx`
- `apps/web/src/components/admin/content-studio/ContentStudioClient.tsx`
- `apps/web/src/components/admin/content-studio/DraftEditor.tsx`
- `apps/web/src/components/admin/content-studio/EditorialCalendar.tsx`
- `apps/web/src/components/admin/content-studio/SocialPublishingPanel.tsx`
- `apps/web/src/components/admin/content-studio/StudioTabs.tsx`
- `apps/web/src/components/admin/content-studio/StudioGuide.tsx`
- `apps/web/src/components/admin/content-studio/IdeaForm.tsx`
- `apps/web/src/components/admin/content-studio/PlatformPreview.tsx`
- `apps/web/src/lib/content-studio/types.ts`
- `apps/web/src/components/admin/content-studio/api.ts`
