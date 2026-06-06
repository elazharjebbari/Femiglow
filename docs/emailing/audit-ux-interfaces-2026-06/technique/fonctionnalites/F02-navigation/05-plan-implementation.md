# F02 — Plan d'implémentation (P1.4 du plan global)

> Ordre imposé : **données d'abord** (endpoint + cache + ses tests intégration),
> puis la barre, puis le breadcrumb, puis la palette, puis le nettoyage des
> quick-links. Chaque étape est livrable et testée avant la suivante. Chaque
> étape respecte l'invariant transverse : **aucune requête bloquante au rendu
> RSC**.

---

## Étape 0 — Préparation (squelette + factories)

- Définir `SectionKey` + table des sections (clé, libellé, base, badge) dans un
  module partagé `src/lib/admin/emails/nav-sections.ts` (source unique consommée
  par EmailsTabs, le mapping breadcrumb et les tests).
- Factories : `navCounters.factory.ts` (presets `aucun`, `dlqSeul`,
  `multiBadges`, `plafond150`) dans `emails.factory.ts`.
- Handler MSW baseline `nav-counters` (200 nominal) ajouté à `emailsHandlers`.

**Sortie testée.** Unitaires du mapping route→onglet (F02-U-001..009) et
plafond badge (F02-U-010..012) — logique pure, aucun composant requis.

---

## Étape 1 — Endpoint `nav-counters` + cache (EN PREMIER)

- Créer `src/app/api/admin/emails/nav-counters/route.ts` :
  `requireAdmin` → 401 ; calcul des 3 compteurs ; réponse `navCountersSchema`.
- Calcul mémoïsé via `unstable_cache(fn, ['emails-nav-counters'], { revalidate:
  30, tags: ['emails-nav-counters'] })`. **Le `revalidate: 30` est la première
  ligne écrite et la première vérifiée en revue** (gotcha TTL absent =
  badges figés, déjà vu sur i18n-bindings / analytics-insights).
- Schéma Zod `navCountersSchema` exporté et **partagé** avec le handler MSW
  (test de conformité de contrat).
- Sources : COUNT DLQ outbox, COUNT runs `errored` actifs, COUNT campaign_link
  sync KO (0 si table/feature absente).

**Sortie testée (intégration, Postgres `femiglow_test`).** F02-I-001 (401),
F02-I-002 (200 + conformité contrat), F02-I-003 (reflet DB), **F02-I-004 (2
appels <30s = 1 requête DB)**, F02-I-005 (recalcul post-TTL), F02-I-006
(listmonk 0), F02-I-007 (500 honnête). + unitaires Zod F02-U-016/017.

**Pourquoi en premier.** La barre ne consomme que ce contrat ; le verrouiller
(forme + cache + dégradation) évite de retravailler EmailsTabs ensuite.

---

## Étape 2 — `EmailsTabs` (barre persistante + badges)

- Créer `src/components/admin/emails/EmailsTabs.tsx` (client) :
  - rend les 9 onglets (liens) dans l'ordre canonique, `aria-current="page"` via
    `usePathname()` + mapping route→onglet ;
  - responsive `overflow-x-auto` (pas de menu caché) ;
  - badges : fetch `nav-counters` **post-hydratation** (effect), `null` au
    premier rendu (aucun skeleton), refresh 30 s **suspendu onglet caché**
    (`visibilitychange`), conservation du dernier compteur connu sur échec ;
  - capage visuel `99+`, tokens danger/warning, libellé accessible avec le
    nombre.
- Monter `EmailsTabs` dans `layout.tsx`, **au-dessus** de `{children}`, sans
  introduire de fetch serveur dans le layout (le layout reste RSC pur).

**Sortie testée (composant + MSW).** F02-C-001..003 (rendu/actif),
F02-C-004 (Suppression onglet), F02-C-005..009 (badges 0/3/99+/runs/sync),
**grille de dégradation F02-C-010..012 (500/hang/network — onglets cliquables,
pas de badge, rendu non bloqué)**, F02-C-014..016 (refresh suspendu/repris/
conservation), F02-C-017/018 (clavier), F02-C-031 (pas de fetch RSC),
F02-A-001/003 (axe + annonce badge).

---

## Étape 3 — Breadcrumb harmonisé (adoption généralisée)

- Réutiliser le composant `Breadcrumb` existant (aucun changement de composant
  attendu, sauf besoin marginal).
- Ajouter un helper `buildEmailsBreadcrumb(route, objet?)` (pur) qui produit les
  segments selon le mapping route→breadcrumb (cf. spec §4) ; `EMAILS_ROOT`
  toujours en tête ; libellé d'objet fourni par la page (aucun fetch) ; fallback
  id tronqué.
