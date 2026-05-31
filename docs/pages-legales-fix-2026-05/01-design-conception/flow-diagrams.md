# Flow diagrams — avant / après

## Flow 1 — Publish d'une page draft (avant fix)

```
Admin            Edit page          Publish API          DB
  │                 │                    │                  │
  │ Edit body_md    │                    │                  │
  ├────────────────►│                    │                  │
  │ Save            │                    │                  │
  ├────────────────►│ PUT .../update     │                  │
  │                 ├───────────────────►│ UPDATE legal_pages
  │                 │                    ├─────────────────►│
  │                 │ 200 OK             │                  │
  │                 │◄───────────────────┤                  │
  │ Type "PUBLIER"  │                    │                  │
  │ Submit          │                    │                  │
  ├────────────────►│ POST .../publish   │                  │
  │                 ├───────────────────►│                  │
  │                 │                    │ detectMissingVars(body_md, vars)
  │                 │                    ├──────┐           │
  │                 │                    │ used = [CONTACT_EMAIL, SUPPORT_HOURS, ...]
  │                 │                    │ dbVars = [COMPANY_EMAIL, ...] (drift!)
  │                 │                    ◄──────┘           │
  │                 │                    │ missing = [CONTACT_EMAIL, SUPPORT_HOURS, ...] ❌
  │                 │ 400 {missing: ...} │                  │
  │                 │◄───────────────────┤                  │
  │ ❌ Erreur       │                    │                  │
                                          ★ Publish bloqué
                                          ★ Fondatrice frustrée
```

## Flow 2 — Publish d'une page draft (après fix)

```
Admin            Edit page          Publish API          DB
  │                 │                    │                  │
  │ ...edit + save  │                    │                  │
  │ Type "PUBLIER"  │                    │                  │
  ├────────────────►│ POST .../publish   │                  │
  │                 ├───────────────────►│                  │
  │                 │                    │ Récupère page    │
  │                 │                    ├─────────────────►│
  │                 │                    │                  │
  │                 │                    │ presetVarsForPage(page)  ✨
  │                 │                    │ → VERSION, LAST_UPDATED  ✨
  │                 │                    │                  │
  │                 │                    │ dbVars = [CONTACT_EMAIL ✅, CONTACT_PHONE ✅,
  │                 │                    │            SUPPORT_HOURS ✅, COOLING_OFF_DAYS ✅, ...]
  │                 │                    │                  │
  │                 │                    │ used = [CONTACT_EMAIL, SUPPORT_HOURS, ...]
  │                 │                    │ missing = []  ✅
  │                 │                    │                  │
  │                 │                    │ INSERT history + UPDATE status='published'
  │                 │                    ├─────────────────►│
  │                 │ {version: 2}  ✅   │                  │
  │                 │◄───────────────────┤                  │
  │ ✅ Page publiée │                    │                  │
                                          ★ Page accessible /legal/cgu
                                          ★ Fondatrice contente
```

## Flow 3 — Création nouvelle variable (UI)

```
Admin            template-vars UI    API                  DB
  │                 │                  │                    │
  │ Click "+ Nouvelle var"             │                    │
  ├────────────────►│ Modal ouverte    │                    │
  │ Saisir KEY      │                  │                    │
  │ Saisir label    │                  │                    │
  │ Saisir value    │                  │                    │
  │ Click "Créer"   │                  │                    │
  ├────────────────►│ POST .../template-vars                │
  │                 │   {key: "NEW_VAR", label: "...", ...}│
  │                 ├─────────────────►│                    │
  │                 │                  │ Zod validation OK  │
  │                 │                  │ INSERT             │
  │                 │                  ├───────────────────►│
  │                 │ 201 {id, key, ...}                    │
  │                 │◄─────────────────┤                    │
  │ ✅ Var créée    │ revalidatePath() │                    │
  │ Voit dans liste │                  │                    │
                                          ★ Nouvelle var dispo
                                          ★ Plus de blocage publish
```

## Flow 4 — Render public d'une page (après fix)

