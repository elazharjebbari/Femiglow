# Runbook — pilotage complet de l'implémentation

Ce document est **le chef d'orchestre**. Pour chaque phase, il liste : la tâche, les documents de référence à ouvrir, les fichiers de code à toucher, les tests à écrire, la commande de validation et la définition de fini. Aucune tâche n'est marquée terminée sans cocher toutes ses cases.

## Vue d'ensemble — 4 jalons, 32 phases atomiques

```
J1 — Lecture publique  (12 j)        J2 — Soumission  (7 j)        J3 — Mesure  (4 j)
  P1.1  Schéma BDD                     P2.1  Wizard étape 1            P3.1  Tracking événements
  P1.2  API publique                   P2.2  Wizard étape 2            P3.2  Insights agrégés
  P1.3  Adapter cache                  P2.3  Wizard étape 3            P3.3  Dashboard insights
  P1.4  Tokens design                  P2.4  Sanitization              P3.4  A/B test infra
  P1.5  Module compact                 P2.5  Vision ML faces
  P1.6  Drawer shell                   P2.6  E-mail J+45
  P1.7  Filtres + pagination           P2.7  Modération photos
  P1.8  Carte témoignage                                              
  P1.9  Lightbox photo                                                
  P1.10 Admin queue + détail                                          
  P1.11 Admin actions + audit                                         
  P1.12 Seed 3 témoignages

J4 — Import + bulk (9 j) — ouvert en parallèle de J1 dès que P1.1 est mergé
  P4.1  Migration BDD import (batches + rows + temp_media)
  P4.2  Parsers (CSV, JSON, JSONL, TSV, ZIP)
  P4.3  Validator, mapper, duplicate detector
  P4.4  API admin import (9 endpoints)
  P4.5  Wizard import UI (6 étapes)
  P4.6  Bulk system générique (BulkActionBar + modales)
  P4.7  Templates téléchargeables (5 formats)
  P4.8  Page d'aide /admin/rituals/import/help
  P4.9  Tests (Jest + MSW + Playwright)
```

## Phase 0 — Prérequis et environnement

### Tâches

- [ ] Créer la branche `feat/rituals-wall`.
- [ ] Vérifier que `pnpm install` passe sans warning.
- [ ] Vérifier accès `DATABASE_URL` Neon en dev (writable).
- [ ] Ajouter secrets `.env.local` :
  - [ ] `RITUAL_EMAIL_SECRET=` (générer via `openssl rand -hex 32`)
  - [ ] `RITUAL_PEPPER=` (idem)
  - [ ] `RITUAL_VISION_ML_PROVIDER=mediapipe`
- [ ] Vérifier que `pnpm typecheck` passe sur main avant de brancher.

### Références à ouvrir

- `↗ 08-architecture-data.md § 9` — variables d'environnement.

### Validation

```bash
pnpm install && pnpm typecheck && pnpm test
```

Tous verts → prérequis OK.

---

## Jalon 1 — Lecture publique (12 j)

### Phase 1.1 — Schéma de base de données

**Charge : 1,5 j.**

#### Tâches

- [ ] Créer migration Drizzle `apps/web/drizzle/migrations/0016_ritual_testimonials.sql` à partir du SQL de référence.
- [ ] Ajouter les enums : `ritual_signal`, `ritual_status`, `ritual_source`, `ritual_language`, `photo_faces_status`.
- [ ] Créer tables : `ritual_testimonials`, `ritual_testimonial_photos`, `ritual_audit_log`.
- [ ] Créer la matérialized view `ritual_aggregate` + index unique.
- [ ] Ajouter le schéma Drizzle TS dans `apps/web/src/lib/db/schema.ts` à la fin.
- [ ] Exporter les types dans `apps/web/src/lib/db/types.ts`.
- [ ] Lancer la migration en local : `pnpm --filter @femiglow/web db:migrate`.

#### Références

- `↗ 08-architecture-data.md § 2 / 3 / 4 / 5` — tables, indexes, view.
- `↗ ../execution/01-architecture-detaillee.md § 4` — diagramme entités.
- `apps/web/src/lib/db/schema.ts:1` — convention existante.

#### Tests à écrire

- [ ] `apps/web/src/lib/db/__tests__/rituals-schema.test.ts` — vérifier que tous les enums sont déclarés et que les tables sont insérables avec des fixtures.

#### Validation

```bash
pnpm --filter @femiglow/web db:migrate
pnpm --filter @femiglow/web test src/lib/db/__tests__/rituals-schema.test.ts
```

#### DoD

- ✓ Migration appliquée sans erreur.
- ✓ `psql $DATABASE_URL -c "\d ritual_testimonials"` montre la structure attendue.
- ✓ Test schéma vert.

---

### Phase 1.2 — API publique de lecture

**Charge : 1,5 j.**

#### Tâches

- [ ] Créer schémas Zod dans `apps/web/src/lib/schemas/rituals.ts` : `RitualTestimonialPublic`, `RitualSummary`, `RitualSignalSchema`, `RitualTagSchema`.
- [ ] Créer queries Drizzle dans `apps/web/src/lib/db/queries/rituals.ts` :
  - [ ] `getRitualSummary(productKey)`.
  - [ ] `listRituals({ productKey, filters, sort, cursor, limit })`.
  - [ ] `getRitualByPublicSlug(slug)`.
