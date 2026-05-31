# Dashboards

## 1. `/admin/chat/audit` — dashboard interne

**Section "Pollution chat_session"** (créée en T3) :

```
┌─────────────────────────────────────────────────────────────────┐
│ Santé pollution chat                       Snapshot: il y a 5 min│
│                                                                  │
│  Sessions par kind         Leads par source                     │
│  ┌──────────────────┐     ┌─────────────────────┐              │
│  │ chat          124│     │ chat_widget     45  │              │
│  │ wizard_pivot   38│     │ inline           7  │              │
│  │ system          0│     │ wizard_kit      26  │              │
│  └──────────────────┘     │ wizard_commander 4  │              │
│                            │ newsletter       0  │              │
│                            │ admin            1  │              │
│                            └─────────────────────┘              │
│                                                                  │
│  Pollution rate         12% (wizard_pivot / total) ✅ OK         │
│  Vrais leads chat       52 / 83 (62%) ✅ OK                     │
│  Ghosts orphelins > 30j  3                                       │
│                                                                  │
│  [Cleanup ghosts orphelins] (3 candidates)                      │
└─────────────────────────────────────────────────────────────────┘
```

Données fournies par `GET /api/admin/chat/audit-pollution`.

Refresh : on-demand (visite admin). Si besoin de temps réel, ajouter polling 30s.

## 2. Vercel logs filtrés

### Logs `chat.session.create`

```bash
vercel logs --follow | grep '"event":"chat.session.create"'
```

**Exemple ligne** :
```json
{
  "level": "info",
  "event": "chat.session.create",
  "sessionId": "cs_xxx",
  "kind": "chat",
  "visitorId": "v_xxx",
  "page": "/kit",
  "ts": "2026-05-26T10:30:00Z"
}
```

**Ratio attendu** :
- ~60-80% `kind: 'chat'` (visites chat)
- ~20-40% `kind: 'wizard_pivot'` (wizards remplis)

Si ratio s'inverse (>50% wizard) : suspect (bot, attaque).

### Logs `chat.admin.cleanup_ghosts`

```bash
vercel logs --follow | grep '"event":"chat.admin.cleanup_ghosts"'
```

**Exemple** :
```json
{
  "level": "info",
  "event": "chat.admin.cleanup_ghosts",
  "candidates": 42,
  "archived": 42,
  "dryRun": false,
  "by": "admin@femiglow.local",
  "ts": "2026-05-26T11:00:00Z"
}
```

Fréquence attendue : 0-1 fois par mois (cleanup occasionnel manuel).

## 3. Sentry dashboard

### Project: `femiglow-prod`

Filtres recommandés :
- Tag `release:chat-leads-v2`
- Search `chat.session` OR `chat_session.kind`
- Time : 24h / 7d / 30d

**Issues à surveiller** :

1. **Erreur SSR `/admin/chat/conversations`** — devrait être 0
2. **Erreur INSERT chat_session** — devrait être 0
3. **Erreur cleanup endpoint** — devrait être 0
4. **Erreur Drizzle "kind enum"** — devrait être 0

### Custom rate query (Sentry Discover)

```
event.type:error
url:*/admin/chat/*
```

Cible : 0 error/h.

## 4. Plausible custom events

### Events à émettre (code à ajouter)

```ts
// Quand admin visite la page conversations
plausible('admin_chat_conversations_view', {
  props: {
    debug: searchParams.debug ?? 'normal',
    rows: rows.length,
  },
});

// Quand admin visite la page leads
plausible('admin_chat_leads_view', {
  props: {
    sources: includeWizard ? 'all' : 'chat_only',
    rows: rows.length,
  },
});

// Quand admin clique cleanup
plausible('admin_chat_cleanup_executed', {
  props: { archived: result.archived },
});
```

### Custom dashboard "Chat Admin Health"

Créer dans Plausible une vue avec :
1. **Bar chart** : events `admin_chat_conversations_view` par jour (7 derniers jours)
2. **Filter** : breakdown par prop `debug` (normal vs ghosts)
3. **Bar chart** : events `admin_chat_leads_view` par jour
4. **Counter** : total events `admin_chat_cleanup_executed` (30 jours)

## 5. `/admin/live-health` — section chat purity (extension)

Si le projet a déjà un dashboard live-health (cf. sprint `live-systems-fix-2026-05`), y ajouter une carte :

```tsx
<section aria-label="Santé chat purity">
  <h2>Chat Purity</h2>
  <KpiCard
    label="Pollution rate"
    value={pollutionPct}
    sufix="%"
    accent={pollutionPct > 30 ? 'rose' : 'emerald'}
  />
  <KpiCard
    label="Cleanup candidates > 30j"
    value={cleanupCandidates}
    accent={cleanupCandidates > 100 ? 'rose' : 'stone'}
  />
  <KpiCard
    label="True chat conversions (30j)"
    value={trueChatConversions}
    accent="emerald"
  />
</section>
```

Données via `/api/admin/chat/audit-pollution`.

## 6. Vercel Analytics

Page `/admin/chat/*` :
- Pageviews
- Avg duration on page
- Bounce rate
- Latency P50/P95

Si latency P95 > 1s après le fix : investigate index.

## 7. Custom CLI dashboard (optionnel)

Script utile pour debug rapide en CLI :

**Fichier nouveau** : `apps/web/scripts/chat-purity-status.ts`

```ts
/**
 * Affiche le statut chat purity en CLI.
 *
 * Usage : pnpm tsx scripts/chat-purity-status.ts [--url <url>]
 */
import './_load-env.mjs';

async function main() {
  const url = process.argv.includes('--url')
    ? process.argv[process.argv.indexOf('--url') + 1]
    : 'http://localhost:3001';
  
  const res = await fetch(`${url}/api/admin/chat/audit-pollution`, {
    headers: { cookie: process.env.ADMIN_COOKIE ?? '' },
  });
  if (!res.ok) {
    console.error('❌ Failed:', res.status);
    process.exit(1);
  }
  const data = await res.json();
  
  console.log(`\n🔍 Chat purity status — ${url}\n`);
  console.log('Sessions by kind:');
  for (const row of data.distributions.session_kind) {
    console.log(`  ${row.kind.padEnd(15)} ${String(row.n).padStart(6)}`);
  }
  console.log('\nLeads by source:');
  for (const row of data.distributions.lead_source) {
    console.log(`  ${row.source.padEnd(20)} ${String(row.n).padStart(6)}`);
  }
  
  const total = data.distributions.session_kind.reduce((s, r) => s + r.n, 0);
  const wizard = data.distributions.session_kind.find((r) => r.kind === 'wizard_pivot')?.n ?? 0;
  const pollutionPct = total > 0 ? ((wizard / total) * 100).toFixed(1) : '0';
  console.log(`\nPollution rate: ${pollutionPct}%`);
}

main().catch(console.error);
```

Usage :
```bash
ADMIN_COOKIE='session=...' pnpm tsx scripts/chat-purity-status.ts --url https://femiglow-maroc.com
```

## 8. Captures écran post-deploy

Sauvegarder des captures pour archivage :

```bash
mkdir -p docs/chat-conversations-leads-fix-2026-05/screenshots/
# Manuellement via macOS Cmd+Shift+4 :
# - prod-conversations-after.png
# - prod-leads-after.png
# - prod-audit-after.png
```

Utile pour démonstration ex-post ou support.
