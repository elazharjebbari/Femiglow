# Pages admin — diffs précis

> Modifications React Server Components et Client Components.

## 1. `/admin/chat/conversations/page.tsx` — diff

```diff
 export default async function ChatConversationsPage({ searchParams }: PageProps) {
   const session = await requireAdmin('/admin/chat/conversations');
   const enabled = isChatEnabled();

   const q = searchParams?.q?.trim() ?? '';
   const lang = searchParams?.lang?.trim() ?? '';
   const status = searchParams?.status?.trim() ?? '';
   const convertedRaw = searchParams?.converted?.trim() ?? '';
   const converted: 'yes' | 'no' | undefined =
     convertedRaw === 'yes' || convertedRaw === 'no' ? convertedRaw : undefined;
+  // CHA-LEAD-V2 — Toggle debug pour voir aussi les sessions sans messages
+  // (typiquement ghosts wizard ou bootstraps abandonnés).
+  const debugGhosts = searchParams?.debug === 'ghosts';
+  const includeAllKinds = searchParams?.kind === 'all';

   let rows: Awaited<ReturnType<typeof adminQueries.listConversations>> = [];
   let convertedIds = new Set<string>();
   let queryError: string | null = null;
   if (enabled) {
     try {
       rows = await adminQueries.listConversations({
         q: q || undefined,
         language: lang || undefined,
         status: (status as 'open' | 'idle' | 'archived' | 'purged' | '') || undefined,
         converted,
+        withMessagesOnly: !debugGhosts,
+        kinds: includeAllKinds ? undefined : ['chat'],
         limit: 100,
       });
       const ids = await adminQueries.convertedSessionIds();
       convertedIds = new Set(ids);
     } catch (err) {
       queryError = (err as Error).message;
     }
   }

   return (
     <AdminShell adminEmail={session.email} active="chat">
       <ChatAdminNav active="conversations" />
       <header className="mb-4">
         <h1 className="text-2xl font-semibold tracking-tight">Conversations</h1>
+        <p className="mt-1 text-sm text-stone-600">
+          {debugGhosts ? (
+            <>
+              Mode <strong>debug</strong> — toutes les sessions visibles (y compris
+              wizard pivots et bootstraps vides).{' '}
+              <Link href="/admin/chat/conversations" className="underline-offset-2 hover:underline">
+                Repasser en mode normal
+              </Link>
+            </>
+          ) : (
+            <>
+              Affiche uniquement les conversations avec au moins un message envoyé.
+              <Link
+                href="/admin/chat/conversations?debug=ghosts"
+                className="ml-2 underline-offset-2 hover:underline text-stone-500"
+              >
+                Voir tout (debug)
+              </Link>
+            </>
+          )}
+        </p>
       </header>

       {/* form filters — inchangé */}

       <p className="mb-3 text-xs text-stone-500" aria-live="polite">
         {rows.length} conversation{rows.length === 1 ? '' : 's'} ·{' '}
         <span className="inline-flex items-center gap-1">
           <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden /> converties :{' '}
           {rows.filter((s) => convertedIds.has(s.id)).length}
         </span>
+        {debugGhosts && (
+          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">
+            DEBUG : kinds=all + sessions vides incluses
+          </span>
+        )}
       </p>

       {/* table — inchangée sauf row class */}
       <tr key={s.id} className={
+        s.kind === 'wizard_pivot'
+          ? 'bg-amber-50/40 hover:bg-amber-50'
+          : (isConverted ? 'bg-emerald-50/70 hover:bg-emerald-50' : 'hover:bg-stone-50')
       }>
         {/* ... cells ... */}
         <td className="px-3 py-2 font-mono text-xs">
           <Link href={`/admin/chat/conversations/${s.id}`}>{s.id}</Link>
+          {s.kind === 'wizard_pivot' && (
+            <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[10px] text-amber-700">
+              wizard
+            </span>
+          )}
         </td>
         {/* ... */}
       </tr>
     </AdminShell>
   );
}
```

## 2. `/admin/chat/leads/page.tsx` — diff