- [ ] Créer routes Next.js :
  - [ ] `apps/web/src/app/api/rituals/summary/route.ts` — GET avec cache HTTP 5 min.
  - [ ] `apps/web/src/app/api/rituals/list/route.ts` — GET avec cursor pagination.
  - [ ] `apps/web/src/app/api/rituals/policy/route.ts` — GET texte politique depuis `app_config`.

#### Références

- `↗ 08-architecture-data.md § 7.1 / 7.2 / 7.4` — endpoints.
- `↗ 15-performance-loading.md § 4` — pagination cursor.
- `↗ 15-performance-loading.md § 5` — caches.
- `apps/web/src/lib/db/queries/` — pattern de queries existantes.

#### Tests à écrire

- [ ] **Jest** : `apps/web/src/lib/db/queries/__tests__/rituals.test.ts` — queries avec fixtures Drizzle (utilise `pg-mem` ou test DB).
- [ ] **MSW** : handlers dans `apps/web/src/test/msw/handlers/rituals.ts` pour mocker `/api/rituals/*`.
- [ ] Smoke test API : `curl localhost:3000/api/rituals/summary?product_key=pack-femiglow` → 200 JSON.

#### Validation

```bash
pnpm --filter @femiglow/web test src/lib/db/queries/__tests__/rituals.test.ts
pnpm --filter @femiglow/web dev # puis curl manuel
```

#### DoD

- ✓ 3 endpoints répondent 200.
- ✓ Cache-Control headers présents.
- ✓ Pagination cursor stable (test passant un cursor renvoie la suite cohérente).
- ✓ Tests Jest verts.

---

### Phase 1.3 — Adapter cache et seed initial

**Charge : 0,5 j.**

#### Tâches

- [ ] Créer fonction de refresh manuel : `apps/web/src/lib/db/queries/rituals.ts` exporte `refreshRitualAggregate()`.
- [ ] Créer CRON route `apps/web/src/app/api/cron/rituals-refresh-aggregate/route.ts` — exécute `REFRESH MATERIALIZED VIEW CONCURRENTLY` toutes les 5 min.
- [ ] Configurer Vercel `vercel.json` pour le CRON.
- [ ] Créer seed script `apps/web/scripts/seed-rituals.ts` — insère 3 témoignages témoin pour le bootstrap (sources : retours WhatsApp existants, à formuler par la maison).
- [ ] Lancer `pnpm tsx apps/web/scripts/seed-rituals.ts`.

#### Références

- `↗ 08-architecture-data.md § 5` — vue matérialisée.
- `apps/web/src/app/api/cron/` — pattern CRON existant.
- `apps/web/vercel.json` — config CRON.

#### Tests à écrire

- [ ] Smoke test CRON : `curl -X POST -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/rituals-refresh-aggregate` → 200.

#### DoD

- ✓ 3 témoignages présents en DB avec `status = APPROVED`.
- ✓ `GET /api/rituals/summary` renvoie `totalCount: 3`.
- ✓ CRON déclenché à la main rafraîchit la matérialisée.

---

### Phase 1.4 — Tokens design spécifiques au wall

**Charge : 0,5 j.**

#### Tâches

- [ ] Ajouter les tokens à `apps/web/src/styles/tokens.css` à la fin (bloc commenté `/* Rituals Wall */`).
- [ ] Étendre `apps/web/tailwind.config.ts` avec spacings, colors, transitions du wall.
- [ ] Vérifier visuellement sur Storybook que les tokens compilent.

#### Références

- `↗ annexes/decisions-design-tokens.md` — catalogue complet.
- `↗ 14-accessibilite-ergonomie.md § 5` — corrections de contraste.

#### Tests à écrire

- [ ] Visual regression Storybook ou screenshot test si déjà câblé.

#### DoD

- ✓ Storybook ouvre la story `tokens-wall` sans erreur.
- ✓ axe-core ne signale pas de problème de contraste sur la story.

---

### Phase 1.5 — Module compact `/kit`

**Charge : 1 j.**

#### Tâches

- [ ] Créer `apps/web/src/components/sections/rituals/RitualsModule.tsx` (présentation pure, props injectées).
- [ ] Créer `apps/web/src/components/sections/rituals/RitualsModuleBound.tsx` (server component RSC qui fetch summary + featured 3).
- [ ] Créer `apps/web/src/components/sections/rituals/RitualCard.tsx` avec variant `compact` et `default`.
- [ ] Insérer `<Suspense fallback={<RitualsModuleSkeleton />}>` puis `<RitualsModuleBound>` dans `apps/web/src/app/(marketing)/kit/page.tsx` entre composition et comparatif.
- [ ] Implémenter le fallback : si < 3 featured, prendre les 3 plus récents avec photo.
- [ ] Implémenter Storybook stories pour `RitualCard`, `RitualsModule`, états : default, hover, no-photo, anonymous, long-quote.

#### Références

- `↗ 09-interface-publique.md § 2` — module compact détaillé.
- `↗ 02-ui-ux-conception.md` — style guide du wall.
- `↗ 07-proposition-finale.md § 4` — anatomie module.

