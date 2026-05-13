# 11 — Sécurité & RGPD / CNDP

> Consentement, suppression, audit, gestion des secrets, conformité CNDP marocaine (loi 09-08) et bonnes pratiques RGPD. À lire avant le premier opt-in collecté.

## §1 — Cadre légal

| Cadre | Applicabilité | Référence |
|---|---|---|
| **CNDP** (loi 09-08, Maroc) | Obligatoire : FemiGlow opère depuis le Maroc, collecte des données de résidents marocains | https://www.cndp.ma/ |
| **RGPD** (UE) | Applicable dès qu'on cible un résident UE (newsletter, achats) | https://gdpr-info.eu/ |
| **CAN-SPAM** (US) | Si destinataires US | ftc.gov |
| **PECR** (UK) | Si destinataires UK | ico.org.uk |

**Position FemiGlow** : majorité Maroc + UE → respecter CNDP **et** RGPD (le RGPD est en pratique plus strict, donc le respecter couvre la plupart des cas). Déclaration CNDP n° à conserver dans `/admin/emails/settings/legal`.

## §2 — Consentement

### 2.1 — Sources de consentement légitimes

| Source | Type | Stocké |
|---|---|---|
| Formulaire newsletter sur le site | **explicite** (case cochée volontairement) | `email_subscriber_link.consent_source = 'newsletter-form'` + `consent_at` |
| Case opt-in au checkout (« je souhaite recevoir … ») | explicite | `consent_source = 'checkout-optin'` |
| Soumission contact + case opt-in séparée | explicite (case **distincte** du form) | `consent_source = 'contact-optin'` |
| Bouton magique (re-engagement) | explicite (clic = action) | `consent_source = 'magic-link'` |
| Import CSV bulk | **non valide** sans preuve documentée par contact | refusé sauf liste avec consentements horodatés exportés de précédent système |

**Toute case pré-cochée par défaut = consentement non valide** (RGPD art. 7 + CNDP). Implémenter avec checkbox initialement décochée.

### 2.2 — Double opt-in obligatoire pour newsletters

| Flux | Comportement |
|---|---|
| User soumet form newsletter | INSERT `email_subscriber_link(status='pending', consent_at=now, double_optin_confirmed_at=null)` + sendTransactional `newsletter-confirm` |
| User clique lien dans email | `GET /api/admin/emails/subscribers/confirm?token=…` → UPDATE `status='enabled', double_optin_confirmed_at=now()` |
| User ne clique pas dans 7 j | cron purge : `DELETE WHERE status='pending' AND consent_at < now() - 7d` |

Listmonk lists `optin = 'double'` font ça nativement ; on s'aligne et on double-check côté FemiGlow.

### 2.3 — Mentions obligatoires sur le form

```
☐ J'accepte de recevoir les newsletters de FemiGlow.
   Je peux me désabonner à tout moment via le lien en bas de chaque email.
   Voir notre politique de confidentialité ↗
```

Plus, dans la **politique de confidentialité** :
- Finalité du traitement (envoi de mails marketing/newsletters)
- Données collectées (email + prénom optionnel)
- Durée de conservation (cf. §6)
- Droits (accès, rectification, suppression, opposition)
- Coordonnées du responsable (FemiGlow, adresse Maroc)
- Mention CNDP (numéro de déclaration)
- Sous-traitants éventuels : aucun (self-host)

## §3 — List-Unsubscribe (RFC 8058)

### 3.1 — Headers obligatoires

À ajouter **systématiquement** par Stalwart/Listmonk sur tout mail broadcast et toute newsletter transactional :

```
List-Unsubscribe: <https://femiglow-maroc.com/api/mail/unsubscribe?t=abcd1234>, <mailto:unsubscribe@femiglow-maroc.com>
List-Unsubscribe-Post: List-Unsubscribe=One-Click
```

Listmonk les ajoute automatiquement quand `optin = double`. Vérifier dans Settings → Privacy → "Enable List-Unsubscribe one-click".

Pour le transactional via nodemailer, à ajouter dans `lib/mail/send.ts` :

