# 18 — Roadmap d'exécution

Plan d'implémentation en **3 jalons séquentiels** sur ~5 semaines. Charge totale estimée : **23 jours ouvrés** d'un développeur full-stack expérimenté.

## 1. Vue d'ensemble

| Jalon | Sujet | Charge | Durée calendaire | DoD |
| --- | --- | --- | --- | --- |
| **J1** | Lecture publique | 12 j | 2 semaines | Drawer + module compact + admin queue + lecture |
| **J2** | Soumission | 7 j | 1,5 semaine | Wizard + e-mail J+45 + vision ML faces |
| **J3** | Mesure | 4 j | 1 semaine | Tracking complet + insights agrégés + A/B test infrastructure |
| **J4** | Import + bulk | 9 j | 2 semaines (parallèle de J1+) | Wizard import 6 étapes + bulk system + templates téléchargeables |

Total : **32 j ouvrés**. Avec parallélisation J4 en parallèle de J1/J2, durée calendaire ramenée à **~6 semaines**.

## 2. Jalon 1 — Lecture publique (12 j)

### 2.1 Objectif

Le wall peut être lu publiquement par les visiteurs de `/kit`, mais aucune soumission n'est encore possible. Les premiers témoignages sont **créés à la main** par la maison via l'admin (`source = manual`). Premier test de conversion observationnel.

### 2.2 Phases

#### Phase 1.1 — Schéma et API (3 j)

- Migration Drizzle `0016_ritual_testimonials.sql` : 4 tables + matérialized view + indexes.
- Schémas Zod dans `lib/schemas/rituals.ts`.
- Routes API publiques :
  - `GET /api/rituals/summary`
  - `GET /api/rituals/list`
  - `GET /api/rituals/policy`
- Cache HTTP + ETag.
- Tests Vitest sur sanitization body, validation Zod.

DoD : 3 témoignages seedés manuellement, `curl /api/rituals/summary` renvoie le bon agrégat.

#### Phase 1.2 — Module compact `/kit` (2 j)

- Composant `RitualsModuleBound.tsx` server component.
- Composant `RitualCard` variant `compact`.
- Section insérée dans `app/(marketing)/kit/page.tsx`.
- Skeleton SSR pendant fetch.
- Fallback gracieux (3 dernières si pas de featured).
- Tests Playwright : visite `/kit`, voir les 3 cartes, mesure LCP.

DoD : module visible sur `/kit`, LCP non dégradé (vérifié Lighthouse).

#### Phase 1.3 — Drawer (3 j)

- Composant `RitualsWallDrawer.tsx` (Radix Dialog + Framer Motion).
- Dynamic import depuis `app/(marketing)/kit/page.tsx`.
- États : `loading`, `loaded`, `empty`, `error`, `loading_more`.
- Filtres chips (Tous, Avec photos, Halal, Récents).
- Pagination cursor-based.
- Footer sticky avec CTA pack + lien partager + lien politique.
- Mode `policy_view` (bascule interne).
- URL state `?wall=open`, `?wall=card-xxxxxxxx`.
- Tests Playwright : ouverture, filtrage, load more, fermeture.

DoD : drawer fonctionnel desktop + mobile, focus trap OK, ESC ferme.

#### Phase 1.4 — Lightbox photo (1 j)

- Composant `RitualPhotoLightbox.tsx` (Radix Dialog).
- Navigation clavier + swipe mobile.
- Préchargement photo adjacente.
- Animation entrée/sortie + nav.

DoD : clic sur thumbnail ouvre la lightbox, navigation entre photos OK.

#### Phase 1.5 — Admin queue + détail (3 j)

- Layout `/admin/rituals/layout.tsx` avec onglets.
- Onglet `/queue` : table avec filtres et tri.
- Onglet `/published` + `/archived`.
- Vue détaillée `/[id]` avec actions (approve, reject, hide, feature).
- Modal templates e-mails.
- Audit log affiché.
- Tests Vitest sur permissions RBAC.

DoD : Souheila peut approuver / rejeter un témoignage via l'admin, le témoignage passe en `APPROVED` et apparaît dans le drawer.

### 2.3 Livrables Jalon 1

- Drawer + module compact en prod sur `/kit`.
- 3 à 5 témoignages **créés à la main** par la maison pour amorcer (sources : retours WhatsApp existants, conversations Souheila / clientes, e-mails reçus).
- Admin opérationnel.
- LCP non dégradé.
- Lighthouse a11y 100, Lighthouse perf ≥ 92.

### 2.4 Métriques attendues fin J1 (sur 2 semaines)