#### Tests à écrire

- [ ] **Jest** :
  - [ ] `RitualCard.test.tsx` — rend la citation, la signature, les tags, le badge si `would_recommend = oui`.
  - [ ] `RitualCard.test.tsx` — masque le badge si `would_recommend != oui`.
  - [ ] `RitualCard.test.tsx` — accessibilité `axe-core` passe.
  - [ ] `RitualsModule.test.tsx` — rend 3 cards, le lien `Lire les N rituels →`.
- [ ] **MSW** : `RitualsModuleBound` testé avec un handler retournant `featured = [card1, card2, card3]`.

#### Validation

```bash
pnpm --filter @femiglow/web test src/components/sections/rituals/
pnpm --filter @femiglow/web dev # vérification visuelle /kit
```

#### DoD

- ✓ Module visible sur `/kit` en dev.
- ✓ Lighthouse `/kit` LCP non dégradé (vs main, écart < 200 ms).
- ✓ 4 tests Jest verts.

---

### Phase 1.6 — Drawer shell

**Charge : 1 j.**

#### Tâches

- [ ] Créer `apps/web/src/components/sections/rituals/RitualsWallDrawer.tsx` (Radix Dialog + Framer Motion).
- [ ] Implémenter `aria-modal`, focus trap, ESC, fermeture overlay.
- [ ] Implémenter URL state `?wall=open` / `?wall=card-xxx` via `useSearchParams` + push history.
- [ ] Implémenter dynamic import depuis le module compact (sur clic lien `Lire les N`).
- [ ] Implémenter `RitualsWallHeader`, `RitualsWallSummary`, `RitualsWallFooter` (shells minimaux, contenu en phase suivante).
- [ ] Variantes responsive : drawer right desktop, bottom sheet mobile avec drag handle.

#### Références

- `↗ 09-interface-publique.md § 3` — drawer détaillé.
- `↗ 13-animations-motion.md § 2` — animations drawer.
- `↗ 14-accessibilite-ergonomie.md § 3` — focus management.

#### Tests à écrire

- [ ] **Jest** : `RitualsWallDrawer.test.tsx` — ouvre / ferme, ESC ferme, click overlay ferme, focus initial sur bouton fermer.
- [ ] **Playwright** : ouverture du drawer depuis `/kit` (smoke).

#### DoD

- ✓ Drawer s'ouvre via lien module compact.
- ✓ Focus management OK clavier (Tab cycle dans le drawer).
- ✓ Test focus trap passe.
- ✓ Aucun warning console.

---

### Phase 1.7 — Filtres et pagination

**Charge : 1 j.**

#### Tâches

- [ ] Créer `apps/web/src/components/sections/rituals/RitualsWallFilters.tsx` — 4 chips (Tous / Avec photos / Halal / Récents).
- [ ] Créer `apps/web/src/components/sections/rituals/RitualsWallList.tsx` — appel API `/api/rituals/list` avec React Query ou SWR.
- [ ] Créer `apps/web/src/components/sections/rituals/RitualsWallLoadMore.tsx` — bouton avec compteur.
- [ ] Créer hook `apps/web/src/lib/rituals/use-rituals-list.ts` — wrapper React Query pour list paginée.
- [ ] Implémenter scroll horizontal mobile sur chips, scroll-snap.

#### Références

- `↗ 09-interface-publique.md § 3.5 / 3.7` — filtres + load more.
- `↗ 15-performance-loading.md § 4` — cursor pagination.

#### Tests à écrire

- [ ] **Jest** :
  - [ ] `RitualsWallFilters.test.tsx` — chip active / inactive, click change l'état.
  - [ ] `use-rituals-list.test.tsx` — pagination cursor, refetch sur changement filtre.
- [ ] **MSW** : scénarios `/api/rituals/list` avec filtres combinés (with_photos, tags, sort).

#### DoD

- ✓ Filtrer par « Avec photos » filtre la liste.
- ✓ Cliquer « Afficher plus » concatène 12 cartes supplémentaires.
- ✓ Compteur `12 / 26 affichés` correct.

---

### Phase 1.8 — Carte témoignage variant `default` (drawer)

**Charge : 0,5 j.**

#### Tâches

- [ ] Étendre `RitualCard.tsx` avec le variant `default` (citation + photo float left, signature, tags, badge).
- [ ] Implémenter `aria-labelledby` et structure DOM lisible par lecteur d'écran.
- [ ] Storybook : variantes avec / sans photo, anonyme, long quote, multi-tags.

#### Références

- `↗ 09-interface-publique.md § 3.6` — anatomie carte.
- `↗ 12-microcopy-voix.md § 5` — chaînes de la carte.

#### Tests à écrire

- [ ] **Jest** : `RitualCard.test.tsx` variant `default` — lecture continue par screen reader simulation.

#### DoD

- ✓ 26 cartes rendues sans erreur de console.
- ✓ Photos lazy-loaded vérifié via DevTools network.

---

### Phase 1.9 — Lightbox photo

**Charge : 0,5 j.**

#### Tâches

- [ ] Créer `apps/web/src/components/sections/rituals/RitualPhotoLightbox.tsx` (Radix Dialog + navigation).
- [ ] Navigation clavier (← → Esc), swipe mobile (Framer Motion drag).
- [ ] Préchargement `<link rel="preload">` photos adjacentes.

