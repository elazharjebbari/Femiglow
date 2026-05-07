# 5. En cas de problème

## 1. Mot de passe compromis ou suspect

**Action immédiate** : envoie un message à l'équipe technique
(`tech@femiglow.ma` ou Slack `#ops`) avec le sujet `[URGENT] Rotation
mot de passe admin`. L'équipe :

1. désactive ton compte le temps de la rotation,
2. génère un nouveau hash argon2id,
3. te transmet le nouveau mot de passe via 1Password (jamais email
   simple).

Référence procédure : `docs/admin/specifications/09-environnement/runbook-incident.md` §2.

## 2. Connexion impossible (erreur 429 répétée)

Tu vois `Trop de tentatives, réessayez dans 15 min` alors que tu n'as
saisi le mot de passe qu'une ou deux fois. Cause probable :
quelqu'un d'autre (ou un bot) tente de deviner ton mot de passe.

- Patiente 15 minutes : la limite se réinitialise automatiquement.
- Pendant ce temps, **change ton mot de passe** si tu en as la
  possibilité (cf. §1).
- Vérifie l'audit log : section **Audit** → filtre `admin.login.failed`.

## 3. Secret webhook fuité

Un partenaire t'a signalé qu'il voit le secret en clair quelque part
(email, ticket support, dépôt Git public). Procédure :

1. Va dans **Webhooks** → endpoint concerné → **Rotationner le secret**.
2. L'ancien secret est invalidé immédiatement.
3. Communique le nouveau secret au partenaire via 1Password.
4. Si l'incident vient de FemiGlow (et pas du partenaire), ouvre un
   incident interne (`runbook-incident.md` §4).

## 4. Webhook échoue en boucle (rouge sur la liste)

Un endpoint passe au rouge dans la liste = sa dernière delivery a
échoué (4xx, 5xx, ou timeout) ou est en `permanent` (= 5 tentatives
épuisées).

Étapes :

1. Ouvre l'onglet **Deliveries** de cet endpoint.
2. Regarde la colonne **Code HTTP** et **Erreur** :
   - `401`/`403` → le secret est mauvais côté destinataire. Renvoie le
     secret (rotation si nécessaire).
   - `404` → l'URL n'existe plus. Va dans **Modifier l'endpoint** et
     mets-la à jour.
   - `500`/`502`/`503` → le destinataire a un bug. Préviens-le.
   - `timeout` → le destinataire est trop lent (>10s). Préviens-le.
3. Une fois le problème réglé, clique sur **Rejouer** sur les
   deliveries `permanent` que tu veux re-tenter.

## 5. Ralentissement général de la console

- Vérifie **status.vercel.com** et **neon.tech/status**.
- Si tout est vert : ouvre Sentry projet `femiglow-admin` pour voir s'il
  y a un pic d'erreurs.
- En dernier recours : prévieus l'équipe technique avec une capture
  écran de la page lente et l'heure exacte.

## 6. Page blanche / erreur 500

Rare mais possible. Procédure :

1. Recharge la page (Cmd+R).
2. Si ça persiste, ouvre une nouvelle fenêtre privée → reconnecte-toi.
3. Si ça persiste encore : ouvre un ticket avec une capture et l'URL
   exacte. L'équipe va dans Sentry retrouver la stack trace.

## 7. Suppression accidentelle d'un endpoint

Pas de panique : la suppression est **douce** (`deletedAt` posée).
L'équipe technique peut le restaurer en remettant `deleted_at` à
`null` côté Postgres. Procédure : `runbook-incident.md` §5.

## Coordonnées

- Tech / Ops : `tech@femiglow.ma` / Slack `#ops`
- Sécurité : `security@femiglow.ma`
- DPO : `dpo@femiglow.ma`
