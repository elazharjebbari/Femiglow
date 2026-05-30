# Audit UX/UI — Page Creation AI Engine

**Date:** 2026-05-27
**Scope:** Analyse complete de l'ecran de creation (`/ai-engine/create`)
**Fichier:** `apps/web/src/app/admin/content-studio-v2/ai-engine/create/page.tsx` (927 lignes)

---

## Problemes Identifies

| # | Probleme | Severite | Impact Operateur |
|---|----------|----------|-----------------|
| P1 | Pas de choix de modele pour la generation de texte | Critique | L'operateur ne peut pas controler quel LLM redige le script/caption |
| P2 | Pas de choix de modele pour la generation d'images/videos | Critique | L'operateur ne peut pas choisir entre FLUX.2, Veo 3.1, Kling 3.0, etc. |
| P3 | Etape 3 (Review) toujours verrouillee en mode mock | Majeur | L'operateur ne peut jamais atteindre la review sans API reelle |
| P4 | Pas de mock video dans le resultat | Majeur | L'operateur ne voit jamais de video, meme simulee |
| P5 | Etape 4 (Publish) inaccessible | Majeur | La section publication ne s'affiche jamais car `bridgeResult` est null |
| P6 | Pas de stepper visuel (progression par etapes) | Modere | L'operateur ne sait pas ou il en est dans le parcours |

---

## P1 — Pas de Selecteur de Modele Texte

**Etat actuel:** Le formulaire brief n'a aucun champ pour choisir le modele LLM. Le backend utilise la config globale (`AI_ENGINE_DEFAULT_TEXT_MODEL`).

### Proposition A : Selecteur de modele dans le brief form

**Description:** Ajouter un `<ModelSelector>` filtre `capability=text` dans le formulaire brief, entre les selects "Ton" et "Message cle".

**Forces:**
- Reutilise le composant `ModelSelector` deja construit
- L'operateur choisit le modele AVANT de generer
- Coherent avec la page Config (meme pattern visuel)
- Le modele choisi est envoye dans le body POST `/generate`

**Faiblesses:**
- Alourdit le formulaire brief (1 champ de plus)
- L'operateur moyen ne connait pas les differences entre gpt-4o et claude-sonnet-4
- Necessite un label explicatif

**Pertinence:** 8/10

### Proposition B : Selecteur avance avec presets intelligents

**Description:** Remplacer le choix brut par un selecteur a 3 niveaux :
- "Auto" (le systeme choisit le meilleur modele selon la plateforme)
- "Rapide" (modele le plus rapide/economique : gpt-4o-mini, gemini-flash)
- "Premium" (modele le plus performant : gpt-4o, claude-sonnet-4)
- "Personnalise" (ouvre le ModelSelector complet)

**Forces:**
- UX simplifiee pour les non-experts
- Les presets cachent la complexite
- Mode "Auto" couvre 80% des cas d'usage
- Mode "Personnalise" satisfait les experts

**Faiblesses:**
- Plus complexe a implementer (mapping preset → modele)
- Les presets peuvent devenir obsoletes quand de nouveaux modeles sortent
- Necessite une logique de selection auto cote backend

**Pertinence:** 9/10

### Proposition C : Configuration par defaut + override optionnel

**Description:** Le modele par defaut vient de la page Config (deja configure). Un petit lien "Modifier le modele" sous le bouton Generer ouvre un popover inline avec le ModelSelector.

**Forces:**
- Ne change pas le formulaire principal (zero friction)
- Les utilisateurs avances peuvent override au besoin
- Le defaut est deja configure dans Config
- Pattern "progressive disclosure"

**Faiblesses:**
- Le lien peut etre invisible/ignore par l'operateur
- Pas de visibilite immediate sur quel modele sera utilise
- Necessite un indicateur "Modele: gpt-4o-mini" visible quelque part

**Pertinence:** 7/10

### **RECOMMANDATION P1 : Proposition B (Presets intelligents)**

Le selecteur a presets est le meilleur compromis entre simplicite et controle. Implementer un composant `ModelPresetSelector` avec 4 modes (Auto/Rapide/Premium/Personnalise) positionne entre "Ton" et "Message cle" dans le formulaire.

---

## P2 — Pas de Selecteur de Modele Image/Video

**Etat actuel:** La generation d'images/videos utilise le provider et modele configures globalement. L'operateur n'a aucun controle sur quel modele visuel est utilise.

### Proposition A : Selecteur de media dans le brief form