#### Références

- `↗ 09-interface-publique.md § 4` — lightbox.

#### Tests à écrire

- [ ] **Jest** : `RitualPhotoLightbox.test.tsx` — navigation clavier, ESC ferme, retour focus sur photo cliquée.

#### DoD

- ✓ Click thumbnail ouvre full-res.
- ✓ Préchargement vérifié dans DevTools.

---

### Phase 1.10 — Admin queue et détail

**Charge : 2 j.**

#### Tâches

- [ ] Créer layout `apps/web/src/app/admin/rituals/layout.tsx` avec navigation 5 onglets.
- [ ] Créer page `apps/web/src/app/admin/rituals/queue/page.tsx` — liste PENDING + tri + filtres.
- [ ] Créer page `apps/web/src/app/admin/rituals/[id]/page.tsx` — vue détaillée 2 colonnes.
- [ ] Créer API admin :
  - [ ] `apps/web/src/app/api/admin/rituals/queue/route.ts` — GET.
  - [ ] `apps/web/src/app/api/admin/rituals/[id]/route.ts` — GET, PATCH (approve / reject / hide / feature).
- [ ] Implémenter `require-admin()` sur chaque route admin.

#### Références

- `↗ 10-interface-admin.md § 3 / 4` — queue + détail.
- `↗ 06-admin-plan-action.md` — plan d'action admin.
- `apps/web/src/lib/auth/require-admin.ts` — pattern existant.

#### Tests à écrire

- [ ] **Jest** : `queue/page.test.tsx` — filtres + pagination.
- [ ] **Jest** : actions PATCH testées (approve, reject, hide).
- [ ] **MSW** : handlers admin avec auth admin-session.

#### DoD

- ✓ Admin peut approuver un témoignage PENDING.
- ✓ Témoignage approuvé apparaît dans `/api/rituals/list`.

---

### Phase 1.11 — Admin actions et audit log

**Charge : 1 j.**

#### Tâches

- [ ] Implémenter chaque action : approve, reject (avec template e-mail), hide, restore, feature.
- [ ] Implémenter audit log : chaque action insère dans `ritual_audit_log`.
- [ ] UI : modale de confirmation par action.
- [ ] Composant `AuditLogList.tsx` pour afficher la timeline.

#### Références

- `↗ 17-moderation-workflow.md § 6` — workflows par action.
- `↗ 10-interface-admin.md § 4.3` — bloc Actions.

#### Tests à écrire

- [ ] **Jest** : chaque action écrit dans `ritual_audit_log`.
- [ ] **Playwright** : approve workflow complet.

#### DoD

- ✓ 5 actions opérationnelles.
- ✓ Audit log visible dans la vue détail.

---

### Phase 1.12 — Seed des 3 témoignages réels et passage en production

**Charge : 0,5 j.**

#### Tâches

- [ ] Rédiger 3 témoignages réels avec Souheila (à partir de retours WhatsApp et conversations existantes).
- [ ] Inserter via admin manuellement (source = `manual`).
- [ ] Marquer `featured = true` sur les 3.
- [ ] Vérifier que le module compact affiche les 3.

#### Référentiel

- `↗ 18-roadmap-execution.md § 2.3` — livrables J1.

#### DoD

- ✓ Le module compact `/kit` affiche 3 témoignages curés.
- ✓ Le drawer affiche les 3 et un compteur cohérent.

---

## Jalon 2 — Soumission (7 j)

### Phase 2.1 — Wizard étape 1 (texte + signal)

**Charge : 1 j.**

#### Tâches

- [ ] Créer `apps/web/src/components/sections/rituals/wizard/RitualsWizard.tsx` — container du wizard.
- [ ] Créer `apps/web/src/components/sections/rituals/wizard/Step1Voice.tsx`.
- [ ] Implémenter textarea avec compteur de mots et sanitization emoji à la frappe.
- [ ] Implémenter radio buttons signal (Oui / Hésite / Pas pour moi).
- [ ] Implémenter brouillon localStorage 7 j.

#### Références

- `↗ 03-wizard-ui-specification.md § 3` — spec UI détaillée étape 1.
- `↗ 11-wizard-soumission.md § 2.1`.
- `↗ 12-microcopy-voix.md § 11`.

#### Tests à écrire

- [ ] **Jest** : compteur de mots évolue en temps réel.
- [ ] **Jest** : emoji tapé est retiré + toast affiché.
- [ ] **Jest** : brouillon sauvegardé après 15 sec.
- [ ] **Jest** : `signal` requis pour activer `Continuer`.

#### DoD

- ✓ Étape 1 fonctionnelle isolée.
- ✓ Tests verts.

---

### Phase 2.2 — Wizard étape 2 (tags + photos)

**Charge : 1 j.**

#### Tâches

- [ ] Créer `Step2Details.tsx` — checkboxes tags + zone drop photos.
- [ ] Implémenter limite 3 tags (4ᵉ disabled).
- [ ] Implémenter upload photos via `POST /api/rituals/upload-photo` (route à créer en P2.5).
- [ ] Compression côté client (Canvas API, qualité 0.85).