| KPI | Cible |
| --- | --- |
| `ritual_module_view` | > 1000 |
| `ritual_wall_open` | > 200 |
| `ritual_wall_cta_buy_click` | > 15 |
| Lift add-to-cart vs cohorte non-exposée | ≥ + 15 % (observationnel) |

## 3. Jalon 2 — Soumission (7 j)

### 3.1 Objectif

Les initiées peuvent soumettre leur propre rituel, via le drawer ou via l'e-mail J+45 envoyé 45 jours après leur commande. La vision ML faces protège l'intimité.

### 3.2 Phases

#### Phase 2.1 — Wizard de soumission (3 j)

- Composant `RitualsWizard.tsx` avec 3 étapes + confirmation.
- Étape 1 : body + signal.
- Étape 2 : tags + photos (drag & drop + bouton).
- Étape 3 : prénom + ville + initiée depuis + anonymat.
- Animations entre étapes.
- Brouillon localStorage 7 jours.
- Toast emoji retiré.
- Validation inline non agressive.
- Tests Vitest + Playwright (parcours complet + raccourci).

DoD : initiée peut soumettre depuis le drawer, le témoignage apparaît en queue PENDING.

#### Phase 2.2 — Vision ML faces (1 j)

- Lib `lib/vision-ml/faces.ts` avec MediaPipe Face Detection.
- Worker job `vision-ml-faces` enqueued à l'upload.
- Update `ritual_testimonial_photos.faces_status`.
- UI admin avec rectangles autour des visages détectés.
- Override modératrice.
- Endpoint `POST /api/admin/rituals/[id]/photos/[photoId]/recheck`.

DoD : photo avec visage frontal est flaggée, modératrice peut override, photo avec hijab est correctement classée en `MANUAL_REVIEW`.

#### Phase 2.3 — E-mail J+45 (2 j)

- CRON `/api/cron/rituals-email-j45` quotidien 10h Maroc.
- Sélection des commandes `paid` âgées de 45 j pleins.
- HMAC token de lien pré-rempli.
- Template e-mail `rituals-j45.md`.
- Validation côté serveur du `emailToken` à l'arrivée.
- Pré-remplissage `productKey`, `customerFirstName`, `customerCity` dans le wizard.
- Test CRON sur 5 commandes test.

DoD : un e-mail envoyé à une commande test → lien ouvre le wizard pré-rempli → soumission validée.

#### Phase 2.4 — Sanitization + auto-flags (1 j)

- Pipeline `sanitizeBody()` complet.
- Détection auto-flags (emoji, link, forbidden, length, etc.).
- Stockage `body_original` + `body` + `auto_flags`.
- UI admin avec badges auto-flag.
- Liste mots interdits éditable dans `app_config`.

DoD : témoignage avec emoji passé en sanitization, body_original conservé, badge admin visible.

### 3.3 Livrables Jalon 2

- Wizard fonctionnel desktop + mobile.
- 10 e-mails J+45 envoyés à des commandes anciennes (test).
- Au moins 2 témoignages soumis spontanément.
- Vision ML opérationnelle, taux d'override < 30 %.

### 3.4 Métriques attendues fin J2 (sur 1,5 semaine après lancement)

| KPI | Cible |
| --- | --- |
| `ritual_submit_start` | > 5 |
| `ritual_submit_success` | > 2 |
| Taux complétion wizard | > 30 % |
| Délai médian modération | < 24 h |

## 4. Jalon 3 — Mesure (4 j)

### 4.1 Objectif

Le composant est complètement instrumenté. Les insights remontent dans `/admin/rituals/insights` et les expérimentations A/B sont possibles.

### 4.2 Phases

#### Phase 3.1 — Tracking complet (1 j)

- Déclaration des événements dans `event-catalog.ts`.
- Payload enrichi (entry_point, duration_ms, cards_seen, filters_active, from_card_id).
- dataLayer push pour GTM.
- Tests E2E `apps/web/e2e/rituals-tracking.spec.ts`.

DoD : tous les événements de `16-tracking-analytics.md` § 2 sont émis et visibles dans `tracking_events_log`.

#### Phase 3.2 — Table insights `insights_rituals_daily` (1 j)

- Migration `0017_insights_rituals_daily.sql`.
- Job CRON quotidien d'agrégation (depuis `tracking_events_log` → `insights_rituals_daily`).
- Pas de modification du CRON existant `insights-refresh`, ajout d'une fonction.

DoD : agrégat quotidien disponible, requêtable côté admin.

#### Phase 3.3 — Dashboard admin insights (1 j)

- Page `/admin/rituals/insights`.
- KPI globaux + histogramme tags + graphique temporel + sources + SLA.
- Composants React utilisant `lib/analytics/format.ts`.
- Pas de nouvelle lib graphique, réutilise l'existant.

