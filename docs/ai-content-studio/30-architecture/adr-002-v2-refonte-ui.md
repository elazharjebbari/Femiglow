# ADR-002 — Refonte UI Content Studio (v2)

## Statut

Accepté et déployé en staging. `CONTENT_STUDIO_V2_DEFAULT=true` actif.
Sunset legacy planifié J+7 / J+14 selon télémétrie.

## Contexte

L'interface initiale du Content Studio (`/admin/content-studio`) s'est
construite par accrétion : Idées, Calendrier, Bibliothèque, Brouillons,
Posts, Postiz, Médias se sont empilés sous forme d'onglets et de listes
plates. Les ergonomies d'usage critiques — création visuelle (image +
vidéo), planification, comparaison de variantes — étaient possibles
mais coûteuses cognitivement (cf. `audit-content-studio-ux-2026-05-22.md`,
~30 frictions identifiées).

Trois alternatives étaient sur la table (`solutions-content-studio-ux-2026-05-22.md`) :

1. **Patcher l'existant** : recoller progressivement les composants
   actuels. Coût faible, mais on conserve l'arbre IA d'origine et
   l'odeur d'UI ne disparaît jamais complètement.
2. **Refonte sur les mêmes routes** : remplacer composant par composant
   sous `/admin/content-studio`. Pas de rollback granulaire ; un bug
   coince les deux versions.
3. **Refonte parallèle sous nouvelle racine + feature-flag** (choisi) :
   construit `/admin/content-studio-v2/{home,create,library,plan}` à
   côté du legacy, bascule via `CONTENT_STUDIO_V2_DEFAULT`. Rollback
   = `sed` + `systemctl restart`, pas de revert git.

## Décision

Construire un module **v2 parallèle** avec :

- Routes `/admin/content-studio-v2/{home,create,library,plan}`.
- Module CSS isolé : `src/styles/content-studio-v2/tokens.css` scopé sur
  `.cs-v2-shell` — light + dark mode via variables CSS.
- Typo dédiée (`next/font` Newsreader + JetBrains Mono).
- Primitives propres (`Button`, `Input`, `Skeleton`, `Dialog`,
  `Toaster`) — pas de réutilisation directe des composants legacy.
- État partagé : `StudioContext` + `CommandRegistry` + `HotkeyRegistry`,
  exposés au niveau du layout.
- Backend partagé : repository, service, schémas et types Drizzle
  identiques au legacy. La refonte ne touche **pas** le data layer.

### Pattern feature-flag double

```
CONTENT_STUDIO_V2_ENABLED=true   # routes v2 répondent
CONTENT_STUDIO_V2_DEFAULT=true   # /admin/content-studio → /admin/content-studio-v2/home
```

- `ENABLED=false` → v2 désactivé partout, EmptyState affiché si on tape
  une route v2 directement.
- `ENABLED=true, DEFAULT=false` → v2 accessible pour beta-test sur
  `/admin/content-studio-v2/*`, legacy reste la canonique.
- `ENABLED=true, DEFAULT=true` (actuel) → `/admin/content-studio` redirige
  vers v2 ; `/admin/content-studio-legacy` reste accessible pour rollback
  manuel.

### Télémétrie pour décision sunset

Quatre events `audit_event` :

| Action                                  | Quand                                        |
|----------------------------------------|----------------------------------------------|
| `content_studio.v1.visited`            | Admin atteint v1 directement (substitution off) |
| `content_studio.v1.redirected_to_v2`   | Admin tape `/admin/content-studio`, redirigé |
| `content_studio.v2.visited`            | Admin atteint le home v2                      |
| `content_studio.legacy.visited`        | Admin force `/admin/content-studio-legacy`    |

SQL d'agrégation :

```sql
SELECT action, count(*) FROM audit_event
WHERE created_at > now() - interval '14 days'
  AND action LIKE 'content_studio.%'
GROUP BY action;
```

## Conséquences positives

- **Rollback non-destructif** : 1 modification d'env + 1 restart,
  pas de revert git, pas de redeploy d'image.
- **Mesure objective** : sunset décidé sur télémétrie, pas opinion.
- **Tests parallèles** : E2E v2 (14 specs) tournent en + des E2E legacy
  sans interférer (pas de routes partagées).
- **Refonte visuelle complète** sans contraintes de compatibilité
  pixel : typo, espacements, palette ont été repensés.

## Conséquences négatives

- **Code en double temporaire** : `components/admin/content-studio/`
  (legacy) + `components/admin/content-studio-v2/` cohabitent. Bundle
  size +~120 kB JS partagé tant que le legacy n'est pas supprimé.
- **Maintenance pendant la transition** : un bug data côté repository
  affecte les deux UIs. Acceptable car la data layer est stable
  (zéro modif lors de la refonte).
- **Onboarding plus complexe** : un nouveau dev doit comprendre qu'il y
  a deux modules. Mitigé par cet ADR et par les README locaux.

## Garde-fous

- **CSS scopé** : tokens et composants v2 ne fuient pas vers le legacy
  (`.cs-v2-shell` racine, classes `cs-*` préfixées).
- **Imports cloisonnés** : aucun composant v2 n'est importé par le
  legacy et inversement. Les seuls partages sont sous
  `src/lib/content-studio/*` (repository, types, schémas).
- **Feature flag par défaut désactivé** côté production tant que
  `.env` ne le force pas — pas de risque de leak.
- **Sunset criteria explicites** : `legacy.visited = 0` sur 7 jours
  consécutifs ⇒ suppression du legacy + migration éventuelle de la
  table `content_postiz_delivery` (cf. plan).

## Sunset (post-décision)

Phases 8.3 et 8.4 du runbook (`plan-content-studio-v2-2026-05-22.md`) :

1. **J+7** : check intermédiaire de la télémétrie. Si `v1.visited > 0`
   ou `legacy.visited > 0`, ouvrir un ticket d'investigation
   (probable régression v2 qui fait fuir l'admin).
2. **J+14** : si `legacy.visited = 0` sur les 7 derniers jours :
   - Suppression `components/admin/content-studio/`,
     `app/admin/content-studio-legacy/`,
     `app/admin/content-studio/dashboard/`,
     mockups sous `public/mockups/content-studio-v2/`.
   - Décision séparée sur la migration `0064_drop_content_postiz_delivery_or_archive`
     (drop vs archive) en fonction du volume de `content_postiz_delivery`.

## Références

- Audit : `docs/ai-content-service/audit-content-studio-ux-2026-05-22.md`
- Solutions comparées : `docs/ai-content-service/solutions-content-studio-ux-2026-05-22.md`
- Plan d'exécution : `docs/ai-content-service/plan-content-studio-v2-2026-05-22.md`
- Mockups initiaux : `apps/web/public/mockups/content-studio-v2/index.html`
- E2E coverage : `apps/web/e2e/content-studio-v2/*.spec.ts`
- ADR-001 (intégré au monolith) : `adr-001-integrated-module.md` — toujours en vigueur