#### Références

- `↗ 03-wizard-ui-specification.md § 4`.
- `↗ 11-wizard-soumission.md § 2.2`.

#### Tests à écrire

- [ ] **Jest** : 4ᵉ tag click → disabled.
- [ ] **Jest** : drop photo trop grosse → message d'erreur.
- [ ] **MSW** : `/api/rituals/upload-photo` simulé renvoie URL.

#### DoD

- ✓ Étape 2 fonctionnelle.
- ✓ Upload simulé en MSW retourne thumbnail.

---

### Phase 2.3 — Wizard étape 3 (signature)

**Charge : 0,5 j.**

#### Tâches

- [ ] Créer `Step3Signature.tsx` — prénom + ville (autocomplete) + initiée depuis + anonymat.
- [ ] Implémenter pré-remplissage depuis `emailToken` HMAC.

#### Références

- `↗ 03-wizard-ui-specification.md § 5`.
- `↗ 11-wizard-soumission.md § 2.3`.

#### Tests à écrire

- [ ] **Jest** : pré-remplissage depuis params URL.
- [ ] **Jest** : anonymat coché → preview signature « Une initiée, Rabat ».

#### DoD

- ✓ Étape 3 fonctionnelle.
- ✓ Pré-remplissage testé.

---

### Phase 2.4 — Sanitization et auto-flags backend

**Charge : 1 j.**

#### Tâches

- [ ] Créer `apps/web/src/lib/rituals/sanitize-body.ts` — pipeline complet.
- [ ] Créer `apps/web/src/lib/rituals/auto-flags.ts` — détection emoji, link, forbidden, length, all_caps.
- [ ] Créer route `apps/web/src/app/api/rituals/submit/route.ts` — POST.
- [ ] Implémenter rate-limit (1 IP / 24h, 1 customer_hash / 30j) via `lib/rate-limit/`.
- [ ] Validation Zod stricte.

#### Références

- `↗ 17-moderation-workflow.md § 3 / 5`.
- `↗ 08-architecture-data.md § 7.3 / 8`.

#### Tests à écrire

- [ ] **Jest** : `sanitize-body.test.ts` — 12 scénarios (emoji, apostrophe, espace, etc.).
- [ ] **Jest** : `auto-flags.test.ts` — détection link, all_caps, etc.
- [ ] **Jest** : rate-limit déclenche 429 sur 2ᵉ POST même IP.

#### DoD

- ✓ Body avec emoji → sanitized + flag added.
- ✓ Body avec link external → flag added, pas de rejet auto.
- ✓ 2ᵉ POST même IP < 24 h → 429.

---

### Phase 2.5 — Vision ML faces detection

**Charge : 1 j.**

#### Tâches

- [ ] Installer `@mediapipe/tasks-vision`.
- [ ] Créer `apps/web/src/lib/rituals/vision-ml-faces.ts` — wrapper avec timeout 5 sec.
- [ ] Créer route `apps/web/src/app/api/rituals/upload-photo/route.ts` — POST avec upload Sharp + enqueue job.
- [ ] Créer worker job (peut être inline dans la route ou via Vercel Queue).
- [ ] Update `ritual_testimonial_photos.faces_status` après check.

#### Références

- `↗ 17-moderation-workflow.md § 4`.
- `↗ 15-performance-loading.md § 6`.

#### Tests à écrire

- [ ] **Jest** : `vision-ml-faces.test.ts` — image de visage frontal → `REJECTED_FACE`.
- [ ] **Jest** : image de mains uniquement → `OK`.
- [ ] **Jest** : image de hijab (visage partiel) → `MANUAL_REVIEW`.
- [ ] **Jest** : timeout 5 sec → fallback `MANUAL_REVIEW`.

#### DoD

- ✓ 3 photos de test (visage / mains / hijab) → 3 statuts attendus.
- ✓ Timeout géré.

---

### Phase 2.6 — E-mail J+45

**Charge : 1 j.**

#### Tâches

- [ ] Créer CRON `apps/web/src/app/api/cron/rituals-email-j45/route.ts` — sélectionne commandes paid à 45 j.
- [ ] Créer template `apps/web/content/email-templates/rituals/j45.md`.
- [ ] Créer fonction `generateEmailToken(orderId, customerHash)` HMAC.
- [ ] Validation du token côté `POST /api/rituals/submit` si présent.
- [ ] Configurer Vercel `vercel.json` CRON 1× / jour 10h Maroc.

#### Références

- `↗ 07-proposition-finale.md § 7`.
- `↗ 17-moderation-workflow.md § 7`.

#### Tests à écrire

- [ ] **Jest** : token HMAC généré et validé.
- [ ] **Jest** : token expiré rejeté.
- [ ] **Playwright** : flow complet — order paid → CRON envoi → lien → wizard pré-rempli → soumission.

#### DoD

- ✓ 10 commandes test reçoivent e-mail J+45.
- ✓ Lien ouvre wizard avec pré-remplissage.

---

### Phase 2.7 — Modération photos (admin)

**Charge : 1 j.**

#### Tâches

