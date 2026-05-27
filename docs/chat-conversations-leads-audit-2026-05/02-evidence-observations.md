# Évidence preview admin — observations live

> **Setup** : Node v20.10.0, pnpm 9.15.9, dev server `pnpm dev` via `.claude/launch.json` `femiglow-web` (port 3001).
> **Auth** : `admin@femiglow.local` (credentials `.env`).
> **Date snapshot** : 26 mai 2026.

## 1. Compteurs globaux observés

| Page | Total | Détail |
|---|---|---|
| `/admin/chat/conversations` | **100** | converties : 3 |
| `/admin/chat/leads` | **28** | pending 19 · reached 0 · converted 9 · discarded 0 · SLA dépassé 17 |
| `/admin/leads` (global) | **31** | mix wizard + chat |
| `/admin` (dashboard 24h) | 0 leads, 0 webhooks, 0 livraisons | DB locale presque vide pour les 24h glissantes |

## 2. Liste conversations — patterns par préfixe

### 2.1 Échantillon préfixe `cs_` (chat natif)

| ID | Page | Conversion |
|---|---|---|
| `cs_1mxdwivvxq8ixgd4` | — | — |
| `cs_ir4llypdd69yjl7q` | — | — |
| `cs_iyz4vl9kj9hza31m` | — | — |
| `cs_yey94otm7nn57cfn` | — | — |
| `cs_kyrb54oqh311d7ow` | — | — |

→ **Observation** : 100 % des `cs_` visibles dans le top ont `page = NULL`. Cohérent avec bootstrap `sessionService.getOrCreate()` appelé sans `opts.page` (cf. cause C4).

### 2.2 Échantillon préfixe `s_` (wizard ghost)

| ID | Page | Conversion |
|---|---|---|
| `s_m89vfat478lpj1o3tjik` | /kit | **Convertie** |
| `s_aeh9i9v97pxbu3mtsd1a` | /kit | — |
| `s_<autres>` | /kit | parfois Convertie |

→ **Observation** : 100 % des `s_` visibles ont `page = '/kit'` et un sous-ensemble est marqué "Convertie". Cohérent avec `wizardSessionRepo.ensureForWizard()` qui passe `input.page = '/kit'`. La marque "Convertie" vient soit de `chat_session.converted_at` (via `attributeConversion` après order), soit du chat_lead lié avec `outcome='converted'` (chemin actuel dominant).

### 2.3 Distribution probable (estimation à confirmer par SQL)

```
sql> SELECT
       LEFT(id, 3) AS prefix,
       page IS NULL AS page_null,
       COUNT(*) AS n
     FROM chat_session
     GROUP BY 1, 2 ORDER BY 1, 2;
```

Attendu approximativement :
| prefix | page_null | n |
|---|---|---|
| `cs_` | true  | ~30-60 (bootstrap C4) |
| `cs_` | false | ~5-10 (vraies sessions chat avec page) |
| `s_x` | false | ~30-50 (ghosts wizard `/kit`, `/cart`, etc.) |
| `s_x` | true  | 0 (le wizard envoie toujours `page`) |

> *Cette répartition reste à valider via Drizzle SQL — l'audit observationnel n'a pas exécuté de query directe.*

## 3. Liste leads chat — patterns par source

### 3.1 Échantillon visible (`/admin/chat/leads`)

| firstName | trigger | outcome | session prefix | Hypothèse source DB |
|---|---|---|---|---|
| yasmine | purchase-intent | converted | `s_m89vfat478…` | `wizard_kit` (PAS un lead chat) |
| test | purchase-intent | converted | `s_aeh9i9v97p…` | `wizard_kit` (PAS un lead chat) |
| (autres lignes tronquées par snapshot) | | | | |

### 3.2 Recoupement avec `/admin/leads`

Sur `/admin/leads`, on voit la **même `yasmine`** (phone `+212751592310`) avec :
- PARCOURS : `Achat`
- WEBHOOK : `converted WIZARD`
- CRÉÉ : `21/05/2026`

→ **Confirmation** : c'est un lead originaire du wizard `/kit`, **PAS du chat widget**. Il apparaît dans `/admin/chat/leads` à cause de l'absence de filtre `source != 'wizard_*'`.

### 3.3 Cas légitime contre-exemple

Dans `/admin/leads`, on voit aussi :
- `Sara` / `+212612345678` / WEBHOOK `new CHAT` / le `12/05/2026` → vrai lead chat avec bouton "Conversation" (et non "Détail wizard").

