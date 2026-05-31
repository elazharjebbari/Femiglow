# 80.3 — Workflow revue juridique externe

## Pourquoi

FemiGlow n'est pas un cabinet juridique. Chaque page légale doit être validée par un **juriste qualifié en droit commercial marocain** avant publication, surtout :
- Au lancement (toutes les pages)
- Lors de modifications substantielles
- Annuellement (révision proactive)

## Acteurs

| Rôle | Responsabilité |
|---|---|
| **Maya** (admin) | Rédige le draft à partir des templates |
| **CEO** | Valide les choix business (délais, garanties) |
| **Juriste externe** | Vérifie la conformité légale |
| **Tech** | Implémente les corrections demandées |

## Workflow

```
┌──────────┐    ┌──────────┐    ┌──────────────┐    ┌──────────┐
│  Draft   │ →  │  Export  │ →  │ Juriste relit│ →  │ Publish  │
│  (admin) │    │   PDF    │    │   + annote   │    │  (admin) │
└──────────┘    └──────────┘    └──────────────┘    └──────────┘
                                       │
                                       ▼ (si modif demandée)
                                  ┌──────────┐
                                  │  Admin   │
                                  │ corrige  │
                                  └──────────┘
                                       │
                                       └─── retour → Juriste relit
```

## Détail des étapes

### Étape 1 — Préparer le draft (Maya)

1. Ouvrir `/admin/legal/[slug]/edit`
2. Adapter le template préconfiguré aux spécificités FemiGlow
3. Remplir toutes les variables
4. **Soumettre à revue** (statut → `review`)

### Étape 2 — Exporter pour le juriste

Bouton "Export PDF" en haut de l'éditeur :
- Génère un PDF avec :
  - Titre, version, date
  - Contenu rendu (variables résolues)
  - Marge de droite pour annotations
  - Page de garde avec contact FemiGlow + juriste
- Format : A4, Inter 11pt

Ou export Word (.docx) pour annotation directe.

```bash
pnpm tsx scripts/export-legal-pdf.ts cgv > /tmp/cgv-v5-review.pdf
```

### Étape 3 — Envoyer au juriste

Email type :

```
Objet : Revue page légale "{{title}}" — FemiGlow

Bonjour Maître {{lastname}},

Merci de bien vouloir relire la page suivante avant sa publication :

- Titre : {{title}}
- Version proposée : v{{version + 1}}
- Statut actuel : Brouillon en revue
- Version précédente publiée : v{{previous_version}} (en pj)

Points d'attention spécifiques (s'il y en a) :
- [optionnel : modification de tel paragraphe]
- [...]

Délai de retour souhaité : 5 jours ouvrés.

Pour toute question : {{CONTACT_EMAIL}} · {{CONTACT_PHONE}}.

Cordialement,
Maya — FemiGlow
```

Joindre :
- PDF de la version proposée
- PDF de la version actuellement publiée (diff visuel possible)

### Étape 4 — Réception du retour

Le juriste retourne :
- Soit : **Approuvée** → passer à étape 5
- Soit : **Modifications demandées** → annotations sur PDF / Word

### Étape 5 — Intégrer les corrections

1. Maya modifie le draft selon annotations
2. **Re-export PDF** pour vérification
3. Re-envoi au juriste si modifs substantielles (alléger si typos)
4. Approbation finale → passage en publication

### Étape 6 — Publication

1. Workflow normal : tape "PUBLIER" + checklist
2. Conserver le PDF approuvé dans `/legal-reviews/[slug]-v[n].pdf` (drive interne)
3. Stocker la référence dans `legal_pages` :
   ```sql
   UPDATE legal_pages
   SET legal_review_ref = 'doc-2026-05-13-cgv-v6'
   WHERE slug = 'cgv';
   ```
   (champ optionnel pour audit)

## Cadence

| Type | Cadence |
|---|---|
| **Initial** | Toutes les pages avant lancement |
| **Modification substantielle** | À chaque changement de fond |
| **Modification mineure** (typo) | Pas obligatoire, sur jugement |
| **Révision proactive** | Annuelle, sur toutes les pages |
| **Changement réglementaire** | Dès publication (alerte loi/CNDP) |

## Cas particuliers

### Modification urgente (correction d'erreur factuelle)

1. Modifier le draft immédiatement
2. Publier sans attendre la revue juriste **uniquement** si :
   - Correction factuelle évidente (ex: faute de frappe sur l'adresse)
   - Ne modifie pas une obligation légale
3. Notifier le juriste a posteriori pour traçabilité

### Nouvelle page entièrement (pas dans les 9 templates)

Workflow renforcé :
1. Brief écrit au juriste **avant rédaction**
2. Recommandation juriste sur le contenu attendu
3. Maya rédige le draft
4. Revue normale

## Coûts indicatifs (à valider avec votre juriste)

| Service | Coût estimé |
|---|---|
| Revue 1 page (typo / minor) | 500-1500 dh |
| Revue 1 page (substantielle) | 1500-4000 dh |
| Revue complète des 9 pages | 8000-15000 dh |
| Audit annuel proactif | 5000-10000 dh |

## Sélection du juriste

Critères pour FemiGlow :
- Cabinet basé au Maroc (idéalement Casablanca / Rabat)
- Spécialité droit commercial + e-commerce
- Expérience cosmétique (loi 24-99)
- Connaissance CNDP (loi 09-08)
- Capacité d'analyse rapide (< 7 jours en standard)

## Modèle de tracking

Stocker chaque revue dans un Google Sheet ou base interne :

| Date | Page | Version | Juriste | Statut | Coût | Notes |
|---|---|---|---|---|---|---|
| 2026-05-13 | CGV | v6 | Mtre Bennani | Approuvée | 2 000 dh | "Précision art. 36" |
| 2026-05-15 | Privacy | v3 | Mtre Bennani | Modifs | 1 500 dh | "Référence CNDP à jour" |

## Documents à conserver

Dans `/legal-reviews/` (drive interne, accès restreint) :
- PDF version envoyée
- PDF version approuvée
- Email échangés
- Facture juriste

Conservation : 10 ans (obligations comptables + traçabilité).
