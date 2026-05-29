# Axe ui-ux

> Diagnostic transversal — expérience opérateur réelle du pipeline **génération + publication** (Content Studio v2 / AI Engine).
> Baseline figée : **2026-05-29**, branche `feat/ai-engine-langgraph-mvp`.
> Principe directeur (cf. `01_methodology.md`) : **la vérité, c'est ce que vit l'opérateur en interface, pas ce que dit la suite de tests.** Tout chemin non prouvé en MOCK **et** LIVE est `cassé par défaut`.

Cet axe regarde le pipeline par les **yeux de l'opérateur** : ce qu'il voit, ce qu'on lui promet, ce qu'il obtient réellement, et le delta de confiance entre les deux. Le parcours de référence est :

```
plateforme → intention/idée → variantes texte → média (image/vidéo) → approuver → publier (now / schedule / draft)
```

---

## Etat actuel (constaté, avec preuves)

### Vue d'ensemble du parcours réel (mesuré)

Le parcours opérateur réel a été exercé via Playwright (`evidence/playwright-operator-journeys.txt`) et des probes authentifiés read-only. Résultat global : **37 specs passés / 2 échoués, PLAYWRIGHT_EXIT=1**. L'UI « marche » visuellement en mode mock, mais le parcours cache des promesses non tenues à chaque étape sensible.

| Étape opérateur | Ce que l'UI affiche / promet | Réalité backend constatée | Findings |
|---|---|---|---|
| Intention → idée | Picker « Modèle de génération » (texte), 106 entrées dont whisper-1/sora-2 badgés « Live » | Modèle ignoré ; texte = template déterministe figé, `provider=fallback` | BUG-019, BUG-016, BUG-005, MISS-012 |
| Variantes texte | Apparition de 3 variantes ; toggle Mock/Live ; badge « Généré par … » | Toggle **sans effet sur le texte** ; échec de génération **silencieux** (idée sans variantes, 0 toast) | BUG-020, BUG-022, MISS-001 |
| Média image | ModelPicker, badges verts « Live », modèle auto-suggéré `gpt-image-1-mini` | En live : `HTTP 409 invalid_state` AVANT tout appel réseau, quel que soit le modèle | BUG-006, BUG-007, BUG-024, BUG-001, MISS-002 |
| Média vidéo | 12+ modèles vidéo dont 8 Higgsfield « Live » | Backend ne route que `mock-*` et `hf-*` ; modèles live-découverts → throw « aucun modèle vidéo live disponible » (message faux) ; credential HF incomplet | BUG-009, BUG-002, BUG-028 |
| Voix-off / musique / sous-titres / montage | Aucune surface UI dans le flux create | Fonctionnalités **inatteignables** depuis le parcours opérateur (bridge unidirectionnel A→B) | BUG-004, BUG-048, BUG-033 |
| Approuver | Bouton « Valider et préparer la publication » | Message d'erreur générique écrasant le message serveur précis | BUG-054 |
| Publier maintenant | Dialog « Cette action ne peut pas être annulée une fois publié » + toast « Publication lancée » | Le toggle « mock » de l'UI **ne protège PAS** contre une publication live (≠ `SOCIAL_PUBLISHING_MODE`) | BUG-003 (parité), mock-live-parity ligne 21 |
| Programmer | Toast **« Publication programmée »** (succès) | Le job programmé **ne s'exécute JAMAIS** (aucun scheduler branché) — accusé de réception inerte | BUG-003 |

### Constat A — Le sélecteur de modèles ment systématiquement (desync UI/réalité)

C'est le défaut UI/UX le plus structurant et le plus reproductible. Probe réel (`evidence/playwright-operator-journeys.txt` lignes 71-90, `runtime-env-state.md`) :

```
GET /api/admin/content-studio/models?role=image
→ 18 modèles, la quasi-totalité badgés vert "Live"
  (gpt-image-1-mini "Live", gpt-image-2 "Live", flux_2 higgsfield "Live", veo3_1 "Live", …)
```

