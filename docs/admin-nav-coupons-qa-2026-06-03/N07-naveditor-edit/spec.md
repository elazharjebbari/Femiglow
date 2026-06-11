# N07 — `NavEditor` : édition locale (add / move / remove / update / validation client)

## Rôle & surface
Éditeur de navigation côté opérateur (`apps/web/src/components/admin/settings/NavEditor.tsx`),
rendu dans `SectionEditorShell`. Tableau éditable des items nav : ajout, déplacement ↑/↓ (avec
bornes), suppression, édition de champs (key/label/href/icon en `<input type=text>`, requiresRole en
`<select>`), renumérotation des positions (`normalizePositions`), suivi du `dirty`, et validation
client via `navSchema.safeParse` avec mapping des erreurs **par ligne**. Ce dossier couvre tout le
comportement **local** (réducteur + rendu), SANS réseau (le réseau est N08). Couche **C** (composant) +
**M** uniquement pour la validation client qui précède le fetch.
Fichier cible : `src/components/admin/settings/NavEditor.test.tsx` (nouveau).

## Fonctionnement optimal (ce qui DOIT se passer)
- **Rendu initial** : une ligne par `initialItems`, colonnes `# Key Label Href Icon Rôle Actions`. Le
  compteur affiche `{n} items`. Première ligne : bouton « Monter » (`aria-label="Monter"`) `disabled` ;
  dernière ligne : « Descendre » (`aria-label="Descendre"`) `disabled`.
- **Ajout** (« + Ajouter un item ») : append d'un item
  `{ key:'item-{n+1}', label:'Nouvel item', href:'/admin/nouveau', icon:'box', position:n }`. Le
  compteur passe à `n+1`. L'éditeur devient `dirty`.
- **Déplacement** : « Monter »/« Descendre » échange l'item avec son voisin puis `normalizePositions`
  (réindexe `position = index`). Aux bornes (index 0 vers le haut, dernier vers le bas) : bouton
  `disabled`, dispatch sans effet (`move` retourne `state` si target hors bornes).
- **Suppression** (« Suppr. », `aria-label="Supprimer {label}"`) : retire la ligne et
  `normalizePositions` sur le reste. Compteur −1.
- **Édition de champ** : taper dans `key/label/href/icon` patche l'item à l'index ; choisir une option
  du `<select>` Rôle met `requiresRole` (option `—` → `undefined`).
- **`dirty`** : `JSON.stringify(state.items) !== JSON.stringify(initialItems)`. Faux au montage ; vrai
  après toute mutation ; **redevient faux** si on annule manuellement pour revenir à l'état initial
  (ex. ajouter puis supprimer la même ligne donne un tableau identique → `dirty=false`).
- **Reset** (bouton du `SectionEditorShell`) : `dispatch({type:'reset', items:initialItems})` restaure
  `initialItems` ET vide les erreurs.
- **Validation client (au Save)** : `handleSave` construit `{ items: normalizePositions(state.items) }`
  puis `navSchema.safeParse`. Si échec : `set-errors` avec `{ path, message }` par issue, message global
  `« {N} erreur(s) à corriger. »`, **aucun fetch**. Les erreurs sont mappées par ligne via
  `errorByRow` (clé = `path[1]` numérique) et par champ via `path[2]`. La cellule en erreur reçoit
  `aria-invalid` et un anneau rouge ; un message rouge s'affiche sous le champ. Une liste récap (≤8)
  s'affiche en bas (`{path.join('.')} : {message}`).

## Contrat I/O
- **Props** : `{ initialItems: NavItem[], meta: ConfigMeta }`.
- **Actions réducteur** : `add | update{index,patch} | remove{index} | move{index,direction:-1|1} |
  reset{items} | set-errors{errors}`.
- **Sortie** : aucun événement émis hors `fetch` (couvert N08). État interne `items`, `errors`,
  `dirty`, `version`, `saving`, `error`, `success`.
- **Textes exacts** : « + Ajouter un item », « Suppr. », aria « Monter »/« Descendre »/« Supprimer
  {label} », « {N} erreur(s) à corriger. ».

## Cas limites & non-happy-path
- **Move aux bornes** : haut sur index 0 et bas sur dernier → no-op (bouton `disabled` + réducteur
  garde-fou). Vérifier les deux (UI désactivée ET réducteur sûr).
- **Renumérotation après remove au milieu** : supprimer l'index 1 sur 3 items → positions deviennent
  `[0,1]` (réindexées), pas `[0,2]`.
- **Validation : clé dupliquée** : éditer deux lignes pour partager une clé → Save → erreur globale,
  liste récap contient « Clé "…" dupliquée. », aucun fetch (spy `fetch` non appelé).
- **Validation : href invalide** (`admin/x`) → `aria-invalid` sur la cellule Href de la ligne
  concernée + message « href doit commencer par /. ».
- **Validation : label vidé** → erreur min sur la ligne.
- **`requiresRole` = `—`** → `requiresRole` retiré (`undefined`), pas envoyé comme chaîne `—`.
- **dirty faux après aller-retour** : add puis remove → `dirty === false`.
- **errorByRow ignore les issues sans index** (`path[1]` non numérique, ex. issue `superRefine` sur
  `['items']`) : ces erreurs n'apparaissent pas par ligne mais bien dans la **liste récap** globale.
- **A11y** : `table[role=grid]`, lignes `role=row` ; pas de violation axe critique/serious.

## Invariants couverts
- **NAV-INV-CONFIG** (côté client) : la validation client refuse clés dupliquées / champs invalides
  avant tout appel réseau.
- Cohérence positions = ordre (renumérotation déterministe).
- Pré-condition de **NAV-INV-PERSIST** : on n'envoie au serveur qu'un payload localement valide.

## Critères d'acceptation (observables)
- Montage : `getAllByRole('row')` (hors header) = `initialItems.length` ; bouton « Monter » de la 1ʳᵉ
  ligne `toBeDisabled()` ; « Descendre » de la dernière `toBeDisabled()`.
- Clic « + Ajouter un item » → texte `« 12 items »` (depuis 11) + champ value `Nouvel item`.
- Clic « Descendre » ligne 1 puis « Monter » ligne 2 → ordre restauré ; `dirty` repasse à faux.
- Clic « Suppr. » sur item milieu → compteur −1 ; positions réindexées contiguës.
- Save avec clé dupliquée → `getByText(/erreur\(s\) à corriger/)` + `fetch` NON appelé.
- Save avec href `admin/x` → input Href `aria-invalid="true"` + message « href doit commencer par /. ».
- Choisir Rôle `admin` puis `—` → l'item n'a plus de `requiresRole`.
- axe : 0 violation critique/serious.

## Points à vérifier — tous points de vue
- Backend : N/A (local) ; le payload construit = `{ items: normalizePositions(...) }`.
- Frontend : réducteur pur (immutabilité), bornes move, renumérotation, mapping erreurs par ligne.
- UI/UX/design : `disabled:opacity-40` sur boutons bornes, anneau `ring-red-300`, texte rouge sous champ.
- Data : positions toujours 0..n−1 après mutation ; `requiresRole` jamais `'—'`.
- A11y : aria-labels move/suppr, `role=grid/row`, `aria-invalid` sur champ erroné.
- i18n : libellés FR (le dossier ne couvre pas AR ; la nav admin est FR-only côté éditeur).