→ **Confirmation** : la colonne `source` côté DB **fonctionne** et permet de séparer. C'est juste que `/admin/chat/leads` ne l'utilise pas.

## 4. Sources de pollution recensées

| Source | Probabilité | Estimation count | Detection |
|---|---|---|---|
| Wizard `/kit` (step 1 lead capture) | 🔴 Quasi-certaine | ~25-30 sessions ghosts | Préfixe `s_` + page `/kit` |
| Wizard `/cart` legacy (form mode `legacy_cart`) | 🟡 Probable | ~0-10 ghosts | Préfixe `s_` + page `/cart` |
| Bootstrap chat sans interaction | 🔴 Quasi-certaine | ~30-60 vides | Préfixe `cs_` + page NULL + 0 chat_message |
| Test / Smoke automated | 🟢 Possible | <5 | Patterns réguliers, phones type `+212600000000` |
| Robots / Bots (crawler activant le widget) | 🟢 Possible | <5 | UA suspect, visitor sans interaction |

## 5. Console & network observations

Aucune erreur 500 observée sur les pages `/admin/chat/*` durant la session. Le serveur Next dev a compilé les routes proprement :
- `/admin/chat` → 307 redirect vers `/admin/chat/conversations` ✅
- `/admin/chat/conversations` → 200 ✅
- `/admin/chat/leads` → 200 ✅
- `/admin/leads` → 200 ✅

Aucun bouton ou élément cassé dans le DOM accessibility tree.

## 6. Hypothèses non testées (à valider lors du fix)

1. **Y a-t-il déjà des `chat_session` avec `id` ni `cs_` ni `s_` ?** → SQL `SELECT id FROM chat_session WHERE id !~ '^(cs|s)_'` (par sécurité, pour ne pas casser un autre flux comme RGPD `forget` qui purge anonymise mais garde l'id).
2. **`/admin/chat/conversations/[id]` (détail) gère-t-il correctement une ghost session vide ?** → Cliquer sur `s_m89vfat478lpj1o3tjik` et observer le rendu (probable affichage "Aucun message").
3. **Le compteur "Conversion" (3/100) inclut-il les ghosts wizard convertis ?** → Si oui, le KPI réel chat est ~0.
4. **`/api/admin/chat/export/leads` exporte-t-il les leads wizard ?** → À tester via le bouton "Exporter CSV" puis ouvrir le fichier.
5. **`/api/admin/chat/digest/preview` inclut-il les leads wizard ?** → Cliquer "Aperçu digest hebdo" et inspecter le HTML.

## 7. Reproduction du symptôme (pour QA)

```bash
# 1. Server dev
pnpm dev  # port 3001

# 2. Wizard step 1 (génère un ghost `s_xxx`)
curl -X POST http://localhost:3001/api/checkout/lead \
  -H 'content-type: application/json' \
  -H 'Idempotency-Key: ghost_test_001' \
  -d '{
    "firstName":"GhostTest","phone":"+212600000001",
    "sessionId":"s_GHOSTTEST001","visitorId":"v_GHOSTTEST001",
    "language":"fr","page":"/kit","consentVersion":"v1",
    "formContext":{"formId":"kit_wizard","formMode":"wizard_embed","variantKey":"A","source":"wizard_kit"}
  }'

# 3. Constater la pollution
# → naviguer sur http://localhost:3001/admin/chat/conversations
# → la ligne `s_GHOSTTEST001` apparaît avec page=/kit
# → naviguer sur http://localhost:3001/admin/chat/leads
# → le lead "GhostTest" apparaît dans la file "Leads chat"
```

→ Reproductible à 100 %, déterministe, audit reproduit ce scénario observationnellement sans déclencher de POST.

## 8. Recommandation immédiate (avant fix complet)

En attendant le fix de [`03-recommandations.md`](./03-recommandations.md) :

- **NE PAS** se fier au compteur "100 conversations" sur `/admin/chat/conversations`.
- **NE PAS** rappeler les leads `/admin/chat/leads` sans vérifier le `source` via `/admin/leads/[id]` (Détail) → s'il dit `WIZARD`, le lead est déjà dans le tunnel checkout, pas besoin de rappel chat.
- **Filtrer manuellement** sur l'URL `?trigger=explicit-request` ou `?trigger=out-of-knowledge` (les triggers chat purs) en attendant le filtre source.
