# 16 — Runbook

> *Opérations courantes : ajout provider, debug conversation, hot-reload prompt, incidents*

---

## 1. Pré-requis opérationnels

| Élément                    | Détail                                                                  |
| -------------------------- | ----------------------------------------------------------------------- |
| Accès Vercel               | rôle `developer` minimum sur le projet `femiglow-web`                   |
| Accès Neon                 | rôle `editor` (pour `db:studio` et migrations manuelles)                |
| Variables d'environnement  | `CHAT_PROVIDER_KEY`, `CHAT_TOTAL_BUDGET_EUR_MONTHLY`, providers (le cas échéant) |
| Console admin              | rôle `chat-admin` ou `chat-editor`                                      |
| CLI                        | `pnpm`, `gh`, accès `gcloud`/`vercel` selon hébergement                  |

## 2. Ajout d'un nouveau provider

Cible : 1 jour ouvré. Ticket type : `CHA-XXX`.

### 2.1 Étapes

1. **Créer la classe adapter** dans
   `apps/web/src/lib/chat/providers/<kind>.ts`.
2. **Étendre l'enum Drizzle** `kind` dans `chat_provider_config`.
3. **Migration** :
   ```sh
   pnpm db:generate
   # vérifier le SQL
   pnpm db:push
   ```
4. **Étendre la fabrique** `factory.ts`.
5. **Ajouter les tarifs** dans `tariffs.ts`.
6. **Ajouter les handlers MSW** :
   `apps/web/test/msw/chat/providers/<kind>.handlers.ts`.
7. **Ajouter une story Storybook** du panneau provider admin.
8. **Tester en sandbox** :
   - Aller sur `/admin/chat/providers` → Créer.
   - Coller la clé.
   - Cliquer **Tester** → attendre `pong`.
9. **Activer en preview** (priorité 999, fallback uniquement).
10. **Surveiller 24h** → si OK, monter en priorité 100 et activer
    en prod.

### 2.2 Checklist sécurité

- [ ] Clé chiffrée (jamais en log)
- [ ] `egress_allowed` configuré explicitement
- [ ] Endpoint OK dans CSP `connect-src`
- [ ] Tarif renseigné
- [ ] Quota mensuel défini
- [ ] Tests MSW passent

## 3. Hot-reload d'une instruction

### 3.1 Côté admin

1. Aller sur `/admin/chat/instructions`.
2. **Créer une nouvelle version** (jamais éditer une version active).
3. Comparer avec la version active (diff).
4. Sandbox : cliquer **Tester en sandbox** → mini-chat ; valider le ton.
5. Cliquer **Activer**.

### 3.2 Côté serveur

L'activation déclenche :

```
revalidateTag('chat-config')
chat_instruction_version: enabled = TRUE pour la nouvelle ;
                          enabled = FALSE pour l'ancienne.
chat_session ouverts : reçoivent la nouvelle version au prochain message.
audit log : chat.instruction.activate v=N prev=N-1
```

### 3.3 Rollback

```sql
UPDATE chat_instruction_version SET enabled = TRUE  WHERE id = 'ci_old';
UPDATE chat_instruction_version SET enabled = FALSE WHERE id = 'ci_new';
```

ou bouton `Activer` sur la version précédente. Audit conservé.

## 4. Ingestion d'une nouvelle source

### 4.1 Page admin

1. `/admin/chat/sources` → **Créer**.
2. Choisir type, langue, audience, fraîcheur.
3. Pour `url` : coller l'URL.
4. Pour fichier : déposer (max 5 Mo).
5. Sauvegarder ; cliquer **Re-ingérer** si pas auto.
6. Vérifier le compteur de chunks et le coût (badge en bas).
7. Inspecter les chunks (modal) — vérifier qu'ils ont du sens.

### 4.2 Reindex global

Si l'embedder change ou si trop de drift :

```sh
# en local sur preview seulement, ou via cron
curl -X POST -H 'Authorization: Bearer $ADMIN_TOKEN' \
  https://preview.femiglow.ma/api/admin/chat/maintenance/reindex
```

Suivre le job dans `/admin/chat/sources` (onglet **Jobs**).