DoD : Souheila ouvre `/admin/rituals/insights` et voit les KPI.

#### Phase 3.4 — Infrastructure A/B test (1 j)

- Création d'expériences `module_present_vs_absent` et `cta_wording`.
- Assignment via `experiment_assignments` (table existante).
- Cookie persistant.
- Documentation pour Souheila sur comment lancer un A/B.

DoD : A/B test "module présent vs absent" actif en preview, mesurable.

### 4.3 Livrables Jalon 3

- Tableau de bord insights fonctionnel.
- Premier A/B test lancé.
- Documentation complète.

### 4.4 Métriques attendues fin J3 (sur 1 mois total après lancement)

| KPI | Cible |
| --- | --- |
| Taux d'ouverture drawer | > 25 % des visiteurs `/kit` |
| Conversion drawer → add-to-cart | > 8 % |
| Lift conversion vs non-exposé | ≥ + 30 % (observationnel) |
| Témoignages soumis | ≥ 5 sur la période |
| Délai médian modération | < 24 h |
| Taux d'approbation | > 90 % |

## 5. Pré-requis avant démarrage

| Pré-requis | Source |
| --- | --- |
| Branche `feat/rituals-wall` créée | Git |
| 3 témoignages texte rédigés par la maison | Souheila |
| 3 photos packshot prêtes à uploader | Maison |
| Vercel Blob configuré ou stockage local décidé | DevOps |
| Vercel Functions runtime testé pour MediaPipe (5 sec limit) | Dev |
| Secrets `RITUAL_EMAIL_SECRET` et `RITUAL_PEPPER` ajoutés à `.env` | DevOps |
| Adresse `maison@femiglow-maroc.com` configurée (SPF, DKIM) | DevOps |
| Templates e-mails relus par Souheila | Marque |
| Charte sage / crème / encre validée sur sauge `#C5DBC4` (contraste bordure chips à 1,5 px sauge-pale) | Design |

## 6. Risques et mitigations

| Risque | Probabilité | Impact | Mitigation |
| --- | --- | --- | --- |
| Vision ML MediaPipe trop sévère sur hijab / sourire | Moyenne | Élevé | Modératrice override obligatoire, suivi métrique `override rate` |
| Volume initial trop faible (< 3 témoignages) | Élevée | Élevé | 3 témoignages rédigés à la main au lancement, source `manual` |
| LCP `/kit` dégradé par le module compact | Faible | Élevé | Module en RSC streaming, fallback retrait si Lighthouse < 90 |
| Spam de soumissions | Faible | Moyen | Rate-limit 1/IP/24h, 1/customer_hash/30j, captcha invisible si suspect |
| Modératrice indisponible > 48 h | Moyenne | Moyen | Alerte SLA + escalade admin, second compte modératrice prêt |
| Vercel Blob coûts à long terme | Faible | Faible | Compression Sharp obligatoire, max 5 Mo par photo, archive après 2 ans |
| MediaPipe model size 4 Mo sur Vercel Function | Faible | Faible | Layered functions ou bundle Edge, à valider en preview |
| RGPD demande suppression massive | Très faible | Moyen | Procédure documentée, action `delete_rgpd` testée |

## 7. Définition de fini (DoD globale)

Le wall est en production quand :

- ✓ Pages : module compact visible sur `/kit`, drawer fonctionne, wizard accessible.
- ✓ Admin : queue + détail + actions OK, audit log visible.
- ✓ Soumission : depuis drawer + depuis e-mail J+45, vision ML fonctionne.
- ✓ Modération : 3 témoignages réels approuvés par Souheila.
- ✓ Tracking : tous les événements émis, dashboard insights affiche des données.
- ✓ Performance : Lighthouse `/kit` performance ≥ 92, a11y 100, LCP < 2,5 s, CLS < 0,1.
- ✓ Accessibility : axe-core CI vert, navigation clavier complète, focus trap OK.
- ✓ Tests : Vitest > 90 % couverture sur lib/rituals, Playwright E2E 5 scénarios verts.
- ✓ Voix : 40+ chaînes microcopy validées par la maison (catalogue § 12).
- ✓ Conformité : page politique `/rituels-partages/politique` ou équivalent accessible.
- ✓ E-mails : 10 J+45 envoyés à commandes test, 1 e-mail d'approbation reçu, 1 e-mail de rejet reçu et formulation validée.

## 8. Post-mise en production — premières 4 semaines

