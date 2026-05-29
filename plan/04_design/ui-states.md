# UI states — états vus par l'opérateur, par étape du parcours

> Content Studio v2 / AI Engine · cible ADR-0007 Option 1 (convergence vers A).
> Pour **chaque** étape du parcours opérateur (`ux-flows.puml`) : états **chargement / erreur / succès** tels que vus par l'opérateur, avec le hook `data-cs-*` de design et le finding lié.
> Principe directeur : **aucun faux succès silencieux** (P1) ; toute dégradation est **visible** (P5) ; tout signal de capacité est **honnête** (P4).
> Légende état : ⏳ chargement · ❌ erreur · ✅ succès · ⚠️ avertissement honnête.

---

## Étape 1 — Plateforme + format (choix kind image/vidéo)

| État | Ce que l'opérateur voit | Hook / contrat | Finding |
|---|---|---|---|
| ✅ | `radiogroup` Type de média ; vidéo activée pour reel/story | `data-cs-section="media-kind-toggle"`, `data-cs-kind`, `aria-checked` | — |
| ⚠️ | Vidéo **désactivée** hors reel/story, avec `title` explicatif + hint | `data-cs-kind-hint`, `aria-disabled` | MISS-023 (garde format) |
| ❌ | (tentative kind=video forcé sur post/carousel) → message métier clair, pas une 500 | — (backend, T-415) | BUG-029 (contexte) |

---

## Étape 2 — Intention / variantes texte

| État | Ce que l'opérateur voit | Hook / contrat | Finding |
|---|---|---|---|
| ⏳ | Indicateur de génération de variantes | spinner sur l'action | — |
| ✅ | 3 variantes proposées ; modèle effectif tracé | `data-cs-section="text-model"` | BUG-056/MISS-012 (modèle honoré, ui-ux) |
| ❌ | **Toast d'erreur + bouton réessayer** (fin de l'idée sans variantes, zéro toast) | branche `else`/`catch` → `toast.error(formatError(...))` | **BUG-022** (échec silencieux, ui-ux) |
| ⚠️ | Le toggle mock/live a un effet réel sur le texte OU libellé honnête « ne pilote pas encore le texte » | source unique du mode | MISS-001/BUG-020 (ui-ux ACT-UX-006) |

---

## Étape 3 — Choix du média (picker honnête)

| État | Ce que l'opérateur voit | Hook / contrat | Finding |
|---|---|---|---|
| ✅ | Badge `● Live` **uniquement** si générable (même clé que le moteur) | `data-cs-model-source-badge`, vocabulaire Live/Cache/Statique (design-system §4) | BUG-007/024 (câblage ui-ux) |
| ⚠️ | Modèles non générables **grisés `Indisponible`**, non sélectionnables, jamais auto-sélectionnés | `aria-disabled` | MISS-002, BUG-006 |
| ❌ | id custom invalide → refus UI clair, **aucune** requête de génération | `allowCustom=false` par défaut | MISS-015, BUG-028 |

---

## Étape 4 — Génération média

### 4a — Image

