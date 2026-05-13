# 80.4 — Workflow mise à jour de contenu

## Cas couverts

| Cas | Procédure |
|---|---|
| Correction de typo | A — Direct |
| Mise à jour d'une variable (RC, ICE, adresse) | B — Var update |
| Ajout d'un paragraphe (FAQ, exemple) | C — Add content |
| Modification d'une clause légale | D — Legal change |
| Modification de prix / délais (politique livraison) | E — Business change |
| Nouvelle page | F — New page |
| Suppression d'une page | G — Archive |

## A — Correction de typo

**Pas besoin de juriste**, mais documenter.

1. `/admin/legal/[slug]/edit`
2. Corriger
3. Sauver (auto-save)
4. **Publier directement** (incrémente la version)
5. Tape "PUBLIER"

**Durée** : 2 minutes.

## B — Mise à jour d'une variable (RC, ICE, adresse)

Quand : changement d'adresse, renouvellement RC, nouveau capital.

1. `/admin/legal/template-vars`
2. Modifier la valeur (ex: `COMPANY_ADDRESS`)
3. Sauver

Banner alerte :
```
⚠ Cette variable est utilisée dans 7 pages.
  Re-publier ces pages pour appliquer le changement.
  [Re-publier toutes]  [Choisir]
```

4. Bouton "Re-publier toutes" → ouvre une modale liste
5. Pour chaque page, cocher → bulk republish (avec confirmation "PUBLIER" globale)

Durée totale : 10-15 minutes.

⚠ Les caches Next.js sont invalidés automatiquement via `revalidatePath`.

## C — Ajout d'un paragraphe

Exemple : ajouter une nouvelle question dans la FAQ.

1. `/admin/legal/faq/edit`
2. Ajouter en MD :
   ```markdown
   ### Comment annuler ma commande ?

   Avant expédition : contactez-nous à hello@femiglow.ma.
   Après expédition : exercez votre droit de rétractation.
   ```
3. Vérifier le rendu (preview live)
4. Sauver
5. Si page non-critique (FAQ) : publier directement
6. Si page critique : soumettre à revue juriste si modification substantielle

## D — Modification d'une clause légale

Exemple : passer de 7 jours à 14 jours de rétractation.

⚠ **Toujours faire valider par un juriste**.

1. Modifier le draft (sans publier)
2. Soumettre à revue (statut → `review`)
3. Export PDF + envoi juriste
4. Si OK : publier
5. Si modif demandées : itérer

**Durée** : 5-7 jours ouvrés (dépend du juriste).

Variantes :
- Si urgence régulementaire (changement de loi) : prioriser
- Si modification mineure (préciser un délai déjà existant) : revue express possible

## E — Modification de prix / délais (livraison)

Quand : ouverture d'une zone, changement de tarif transporteur, gratuité étendue.

1. `/admin/legal/politique-livraison/edit`
2. Modifier le tableau des frais
3. Si change implique CGV (ex: "livraison incluse > 500 dh") :
   - Modifier aussi `/admin/legal/conditions-generales-de-vente/edit`
4. **Vérifier la cohérence** entre les 2 pages (banner UI le signale)
5. Publier les 2 pages dans la même session (idéalement le même jour)

⚠ Communiquer au support client en parallèle (Slack / email).

## F — Nouvelle page

Ex : ajouter une politique anti-fraude.

1. `/admin/legal` → "+ Nouvelle page"
2. Suivre le wizard (5 steps)
3. Step 4 : choisir les placements
   - Pour une politique anti-fraude : probablement uniquement footer-main, pas en bottom bar
4. Soumettre à revue juriste
5. Publier après approbation
6. Vérifier en public :
   - Page accessible à `/legal/[slug]`
   - Lien apparaît dans le footer
   - Robots: noindex (par défaut)
7. Communiquer au support si page user-facing

## G — Suppression / archivage d'une page

Quand : page obsolète, fusion avec une autre, simplification.

1. `/admin/legal/[slug]/edit`
2. Tab "Zone danger"
3. "Archiver" + confirmation "ARCHIVER"
4. La page :
   - Redevient inaccessible (404 public, ou 410 si configuré)
   - Est retirée de toutes les zones
   - Reste en DB (soft delete)
5. Communiquer si lien externe pointait dessus (créer un redirect 301 vers une page équivalente si pertinent)

⚠ Avant d'archiver :
- Vérifier qu'aucune autre page ne référence celle-ci en lien interne
- Le banner UI le signale

Si besoin de restaurer plus tard :
- DB → set status='draft'
- Re-publier

## Bonnes pratiques

### Cadence de mise à jour

| Type | Cadence cible |
|---|---|
| Typos | Au fil de l'eau |
| Coordonnées (RC, adresse) | Immédiat après changement légal |
| FAQ | Hebdomadaire / mensuel selon volume |
| Politique majeure | Trimestriel max |
| Audit complet | Annuel |

### Communication interne

À chaque modification d'une page **critique** (CGV, Privacy, Cookies, Retours) :
1. Email équipe ops : "Page X mise à jour le {{date}}, voir version {{n}}"
2. Slack `#legal-updates` : message court
3. Si impact support : training du support team

### Communication externe

À chaque modification d'une page **substantielle** :
- Banner site pendant 7 jours : "Nos CGV ont été mises à jour le …"
- Email clients existants pour les changements RGPD-like / privacy
- Newsletter inclut la mention

### Audit a posteriori

Mensuel, par Maya :
- Liste des publications du mois
- Vérification cohérence inter-pages
- Vérification footer / cookie banner / checkout
- Vérification health dashboard (0 lien cassé)
