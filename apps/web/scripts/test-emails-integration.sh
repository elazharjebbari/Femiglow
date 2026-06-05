#!/usr/bin/env bash
# Batterie intégration emailing — suites VRAIE DB (harnais femiglow_test*).
#
# Règle d'inclusion (au lieu d'une liste explicite qui dérive à chaque vague) :
#   - tout `*.integration.test.ts` du repo SAUF les suites pglite autonomes
#     (analytics/leads-outbox) et social-publishing (hors périmètre emailing) ;
#   - les `*.db.test.ts` des dossiers emails (dashboard KPI, events).
#
# Sérialisé (--no-file-parallelism) : les suites partagent la même DB et un
# TRUNCATE concurrent provoque des deadlocks 40P01 (R-023).
# Env : .env.test → DATABASE_URL femiglow_test (garde-fou dans emails-db.ts ;
# sans URL femiglow_test, describeEmailsDb skippe honnêtement).
set -euo pipefail
cd "$(dirname "$0")/.."

mapfile -t files < <(
  {
    find src -name '*.integration.test.ts' \
      ! -name '*pglite*' \
      ! -path '*social-publishing*'
    find src -path '*emails*' -name '*.db.test.ts'
  } | sort -u
)

echo "test:emails:integration — ${#files[@]} suites (sérialisées)"
exec node --env-file=.env.test ./node_modules/vitest/vitest.mjs run \
  --no-file-parallelism "${files[@]}"