**Description:** Ajouter 2 `ModelSelector` dans le brief : un pour `capability=image`, un pour `capability=video`. Ils apparaissent conditionnellement selon le format choisi (reel → image+video, single_image → image only, text_post → aucun).

**Forces:**
- Controle total de l'operateur sur les modeles visuels
- Coherent avec le ModelSelector existant
- Filtrage automatique par format

**Faiblesses:**
- Surcharge le formulaire (3 selectors au total avec texte)
- L'operateur doit connaitre les modeles visuels
- Complexite UX : trop de choix

**Pertinence:** 6/10

### Proposition B : Section "Parametres avances" pliable

**Description:** Ajouter une section `<CollapsibleSection>` "Parametres avances" en bas du formulaire, fermee par defaut. A l'interieur :
- Modele texte (preset Auto/Rapide/Premium/Custom)
- Modele image (ModelSelector capability=image)
- Modele video (ModelSelector capability=video, visible si format video)
- Toggle "Generer les visuels" (on/off)

**Forces:**
- Ne surcharge pas le formulaire principal
- Les parametres avances sont accessibles sans etre imposants
- Pattern "progressive disclosure" respecte
- Groupement logique de tous les parametres techniques

**Faiblesses:**
- L'operateur peut ne jamais decouvrir la section
- Les modeles par defaut doivent etre clairement affiches
- Section pliable = un clic de plus

**Pertinence:** 9/10

### Proposition C : Wizard 2 etapes — Brief puis Parametres

**Description:** Transformer le formulaire en wizard : Etape 1 = Brief creatif (objectif, plateforme, ton, message), Etape 2 = Parametres techniques (modele texte, modele image, modele video, qualite, budget max). Bouton "Suivant" entre les deux.

**Forces:**
- Separation claire creativite vs technique
- Chaque etape est epuree
- L'operateur non-technique peut skipper l'etape 2 (valeurs par defaut)

**Faiblesses:**
- Ajoute une etape au parcours (friction)
- L'operateur presse doit cliquer 2 fois au lieu de 1
- Necessite un refactoring significatif du formulaire

**Pertinence:** 7/10

### **RECOMMANDATION P2 : Proposition B (Section pliable "Parametres avances")**

La section pliable est le meilleur pattern : elle ne derange pas l'operateur moyen mais offre le controle total aux experts. Elle contiendra les ModelSelector pour texte, image et video + un toggle "Generer les visuels".

---

## P3 — Etape 3 (Review) Toujours Verrouillee en Mock

**Etat actuel:** La phase `'review'` ne s'active que si l'API renvoie `status === 'review'` (ligne 624). En mode mock, l'API renvoie `status === 'completed'` directement, donc la review est bypassee.

### Proposition A : Forcer la review en mode mock

**Description:** Modifier `handleGenerate()` pour toujours transitionner vers la phase `'review'` avec un `reviewPayload` simule contenant du contenu mock (script, caption, hashtags, images fictifs).

**Forces:**
- Simple a implementer (30 lignes)
- L'operateur peut tester tout le parcours review sans API reelle
- Les 3 boutons (Approuver/Modifier/Rejeter) fonctionnent

**Faiblesses:**
- Le contenu mock n'est pas realiste (texte lorem ipsum)
- Ne teste pas la vraie logique de review backend
- Confusion possible : l'operateur croit que c'est du vrai contenu

**Pertinence:** 7/10

### Proposition B : Toggle "Activer la review humaine" dans le brief

**Description:** Ajouter un toggle dans les parametres avances : "Review humaine avant publication". Si active, la generation passe TOUJOURS par la phase review, meme en mock. Le backend est modifie pour respecter ce flag.

**Forces:**
- Controle explicite de l'operateur
- Coherent avec le champ `humanReviewRequired` du workflow
- Fonctionne en mock ET en production
- L'operateur decide quand la review est necessaire

**Faiblesses:**
- Necessite une modification du body POST `/generate`
- Le backend doit supporter le flag override
- Un toggle de plus dans le formulaire

**Pertinence:** 9/10

### Proposition C : Stepper interactif avec etapes cliquables

**Description:** Remplacer le systeme de phases par un stepper visuel en haut de page (Brief → Generation → Review → Publication). Chaque etape est cliquable quand ses preconditions sont remplies. La review devient une etape obligatoire (avec auto-approve si pas de review configuree).

**Forces:**
- L'operateur voit toujours ou il en est
- Navigation libre entre les etapes completes
- La review n'est plus "verrouillee" mais traversee automatiquement si non requise

