# F09 — Plan d'implémentation (Suppression & Events)

> Ordre : **P1.5** (pilote socle sur le retrait existant) PUIS **P5.1**
> (ajout / filtres / bulk / export / events). On ne livre P5.1 qu'une fois le
> socle validé sur un écran réel.

---

## Étape P1.5 — Pilote du socle sur le retrait unitaire

**But** : `SuppressionList` est l'**écran pilote** du socle F01. On migre le
retrait unitaire EXISTANT (déjà testé par le code modèle) avant d'ajouter quoi
que ce soit. C'est le banc d'essai qui prouve que ConfirmDialog / Toast /
EmptyState tiennent sur un écran réel.

**Travaux** :
1. Remplacer `window.confirm` (lignes ~132 de `SuppressionList.tsx`) par
   **ConfirmDialog** (variante danger, verbe « Retirer », corps = conséquences
   « pourra de nouveau recevoir des emails transactionnels ET campagnes »).
2. Remplacer le bandeau succès maison (`role=status` inline) par le **toast**
   du `ToastProvider` (auto-dismiss 4 s, message RÉSULTAT).
3. Remplacer les blocs vides maison (`suppression-empty`) par **EmptyState**
   (variantes `empty` / `filtered`).
4. Conserver strictement : ligne préservée sur erreur, zéro faux succès,
   anti-double-clic, refetch après succès.
5. Activer le verrou ESLint `no_window_confirm` sur le fichier.

**Tests** : grille réseau retrait déjà fournie par le modèle
(`F09-C-001/010..015/020` — NE PAS dupliquer) ; ajouter `F09-C-082/083/084`
(migration socle observable) + `F09-C-085/086` (EmptyState).

**Sortie de phase** : invariants `INV-1/INV-2/INV-3/INV-5/INV-7` verts sur
SuppressionList (ligne ajoutée au `describe.each` du socle).

---

## Étape P5.1 — Pilotage complet de la suppression + events

### Backend (à faire d'abord — les contrats verrouillent les mocks)
1. `POST /api/admin/emails/suppression` : Zod `superRefine` (détail requis ssi
   `manual_admin`), ordre 422 → 409 allowlist → 409 doublon → 201 ; source par
   défaut selon raison ; audit `mail.suppression.add`.
2. `lib/mail/suppression.ts` : `addSuppression` **refuse** une adresse interne
   (`isInternalAddress` → no-op / signal), pour fermer R-009 à la source (pas
   seulement à la route).
3. `POST /api/admin/emails/suppression/bulk-remove` : cap 500, dédoublonnage,
   `DELETE … IN … RETURNING`, réponse `{removed, notFound}`, audit
   `mail.suppression.bulk_remove` **systématique**.
4. `GET /api/admin/emails/suppression/export` : rejoue le WHERE de la liste
   sans pagination, stream CSV BOM + RFC4180, `Content-Disposition` daté.
5. `lib/user-events/queries.ts` : `getRecentEvents` accepte `eventName`,
   `email`, `windowMs` (number | null) ; `window=24h` borne le stream.
6. Tests intégration (`F09-I-030..042`) + conformité contrat (`F09-I-042`).

### Frontend Suppression
7. Filtres **raison** / **source** (selects) + correction du libellé
   « Filtrer par email » ; URL persistée `?email=&reason=&source=&offset=` ;
   bouton Réinitialiser ; `offset=0` à tout changement de filtre.
8. Dialog **ajout manuel** (ConfirmDialog) : champs + validation conditionnelle
   du détail + messages d'erreur distincts (422 / 409 allowlist / 409 doublon).
9. **Bulk** : checkboxes + tout-la-page + bulk bar + ConfirmDialog unique avec
   nombre + résultat partiel honnête + sélection préservée sur échec.
10. **Export CSV** : bouton propageant les filtres courants.
11. Grilles réseau `F09-C-043..048` (ajout), `F09-C-067..072` (bulk),
    `F09-C-076..081` (export).

