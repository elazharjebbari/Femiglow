# Page — `/admin/webhooks/new` & `/admin/webhooks/[id]/edit`

| Aspect | Valeur |
|---|---|
| Type | Server Component (page) + Client (form) |
| Auth | requise |
| Layout | admin |
| Breadcrumb | `Webhooks / Nouveau` ou `Webhooks / {nom} / Modifier` |

## Wireframe

Voir [`../../03-ux-navigation/wireframes-textuels.md`](../../03-ux-navigation/wireframes-textuels.md#adminwebhooksnew).

## Mode

| Mode | Page | Endpoint |
|---|---|---|
| Création | `/admin/webhooks/new` | POST `/api/admin/webhooks` |
| Édition | `/admin/webhooks/[id]/edit` | PATCH `/api/admin/webhooks/[id]` |

Le composant `WebhookForm` est partagé entre les deux modes via prop `defaultValues?: WebhookEndpoint`.

## Champs

| Champ | Type | Validation | Aide |
|---|---|---|---|
| Nom | text | 1–80 caractères | "Nom interne (ex: Slack #leads)" |
| URL | url | https obligatoire (sauf localhost en dev) | "URL HTTPS qui recevra les événements" |
| Événements | multi-select | au moins 1 | `lead.created`, `order.created`, `order.paid`, `newsletter.subscribed`, `b2b.requested` |
| Description | textarea | optionnel, ≤ 500 | "À quoi sert ce webhook ?" |
| Headers personnalisés | key-value pairs (max 5) | clé `[A-Za-z0-9-]`, valeur ≤ 200 | "Headers ajoutés à chaque requête" |
| Secret HMAC | text | auto-généré, lecture seule en édition | bouton "Régénérer" en mode édition |
| Actif | switch | bool | "Désactivé : aucune émission" |

## Génération du secret

À la création :

```ts
// côté serveur dans la route handler POST
const secret = crypto.randomBytes(32).toString('base64url');
const encrypted = await encryptSecret(secret); // pgp_sym_encrypt
```

Le secret en clair est **affiché une seule fois** sur la page de
confirmation après création :

> "Voici le secret HMAC. Notez-le : il ne sera plus jamais affiché.
> ```
> wbhk_a1b2c3d4_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
> ```
> Bouton : Copier"

## Régénération

En mode édition, bouton "Régénérer le secret" :

1. Confirmation : "Tous les systèmes consommateurs devront être mis à jour avec le nouveau secret."
2. Au confirm → POST `/api/admin/webhooks/[id]/rotate-secret`.
3. Nouveau secret affiché une seule fois.

## Schéma Zod

```ts
export const webhookEndpointInputSchema = z.object({
  name: z.string().min(1).max(80),
  url: z.string().url().refine(
    (u) => process.env.NODE_ENV === 'development' || u.startsWith('https://'),
    'URL HTTPS requise.'
  ),
  events: z.array(eventTypeEnum).min(1, 'Sélectionnez au moins un événement.'),
  description: z.string().max(500).optional(),
  customHeaders: z.array(
    z.object({
      key: z.string().regex(/^[A-Za-z0-9-]+$/),
      value: z.string().max(200),
    })
  ).max(5).default([]),
  active: z.boolean().default(true),
});
```

## Test de connexion

Bouton "Tester l'endpoint" (en édition uniquement) :

1. POST `/api/admin/webhooks/[id]/test` (pas de body).
2. Backend envoie un payload `webhook.test` synchronement.
3. UI affiche : statut HTTP, latence, body reçu (max 1024 char).

## Comportement de soumission

```tsx
const form = useForm({
  resolver: zodResolver(webhookEndpointInputSchema),
  defaultValues,
});

async function onSubmit(values: WebhookEndpointInput) {
  const res = await fetch(endpoint, {
    method: defaultValues ? 'PATCH' : 'POST',
    body: JSON.stringify(values),
  });
  if (res.status === 409) {
    form.setError('url', { message: 'URL déjà configurée.' });
    return;
  }
  if (!res.ok) {
    toast.error('Erreur lors de l\'enregistrement.');
    return;
  }
  const created = await res.json();
  router.push(
    defaultValues
      ? `/admin/webhooks/${created.id}/deliveries`
      : `/admin/webhooks/${created.id}/secret-display`
  );
}
```

## Tests

| Type | Fichier |
|---|---|
| Unit | `WebhookForm.test.tsx`, `EventTypeMultiSelect.test.tsx`, `CustomHeadersInput.test.tsx` |
| MSW | `scenario-webhook-create.md`, `scenario-webhook-edit.md`, `scenario-webhook-test.md`, `scenario-webhook-rotate.md`, `scenario-webhook-conflict.md` |
| a11y | `jest-axe` |
| E2E | `e2e/webhook-form.spec.ts` |