- Brancher chaque écran emails (liste + détail + new/edit + runs) sur ce helper,
  en **remplacement** des back-links divergents (TRV-03).

**Sortie testée.** Unitaires F02-U-013..015 (mapping + fallback) ; composant
F02-C-019..023 (rendu par écran) ; a11y F02-A-002.

---

## Étape 4 — Palette ⌘K enrichie

- Dans `GlobalCommandPalette` : ajouter entrée Navigation **Suppression** et
  **Runs automations** ; vérifier les 9 sections ; placeholder « Rechercher…
  (Cmd-K / Ctrl-K) » ; `Nouvelle campagne` → `/campaigns/new`.

**Sortie testée.** F02-C-024..030 (Suppression trouvable/navigue, placeholder,
9 sections, runs, Ctrl-K ouvre, Esc ferme).

---

## Étape 5 — Route `/campaigns/new` (NAV-F06)

- Créer `src/app/admin/emails/campaigns/new/page.tsx` : `redirect()` vers le flux
  de création (ou rendu direct du formulaire selon décision F05). Invariant :
  jamais de 404.

**Sortie testée.** Intégration F02-I-008 (non-404) ; E2E F02-E-005.

---

## Étape 6 — Nettoyage : retrait des quick-links dashboard redondants

- Une fois la barre persistante validée, retirer du dashboard les 7 quick-links
  de section devenus redondants.
- **Conserver transitoirement** le quick-link **Suppression** (NAV-F04 :
  « onglet + palette + (transitoire) quick-link dashboard ») jusqu'à validation
  de la découvrabilité par onglet — retrait dans une PR ultérieure.

**Sortie testée.** E2E F02-E-002 (Suppression toujours atteignable par onglet ET
palette après retrait des quick-links).

---

## Étape 7 — E2E de phase + a11y pages

- Specs `SM-F02-01..04` (cf. `04-scenarios-metier.md`) : F02-E-001..006.
- axe Playwright sur dashboard / transactional / suppression avec la barre
  montée (F02-E-006), gate 0 serious/critical.

---

## Risques & mitigations

| Risque | Impact | Mitigation |
|---|---|---|
| **Collision avec le layout existant** (le layout monte déjà la palette ; ajout de la barre) | régression de rendu / double montage | Ajout **additif** dans `layout.tsx` : `EmailsTabs` au-dessus de `{children}`, palette inchangée. Test composant de structure du layout. |
| **Coût RSC** : tentation de fetch `nav-counters` côté serveur dans le layout | TTFB dégradé sur toutes les pages emails ; un endpoint lent bloquerait chaque page | Interdiction explicite (spec §2.4 + test F02-C-031) : fetch **uniquement** client post-hydratation. |
| **TTL `unstable_cache` omis** | badges figés indéfiniment (gotcha connu) | `revalidate: 30` obligatoire, vérifié par F02-I-004/005 et en revue (G7-like). |
| **Onglet caché derrière overflow menu** | Suppression redeviendrait non découvrable (re-SUP-01) | `overflow-x-auto`, jamais de menu « … » ; E2E F02-E-002. |
| **Saut de mise en page** quand les badges arrivent | gêne visuelle | Pas de skeleton ; pastille en overlay/espace réservé stable. |
| **`/campaigns/new` divergent de la décision F05** | incohérence flux | Contrat F02 minimal : non-404 + breadcrumb/onglet cohérents ; la cible exacte du redirect suit F05. |
| **Badge sync Listmonk avant LMK-F04** | source absente | `listmonkSyncFailed` retourne 0 si la table/feature n'existe pas encore (F02-I-006). |

---

## Rollback

- **Granularité PR par étape** ; chaque étape est indépendamment réversible.
- **Barre** : retirer `<EmailsTabs />` du layout → retour à l'état actuel
  (palette seule) sans toucher aux pages.
- **Endpoint** : `nav-counters` est lu uniquement par EmailsTabs ; le supprimer
  après retrait de la barre n'affecte rien d'autre.
- **Breadcrumb** : le composant et les anciens back-links peuvent coexister ; en
  cas de souci on rétablit le back-link d'un écran sans bloquer les autres.
- **Quick-links dashboard** : leur retrait est la **dernière** étape et la
  première à annuler — re-ajout trivial puisque conservés en historique git.
- **Aucune migration de schéma** (lecture seule de l'existant) → rollback =
  build + restart (`systemctl restart femiglow.service`), pas de revert DB.