Or **aucun** de ces modèles « Live » n'est générable par le flux create aujourd'hui :
- OpenAI : le picker résout la clé via `resolveApiKey('openai')` → trouve `OPENAI_API_KEY` (valide, 164 chars) et marque « Live » ; mais `image-generation.ts` (lignes 87/98/111) lit **uniquement** `env.CONTENT_STUDIO_OPENAI_API_KEY` (vide). Deux chemins de résolution de clé divergents (BUG-006, BUG-007, BUG-043, MISS-003, MISS-007).
- Higgsfield : `discovery.higgsfield='fallback'` (host mort), mais `materialiseDiscoveredModel` force `source:'live'` systématiquement → badge « Live » mensonger (BUG-024, BUG-007).

Le badge « Live » dans `ModelPicker.tsx:505-523` porte le `title` « Modèle découvert via l'API live du provider » — une promesse de disponibilité que le générateur ne peut pas honorer.

### Constat B — Pré-sélection automatique du modèle non-fonctionnel (armement du 1er clic raté)

`ModelPicker.tsx:103-105` fait un `fetch` *eager* dès le montage, et `ModelPicker.tsx:114-118` appelle `onChange(suggested.id)` **automatiquement** dès que `value===null` et qu'une suggestion arrive — sans aucune action opérateur. Combiné au toggle Live, le **tout premier clic** « Générer un visuel IA » part avec `model=gpt-image-1-mini` (live) → `409 invalid_state` immédiat (MISS-002). L'UI engage donc un modèle non-fonctionnel sans choix explicite : le defaut transforme le blocker théorique en échec systématique au premier essai live.

### Constat C — Toggle Mock/Live partiellement fantôme + triple source de vérité du « mode »

`GenerationModeToggle.tsx` pose un cookie `cs_generation_mode` (`path=/`, 30 j) et émet des toasts (« Mode live activé — coûts réels », `:64-71`). Mais :
- **Texte** : la route `ideas/[id]/generate` ne lit jamais ce cookie ; la génération texte est mode-agnostique (toujours fallback). Le toggle est **sans aucun effet** sur le texte (BUG-020, MISS-001).
- **Indicateur global** : `MediaStudio.tsx:179` rend `<GenerationModeToggle />` sans `envDefault` → défaut codé `'mock'` (`GenerationModeToggle.tsx:44`), alors que `health.mockMode=false` (env `CONTENT_STUDIO_V2_MOCK_MODE` non défini). Le toggle affiche MOCK mais le `MockModeBadge` global ne s'affiche pas → deux indicateurs contradictoires (BUG-021).
- **Trois sources de vérité divergentes** du mode : le cookie (toggle, défaut mock), le badge global (`health.mockMode`, env false), et le défaut serveur de `generate-visual` (`mock` codé en dur, MISS-016).
- **Confusion de portée publication** : le toggle « mock » de génération **ne protège PAS** la publication. Seul `SOCIAL_PUBLISHING_MODE` (env, `dry_run` par défaut) bascule dry_run↔Postiz (mock-live-parity ligne 21). Un opérateur en « mode mock » pourrait croire être protégé d'une publication réelle — il ne l'est pas.

### Constat D — Échecs silencieux : l'opérateur reste bloqué sans feedback

`CreateWorkspace.tsx:195-228` (`onCreated`) : après création d'idée, si la génération de variantes échoue (`res.ok===false`), **aucune branche `else`** → rien n'est affiché ; le `catch` (ligne 226) est **vide** avec le commentaire « Generation failure is not blocking — user can retry. ». Résultat : idée créée, **zéro variante**, **zéro toast**, **zéro état d'erreur**. L'opérateur est bloqué sans explication ni piste de retry (BUG-022).

