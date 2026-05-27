# Stratégie de rollback

## Niveaux

| Niveau | Trigger | Effet | Durée |
|---|---|---|---|
| **N1 — Flag off** | Bug filtre admin ou rendu cassé | Comportement legacy restauré | 8 min |
| **N2 — Templates revert** | Juriste rejette anonymisation post-deploy | Restore les 4 pages depuis history | 30 min |
| **N3 — Migration rollback** | DB schéma compromis | Reverse rename + DELETE vars ajoutées | 1h |
| **N4 — Restore backup** | Perte data critique | Restore snapshot Neon | 2h |

---

## N1 — Flag off (cas le plus probable)

```bash
# Désactiver flag
vercel env rm LEGAL_VARS_V2 production
vercel env add LEGAL_VARS_V2 production
# Saisir : false

# Re-deploy
vercel deploy --prod

# Smoke après
pnpm tsx scripts/smoke-legal-purity.ts --url https://femiglow-maroc.com
# Doit toujours retourner OK (comportement legacy fonctionne)
```

**Durée** : ~8 min (5 min config + 3 min deploy)

**Effet** :
- `isLegalVarsV2Enabled() = false`
- `presetVarsForPage` n'est PAS utilisé → VERSION redevient `[VERSION]` (fallback)
- Les nouveaux noms de vars (`CONTACT_EMAIL` etc.) ne sont pas reconnus par publish workflow
- Suggestion UI cachée
- Données DB restent (colonne et vars existent)

**Retour en arrière** : `LEGAL_VARS_V2=true` → comportement V2 restauré.

---

## N2 — Templates revert (cas juridique)

Si juriste rejette les nouveaux templates post-deploy :

```sql
-- Pour chaque page modifiée, restaurer la version précédente depuis history
INSERT INTO legal_pages_history (id, page_id, slug, version, title, body_md, ...)
  SELECT 'lph_revert_' || gen_random_uuid(),
         p.id, p.slug, p.version + 1, h.title, h.body_md, ...
  FROM legal_pages p
  JOIN legal_pages_history h ON h.page_id = p.id
  WHERE p.slug IN ('mentions-legales', 'cgv', 'confidentialite', 'retours-remboursements')
    AND h.version = p.version - 1;  -- version précédente

UPDATE legal_pages
   SET body_md = (SELECT body_md FROM legal_pages_history WHERE page_id = legal_pages.id AND version = legal_pages.version - 1),
       version = version + 1,
       updated_at = NOW()
 WHERE slug IN ('mentions-legales', 'cgv', 'confidentialite', 'retours-remboursements');
```

**Durée** : ~30 min (SQL + smoke validation)

**Effet** : les 4 pages retrouvent leur contenu d'avant refonte.

---

## N3 — Migration rollback (cas extrême)

⚠️ **Faire UNIQUEMENT après N1 (flag off)** sinon le code Drizzle qui référence les nouveaux noms casse.

```sql
-- Reverse rename
UPDATE legal_template_vars SET key = 'COMPANY_EMAIL' WHERE key = 'CONTACT_EMAIL';
UPDATE legal_template_vars SET key = 'COMPANY_PHONE' WHERE key = 'CONTACT_PHONE';
UPDATE legal_template_vars SET key = 'HOSTING_ADDRESS' WHERE key = 'HOST_ADDRESS';
UPDATE legal_template_vars SET key = 'HOSTING_NAME' WHERE key = 'HOST_NAME';
UPDATE legal_template_vars SET key = 'HOSTING_PHONE' WHERE key = 'HOST_CONTACT';
UPDATE legal_template_vars SET key = 'CNDP_DECLARATION' WHERE key = 'CNDP_DECLARATION_REF';

-- Supprimer les vars ajoutées
DELETE FROM legal_template_vars
 WHERE key IN ('COOLING_OFF_DAYS','CURRENCY','DATA_RETENTION_YEARS','DELIVERY_PARTNER','PAYMENT_PROVIDERS','SUPPORT_HOURS');

-- Restaurer is_required pour les vars marquées en false
UPDATE legal_template_vars
   SET is_required = true
 WHERE key IN ('COMPANY_PATENTE', 'COMPANY_TVA', 'DPO_EMAIL');
```

**Durée** : ~1h (SQL + tests + redeploy si nécessaire)

---

## N4 — Restore backup DB (dernière ressource)

Cf. procédure Neon :

```bash
# Créer une branche restauration
neon branches create --parent main --name rescue-legal-$(date +%s) \
  --timestamp 2026-05-27T08:00:00Z

# Vérifier les données sur la branche rescue
psql $RESCUE_URL -c "SELECT COUNT(*) FROM legal_pages;"

# Si OK, promouvoir (avec DBA)
# ...
```

**Durée** : ~2h

⚠️ Action de dernier recours — toutes les écritures depuis le snapshot sont perdues.

---

## Décision tree

```
Incident détecté
       │
       ▼
   Quel symptôme ?
       │
       ├─ /legal/*  affiche [VERSION] ou [CONTACT_EMAIL]
       │   ▼
       │   → Flag est OFF mais devrait être ON
       │   → Activer flag (10 min)
       │
       ├─ Erreur 500 sur /legal/*
       │   ▼
       │   → N1 Flag off + investigate
       │
       ├─ Juriste rejette wording anonymisation
       │   ▼
       │   → N2 Templates revert
       │
       ├─ Erreur INSERT chat_session (cross-feature !)
       │   ▼
       │   → Vérifier que c'est pas lié à CHA-LEAD-V2 (sprint précédent)
       │
       └─ Migration cassée
            ▼
            → N3 Reverse migration (flag off d'abord)
```

---

## Communications pendant rollback

### Slack `#deploys`

```
[ROLLBACK] LEGAL-V2 — Niveau N{1-4}

Symptôme : <ce qu'on observe>
Action : <ce qu'on fait>
Owner : <qui pilote>
ETA : <durée estimée>
Status : in_progress | resolved
```

### Email fondatrice

```
Bonjour <nom>,

Suite à un incident détecté sur le module Pages légales, nous avons
rollback le fix temporairement.

Impact :
- /legal/* affiche peut-être [VERSION] ou des placeholders bruts
- /admin/legal/template-vars : pas de bouton "+ Nouvelle variable"

Aucune donnée perdue.

Le fix sera relancé après investigation (ETA J+X).

Cordialement,
<Lead>
```

---

## Post-mortem

Si rollback exécuté, planifier RCA dans 48h :

- [ ] Réunion 30 min Dev + Lead + DevOps
- [ ] Document RCA dans `docs/incidents/<date>-legal-v2-rollback.md`
- [ ] Cause racine identifiée
- [ ] Plan de prévention (test additionnel ? code review plus stricte ?)
- [ ] Décision : re-essayer ou abandon

---

## Checklist rollback

- [ ] Décision documentée (qui, quand, pourquoi)
- [ ] Flag désactivé en prod
- [ ] Smoke confirme legacy
- [ ] Slack notifié
- [ ] Fondatrice notifiée
- [ ] Tickets ouverts (Sentry, RCA)
- [ ] Sprint clos "rollback"
- [ ] Docs mises à jour
