# Décisions architecturales (ADR)

Décisions structurantes prises pour ce sprint, avec contexte et alternatives.

## ADR-001 — Rename des vars DB (vs rename des templates)

**Statut** : ✅ Accepté

**Contexte** : 6 vars ont un drift naming. Deux options pour résoudre.

**Options évaluées** :

| Option | Pros | Cons |
|---|---|---|
| **A — Rename vars DB** (CONTACT_*, HOST_*, CNDP_DECLARATION_REF) | • Templates inchangés (préserve content éditorial)<br>• 1 migration SQL simple<br>• Cohérent avec ce que la fondatrice voit en preview | • Faut mettre à jour les fichiers seed `docs/legal-pages/60-content/`<br>• Risque renommer une row utilisée par autre flow |
| **B — Rename templates** (s/CONTACT_EMAIL/COMPANY_EMAIL/g dans `body_md`) | • DB schema inchangé<br>• Naming cohérent avec préfixe `COMPANY_*` | • Update 9 rows `legal_pages.body_md`<br>• Update 9 fichiers seed<br>• Update du `legal_pages_history` ? (pas évident) |

**Décision** : Option A. Le naming `CONTACT_*` / `HOST_*` est plus user-friendly que `COMPANY_*` / `HOSTING_*` (terminologie business plus naturelle).

**Conséquences** :
- Migration `0075` renomme 6 vars sans perte de valeur.
- Les fichiers seed (`docs/legal-pages/60-content/`) restent cohérents (templates intacts).
- L'UI admin `/admin/legal/template-vars` affiche désormais les vars sous leur nouveau nom.

---

## ADR-002 — Feature flag obligatoire pour le rollout

**Statut** : ✅ Accepté

**Contexte** : Le sprint touche aux pages publiques `/legal/*` qui sont SEO-indexées et requises pour la conformité (CMI bloque les paiements si CGV absentes).

**Décision** : `LEGAL_VARS_V2` env var. Par défaut `false`. Active progressivement.

**Implémentation** :

```ts
// src/lib/legal/feature-flag.ts (nouveau)
export function isLegalVarsV2Enabled(): boolean {
  return env.LEGAL_VARS_V2 === 'true';
}
```

**Usage** : si `false`, le helper `detectMissingVars` continue à reporter les vars `CONTACT_*` comme manquantes (legacy comportement). Si `true`, les nouveaux noms sont reconnus.

**Rollback** : toggle env → comportement legacy restauré sans toucher au schéma.

---

## ADR-003 — Anonymisation : "info sur demande email" plutôt qu'omission

**Statut** : ✅ Accepté (sous validation juridique)

**Contexte** : La loi 04-99 (Code Commerce Maroc) exige certaines mentions sur le site des sociétés commerçantes (RC, ICE, capital). Demande fondatrice : cacher ces infos.

**Options évaluées** :

| Option | Pros | Cons |
|---|---|---|
| **A — Omission pure** (retirer les vars du template) | • Plus simple<br>• Pages plus courtes | • ❌ Non-conformité juridique<br>• Risque CMI bloque paiements |
| **B — "Info sur demande email"** | • Mentions présentes (forme moins explicite)<br>• Privacy renforcée<br>• Fondatrice peut filtrer les demandes | • Email à monitorer<br>• Juriste doit valider |
| **C — Page dédiée `/legal/contact-juridique`** | • Sépare les infos sensibles<br>• Indexable séparément | • Plus complexe<br>• Risque cette page elle-même soit indexée |

**Décision** : Option B avec **validation juriste obligatoire avant deploy**. Si juriste rejette, fallback Option C.

**Conséquences** :
- 5 vars sensibles remplacées dans templates : ICE, COMPANY_RC, COMPANY_ADDRESS, COMPANY_FORM, COMPANY_CAPITAL, DIRECTOR_NAME (selon scope final juriste)
- HOST_NAME / HOST_ADDRESS / HOST_CONTACT gardés (obligation transparence hébergement)
- DPO_EMAIL gardé (obligation CNDP)

---

## ADR-004 — VERSION comme preset auto

**Statut** : ✅ Accepté

**Contexte** : 9 pages utilisent `{{VERSION}}` dans leur template. Aujourd'hui c'est traité comme une var DB classique (impossible à remplir manuellement de manière sensée).

**Décision** : `VERSION` devient un preset auto dérivé de `legal_pages.version` (incrémenté à chaque publish).

**Implémentation** :

