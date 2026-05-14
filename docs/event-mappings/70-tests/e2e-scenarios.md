# 70.5 — Scénarios e2e détaillés

## S1 — Création d'une version puis activation

**Given** :
- Admin loggué sur `/admin/tracking/events/mappings`
- Une version active `v3` existe

**When** :
1. Click bouton "+ Créer une version"
2. Step 1 : choisir "Cloner une version existante" + sélectionner v3
3. Step 2 : nom "v4 — test e2e"
4. Step 3 : confirmer
5. Redirect auto vers `/v4/edit`
6. Éditer 1 cellule (purchase × Meta : `Purchase` → `PurchasePremium`)
7. Click "Sauvegarder" → modal confirm → "Créer la nouvelle version"
8. Redirect vers `/v5` (la nouvelle version créée par l'édition)
9. Retour à la liste `/mappings`
10. Click "Activer v5" → confirm
11. Vérifier v5 = active, v3 = archived

**Then** :
- v3 reste en DB avec status=archived, archived_at set
- v5 active, activated_at set
- 4 entrées audit log (create v4, edit v4→v5, activate v5)

## S2 — Tester un mapping sans l'activer

**Given** : v4 draft existe avec mappings modifiés

**When** :
1. Goto `/v4/edit`
2. Click bouton "Tester avant sauvegarde"
3. Modal test ouvre
4. Choisir event "purchase" + click "Lancer le test"

**Then** :
- 6 résultats affichés (1 par provider)
- Meta affiche "PurchasePremium" (de la modif locale)
- Pas d'écriture DB, pas d'appel réseau réel

## S3 — Exporter et importer (round-trip)

**Given** : v3 active

**When** :
1. Click "Exporter GTM"
2. Choisir env "production" + confirm
3. Fichier `femiglow-gtm-v3-production-20260513.json` téléchargé
4. (Hors UI) Parse le JSON, valide selon schema GTM Container

**Then** :
- `exportFormatVersion === 2`
- `containerVersion.tag.length` ≥ 5 (au moins 1 par event actif)
- Tous les `firingTriggerId` référencent un trigger existant
- sha256 cohérent

## S4 — Reset au default avec récap

**Given** : v4 active (différente de __default__)

**When** :
1. Click "↩ Reset au default"
2. Modal s'ouvre avec récap des 3 changements top
3. Confirm "Revenir au default factory"

**Then** :
- v4 status=archived
- __default__ status=active
- Toast "Mapping par défaut restauré"
- List re-fetch, badges mis à jour
- Audit log entry action='reset_to_default'

## S5 — Comparer 2 versions

**Given** : v2 et v3 existent (3 cellules diffèrent)

**When** :
1. Goto `/mappings`
2. Cocher checkbox compare sur v2 et v3
3. Click "Comparer 2 versions →"
4. Page diff charge

**Then** :
- 3 lignes 🟡 modifiées listées
- Click sur une ligne → highlight visuel
- Bouton "Adopter v3 et l'activer" présent (visible seulement si une des deux est draft/archived et l'autre active)

## S6 — Tenter de supprimer une version active → 403

**Given** : v3 active

**When** :
1. Sur la row v3, click "Supprimer"
2. Modal "Suppression impossible" affichée

**Then** :
- Pas de DELETE API call
- Modal contient le message "Active une autre version d'abord"
- Bouton "Compris" ferme

## S7 — Soft-delete puis restore

**Given** : v2 archived

**When** :
1. Click "Supprimer" sur v2
2. Confirm "Supprimer"
3. v2 disparaît de la liste (default filter omit deleted)
4. Toggle "Inclure supprimées"
5. v2 réapparaît en grisé avec bouton "Restaurer"
6. Click "Restaurer" → v2 redevient archived

**Then** :
- Audit log : delete + restore
- v2.deleted_at temporairement set puis null

## S8 — Validation Zod inline

**Given** : edit mode sur une cellule Meta

**When** :
1. Saisir `pur-chase` (kebab interdit) dans mappedName
2. Sortir du field

**Then** :
- Erreur inline rouge "Le nom Meta doit matcher /^[A-Za-z][A-Za-z0-9_ ]{0,39}$/"
- Bouton "Appliquer" disabled
- Si essai forcé via Enter : pas de save

## S9 — Concurrence (V2 — out of scope V1)

Documenté pour mémoire :
- Admin A édit v3 et sauve → v4 created
- Admin B édit v3 en parallèle → save → v5 created
- Pas de conflit (chacun crée sa propre version dérivée)
- Activate v4 ou v5 = au last-write-wins

## S10 — Accessibilité keyboard-only

**Given** : Admin sans souris, écran lecteur actif

**When** :
1. Tab depuis URL bar pour atteindre `/mappings`
2. Tab dans la liste pour focus sur une version
3. Enter pour ouvrir actions menu
4. Choisir "Éditer"
5. Tab dans la matrice
6. Flèches pour naviguer entre cellules
7. Enter sur une cellule pour ouvrir l'éditeur popover
8. Tab dans le popover, Enter pour appliquer
9. Esc pour fermer popover
10. Ctrl+S pour sauvegarder (raccourci)

**Then** :
- Focus visible à chaque étape
- Pas de focus trap involontaire
- Pas d'éléments inaccessibles
- Annonces lecteur d'écran cohérentes

## S11 — Import JSON externe

**Given** : Admin a un fichier `my-mapping.json` exporté ailleurs

**When** :
1. Click "Importer depuis JSON" sur la liste
2. Wizard step 1 : choisir "Importer"
3. File picker : choisir le fichier
4. Validation Zod automatique
5. Si valide : passer à step 2 (nom)
6. Si invalide : afficher détail erreur + bouton "Choisir autre fichier"

**Then** :
- Si valide : version créée en draft avec les mappings importés
- Audit log meta={ source: 'import', filename: 'my-mapping.json' }