- [ ] Étendre la vue détail admin avec preview photos + rectangles ML.
- [ ] Implémenter actions photo : approuver / rejeter / re-run ML.
- [ ] Route `POST /api/admin/rituals/[id]/photos/[photoId]/recheck`.
- [ ] Bouton override face dans modale d'approbation.

#### Références

- `↗ 17-moderation-workflow.md § 4.3 / 4.4`.
- `↗ 10-interface-admin.md § 5`.

#### Tests à écrire

- [ ] **Jest** : override photo face → faces_status passe à OK.
- [ ] **Jest** : recheck re-lance le job.
- [ ] **Playwright** : modératrice approuve une photo en MANUAL_REVIEW.

#### DoD

- ✓ Modératrice voit les visages détectés.
- ✓ Override fonctionne et trace dans audit.

---

## Jalon 3 — Mesure (4 j)

### Phase 3.1 — Tracking événements

**Charge : 1 j.**

#### Tâches

- [ ] Déclarer tous les événements dans `apps/web/src/lib/tracking/event-catalog.ts` (catalogue § 2 de `16-tracking-analytics.md`).
- [ ] Émettre les événements depuis les composants (hooks `useTrack`).
- [ ] dataLayer push pour GTM.

#### Références

- `↗ 16-tracking-analytics.md § 2 / 3 / 4 / 5`.

#### Tests à écrire

- [ ] **Jest** : ouverture drawer → `ritual_wall_open` émis.
- [ ] **Jest** : filtre changé → `ritual_wall_filter_change` émis.
- [ ] **Playwright** : parcours complet, capture dataLayer pushes.

#### DoD

- ✓ Tous les événements émis et tracés dans `tracking_events_log`.

---

### Phase 3.2 — Insights agrégés

**Charge : 1 j.**

#### Tâches

- [ ] Migration `0017_insights_rituals_daily.sql` — table insights.
- [ ] Étendre CRON `insights-refresh` existant avec agrégation rituals.
- [ ] Queries Drizzle pour récupérer les KPI.

#### Références

- `↗ 16-tracking-analytics.md § 7`.

#### Tests à écrire

- [ ] **Jest** : agrégation quotidienne calcule correctement.

#### DoD

- ✓ `insights_rituals_daily` peuplé après une journée.

---

### Phase 3.3 — Dashboard admin Insights

**Charge : 1 j.**

#### Tâches

- [ ] Créer page `apps/web/src/app/admin/rituals/insights/page.tsx`.
- [ ] Composants : KPI globaux, histogramme tags, graphique soumissions, sources, SLA.
- [ ] Réutiliser `lib/analytics/format.ts`.

#### Références

- `↗ 10-interface-admin.md § 8`.

#### Tests à écrire

- [ ] **Jest** : rendu avec fixtures.

#### DoD

- ✓ Dashboard affiche les KPI réels.

---

### Phase 3.4 — A/B test infrastructure

**Charge : 1 j.**

#### Tâches

- [ ] Créer expérience `module_present_vs_absent` dans `experiments`.
- [ ] Logique d'assignment côté serveur.
- [ ] Variante visible / invisible du module compact.
- [ ] Documentation pour Souheila.

#### Références

- `↗ 16-tracking-analytics.md § 8`.

#### Tests à écrire

- [ ] **Jest** : assignment cohérent par anonymous_id.
- [ ] **Playwright** : variante A vs B observable.

#### DoD

- ✓ A/B actif sur 50/50 en preview.

---

## Jalon 4 — Import et bulk (9 j, parallélisable avec J1+)

### Phase 4.1 — Migration BDD import

**Charge : 0,5 j.**

#### Tâches

- [ ] Créer migration `0018_rituals_import.sql` avec tables `ritual_import_batches`, `ritual_import_rows`, `ritual_import_temp_media`.
- [ ] Ajouter enums `import_format`, `import_media_strategy`, `import_status`, `import_row_validation_status`.
- [ ] Étendre `ritual_source` avec `import_csv`, `import_json`, `import_zip`.
- [ ] Ajouter colonnes `import_batch_id`, `import_row_id` sur `ritual_testimonials`.
- [ ] Schémas Drizzle TS + Zod (`lib/schemas/rituals-import.ts`).

#### Références

- `↗ 13-import-system-architecture.md § 4, 5`.

#### Tests

- [ ] **Jest** : queries `createBatch`, `insertRows`, `commitBatch` (transaction).

#### DoD

- ✓ Migration appliquée. ✓ Tests verts.

---

### Phase 4.2 — Parsers

**Charge : 1,5 j.**

#### Tâches

- [ ] `lib/rituals/import/parser/csv-parser.ts` (papaparse streaming).
- [ ] `lib/rituals/import/parser/json-parser.ts`.
- [ ] `lib/rituals/import/parser/jsonl-parser.ts`.
- [ ] `lib/rituals/import/parser/zip-parser.ts` (unzipper + extraction).
- [ ] Détection auto séparateur CSV.
- [ ] Validation magic bytes, encodage UTF-8.
- [ ] Limites de taille / rows / archive.

#### Références

- `↗ 13-import-system-architecture.md § 7.1`.
- `↗ 15-import-templates-formats.md`.

#### Tests

- [ ] **Jest** : 25 tests parser (`08-tests-jest.md` étendu via `17-tests-import-bulk.md § 2`).

