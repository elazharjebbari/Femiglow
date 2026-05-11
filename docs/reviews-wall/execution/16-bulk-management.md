# 16 — Gestion bulk : sélection multiple et actions de masse

Le système bulk concerne **toutes les listes admin** du composant : queue de modération, témoignages publiés, archivés, preview d'import. Il permet à Souheila d'agir efficacement sur de grands volumes sans cliquer 50 fois.

## 1. Surfaces concernées

| Surface | Actions bulk disponibles |
| --- | --- |
| `/admin/rituals/queue` | Approuver, Rejeter, Masquer |
| `/admin/rituals/published` | Mettre en avant, Retirer la mise en avant, Masquer |
| `/admin/rituals/archived` | Restaurer, Supprimer (RGPD, admin only) |
| `/admin/rituals/import/[batchId]` (étape 4 preview) | Inclure, Exclure, Appliquer un défaut, Régénérer vision ML, Supprimer rows |

Cette spécification définit un **système bulk générique** réutilisable sur toutes ces surfaces.

## 2. Modèle d'interaction

### 2.1 Sélection

Trois mécanismes simultanés :

1. **Sélection individuelle** : checkbox par row.
2. **Sélection de la page** : checkbox dans le header de table.
3. **Sélection globale** : bouton « Tout sélectionner sur tous les résultats filtrés » (apparaît après sélection page).

État `mixed` (indeterminate) sur la checkbox header si sélection partielle.

### 2.2 Limites

| Limite | Valeur |
| --- | --- |
| Sélection max simultanée | 500 rows |
| Bulk action sur > 500 rows | Confirmation supplémentaire « Vous êtes sur le point de modifier 1 234 rows. Continuer ? » |
| Bulk action > 1000 rows | Refus avec message « Veuillez splitter en lots plus petits » |

### 2.3 Persistance

Sélection persistée **côté client uniquement** (state React), pas dans l'URL ni dans le serveur. Changer de filtre / trier / paginer **réinitialise** la sélection (avec confirmation si > 5 items sélectionnés).

## 3. UI de la barre bulk

### 3.1 Barre sticky

Apparaît dès la première sélection. Disparaît si désélection totale.

```
┌────────────────────────────────────────────────────────────────────┐
│ ☑ 12 rituels sélectionnés                       [Désélectionner]   │
│                                                                     │
│ [Approuver] [Rejeter ▾] [Masquer ▾] [Mettre en avant]              │
│                                                                     │
│ Tout sélectionner sur les 87 résultats →                            │
└────────────────────────────────────────────────────────────────────┘
```

- Sticky top sous le tabs admin.
- Fond crème pure, bordure 1,5 px sauge-pale en bas, padding 12 × 24 px.
- Compteur Inter Medium 13 pt encre.
- Boutons d'action Inter Medium 13 pt, fond encre, texte crème, hauteur 36 px, padding 8 × 16 px.
- Bouton secondaire `Désélectionner` lien texte droite.
- Mention `Tout sélectionner sur les N résultats` en italique sauge-dark, lien.

### 3.2 Apparition / disparition

| Action | Animation |
| --- | --- |
| Apparition | `translateY -100% → 0, opacity 0 → 1`, 200 ms `out-soft` |
| Disparition | Reverse, 150 ms `in-quiet` |

Si `prefers-reduced-motion`, fade seulement 80 ms.

### 3.3 Différencier action critique

Actions **destructives** (Rejeter, Supprimer) sont en style secondaire avec bordure encre. Actions normales (Approuver, Restaurer, Inclure) en style primaire fond encre.

## 4. Modales de confirmation par action

### 4.1 Pattern de modale