### Constat E — Toasts de succès trompeurs (le pire pour la confiance)

Deux toasts de **succès** affichent un état faux :
1. `PublishActionGroup.tsx:103` — « **Publication programmée** » après un `200`, alors que le job programmé ne s'exécute jamais (aucun scheduler branché, staging PM2 ≠ Vercel crons). L'opérateur croit son post planifié ; il ne sera **jamais** publié (BUG-003). C'est un échec silencieux à conséquence métier directe.
2. `MediaStudio.tsx:140` — « Visuel IA généré » en mock affiche bien un asset, mais c'est une **vignette AVIF sm** (~1,7 Ko, `previewUrl = thumbUrl ?? originalUrl`, `MediaStudio.tsx:127`) et non l'image pleine résolution ; `originalUrl=null` côté mock (BUG-053).

### Constat F — Messages d'erreur backend mal remontés

`formatError` (`errors/messages.ts:39-41`) retourne le libellé **mappé AVANT** de considérer `e.message`. Le serveur renvoie `invalid_state` pour « pas de média attaché » → l'opérateur voit « **État de draft invalide pour cette action.** » au lieu du message serveur précis (BUG-054). À l'inverse, pour la génération visuelle, `MediaStudio.tsx:144` affiche bien le message serveur brut (« CONTENT_STUDIO_OPENAI_API_KEY manquant… ») — un message **technique** exposé tel quel à l'opérateur, illisible métier (BUG-001/BUG-006).

### Constat G — Surface d'erreur élargie par l'UI elle-même

- `ModelPicker` monte avec `allowCustom=true` par défaut (`:52`) ; ni `IntentionForm` ni `MediaStudio` ne passent `allowCustom={false}`. L'opérateur peut taper **n'importe quel** id de modèle, transmis non validé à l'API (schemas `z.string().min(1).max(120)` sans registre) → échec en aval (MISS-015, BUG-028, BUG-019).
- Bouton « Régénérer » (`MediaStudio.tsx:198-211`) réutilise l'`model` d'état, pouvant hériter d'un id live non-fonctionnel après bascule (MISS-017).

### Ce qui FONCTIONNE réellement pour l'opérateur (à préserver)

- **Génération image/vidéo en MOCK** : `POST generate-visual` (mock) → asset servi `200`, toast « Visuel IA généré » (BUG-067, generation-image/current-state.md). C'est le seul chemin de génération fonctionnel aujourd'hui.
- **Crop/trim média** : `upload-and-crop` / `upload-and-trim` produisent un WebP / MP4 réels servis `200` (mock-live-parity lignes 17, 20) — mode-agnostique.
- **Dialogs de confirmation de publication** : aperçu (vignette + caption tronquée + plateforme/format + mini-player vidéo) bien construits (`ConfirmPreview`).
- **Estimateur de progression** (`EstimatorBar`, MediaStudio) avec états `running/longer/stuck` — bon pattern d'état de chargement.
- **Accessibilité** : `role=radiogroup`, `aria-checked`, `aria-disabled`, `aria-expanded`, `aria-haspopup`, labels présents sur les contrôles audités. Le spec `accessibility audit on /create` passe.

---

## Problèmes concrets

Chaque problème référence le(s) finding(s) confirmé(s).

