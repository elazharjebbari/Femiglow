# Solutions UX/UI — Content Studio (FemiGlow)

**Date** : 2026-05-22
**Auteur** : agent
**Document parent** : `audit-content-studio-ux-2026-05-22.md`
**Statut** : draft, à valider avant exécution

## 0. Comment lire ce document

Ce document **n'est pas un plan d'exécution**. C'est un document de cadrage : pour chacun des problèmes identifiés dans l'audit, il propose 3 solutions distinctes (A/B/C), les compare selon des critères explicites (effort, gain UX, risque, dépendances), et conclut par une recommandation argumentée. Une dernière section synthétise les recommandations en une **proposition d'interface intégrée**.

Le plan d'exécution détaillé (étapes, commits, tests, runbook) sera produit en aval, après ta validation de la proposition finale.

**Critères de comparaison utilisés** :
- **Effort** : S (≤ 0.5j), M (1-2j), L (3-5j), XL (> 5j)
- **Gain UX** : faible / moyen / élevé / transformatif
- **Risque** : faible / moyen / élevé (régression, dette technique, complexité)
- **Réversibilité** : trivial / coût-modéré / engageant
- **Dépendances** : liste des autres décisions/solutions requises

---

## SECTION 1 — Problèmes critiques (P0)

### Problème 1.1 — Caption perdue au switch de draft (perte silencieuse de travail)

**Symptôme** : `DraftEditor.tsx:70` initialise `caption` depuis `selectedDraft.caption` mais aucun `useEffect` ne resynchronise quand `selectedDraft.id` change. Switch entre drafts → perte des modifications non sauvegardées.

#### Solution A — Resync explicite avec `useEffect` + warning navigation
Ajouter `useEffect(() => setCaption(selectedDraft.caption), [selectedDraft.id])`, et un `beforeunload`/dialog "Vous avez des modifications non sauvegardées" avant tout switch de draft.

- Effort : **S** (15 lignes de code)
- Gain UX : faible (corrige le bug mais ne change rien à la nature destructive)
- Risque : faible
- Réversibilité : trivial
- Dépendances : aucune

**Critique** : Solution minimale qui sauve les meubles. Mais le dialog "voulez-vous vraiment partir" est connu pour être ignoré.

#### Solution B — Autosave silencieux (debounced 1.5s) côté serveur
À chaque modification de caption, debounce 1.5s puis `PATCH /drafts/:id` automatique. Indicateur "Enregistré il y a 3s" en discret.