```diff
 export default async function ChatLeadsPage({ searchParams }: PageProps) {
   const session = await requireAdmin('/admin/chat/leads');
   const enabled = isChatEnabled();

   const outcome = (searchParams?.outcome ?? '').trim();
   const trigger = (searchParams?.trigger ?? '').trim();
   const hotOnly = searchParams?.hot === '1';
+  // CHA-LEAD-V2 — Toggle pour inclure les leads wizard (vue debug).
+  const includeWizard = searchParams?.includeWizard === '1';

   let rows: ChatLeadRow[] = [];
   let queryError: string | null = null;
   if (enabled) {
     try {
       rows = await adminQueries.listChatLeads({
         outcome: ...,
         triggerReason: ...,
+        sources: includeWizard
+          ? undefined
+          : ['chat_widget', 'inline'],
         limit: 200,
       });
     } catch (err) {
       queryError = (err as Error).message;
     }
   }

   // ... rest inchangé ...

   return (
     <AdminShell adminEmail={session.email} active="chat">
       <ChatAdminNav active="leads" />
       <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
         <div>
           <h1 className="text-2xl font-semibold tracking-tight">Leads chat</h1>
           <p className="mt-1 text-sm text-stone-600">
             Capture in-chat (prénom + téléphone). Vue rapide ; pour la fusion
             avec les leads ecommerce, voir{' '}
             <Link href="/admin/leads" className="underline-offset-2 hover:underline">
               /admin/leads
             </Link>
             .
+            {includeWizard ? (
+              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 text-xs">
+                DEBUG : sources wizard incluses
+              </span>
+            ) : null}
           </p>
         </div>
         {/* boutons digest + export */}
       </header>

       {/* counters — inchangés */}

       <form className="mb-4 flex flex-wrap gap-2 text-sm" method="get">
         {/* selects outcome + trigger inchangés */}
         <label>
           <input type="checkbox" name="hot" value="1" defaultChecked={hotOnly} />
           Hot only
         </label>
+        <label>
+          <input type="checkbox" name="includeWizard" value="1" defaultChecked={includeWizard} />
+          Inclure leads wizard (debug)
+        </label>
         <button type="submit">Filtrer</button>
       </form>

       {/* table — diff sur la ligne */}
       <tr key={l.id} className={rowClass}>
         <td className="px-3 py-2 font-medium text-stone-900">{l.firstName}</td>
         <td className="px-3 py-2 font-mono text-xs">{l.phoneE164}</td>
         <td className="px-3 py-2">
           <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-700">
             {l.triggerReason}
           </span>
         </td>
+        {/* ... */}
+        <td className="px-3 py-2">
+          <SourceBadge source={l.source} withTooltip />
+        </td>
         {/* outcome, attente, page, session, créé, actions — inchangés */}
       </tr>
     </AdminShell>
   );
}
```

## 3. `/admin/chat/audit/page.tsx` — section "Cleanup ghosts" (ajout)

Le fichier `audit/page.tsx` existe déjà (vu dans `find admin/chat`). On y ajoute un panneau pour exécuter le cleanup endpoint.

```diff
 export default async function ChatAuditPage() {
   const session = await requireAdmin('/admin/chat/audit');

+  // CHA-LEAD-V2 — Récupérer le rapport de pollution
+  const pollutionReport = await fetchPollutionReport();

   return (
     <AdminShell adminEmail={session.email} active="chat">
       <ChatAdminNav active="audit" />
       {/* ... contenu existant ... */}

+      <section className="mt-8 rounded-md border border-stone-200 bg-white p-4">
+        <h2 className="text-lg font-semibold tracking-tight">
+          Pollution chat_session
+        </h2>
+        <p className="mt-1 text-sm text-stone-600">
+          Vue synthétique : répartition par kind et source, cohérence cross-table.
+        </p>
+
+        <div className="mt-4 grid gap-4 sm:grid-cols-2">
+          <div>
+            <h3 className="mb-2 text-sm font-medium uppercase text-stone-500">
+              Sessions par kind
+            </h3>
+            <table className="w-full text-sm">
+              <tbody>
+                {pollutionReport.distributions.session_kind.map((r) => (
+                  <tr key={r.kind}>
+                    <td className="py-1">{r.kind}</td>
+                    <td className="py-1 text-right tabular-nums">{r.n}</td>
+                  </tr>
+                ))}
+              </tbody>
+            </table>
+          </div>
+          <div>
+            <h3 className="mb-2 text-sm font-medium uppercase text-stone-500">
+              Leads par source
+            </h3>
+            <table className="w-full text-sm">
+              <tbody>
+                {pollutionReport.distributions.lead_source.map((r) => (
+                  <tr key={r.source}>
+                    <td className="py-1">{r.source}</td>
+                    <td className="py-1 text-right tabular-nums">{r.n}</td>
+                  </tr>
+                ))}
+              </tbody>
+            </table>
+          </div>
+        </div>
+
+        {/* Bouton cleanup en client component */}
+        <CleanupGhostsButton />
+      </section>
     </AdminShell>
   );
}
+
+async function fetchPollutionReport() {
+  // SSR fetch local
+  const res = await fetch(
+    `${process.env.NEXT_PUBLIC_BASE_URL}/api/admin/chat/audit-pollution`,
+    { headers: { cookie: cookies().toString() } },
+  );
+  return res.json();
+}
```