| Semaine | Action |
| --- | --- |
| Sem 1 | Monitoring quotidien : ouverture du drawer, CTA buy click, premières soumissions, alertes Sentry |
| Sem 2 | Revue avec Souheila : qualité des soumissions reçues, ressenti modération |
| Sem 3 | Analyse A/B observationnelle : add-to-cart cohorte exposée vs non |
| Sem 4 | Rapport : KPI vs cibles, propositions d'ajustements (microcopy, position du module, etc.) |

## 9. Phase 2 (envisagée, hors scope du présent dossier)

À ouvrir après 3 mois en prod si le volume dépasse 50 témoignages :

- **Page dédiée `/rituels-partages`** (prototype C de `prototypes/`).
- **Cartographie typographique** par tag (inspiration prototype B).
- **A/B test contrôlé** (50/50 module présent / absent).
- **Réponse publique de la maison** à certains témoignages.
- **Multilangue AR** (interface + soumission en arabe).
- **Témoignages vidéo** (max 30 sec) — chantier conséquent.
- **Programme d'ambassadrices** : initiées les plus actives reçoivent un statut visible.

Ces extensions ne sont pas dans le périmètre actuel — elles attendent la validation du modèle initial.

## 10. Charge récapitulative

| Jalon | Phases | Charge |
| --- | --- | --- |
| J1 | Schéma + API (3 j) + Module (2 j) + Drawer (3 j) + Lightbox (1 j) + Admin (3 j) | **12 j** |
| J2 | Wizard (3 j) + Vision ML (1 j) + E-mail J+45 (2 j) + Sanitization (1 j) | **7 j** |
| J3 | Tracking (1 j) + Insights table (1 j) + Dashboard (1 j) + A/B infra (1 j) | **4 j** |
| **Total** | | **23 j ouvrés** |

À cadence d'un développeur full-stack à temps plein : **4,5 semaines calendaires** (en supposant ~5 j ouvrés / semaine).

À cadence mi-temps : ~9 semaines calendaires.

## 11. Jalon 4 — Import et bulk management

Détail complet dans `↗ execution/00-runbook.md` (phases P4.1 à P4.9) et `↗ execution/13-import-system-architecture.md`.

### 11.1 Objectif

Permettre à Souheila d'importer en masse des témoignages historiques (WhatsApp, anciens outils, exports partenaires) et de gérer les listes admin en bulk pour gagner en productivité.

### 11.2 Phases

| Phase | Sujet | Charge |
| --- | --- | --- |
| P4.1 | Migration BDD import | 0,5 j |
| P4.2 | Parsers (CSV, JSON, JSONL, TSV, ZIP) | 1,5 j |
| P4.3 | Validator, mapper, duplicate detector | 1 j |
| P4.4 | API admin import (9 endpoints) | 1,5 j |
| P4.5 | Wizard import UI (6 étapes) | 2 j |
| P4.6 | Bulk system générique | 1 j |
| P4.7 | Templates téléchargeables | 0,3 j |
| P4.8 | Page d'aide | 0,3 j |
| P4.9 | Tests intégrés | 1,5 j |
| **Total** | | **~9 j** |

### 11.3 Livrables clés

- Wizard d'import 6 étapes accessibles via `/admin/rituals/import`.
- Templates téléchargeables : CSV (`;` et `,`), TSV, JSON, JSONL, ZIP avec dossier `photos/`.
- Vision ML systématique sur photos importées.
- Rollback disponible 24 h après commit.
- Bulk actions sur queue, published, archived, import preview.
- Modales destructives avec tapage explicite.
- ~80 tests dédiés (Jest, MSW, Playwright).

### 11.4 Parallélisation

J4 peut démarrer dès que P1.1 (schéma BDD principal) est mergé. Il est **indépendant** des phases P1.5+ (UI publique). Idéal pour un second développeur.

## 12. Synthèse — la séquence sans détour

1. **Semaine 1-2** : `J1` Lecture publique. Drawer + module sur `/kit`, admin queue, 3 témoignages manuels.
2. **Semaine 2 (parallèle)** : `J4` démarrage — migrations import + parsers (un second dev).
3. **Semaine 3** : `J1` finition + `J4` continue (API admin + wizard).
4. **Semaine 4** : `J2` Soumission + `J4` finalisation (bulk + templates + tests).
5. **Semaine 5** : `J3` Mesure. Tracking complet, dashboard insights, A/B test infrastructure.
6. **Semaine 6+** : monitoring, ajustement microcopy, premier import historique réel.

C'est six semaines de travail concentré (4,5 semaines + 1,5 semaines de parallélisation import) pour un outil de conversion mesurable, respectueux de la voix maison, alimentable en masse, et évolutif vers la Phase 2 sans réécriture.
