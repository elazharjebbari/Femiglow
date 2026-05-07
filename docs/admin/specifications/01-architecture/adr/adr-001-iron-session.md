# ADR-001 — Authentification par iron-session + Argon2id

| Champ | Valeur |
|---|---|
| Statut | Accepté |
| Date | 2026-05-03 |
| Décideurs | Tech lead, fondatrice |
| Supersede | — |
| Superseded by | — |

## Contexte

L'admin FemiGlow a un et un seul utilisateur (la fondatrice). Aucune
table d'utilisateurs n'est requise. Néanmoins :

- La session doit être **inviolable** (cookie chiffré, pas seulement signé).
- Le mot de passe doit être stocké **hashé** (jamais en clair).
- L'authentification ne doit pas introduire de service externe.
- Le coût récurrent doit être nul.
- La rotation du secret doit être possible sans réauthentifier
  prématurément les sessions actives.

Trois options ont été comparées dans
[`../../02-faisabilite-authentification.md`](../../../02-faisabilite-authentification.md) :
NextAuth, Clerk, iron-session.

## Décision

Adopter **iron-session** + **@node-rs/argon2** :

- Stockage credentials : `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` en env vars
  Vercel.
- Algorithme : Argon2id avec paramètres OWASP 2024.
- Cookie : `fg_admin_session`, AES-256-GCM via iron-session, durée
  rolling 7 jours.
- Vérification : middleware `apps/web/src/middleware.ts` matchant
  `/admin/(?!login)` et `/api/admin/(?!login|cron)`.
- Rate limit : 5 tentatives / 10 min / IP, en mémoire process.

## Conséquences

### Positives

- Aucun service tiers, aucune DB nécessaire pour l'auth.
- Coût récurrent : 0 €.
- Rotation du `IRON_SESSION_PASSWORD` supportée nativement (multi-secret).
- Surface d'attaque minimale : 1 cookie, 1 vérification, 1 hash.
- Code source < 200 lignes.
- Cohérent avec la philosophie "stack unique" (invariant I-02).

### Négatives

- Pas de "forgot password" UI : changement = nouveau hash via CLI.
- Pas de SSO (acceptable pour 1 utilisateur).
- Rate limit en mémoire = dégradé serverless (chaque instance a son propre
  compteur). Mitigation : 5 tentatives par instance × N instances ≈ 25
  tentatives effectives. Acceptable.
- Pas de table `admin_users` versionnée (ajoutée en v2 si multi-user).

## Alternatives rejetées

### NextAuth.js (Auth.js v5)

- Sur-équipée pour 1 utilisateur sans table users.
- Configuration plus complexe (providers, callbacks, adapters).
- Documentation v5 encore en mouvement (2026).

### Clerk

- Vendor US (Inc.) → DPA supplémentaire, données PII chez tiers.
- Coût : free tier limité à 10 000 MAU, payant ensuite.
- Lock-in fort (UI, sessions, hooks Clerk-spécifiques).
- UI hors marque (composants Clerk avec leur propre design).

## Critères d'acceptation

- [ ] Le cookie `fg_admin_session` est chiffré (test : `openssl` ne
      révèle pas le contenu).
- [ ] Argon2id avec `memoryCost ≥ 19456 KiB` (vérification sur le hash
      produit).
- [ ] Login échoue avec délai constant (timing-safe) que l'email existe
      ou non.
- [ ] Rate limit déclenche 429 après 5 tentatives.
- [ ] Rotation du `IRON_SESSION_PASSWORD` n'invalide pas les sessions
      actives si l'ancien secret reste dans le tableau.

## Références

- OWASP Password Storage Cheat Sheet 2024
- iron-session 8.x docs (vvo/iron-session)
- @node-rs/argon2 README
- Audit FemiGlow [`../../../01-audit-application.md`](../../../01-audit-application.md)
- Étude de faisabilité [`../../../02-faisabilite-authentification.md`](../../../02-faisabilite-authentification.md)