```
┌────────────────────────────────────────────────────────┐
│  Action sur 12 rituels                                  │
│                                                         │
│  [Action spécifique : Approuver / Rejeter / Masquer]    │
│                                                         │
│  ─────────                                              │
│                                                         │
│  ⓘ 3 rituels ont des auto-flags critiques :             │
│     ─ row-12 : visage détecté                          │
│     ─ row-18 : visage détecté                          │
│     ─ row-23 : mot interdit                            │
│                                                         │
│  Voulez-vous :                                          │
│  ⦿ Appliquer l'action sur les 12 quand même            │
│  ○ Appliquer uniquement aux 9 sans flag                │
│  ○ Examiner les 3 en flag individuellement              │
│                                                         │
│  Raison interne (optionnelle)                           │
│  ┌────────────────────────────────────────────┐        │
│  │                                              │        │
│  └────────────────────────────────────────────┘        │
│                                                         │
│  ─────────                                              │
│                                                         │
│  [Annuler]              [Confirmer l'action]            │
└────────────────────────────────────────────────────────┘
```

### 4.2 Bulk Approuver

```
Action : approuver 12 rituels en attente

✓ Tous les rituels sélectionnés vont passer en status APPROVED.
✓ Les e-mails d'approbation seront envoyés aux auteures dont l'e-mail est connu.

⚠ Vérifiez avant d'agir :
─ 0 rituels avec auto-flag critique
─ 0 rituels avec photo en MANUAL_REVIEW

[Confirmer l'approbation]
```

**Sécurité** : si au moins 1 row a un flag critique (`face_detected`, `forbidden_word`), proposer l'option « Examiner individuellement » et désabiliser « Tout approuver » par défaut.

### 4.3 Bulk Rejeter

```
Action : rejeter 8 rituels

Vous êtes sur le point de rejeter 8 témoignages.

Raison interne (mémoire admin)
┌────────────────────────────────────────────────────┐
│                                                     │
└────────────────────────────────────────────────────┘

Template de message à l'auteure (par défaut)
[rituals-rejected-other.md ▾]

Personnaliser le message
┌────────────────────────────────────────────────────┐
│ {{template content}}                                 │
└────────────────────────────────────────────────────┘

☐ Envoyer le message à toutes les auteures dont l'e-mail est connu

[Confirmer le rejet]
```

### 4.4 Bulk Masquer

```
Action : masquer 5 rituels publiés

Les rituels ne seront plus visibles côté public.
Ils ne sont pas supprimés (audit conservé).

Raison interne (obligatoire)
┌────────────────────────────────────────────────────┐
│                                                     │
└────────────────────────────────────────────────────┘

[Confirmer le masquage]
```

### 4.5 Bulk Mettre en avant

```
Action : mettre en avant 4 rituels

⚠ La limite featured est de 3 simultanés.

Vous avez actuellement 2 featured. Vous tentez d'en ajouter 4.

Choix :
⦿ Promouvoir les 3 premiers de la sélection (1 ignoré)
○ Promouvoir tout, remplacer les 2 featured existants
○ Annuler

[Confirmer]
```

### 4.6 Bulk Supprimer (RGPD, admin only)

```
⚠ ATTENTION — Action irréversible

Vous êtes sur le point de SUPPRIMER 3 rituels.

Cette action :
─ Supprime les rituels et leurs photos
─ Supprime les rows d'audit log liées
─ Conserve une trace de suppression dans app_audit_events

Saisir « SUPPRIMER 3 RITUELS » pour confirmer :
┌────────────────────────────────────────────────────┐
│                                                     │
└────────────────────────────────────────────────────┘

[Annuler]                          [Supprimer définitivement]
```

Tapage explicite obligatoire (à la HashiCorp / GitHub destructive UX).

## 5. Backend bulk

### 5.1 Endpoint générique

```
POST /api/admin/rituals/bulk-action
Content-Type: application/json

{
  "action": "approve" | "reject" | "hide" | "restore" | "feature" | "unfeature" | "delete_rgpd",
  "ids": ["uuid1", "uuid2", ...]       // sélection explicite
       OR
  "filter": { "status": "PENDING", "auto_flags": null }  // sélection par filtre (sélection globale)
  ,
  "options": {
    "note": "...",
    "emailTemplate": "rituals-rejected-other",
    "emailBody": "...",
    "sendEmails": true,
    "skipFlagged": false
  }
}

200 OK
{
  "data": {
    "totalProcessed": 12,
    "totalSucceeded": 11,
    "totalSkipped": 1,
    "totalFailed": 0,
    "skipped": [{ "id": "...", "reason": "auto_flag_critical" }],
    "errors": []
  }
}
```