**Faiblesses:**
- Refactoring significatif du systeme de phases
- Complexite de gestion d'etat (stepper + phases)
- Risque de confusion : l'operateur peut revenir en arriere de maniere non anticipee

**Pertinence:** 8/10

### **RECOMMANDATION P3 : Proposition B (Toggle review humaine) + Proposition C (Stepper visuel)**

Combiner les deux : ajouter un stepper visuel 4 etapes en haut de page ET un toggle "Review humaine" dans les parametres avances. En mock, le toggle force la review. Le stepper montre la progression.

---

## P4 — Pas de Mock Video

**Etat actuel:** Le `GenerationResult` affiche les images mais n'a AUCUN affichage video. Meme quand le backend genere un mock video (via FFmpeg), le resultat n'est pas montre dans l'UI.

### Proposition A : Ajouter un player video dans GenerationResult

**Description:** Ajouter une section "Videos" dans `GenerationResult` qui affiche un `<video>` player pour chaque video generee (mock ou reelle). Le mock video est deja genere par `generate-video.ts` avec FFmpeg.

**Forces:**
- Le mock video existe deja cote backend
- Un `<video>` HTML natif est simple a implementer
- L'operateur voit le resultat complet (images + video)

**Faiblesses:**
- Le mock video est un placeholder basique (fond colore + texte)
- Le player video natif a un UX basique
- Les videos mock sont stockees localement, pas sur CDN

**Pertinence:** 8/10

### Proposition B : Player video stylise avec preview + controles

**Description:** Creer un composant `VideoPreview` avec : thumbnail du premier frame, bouton play overlay, barre de progression, duree, badge provider/modele. Pour le mock : generer une thumbnail statique au lieu d'une video FFmpeg (plus leger).

**Forces:**
- UX superieure (thumbnail + play on demand)
- Pas de chargement video automatique (economie de bande passante)
- Badge modele visible (Higgsfield, Veo 3.1, mock...)
- Coherent avec le design CS v2

**Faiblesses:**
- Plus complexe a implementer
- Necessite une generation de thumbnail separee
- Le mock thumbnail doit etre aussi genere

**Pertinence:** 9/10

### Proposition C : Carrousel images + video combines

**Description:** Au lieu de sections separees "Images" et "Videos", combiner dans un carrousel multimedia unique avec des badges type (Image/Video) sur chaque element. L'operateur swipe entre les assets.

**Forces:**
- Vue unifiee de tous les assets generes
- UX moderne (carrousel swipeable)
- Moins de scroll vertical

**Faiblesses:**
- Complexite carousel (responsive, touch events)
- Les videos et images ont des ratio differents
- Le player video dans un carousel est delicat

**Pertinence:** 6/10

### **RECOMMANDATION P4 : Proposition A (Player video simple) pour le MVP**

Implementer un `<video>` player simple dans `GenerationResult` pour afficher les videos mock et reelles. C'est la solution la plus rapide et fiable. Le player stylise (Proposition B) pourra etre ajoute dans une iteration future.

---

## P5 — Etape 4 (Publish) Inaccessible

**Etat actuel:** La section PublishSection s'affiche uniquement si `bridgeResult?.draftId` existe (ligne 657 de GenerationResult.tsx). En mode mock, la generation renvoie `bridgeResult: null` donc la section n'apparait jamais.

### Proposition A : Mock bridgeResult dans la reponse generate

**Description:** Modifier le handler mock de `/api/admin/ai-engine/generate` pour toujours renvoyer un `bridgeResult` avec des IDs fictifs : `{ ideaId: 'mock-idea', briefId: 'mock-brief', draftId: 'mock-draft' }`.

**Forces:**
- Simple (modification d'une ligne dans la reponse mock)
- La section Publish s'affiche immediatement
- Tout le parcours 4 etapes est testable

**Faiblesses:**
- Le publish reel echouera car les IDs mock n'existent pas en DB
- L'operateur peut etre confus par un faux "Publie avec succes"
- Necessite un mock handler pour POST `/publish` aussi

**Pertinence:** 8/10

### Proposition B : Toujours afficher PublishSection avec mode degrade

**Description:** Afficher la section PublishSection TOUJOURS apres une generation reussie. Si `bridgeResult` est absent, montrer un message "Publication non disponible — generation mock" avec les boutons desactives.

**Forces:**
- L'operateur voit toujours la section (pas d'element invisible)
- Le mode degrade explique pourquoi la publication n'est pas possible
- Pas de confusion : le message est clair
- Pas besoin de mock IDs