1. **Le picker de modèles propose des modèles non générables badgés « Live ».** — `ModelPicker` affiche « Live » pour tous les modèles OpenAI/Higgsfield ; aucun n'est générable côté create. Desync UI/réalité total. → **BUG-006, BUG-007, BUG-009, BUG-024, BUG-043**, MISS-003, MISS-007.
2. **Pré-sélection automatique d'un modèle live non-fonctionnel** arme le 1er clic « Générer » vers un `409`. → **MISS-002**, BUG-001, BUG-006.
3. **Le toggle Mock/Live est sans effet sur le texte** (route ne lit pas le cookie) — contrôle UI fantôme. → **BUG-020, MISS-001**.
4. **Échec de génération de variantes silencieux** : idée sans variantes, sans toast, sans état d'erreur ; opérateur bloqué. → **BUG-022**.
5. **Toast « Publication programmée » mensonger** : le job programmé n'est jamais exécuté. → **BUG-003**.
6. **Le toggle « mock » UI ne protège pas la publication** (≠ `SOCIAL_PUBLISHING_MODE`) — risque de confusion menant à une publication réelle non voulue. → **BUG-003** (parité), **BUG-039** (mauvais compte), **BUG-040** (route legacy hors garde-fou).
7. **Incohérence d'indicateur de mode** : toggle affiche MOCK mais badge global absent (health.mockMode=false) ; trois sources de vérité du mode. → **BUG-021, MISS-016**.
8. **Messages d'erreur mal remontés** : libellé générique écrasant le message serveur utile (`formatError`) ; à l'inverse, message technique brut exposé pour la génération. → **BUG-054, BUG-001/006**.
9. **Picker texte pollué** : whisper-1 (STT), sora-2 (vidéo), gpt-realtime/audio, davinci/babbage proposés comme « Modèle de génération » texte. → **BUG-019, BUG-016**, MISS-018.
10. **`allowCustom` ouvert + saisie non validée** transmise à l'API → erreurs en aval. → **MISS-015, BUG-028**.
11. **Voix-off / musique / sous-titres / montage absents de l'UI opérateur** : aucune surface, fonctionnalités inatteignables (bridge A→B unidirectionnel). → **BUG-004, BUG-048, BUG-033, BUG-034, BUG-015**.
12. **Modèle choisi non honoré/non tracé** : modèle ignoré (mock écrase par `mock-low-cost-image`, fallback par `deterministic-template`). → **BUG-056, MISS-012**.
13. **Tons UI invalides** : 3 des 6 tons proposés (Empowering/Authentic/Urgent) font échouer toute la génération AI-Engine (mismatch d'enum). → **BUG-014** (UI `/ai-engine/create`).
14. **Aperçu mock dégradé** : vignette AVIF sm servie comme aperçu plein. → **BUG-053**.
15. **Régénérer hérite d'un modèle live obsolète** ; échec silencieux possible. → **MISS-017**.
16. **Spec E2E vidéo cassé par un sélecteur obsolète** (« Générer un visuel IA » vs « Générer une vidéo IA ») : rapport rouge sur une fonctionnalité qui marche → bruit qui masque les vrais signaux. → **BUG-029, BUG-055**, refuted `test-mock-infrastructure-5`.
17. **Incohérence code/commentaire de portée cookie** : commentaire dit « scoped to the admin path », code pose `path=/`. → **MISS-034**.

---

## Causes racines

1. **Source de vérité du picker ≠ source de vérité du générateur.** La découverte de modèles (UI) et la génération (backend) résolvent la clé/la disponibilité par des chemins distincts (`resolveApiKey` chaîné vs lecture directe `env.CONTENT_STUDIO_OPENAI_API_KEY`). Le label « Live » reflète la découverte, pas la capacité réelle de générer. C'est la cause unique de la majorité des desync UI/réalité (BUG-006/007/009/024/043, MISS-003/007). **Cause systémique : split de variable d'environnement** (`OPENAI_API_KEY` présent mais non mappé dans `env.ts` ni lu par le flux create — `runtime-env-state.md`).

2. **Deux pipelines parallèles jamais fusionnés** (A = LangGraph `/ai-engine`, B = create `/content-studio`), avec un bridge **unidirectionnel** A→B jamais déclenché par l'opérateur. Toute la richesse (copywriting soigné, voix-off, musique, sous-titres, montage) vit dans A et n'a **aucune surface UI** dans B. L'opérateur n'utilise que B (BUG-015, BUG-004, BUG-033, BUG-048).

3. **Indicateurs d'état non reliés à l'état réel.** Le toggle (cookie), le badge (`health.mockMode`), le défaut serveur sont trois sources non synchronisées ; le cookie ne pilote que la génération **visuelle**, pas le texte ni la publication. Les composants ont été câblés pour passer les tests RTL plutôt que pour refléter l'effet backend (cf. BUG-046, MISS-031).

4. **Gestion d'erreur orientée « ne pas bloquer » plutôt que « informer ».** `catch {}` vides, absence de branche `else`, toasts de succès émis sur la base du seul code HTTP `200` sans vérifier l'effet métier réel (scheduler inerte). Le mapping d'erreur privilégie un libellé générique au message serveur (BUG-022, BUG-003, BUG-054).

5. **Couverture de test qui ne teste pas le point de vue opérateur.** Les assertions valident la présence d'éléments / la réponse du mock, pas l'effet backend réel (publication effective, modèle réellement appliqué). D'où des UI « vertes » qui mentent (BUG-041, BUG-046 ; cas d'école : EXIT 1 malgré 1695 passed, BUG-010).