### 5.2 Implémentation

```ts
// lib/rituals/bulk.ts
export async function bulkAction(input: BulkActionInput, ctx: { actorId: string }) {
  const ids = input.ids ?? await resolveFilterToIds(input.filter);

  if (ids.length > 1000) throw new BadRequestError('Bulk action limit exceeded');

  // Vérifie RBAC
  if (!canRitualAction(ctx.role, input.action)) {
    throw new ForbiddenError();
  }

  const results = { totalProcessed: ids.length, totalSucceeded: 0, totalSkipped: 0, totalFailed: 0, skipped: [], errors: [] };

  // Transaction par lot de 50
  for (const chunk of chunks(ids, 50)) {
    await db.transaction(async (tx) => {
      for (const id of chunk) {
        try {
          const ritual = await tx.select().from(ritualTestimonials).where(eq(ritualTestimonials.id, id)).limit(1);
          if (!ritual[0]) {
            results.errors.push({ id, reason: 'not_found' });
            continue;
          }

          // Skip si flag critique et option activée
          if (input.options?.skipFlagged && hasCriticalFlag(ritual[0])) {
            results.skipped.push({ id, reason: 'auto_flag_critical' });
            results.totalSkipped++;
            continue;
          }

          await applyAction(tx, ritual[0], input.action, input.options, ctx.actorId);
          results.totalSucceeded++;
        } catch (e) {
          results.errors.push({ id, reason: e.message });
          results.totalFailed++;
        }
      }
    });
  }

  // Trigger async (email + refresh aggregate)
  if (input.options?.sendEmails) {
    queueBulkEmails(results.succeeded, input.action, input.options);
  }

  // Audit global
  await insertAuditEvent(null, ctx.actorId, `bulk_${input.action}`, null, {
    ids,
    results,
  });

  return results;
}
```

### 5.3 RBAC

Étend `can-rituals.ts` :

```ts
export function canRitualBulkAction(role: string, action: RitualBulkAction, count: number): boolean {
  if (!canRitualAction(role, action)) return false;
  // Suppression RGPD : admin only quel que soit le count
  if (action === 'delete_rgpd' && role !== 'admin') return false;
  // Au-delà de 100 : admin only pour les actions destructives
  if (count > 100 && ['reject', 'hide', 'delete_rgpd'].includes(action) && role !== 'admin') return false;
  return true;
}
```

## 6. Audit

Chaque bulk action insère :

1. Un **audit événement par ritual** affecté dans `ritual_audit_log`, action = `approved`, `rejected`, etc. payload includes `bulk_batch_id`.
2. **Un audit global** dans `app_audit_events` (ou table dédiée `bulk_action_log`) capturant :

```json
{
  "id": "bulk-uuid",
  "actor_id": "admin-uuid",
  "action": "bulk_approve",
  "total_processed": 12,
  "total_succeeded": 12,
  "ids": ["...", "...", ...],
  "options": { "sendEmails": true },
  "created_at": "..."
}
```

Permet de retracer un bulk si problème détecté ensuite.

## 7. Performance bulk

| Métrique | Cible | Stratégie |
| --- | --- | --- |
| 50 rituals approve | < 1 sec | Transaction unique |
| 500 rituals approve | < 8 sec | 10 chunks de 50 |
| Bulk email envoi | Async, batch de 20 par minute | Queue interne pour éviter rate-limit SMTP |
| Refresh aggregate après bulk | Déclenché 1 fois en fin de bulk, pas par ritual | Évite N refresh inutiles |
| UI feedback | Toast non bloquant + lien vers résultat | Pas de page bloquée |

## 8. UX feedback

### 8.1 Pendant l'action

```
[Action en cours…  12 / 50 traités]
```

Barre de progression discrète en haut de page (sous le tabs).

### 8.2 Après l'action

```
✓ Action réussie

12 rituels approuvés
0 rituels échoués

[Voir le détail]    [Continuer]
```

Notification persistante en bas de page jusqu'à clic. Pas un toast qui disparaît trop vite.

### 8.3 En cas d'erreur partielle