## 5. Debug d'une conversation

### 5.1 À partir de l'admin

1. `/admin/chat/conversations` → recherche par mot-clé /
   période / langue.
2. Ouvrir la conversation.
3. Sur chaque réponse de l'agent, cliquer :
   - **Voir les sources RAG** : chunks utilisés.
   - **Voir le prompt reconstruit** : prompt système + contexte
     RAG + historique (PII redactée).
   - **Voir la trace OTel** : ouverture du span dans Vercel /
     backend OTel.

### 5.2 Reproduire localement

```sh
# Récupérer la session
pnpm tsx scripts/chat-replay.ts cs_xxxxxx
# joue la conversation contre le pipeline local (Ollama)
# affiche divergences / régressions
```

## 6. Incident — provider primaire en panne

### 6.1 Détection

Alerte Slack : « OpenAI > 10% errors / 5min ».

### 6.2 Réaction (auto)

Le `circuitBreaker` ouvre après 3 erreurs / 60 s, ferme l'accès
5 min, bascule sur P2.

### 6.3 Vérification humaine

1. `/admin/chat/system` → **Carte providers** : confirmer P1 en
   ⚠ ou ✕, P2 en ✓.
2. `/admin/chat` → KPI latence — doit rester < 2.5 s p95.
3. Si P2 saturé → activer P3 manuellement (priorité 50 → 10).

### 6.4 Communication

- Pas de communication visiteur (la maison « parle toujours »).
- Si latence > 5 s p95 sur > 30 min : message éditorial dans le
  widget « la maison réfléchit plus longtemps que d'habitude. »

## 7. Incident — quota dépassé

### 7.1 Détection

Alerte « quota OpenAI > 90 % ».

### 7.2 Réaction

1. `/admin/chat/providers` → trouver le provider.
2. Trois choix :
   - Augmenter le quota (`quota_monthly_eur`) si budget OK.
   - Basculer vers un provider moins cher (`gemini-1.5-flash` /
     `qwen2.5-7b-instruct`) pour la fin du mois.
   - Activer le mode **dégradé gracieux** (paramètre
     `chat.degraded.enabled = true`) qui répond seulement aux
     visiteurs avec ≥ 1 message dans la session, et message
     courtois aux nouveaux.

## 8. Incident — fuite suspectée

### 8.1 Détection

Soit alerte automatique (`detectLeakage`), soit signal externe.

### 8.2 Réaction immédiate

1. Désactiver le widget (feature flag `chat.enabled = false`).
2. Activer le mode lecture seule sur l'admin (lecture
   conversations OK, modification verrouillée).
3. Auditer les logs des 24 h.
4. Identifier les prompts d'attaque ; ajouter à la suite de tests.
5. Patch :
   - durcir le prompt système ;
   - ajouter le pattern à `detectLeakage` ;
   - relancer la suite de tests sécurité.
6. Re-déployer. Réactiver le widget.
7. Post-mortem dans `docs/chat-assistant/postmortems/<date>.md`.

## 9. Droit à l'oubli

### 9.1 Demande

