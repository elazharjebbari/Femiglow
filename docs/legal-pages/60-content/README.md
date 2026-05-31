# 60 — Contenu : pages légales préconfigurées

Ce dossier contient les **9 pages légales standard** pour FemiGlow,
préconfigurées selon le contexte juridique marocain (Loi 53-05, 31-08, 09-08,
24-99, 03-03 + bonnes pratiques internationales).

Toutes les pages sont au format Markdown, prêtes à insérer dans la DB
au seeder. Les variables `{{XXX}}` sont substituées au rendu.

| Fichier | Slug | Description | Obligation légale |
|---|---|---|---|
| `mentions-legales.md` | `mentions-legales` | Identification entreprise + hébergeur + directeur de publication | **Loi 53-05 art. 65-2** |
| `conditions-generales-vente.md` | `conditions-generales-de-vente` | Conditions d'achat, prix, livraison, paiement, garantie | **Loi 31-08 art. 32-49** |
| `conditions-generales-utilisation.md` | `conditions-generales-utilisation` | Conditions d'utilisation du site et compte | Bonnes pratiques |
| `politique-confidentialite.md` | `politique-confidentialite` | RGPD-like, donnée personnelles, CNDP | **Loi 09-08 + CNDP** |
| `politique-cookies.md` | `politique-cookies` | Tracking, cookies tiers, consentement | **Loi 09-08 + e-Privacy** |
| `politique-retours-remboursements.md` | `politique-retours` | Délai rétractation, remboursement, échange | **Loi 31-08 art. 36-37** |
| `politique-livraison.md` | `politique-livraison` | Délais, frais, zones | Bonnes pratiques |
| `avertissements-securite-produits.md` | `securite-produits` | Allergènes, patch test, contre-indications | **Loi 24-99 (cosmétiques)** |
| `faq-service-client.md` | `faq` | FAQ achats, livraison, retours, contact | Marketing / SEO opt-in |

## Style éditorial commun

- **Ton** : professionnel, transparent, accessible
- **Voix** : "FemiGlow" (3e personne pour l'entreprise) + "vous" pour le client
- **Vocabulaire** : éviter le jargon, privilégier le concret
- **Structure** : H2 pour grandes sections, H3 pour sous-sections, bullets pour listes
- **Variables** : `{{COMPANY_NAME}}`, `{{COMPANY_RC}}`, `{{ICE}}`, `{{CONTACT_EMAIL}}`, etc.

Voir `content-style-guide.md` pour le détail.

## Sources juridiques

- `../00-overview/legal-references-morocco.md` — Détail des lois citées
- DAHIR n° 1-11-03 du 18 février 2011 portant promulgation de la loi 31-08
- DAHIR n° 1-09-15 du 18 février 2009 portant promulgation de la loi 09-08
- DAHIR n° 1-04-257 du 25 décembre 2004 portant promulgation de la loi 53-05
- Code de commerce (loi 15-95)
- Loi 24-99 relative aux produits cosmétiques (références techniques ANRAC)

## Disclaimer

⚠ **Important** : ces contenus sont des **modèles préconfigurés**.
Avant publication, ils DOIVENT être :

1. **Relus par un juriste** spécialisé en droit commercial marocain
2. **Adaptés au cas spécifique** de FemiGlow (catalogue, prix, opérations)
3. **Mis à jour** avec les **variables réelles** (RC, ICE, adresse, contact)
4. **Validés** par la direction (CEO ou dirigeant)

FemiGlow assume la responsabilité finale du contenu publié.

## Workflow recommandé

```
1. Seeder importe les 9 pages en status='draft'
2. Admin remplit les variables (RC, ICE, adresse…) dans /admin/legal/template-vars
3. Admin relit chaque page, ajuste contenu spécifique
4. Admin soumet à revue juriste externe (export PDF)
5. Juriste valide / amende
6. Admin publie chaque page (commit git auto)
7. Activate placements selon design
```
