# 02 — Audit de l'interface (Content Studio v2, frontend)

**Périmètre lu intégralement** (sur master `c55add4b`) : `apps/web/src/components/admin/content-studio-v2/**` (43 fichiers, ≈12 400 lignes), pages `apps/web/src/app/admin/content-studio-v2/**` (7 pages + layout), `apps/web/src/lib/content-studio-v2/**` (state, media, library). Chemins abrégés : `components/` = `apps/web/src/components/admin/content-studio-v2/`, `lib/` = `apps/web/src/lib/content-studio-v2/`, `app/` = `apps/web/src/app/admin/content-studio-v2/`.

> NB : les composants `MediaStudioTracks` et `VideoPlayer` (panneau voix-off/sous-titres/montage, player avec contrôles) existent **uniquement sur la branche backup** — l'interface auditée ici est celle de master.

## 1. Le flux opérateur, étape par étape (ce qui marche / ce qui ne marche pas)

Le workspace `/create` est un stepper 4 étapes : **Cadrer → Générer → Visuel → Valider**.

### Étape 0 — Chargement de la page : BLOQUANT

`app/create/page.tsx:20` rend `<CreateWorkspace />` **sans aucune prop**. `CreateWorkspace.tsx:36-46` passe alors `initial={{ideas:[], drafts:[], mediaItems:[]…}}` au `StudioProvider`, et `StudioContext.tsx:129-133` **saute le fetch de montage dès que `initial` est défini**. Résultat : drafts, posts et médias restent vides à jamais, `reload()` n'est jamais appelé. Cascade : pas de variantes affichables, pas de `CaptionEditor` (rendu conditionnel `CreateWorkspace.tsx:150`), bibliothèque média vide, `postId` toujours `null` → publication désactivée en permanence. **Le flow opérateur s'arrête à l'étape 1.**
→ Correctif : hydrater côté serveur (comme `app/library/page.tsx` le fait) ou ne pas court-circuiter `reload()`.

### Étape 1 — Cadrer (IntentionForm) : la mieux finie

- Validation zod inline (`IntentionForm.tsx:132-138`, bordure danger + message), erreur serveur en `role="alert"` inline (`:313-327`), bouton en état `loading` pendant le POST, non-2xx converti en message (`:151-153`). ✔
- **Majeur** : `onCreated` (`CreateWorkspace.tsx:122-126`) ne fait que synchroniser plateforme/format dans l'aperçu — l'idée créée n'est ni ajoutée au state, ni suivie d'une génération, ni d'un passage à l'étape 2. Aucun feedback de succès (pas de toast).

### Étape 2 — Générer (texte) : BLOQUANT, aucun déclencheur

Aucun composant n'appelle d'endpoint de génération de variantes texte (vérifié par grep : seul `generate-visual` est appelé, `MediaStudio.tsx:45`). `VariantsCompare` a un état loading (`VariantsCompare.tsx:24-40`) et un empty state « Lance la génération… » (`:42-58`) mais les deux sont **du code mort** : `CreateWorkspace.tsx:131` ne rend le composant que si `variants.length > 0`, et `loading` n'est jamais passé.

### Étape 3 — Visuel (MediaStudio / Uploader) : bon niveau, un piège

- ✔ Barre de progression p50/p95 persistée en localStorage avec paliers « plus long que d'habitude » / « probablement bloqué » (`MediaStudio.tsx:135-142`, `lib/state/useGenerationEstimator.ts:109-114`). Original et testé.
- ✔ Erreurs en `toast.error` (`MediaStudio.tsx:76`), succès en toast. Uploader : machine à états idle/cropping/trimming/uploading/error avec écran d'erreur + Réessayer (`Uploader.tsx:194-200`).
- **Critique** : « Générer un visuel IA » actif même sans draft — `CreateWorkspace.tsx:142` passe `draftId={draft?.id ?? ''}` → POST sur `/api/admin/content-studio/drafts//generate-visual`, erreur HTTP garantie présentée comme un échec de génération.
- Mineur : le prompt visuel est un texte marketing en dur (`MediaStudio.tsx:39-41`).

### Étape 4 — Valider / Publier (PublishActionGroup) : l'opérateur est dans une impasse

- Quand `postId` est null : hint « Approuvez le draft pour activer la publication » (`PublishActionGroup.tsx:100-104`) — **mais aucun bouton « Approuver » n'existe dans le workspace create**. L'approve n'existe qu'en bulk dans la Library (`BulkActionBar.tsx:174`). L'opérateur est bloqué sans issue. **Majeur.**
- 3 modes (now/schedule/draft) chacun avec dialog Radix de confirmation (`PublishActionGroup.tsx:154-249`). ✔
- **Majeur** : aucune distinction image/vidéo dans la confirmation — le composant ne reçoit que `postId` (`:13`), texte générique ; l'opérateur confirme à l'aveugle le type de média.
- **Majeur** : date de programmation **passée acceptée** — `min` sur l'input n'empêche pas la saisie clavier, `executePublish` ne valide rien (`:51`) ; et le `min` (+1 h) interdit paradoxalement les 60 prochaines minutes via le picker.
- **Majeur** : la prop `disabled` (violations brand) et `onPublished` (reload post-publication) existent mais **ne sont jamais passées** par `CreateWorkspace.tsx:170-179` — le garde-fou brand-violations n'agit pas à la publication ; pas de refresh après publication.
- Double-clic : protégé indirectement (`Button loading` → `disabled`), mais le dialog reste fermable (ESC/overlay) pendant la requête en vol et « Annuler » n'est pas désactivé pendant `submitting` (`:156-163`).

