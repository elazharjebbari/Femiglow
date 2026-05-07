# Rotation des secrets

## Calendrier

| Secret | Fréquence | Trigger | Délai impact |
|---|---|---|---|
| `ADMIN_SESSION_PASSWORD` | annuelle | calendrier ou incident | déconnexion immédiate de toutes les sessions |
| `WEBHOOK_SECRET_KEY` | annuelle | calendrier ou incident | re-chiffrement requis (script) |
| `CRON_SECRET` | annuelle | calendrier ou incident | 1 tick raté max (60s) |
| Mot de passe admin | annuelle ou incident | calendrier | rotation manuelle |
| Secret HMAC d'un endpoint | sur demande | UI bouton ou incident | consommateur doit mettre à jour |
| `DATABASE_URL` | sur incident | suspicion fuite | redéploiement requis |

## Procédure générale

```
1. Générer nouveau secret (cryptographiquement fort)
2. Mettre à jour Vercel env (production)
3. Si pertinent : migrer données existantes
4. Redéployer (force) pour propager
5. Vérifier fonctionnement
6. Logger l'événement dans audit_events
7. Documenter dans operations/rotations.md
```

## ADMIN_SESSION_PASSWORD

```bash
# 1. Générer
NEW=$(openssl rand -base64 32)

# 2. Mettre à jour Vercel
vercel env rm ADMIN_SESSION_PASSWORD production
echo "$NEW" | vercel env add ADMIN_SESSION_PASSWORD production

# 3. Redéployer
vercel deploy --prod --force

# 4. Vérifier
curl -I https://femiglow.ma/admin/login   # 200
```

**Effet** : tous les cookies de session existants deviennent invalides.
Toutes les utilisatrices sont redirigées vers `/admin/login`.

Notifier la fondatrice avant rotation (pas en pleine session active).

## WEBHOOK_SECRET_KEY

C'est la clé qui chiffre les secrets HMAC stockés en DB. La rotation
demande un re-chiffrement complet.

```bash
# 1. Générer nouvelle clé
NEW=$(openssl rand -base64 32)

# 2. Mettre à jour env temporairement avec ancien et nouveau
vercel env add WEBHOOK_SECRET_KEY_NEW production "$NEW"

# 3. Lancer le script de re-chiffrement
pnpm tsx scripts/rotate-webhook-secret-key.ts
# Le script lit chaque webhook_endpoint.encrypted_secret,
# le déchiffre avec l'ancien WEBHOOK_SECRET_KEY,
# le re-chiffre avec WEBHOOK_SECRET_KEY_NEW,
# et l'écrit en DB.

# 4. Promouvoir la nouvelle clé
vercel env rm WEBHOOK_SECRET_KEY production
vercel env rename WEBHOOK_SECRET_KEY_NEW WEBHOOK_SECRET_KEY production

# 5. Supprimer la clé temporaire
# (rien à faire, elle a été renommée)

# 6. Redéployer
vercel deploy --prod --force
```

`scripts/rotate-webhook-secret-key.ts` :

```ts
import { db } from '@/lib/db/client';
import { webhookEndpoints } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

const oldKey = process.env.WEBHOOK_SECRET_KEY!;
const newKey = process.env.WEBHOOK_SECRET_KEY_NEW!;

const rows = await db.select().from(webhookEndpoints);
for (const row of rows) {
  const [{ plain }] = await db.execute<{ plain: string }>(
    sql`SELECT pgp_sym_decrypt(${row.encryptedSecret}::bytea, ${oldKey}) AS plain`,
  );
  const [{ encrypted }] = await db.execute<{ encrypted: Buffer }>(
    sql`SELECT pgp_sym_encrypt(${plain}, ${newKey}, 'cipher-algo=aes256') AS encrypted`,
  );
  await db.update(webhookEndpoints)
    .set({ encryptedSecret: encrypted })
    .where(eq(webhookEndpoints.id, row.id));
}
```

## CRON_SECRET

```bash
NEW=$(openssl rand -base64 32)
vercel env rm CRON_SECRET production
echo "$NEW" | vercel env add CRON_SECRET production
vercel deploy --prod --force
```

**Effet** : 1 tick max manqué (Vercel met à jour le bearer côté ses workers).

## Mot de passe admin

Voir [`../07-securite/incident-response.md#rotation-du-mot-de-passe-admin`](../07-securite/incident-response.md#rotation-du-mot-de-passe-admin).

## Secret HMAC d'un endpoint webhook

Via UI :
1. `/admin/webhooks/[id]/edit` → bouton "Régénérer le secret".
2. Confirmation modale.
3. POST `/api/admin/webhooks/[id]/rotate-secret` → renvoie le nouveau secret en clair.
4. **Affichage une seule fois** — copier dans le système consommateur.
5. Le consommateur met à jour sa configuration et reprend les requêtes.

## DATABASE_URL

```bash
# 1. Tourner le password Neon (dashboard)
# 2. Récupérer la nouvelle URL
# 3. Mettre à jour Vercel
vercel env rm DATABASE_URL production
vercel env rm DIRECT_DATABASE_URL production
echo "$NEW_URL" | vercel env add DATABASE_URL production
echo "$NEW_DIRECT_URL" | vercel env add DIRECT_DATABASE_URL production

# 4. Redéployer
vercel deploy --prod --force
```

Pendant la fenêtre de redéploiement (~30s), les nouvelles requêtes
utilisent la nouvelle URL. Connexions actives sont fermées par Neon.

## Calendrier annuel

| Mois | Actions de rotation |
|---|---|
| Janvier | `ADMIN_SESSION_PASSWORD` |
| Février | (rien) |
| Mars | (rien) |
| Avril | mot de passe admin |
| Mai | (rien) |
| Juin | (rien) |
| Juillet | `WEBHOOK_SECRET_KEY` |
| Août | (rien) |
| Septembre | (rien) |
| Octobre | `CRON_SECRET` |
| Novembre | (rien) |
| Décembre | revue annuelle de tous les secrets |

Étalé pour éviter le choc opérationnel d'une rotation simultanée.

## Audit

Chaque rotation laisse une trace :

```sql
INSERT INTO audit_events (id, action, meta) VALUES (
  cuid2(),
  'system.secret_rotated',
  '{"secret": "ADMIN_SESSION_PASSWORD", "performed_by": "fondatrice@femiglow.ma"}'
);
```

## Tests

| Type | Vérification |
|---|---|
| Procédure | exécuter une rotation en preview avant production |
| Smoke après rotation | login admin → 200, cron tick → 200 |
| Documentation | confirmer entrée dans `operations/rotations.md` |