```
⚠ Action partiellement réussie

10 rituels approuvés
2 rituels en erreur :
─ id-xyz : Already approved
─ id-abc : Photo not found

[Voir le rapport complet]
```

Modal qui détaille chaque erreur. L'admin peut télécharger le rapport en CSV.

## 9. Cas particulier : bulk sur preview d'import

Dans l'étape 4 du wizard d'import, les bulk actions ne touchent **pas** les `ritual_testimonials` mais les `ritual_import_rows` (en preview, pas encore commit).

### 9.1 Actions spécifiques preview

| Action | Effet |
| --- | --- |
| Inclure | `is_included = true` |
| Exclure | `is_included = false` |
| Appliquer un défaut | Sur le champ choisi, applique une valeur pour les rows où le champ est vide |
| Régénérer vision ML | Pour les rows avec photos, relance le job |
| Supprimer rows | Supprime des rows (avant commit, non destructif sur la BDD finale) |

### 9.2 Endpoint preview bulk

```
POST /api/admin/rituals/import/[batchId]/bulk-rows
{
  "action": "include" | "exclude" | "apply_default" | "regenerate_face_check" | "delete",
  "rowIds": [...] OR "filter": { validationStatus: "ERROR" },
  "payload": { "field": "productKey", "value": "pack-femiglow" }
}
```

## 10. UX raccourcis clavier

| Raccourci | Action |
| --- | --- |
| `Ctrl/Cmd + A` | Tout sélectionner sur la page |
| `Shift + Click` | Sélection par range (de la dernière cochée à celle cliquée) |
| `Escape` | Désélectionner tout |
| `A` | Bulk approve (si sélection > 0) |
| `R` | Bulk reject (avec modale) |
| `H` | Bulk hide |

Raccourcis activés uniquement quand la sélection est non vide et qu'aucun input n'a le focus.

Affichés dans une tooltip `?` en haut de la barre bulk.

## 11. Accessibilité bulk

| Élément | Pratique a11y |
| --- | --- |
| Checkbox row | `<input type="checkbox" aria-label="Sélectionner ce rituel">` |
| Checkbox header | `<input type="checkbox" aria-label="Tout sélectionner" aria-checked="mixed">` |
| Compteur sélection | `aria-live="polite"` annonce les changements de sélection |
| Bouton bulk action | `<button>` avec `aria-disabled` si conditions non remplies |
| Modal confirmation | `role="dialog"` + focus trap + ESC |
| Raccourcis clavier | Documentés dans une tooltip accessible |

## 12. Tests bulk

### 12.1 Vitest

```ts
describe('bulkAction', () => {
  it('approuve 50 rituals en transaction unique', async () => {
    const ids = await seedRituals(50, { status: 'PENDING' });
    const result = await bulkAction({ action: 'approve', ids }, { actorId: 'admin-1', role: 'admin' });
    expect(result.totalSucceeded).toBe(50);
    expect(result.totalFailed).toBe(0);
  });

  it('skip rituals avec flag critique si option activée', async () => {
    const idsOk = await seedRituals(5, { status: 'PENDING' });
    const idsFlagged = await seedRituals(3, { status: 'PENDING', autoFlags: ['face_detected'] });
    const result = await bulkAction({
      action: 'approve',
      ids: [...idsOk, ...idsFlagged],
      options: { skipFlagged: true }
    }, { actorId: 'admin-1', role: 'admin' });
    expect(result.totalSucceeded).toBe(5);
    expect(result.totalSkipped).toBe(3);
  });

  it('refuse bulk > 1000', async () => {
    const ids = Array(1001).fill('').map(() => crypto.randomUUID());
    await expect(bulkAction({ action: 'approve', ids }, ctx)).rejects.toThrow(/limit exceeded/);
  });

  it('moderator ne peut pas bulk delete_rgpd', async () => {
    const ids = await seedRituals(2);
    await expect(bulkAction({ action: 'delete_rgpd', ids }, { actorId: 'mod-1', role: 'moderator' })).rejects.toThrow(/Forbidden/);
  });

  it('audit log écrit pour chaque ritual + un global', async () => {
    const ids = await seedRituals(3, { status: 'PENDING' });
    await bulkAction({ action: 'approve', ids }, ctx);
    const logs = await db.select().from(ritualAuditLog).where(inArray(ritualAuditLog.testimonialId, ids));
    expect(logs).toHaveLength(3);
    const bulkLog = await db.select().from(appAuditEvents).where(eq(appAuditEvents.action, 'bulk_approve'));
    expect(bulkLog).toHaveLength(1);
  });

  it('email envoyé une fois par auteur après approbation', async () => {
    // ...
  });
});
```

