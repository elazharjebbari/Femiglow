# Plan de test — Content Studio v2 — Phase 2 : couverture exhaustive

| Champ | Valeur |
|---|---|
| **Version** | 2.0 |
| **Date** | 2026-05-24 |
| **Auteur** | Agent IA (Claude Opus 4.7) |
| **Prérequis** | Phase 1 terminée (558 tests verts, commit `ea8b0cc`) |
| **Objectif** | 53 scénarios opérateur restants + 7 bugs/lacunes produit + tests exhaustifs |

---

## 1. Résumé exécutif

### 1.1 Contexte

La Phase 1 a mis en place 558 tests (433 Vitest + 125 Playwright) couvrant 37 scénarios opérateur et a découvert 2 bugs de production. L'audit exhaustif a révélé **53 scénarios opérateur testables via l'UI** qui ne sont pas encore couverts, plus **7 lacunes produit** (fonctionnalités sans composant v2).

### 1.2 Objectifs Phase 2

1. Couvrir les **10 scénarios P0** (bloquent le workflow) par des tests E2E + Vitest
2. Couvrir les **29 scénarios P1** (dégradent l'UX) par des tests E2E
3. Couvrir les **14 scénarios P2** (edge cases) par des tests E2E + Vitest
4. Corriger les **4 bugs produit** découverts par l'audit (reject/cancel sans UI, budget sans affichage, session expiry)
5. Créer les **3 composants manquants** identifiés comme lacunes critiques

### 1.3 Critères de succès Phase 2

| Indicateur | Phase 1 (actuel) | Phase 2 (cible) |
|---|---|---|
| Tests Vitest | 433 | ≥ 530 |
| Tests Playwright E2E | 125 | ≥ 250 |
| Total tests | 558 | ≥ 780 |
| Scénarios opérateur E2E | 37 / 90 | 90 / 90 |
| Bugs produit corrigés | 2 | 6 |
| Composants v2 manquants | 7 | ≤ 3 |

---

## 2. Architecture des tests — rappel du modèle 4 couches

```
Couche 4 — Playwright E2E    │ Opérateur clique dans Chrome
Couche 3 — Vitest + RTL + MSW │ Composant dans son contexte
Couche 2 — Vitest + MSW       │ Service / route handler
Couche 1 — Vitest unit        │ Fonction pure
```

Chaque scénario est affecté à la couche la plus basse qui peut le vérifier de manière fiable, PLUS une couche E2E si le scénario implique une interaction opérateur visible.

---

## 3. Inventaire complet — 53 scénarios + stratégie par scénario

### 3.1 Bloc A — Upload et média (13 scénarios)

#### A1. Upload image via file picker (P0)

| Aspect | Détail |
|---|---|
| **Action opérateur** | Click "Importer un média" → parcourir → sélectionner JPEG → ImageCropper s'ouvre |
| **Composant** | `Uploader.tsx` L159 `inputRef.current?.click()`, L43–53 `handleFile()` |
| **Sélecteur Playwright** | `page.setInputFiles('input[type="file"][accept*="image"]', 'e2e/fixtures/test-image.jpg')` |
| **Assertion** | `expect(page.locator('.cs-cropper')).toBeVisible()` |
| **Couche** | E2E (Couche 4) |
| **Prérequis** | Fixture `e2e/fixtures/test-image.jpg` (100×100 JPEG) |

#### A2. Upload image drag-and-drop (P0)

| Aspect | Détail |
|---|---|
| **Action** | Glisser une image sur la zone pointillée → cropper s'ouvre |
| **Sélecteur** | `page.locator('[data-uploader-dropzone]')` ou via `setInputFiles` (fallback car drag natif limité en headless) |
| **Assertion** | `.cs-cropper` visible |
| **Couche** | E2E |

#### A3. Upload réseau échoue → "Réessayer" (P0)

| Aspect | Détail |
|---|---|
| **Action** | Cropper → "Recadrer et importer" → serveur 500 → panneau erreur |
| **Setup** | `page.route('**/upload-and-crop', r => r.fulfill({ status: 500, body: JSON.stringify({ error: { message: 'S3 indisponible' } }) }))` |
| **Assertion** | `expect(page.getByText(/réessayer/i)).toBeVisible()` |
| **Couche** | E2E + Vitest RTL (Uploader.test.tsx) |

#### A4. Upload vidéo réseau échoue (P0)

| Aspect | Détail |
|---|---|
| **Action** | Trimmer → "Découper et importer" → serveur 500 |
| **Setup** | `page.route('**/upload-and-trim', r => r.fulfill({ status: 500, ... }))` |
| **Assertion** | Panneau erreur + bouton "Réessayer" |
| **Couche** | E2E |

#### A5. Type fichier non supporté → erreur (P1)

| Aspect | Détail |
|---|---|
| **Action** | Sélectionner un .pdf via file picker |
| **Sélecteur** | `page.setInputFiles('input[type="file"]', 'e2e/fixtures/test.pdf')` |
| **Assertion** | `page.getByText(/type non supporté/i)` visible |
| **Couche** | E2E + Vitest RTL |

#### A6. Spinner pendant upload (P1)

| Aspect | Détail |
|---|---|
| **Action** | Upload en cours → texte "Traitement de {nom}" visible |
| **Setup** | `page.route('**/upload-and-crop', r => new Promise(res => setTimeout(() => res(r.fulfill({status:200,...})), 3000)))` |
| **Assertion** | `page.getByText(/traitement de/i)` visible avant résolution |
| **Couche** | E2E |

#### A7. Upload réussi → toast + dialog ferme (P1)

| Aspect | Détail |
|---|---|
| **Action** | Crop → confirm → succès → "Image importée avec succès" |
| **Setup** | Mock 200 sur upload-and-crop |
| **Assertion** | Toast visible + dialog "Importer un média" fermé |
| **Couche** | E2E |

#### A8. Aspect ratio buttons ImageCropper (P1)

| Aspect | Détail |
|---|---|
| **Action** | Click "1 : 1" → "4 : 5" → "9 : 16" → "Libre" |
| **Sélecteur** | `page.getByRole('button', { name: '1 : 1' })` etc. |
| **Assertion** | Bouton cliqué a le style actif (background change) |
| **Couche** | E2E |

#### A9. "Recadrer et importer" disabled avant crop complete (P1)

| Aspect | Détail |
|---|---|
| **Action** | Ouvrir cropper sans avoir interagi avec le crop area |
| **Assertion** | `expect(page.getByRole('button', { name: /recadrer et importer/i })).toBeDisabled()` |
| **Couche** | E2E |

#### A10. Trim vidéo > 90s → bouton disabled + danger (P1)

| Aspect | Détail |
|---|---|
| **Action** | Charger une vidéo de 2 min, laisser la plage > 90s |
| **Assertion** | Bouton "Découper et importer" disabled + texte durée en rouge |
| **Couche** | E2E (besoin fixture vidéo > 90s) + Vitest unit |

#### A11. Trim vidéo < 1s → bouton disabled (P1)

| Aspect | Détail |
|---|---|
| **Action** | Réduire la plage à < 1s |
| **Assertion** | Bouton disabled |
| **Couche** | Vitest RTL (pas besoin de vrai Chrome pour ça) |

#### A12. Zoom slider ImageCropper (P2)

| Aspect | Détail |
|---|---|
| **Action** | `page.locator('[aria-label="Zoom"]').fill('2.5')` |
| **Assertion** | Zoom appliqué (valeur du range = 2.5) |
| **Couche** | E2E |

#### A13. Rotation 90° cycle complet (P2)

| Aspect | Détail |
|---|---|
| **Action** | Click `[aria-label="Rotation 90°"]` 4× |
| **Assertion** | Après 4 clics, rotation revenue à 0 |
| **Couche** | E2E |

---

### 3.2 Bloc B — Publication complète (8 scénarios)

#### B1. "Publier maintenant" → confirm → toast succès (P0)

| Aspect | Détail |
|---|---|
| **Action** | Dropdown "Publier" → "Publier maintenant" → dialog "Publier maintenant ?" → "Confirmer" |
| **Setup** | Draft approuvé avec postId. `page.route('**/publish-now', r => r.fulfill({ status: 201, body: JSON.stringify({ result: { jobId: 'j1' } }) }))` |
| **Assertion** | Toast `Publication lancée` visible |
| **Couche** | E2E (séquentiel après golden path) + Vitest RTL |

#### B2. "Publier maintenant" → erreur serveur → toast erreur (P0)

| Aspect | Détail |
|---|---|
| **Setup** | Mock 422 `{ error: { message: 'Post non approuvé' } }` |
| **Assertion** | Toast `Publication : Post non approuvé` visible |
| **Couche** | E2E + Vitest RTL |

#### B3. "Programmer" → datetime → confirm → toast (P0)

| Aspect | Détail |
|---|---|
| **Action** | Dropdown → "Programmer" → dialog → input `type="datetime-local"` → fill `2026-06-15T10:00` → "Programmer" |
| **Setup** | Mock `POST /schedule` → 201 |
| **Assertion** | Toast `Publication programmée` |
| **Couche** | E2E + Vitest RTL |

#### B4. "Brouillon Postiz" → confirm → toast (P0)

| Aspect | Détail |
|---|---|
| **Action** | Dropdown → "Brouillon Postiz" → dialog → "Envoyer" |
| **Setup** | Mock `POST /draft-on-provider` → 201 |
| **Assertion** | Toast `Brouillon envoyé au provider` |
| **Couche** | E2E + Vitest RTL |

#### B5. Publish button disabled sans postId (P1)

| Aspect | Détail |
|---|---|
| **Action** | Load /create sans draft approuvé |
| **Assertion** | Bouton "Publier" disabled + texte `Approuvez le draft pour activer la publication.` |
| **Couche** | E2E (déjà partiellement couvert) + Vitest RTL |

#### B6. Autosave flush avant publish (P1)

| Aspect | Détail |
|---|---|
| **Action** | Avoir des modifications non sauvées → cliquer Publier maintenant |
| **Assertion** | PATCH /drafts est appelé AVANT POST /publish-now |
| **Couche** | Vitest RTL (order of fetch calls via MSW) |

#### B7. "Annuler les ajustements" reset tout (P2)

| Aspect | Détail |
|---|---|
| **Action** | Zoom + rotation → click `[aria-label="Annuler les ajustements"]` |
| **Assertion** | Zoom range reset à 1 |
| **Couche** | E2E |

#### B8. Play/Pause toggle vidéo dans VideoTrimmer (P2)

| Aspect | Détail |
|---|---|
| **Action** | Click play → assert label "Pause" → auto-stop à end |
| **Couche** | E2E (besoin fixture vidéo) |

---

### 3.3 Bloc C — Autosave et erreurs (4 scénarios)

#### C1. Autosave PATCH 500 → "Échec — réessayer" (P0)

| Aspect | Détail |
|---|---|
| **Action** | Edit caption alors que serveur renvoie 500 |
| **Setup** | `page.route('**/drafts/*', r => r.fulfill({ status: 500 }))` |
| **Assertion** | `expect(page.getByRole('alert')).toContainText(/échec/i)` |
| **Couche** | E2E + Vitest RTL (existant useDraftAutosave.test — enrichir) |

#### C2. "Modifications non sauvées" warning (P1)

| Aspect | Détail |
|---|---|
| **Action** | Type 1 char → immédiatement vérifier avant debounce 1.5s |
| **Assertion** | `page.getByText(/modifications non sauvées/i)` visible |
| **Couche** | E2E |

#### C3. Autosave 401 (session expirée) → indicateur erreur (P1)

| Aspect | Détail |
|---|---|
| **Setup** | `page.route('**/drafts/*', r => r.fulfill({ status: 401 }))` |
| **Assertion** | `role="alert"` visible (pas de perte silencieuse) |
| **Couche** | E2E |

#### C4. StudioProvider hydration failure → état erreur (P0)

| Aspect | Détail |
|---|---|
| **Setup** | `page.route('**/ideas*', r => r.fulfill({ status: 500 }))` + idem drafts + posts |
| **Assertion** | Page /create affiche un indicateur d'erreur (pas blank) |
| **Couche** | E2E |

---

### 3.4 Bloc D — Deep linking et navigation (3 scénarios)

#### D1. `/create/[draftId]` charge le bon draft (P0)

| Aspect | Détail |
|---|---|
| **Action** | Naviguer vers `/admin/content-studio-v2/create/[known-draft-id]` |
| **Assertion** | Caption editor contient le texte du draft, stepper pas sur "Cadrer" |
| **Couche** | E2E |

#### D2. `/create/[invalid-id]` → pas de crash (P2)

| Aspect | Détail |
|---|---|
| **Action** | `goto('/admin/content-studio-v2/create/nonexistent-id')` |
| **Assertion** | Pas de JS error, stepper sur "Cadrer", IntentionForm visible |
| **Couche** | E2E |

#### D3. Feature flag disabled → EmptyState (P1)

| Aspect | Détail |
|---|---|
| **Setup** | Impossible de changer le flag en runtime. Tester via mock API 403 |
| **Assertion** | Message "Module désactivé" visible |
| **Couche** | E2E (conditionnel) |

---

### 3.5 Bloc E — VariantsCompare avancé (5 scénarios)

#### E1. Variante bloquée → bouton "Bloquée (violations)" disabled (P0 — brand safety)

| Aspect | Détail |
|---|---|
| **Action** | Après génération, si un draft a une violation `blocked`, le bouton est disabled |
| **Assertion** | `page.getByRole('button', { name: /bloquée/i })` disabled |
| **Couche** | E2E (nécessite un draft avec "miracle" dans la caption pour trigger brand-rules) + Vitest RTL |

#### E2. Violations badges visibles (P1)

| Aspect | Détail |
|---|---|
| **Assertion** | `page.locator('[aria-label="Violations brand"]')` visible |
| **Couche** | Vitest RTL (VariantsCompare.test.tsx enrichir) |

#### E3. "Voir les différences" checkbox → `<mark>` (P2)

| Aspect | Détail |
|---|---|
| **Action** | Check "Voir les différences" checkbox |
| **Assertion** | `page.locator('mark')` count > 0 |
| **Couche** | E2E |

#### E4. VariantsCompare loading "Génération en cours…" (P1)

| Aspect | Détail |
|---|---|
| **Setup** | Delay `/ideas/:id/generate` response 5s |
| **Assertion** | `page.getByText(/génération des variantes en cours/i)` visible |
| **Couche** | E2E |

#### E5. VariantsCompare empty "Lance la génération…" (P1)

| Aspect | Détail |
|---|---|
| **Action** | Fresh /create sans draft |
| **Assertion** | `page.getByText(/lance la génération/i)` visible |
| **Couche** | E2E (déjà implicitement couvert mais pas asserté explicitement) |

---

### 3.6 Bloc F — Stepper avancé (2 scénarios)

#### F1. Stepper → "Valider" actif quand media + caption (P1)

| Aspect | Détail |
|---|---|
| **Condition** | Draft `needs_review` + hasMedia + caption non vide |
| **Assertion** | `page.locator('[data-step="validate"][data-state="active"]')` |
| **Couche** | E2E (à la fin du golden path, après visual gen) |

#### F2. Draft rejeté → stepper retour "Cadrer" (P1)

| Aspect | Détail |
|---|---|
| **Action** | Load un draft en status `rejected` |
| **Assertion** | `page.locator('[data-step="frame"][aria-current="step"]')` |
| **Couche** | Vitest unit (deriveActiveStep — déjà couvert) + E2E si un draft rejected existe |

---

### 3.7 Bloc G — Drag-and-drop calendrier (4 scénarios)

#### G1. Drag card → jour futur → toast succès (P1)

| Aspect | Détail |
|---|---|
| **Action** | `page.dragAndDrop('[data-testid="calendar-card-{id}"]', '[data-testid="day-2026-06-10"]')` |
| **Setup** | `page.route('**/reschedule', r => r.fulfill({ status: 200, body: '{"post":{...}}' }))` |
| **Assertion** | Toast `Post reprogrammé` |
| **Couche** | E2E |

#### G2. Drag → jour passé → toast erreur + rollback (P1)

| Aspect | Détail |
|---|---|
| **Action** | Drag vers un day cell passé |
| **Assertion** | Toast `Impossible de reprogrammer dans le passé` + card reste à sa place |
| **Couche** | E2E |

#### G3. Drag → PATCH 500 → rollback (P1)

| Aspect | Détail |
|---|---|
| **Setup** | Mock PATCH 500 |
| **Assertion** | Toast erreur + card revient à sa position originale |
| **Couche** | E2E |

#### G4. Drag même jour = no-op (P2)

| Aspect | Détail |
|---|---|
| **Action** | Drag card vers sa propre cellule |
| **Assertion** | Aucun PATCH déclenché (vérifier via page.route counter) |
| **Couche** | E2E |

---

### 3.8 Bloc H — JobQueue interactions (6 scénarios)

#### H1. Retry failed job → toast (P1)

| Aspect | Détail |
|---|---|
| **Setup** | Seed un job `failed` dans la base (ou mock endpoint list) |
| **Action** | Click `[data-testid="job-retry-{id}"]` |
| **Assert** | Toast `Reprise demandée.` |
| **Couche** | E2E + Vitest RTL (existant JobQueue.test.tsx) |

#### H2. Cancel queued job → toast + disparaît (P1)

| Aspect | Détail |
|---|---|
| **Action** | Click cancel sur un job `queued` |
| **Assert** | Toast `Job annulé.` + row disparaît |
| **Couche** | E2E + Vitest RTL |

#### H3. JobQueue vide "Aucun job actif" (P1)

| Aspect | Détail |
|---|---|
| **Assert** | `page.getByText(/aucun job actif/i)` visible |
| **Couche** | E2E |

#### H4. Retry/Cancel disabled quand publishing (P1)

| Aspect | Détail |
|---|---|
| **Setup** | Job avec status `publishing` |
| **Assert** | Deux boutons disabled |
| **Couche** | Vitest RTL (JobQueue.test enrichir) |

#### H5. Refresh button → requête (P2)

| Aspect | Détail |
|---|---|
| **Action** | Click "Rafraîchir" |
| **Assert** | GET /publish-jobs appelé |
| **Couche** | E2E |

#### H6. JobQueue réseau 500 → toast erreur (P1)

| Aspect | Détail |
|---|---|
| **Setup** | `page.route('**/publish-jobs*', r => r.fulfill({ status: 500 }))` |
| **Action** | Click Rafraîchir |
| **Assert** | Toast erreur |
| **Couche** | E2E |

---

### 3.9 Bloc I — Library erreurs et edge cases (5 scénarios)

#### I1. Duplication échoue → toast erreur (P1)

| Aspect | Détail |
|---|---|
| **Setup** | Mock `/variation` → 500 |
| **Action** | Hover card → click "Dupliquer" |
| **Assert** | Toast `La duplication a échoué.` |
| **Couche** | E2E |

#### I2. Archive rollback sur erreur → card réapparaît (P1)

| Aspect | Détail |
|---|---|
| **Setup** | Mock `/archive` → 500 |
| **Action** | Click archiver sur une card |
| **Assert** | Card disparaît puis réapparaît + toast erreur |
| **Couche** | E2E |

#### I3. Bulk approve partiel → toast warning (P1)

| Aspect | Détail |
|---|---|
| **Setup** | 3 items sélectionnés, 1er approve OK, 2ème 500 |
| **Assert** | Toast `1 OK / 1 en échec.` |
| **Couche** | E2E (intercept avec logique conditionnelle) |

#### I4. Library filtres → 0 résultats → empty state (P1)

| Aspect | Détail |
|---|---|
| **Action** | Appliquer des filtres très restrictifs |
| **Assert** | `Aucun élément ne correspond à ces filtres` visible |
| **Couche** | E2E |

#### I5. QuickEditDrawer date invalide → toast (P1)

| Aspect | Détail |
|---|---|
| **Action** | Ouvrir drawer → vider l'input date → sauvegarder |
| **Assert** | Toast `Date invalide.` |
| **Couche** | E2E |

---

### 3.10 Bloc J — MediaPicker (6 scénarios)

#### J1. MediaPicker vide "Aucun média trouvé" (P1)

| Aspect | Détail |
|---|---|
| **Condition** | Aucun média dans la base |
| **Assert** | `page.getByText(/aucun média trouvé/i)` |
| **Couche** | E2E (si base vide) + Vitest RTL |

#### J2. Filtre compartiment (Tous/Importés/IA) (P1)

| Aspect | Détail |
|---|---|
| **Action** | Click tab "IA" |
| **Assert** | Seuls items `ai_generated` visibles |
| **Couche** | Vitest RTL (MediaPicker.test.tsx) |

#### J3. Filtre type (Image/Vidéo) (P1)

| Aspect | Détail |
|---|---|
| **Action** | Click tab "Vidéo" |
| **Assert** | Seuls items vidéo affichés |
| **Couche** | Vitest RTL |

#### J4. Recherche alt text (P1)

| Aspect | Détail |
|---|---|
| **Action** | Type dans la recherche média |
| **Assert** | Items filtrés par alt |
| **Couche** | Vitest RTL |

#### J5. Loading skeletons (8 skeletons) (P1)

| Aspect | Détail |
|---|---|
| **Condition** | `loading=true` |
| **Assert** | 8 `.cs-skeleton` éléments |
| **Couche** | Vitest RTL |

#### J6. Badge "IA" sur media ai_generated (P2)

| Aspect | Détail |
|---|---|
| **Assert** | Badge "IA" visible sur les tiles ai_generated |
| **Couche** | Vitest RTL |

---

### 3.11 Bloc K — Raccourcis clavier avancés (3 scénarios)

#### K1. `?` ouvre le KeyboardCheatsheet (P2)

| Aspect | Détail |
|---|---|
| **Action** | `page.keyboard.press('?')` (sur une page sans input focus) |
| **Assert** | Modal raccourcis visible |
| **Couche** | E2E |

#### K2. `g p` navigue vers /plan (P2)

| Aspect | Détail |
|---|---|
| **Action** | `page.keyboard.press('g')` puis `page.keyboard.press('p')` |
| **Assert** | URL contient `/plan` |
| **Couche** | E2E |

#### K3. `Ctrl+Shift+L` toggle theme (P2)

| Aspect | Détail |
|---|---|
| **Action** | `page.keyboard.press('ControlOrMeta+Shift+l')` |
| **Assert** | `data-theme` change |
| **Couche** | E2E |

---

### 3.12 Bloc L — Home dashboard edge cases (3 scénarios)

#### L1. TopPerformersCard vide (P2)

| Aspect | Détail |
|---|---|
| **Assert** | `Aucun snapshot disponible` visible |
| **Couche** | Vitest RTL |

#### L2. AccountHealthCard vide (P1)

| Aspect | Détail |
|---|---|
| **Assert** | `Aucun compte social synchronisé` visible |
| **Couche** | Vitest RTL |

#### L3. DraftsAwaitingCard danger tone ≥ 48h (P1)

| Aspect | Détail |
|---|---|
| **Setup** | Mock `oldestAgeHours: 48` |
| **Assert** | Bordure/background danger visible |
| **Couche** | Vitest RTL |

---

## 4. Bugs produit à corriger

### Bug 1 — Pas de bouton "Rejeter" dans v2 (P0)

**Constat** : `POST /drafts/:id/reject` existe mais aucun composant v2 ne l'appelle. L'opérateur ne peut pas rejeter un draft depuis v2.

**Correction** : Ajouter un bouton "Rejeter" dans `VariantsCompare.tsx` (sur chaque variante non sélectionnée) avec un `<Dialog>` de confirmation + input `reason`.

**Tests** :
- Vitest RTL : bouton visible, click → dialog, confirm → onReject called
- E2E : click rejeter → dialog → confirm → draft status change → toast

### Bug 2 — Pas de bouton "Annuler" pour un post programmé (P0)

**Constat** : `POST /posts/:id/cancel` existe mais aucun composant v2 ne l'appelle. Un post schedulé ne peut pas être annulé depuis v2.

**Correction** : Ajouter un bouton "Annuler la publication" dans `QuickEditDrawer.tsx` (visible quand `post.status === 'scheduled'`).

**Tests** :
- Vitest RTL : bouton visible quand scheduled, click → confirm dialog → mock cancel → toast
- E2E : open drawer on scheduled post → click annuler → confirm → toast `Publication annulée`

### Bug 3 — Pas d'affichage du budget IA restant (P1)

**Constat** : `GET /generation-runs` retourne `{ budget: { dailyBudgetCents, dailySpentCents, remainingCents } }` mais aucun composant ne l'affiche.

**Correction** : Ajouter un `<BudgetIndicator>` dans `MediaStudio.tsx` qui affiche `remainingCents / dailyBudgetCents` avec une barre de progression.

**Tests** :
- Vitest RTL : render avec budget data → barre visible → couleur change à < 20%
- E2E : /create → budget indicator visible avec valeur

### Bug 4 — Session expirée → perte silencieuse (P1)

**Constat** : L'autosave reçoit 401 mais affiche juste "Échec" sans proposer de re-login.

**Correction** : Dans `StudioContext.tsx`, détecter le status 401 et afficher un lien "Session expirée — se reconnecter" au lieu de "Échec — réessayer".

**Tests** :
- Vitest RTL : mock 401 → assert "Session expirée" + lien /admin/login
- E2E : intercept 401 → assert lien visible

---

## 5. Fixtures de test

### 5.1 Fichiers fixtures E2E

Créer `apps/web/e2e/fixtures/` avec :

| Fichier | Usage | Taille |
|---|---|---|
| `test-image.jpg` | Upload image standard | 100×100 JPEG, ~5 KB |
| `test-image-large.jpg` | Test > 25 MB | Généré via `dd` (26 MB) |
| `test-video.mp4` | Upload vidéo standard | 5s H.264, ~50 KB |
| `test-video-long.mp4` | Test > 90s trim | 95s H.264, ~200 KB |
| `test.pdf` | Test type non supporté | 1 page, ~1 KB |
| `test-image.webp` | Test format WebP | 100×100, ~3 KB |

### 5.2 Génération des fixtures

```bash
# JPEG 100x100
convert -size 100x100 xc:#f5ebe3 e2e/fixtures/test-image.jpg

# Large JPEG > 25 MB
dd if=/dev/zero bs=1M count=26 | convert - -size 100x100 jpeg:- > e2e/fixtures/test-image-large.jpg
# Ou plus simple :
truncate -s 26M e2e/fixtures/test-image-large.jpg

# MP4 5 secondes
ffmpeg -f lavfi -i color=c=#f5ebe3:size=320x240:duration=5 -c:v libx264 -pix_fmt yuv420p e2e/fixtures/test-video.mp4

# MP4 95 secondes
ffmpeg -f lavfi -i color=c=#f5ebe3:size=320x240:duration=95 -c:v libx264 -pix_fmt yuv420p e2e/fixtures/test-video-long.mp4

# PDF
echo "%PDF-1.0 1 0 obj << /Type /Catalog >> endobj" > e2e/fixtures/test.pdf

# WebP
convert -size 100x100 xc:#f5ebe3 e2e/fixtures/test-image.webp
```

---

## 6. Plan d'action détaillé

### Phase 2.0 — Prérequis (0.5 jour)

| # | Tâche | Livrable |
|---|---|---|
| 2.0.1 | Générer les fixtures de test (6 fichiers) | `e2e/fixtures/` |
| 2.0.2 | Ajouter `e2e/fixtures/` au `.gitignore` des snapshots (pas des fixtures) | `.gitignore` |
| 2.0.3 | Vérifier que les 558 tests existants passent toujours | 558 green |

### Phase 2.1 — Bugs produit (2 jours)

| # | Tâche | Livrable | Tests |
|---|---|---|---|
| 2.1.1 | Bug 1 : bouton "Rejeter" dans VariantsCompare | Composant + dialog | ~8 Vitest + 3 E2E |
| 2.1.2 | Bug 2 : bouton "Annuler" dans QuickEditDrawer | Composant + dialog | ~6 Vitest + 3 E2E |
| 2.1.3 | Bug 3 : BudgetIndicator dans MediaStudio | Composant + fetch | ~6 Vitest + 2 E2E |
| 2.1.4 | Bug 4 : Session expirée → lien re-login | StudioContext fix + CaptionEditor | ~4 Vitest + 2 E2E |
| **Total Phase 2.1** | | | **~34 tests** |

### Phase 2.2 — Bloc A : Upload + Media (2 jours)

| # | Tâche | Volume |
|---|---|---|
| 2.2.1 | `e2e/content-studio-v2/upload-image.spec.ts` (A1–A3, A5–A9) | 9 E2E |
| 2.2.2 | `e2e/content-studio-v2/upload-video.spec.ts` (A4, A10–A11) | 4 E2E |
| 2.2.3 | `e2e/content-studio-v2/crop-controls.spec.ts` (A8, A9, A12, A13, B7) | 5 E2E |
| 2.2.4 | `Uploader.test.tsx` enrichi (A3, A4, A5, A6, A7) | 5 Vitest RTL |
| 2.2.5 | `ImageCropper.test.tsx` (A8, A9, A12, A13) | 4 Vitest RTL |
| 2.2.6 | `VideoTrimmer.test.tsx` (A10, A11, B8) | 3 Vitest RTL |
| **Total Phase 2.2** | | **~30 tests** |

### Phase 2.3 — Bloc B+C : Publication + Autosave (1.5 jours)

| # | Tâche | Volume |
|---|---|---|
| 2.3.1 | `e2e/content-studio-v2/publish-flow.spec.ts` (B1–B4) | 4 E2E |
| 2.3.2 | `e2e/content-studio-v2/publish-errors.spec.ts` (B2, B5, B6) | 3 E2E |
| 2.3.3 | `e2e/content-studio-v2/autosave-errors.spec.ts` (C1–C4) | 4 E2E |
| 2.3.4 | `PublishActionGroup.test.tsx` enrichi (B1–B6) | 6 Vitest RTL |
| 2.3.5 | `StudioContext.test.tsx` enrichi (C4) | 2 Vitest RTL |
| **Total Phase 2.3** | | **~19 tests** |

### Phase 2.4 — Bloc D+E+F : Deep links + Variantes + Stepper (1 jour)

| # | Tâche | Volume |
|---|---|---|
| 2.4.1 | `e2e/content-studio-v2/deep-link.spec.ts` (D1, D2) | 2 E2E |
| 2.4.2 | `e2e/content-studio-v2/variants-advanced.spec.ts` (E1, E3, E4, E5) | 4 E2E |
| 2.4.3 | `VariantsCompare.test.tsx` enrichi (E1, E2, E3) | 3 Vitest RTL |
| 2.4.4 | Stepper.test.tsx enrichi (F1, F2) | 2 Vitest RTL |
| **Total Phase 2.4** | | **~11 tests** |

### Phase 2.5 — Bloc G+H : Drag-drop + JobQueue (1.5 jours)

| # | Tâche | Volume |
|---|---|---|
| 2.5.1 | `e2e/content-studio-v2/calendar-drag-drop.spec.ts` (G1–G4) | 4 E2E |
| 2.5.2 | `e2e/content-studio-v2/job-queue.spec.ts` (H1–H3, H5, H6) | 5 E2E |
| 2.5.3 | `JobQueue.test.tsx` enrichi (H4) | 2 Vitest RTL |
| **Total Phase 2.5** | | **~11 tests** |

### Phase 2.6 — Bloc I+J+K+L : Library errors + MediaPicker + Shortcuts + Home (1.5 jours)

| # | Tâche | Volume |
|---|---|---|
| 2.6.1 | `e2e/content-studio-v2/library-errors.spec.ts` (I1–I5) | 5 E2E |
| 2.6.2 | `e2e/content-studio-v2/shortcuts-advanced.spec.ts` (K1–K3) | 3 E2E |
| 2.6.3 | `MediaPicker.test.tsx` (J1–J6) | 6 Vitest RTL |
| 2.6.4 | `TopPerformersCard.test.tsx` (L1) | 1 Vitest RTL |
| 2.6.5 | `AccountHealthCard.test.tsx` (L2) | 1 Vitest RTL |
| 2.6.6 | `DraftsAwaitingCard.test.tsx` (L3) | 1 Vitest RTL |
| **Total Phase 2.6** | | **~17 tests** |

### Phase 2.7 — Validation + CI (0.5 jour)

| # | Tâche |
|---|---|
| 2.7.1 | Lancer la suite Vitest complète — assert 0 échec |
| 2.7.2 | Lancer la suite Playwright complète — assert 0 échec |
| 2.7.3 | Mettre à jour le plan de test Phase 1 avec les nouveaux totaux |
| 2.7.4 | Commit final |

---

## 7. Comptage prévisionnel Phase 2

| Couche | Existant (Phase 1) | Nouveaux (Phase 2) | Total |
|---|---|---|---|
| Vitest unit (C1) | 75 | ~10 | ~85 |
| Vitest integration (C2) | 57 | ~5 | ~62 |
| Vitest RTL+MSW (C3) | 125 | ~45 | ~170 |
| Playwright E2E (C4) | 125 | ~80 | ~205 |
| MSW contract | 15 | ~3 | ~18 |
| **Total** | **558** | **~143** | **~700** |

Avec les 4 bugs corrigés (+ tests associés ~34) : **total ≥ 700 tests**.

---

## 8. Runbook Phase 2

### Étape 1 — Préparation

```bash
# 1. Vérifier que Phase 1 est verte
cd /var/www/femiglow-staging/apps/web
npx vitest run src/lib/content-studio src/lib/content-studio-v2 \
  src/components/admin/content-studio-v2 src/test/msw/content-studio 2>&1 | tail -5
# Attendu : 433 passed, 0 failed

systemctl is-active femiglow-staging.service
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8012 npx playwright test e2e/content-studio-v2/ 2>&1 | tail -5
# Attendu : 125 passed, 0 failed

# 2. Créer les fixtures
mkdir -p e2e/fixtures
convert -size 100x100 xc:'#f5ebe3' e2e/fixtures/test-image.jpg
truncate -s 26M e2e/fixtures/test-image-large.jpg
ffmpeg -y -f lavfi -i color=c=#f5ebe3:size=320x240:duration=5 \
  -c:v libx264 -pix_fmt yuv420p e2e/fixtures/test-video.mp4 2>/dev/null
echo "%PDF-1.0" > e2e/fixtures/test.pdf
echo "Fixtures created:"
ls -la e2e/fixtures/
```

### Étape 2 — Phase 2.1 : Bugs produit

```bash
# 2a. Implémenter Bug 1 (Rejeter) + Bug 2 (Annuler) + Bug 3 (Budget) + Bug 4 (Session)
# Chaque bug : code fix + Vitest + E2E
# Vérifier après chaque bug :
npx vitest run src/components/admin/content-studio-v2 --reporter=verbose 2>&1 | tail -10

# 2b. Build + restart
npm run build && chown -R nodeapp:nodeapp .next && systemctl restart femiglow-staging.service
sleep 3

# 2c. E2E check
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8012 npx playwright test e2e/content-studio-v2/ 2>&1 | tail -5

# 2d. Commit
git add -A
git commit -m "fix(content-studio-v2): 4 bugs — reject, cancel, budget indicator, session expiry"
```

### Étape 3 — Phase 2.2 : Upload + Media

```bash
# Créer les specs E2E upload + crop + video
# Créer/enrichir les tests RTL Uploader + ImageCropper + VideoTrimmer

npx vitest run src/components/admin/content-studio-v2/media --reporter=verbose
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8012 npx playwright test e2e/content-studio-v2/upload --reporter=list

git commit -m "test(content-studio-v2): upload/crop/trim — 30 tests"
```

### Étape 4 — Phase 2.3 : Publish + Autosave

```bash
# Créer les specs E2E publish-flow, publish-errors, autosave-errors
# Enrichir PublishActionGroup.test.tsx + StudioContext.test.tsx

npx vitest run src/components/admin/content-studio-v2/create/PublishActionGroup --reporter=verbose
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8012 npx playwright test e2e/content-studio-v2/publish --reporter=list
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8012 npx playwright test e2e/content-studio-v2/autosave --reporter=list

git commit -m "test(content-studio-v2): publish flows + autosave errors — 19 tests"
```

### Étape 5 — Phase 2.4 : Deep links + Variantes + Stepper

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8012 npx playwright test e2e/content-studio-v2/deep-link --reporter=list
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8012 npx playwright test e2e/content-studio-v2/variants --reporter=list
npx vitest run src/components/admin/content-studio-v2/create/VariantsCompare --reporter=verbose

git commit -m "test(content-studio-v2): deep links + variants + stepper — 11 tests"
```

### Étape 6 — Phase 2.5 : Drag-drop + JobQueue

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8012 npx playwright test e2e/content-studio-v2/calendar-drag --reporter=list
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8012 npx playwright test e2e/content-studio-v2/job-queue --reporter=list
npx vitest run src/components/admin/content-studio-v2/plan/JobQueue --reporter=verbose

git commit -m "test(content-studio-v2): drag-drop + job queue — 11 tests"
```

### Étape 7 — Phase 2.6 : Library errors + MediaPicker + Shortcuts + Home

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8012 npx playwright test e2e/content-studio-v2/library-errors --reporter=list
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8012 npx playwright test e2e/content-studio-v2/shortcuts --reporter=list
npx vitest run src/components/admin/content-studio-v2 --reporter=verbose

git commit -m "test(content-studio-v2): library errors + media picker + shortcuts + home — 17 tests"
```

### Étape 8 — Validation finale

```bash
# Suite Vitest complète
npx vitest run src/lib/content-studio src/lib/content-studio-v2 \
  src/components/admin/content-studio-v2 src/test/msw/content-studio 2>&1 | tail -5
# Attendu : ≥ 530 passed, 0 failed

# Suite Playwright complète
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8012 npx playwright test e2e/content-studio-v2/ 2>&1 | tail -5
# Attendu : ≥ 205 passed, 0 failed

# Total
echo "=== TOTAL ==="
echo "Vitest: $(npx vitest run src/lib/content-studio src/lib/content-studio-v2 \
  src/components/admin/content-studio-v2 src/test/msw/content-studio 2>&1 | grep 'Tests' | grep -oP '\d+ passed')"
echo "Playwright: $(PLAYWRIGHT_BASE_URL=http://127.0.0.1:8012 npx playwright test e2e/content-studio-v2/ 2>&1 | grep -oP '\d+ passed')"
```

---

## 9. Matrice de couverture finale (après Phase 2)

| Parcours opérateur | Phase 1 | Phase 2 | Total |
|---|---|---|---|
| Format/pilier/objectif/plateforme | ✅ | — | ✅ |
| Prompt + submit → idée | ✅ | — | ✅ |
| Génération → 3 variantes | ✅ | — | ✅ |
| Sélection variante | ✅ | — | ✅ |
| **Variante bloquée (brand)** | ❌ | ✅ E1 | ✅ |
| **Rejeter un draft** | ❌ | ✅ Bug 1 | ✅ |
| Caption + hook + autosave | ✅ | — | ✅ |
| **Autosave erreur + session expirée** | ❌ | ✅ C1–C4 | ✅ |
| **Upload image + crop** | ❌ | ✅ A1–A9 | ✅ |
| **Upload vidéo + trim** | ❌ | ✅ A4,A10–A11 | ✅ |
| Visual IA mock | ✅ | — | ✅ |
| **Budget IA affiché** | ❌ | ✅ Bug 3 | ✅ |
| Preview switch | ✅ | — | ✅ |
| **Publier maintenant** | ❌ | ✅ B1–B2 | ✅ |
| **Programmer** | ❌ | ✅ B3 | ✅ |
| **Brouillon Postiz** | ❌ | ✅ B4 | ✅ |
| Library search + filtres | ✅ | — | ✅ |
| **Library errors (rollback, partial)** | ❌ | ✅ I1–I5 | ✅ |
| Bulk approve/archive | ✅ | — | ✅ |
| **Drag-drop calendrier** | ❌ | ✅ G1–G4 | ✅ |
| **Annuler post programmé** | ❌ | ✅ Bug 2 | ✅ |
| QuickEditDrawer | ✅ | ✅ I5 (date invalide) | ✅ |
| **JobQueue retry/cancel** | ❌ | ✅ H1–H6 | ✅ |
| **Deep link /create/[id]** | ❌ | ✅ D1–D2 | ✅ |
| Dashboard home + liens | ✅ | — | ✅ |
| **Home edge cases (vide, danger)** | ❌ | ✅ L1–L3 | ✅ |
| Dark/light + persistence | ✅ | — | ✅ |
| Cmd+K/S + Tab + Escape | ✅ | — | ✅ |
| **Raccourcis avancés (?, g+p, Ctrl+Shift+L)** | ❌ | ✅ K1–K3 | ✅ |
| Responsive mobile | ✅ | — | ✅ |
| Axe-core a11y ×4 | ✅ | — | ✅ |
| **MediaPicker filtres/search/loading** | ❌ | ✅ J1–J6 | ✅ |
| Redirect v1→v2 | ✅ | — | ✅ |

**90/90 scénarios couverts après Phase 2.**
