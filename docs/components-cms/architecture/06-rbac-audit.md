# A6 — Permissions et audit

## Modèle de permissions

### v1 : binaire

> Tout admin authentifié peut **lire**, **éditer**, **publier**,
> **programmer**, **restaurer** n'importe quel champ de n'importe
> quel composant. Pas de granularité par champ ni par composant.

Justification :

- L'équipe est de **2 personnes** (fondatrice + dev).
- Aucun rôle « rédacteur sans publication » n'est utile à cette taille.
- La complexité d'un RBAC fin coûte plus cher qu'un audit complet.

### Authentification

Existante. Cf. `docs/admin/02-faisabilite-authentification.md`. Le
middleware admin pose `req.adminUser` sur les routes
`/api/admin/components/**` et redirige les pages `/admin/*` vers
`/admin/login` si non authentifié.

### Autorisation

Une seule règle :

```ts
function canManageComponentFields(user: AdminUser): boolean {
  return user.status === 'active';   // pas suspendu, pas désactivé
}
```

Tout endpoint d'écriture appelle ce check au début. Refus → `403`.

## Audit log

Toute écriture est tracée dans **deux endroits** :

1. **`component_field_history`** (cf. A2) — snapshot de la valeur, du
   statut, et de l'auteur, par version.
2. **`adminAuditLog`** (existant) — événement structuré pour le
   tableau de bord ops.

### Événements émis

| Action | Événement adminAuditLog | history.action |
|---|---|---|
| Première édition d'un champ | `field.draft.create` | `create` |
| Edition d'un draft existant | `field.draft.update` | `update` |
| Publication | `field.publish` | `publish` |
| Programmation | `field.schedule` | `schedule` |
| Annulation programmation | `field.unschedule` | `unschedule` |
| Promotion auto (cron) | `field.publish.cron` | `publish` (actorId=null, source='cron') |
| Restauration | `field.restore` | `restore` |
| Archivage automatique | `field.archive.cascade` | `archive` |

### Schéma adminAuditLog (existant, étendu)

```ts
interface AdminAuditLogEntry {
  id: string;
  actorId: string | null;       // null si cron
  actorEmail: string | null;
  action: string;               // 'field.publish'
  resourceType: string;         // 'componentField'
  resourceId: string;           // 'home-hero/title'
  meta: Record<string, unknown>; // { fromVersion: 3, toVersion: 4, locale: 'fr' }
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}
```

### Rétention

`adminAuditLog` : 365 jours (politique existante).
`componentFieldHistory` : 90 jours (cf. A4).

Pourquoi deux durées : l'audit log est obligation légale (RGPD, traçabilité),
l'history est outil produit (rollback). Les besoins divergent.

## Vue admin de l'audit

Page `/admin/audit?resource=componentField`. Permet :

- filtrer par actor, action, composant, période,
- exporter en CSV pour archivage,
- cliquer sur une ligne pour voir le diff (depuis l'history).

## Garde-fous serveur

| Règle | Implémentation |
|---|---|
| Pas de modif sans auth | middleware admin |
| Pas de modif si user inactif | check explicite |
| Pas de fabrication d'`actorId` | toujours `req.adminUser.id`, jamais payload |
| Pas de rétro-datage | `createdAt`, `publishedAt` setés serveur |
| `If-Match: <updatedAt>` | obligatoire sur PATCH (concurrent edits) |
| Rate-limit | 60 req/min par utilisateur sur `/api/admin/components/**` |
| Validation Zod | toute payload, sinon 400 |
| Sanitization rich-text | DOMPurify côté serveur, allowlist stricte |

## Considérations sécurité supplémentaires

### XSS via rich-text

Le seul champ pouvant injecter du HTML est `rich-text`. Sanitization
en deux temps :

1. à l'écriture (PATCH) : `sanitize-html` côté serveur ; rejeter si
   le résultat diffère substantiellement de l'entrée (signal de tentative).
2. à la lecture (RSC) : re-sanitize au moment du rendu (défense en
   profondeur).

Allowlist : `h2, h3, p, ul, ol, li, strong, em, a, blockquote, br`.
Pas d'`img`, `script`, `iframe`, `style`.

### Open redirect via `cta.href` / `link.href`

Validation Zod stricte :

```ts
const hrefSchema = z.string().refine((href) => {
  if (href.startsWith('/')) return true;
  if (href.startsWith('mailto:') || href.startsWith('tel:')) return true;
  try {
    const url = new URL(href);
    return url.protocol === 'https:' && ALLOWED_HOSTS.includes(url.host);
  } catch {
    return false;
  }
}, 'href must be relative or HTTPS to allowlisted host');
```

`ALLOWED_HOSTS` listé dans le config site (ex : `instagram.com`,
`youtube.com`). Pas de wildcard.

### Path traversal sur `iconKey`

Whitelist via le registre d'icônes (`lucide` ou `femiglow-curated`).
Validation Zod par `z.enum([...REGISTERED_ICONS])`. Pas d'input libre.

### CSRF

Cookie session `SameSite=Lax`, header `X-Requested-With` requis sur
PATCH/POST (mécanisme existant). Pas de Server Actions, donc pas de
RSC actions à se soucier.

### Injection JSON

`value` est jsonb. Postgres rejette automatiquement le JSON malformé.
Validation Zod garantit que la structure correspond au type du champ
**avant** d'atteindre la DB.

## Audit en lecture

Lire un binding **n'est pas** auditée individuellement (volume trop
gros, le rendu public lit ~30 fois par seconde). Mais la **liste des
champs en cours d'édition** par admin l'est : événement
`field.session.start` quand l'admin ouvre `/admin/components/[key]`,
`field.session.end` à la fermeture. Permet de détecter une session
abandonnée pour fournir une alerte « X édite ce composant depuis 30 min ».

## Tests sécurité

| Scénario | Test |
|---|---|
| PATCH sans auth | E2E Playwright + unit handler |
| PATCH avec user inactif | unit handler |
| Tentative XSS dans rich-text | unit (sanitization) |
| Open redirect via cta.href | unit (Zod) |
| Path traversal iconKey | unit (Zod) |
| Race condition concurrent edit | unit + RTL (mock 409) |
| CSRF sans header | unit |
| Rate-limit dépassé | unit (mock store) |

Cf. T2 et T5.

## Ce qu'on ne fait PAS en v1

- ❌ Permissions par-champ (« seul l'admin X peut éditer le hero »)
- ❌ Approbation 4-yeux (« 2 admins valident une publication »)
- ❌ Lock pessimiste (« un autre admin édite, vous ne pouvez pas »)
- ❌ Isolation par environnement (preview/staging/prod)
- ❌ Webhooks externes (Slack, email) sur publication

Tout cela est documenté en évolutions possibles (cf. `action-plan/03-risks.md`).
