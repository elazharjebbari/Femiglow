# Routes map

## Routes admin (Next.js App Router)

| Path | RSC ou Client | Phase | Description |
|---|---|---|---|
| `/admin/emails` | RSC | existant | Dashboard |
| `/admin/emails/transactional` | RSC + client | M5.1 ⭐ refonte | Cockpit transactional |
| `/admin/emails/transactional/[id]` | RSC | existant + polish | Detail email |
| `/admin/emails/audiences` | RSC | M5.3 ⭐ | List |
| `/admin/emails/audiences/new` | RSC | M5.3 ⭐ | Wizard create |
| `/admin/emails/audiences/[id]` | RSC | M5.3 ⭐ | Detail (snapshots list) |
| `/admin/emails/audiences/[id]/edit` | RSC | M5.3 ⭐ | Edit |
| `/admin/emails/audiences/snapshots/[id]` | RSC | M5.3 ⭐ | Snapshot members |
| `/admin/emails/campaigns` | RSC | existant | List |
| `/admin/emails/campaigns/new` | RSC + client | M5.4 ⭐ refonte step 2 | Wizard create |
| `/admin/emails/campaigns/[id]` | RSC | existant + audience link | Detail |
| `/admin/emails/campaigns/[id]/edit` | RSC + client | existant + M5.4 | Wizard edit |
| `/admin/emails/automation` | RSC | existant + polish | List |
| `/admin/emails/automation/new` | RSC + client | M5.5 ⭐ | Wizard create |
| `/admin/emails/automation/[id]/edit` | RSC + client | M5.5 ⭐ | Wizard edit |
| `/admin/emails/automation/runs/[id]` | RSC | M5.5 ⭐ | Run detail timeline |
| `/admin/emails/listmonk[/...path]` | RSC | existant | Iframe |

## URL state conventions

### Transactional cockpit
```
/admin/emails/transactional?view=failed-today
/admin/emails/transactional?status=failed&template=cart-*&after=2026-05-01
```
Précédence : `view` > filtres explicites (la view préset les filtres,
les filtres explicites remplacent).

### Audiences
```
/admin/emails/audiences?owner=me&sort=size_desc
/admin/emails/audiences/new?from=audience-id  (clone)
```

### Automations
```
/admin/emails/automation?status=active
/admin/emails/automation/new?template=cart-abandoned  (preset)
```

## Auth & redirects

- Toute route `/admin/emails/*` exige `requireAdmin()` (déjà en place
  via middleware)
- Pas de role-based access ; tous les admins voient tout
