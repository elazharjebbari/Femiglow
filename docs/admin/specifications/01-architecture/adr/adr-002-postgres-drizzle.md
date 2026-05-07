# ADR-002 — Postgres managé (Neon) + Drizzle ORM

| Champ | Valeur |
|---|---|
| Statut | Accepté |
| Date | 2026-05-03 |

## Contexte

L'audit (§ 13) confirme l'absence de toute persistance serveur. Tous les
leads sont aujourd'hui perdus (`console.warn` uniquement). La gestion
admin requiert :

- Stockage durable, requêtable (filtres, recherche, agrégations).
- Migrations versionnées.
- Compatible serverless (pas de pool persistant).
- Souverain (UE/RGPD/loi 09-08).
- Backup automatique.

## Décision

- **Provider** : Neon Postgres, région `eu-central-1` (Frankfurt).
- **ORM** : Drizzle (TypeScript first, queries SQL-like, runtime léger).
- **Driver** : `@neondatabase/serverless` (HTTP-based, sans pool).
- **Migrations** : `drizzle-kit generate` → SQL versionnés en repo.

## Conséquences

### Positives

- Postgres = lingua franca SQL.
- Neon free tier suffisant (0.5 GB, 0.25 CU compute) pour ≥ 18 mois.
- Branches preview par PR (testing isolé sans pollution prod).
- Drizzle 100 % typé sur le schéma sans codegen.
- Backups quotidiens automatiques (7 jours rolling).
- Compatible avec d'autres providers (Supabase, RDS, Vercel Postgres) si
  changement futur.
- Extension `pgcrypto` disponible pour chiffrement des secrets webhook.

### Négatives

- Auto-suspend du compute Neon free tier → premier hit après inactivité
  ajoute ~300 ms (cold start). Acceptable pour admin (usage humain).
  Mitigation : plan Launch ($19/mois) supprime l'auto-suspend si
  nécessaire.
- Drizzle plus jeune que Prisma (mais stable depuis 0.30+, et plus
  léger : ~30 kB vs ~600 kB pour Prisma client).

## Alternatives rejetées

| Alternative | Raison |
|---|---|
| **Vercel Postgres** | Wrapper sur Neon — équivalent technique, mais lock-in marketing Vercel |
| **Supabase Postgres** | Auth + storage + edge fonctions inclus, mais on n'utilise pas le reste — surface inutile |
| **Turso (libsql)** | SQLite distribué edge, prometteur mais moins mature pour Server Components et requêtes complexes |
| **Prisma** | Plus lourd, codegen, runtime ~10× plus gros que Drizzle |
| **Kysely** | Bon mais pas de migrations natives ; on devrait re-équiper |
| **Raw SQL (pg)** | Pas de typage automatique sur les résultats |

## Schéma initial

Voir [`../../06-data/schema.sql`](../../06-data/schema.sql).

Tables :
- `leads`
- `lead_events` (audit)
- `webhook_endpoints`
- `webhook_deliveries`
- `admin_sessions_audit`

## Critères d'acceptation

- [ ] `pnpm db:migrate` applique sans erreur sur DB vierge.
- [ ] `pnpm db:studio` ouvre Drizzle Studio.
- [ ] Drift check `drizzle-kit check` passe en CI.
- [ ] Une connexion par requête, pas de pool persistant.
- [ ] Test E2E vérifie qu'un INSERT est bien visible immédiatement
      depuis un autre route handler.
