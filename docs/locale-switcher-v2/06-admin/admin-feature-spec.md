# Admin Feature Spec — `/admin/i18n`

> **Source de vérité** : [`../CONTRACT.md`](../CONTRACT.md) §2 (page `/admin/i18n` → `apps/web/src/app/admin/i18n/page.tsx`), §3 (config), §6 (INV-12).
> **Précédents de style à mirrorer** : `apps/web/src/app/admin/settings/flags/page.tsx` (page admin : `requireAdmin` + `AdminShell` + `getSection` + éditeur), `apps/web/src/app/api/admin/settings/[section]/route.ts` (write path), `FlagsEditor`-style optimistic editor.
> Backend associé : [`../04-backend/api-contracts.md`](../04-backend/api-contracts.md).

---

## 1. (a) Fonctionnement optimal — ce que l'admin peut faire

La page `/admin/i18n` est le **poste de pilotage** unique du Locale Switcher V2. Server Component : `requireAdmin('/admin/i18n')` → `getAdminLocaleConfig()` (avec `version`) → rend un client editor dans `<AdminShell active="settings">`.

L'admin peut, sur **une seule** config singleton (PUT atomique) :

1. **Activer / désactiver une locale** (`locales[].enabled`) — toggle par locale. **Garde-fou** : le toggle de la locale par défaut est **désactivé** (impossible de la désactiver — V-DEFAULT-ENABLED). Impossible de tout désactiver (V-AT-LEAST-ONE-ENABLED).
2. **Éditer l'endonyme** (`locales[].endonym`) — champ texte par locale, non-vide (V-ENDONYM). Saisie en script natif (ex. `العربية` en arabe).
3. **Réordonner** (`locales[].order`) — drag-and-drop ou boutons ↑/↓ ; les `order` restent uniques et contigus (V-ORDER-UNIQUE).
4. **Définir la locale par défaut** (`defaultLocale`) — radio/select ; choisir un défaut **réactive** automatiquement la locale s'il le faut (UX : on ne peut pas choisir un défaut désactivé → soit on l'active, soit on bloque).
5. **Activer/désactiver le nudge** (`nudge.enabled`) + régler `maxImpressionsPerVisitor` (0–3).
6. **Choisir la variante de surface** (`surfaces.{header,drawer,footer}.variant` ∈ dropdown|pills|toggle) — pour l'A/B B1 vs B2 (dossier §11 H1).
7. **Régler la transition** (`transition.durationMs` 200–560, `easing`) — borné charte.
8. **Prévisualiser en direct FR / AR / EN, RTL inclus** — un panneau de preview rend le `LocaleSwitcher` avec la config en cours d'édition, dans les 3 langues, avec **bascule `dir=rtl`** réelle pour AR (mirror complet du composant prod, pas une maquette).

---

## 2. UX du formulaire

- **Layout** : colonne gauche = formulaire (sections : Locales / Défaut & nudge / Surfaces / Transition) ; colonne droite = **preview live** sticky.
- **Preview live** : onglets `FR | AR | EN`. L'onglet AR force `dir="rtl"` sur un conteneur isolé → l'admin voit le miroir (alignement `end`, point sauge `end`-aligné) **avant** de publier. Le panneau de transition montre un bouton « rejouer le fondu » qui applique la `durationMs`/`easing` saisis.
- **Validation inline** : chaque règle de `config-schema.yaml` qui échoue surligne le champ fautif avec son message (mappé sur le `rule` code renvoyé par le 422). Le bouton **Publier** est désactivé tant qu'une erreur bloquante subsiste (validation Zod côté client = miroir du schéma serveur, mais le serveur reste l'autorité).
- **Optimistic save** : au clic Publier → PUT `If-Match: <version>` avec `{ payload, note? }`.
  - **Succès** : la `version` locale est mise à jour (réponse), toast « Publié », l'état n'est plus *dirty*.
  - **422** : on **n'écrase pas** l'UI ; on affiche les `details[].rule` sur les champs (rollback optimiste).
  - **409 version_conflict** : bannière « Un autre admin a modifié cette config (v{currentVersion}). Recharger pour repartir de la dernière version. » → bouton recharger (pas d'écrasement aveugle).
  - **401/403** : redirection login / message permission.
- **Champ `note`** : commentaire d'audit optionnel (« A/B toggle header ON ») stocké dans le snapshot + audit.
- **Reset to defaults** : action secondaire (confirmation) qui propose le payload `defaults` dans le formulaire (publié via le même PUT) — utile en sortie d'état douteux.

---

## 3. Invalidation du cache public (non-régression)

Au PUT accepté, le route handler appelle `revalidateTag('i18n-locale-config')` → le prochain `GET /api/i18n/config` (et le rendu RSC du `LocaleSwitcher`) reflète la nouvelle config. **À garantir** : aucune mise en cache d'un payload invalide ; le public ne voit jamais un état intermédiaire (l'écriture est atomique + un seul revalidate après commit).

---

## 4. (b) Éléments à VÉRIFIER / TESTER

### Authz
- [ ] Accès `/admin/i18n` sans session ⇒ redirect `/admin/login?next=/admin/i18n` (`requireAdmin`).
- [ ] Session sans droit `read` sur la resource ⇒ 403 / page refusée.
- [ ] PUT sans droit `write` ⇒ 403, formulaire informe, aucune mutation.

### Validation
- [ ] Chaque fixture invalide (`fixtures.json`) saisie au formulaire ⇒ erreur inline + bouton Publier bloqué + (si bypass client) 422 serveur avec le bon `rule`.
- [ ] Impossible de désactiver le default (toggle grisé) ; tenter via API directe ⇒ 422 (V-DEFAULT-ENABLED).
- [ ] Impossible de tout désactiver (V-AT-LEAST-ONE-ENABLED).
- [ ] Endonyme vidé ⇒ erreur (V-ENDONYM). `ar` forcé `rtl` (direction non éditable vers ltr — V-AR-RTL).
- [ ] `durationMs` hors [200,560] ⇒ erreur ; `maxImpressionsPerVisitor` hors [0,3] ⇒ erreur.

### Correction de la preview
- [ ] L'onglet AR rend `dir="rtl"` : alignement `end`, point actif `end`, **0 latin** hors `FemiGlow` (INV-6) dans le rendu preview.
- [ ] La preview reflète **exactement** la config en cours d'édition (réordonnancement, endonymes, variante) sans publier.
- [ ] La variante `toggle`/`pills`/`dropdown` change réellement le rendu du `LocaleSwitcher` en preview.
- [ ] Le « rejouer le fondu » respecte `prefers-reduced-motion` (pas d'animation si réduit).

### Audit trail
- [ ] Tout PUT accepté ⇒ 1 entrée audit `i18n-config.update` (acteur, version, snapshotId, note, before/after) + 1 snapshot (cf. admin-permissions.md).
- [ ] 401/403/422/409 ⇒ **aucune** entrée audit / snapshot (pas d'écriture sur échec).

### Non-régression cache public
- [ ] Après PUT, `GET /api/i18n/config` renvoie la nouvelle config (ETag changé) et le `LocaleSwitcher` public reflète le changement au prochain rendu.
- [ ] Un PUT invalide n'altère ni le cache ni la config servie (public inchangé).
- [ ] Concurrence : deux onglets admin éditant en // ⇒ le 2e Publier reçoit 409 et n'écrase pas (test E2E).

### Accessibilité (charte)
- [ ] Formulaire navigable clavier ; toggles avec labels ; erreurs annoncées (`aria-live`).
- [ ] Aucun pop chaud / pulse introduit dans la preview (invariant charte).