## 2. Gestion d'état : 4 défauts dont 3 critiques

Modèle : `StudioProvider` (context React, `lib/state/StudioContext.tsx`) + hooks `useDraft`, `useDraftAutosave`. Pas de prop drilling notable. Mais :

1. **Critique — deux instances `useDraftAutosave` désynchronisées** : `CreateWorkspaceInner` en crée une (`CreateWorkspace.tsx:90`, transmise à PublishActionGroup) ; `CaptionEditor.tsx:25` en crée une **seconde**. Les frappes vont dans celle du CaptionEditor ; le `flush()` pré-publication (`PublishActionGroup.tsx:45`) vide **l'instance vide** → une caption modifiée dans la fenêtre de debounce (1,5 s) peut partir non sauvegardée.
2. **Critique — patch d'autosave perdu en cas d'erreur** : `StudioContext.tsx:247-249` vide `pendingRef.current` **avant** le fetch ; en cas d'échec le patch est jeté. L'UI affiche « Échec — réessayer » mais il n'y a rien à réessayer : les données sont perdues.
3. **Critique — le média sélectionné n'est jamais lié au draft** : `selectedMediaId` est un state local pur (`CreateWorkspace.tsx:55,145`) ; `DraftPatch.mediaId` existe (`StudioContext.tsx:47`) mais n'est jamais envoyé. L'aperçu peut montrer un média que le serveur ne connaît pas — la publication partirait avec l'ancien binding.
4. **Majeur — `reload()` incomplet** : recharge ideas/drafts/posts mais ni `jobs` ni `mediaItems` (`StudioContext.tsx:107-120`), contrairement à son docstring. Désync garantie après publication ou génération de visuel.

## 3. Aperçu média (PlatformPreview)