---

## Criticité (justifiée)

**Criticité de l'axe : `critical`** (≠ blocker, qui appartient aux domaines génération/publication).

Justification :
- L'axe ui-ux n'est pas la cause **proximale** des blockers (ceux-ci sont backend/env/cron : BUG-001/002/003/004), mais il en est le **vecteur de tromperie** : c'est l'UI qui **promet** ce que le backend ne peut pas livrer (badges « Live », toasts de succès, toggle mock). Un opérateur ne peut pas diagnostiquer un échec silencieux ni un toast mensonger.
- Deux comportements UI atteignent le seuil `critical` (« échec silencieux / publication erronée possible ») :
  - **BUG-003** : toast « Publication programmée » suivi d'une non-publication — perte de contenu planifié sans aucun signal.
  - **BUG-022** : échec de génération silencieux — opérateur bloqué, aucune piste.
  - **Confusion mock/live publication** : le toggle « mock » UI ne protège pas d'une publication réelle (BUG-039/040) — risque de publication sur le mauvais compte client.
- Le reste (desync picker, indicateurs, messages) est `major` : dysfonctionnement notable avec contournement pénible, mais qui érode massivement la confiance opérateur.

L'axe est `critical` parce que **la couche UI transforme des blockers backend en pièges silencieux** : sans correction UI, même un backend réparé laisserait l'opérateur sans visibilité sur l'état réel.

---

## Recommandations (actionnables, priorisées)

### P0 — Stopper les tromperies actives (échecs silencieux / promesses fausses)

1. **Ne jamais afficher un toast de succès sans effet métier confirmé.** Pour « Programmer », tant que le scheduler n'est pas branché (BUG-003), afficher un état explicite (« Programmation enregistrée — l'exécution automatique n'est pas active sur cet environnement ») ou désactiver l'action. Critère de fin : un post programmé pour T+1h passe à `published` en mock **et** live, prouvé par probe. (BUG-003)
2. **Remonter tout échec de génération à l'opérateur.** Dans `CreateWorkspace.onCreated`, ajouter une branche `else` + `catch` qui `toast.error(formatError(...))` et un état de retry. Critère : provoquer un échec (budget épuisé) → toast d'erreur visible + bouton réessayer. (BUG-022)
3. **Aligner badge « Live » sur la capacité réelle de générer.** Le badge ne doit refléter que `source==='live'` confirmé **par le même chemin de clé que le générateur**. À court terme : (a) propager la vraie `source` dans `materialiseDiscoveredModel` (ne plus forcer `live`) ; (b) débloquer OpenAI côté create en ajoutant `OPENAI_API_KEY` au fallback de résolution (correctif bon marché, cf. `runtime-env-state.md`). Critère : tout modèle badgé « Live » génère réellement en live (probe sur chaque modèle proposé). (BUG-006/007/024/043, BUG-001)
4. **Désactiver/avertir la pré-sélection automatique de modèle live.** Ne pas auto-`onChange(suggested.id)` vers un modèle dont la génération échouera ; ou vérifier la disponibilité avant. Critère : 1er clic « Générer » en live ne produit jamais un `409 invalid_state` sur un modèle proposé par défaut. (MISS-002)