```
Visitor          /legal/cgv         Server (SSR)         DB
  │                 │                  │                    │
  │ GET /legal/cgv  │                  │                    │
  ├────────────────►│                  │                    │
  │                 │ Page server render│                   │
  │                 ├─────────────────►│                    │
  │                 │                  │ getLegalPageBySlug('cgv')
  │                 │                  ├───────────────────►│
  │                 │                  │ {body_md, version, ...}
  │                 │                  │                    │
  │                 │                  │ listAllTemplateVars()
  │                 │                  ├───────────────────►│
  │                 │                  │ [{CONTACT_EMAIL, ...}, ...]
  │                 │                  │                    │
  │                 │                  │ presetVarsForPage(page)  ✨
  │                 │                  │ buildVarMap(dbVars)  ✨
  │                 │                  │ substituteVars(body_md, map, 'public')
  │                 │                  │                    │
  │                 │                  │ - {{CONTACT_EMAIL}} → "info@femiglow-maroc.com"
  │                 │                  │ - {{VERSION}}       → "v2"
  │                 │                  │ - {{LAST_UPDATED}}  → "27 mai 2026"
  │                 │                  │ - {{ICE}}           → "Information sur demande" ✨
  │                 │                  │ - {{COMPANY_RC}}    → "RC disponible sur demande" ✨
  │                 │                  │                    │
  │                 │                  │ markdown → HTML    │
  │                 │ HTML rendered    │                    │
  │                 │◄─────────────────┤                    │
  │ ✅ Page affichée│                  │                    │
                                          ★ Aucune var manquante visible
                                          ★ Vars sensibles cachées
                                          ★ Email contact pour info
```

## Flow 5 — Cleanup E2E orphelins (admin)

```
Admin            audit page         API                  DB
  │                 │                  │                    │
  │ Click "Cleanup E2E"               │                    │
  ├────────────────►│ DELETE .../cleanup-e2e                │
  │                 │   {dryRun: true, olderThanDays: 7}   │
  │                 ├─────────────────►│                    │
  │                 │                  │ SELECT COUNT(*)    │
  │                 │                  │  FROM legal_pages  │
  │                 │                  │  WHERE slug LIKE   │
  │                 │                  │   'e2e-test-%'     │
  │                 │                  │    AND status='draft'│
  │                 │                  │    AND created_at  │
  │                 │                  │     < NOW() - 7d  │
  │                 │                  ├───────────────────►│
  │                 │                  │ candidates=5      │
  │                 │ {candidates: 5, deleted: 0, dryRun: true}
  │                 │◄─────────────────┤                    │
  │ Confirm "Delete 5"                │                    │
  ├────────────────►│ DELETE ...        │                    │
  │                 │   {dryRun: false} │                    │
  │                 ├─────────────────►│                    │
  │                 │                  │ DELETE FROM ...    │
  │                 │                  ├───────────────────►│
  │                 │                  │ deleted=5         │
  │                 │ {deleted: 5}     │                    │
  │                 │◄─────────────────┤                    │
  │ ✅ 5 orphelins  │                  │                    │
  │   supprimés     │                  │                    │
                                          ★ Console nettoyée
                                          ★ Plus de pollution
```

## Flow 6 — Wizard new page (inchangé)

```
Admin → /admin/legal/new → choisit template → édite → save draft → review/publish
(Aucun changement dans ce flow — il continue à fonctionner)
```

## Flow 7 — Rollback via feature flag

```
DevOps          Env var           App                 DB
  │                │                  │                    │
  │ Set            │                  │                    │
  │ LEGAL_VARS_V2 │                  │                    │
  │  =false       │                  │                    │
  ├───────────────►│                  │                    │
  │                │ Redeploy         │                    │
  │                ├─────────────────►│                    │
  │                │                  │ isLegalVarsV2()    │
  │                │                  │  returns false     │
  │                │                  │                    │
  │                │ presetVarsForPage│                    │
  │                │ NOT applied      │                    │
  │                │ → comportement   │                    │
  │                │   legacy         │                    │
                                          ★ Pages affichent [VERSION] (fallback)
                                          ★ Données restent intactes
                                          ★ Re-toggle =true sans migration
```

## Synthèse des changements de comportement

| Flow | Lecture/Écriture | Avant | Après |
|---|---|---|---|
| 1 (publish CGU) | Écriture | ❌ Bloqué missing_vars | ✅ Publie OK |
| 3 (create var UI) | Écriture | n/a | ✅ Nouveau endpoint |
| 4 (render public) | Lecture | Vars sensibles visibles | "Info sur demande" |
| 5 (cleanup E2E) | Mutation | n/a | ✅ Nouveau endpoint |
| 7 (rollback) | Toggle | n/a | ✅ Flag réversible |
