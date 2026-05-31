# Pages admin — diffs précis

## 1. `/admin/legal/template-vars/page.tsx`

**Diff** :

```diff
+import { CreateVarForm } from '@/components/admin/legal/CreateVarForm';
+import { getUnusedTemplateVars } from '@/lib/legal/template-vars-helpers';
+import { isLegalVarsV2Enabled } from '@/lib/legal/feature-flag';

 export default async function TemplateVarsPage() {
   const session = await requireAdmin('/admin/legal/template-vars');
   const vars = await listAllTemplateVars();
+  // LEGAL-V2 — suggestions de vars utilisées sans définition
+  const suggestions = isLegalVarsV2Enabled()
+    ? await getUnusedTemplateVars()
+    : [];

   return (
     <AdminShell adminEmail={session.email} active="legal">
       <header className="mb-6">
         <h1 className="text-2xl font-semibold">Variables template</h1>
         <p className="mt-1 text-sm text-stone-600">
           ...
         </p>
       </header>

+      {isLegalVarsV2Enabled() && (
+        <section className="mb-8 rounded-md border border-stone-200 bg-white p-4">
+          <h2 className="text-lg font-medium">+ Nouvelle variable</h2>
+          <CreateVarForm suggestions={suggestions} />
+        </section>
+      )}

       <table>
         ... (liste existante inchangée) ...
       </table>
     </AdminShell>
   );
 }
```

## 2. `/admin/legal/page.tsx` (liste principale)

Optionnel : ajouter un badge "Drift" si la page a des vars utilisées sans définition DB.

```diff
   const rows = pages.map((p) => ({
     ...p,
     missingVars: detectMissingVars(p.bodyMd, vars),
+    driftVars: detectVarsInTemplate(p.bodyMd).filter(
+      (k) => !isPresetVar(k) && !vars.find((v) => v.key === k),
+    ),
   }));
```

Dans la colonne "VARS MANQUANTES", afficher :
- 🟢 OK si missing.length === 0
- 🟡 Manquante (N) si vars définies mais vides
- 🔴 Drift (N) si vars utilisées mais non définies (signal D2 résiduel)

## 3. `/admin/legal/audit/page.tsx` (nouveau)

Optionnel — page de monitoring spécifique :

```tsx
import { sql } from 'drizzle-orm';
import { requireChatDb } from '@/lib/chat/db/client';
import { CleanupE2EButton } from '@/components/admin/legal/CleanupE2EButton';

export default async function LegalAuditPage() {
  await requireAdmin('/admin/legal/audit');
  const stats = await getLegalAuditStats();

  return (
    <AdminShell active="legal">
      <h1>Audit pages légales</h1>

      <section>
        <h2>Pollution E2E</h2>
        <p>{stats.e2eOrphans} pages test E2E orphelines.</p>
        <CleanupE2EButton />
      </section>

      <section>
        <h2>Drift vars</h2>
        <ul>
          {stats.driftVars.map((v) => (
            <li key={v.key}>
              {v.key} utilisée dans {v.pages} pages, non définie en DB
            </li>
          ))}
        </ul>
      </section>
    </AdminShell>
  );
}
```

## 4. Pages publiques `/legal/[slug]`

Aucune modification UI directe — le rendu utilise simplement la version courante du `body_md` après update via admin. Le helper `presetVarsForPage` est utilisé automatiquement côté server render.

## 5. Page d'édition `/admin/legal/[slug]/edit`

Optionnel : améliorer le live preview pour afficher VERSION et LAST_UPDATED automatiquement.

Aujourd'hui le preview admin utilise `mode='admin-preview'` → les vars manquantes apparaissent comme `⦉KEY⦊`.

→ Avec `presetVarsForPage`, `VERSION` n'apparaît plus comme manquante.