### P1 — Restaurer la cohérence des indicateurs de mode

5. **Une seule source de vérité du mode.** Alimenter `GenerationModeToggle` avec `envDefault` issu de `health.mockMode`, faire lire le cookie par **toutes** les routes de génération (texte incluse), et aligner le défaut serveur de `generate-visual`. Critère : toggle, badge global et comportement backend concordent dans les 3 (mock/live/sans cookie). (BUG-021, BUG-020, MISS-016)
6. **Clarifier la portée du toggle.** Indiquer explicitement que le mode mock/live concerne la **génération** et **non** la publication ; surfacer `SOCIAL_PUBLISHING_MODE` dans les dialogs de publication (badge « dry_run / live » distinct du mock de génération). Critère : aucun chemin où « mock » UI laisse croire à une protection contre la publication réelle. (BUG-003 parité, BUG-039, BUG-040)

### P2 — Réduire la surface de desync et le bruit

7. **Filtrer le catalogue par capacité réelle.** Liste blanche par rôle côté discovery (exclure whisper/sora/realtime/audio/embeddings du rôle `chat`/`image`/`video`) et valider le `model` reçu contre le registre côté API. Critère : `?role=chat` ne renvoie que des modèles chat-completions ; un `model` hors registre est rejeté avec un message clair. (BUG-019, BUG-016, MISS-015, MISS-018, BUG-028)
8. **Fermer `allowCustom` par défaut** dans les pickers du flux create (laisser l'option réservée à un mode avancé). (MISS-015)
9. **Honorer et tracer le modèle choisi** (ne plus écraser par `mock-low-cost-image` / `deterministic-template` sans le dire) — afficher le modèle effectif et la raison du fallback. (BUG-056, MISS-012)
10. **Améliorer le mapping d'erreur** : préférer le message serveur précis quand il est plus informatif, et masquer les messages techniques (clés d'env) derrière un libellé métier + détail repliable. (BUG-054, BUG-001)

### P3 — Vérité du parcours et tests orientés opérateur

11. **Exposer (ou retirer proprement) voix-off/musique/sous-titres/montage.** Tant que le bridge est unidirectionnel, ne pas laisser croire à leur existence ; à terme, surfacer ces étapes dans le flux create. (BUG-004, BUG-048, BUG-033/034)
12. **Mettre à jour les specs E2E obsolètes** (libellé bouton vidéo) pour supprimer le bruit rouge qui masque les vrais signaux. (BUG-029, BUG-055)
13. **Ajouter des tests E2E orientés opérateur** qui vérifient l'**effet** (post réellement publié/programmé, modèle réellement appliqué) et non la seule présence d'un toast. (BUG-041, BUG-046)

### Points à vérifier (tous angles)

- **États vides / chargement / erreur** : l'empty-state MediaStudio (`!draftId`) est bon ; vérifier l'empty-state du picker quand la discovery échoue (actuellement « garde l'état précédent » silencieusement, `ModelPicker.tsx:87-88`).
- **Race conditions** : `fetchModels` eager + auto-select ; vérifier l'ordre format-change → reset model → nouveau suggested (MISS-017).
- **Accessibilité** : préserver les `aria-*` existants ; vérifier l'annonce des toasts d'erreur (rôle `status`/`alert`).
- **Mobile / responsive** : non couvert par les findings ; à exercer sur les dialogs de publication et le picker (popover 380px).
- **i18n / clarté** : messages techniques (clés d'env) ne doivent jamais atteindre l'opérateur.