#### DoD

- ✓ 5 formats supportés. ✓ Path traversal rejeté. ✓ ZIP > 50 Mo rejeté.

---

### Phase 4.3 — Validator, mapper, duplicate detector

**Charge : 1 j.**

#### Tâches

- [ ] `lib/rituals/import/mapper.ts` (mapping colonnes + défauts + auto-detect).
- [ ] `lib/rituals/import/row-validator.ts` (Zod + business rules + sanitization).
- [ ] `lib/rituals/import/duplicate-detector.ts` (row_hash intra + inter).
- [ ] `lib/rituals/import/media-extractor.ts` (ZIP → temp_media + vision ML enqueue).
- [ ] Synonymes intelligents (wouldRecommend, tags, dates).

#### Références

- `↗ 13-import-system-architecture.md § 7.3`.
- `↗ 15-import-templates-formats.md § 8, 9`.

#### Tests

- [ ] **Jest** : 17 tests mapper + validator + 4 tests duplicate.

#### DoD

- ✓ Validator couvre tous les codes d'erreur/warning. ✓ Tests verts.

---

### Phase 4.4 — API admin import

**Charge : 1,5 j.**

#### Tâches

- [ ] `GET    /api/admin/rituals/import/template` (5 formats).
- [ ] `POST   /api/admin/rituals/import/upload`.
- [ ] `GET    /api/admin/rituals/import/[batchId]` (preview paginée).
- [ ] `PATCH  /api/admin/rituals/import/[batchId]/mapping`.
- [ ] `PATCH  /api/admin/rituals/import/[batchId]/rows/[rowId]`.
- [ ] `POST   /api/admin/rituals/import/[batchId]/bulk-rows`.
- [ ] `POST   /api/admin/rituals/import/[batchId]/commit`.
- [ ] `POST   /api/admin/rituals/import/[batchId]/rollback`.
- [ ] `DELETE /api/admin/rituals/import/[batchId]`.
- [ ] CRON `/api/cron/rituals-import-cleanup`.
- [ ] RBAC via `canRitualImportAction`.

#### Références

- `↗ 13-import-system-architecture.md § 8`.

#### Tests

- [ ] **Jest** : 9 tests queries import.
- [ ] **MSW** : handlers complets.

#### DoD

- ✓ 9 endpoints opérationnels. ✓ RBAC respecté.

---

### Phase 4.5 — Wizard import UI

**Charge : 2 j.**

#### Tâches

- [ ] Layout `/admin/rituals/import/[batchId]/[step]` avec stepper sticky.
- [ ] Composant `ImportWizardStep1Format`.
- [ ] Composant `ImportWizardStep2Upload` (drop zone, progress).
- [ ] Composant `ImportWizardStep3Mapping` (table colonnes).
- [ ] Composant `ImportWizardStep4Preview` (synthèse + table rows + filtres + bulk).
- [ ] Composant `ImportWizardStep5Commit` (confirmation).
- [ ] Composant `ImportWizardStep6Report` (succès + rollback).
- [ ] Modale d'édition row inline.
- [ ] Page historique `/admin/rituals/import/history`.

#### Références

- `↗ 14-import-wizard-ui-specification.md`.

#### Tests

- [ ] **Jest** : composants par étape.
- [ ] **MSW** : 8 scénarios wizard integration.
- [ ] **Playwright** : 2 spec files (CSV + ZIP).

#### DoD

- ✓ Parcours complet desktop. ✓ Responsive mobile dégradé acceptable.

---

### Phase 4.6 — Bulk system générique

**Charge : 1 j.**

#### Tâches

- [ ] `lib/admin/bulk/BulkSelectionContext.tsx` (Provider + hook).
- [ ] `components/admin/bulk/BulkActionBar.tsx`.
- [ ] `components/admin/bulk/BulkActionModal.tsx`.
- [ ] `components/admin/bulk/BulkSelectionCheckbox.tsx`.
- [ ] `components/admin/bulk/BulkActionDestructiveModal.tsx` (tapage explicite).
- [ ] Intégration dans queue, published, archived, import preview.
- [ ] Backend `POST /api/admin/rituals/bulk-action` (queue/published/archived).
- [ ] RBAC `canRitualBulkAction` étendu.

#### Références

- `↗ 16-bulk-management.md`.

#### Tests

- [ ] **Jest** : 6 tests bulkAction service.
- [ ] **MSW** : 7 scénarios bulk integration.
- [ ] **Playwright** : 4 scénarios E2E bulk.

#### DoD

- ✓ 7 actions bulk opérationnelles. ✓ Tapage explicite sur destructives. ✓ A11y vert.

---

### Phase 4.7 — Templates téléchargeables

**Charge : 0,3 j.**

#### Tâches

- [ ] Endpoint `GET /api/admin/rituals/import/template`.
- [ ] Templates générés à la volée : CSV (`;`), CSV (`,`), TSV, JSON, JSONL.
- [ ] ZIP de démo avec `rituels.csv` + 2 photos placeholders.
- [ ] Versioning header dans chaque template.

#### Références

- `↗ 15-import-templates-formats.md § 2-6, 10`.

#### Tests