```ts
// src/lib/legal/vars.ts (nouveau)
export function presetVarsForPage(
  page: { version: number; updatedAt: Date },
  now: Date = new Date(),
): Map<string, string> {
  const m = presetVars(now);
  m.set('VERSION', `v${page.version}`);
  m.set('LAST_UPDATED', formatFrenchDate(page.updatedAt));
  return m;
}
```

**Conséquences** :
- `VERSION` ne sera plus marqué manquant.
- Le rendu public affiche `v1`, `v2`, etc.
- Cohérent avec le pattern `LAST_UPDATED` déjà preset.

---

## ADR-005 — Cleanup E2E : archive vs delete

**Statut** : ✅ Accepté

**Contexte** : 5 pages `e2e-test-*` orphelines. Deux options pour les retirer de la console admin.

**Décision** : **DELETE** (différent de chat sessions où on archive).

**Justification** :
- Aucune FK ne pointe vers `legal_pages.id` côté business (à vérifier — voir [`02-backend/migrations.md`](../02-backend/migrations.md)).
- `legal_pages_history` peut être nettoyé en cascade.
- Les pages E2E n'ont pas de valeur historique.

**Vérification avant exécution** :

```sql
-- S'assurer qu'aucune FK ne casse
SELECT conname, conrelid::regclass FROM pg_constraint
WHERE confrelid = 'legal_pages'::regclass;
```

**Préventif** : ajouter test Playwright `afterAll` cleanup hook.

---

## ADR-006 — UI add-var : create-only vs full CRUD

**Statut** : ✅ Accepté

**Contexte** : `/admin/legal/template-vars` aujourd'hui : list + update value. Pas de create de nouvelle key.

**Décision** : Implémenter **create-only** dans ce sprint. Pas de delete/rename.

**Justification** :
- Create couvre 80% des besoins (D2).
- Delete/rename pose des risques (référence dans `body_md` → drift).
- Rename peut être proposé en N3 ultérieur si besoin avéré.

**UI** : nouveau formulaire `<CreateVarForm />` en tête de `/admin/legal/template-vars`.

---

## ADR-007 — Tests d'invariant : cross-table coherence

**Statut** : ✅ Accepté

**Contexte** : Risque de drift futur entre `body_md` et `legal_template_vars`.

**Décision** : Ajouter un test vitest qui valide en CI :

```ts
it('toutes les vars utilisées dans templates DB sont définies en legal_template_vars', async () => {
  const pages = await listLegalPages({});
  const dbVars = await listAllTemplateVars();
  const dbKeys = new Set(dbVars.map((v) => v.key));
  const presetKeys = new Set(['LAST_UPDATED', 'CURRENT_YEAR', 'SITE_URL', 'VERSION']);
  
  for (const page of pages) {
    const used = detectVarsInTemplate(page.bodyMd);
    for (const key of used) {
      const exists = dbKeys.has(key) || presetKeys.has(key);
      expect(exists, `Page ${page.slug} uses {{${key}}} but it's not defined in DB or presets`)
        .toBe(true);
    }
  }
});
```

→ Empêche future régression du drift.

---

## ADR-008 — Anonymisation prénom : niveau d'effort

**Statut** : ✅ Accepté

**Contexte** : 9 occurrences du prénom dans le code. Faut-il aussi anonymiser les commentaires de code, les notes internes admin ?

**Décision** : Anonymisation **publique only** pour ce sprint.

| Fichier | Action |
|---|---|
| Pages marketing (`(marketing)/*`) | ✅ Anonymiser (visible client) |
| Routes API publiques (`api/rituals/policy/route.ts`) | ✅ Anonymiser (réponse client) |
| Admin pages internes (`admin/rituals/best-practices/page.tsx`) | ⏸️ Laisser (interne, opt-in) |
| Commentaires code | ⏸️ Laisser (jamais exposés) |

**Justification** : focus sur l'externe. L'admin interne peut être anonymisée ultérieurement si besoin.

**Action** : grep régulier en CI pour éviter régression :

```ts
// vitest test
it('aucun nom propre fondatrice dans pages marketing', async () => {
  const files = await glob('src/app/(marketing)/**/*.{ts,tsx}');
  for (const f of files) {
    const content = await readFile(f, 'utf-8');
    expect(content.toLowerCase(), `Found in ${f}`).not.toMatch(/souhei[lï]a/);
  }
});
```

---

## Conventions transverses

- **Naming commits/branches** : préfixe `LEGAL-V2-XX`.
- **Logging** : `logger.info('legal.vars.create', { key, by })`, `logger.info('legal.cleanup.e2e', { deleted })`.
- **Tests d'invariants** : nouveaux tests dans `src/lib/legal/__tests__/invariants.test.ts`.
- **Migration réversible** : chaque migration doit avoir un script de rollback documenté.