### 12.2 MSW

Handlers pour `/api/admin/rituals/bulk-action` :

```ts
http.post('/api/admin/rituals/bulk-action', async ({ request }) => {
  const { ids, action } = await request.json();
  return HttpResponse.json({
    data: {
      totalProcessed: ids.length,
      totalSucceeded: ids.length,
      totalFailed: 0,
      skipped: [],
      errors: [],
    },
  });
});
```

### 12.3 Playwright

```ts
test('bulk approve 5 rituals depuis la queue', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/rituals/queue');
  // Sélectionner 5 cards
  for (let i = 0; i < 5; i++) {
    await page.click(`[data-testid="ritual-row-${i}"] input[type="checkbox"]`);
  }
  await expect(page.getByText('5 rituels sélectionnés')).toBeVisible();
  await page.click('button:has-text("Approuver")');
  await page.click('button:has-text("Confirmer l\'approbation")');
  await expect(page.getByText(/5 rituels approuvés/)).toBeVisible();
});

test('bulk reject avec template e-mail', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/rituals/queue');
  await page.click('[data-testid="row-0"] input[type="checkbox"]');
  await page.click('[data-testid="row-1"] input[type="checkbox"]');
  await page.click('button:has-text("Rejeter")');
  await page.fill('textarea[name="internalNote"]', 'Doublons identifiés');
  await page.click('button:has-text("Confirmer le rejet")');
  await expect(page.getByText(/2 rituels rejetés/)).toBeVisible();
});

test('bulk delete RGPD avec tapage', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/rituals/archived');
  await page.click('[data-testid="row-0"] input[type="checkbox"]');
  await page.click('button:has-text("Supprimer")');
  await expect(page.getByText(/Saisir/)).toBeVisible();
  await page.fill('input[name="confirmType"]', 'SUPPRIMER 1 RITUEL');
  await page.click('button:has-text("Supprimer définitivement")');
  await expect(page.getByText(/1 rituel supprimé/)).toBeVisible();
});
```

## 13. Composants UI bulk réutilisables

| Composant | Localisation |
| --- | --- |
| `BulkSelectionContext` | `apps/web/src/lib/admin/bulk/BulkSelectionContext.tsx` |
| `useBulkSelection` | hook custom |
| `BulkActionBar` | `apps/web/src/components/admin/bulk/BulkActionBar.tsx` |
| `BulkActionModal` | `.../BulkActionModal.tsx` |
| `BulkSelectionCheckbox` | `.../BulkSelectionCheckbox.tsx` (row + header) |
| `BulkActionDestructiveModal` | `.../BulkActionDestructiveModal.tsx` (tapage explicite) |

Architecture découplée : le composant `BulkActionBar` reçoit en props la liste des actions disponibles. Réutilisable hors rituals si besoin.

## 14. Synthèse — règles d'or bulk

1. **Sélection persistée côté client uniquement** ; changement de filtre désélectionne (avec confirmation si > 5).
2. **Limite 500 simultanés**, refus au-delà de 1000.
3. **Modale de confirmation obligatoire** pour toute action bulk.
4. **Actions destructives = tapage explicite** (« SUPPRIMER N RITUELS »).
5. **Skip flags critiques par défaut** sur bulk approve, override possible avec choix éclairé.
6. **Audit double** : un événement par ritual + un audit global.
7. **Transaction par chunks de 50** pour ne pas verrouiller longtemps.
8. **E-mails async batchés** pour ne pas saturer SMTP.
9. **Raccourcis clavier** documentés.
10. **Composants réutilisables** entre toutes les surfaces admin (queue, published, import).