- [ ] **Jest** : tests `generateTemplate(format)`.
- [ ] **Playwright** : click télécharger → fichier reçu.

#### DoD

- ✓ 6 templates téléchargeables.

---

### Phase 4.8 — Page d'aide

**Charge : 0,3 j.**

#### Tâches

- [ ] Page `/admin/rituals/import/help` (lecture seule).
- [ ] Contenu Markdown stocké dans `app_config.rituals_import_help_md`.
- [ ] Section pour chaque format.
- [ ] Catalogue des valeurs.
- [ ] Liens vers les templates.

#### Références

- `↗ 15-import-templates-formats.md § 11`.

#### DoD

- ✓ Page accessible et complète.

---

### Phase 4.9 — Tests intégrés et validation

**Charge : 1,5 j.**

#### Tâches

- [ ] Compléter tests Jest (25 parsers + 17 validator + 9 queries + 4 dedup).
- [ ] Compléter handlers MSW (templates, upload, preview, commit, rollback, bulk).
- [ ] Compléter E2E Playwright (import CSV, import ZIP, bulk admin).
- [ ] axe-core sur chaque étape du wizard.
- [ ] Performance : commit 500 rows < 3 sec.

#### Références

- `↗ 17-tests-import-bulk.md`.

#### DoD

- ✓ ~80 tests verts. ✓ Coverage `lib/rituals/import/**` ≥ 90 %.

---

## Phase finale — Validation globale

### Tâches

- [ ] Lighthouse `/kit` ≥ 92 perf, 100 a11y.
- [ ] axe-core CI vert sur `/kit`, drawer ouvert, wizard ouvert.
- [ ] Playwright suite complète verte.
- [ ] Vitest coverage `lib/rituals/**` ≥ 90 %, `components/sections/rituals/**` ≥ 85 %.
- [ ] Revue manuelle : 9 pages B2C — aucune regression.
- [ ] Revue admin : Souheila valide le workflow.
- [ ] Documentation runbook mise à jour avec leçons.

### Validation finale

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e
```

Tous verts → prêt pour la merge sur main.

## Tableau de bord d'avancement

À remplir au fil de l'eau (cases à cocher dans ce fichier ou tracker externe).

| Phase | Charge | Statut | Owner | Date |
| --- | --- | --- | --- | --- |
| P1.1 Schéma BDD | 1,5 j | ☐ | | |
| P1.2 API publique | 1,5 j | ☐ | | |
| P1.3 Cache + seed | 0,5 j | ☐ | | |
| P1.4 Tokens design | 0,5 j | ☐ | | |
| P1.5 Module compact | 1 j | ☐ | | |
| P1.6 Drawer shell | 1 j | ☐ | | |
| P1.7 Filtres + pagination | 1 j | ☐ | | |
| P1.8 Carte témoignage | 0,5 j | ☐ | | |
| P1.9 Lightbox | 0,5 j | ☐ | | |
| P1.10 Admin queue/détail | 2 j | ☐ | | |
| P1.11 Admin actions/audit | 1 j | ☐ | | |
| P1.12 Seed initial | 0,5 j | ☐ | | |
| P2.1 Wizard étape 1 | 1 j | ☐ | | |
| P2.2 Wizard étape 2 | 1 j | ☐ | | |
| P2.3 Wizard étape 3 | 0,5 j | ☐ | | |
| P2.4 Sanitization + flags | 1 j | ☐ | | |
| P2.5 Vision ML faces | 1 j | ☐ | | |
| P2.6 E-mail J+45 | 1 j | ☐ | | |
| P2.7 Modération photos | 1 j | ☐ | | |
| P3.1 Tracking | 1 j | ☐ | | |
| P3.2 Insights agrégés | 1 j | ☐ | | |
| P3.3 Dashboard insights | 1 j | ☐ | | |
| P3.4 A/B test infra | 1 j | ☐ | | |
| Validation globale | 0,5 j | ☐ | | |
| P4.1 BDD import | 0,5 j | ☐ | | |
| P4.2 Parsers | 1,5 j | ☐ | | |
| P4.3 Validator + mapper + dedup | 1 j | ☐ | | |
| P4.4 API admin import | 1,5 j | ☐ | | |
| P4.5 Wizard import UI | 2 j | ☐ | | |
| P4.6 Bulk system | 1 j | ☐ | | |
| P4.7 Templates | 0,3 j | ☐ | | |
| P4.8 Page d'aide | 0,3 j | ☐ | | |
| P4.9 Tests intégrés import + bulk | 1,5 j | ☐ | | |
| **Total** | **~32 j** | | | |

## Règles d'or du runbook

1. **Aucune phase n'est terminée sans toutes les cases cochées.** Pas de « 95 % fait ».
2. **Tests écrits en même temps que le code.** Pas de PR sans tests.
3. **Référence ouverte à chaque étape.** Le dev ouvre les `↗` correspondants avant de coder.
4. **Commit message rappelle la phase.** `feat(rituals): P1.5 module compact`.
5. **PR petites et fréquentes.** Une PR par phase (ou sous-phase si la phase est lourde).
6. **Le tableau d'avancement est mis à jour à chaque merge.**
7. **Bloqueur = ouvrir une issue avec la phase et la référence.** Pas de blocage silencieux.