- **Vidéo** : `<video muted loop playsInline autoPlay>` **sans `controls`** (`media/PlatformPreview.tsx:256-267`). Pas de badge « VIDÉO », pas de durée, pas de play/pause — l'opérateur ne peut ni mettre en pause ni vérifier le contenu. (Le composant `VideoPlayer` qui corrige cela existe sur la branche backup.) **Majeur.**
- **Métadonnées** : `durationSec`, `width`, `height` existent dans le type (`lib/media/types.ts:21-24`) mais ne sont affichés **nulle part** dans l'aperçu (seule la vignette du `MediaPicker.tsx:180-197` montre la durée).
- Mineurs : caption tronquée à 14/18 mots avec « … » ajouté même si elle est plus courte (`:123,149`) ; preview Facebook ignore le format story/reel (`:28,173-189`) ; métriques factices en dur (« 1 247 j'aime ») ; `formatHashtags` passe par `dangerouslySetInnerHTML` avec échappement manuel correct mais fragile (`:88,279-285`).

## 4. Ergonomie et affordances

| Constat | Sévérité | Référence |
|---|---|---|
| Action bulk « Programmer » = **faux succès** : no-op assumé en commentaire, retourne `true` puis toast « N drafts prêts à programmer » — l'opérateur croit avoir programmé | Majeur | `library/BulkActionBar.tsx:164,180-188` |
| Boutons morts : « Rechercher ⌘K » du Topbar sans `onClick` (la palette ne s'ouvre qu'au clavier), cloche Notifications inerte | Majeur | `shell/Topbar.tsx:98-153` |
| Liens vers `create/{draftId}` depuis chaque carte Library et « Ouvrir en édition complète » → **404** (la route dynamique n'existe pas ; seul `create/page.tsx` existe ; `Sidebar.tsx:18` anticipe pourtant ce pattern) | Bloquant | `library/LibraryGrid.tsx:17,91`, `plan/QuickEditDrawer.tsx:220` |
| Édition rapide du planning : **double-clic** requis sur la carte, sans affordance ni alternative clavier | Majeur | `plan/Calendar.tsx:306,315` |
| Stepper : clic sur les étapes = no-op silencieux (`onStepClick` jamais câblé) avec `cursor:pointer` | Mineur | `create/Stepper.tsx`, `CreateWorkspace.tsx:94-97` |
| Duplication en Library : toast « Variante créée. Recharge la liste pour la voir. » — pas de refresh auto | Mineur | `library/LibraryClient.tsx:100` |
| Lien Home → `/library?postiz_state=draft` : paramètre non reconnu par `filtersFromSearchParams` — ne filtre rien | Mineur | `home/HomeClient.tsx:81`, `lib/library/filters.ts:85-95` |
| Pages `create` et `library` accessibles **sans** le flag `CONTENT_STUDIO_V2_ENABLED` (seules home et plan le vérifient) | Majeur | `app/home/page.tsx:23-53`, `app/plan/page.tsx:26-43` vs `app/create/page.tsx`, `app/library/page.tsx` |
| i18n : 100 % des libellés en dur en français, aucune lib — acceptable pour un back-office mono-langue, à acter | Mineur | transversal |

## 5. Accessibilité

Au-dessus de la moyenne : 34 fichiers avec aria/role, `aria-current="step"` (Stepper:88), `aria-pressed` sur les tuiles média, labels sur les ranges du trimmer, `role="alert"`/`role="status"` sur les indicateurs. Points faibles :
- **Majeur** : `CommandPalette` est un faux dialog maison (`div role="dialog" aria-modal`, `CommandPalette.tsx:117-131`) **sans focus-trap ni restitution de focus**.
- **Majeur** : `VideoTrimmer` — la poignée « Début » a `pointerEvents:'none'` et seule « Fin » le réactive (`VideoTrimmer.tsx:178-228`) : la borne de début est **inopérable à la souris** (clavier seulement).
- Mineur : `TabRow`/`TabGroup` en `role="tablist"` sans navigation flèches ni roving tabindex.

## 6. Gestion des erreurs côté client (inventaire complet des fetch)

Globalement correct — **aucune erreur totalement avalée** : toasts (`PublishActionGroup.tsx:71-73`, `MediaStudio.tsx:73-76`, `Uploader.tsx:88-128`, `JobQueue.tsx:77-142`, `QuickEditDrawer.tsx:65-66`, `useCalendarDnD.ts:180-185` avec rollback, `LibraryClient.tsx:96-122` avec rollback) ou inline (`IntentionForm`, autosave). Les `.catch(() => null)` repérés ne servent qu'à parser un body JSON défaillant. Deux exceptions :
- **Majeur** : `JobQueue` poll toutes les 30 s et toast l'erreur **à chaque cycle** en cas de panne API → spam de toasts sans backoff (`JobQueue.tsx:95-97`). Préférer un message inline persistant.
- **Majeur** : `StudioContext` expose `loading`/`error` d'hydratation (`:100-101`) que `CreateWorkspaceInner` ne lit jamais — un échec d'hydratation serait invisible.

## 7. Tests colocalisés : le cœur du produit n'est pas testé

**Avec tests (13)** : Stepper, StudioContext, useGenerationEstimator, useCalendarDnD, calendar-helpers, JobQueue, LibraryClient, MetricCard, activity, brand-health, filters, aggregator, selection. La couche `lib/` pure est bien couverte.

**Sans test — mutations/flux critique (majeur)** : `PublishActionGroup`, `CaptionEditor`, `IntentionForm`, `MediaStudio`, `CreateWorkspace`, `Uploader`, `BulkActionBar`, `QuickEditDrawer`. Puis : VariantsCompare, PreviewPane, PlatformPreview, MediaPicker, ImageCropper, VideoTrimmer, Calendar, LibraryGrid, HomeClient, tout le shell, toutes les primitives, `upload-image.ts`/`upload-video.ts`. **Le flux create→publish n'a aucun test composant.**

## 8. Architecture, style, code mort

- Un seul fichier >400 lignes : `plan/Calendar.tsx` (604 l., 5 sous-composants à extraire). Découpage globalement sain.
- **Majeur** : styles inline omniprésents (centaines d'objets `style={{}}` recréés à chaque render) + **injection de `<style>` dans `document.head` en side-effect de module** dans 4 fichiers (`primitives/Button.tsx:58-63`, `primitives/Dialog.tsx:115-120`, `library/LibraryClient.tsx:197-209`, `library/LibraryGrid.tsx:282-291`) — ordre d'import non déterministe, pas de SSR, pas de purge. Deux systèmes coexistent (Tailwind dans Button uniquement).
- Duplication : `TabRow` ≈ `TabGroup`, `toLocalISO` dupliqué, `SelectField` ≈ `FilterSelect`. Les primitives (Button, Dialog, Badge, Input, Skeleton) sont en revanche bien réutilisées.
- Code mort : états loading/empty de VariantsCompare inatteignables ; props `mediaByDraftId` non utilisées (`Calendar.tsx:400,567-573`) ; `MediaStudio.loading` jamais alimentée → skeletons MediaPicker inatteignables ; `?postiz_state` non parsé ; `Stepper.onStepClick`, `PublishActionGroup.disabled`/`onPublished`, `carouselSiblings` jamais fournis.
- ✔ **Zéro TODO/FIXME/HACK** dans le périmètre.
