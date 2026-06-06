# Intégration Listmonk — fiche d'audit

**Fichiers** : `app/admin/emails/listmonk/[[...path]]/page.tsx`,
`components/admin/emails/ListmonkFrame.tsx`, `app/api/listmonk/[...path]/route.ts`
(proxy), `lib/mail/listmonk/client.ts`, `lib/mail/campaigns/listmonk-status-sync.ts`
**Architecture** : l'admin Listmonk natif vit sur un **sous-domaine dédié**
(`listmonk.femiglow-maroc.com`, vhost LiteSpeed séparé) à cause de la collision
de chemins `/admin/*`. La page in-app l'affiche en iframe sandboxée
(`allow-same-origin allow-scripts allow-forms allow-popups`, PAS de
top-navigation). Fallback proxy same-origin `/api/listmonk/*` **documenté
cassé** (le SPA Listmonk référence des chemins absolus `/admin/*`).

## 1. État actuel — wireframe

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ← Emails · Listmonk · /admin/lists      [Ouvrir dans un nouvel onglet ↗]    │
│ ┌───────────────────────────────────────────────────────────────────────┐   │
│ │                                                                       │   │
│ │              iframe → https://listmonk.femiglow-maroc.com/admin/…    │   │
│ │              (si LISTMONK_PUBLIC_URL est défini)                      │   │
│ │                                                                       │   │
│ └───────────────────────────────────────────────────────────────────────┘   │
│ — sinon —                                                                    │
│ ┌ ⚠ Listmonk n'est pas encore exposé publiquement. ─────────────────────┐   │
│ │ Configure LISTMONK_PUBLIC_URL dans apps/web/.env …                     │   │ ← message dev-only,
│ └─────────────────────────────────────────────────────────────────────────┘   │   bouton ↗ casse (LMK-03)
└─────────────────────────────────────────────────────────────────────────────┘
Proxy /api/listmonk/* : requireAdmin + Basic Auth injectée serveur (jamais
exposée) + X-Forwarded-User (audit) + strip x-frame-options/CSP (LMK-05).
```

## 2. Touchpoints Listmonk dans le reste de l'admin

| Écran | Manifestation | Comportement si Listmonk down |
|---|---|---|
| Wizard campagne ét. 2 | « 📋 Listes Listmonk (legacy) » : checkboxes + compteur d'abonnés | bandeau amber « ⚠ Listmonk : {err} » au chargement RSC seulement ; listes vides → faux hint « Crée-en une » (LMK-04) |
| Wizard campagne ét. 3 | picker de template Listmonk + aperçu sujet | idem |
| Détail campagne | lien `#777 ↗` vers l'admin natif ; métriques par poll ; « Dernière synchro » | échec de poll silencieux (logs serveur uniquement — LMK-01) ; synchro affichée = `finishedAt ?? updatedAt` (LMK-02) |
| Dashboard | — | **aucun check Listmonk dans le HealthBadge** |
| Snapshot audience | `pushSnapshotToListmonk` (liste éphémère, idempotent, resumable) | erreur générique « 0 ajouté » sans détail |

## 3. Modèle de sync (rappel)

- **Statuts campagne** : poll `syncCampaignStatuses()` (cron tick + bouton
  Rafraîchir). Listmonk n'émet pas de webhook `campaign.completed` → sans poll,
  les campagnes restent bloquées en `sending`.
- **Métriques** : sent/views/clicks/bounces tirées du poll ; delivered/unsub
  jamais (d'où les « n/d » — CAMP-02).
- **Résultats du sync** (durée, erreurs par campagne) loggés mais **non
  persistés** (LMK-06).

## 4. Problèmes (cf. matrice)

`LMK-01` panne Listmonk invisible (ni HealthBadge ni badge campagne) ·
`LMK-02` « Dernière synchro » trompeuse · `LMK-03` fallback proxy + bouton
nouvel onglet cassés sans env · `LMK-04` listes vides ≠ Listmonk down ·
`LMK-05` CSP strippée sans resynthèse · `LMK-06` pas d'historique de sync.

## 5. Améliorations proposées (chantier C9) — wireframes cibles

**a) Observabilité de la sync (LMK-01/02/06)**
```
HealthBadge dashboard (nouvelles lignes) :
│ Listmonk : ✓ joignable (87 ms)        — ou —  ✗ injoignable depuis 14:02    │
│ Sync campagnes : ✓ dernier poll 14:31 — ou —  ✗ 3 échecs consécutifs [→]   │

Liste campagnes (badge par ligne si problème) :
│ Été 2026 │ … │ [En cours d'envoi] [⚠ sync en échec] │ …                     │

Détail campagne :
│ Dernière synchro réussie : 06/06 14:31 (poll cron)                          │
│ ⚠ Dernier essai 06/06 14:36 : timeout Listmonk — métriques potentiellement  │
│   périmées. [Réessayer maintenant]                                          │
→ schéma : + lastSyncAttemptAt, lastSyncOkAt, lastSyncError sur
  email_campaign_link (additif).
```

**b) Wizard honnête quand Listmonk est down (LMK-04)**
```
│ 📋 Listes Listmonk (legacy)                                                  │
│ ⚠ Listmonk est indisponible (timeout) — les listes ne peuvent pas être      │
│   chargées. [Réessayer]  Vous pouvez utiliser une audience FemiGlow.        │
   (au lieu de : « Aucune liste Listmonk. Crée-en une dans /listmonk »)
```

**c) Page iframe (LMK-03/05)**
- `LISTMONK_PUBLIC_URL` absent → bouton « nouvel onglet » **désactivé** avec
  tooltip, et message orienté ops (« voir runbook listmonk-subdomain ») au lieu
  de l'instruction .env brute.
- Proxy : remplacer le strip CSP par une resynthèse
  `content-security-policy: frame-ancestors 'self'`.
- Bonus : bandeau au-dessus de l'iframe « Vous éditez dans Listmonk natif — les
  campagnes créées ici ne sont PAS visibles dans /campaigns » (le piège classique).

**d) Échec de push de snapshot explicite** : remonter le détail (n tentés,
n rejetés, premier message d'erreur) dans l'alerte du wizard au lieu du
générique « 0 a/ont pu être ajouté(s) ».