- Effort : **M** (gestion conflits + indicateur UI + tests)
- Gain UX : élevé (zéro perte de travail, ergonomie type Notion/Google Docs)
- Risque : moyen (race conditions si édition simultanée, conflits de version)
- Réversibilité : coût-modéré (rollback nécessite de désactiver l'autosave + restaurer le bouton "Sauvegarder")
- Dépendances : ajout d'un champ `version: number` sur `ContentDraft` pour optimistic locking

**Critique** : Pattern moderne, attendu par les utilisateurs en 2026. Le coût-bénéfice est très bon. Le seul risque sérieux est multi-éditeur (1 admin actuellement, donc faible).

#### Solution C — État caption élevé au niveau orchestrateur + dirty tracking explicite
Sortir `caption` du `DraftEditor` vers `ContentStudioClient` (ou un store Zustand). Quand l'utilisateur switch de draft avec des changements pending, on affiche un dialog modal "Sauvegarder, ignorer, annuler" (pattern Linear, Figma).

- Effort : **M** (refacto + dialog modal accessible)
- Gain UX : élevé (contrôle explicite, pas de magie)
- Risque : faible
- Réversibilité : coût-modéré
- Dépendances : refonte du state management (cf. Problème 5)

**Critique** : Approche transparente. Mais ajoute une friction (le dialog) à chaque switch même quand pas nécessaire.

#### Analyse comparative

| Critère | A | B | C |
|---|---|---|---|
| Corrige le bug | ✓ | ✓ | ✓ |
| Zéro perte | partielle | ✓ | ✓ |
| Effort | S | M | M |
| Modernité | faible | élevée | élevée |
| Couple avec state mgmt | non | non | oui |

#### Recommandation : **Solution B (autosave)** + petit ingrédient de A

Autosave debounced 1.5s avec indicateur visuel ("Enregistré · il y a 3s"). On garde l'optimistic locking via `version` pour résister à un futur cas multi-éditeur. Le pattern est attendu, le coût est raisonnable, et il ferme la classe entière des bugs "j'ai perdu ce que j'avais écrit". On garde le bouton "Sauvegarder" visible pour rassurer les utilisateurs habitués à un workflow explicite (mais il devient redondant en pratique).

---

### Problème 1.2 — Pas de support vidéo, ni cropping, ni multi-format

**Symptôme** : `MediaPicker` ne rend que des `<img>`, l'aspect est hardcodé 4:5, aucun cropping intégré, aucune preview Reel/Story. L'utilisateur ne peut pas produire de Reels (9:16) ni de Stories dans le Studio.

#### Solution A — Multi-format passif (preview adapté au format choisi)
Ajouter une branche `<video>` dans `MediaPicker`, lire `media.kind === 'video'` et afficher en `<video controls muted loop>`. Le `PlatformPreview` reçoit le format du draft (`post|story|reel|carousel`) et change son aspect (`aspect-[4/5]` → `aspect-[9/16]` pour Story/Reel, `aspect-[1/1]` pour post carré). Aucun cropping : on assume que le média uploadé est déjà au bon ratio.

- Effort : **M** (~2j : rendu vidéo + matrice de previews)
- Gain UX : moyen (visualisation correcte mais le user doit toujours préparer ses médias en externe)
- Risque : faible
- Réversibilité : trivial
- Dépendances : aucune

**Critique** : Améliore visiblement la preview, mais ne résout pas la friction principale (ne peut toujours pas uploader/croper depuis le Studio).

#### Solution B — Upload + cropping in-app via composant tiers (react-easy-crop ou Cropper.js)
Ajouter un bouton "Importer un média" dans `MediaPicker` qui ouvre un dialog : upload file (drag-and-drop ou file picker) → preview → composant de cropping avec ratios prédéfinis (1:1, 4:5, 9:16, 16:9, libre) → submit → POST `/api/admin/media/upload` (existante) avec le crop appliqué côté serveur (sharp) → media disponible dans le compartment "Importés".
Pour la vidéo : upload + preview + trimming (start/end seconds, simple slider, pas de découpe frame-perfect). Côté serveur, ffmpeg pour le trim.

- Effort : **L** (~4-5j : front composant cropping + back endpoint d'upload chunkée + ffmpeg pour vidéo + tests)
- Gain UX : transformatif (workflow self-contained)
- Risque : moyen (lib cropping a une courbe d'apprentissage, ffmpeg en prod nécessite installation)
- Réversibilité : coût-modéré (la lib + endpoint restent même si l'UI évolue)
- Dépendances : sharp (déjà présent), ffmpeg (à installer côté serveur)

**Critique** : Le bon ROI. C'est ce que font Buffer, Later, Hootsuite. Le user reste dans le Studio pour tout le cycle.

#### Solution C — Editor visuel complet (style Canva embedded)
Intégrer un editor visuel : layers (image + texte + stickers + filtres), templates pré-définis FemiGlow, export multi-format direct. Plusieurs options techniques : `@fabricjs/fabric` côté front, ou intégration d'une lib commerciale (Shotstack, Cloudinary Media Editor).

- Effort : **XL** (> 2 semaines, voire 1 mois si templates + assets brand)
- Gain UX : transformatif PLUS branding maximal
- Risque : élevé (complexité énorme, lib commerciale = coût récurrent, propriété données)
- Réversibilité : engageant (architecture lourde difficile à rollback)
- Dépendances : decision business (build vs buy)

**Critique** : Sur-engineered pour le besoin actuel (1-2 admins). Pertinent si le module est ouvert à un usage multi-tenant ou si la stratégie produit positionne FemiGlow comme outil créatif. Sinon trop d'investissement.

#### Analyse comparative

| Critère | A | B | C |
|---|---|---|---|
| Couvre la prio "media très bien géré" | partiellement | ✓ | ✓✓ |
| Couvre vidéo | preview only | upload + trim | full edit |
| Cropping multi-format | non | ✓ | ✓ |
| Effort | M | L | XL |
| Sortie du Studio nécessaire | oui | non | non |
| Risque | faible | moyen | élevé |

#### Recommandation : **Solution B**, livraison en deux temps

**Temps 1 (image)** : upload + cropping multi-format avec `react-easy-crop` + endpoint serveur côté sharp. Couverture immédiate des formats post/story/reel. ~3j.
**Temps 2 (vidéo)** : upload vidéo + trim (slider start/end) côté ffmpeg. Activé sous flag `CONTENT_STUDIO_VIDEO_UPLOAD_ENABLED` jusqu'à validation prod. ~2j.

Solution C reste un option futur (S5 long-terme) si le besoin produit grandit. Solution A est sous-dimensionnée pour la priorité stated.

---

### Problème 1.3 — Pas d'upload média depuis le Studio (workflow cassé)

Couvert par la **Solution B du problème 1.2** ci-dessus.

---

## SECTION 2 — Problèmes majeurs (P1)

### Problème 2.1 — Monolithe DraftEditor (785L) + props drilling massif

**Symptôme** : Un composant de 785 lignes avec 3 sous-systèmes imbriqués, 8 `useState`, et 11 props passés depuis l'orchestrateur.

#### Solution A — Découpage en 3 fichiers (extract VisualGenerator, MediaPicker, DeliveryPanel)
Sortir chaque sous-composant dans son propre fichier. Garder les `useState` au niveau du `DraftEditor` parent et passer les props. Aucun changement de comportement.

- Effort : **S** (mécanique : extract files, ajouter imports)
- Gain UX : nul (refacto pur)
- Risque : faible (pas de logique modifiée)
- Réversibilité : trivial
- Dépendances : aucune

**Critique** : Mince. Le code reste mal architecturé : on passe juste de "1 fichier illisible" à "4 fichiers couplés par props".

#### Solution B — Context provider + custom hooks par feature
Créer `ContentStudioContext` (`useContentStudio()`) qui expose ideas/drafts/posts/jobs + setters + actions. Découper en hooks métier : `useDraft(draftId)`, `useDraftMedia(draftId)`, `usePublishing(postId)`. Chaque sous-composant consomme le hook dont il a besoin, plus de props.

- Effort : **M** (refacto + tests des hooks)
- Gain UX : nul direct, mais débloque tout le reste (autosave, état global, optimistic updates)
- Risque : faible-moyen (refacto large, mais Context est natif React)
- Réversibilité : coût-modéré
- Dépendances : ouvert par cette solution (autosave problème 1.1 facilité)

**Critique** : La bonne dose d'abstraction. Pas d'over-engineering, pas de lib externe.

#### Solution C — Migration vers un store dédié (Zustand / Jotai)
Mêmes objectifs que B, mais via un store extérieur à React. Avantages : devtools, time-travel debugging, selectors granulaires (re-renders ciblés). Inconvénient : nouvelle dépendance, courbe d'apprentissage pour les contributeurs.

- Effort : **M** (similaire à B, mais avec lib)
- Gain UX : nul direct
- Risque : moyen (lib externe, dette si l'écosystème change)
- Réversibilité : engageant (migrer hors d'un store est coûteux)
- Dépendances : install Zustand

**Critique** : Bon outil pour de larges apps. Pour 1 module admin avec 1-2 utilisateurs simultanés, c'est un peu sur-dimensionné.

#### Analyse comparative

| Critère | A | B | C |
|---|---|---|---|
| Tue le monolithe | partiellement | ✓ | ✓ |
| Débloque autosave / optimistic | non | ✓ | ✓ |
| Lib externe | non | non | oui |
| Apprentissage équipe | nul | faible | moyen |
| Effort | S | M | M |

#### Recommandation : **Solution B** (Context + hooks)

L'API React Context est suffisante au scale actuel et ne crée pas de dette d'écosystème. La règle d'or : on n'introduit pas Zustand tant que l'API native ne montre pas sa limite (re-renders sur store massif). Le DraftEditor doit aussi être physiquement découpé en 4 fichiers (DraftEditor, VisualGenerator, MediaPicker, plus de DeliveryPanel qui sera supprimé en S2.3 phase d).

---

### Problème 2.2 — Pas de stepper / hiérarchie de tâches (charge cognitive)

**Symptôme** : 4 onglets, 6 sections empilées, pas de fil d'Ariane. Un nouveau collaborateur ne sait pas par où commencer.

#### Solution A — Ajout d'un onboarding splash écran (premier login)
À la première connexion d'un admin, splash modal en 3 slides : "1. Créer une idée → 2. Réviser un draft → 3. Publier". Stockage `localStorage` pour ne pas re-show.

- Effort : **S** (1 modal, 3 slides)
- Gain UX : moyen (aide le nouveau, n'aide pas le quotidien)
- Risque : faible
- Réversibilité : trivial
- Dépendances : aucune

**Critique** : Patch utile mais ne change pas la structure de l'app. Le splash est vite oublié.

#### Solution B — Stepper persistant en haut + état "où en sommes-nous"
Au-dessus de l'écran principal, barre horizontale : `Idée → Brief → Draft → Validation → Publication`. La barre highlight l'étape courante en fonction du draft sélectionné. Cliquer une étape passée → focus sur la section correspondante. C'est un fil d'Ariane intelligent.

- Effort : **M** (composant + logique de mapping draft.status → étape)
- Gain UX : élevé (le user voit toujours où il est)
- Risque : faible
- Réversibilité : trivial (composant indépendant)
- Dépendances : aucune

**Critique** : C'est le pattern Linear/Asana/Notion pour les workflows. Très bonne option.

#### Solution C — Refonte en "Studio à 3 modes" (Idéation / Production / Publication)
Remplacer les 4 onglets actuels par 3 modes équivalents à des "espaces de travail" :
- **Idéation** : liste d'idées + form + bulk-generate (vue plein écran)
- **Production** : édition de drafts + visuels + previews (vue plein écran)
- **Publication** : calendrier interactif + jobs + dashboard intégré (vue plein écran)
Chaque mode est focalisé sur une seule activité, pas de mélange.

- Effort : **L** (refonte IA, redécoupe des composants existants)
- Gain UX : transformatif (chaque écran fait une chose bien)
- Risque : moyen (changement de mental model pour les utilisateurs actuels)
- Réversibilité : engageant
- Dépendances : refonte IA acceptée

**Critique** : C'est la "vraie" réponse à "tout est empilé". Mais cher si fait en standalone, justifié dans le contexte d'une refonte plus large.

#### Analyse comparative

| Critère | A | B | C |
|---|---|---|---|
| Aide le débutant | ✓ | ✓ | ✓ |
| Aide le quotidien | non | ✓ | ✓ |
| Effort | S | M | L |
| Risque mental model | nul | faible | moyen |
| Aligné avec refonte IA globale | non | partiellement | oui |

#### Recommandation : **Solution C** (3 modes) dans le cadre d'une refonte intégrée + **Solution B** (stepper persistant) en complément

Le stepper devient l'élément de balisage à l'intérieur de chaque mode. L'onboarding splash (A) est inutile si l'IA est claire ; on peut juste mettre un lien "Aide" dans le header.

---

### Problème 2.3 — Calendrier en lecture-seule

**Symptôme** : `EditorialCalendar` ne permet aucune action (ni drag-and-drop, ni création, ni édition inline).

#### Solution A — Ajouter "+ Créer post" sur hover de chaque jour
Bouton qui ouvre un mini-form (sélectionner un draft approuvé, date/heure préremplie). Pas de drag-and-drop.

- Effort : **S** (bouton + form modal)
- Gain UX : moyen (création possible mais reste asymétrique : drag absent)
- Risque : faible
- Réversibilité : trivial
- Dépendances : aucune

**Critique** : Demi-mesure. Le calendrier devient interactif mais reste désaligné avec ce que font Buffer/Later (drag).

#### Solution B — Drag-and-drop pour reprogrammer, double-clic pour éditer
Lib type `@dnd-kit/core` (ou React DnD). Drag un post → drop sur un autre jour = `PATCH /posts/:id` avec nouveau `scheduledAt`. Double-clic = ouvre un drawer latéral d'édition rapide (caption + horaire). Conserver le bouton "+ Créer post" de A.

- Effort : **M** (lib DnD + endpoint + tests + drawer)
- Gain UX : élevé (parité avec produits modernes)
- Risque : moyen (DnD a des edge cases : touch devices, accessibilité)
- Réversibilité : coût-modéré
- Dépendances : aucune

**Critique** : C'est l'attendu sur un calendrier éditorial moderne.

#### Solution C — Calendrier intelligent (B + recommandations + slots d'horaires)
B + : afficher des "slots conseillés" basés sur les performances passées (analytics intégrés), code couleur par pilier éditorial, alertes (ex: "3 posts rituel en 2 jours, équilibrer ?"), suggestion de "best time to post" par account.

- Effort : **L** (B + heuristiques + UI alertes)
- Gain UX : transformatif (le calendrier devient un copilote)
- Risque : moyen (heuristiques à calibrer, données limitées au début)
- Réversibilité : coût-modéré
- Dépendances : S3.1 (snapshots performance) ✓ déjà livré

#### Analyse comparative

| Critère | A | B | C |
|---|---|---|---|
| Interactif | partiel | ✓ | ✓ |
| Drag-and-drop | non | ✓ | ✓ |
| Intelligence | non | non | ✓ |
| Effort | S | M | L |

#### Recommandation : **Solution B maintenant + C plus tard (S4)**

B couvre 80% du besoin avec un effort raisonnable. Les heuristiques de C demandent des données (au moins 30j d'historique de publication réelle) qu'on n'a pas encore en staging.

---

### Problème 2.4 — `window.confirm()` pour publication

**Symptôme** : `SocialPublishingPanel.tsx:205` utilise un dialog natif bloquant. Casse a11y et UX moderne.

#### Solution A — Remplacer par un dialog stylable (HTML `<dialog>` natif)
Le `<dialog>` natif a un bon support (Chromium, Firefox, Safari récents) et est a11y par défaut. Pas de dépendance, code minimal.

- Effort : **S** (composant `ConfirmDialog` réutilisable)
- Gain UX : moyen (cohérent avec l'app)
- Risque : faible
- Réversibilité : trivial
- Dépendances : aucune

#### Solution B — Lib accessibilité-first (`@radix-ui/react-dialog` ou `react-aria-components`)
Dialog modal entièrement accessible, focus trap, escape key, scrim, animations. Plus robuste que `<dialog>` natif sur navigateurs anciens.

- Effort : **S** (install + composant wrapper)
- Gain UX : élevé (parfait sur a11y, animations fines)
- Risque : faible (lib mature)
- Réversibilité : coût-modéré (engage sur Radix pour la suite)
- Dépendances : install dépendance

#### Solution C — Pattern "undo" (publier sans confirmation, fenêtre de 5s pour annuler)
Pattern Gmail-style. Pas de dialog du tout. À l'action "Publier", toast en bas "Publication lancée — Annuler (5s)". Si rien, le job s'exécute.

- Effort : **M** (queue d'undo + delay côté worker + tests)
- Gain UX : élevé (flow naturel, friction minimale)
- Risque : moyen (complexité backend : faut différer l'exécution réelle de 5s, et permettre l'annulation)
- Réversibilité : coût-modéré
- Dépendances : modification du worker `social-publish`

#### Analyse comparative

| Critère | A | B | C |
|---|---|---|---|
| Pattern moderne | ✓ | ✓ | ✓✓ |
| a11y | bonne | excellente | bonne |
| Friction utilisateur | dialog | dialog | toast (zero clic) |
| Engagement | nul | dépendance | refacto backend |

#### Recommandation : **Solution B (Radix dialog) + futurement C pour les actions destructives à risque élevé**

Radix est devenu standard de facto pour dialogs accessibles. Pour publier maintenant, le dialog est rassurant. C est intéressant pour la phase "approuver + publier en chaîne" qu'on pourrait faire dans la nouvelle UI.

---

### Problème 2.5 — Pas de comparaison de variants A/B/C

**Symptôme** : La génération produit 3 variantes mais l'UI les liste verticalement. Comparer demande d'alterner les clics.

#### Solution A — Vue à 3 colonnes pour les variantes (mode "compare")
Bouton "Comparer les 3 variantes" qui affiche les 3 captions en colonnes côte à côte, avec scores, brand violations, et un bouton "Approuver celle-ci" par variant.

- Effort : **M** (composant + layout 3-col)
- Gain UX : élevé (le multi-variant prend tout son sens)
- Risque : faible
- Réversibilité : trivial
- Dépendances : aucune

#### Solution B — Diff visuel entre variantes
Surligne ce qui change entre A, B, C (mots ajoutés, supprimés). Pattern git diff. Aide à comprendre les nuances.

- Effort : **M** (lib diff + rendering)
- Gain UX : moyen-élevé (utile mais peut être visuellement chargé sur 3 variants)
- Risque : faible
- Réversibilité : trivial
- Dépendances : aucune

#### Solution C — Multi-variant publishing (A/B test côté audience)
Publier les 3 variants sur 3 segments d'audience, mesurer engagement, déclarer un winner. Pattern email A/B test.

- Effort : **XL** (split audience côté Postiz, agrégation analytics, UI de results)
- Gain UX : transformatif
- Risque : élevé (dépend des APIs Postiz, ROI incertain sur peu de followers)
- Réversibilité : engageant
- Dépendances : volume d'audience suffisant

#### Analyse comparative

| Critère | A | B | C |
|---|---|---|---|
| Aide comparaison | ✓ | ✓ | ✓ |
| Réalisable maintenant | ✓ | ✓ | non |
| ROI | élevé | moyen | incertain |

#### Recommandation : **Solution A**

Simple, immédiate, débloque la valeur du multi-variant. Solution C est intéressante long-terme mais dépend de la taille d'audience.

---

### Problème 2.6 — Dashboard orphelin + Analytics dupliqué

**Symptôme** : `/admin/content-studio/dashboard` n'a aucun lien depuis le Studio. L'onglet "Analytics" interne duplique partiellement les métriques.

#### Solution A — Ajouter un bouton "Dashboard" dans le header du Studio
Simple : un lien dans la barre supérieure du Studio vers le dashboard externe. Pas de refacto.

- Effort : **S**
- Gain UX : faible-moyen (corrige l'asymétrie, ne résout pas la duplication)
- Risque : nul
- Réversibilité : trivial
- Dépendances : aucune

#### Solution B — Fusionner Analytics interne + Dashboard externe en une seule page
Supprimer l'onglet "Analytics" du Studio. Le dashboard `/admin/content-studio/dashboard` devient l'unique source de métriques. Un lien depuis le Studio mène à ce dashboard. Réciproquement le dashboard a déjà "← Studio".

- Effort : **S-M** (supprimer onglet + migrer widgets utiles)
- Gain UX : élevé (cohérence, une seule vérité)
- Risque : faible (perte mineure de fonctions si certains widgets de l'onglet Analytics ne sont pas migrés)
- Réversibilité : coût-modéré
- Dépendances : aucune

#### Solution C — Dashboard intégré au Studio comme premier écran (replacement de "Pipeline" par défaut)
Le dashboard devient le "home" du Studio. Les onglets Idées/Drafts/Calendrier sont des sous-vues. Pattern Linear (overview → projets).

- Effort : **M**
- Gain UX : élevé (le user voit l'état du module en arrivant)
- Risque : moyen (changement de mental model)
- Réversibilité : coût-modéré
- Dépendances : refonte IA générale

#### Analyse comparative

| Critère | A | B | C |
|---|---|---|---|
| Résout l'orphelin | ✓ | ✓ | ✓ |
| Résout la duplication | non | ✓ | ✓ |
| Effort | S | S-M | M |
| Refonte IA | non | non | oui |

#### Recommandation : **Solution C** dans le cadre de la refonte intégrée (cf. proposition finale §4)

Si on fait la refonte IA en 3 modes (cf. problème 2.2), le dashboard devient logiquement le "home" du mode Publication ou un mode séparé. Si on ne fait pas la refonte, B est le pragmatique.

---

## SECTION 3 — Problèmes mineurs (P2)

### Problème 3.1 — Pas de feedback de progression pour les actions longues (génération IA)

#### Solution A — Skeleton loaders sur les zones impactées
Pendant la génération, remplacer les zones par des skeletons animés. Pas d'estimation de durée.

- Effort : S — Gain : moyen — Risque : faible

#### Solution B — Progress bar avec estimation basée sur p50/p95 historique
Stocker en DB la durée de chaque génération (déjà disponible via `runs.durationMs` ?). Calculer le p50 et afficher une barre qui s'avance à cette vitesse. Si on dépasse le p95, message "C'est plus long que d'habitude…".

- Effort : M — Gain : élevé — Risque : faible — Dépendances : champ duration en DB

#### Solution C — Server-Sent Events pour vrais progrès
Le backend stream les étapes ("Prompt préparé", "Appel API", "Optimisation image"...) via SSE. UI affiche en live.

- Effort : L — Gain : très élevé — Risque : moyen — Dépendances : refacto pipeline IA

#### Recommandation : **B** (progress bar avec estimation)

Bon compromis effort/gain. C est ROI faible pour le scale actuel.

---

### Problème 3.2 — Messages globaux non auto-dismiss

#### Solution A — Toast notifications (auto-dismiss 4s, dismissible)
Remplacer le pattern actuel par un toast (lib `sonner` ou `react-hot-toast`). Pattern moderne.

- Effort : S — Gain : élevé — Risque : faible — Dépendances : install lib

#### Solution B — Auto-dismiss timer simple sur le pattern existant
`setTimeout` 5s pour vider `message`. Pas de lib.

- Effort : S — Gain : moyen — Risque : faible

#### Solution C — Notification center persistant
Un panneau latéral avec historique des actions (50 dernières). Pattern Slack.

- Effort : M — Gain : moyen — Risque : faible

#### Recommandation : **A (sonner)**

Standard de facto, accessible, jolies animations par défaut. Une dépendance acceptable.

---

### Problème 3.3 — Pas de raccourcis clavier (power users)

#### Solution A — Cmd+S sauvegarde, Cmd+Enter approuve, j/k navigation drafts
Lib `react-hotkeys-hook`. Aide visuelle via tooltip "Cmd+S".

- Effort : S-M — Gain : moyen-élevé pour power user — Risque : faible

#### Solution B — Palette de commandes (Cmd+K) style Linear/Raycast
Recherche fuzzy : "Approuver le draft sélectionné", "Aller au calendrier", "Créer une idée".

- Effort : M — Gain : transformatif pour power user — Risque : faible — Dépendances : refacto state (mêmes besoins que problème 2.1)

#### Solution C — Combinaison A + B
Hotkeys courants pour les actions fréquentes + Cmd+K pour le reste.

- Effort : M — Gain : transformatif

#### Recommandation : **C**, livrable après la refonte state mgmt (problème 2.1 solution B)

---

### Problème 3.4 — Pas de tokens design centralisés

#### Solution A — Fichier `tailwind.config.ts` enrichi avec extensions de couleurs (`content-studio.idea`, `content-studio.draft`, etc.)
Centralise les couleurs sectorielles.

- Effort : S — Gain : moyen (dette future évitée)

#### Solution B — Design tokens via CSS variables + `theme()` Tailwind
Plus flexible (dark mode futur), plus standard.

- Effort : M

#### Solution C — Système de design système typé en TS (Stitches / vanilla-extract)
Tokens en TS, types stricts, validation.

- Effort : L

#### Recommandation : **A maintenant, B quand on attaque le dark mode**

---

## SECTION 4 — Proposition finale intégrée : "Content Studio v2"

À la lumière de l'analyse, voici une **proposition d'interface cohérente** qui répond aux problèmes prioritaires sans sur-engineering. Elle assume que tu acceptes :
- Une refonte de l'IA en 3 modes (problème 2.2 solution C)
- Le découpage du monolithe (problème 2.1 solution B)
- L'ajout de l'upload/cropping (problème 1.2 solution B)
- Et les recommandations P0/P1 ci-dessus

### 4.1 Information Architecture cible

```
/admin/content-studio   ← "Home" (le dashboard intégré, par défaut)
  │
  ├── /home              Dashboard global : KPIs + recently published + drafts attendant validation + alertes
  ├── /create            MODE "Création"     : idéation + génération + révision (1 draft à la fois, focus)
  ├── /library           MODE "Bibliothèque" : tous les drafts/posts (filtres, recherche, bulk actions, comparer variants)
  └── /plan              MODE "Planning"     : calendrier interactif + jobs + queue de publication
```

Au lieu de 4 onglets stackés sur la même page, on a **4 routes** distinctes. Chacune est une vraie page avec son rythme.

**Navigation** : un sidebar gauche minimal (4 entrées + paramètres + lien vers dashboard ops). Inspiration Linear/Notion.

### 4.2 Mode `/create` — le cœur du module

**But** : produire 1 post de zéro en moins de 3 minutes, sans changer d'écran.

Wireframe textuel :

```
┌────────────────────────────────────────────────────────────────────────────┐
│  ← Studio       Stepper : ① Cadrer ─ ② Générer ─ ③ Visuel ─ ④ Valider     │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│   ┌─────────────────────────┐    ┌─────────────────────────────────────┐  │
│   │  Intention              │    │  Aperçu plateforme                  │  │
│   │  ───────                │    │  ┌─────────────────────────────┐    │  │
│   │  Pilier   [rituel ▾]    │    │  │ [Instagram Post 4:5]        │    │  │
│   │  Objectif [conv ▾]      │    │  │                              │    │  │
│   │  Format   [post ▾]      │    │  │  [Aperçu fidèle, padding,   │    │  │
│   │                         │    │  │   typography, hashtags]      │    │  │
│   │  [Intention freeform]   │    │  │                              │    │  │
│   │                         │    │  └─────────────────────────────┘    │  │
│   │  [✨ Générer 3 variants]│    │  Format actif : [post ▾] (auto)     │  │
│   └─────────────────────────┘    │  Budget IA jour : 1.20/5.00 € ●●○   │  │
│                                  └─────────────────────────────────────┘  │
│                                                                            │
│   ┌──────────────────────────────────────────────────────────────────────┐ │
│   │ Variants (Compare)                                                   │ │
│   │ ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │ │
│   │ │ A — 94/100  │  │ B — 88/100  │  │ C — 72/100  │                   │ │
│   │ │ [caption…]  │  │ [caption…]  │  │ [caption…]  │                   │ │
│   │ │ ✓ Choisir   │  │ Choisir     │  │ Choisir     │                   │ │
│   │ └─────────────┘  └─────────────┘  └─────────────┘                   │ │
│   └──────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│   ┌──────────────────────────────────────────────────────────────────────┐ │
│   │ Média                                                                │ │
│   │ ┌────┐ ┌────┐ ┌────┐ ┌────┐    [↑ Importer]  [✨ Générer visuel IA]│ │
│   │ │ ▦  │ │ ▦  │ │ ▦  │ │ ▦  │    Compartiment : Importés / IA      │ │
│   │ │    │ │    │ │    │ │    │    Search : [______________]          │ │
│   │ └────┘ └────┘ └────┘ └────┘                                       │ │
│   │ Cropping inline (1:1 / 4:5 / 9:16) ▼                              │ │
│   └──────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│   [Sauvegarde auto · il y a 2s]      [Brouillon Postiz]  [Publier... ▾] │
│                                                          └ Publier maintenant│
│                                                            Programmer       │
└────────────────────────────────────────────────────────────────────────────┘
```

Points clés :
- **Stepper** persistant en haut : on voit toujours où on en est.
- **Aperçu plateforme** à droite, fidèle au format choisi (post/story/reel/carousel avec aspects corrects et typo IG/FB).
- **Variants comparés** en colonnes (problème 2.5 solution A).
- **Média** : upload + cropping + IA dans une seule zone (problème 1.2 solution B).
- **Autosave indicator** + bouton de publication unique avec dropdown (problème 1.1 B + 1.2).
- **Budget IA** visible (problème §4.4 friction 11).

### 4.3 Mode `/library` — toute la production éditoriale

**But** : retrouver et opérer sur les drafts/posts existants.

Wireframe textuel :

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Bibliothèque                                                              │
│  ──────────                                                                │
│  Filtres : [Statut▾] [Plateforme▾] [Pilier▾] [Date▾]      [+ Créer]      │
│  Recherche : [______________________________]              Vue : Grid/List │
│                                                                            │
│  ┌──────┬──────┬──────┬──────┐                                            │
│  │ ▦ A  │ ▦ B  │ ▦ C  │ ▦ D  │  ← Vignettes 4:5 (ou autre selon format)  │
│  │ IG · │ FB · │ IG · │ IG · │                                            │
│  │ scor │ pub  │ apr  │ ech  │  Statut tag bas-droite                     │
│  └──────┴──────┴──────┴──────┘                                            │
│                                                                            │
│  Sélection multiple : [Approuver ×3] [Programmer ×3] [Archiver ×3]        │
└────────────────────────────────────────────────────────────────────────────┘
```

Points clés :
- **Vignettes média** au lieu de listes texte (lecture visuelle plus rapide).
- **Bulk actions** (couvre le manque actuel).
- **Filtre + recherche** complets.

### 4.4 Mode `/plan` — calendrier interactif + jobs

**But** : visualiser le planning éditorial et le manipuler.

Wireframe textuel :

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Planning                                                                  │
│  ───────                                                                   │
│  [Semaine] [Mois] [Liste]     [← →]  [Auj]  [Mai 2026]                    │
│  Filtres : Plateforme / Pilier / Statut                                    │
│                                                                            │
│  Lun       Mar       Mer       Jeu       Ven       Sam       Dim          │
│  ┌──┐     ┌──┐                ┌──┐     ┌──┐                 ┌──┐          │
│  │▦ │     │▦ │                │▦ │     │▦ │                 │▦ │          │
│  │9h│     │14│                │11│     │18│                 │10│          │
│  └──┘     └──┘                └──┘     └──┘                 └──┘          │
│                                                                            │
│  Drag-and-drop pour reprogrammer · Double-clic pour éditer                │
│  +                                                                         │
│                                                                            │
│  ╔════════════ Jobs en attente (queue) ════════════╗                       │
│  ║ ► IG Story · 14h32  · queued (dans 8h)         ║                       │
│  ║ ► FB Post  · 09h00  · queued (dans 18h)        ║                       │
│  ║ ► IG Reel  · 20h15  · failed → [Retry]         ║                       │
│  ╚═══════════════════════════════════════════════════╝                    │
└────────────────────────────────────────────────────────────────────────────┘
```

Points clés :
- **Drag-and-drop** (problème 2.3 solution B).
- **Queue de jobs** visible en bas (rapatrie la section "Jobs récents" de SocialPublishingPanel actuelle).
- **Cartes média** avec vignette du visuel (au lieu de texte brut).

### 4.5 Mode `/home` — dashboard

**But** : santé du module en un coup d'œil, jumping points.

Réutilise la page `/admin/content-studio/dashboard` actuelle (livrée S3.3) avec :
- "Brouillons en attente de validation" en widget cliquable → `/library?status=needs_review`.
- "Prochaines publications" → `/plan`.
- "Idées à générer" → `/create?mode=idea`.

### 4.6 Design system

- **Couleurs** : conserver le balisage sectoriel actuel (rose pour idées, sky pour drafts, emerald pour validation, teal pour planning, violet pour visuels IA) mais centraliser dans `tailwind.config.ts` (problème 3.4 A).
- **Typo** : envisager une fonte distinctive pour les titres (recommandation `frontend-design` plugin) — pas Inter ; quelque chose de chaleureux mais professionnel (Söhne, Cabinet Grotesk, ou GT America). Body en `system-ui` ou Inter pour lisibilité. Cohérent avec le branding FemiGlow (à valider avec ton équipe brand).
- **Iconographie** : Lucide React (open-source, cohérent avec l'écosystème).
- **Animations** : transitions douces (200-300ms) sur changements d'écran, micro-interactions sur bouton hover. Pas d'animation gratuite.
- **Dark mode** : décider si on l'implémente d'emblée (recommandé : oui, c'est attendu en 2026).

### 4.7 État technique recommandé

- **State management** : Context React + hooks métier (problème 2.1 solution B). Pas de Zustand.
- **Autosave** : debounce 1.5s + version optimistic locking (problème 1.1 solution B).
- **Dialogs** : Radix UI primitives (problème 2.4 solution B).
- **Toasts** : `sonner` (problème 3.2 solution A).
- **Drag-and-drop** : `@dnd-kit/core` (problème 2.3 solution B).
- **Cropping** : `react-easy-crop` (problème 1.2 solution B).
- **Routing** : Next.js App Router avec 4 sous-routes sous `/admin/content-studio`. Chaque mode est une page server-component avec données pré-chargées.

### 4.8 Compatibilité avec l'existant

L'API backend reste **identique** à 95%. Modifications backend nécessaires :
- Endpoint d'upload média (réutilise probablement celui de la médiathèque FemiGlow).
- Endpoint de trim vidéo (nouveau, ffmpeg côté serveur).
- Endpoint d'autosave (réutilise `PATCH /drafts/:id`).
- Endpoint de "view model complet d'un draft" (nouveau, pour éviter le N+1 actuel) — optionnel mais améliore les perf.

Tous les composants actuels (`DraftEditor`, `MediaPicker`, `EditorialCalendar`...) sont **réécrits depuis zéro** mais leurs unit tests métier (validation, helpers) sont conservés.

### 4.9 Effort total estimé

| Phase | Contenu | Effort |
|---|---|---|
| **Phase 0** | Préparation : design system tokens (3.4 A), Context provider (2.1 B), Radix install (2.4 B), Sonner install (3.2 A) | 2-3j |
| **Phase 1** | Mode `/create` complet : stepper, autosave, variants compare, preview fidèle multi-format | 4-5j |
| **Phase 2** | Mode `/library` : grid vignettes, filtres, bulk actions | 2-3j |
| **Phase 3** | Mode `/plan` : calendrier interactif (DnD), queue jobs | 3-4j |
| **Phase 4** | Mode `/home` : dashboard intégré (réutilise existant) + liens cliquables | 1j |
| **Phase 5** | Upload + cropping image (1.2 B temps 1) | 3j |
| **Phase 6** | Upload + trim vidéo (1.2 B temps 2) | 2j |
| **Phase 7** | Polish : hotkeys (3.3 C), skeletons (3.1 B), tests E2E | 2-3j |
| **Total** | | **~19-24 jours** (~4 semaines focus full-time) |

### 4.10 Approche de mise en oeuvre

Recommandation : ne PAS faire un "big bang". Construire la v2 derrière un feature flag `CONTENT_STUDIO_V2_ENABLED`, route alternative `/admin/content-studio-v2/...`. L'ancienne UI reste accessible. Bascule progressive : on teste la v2 avec un seul admin pendant 1 semaine, on collecte le feedback, on itère, puis on bascule le flag par défaut, puis on supprime l'ancienne UI une fois la confiance acquise (3-4 semaines après bascule).

Bénéfice : aucun risque de régression sur la production. L'investissement de phase 7 inclut la migration des données (rien à migrer en pratique : même backend).

## 5. Décisions à prendre par toi avant exécution

1. **Périmètre** : on attaque la refonte complète (proposition §4) ou seulement les P0 + P1 critiques (problèmes 1.1, 1.2, 2.1, 2.2, 2.3) en gardant l'IA actuelle ?
2. **Vidéo** : on livre l'upload vidéo dans la phase 1 ou on attend la phase 6 ? (Impact prio image vs vidéo.)
3. **Typo & couleurs** : conserver l'identité chromatique actuelle ou refonte brand complète (avec validation équipe brand) ?
4. **Dark mode** : oui dès la v2 ou phase ultérieure ?
5. **Feature flag vs migration directe** : confirme la stratégie "v2 sous flag" ou "remplacement direct" ?

Une fois ces décisions prises, je peux produire le **plan d'exécution détaillé** (équivalent du `plan-s2.3-phase-e-draft-mode.md`) avec étapes, commits, tests vitest/Playwright, MSW, et runbook complet.