**Faiblesses:**
- L'operateur voit des boutons desactives (frustrant)
- Un message supplementaire a maintenir
- N'est pas testable end-to-end

**Pertinence:** 7/10

### Proposition C : Mock complet de la chaine publish

**Description:** Implementer un mock handler pour POST `/publish` qui renvoie un succes simule. Combiner avec Proposition A (mock bridgeResult). Ainsi tout le parcours est testable de bout en bout : brief → generate → review → publish → succes.

**Forces:**
- Parcours complet testable en mode mock
- L'operateur voit le flow exact qu'il aura en production
- Les tests E2E peuvent couvrir le golden path entier
- Ideal pour la demo/formation

**Faiblesses:**
- Plus de code mock a maintenir
- Risque de regression si les mocks divergent de l'API reelle
- L'operateur peut ne pas realiser qu'il est en mode mock

**Pertinence:** 9/10

### **RECOMMANDATION P5 : Proposition C (Mock complet de la chaine publish)**

Implementer le mock bridgeResult + mock publish handler pour que tout le parcours soit testable. Ajouter un badge discret "Mode Mock" dans le stepper pour que l'operateur sache qu'il est en simulation.

---

## P6 — Pas de Stepper Visuel

**Etat actuel:** Les phases (brief → generating → review → result) sont gerees par un `useState<Phase>` sans representation visuelle. L'operateur ne voit que le contenu de la phase active.

### Proposition A : Stepper horizontal en haut de page

**Description:** Composant `<Stepper>` horizontal avec 4 etapes : Brief → Generation → Review → Publication. Chaque etape montre un cercle numerote + label. L'etape active est mise en valeur (accent color), les etapes completes ont un checkmark vert, les futures sont grisees.

**Forces:**
- Pattern UX standard (familier a tous les operateurs)
- Visibilite immediate de la progression
- Compatible avec le design CS v2
- Simple a implementer (~100 lignes)

**Faiblesses:**
- Prend de l'espace vertical en haut
- Les etapes ne sont pas cliquables (lineaire)
- 4 etapes est le minimum, peut sembler simpliste

**Pertinence:** 9/10

### Proposition B : Progress bar compacte avec labels

**Description:** Barre de progression horizontale fine (4px) avec des points d'etape et labels en dessous. Plus compact qu'un stepper classique. L'etape active a un point plus gros + pulse animation.

**Forces:**
- Tres compact (hauteur ~40px)
- Visuellement elegant
- Animation de progression fluide
- Coherent avec le style minimal de CS v2

**Faiblesses:**
- Moins lisible que le stepper classique
- Les labels petits peuvent etre difficiles a lire
- Pas de place pour des descriptions

**Pertinence:** 7/10

### Proposition C : Sidebar de progression

**Description:** Panneau lateral gauche etroit (180px) avec les etapes empilees verticalement, toujours visible. L'etape active est developpee avec details, les autres sont condensees.

**Forces:**
- Toujours visible (pas de scroll necessaire)
- Peut montrer des details par etape (duree, cout)
- Navigation visuelle claire

**Faiblesses:**
- Reduit l'espace de contenu principal
- Pattern inhabituel pour un wizard
- Responsive problematique sur mobile

**Pertinence:** 5/10

### **RECOMMANDATION P6 : Proposition A (Stepper horizontal 4 etapes)**

Le stepper horizontal est le pattern le plus clair et le plus standard. 4 cercles numerotes avec labels : 1.Brief → 2.Generation → 3.Review → 4.Publication.

---

## Resume des Recommandations

| # | Probleme | Solution Recommandee | Effort |
|---|----------|---------------------|--------|
| P1 | Pas de choix modele texte | Presets intelligents (Auto/Rapide/Premium/Custom) | M |
| P2 | Pas de choix modele image/video | Section pliable "Parametres avances" | M |
| P3 | Review toujours verrouillee | Toggle review + stepper visuel | M |
| P4 | Pas de mock video | Player `<video>` simple dans GenerationResult | S |
| P5 | Publish inaccessible | Mock complet bridgeResult + publish handler | S |
| P6 | Pas de stepper visuel | Stepper horizontal 4 etapes | S |

**Ordre d'implementation suggere :**
1. P6 (Stepper) — fondation visuelle, impact immediat
2. P5 (Mock publish) — debloque le parcours complet
3. P3 (Toggle review) — debloque l'etape review
4. P4 (Mock video) — complete l'affichage des resultats
5. P1 + P2 (Model selectors) — parametres avances, le plus impactant
