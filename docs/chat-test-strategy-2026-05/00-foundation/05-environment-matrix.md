# Matrice d'environnements

Configurations testées **dans la batterie**, avec leur priorité et fréquence.

## 1. Navigateurs (Playwright)

| Navigateur | Version Playwright | Project name | Fréquence | Cas couverts |
|------------|---------------------|--------------|-----------|--------------|
| Chromium (Chrome 120+) | bundled | `chromium-desktop` | Chaque PR | Tous |
| Firefox (115+) | bundled | `firefox-desktop` | Main + release | Tous |
| WebKit (Safari 17+) | bundled | `webkit-desktop` | Main + release | Tous |
| Chromium iPhone 13 | mobile emulation | `chromium-mobile` | Chaque PR | F02, F11, F08 |
| Chromium RTL AR-MA | locale=ar-MA | `chromium-rtl-ar` | Chaque PR | F13, F53, BS03 |

**Pas testé** : IE 11 (déprécié), Opera, Brave (basés Chromium).

## 2. Devices émulés (responsive)

| Preset | Viewport | DPR | Cas couverts |
|--------|----------|-----|--------------|
| iPhone 13 | 390×844 | 3 | Mobile portrait — F02, F08, F11 |
| iPhone 13 landscape | 844×390 | 3 | Mobile paysage ad-hoc |
| iPad | 1024×768 | 2 | Tablette F01, F38 |
| Desktop standard | 1280×800 | 1 | Default desktop |
| Desktop large | 1920×1080 | 1 | F42, F44 (dashboards) |

## 3. Locales

| Locale | Code | RTL | Fréquence | Cas couverts |
|--------|------|-----|-----------|--------------|
| Français (Maroc) | `fr-MA` | LTR | Chaque PR | Default — tous F |
| Arabe classique | `ar` | RTL | Main + release | F13, F53 |
| Darija (Arabic Morocco) | `ar-MA` | RTL | Main + release | F03, F13, F53, BS03 |

**Note** : la détection darija vs arabe classique se fait via heuristique mots-clés
(`khoubz`, `wakha`, `khoya`) dans `apps/web/src/lib/chat/lang/detect.ts`.

## 4. Réseaux simulés

Pour tests Playwright avec `page.route` + throttling :

| Profil | Latency | Download | Upload | Cas couverts |
|--------|---------|----------|--------|--------------|
| Fast 4G | 50 ms | 4 Mbps | 3 Mbps | Default |
| Slow 3G | 400 ms | 500 Kbps | 500 Kbps | F08 (streaming), F11 (lead form) |
| Offline (intermittent) | — | — | — | F08 (abort handling) |
| API timeout simulé | — | API → 30 s | — | F31 (breaker), F35 (budget) |

## 5. États système simulés

Pour tests de résilience (cf. ADR-004 niveau 0–4) :

| État | Trigger MSW / mock | Cas couverts |
|------|---------------------|--------------|
| **Nominal** | tous handlers OK | Tous (default) |
| **Provider primary down** | MSW retourne 503 sur OpenAI | F31, BS04 |
| **All providers down** | MSW retourne 503 sur tous | F31, BS04, BS09 |
| **DB indisponible** | DB mock throw | F17, F31 |
| **Redis indisponible** | Mock Redis client throw | F31, F35 |
| **Budget exceeded** | `assertBudget` mock throw | F35, BS09 |
| **Rate limit hit** | `rateLimit.consume` retourne false | F36 |
| **Moderation flag** | OpenAI Moderation API retourne flagged | F27, BS04 |

## 6. Données simulées

| Profil | Génération | Cas couverts |
|--------|-----------|--------------|
| Visiteur anonyme nouveau | factory `chatSessionFactory` | Default |
| Visiteur récurrent | session existante + `chatMessageFactory` ×5 | F12, F38 |
| Visiteur avec lead | session + `chatLeadFactory` | F11, F40 |
| Conversation longue | session + 50 messages | F30 (memory window) |
| Admin authentifié | NextAuth session + role `admin` | F37–F52 |
| Admin lecture seule | session + role `support` | F40 (assertion permission) |