| État | Vue opérateur | Hook | Finding |
|---|---|---|---|
| ⏳ | `EstimatorBar` running/longer/stuck ; bouton `loading` | `data-cs-generate-button` (loading) | — (bon pattern à préserver) |
| ✅ | Image attachée + bande métadonnées (kind/dimensions/ratio) | `data-cs-meta-kind/-dimensions/-ratio` | — |
| ❌ | Message **métier** (pas la clé d'env brute) ; bouton réessayer | message serveur précis, non écrasé | BUG-001/006 (msg), BUG-054 |

### 4b — Vidéo (async via A)

| État | Vue opérateur | Hook | Finding |
|---|---|---|---|
| ⏳ | « Génération vidéo en cours » honnête (poll hors requête HTTP) | `data-cs-generate-button` libellé **« Générer une vidéo IA »** + `data-cs-kind="video"` | **BUG-029, BUG-055** (contrat hooks ACT-DS-001/002) |
| ✅ | Vidéo lisible + **badge `VIDÉO · m:ss`** permanent | `data-cs-video-badge`, `data-cs-video-duration` | **BUG-029/055** (badge/durée), BUG-067 (works) |
| ❌ | Modèle vidéo non routable → message honnête (pas « aucun modèle » faux) | — | BUG-009/002 (backend/ui-ux) |

> **Note BUG-029/055 (cœur design)** : l'invariant `kind=video ⇔ libellé « Générer une vidéo IA » ⇔ icône Film ⇔ badge VIDÉO` est garanti par une source unique et **testé via les hooks** (`data-cs-generate-button`, `data-cs-kind`, `data-cs-video-badge`), jamais via un libellé localisé seul. C'est ce qui élimine le rouge faux sur un parcours fonctionnel.

---

## Étape 5 — Capacités riches via A (cible — corrige BUG-004)

| État | Vue opérateur | Hook / contrat | Finding |
|---|---|---|---|
| ⏳ | Slots voix-off/musique/sous-titres/compose en cours (jobs A) | slots conditionnels | BUG-004 |
| ✅ | Lecteur voix-off/musique jouable ; aperçu sous-titres **multi-cue** ; vidéo composée | slots rendus **ssi** asset présent (ACT-DS-005) | BUG-004, **BUG-066** (wrapping) |
| ❌ | Asset dégradé → marqué `degraded` avec raison (jamais `completed` sur média absent) | état explicite | MISS-011/020 (backend T-304) |
| (absent) | Slot **non rendu** si l'asset n'existe pas — pas de promesse vide | conditionnel | anti-tromperie (ADR-0015) |

---

## Étape 6 — Aperçu réseau (fidélité)

| État | Vue opérateur | Hook / contrat | Finding |
|---|---|---|---|
| ✅ | Aperçu = **plus grande dérivée** (≥ md/original), reflète la publication réelle | `renderMedia` choisit `original/lg/md` | **BUG-053** (ACT-DS-004) |
| ❌ | `previewUrl` vide / asset introuvable / < 1 ko → **placeholder « média indisponible »** | état d'erreur visuel dédié | **MISS-021** (`<video src=''>`), **MISS-004** (stub 10 o) |
| ⚠️ | (post-LIVE) divergence aperçu↔rendu IG réel signalée par comparaison pixel-à-pixel | vérif live | BUG-053 (DoD live) |

---

## Étape 7 — Approbation

| État | Vue opérateur | Hook / contrat | Finding |
|---|---|---|---|
| ✅ | « Valider et préparer la publication » | — | — |
| ❌ | Sans média : **message serveur précis** (« Un visuel doit être associé… »), pas « État de draft invalide » | `formatError` préfère `e.message` utile | **BUG-054** (ui-ux ACT-UX-007/T-414) |

---

## Étape 8 — Publication (sous garde-fou anti-incident, P3)

| Mode | ⏳ / ✅ | ❌ / ⚠️ | Finding |
|---|---|---|---|
| **Maintenant** | ✅ confirmé par **effet métier réel** (permalien), pas un 200 seul | ⚠️ compte Postiz **explicite** (jamais deviné) ; portée mock-génération ≠ publication clarifiée | BUG-003 (parité), **BUG-039/040** |
| **Programmer** | ✅ état reflétant l'exécution **réelle** du scheduler (T-103b gardé T-204/T-301) | ❌ plus de toast « Publication programmée » **mensonger** sur job inerte | **BUG-003** |
| **Brouillon** | ✅ draft Postiz via route gardée | ⚠️ `dry_run` = défaut honnête, jamais `published` factice | BUG-040/065, T-020/T-308 |

---

## États transverses (toutes étapes)

| État transverse | Contrat | Finding |
|---|---|---|
| ⚠️ Mode mock/live | **Une seule source** : toggle = `MockModeBadge` = défaut serveur (`health.mockMode`) ; le mock-génération **ne protège pas** la publication (clarifié) | **BUG-021**, MISS-016 (ui-ux ACT-UX-005) |
| ⚠️ Avertissement de coût | `MockModeBadge` **lisible** (contraste ≥ 4.5:1 — corrige 2.46:1) | MISS-DESIGN-002 (ACT-DS-003) |
| ❌ Toast d'erreur | Annoncé via `role="status"`/`alert` (accessibilité) | — (à préserver) |
| ✅ Contraste | Texte fonctionnel ≥ 4.5:1 sur les 2 thèmes, **vérifié en CI** | MISS-DESIGN-001 (ACT-DS-003, ADR-0014) |
| ✅ Reduced motion | `prefers-reduced-motion` respecté | — (à préserver) |

> **Règle de DoD pour chaque état** : un état n'est « fini » que **prouvé en MOCK et en LIVE** via le même parcours opérateur (P2). Pour les états visuels (contraste, distinction kind, aperçu) : `mock = mesure/test sur tokens & hooks`, `live = audit du DOM rendu réel et comparaison au rendu réseau`.