## 4. `<CleanupGhostsButton />` — Client Component

**Fichier nouveau** : `apps/web/src/components/admin/chat/CleanupGhostsButton.tsx`

```tsx
'use client';
/**
 * CHA-LEAD-V2 — Bouton cleanup ghosts avec preview + confirmation modale.
 *
 * Cf. docs/chat-conversations-leads-fix-2026-05/02-backend/api-routes.md §6
 */
import { useState } from 'react';

export function CleanupGhostsButton(): JSX.Element {
  const [step, setStep] = useState<'idle' | 'preview' | 'confirming' | 'done'>('idle');
  const [candidates, setCandidates] = useState<number>(0);
  const [archived, setArchived] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  async function handlePreview() {
    setStep('preview');
    setError(null);
    try {
      const res = await fetch('/api/admin/chat/cleanup-ghosts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dryRun: true, olderThanDays: 30 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Erreur');
      setCandidates(json.candidates);
      setStep('confirming');
    } catch (err) {
      setError((err as Error).message);
      setStep('idle');
    }
  }

  async function handleConfirm() {
    setStep('confirming');
    setError(null);
    try {
      const res = await fetch('/api/admin/chat/cleanup-ghosts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dryRun: false, olderThanDays: 30 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Erreur');
      setArchived(json.archived);
      setStep('done');
    } catch (err) {
      setError((err as Error).message);
      setStep('idle');
    }
  }

  return (
    <div className="mt-4 rounded-md border border-stone-200 bg-stone-50 p-3">
      <h3 className="text-sm font-medium">Cleanup ghosts orphelins</h3>
      <p className="mt-1 text-xs text-stone-600">
        Archive les sessions wizard sans lead lié plus vieilles que 30 jours.
        Action réversible (status='archived', pas de DELETE).
      </p>

      {error && (
        <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </div>
      )}

      {step === 'idle' && (
        <button
          type="button"
          onClick={handlePreview}
          className="mt-3 rounded-md bg-stone-900 px-3 py-1.5 text-sm text-white hover:bg-stone-800"
        >
          Prévisualiser
        </button>
      )}

      {step === 'confirming' && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm text-amber-900">
            <strong>{candidates}</strong> ghost sessions seront archivées.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              className="rounded-md bg-amber-600 px-3 py-1.5 text-sm text-white hover:bg-amber-700"
            >
              Confirmer
            </button>
            <button
              type="button"
              onClick={() => setStep('idle')}
              className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          ✓ {archived} sessions archivées.
        </div>
      )}
    </div>
  );
}
```

## 5. Modification `<ChatAdminNav />`

Pas de changement structurel. Optionnellement on peut ajouter un indicateur visuel quand `CHAT_ADMIN_FILTERS_V2=true` est actif :

```diff
 <nav aria-label="Sections chat" className="mb-4 flex flex-wrap gap-2 text-sm">
   <Link href="/admin/chat/audit" ...>Audit</Link>
   <Link href="/admin/chat/system" ...>Système</Link>
+  {process.env.NEXT_PUBLIC_CHAT_ADMIN_FILTERS_V2 === 'true' && (
+    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
+      Filtres V2 ON
+    </span>
+  )}
 </nav>
```

(Note : `NEXT_PUBLIC_*` requis pour exposition client. Alternative : SSR boolean injecté par layout.)