## 7. Versions Node / pnpm / runtimes

| Composant | Version pinnée | Fichier de référence |
|-----------|----------------|----------------------|
| Node | 22.x (LTS) | `.nvmrc` (à créer) |
| pnpm | 9.15.x | `package.json` `packageManager` |
| Next.js | 14.2.x | `apps/web/package.json` |
| Playwright | 1.46+ | `apps/web/package.json` |
| postgres pgvector | 16 (pgvector/pgvector:pg16) | `testcontainers` config |

**Politique upgrades** : minor/patch automatique via Renovate, **major manuel** avec
test suite verte sur fork avant merge.

## 8. CI runners

| Runner | OS | Cores | RAM | Cas couverts |
|--------|-----|-------|-----|--------------|
| `ubuntu-latest` (GitHub Actions) | Ubuntu 22.04 | 4 | 16 GB | Unit + Int + Comp + E2E smoke |
| `ubuntu-latest` (large) | Ubuntu 22.04 | 8 | 32 GB | E2E full + Visual |
| `macos-latest` | macOS 14 | 3 | 7 GB | Smoke macOS (Safari/WebKit) |

## 9. Variables d'environnement test

Définies dans `.env.test` (gitignore) ou via CI secrets :

```bash
# Database
DATABASE_URL=postgresql://test:test@localhost:5432/femiglow_test
REDIS_URL=redis://localhost:6379/15  # DB 15 réservée tests

# LLM providers (stubs)
OPENAI_API_KEY=test-key-openai
ANTHROPIC_API_KEY=test-key-anthropic

# Webhook destinations (stubs)
LEAD_WEBHOOK_URL=http://localhost:3001/test/webhook-sink
SLACK_WEBHOOK_URL=http://localhost:3001/test/slack-sink

# Feature flags
CHAT_ENABLED=true
MODERATION_ENABLED=true
CHAT_INTENT_USE_LLM_FALLBACK=false  # ADR-001 N3 — flag absent du code actuellement

# Test mode hints
NODE_ENV=test
NEXT_PUBLIC_TEST_MODE=true
E2E_BASE_URL=http://localhost:3001
```

## 10. Matrice combinée — quel test sur quel env ?

| Test type | Browsers | Devices | Locales | Networks | États | DB |
|-----------|----------|---------|---------|----------|-------|-----|
| Unit | — | — | — | — | — | mock |
| Integration | — | — | `fr-MA` | — | nominal + dégradé | testcontainers |
| Component | jsdom | — | `fr-MA` + `ar-MA` (P0) | — | nominal + erreur | mock |
| E2E smoke | chromium | desktop | `fr-MA` | fast 4G | nominal | seeded |
| E2E full | chromium + firefox + webkit | desktop + mobile + tablet | `fr-MA` + `ar-MA` | fast 4G + slow 3G | tous | seeded |
| E2E critique | chromium | desktop | `fr-MA` | fast 4G | nominal + 1 dégradé | seeded |
| Visual | chromium | desktop + mobile | `fr-MA` + `ar-MA` | fast 4G | nominal | seeded |
| A11y | chromium | desktop | `fr-MA` | fast 4G | nominal | seeded |
| Load (k6) | — | — | `fr-MA` | nominal | nominal | prod-like |

## 11. Plan d'expansion (futur)

À considérer plus tard :

- **Edge browsers** (Edge, Brave) — si support business demandé
- **Android natif** (Android emulator + Playwright) — si app mobile native
- **Locales additionnelles** (en, es) — si expansion internationale
- **Network anomalies avancées** (packet loss, jitter) — via toxiproxy
- **Cross-region** (test depuis Asie, Europe) — pour valider CDN