Reçu par email RGPD ou via le widget (« demande d'effacement »).

### 9.2 Procédure

1. Vérifier l'identité (email + question de contrôle).
2. Trouver la session :
   - par `visitorId` si fourni dans cookie,
   - sinon recherche admin par fenêtre temporelle + caractéristiques.
3. Bouton **Droit à l'oubli** sur la conversation.
4. Le système exécute (cf. `02-data.md §7`) en transaction.
5. Confirmer par email.

SLA : 30 jours, cible 7 jours.

## 10. Rotation des clés providers

Tous les 90 jours.

```sh
# 1. générer une nouvelle CHAT_PROVIDER_KEY (32 bytes base64)
openssl rand -base64 32

# 2. mettre à jour la variable d'environnement Vercel (preview + prod)
vercel env add CHAT_PROVIDER_KEY_NEXT preview production

# 3. lancer le script de rotation
pnpm tsx scripts/chat-rotate-keys.ts --new-env CHAT_PROVIDER_KEY_NEXT

# 4. déplacer NEXT en CURRENT, et redéployer
```

Le script déchiffre les clés avec l'ancienne, rechiffre avec la
nouvelle, met à jour la base. Aucune clé n'est en clair pendant
la procédure.

## 11. Maintenance hebdomadaire

| Tâche                                         | Quand            |
| --------------------------------------------- | ---------------- |
| Revue qualité (5 conversations échantillon)   | lundi            |
| Update tarifs providers si annonce            | au besoin        |
| Vérification quota / budget                   | mardi            |
| Audit dérive éditoriale (10 messages)         | jeudi            |
| Vérification certificats / clés expirées      | mensuel          |
| Reindex global preview                        | mensuel          |
| Test Disaster Recovery                        | trimestriel      |

## 12. Maintenance mensuelle

```sh
# Reindex global (cron déjà programmé, mais lancement manuel possible)
curl -X POST -H 'Authorization: Bearer $ADMIN_TOKEN' \
  https://femiglow.ma/api/admin/chat/maintenance/reindex

# Vérification de la matérialisation KPI
psql "$DB_URL" -c "REFRESH MATERIALIZED VIEW chat_kpi_window;"

# Purge RGPD différée
curl -X POST -H 'Authorization: Bearer $ADMIN_TOKEN' \
  https://femiglow.ma/api/admin/chat/maintenance/purge
```

## 13. Disaster Recovery

| Scénario                          | RTO  | RPO  | Procédure                                                                |
| --------------------------------- | ---- | ---- | ------------------------------------------------------------------------ |
| Vercel down                       | 60 m | 0    | Statut Vercel ; communication via mail liste support (le widget tombe)   |
| Neon down                         | 30 m | 5 m  | Bascule branche read-only ; widget en lecture seule ; restore point      |
| Tous providers cloud KO           | 15 m | 0    | Bascule provider Ollama local (cluster d'infrastructure FemiGlow Phase 2) |
| Compromission DB                  | 4 h  | 24 h | Restore snapshot Neon précédent ; rotation clés ; audit                  |
| Compromission clés providers      | 30 m | 0    | Rotation immédiate ; révocation côté provider ; rotation `CHAT_PROVIDER_KEY` |

Tests trimestriels documentés dans `docs/chat-assistant/dr-tests/`.

## 14. Diagnostic rapide — flowchart

```
Plainte « le chat ne répond plus »
   │
   ├─ DevTools réseau : POST /api/chat/message → 200 ?
   │     ├─ NON → 4xx : voir erreur (auth ? rate-limit ?)
   │     └─    → 5xx : voir logs Vercel + alerte provider
   │
   ├─ DevTools : event 'token' arrive ?
   │     └─ NON → bug streaming : SSE bloqué (proxy / CDN / antivirus)
   │
   ├─ Console JS : erreur React ?
   │     └─ OUI → rollback widget bundle, ouvrir incident
   │
   └─ Si non concluant : enregistrer HAR + console + screencast,
                         créer ticket support
```

## 15. Liste des feature flags

| Flag                              | Effet                                                  |
| --------------------------------- | ------------------------------------------------------ |
| `chat.enabled`                    | Affiche / masque le widget                             |
| `chat.degraded.enabled`           | Mode dégradé gracieux                                  |
| `chat.backstage.publicEnabled`    | Affiche le mode coulisses public                       |
| `chat.experiments.enabled`        | Active les A/B tests (V2)                              |
| `chat.lead.email.enabled`         | Capture email opt-in                                   |
| `chat.attachments.enabled`        | Pièces jointes (V2)                                    |
| `chat.voice.enabled`              | Voix (V3)                                              |

## 16. Contacts

| Rôle                  | Contact                       |
| --------------------- | ----------------------------- |
| DRI                   | elazhar.jebbari@gmail.com    |
| DPO RGPD              | (à désigner)                  |
| Astreinte             | (à organiser)                 |
| Support providers     | account managers OpenAI, Google, etc. |

## 17. Lecture suivante

- [13 — Sécurité, RGPD & modération](13-securite-rgpd-moderation.md)
  pour les détails techniques.
- [14 — Observabilité](14-observabilite-perf.md) pour les sources
  d'alerte.
- [15 — Plan d'action](15-plan-action.md) pour la roadmap.