```ts
const unsubToken = await generateUnsubToken(toEmail);
const headers = {
  'List-Unsubscribe': `<https://femiglow-maroc.com/api/mail/unsubscribe?t=${unsubToken}>, <mailto:unsubscribe@femiglow-maroc.com>`,
  'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
};
```

### 3.2 — Endpoint one-click

`apps/web/src/app/api/mail/unsubscribe/route.ts` :

```ts
export async function POST(req: NextRequest) {
  const t = new URL(req.url).searchParams.get('t');
  if (!t) return new Response('Missing token', { status: 400 });
  const email = await verifyUnsubToken(t);  // HMAC, expire 30j
  if (!email) return new Response('Invalid token', { status: 400 });

  await db.transaction(async (tx) => {
    await tx.insert(emailSuppression).values({ email, reason: 'unsubscribe', source: 'manual' }).onConflictDoNothing();
    await tx.update(emailSubscriberLink).set({ status: 'disabled', unsubscribedAt: new Date() }).where(eq(emailSubscriberLink.email, email));
  });
  await listmonk.subscribers.blocklist(email);  // sync vers Listmonk
  return new Response('Unsubscribed', { status: 200 });
}
export const GET = POST;  // certains MUA font GET pour confirmer
```

### 3.3 — Mention dans le footer email

Templates broadcast doivent inclure (dans `_shared/Footer.tsx`) :

```
Tu reçois cet email car tu es inscrit·e à la newsletter FemiGlow.
[Se désabonner] (lien token unique)
```

## §4 — Droit d'accès, rectification, suppression

### 4.1 — Demande d'accès (RGPD art. 15)

Endpoint admin uniquement : `POST /api/admin/emails/dsr/access` (data subject request).
Génère un export JSON contenant :
- toutes les `email_outbox` rows pour cet email
- tous les `email_event` associés
- entrée `email_subscriber_link`
- entrée `email_suppression` si existante
- pour les broadcasts : list memberships Listmonk via API

Export envoyé par mail à l'admin (manuel review) puis transmis à la personne dans les **30 jours** légaux.

### 4.2 — Rectification

Le sujet peut modifier son email/prénom dans son compte FemiGlow (côté user). Si pas de compte → demande manuelle traitée par admin → UPDATE `email_subscriber_link` + Listmonk API.

### 4.3 — Suppression (droit à l'oubli, RGPD art. 17)

```ts
// /api/admin/emails/dsr/erase
async function eraseSubject(email: string, reason: string, by: string) {
  await db.transaction(async (tx) => {
    // Anonymisation, pas DELETE physique (préservation audit)
    await tx.update(emailOutbox)
      .set({ toEmail: 'anonymized', toName: null, payloadJson: {}, htmlSnapshot: null, textSnapshot: null })
      .where(eq(emailOutbox.toEmail, email));
    await tx.delete(emailSubscriberLink).where(eq(emailSubscriberLink.email, email));
    // Suppression list : on garde le hash de l'email pour empêcher la ré-inscription accidentelle
    const hash = sha256(email);
    await tx.insert(emailSuppression).values({ email: `hash:${hash}`, reason: 'cndp_request', source: 'cndp' }).onConflictDoNothing();
  });
  await listmonk.subscribers.blocklist(email);
  await logAuditEvent({ category: 'mail.dsr', action: 'erase', subjectId: email, meta: { reason, by } });
}
```

Délai : sous 30 jours, en pratique sous 7 jours.

### 4.4 — Opposition

Cas d'usage : « stop newsletter mais garder mes infos commande ».
→ UPDATE `email_subscriber_link.status = 'disabled'` + Listmonk blocklist. **Pas** d'anonymisation des outbox (les commandes restent).

## §5 — Suppression list — gouvernance

| Cas | Ajout automatique | Retrait possible ? |
|---|---|---|
| Hard bounce (5xx) | oui (webhook Stalwart) | Manuel admin, **après validation** que l'adresse est de nouveau valide (test send réussi). |
| Soft bounce répété (3 fois sur 7 j) | oui (cron) | Manuel après pause de 14 j |
| Spam complaint (ARF) | oui | Jamais (irréversible) |
| Unsubscribe one-click | oui | User peut se ré-inscrire via formulaire (recommence le double opt-in) |
| Demande CNDP (`cndp_request`) | oui | Jamais (irréversible) |
| Ajout manuel admin | oui | Manuel admin |

UI : `/admin/emails/audiences/suppression` lit `email_suppression` ; chaque ligne avec ses actions (retrait nécessite confirmation modal + log audit).

## §6 — Rétention des données

| Donnée | Rétention | Justification | Suppression |
|---|---|---|---|
| `email_subscriber_link` (active) | tant qu'opt-in actif | nécessaire à l'envoi | révoqué → 30 j puis purge |
| `email_outbox` (delivered) | 365 j | audit | purge cron |
| `email_outbox` (html/text snapshots) | 90 j | audit minimal | purge cron |
| `email_event` | 180 j | analytics + audit | purge cron |
| `email_suppression` | indéfini (preuve consentement révoqué) | obligation | jamais (sauf cas cndp_request → hash) |
| Logs Stalwart | 30 j | troubleshooting | logrotate |
| Logs Listmonk | 7 j | troubleshooting | logrotate |
| Logs FemiGlow application | 7 j journald + 30 j Sentry | dépannage | natif |
| Audit log (`audit_log`) | 5 ans | RGPD obligation | jamais |

Cron `femiglow-cron-email-prune.service` (quotidien) implémente §6.

## §7 — Gestion des secrets

### 7.1 — Inventaire des secrets

| Secret | Stocké dans | Rotation |
|---|---|---|
| `SMTP_PASSWORD` (noreply@) | `apps/web/.env` (chmod 600) | annuel ou si fuite |
| `LISTMONK_API_TOKEN` | `apps/web/.env` | semestriel |
| `LISTMONK_WEBHOOK_SECRET` | `apps/web/.env` | annuel |
| `FEMIGLOW_STALWART_WEBHOOK_SECRET` | `apps/web/.env` | annuel |
| `CRON_SECRET` | `apps/web/.env` | annuel |
| `LISTMONK_ADMIN_PASSWORD` | `/etc/listmonk/config.toml` (640) | annuel (jamais utilisé en pratique) |
| Postgres `listmonk` password | `/etc/listmonk/config.toml` | annuel |
| `unsubToken` HMAC key | `apps/web/.env` | annuel (rotation = invalide les tokens existants → grace period 30 j) |

### 7.2 — Hygiène

- **Aucun secret en clair dans Git**.
- `.env` jamais commité (`.gitignore`).
- Copie chiffrée des `.env` dans S3 (`gpg --symmetric`) versionnée hebdo.
- Listing secrets : `scripts/audit-secrets.sh` (à créer) vérifie permissions, présence, expiration.
- Logs : aucun secret n'est jamais loggé. Audit régulier via grep dans journald.

### 7.3 — Rotation procedure

Pour `LISTMONK_API_TOKEN` :
1. Listmonk admin → Users → `femiglow-app` → regenerate token.
2. Update `apps/web/.env` avec nouveau token.
3. `systemctl restart femiglow.service`.
4. Vérifier en UI emails que tout fonctionne.
5. Ancien token automatiquement invalidé par Listmonk.

## §8 — Anti-abus & rate limiting

| Endpoint | Limite | Raison |
|---|---|---|
| `/api/admin/emails/campaigns/:id/test-send` | 10/min/user | spam interne |
| `/api/admin/emails/subscribers/import` | 1 import/5 min/user | flood protection |
| `/api/listmonk/*` (proxy) | 100/min/user | protection Listmonk upstream |
| `/api/mail/webhook/stalwart` | 600/min/IP | Stalwart bursts, IP confiance |
| `/api/mail/webhook/listmonk` | 300/min/IP | idem |
| `/api/mail/unsubscribe` | 60/min/IP | DoS protection |
| Public `/api/contact`, `/api/newsletter` | déjà en place (cf. existant) | – |

Rate limit shared : Redis (le même que Stalwart) avec namespaces séparés.

## §9 — CSP & headers HTTP

`apps/web/next.config.mjs` (étendre headers existants) :

```js
{
  source: '/admin/emails/listmonk/:path*',
  headers: [
    { key: 'Content-Security-Policy', value: "frame-src 'self'; default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data: https:;" },
    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  ],
},
```

Pour les routes API webhook, **no caching** :
```
Cache-Control: no-store
```

## §10 — Audit log

Cf. `10-observability-debugging.md` §12. Tous les events `mail.*` audités. Lecture via `/admin/audit` filtrable par catégorie. Export CSV pour conformité CNDP sur demande.

## §11 — Procédure en cas de fuite

1. Identifier le périmètre (quels emails exposés).
2. Notifier la CNDP **sous 72 h** (obligation légale art. 28 loi 09-08).
3. Notifier les personnes concernées si "risque élevé" pour leurs droits.
4. Documenter dans le `audit_log` avec catégorie `mail.incident.breach`.
5. Rotation des secrets si compromis suspectés.
6. Post-mortem dans `docs/incidents/`.

## §12 — Conformité Gmail/Outlook 2024+

Critères imposés depuis février 2024 pour expéditeurs > 5k mails/jour :
- ✅ SPF aligné
- ✅ DKIM signé (avec key ≥ 1024 bits — nous avons 2048)
- ✅ DMARC `p=quarantine` minimum (nous avons `p=reject`)
- ✅ `List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click`
- ✅ Spam complaint rate < 0,3 % (mesure Google Postmaster)
- ✅ One-click unsubscribe action ≤ 2 jours

Tous couverts. Vérifier régulièrement Postmaster Tools.

## §13 — Checklist pré-prod

- [ ] Politique de confidentialité mise à jour
- [ ] Case opt-in décochée par défaut sur tous les forms (newsletter, contact, checkout)
- [ ] Lien désabonnement présent dans **tous** les broadcasts (et tests effectués)
- [ ] List-Unsubscribe headers présents dans les outbox
- [ ] CNDP : numéro de déclaration affiché en politique
- [ ] Audit log fonctionnel et accessible
- [ ] Tests RGPD : export d'un sujet, anonymisation, suppression list
- [ ] Secrets rotation calendar créé (calendar admin)
- [ ] Sentry + Slack alerts opérationnelles
- [ ] Postmaster Tools FemiGlow inscrit
- [ ] Backup quotidien Listmonk validé (restore test trimestriel)

## §14 — Références

- CNDP : https://www.cndp.ma/index.php/fr/
- Loi 09-08 : http://www.sgg.gov.ma/Portals/0/lois/loi_09-08_fr.pdf
- RGPD : https://eur-lex.europa.eu/eli/reg/2016/679
- RFC 8058 List-Unsubscribe one-click
- Gmail Sender Guidelines : https://support.google.com/mail/answer/81126
- Outlook Postmaster : https://sendersupport.olc.protection.outlook.com/