### Frontend Events
12. Filtres **event** / **email** + toggle **fenêtre 24 h / Tout** (cohérence
    compteurs) ; URL persistée.
13. **Expand** `<details>` JSON formaté complet ; **corrélation** outbox/campagne
    par clé exacte ; **overflow-x-auto** sur le stream ; titre désambiguïsé.
14. Tests `F09-C-088..101` + unitaires `F09-U-039/040`.

### Navigation (dépendance F02)
15. L'onglet « Suppression » (SUP-01 / NAV-F04) est livré par F02 ; F09 suppose
    l'accès non-orphelin mais ne le porte pas. Coordonner pour ne pas régresser
    le deep-link `?email=` existant.

---

## Risques & parades

| Risque | Gravité | Parade |
|---|---|---|
| **Faux retrait massif** (bulk sur mauvais filtre) = clientes débloquées à tort, ou pire un retrait qui aurait dû rester | élevée (sécurité délivrabilité / conformité) | ConfirmDialog avec **nombre** ; export-preuve avant action (SM-F09-01) ; **audit-log systématique** testé (`F09-I-036`) ; résultat honnête `{removed,notFound}` |
| **Faux ajout interne** (R-009) coupe les notifications équipe | élevée (canal lead invisible) | refus **à deux niveaux** : route (409) ET `addSuppression` (lib) ; tests `F09-I-032/040` + `F09-C-040` ; `isSuppressed` bypass inchangé |
| **Détail manquant** sur `manual_admin` = suppression non traçable | moyenne | validation Zod conditionnelle serveur (`F09-I-031`) + bouton désactivé client (`F09-C-033`) |
| **Export grosses listes** (12 500+ lignes) = mémoire/latence | moyenne | stream CSV (pas de buffer total) ; export rejoue le WHERE filtré (pas la table entière par défaut) ; pas de `limit` mais filtre encouragé |
| **Incohérence fenêtre events** persiste si toggle mal câblé | faible | oracle binaire `F09-C-091` : aucune ligne `ts < now-24h` quand `window=24h` |
| **Lien outbox/campagne deviné** sur clé absente | faible | corrélation par clé exacte + valeur non vide (`F09-U-039`, `F09-C-098/099`) |
| **Faux succès** réseau (toast vert sur échec) | élevée | invariant zéro faux succès, grilles réseau 6 cas par action |

---

## Rollback

- **Backend** : les 3 nouvelles routes (POST, bulk-remove, export) sont
  **additives** — pas de migration destructive, pas de changement de schéma DB
  (`email_suppression` inchangée). Rollback = retirer les routes ; GET/DELETE
  existants intacts.
- **Frontend** : la refonte de `SuppressionList` / `EventsDashboardView` est
  remplaçable par les composants actuels (feature-flag possible si besoin de
  livraison progressive, sinon revert de commit).
- **Socle (P1.5)** : si un invariant régresse, revert isolé du retrait migré
  (retour `window.confirm`) sans toucher P5.1.
- Déploiement prod = build + `systemctl restart femiglow.service`
  (single-instance, migrations additives uniquement — cf. mémoire infra).
- **Garde-fou irréversible** : aucune commande ne **vide** la liste ; toute
  suppression de lignes passe par bulk-remove audit-loggé → un rollback
  applicatif n'efface jamais de données de suppression.

---

## Quality gates spécifiques F09

- G1 : batterie F09 (`03-batterie-tests.csv`) 100 % verte.
- G7 : grille réseau 6/6 présente pour **add**, **bulk-remove**, **export**,
  **retrait unitaire** (4 blocs `— grille réseau`).
- G9 : conformité contrat pour POST + bulk-remove (`F09-I-042`).
- G6 : axe 0 serious/critical (jsdom `F09-A-030..032` + E2E `F09-E-003`).
- G8 : `SM-F09-01`, `SM-F09-02` verts en fin de phase (Mailpit prouve le
  re-blocage / déblocage réel).
