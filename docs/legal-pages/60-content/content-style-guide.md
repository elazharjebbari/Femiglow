# 60.0 — Guide éditorial des pages légales

## Voix de marque (charte FemiGlow)

FemiGlow s'adresse à des femmes marocaines exigeantes, attachées à la
qualité, la transparence et le rituel. Le ton :

- **Précis** sans jargon
- **Chaleureux** sans complaisance
- **Direct** sans froideur
- **Légal** mais lisible

## Personnes et possessifs

- L'entreprise : **3e personne** — « FemiGlow », « la société »
- L'utilisateur / la cliente : **2e personne plurielle** — « vous »
- Jamais "le client" ou "l'utilisateur" en interne — toujours « vous »
- Jamais "nous" sauf engagements forts (« Nous nous engageons à… »)

✅ « FemiGlow conserve vos données pendant 3 ans. »
❌ « Le client se voit conserver ses données pendant une durée de 3 années. »

## Structure type d'une page

```
# Titre principal
> Une phrase d'intro qui résume

## 1. [Section principale]

Texte explicatif en paragraphe(s).

### Sous-section éventuelle

- Liste à puces si énumération
- Reste lisible et concret

## 2. [Section suivante]

...

## Contact

Pour toute question : hello@femiglow.ma · +212 XXX XX XX XX
```

## Longueur

| Page | Longueur cible | Pourquoi |
|---|---|---|
| Mentions légales | 600–900 mots | Obligation légale stricte |
| CGV | 2500–4000 mots | Doit couvrir tous les cas |
| CGU | 1500–2500 mots | Couvre l'usage du site |
| Politique confidentialité | 2000–3000 mots | RGPD-like exhaustif |
| Politique cookies | 1000–1500 mots | Liste + finalités |
| Politique retours | 800–1200 mots | Procédure claire |
| Politique livraison | 600–900 mots | Délais et frais |
| Sécurité produits | 800–1200 mots | Avertissements lisibles |
| FAQ | 1500–3000 mots | SEO + service client |

## Variables disponibles

```
{{COMPANY_NAME}}        FemiGlow / Raison sociale complète
{{COMPANY_RC}}          RC 123456 (Registre de Commerce)
{{ICE}}                 Identifiant Commun Entreprise
{{IF}}                  Identifiant Fiscal
{{COMPANY_ADDRESS}}     Siège social complet
{{COMPANY_CAPITAL}}     Capital social (DH)
{{COMPANY_FORM}}        SARL / SA / SASU / Personne physique
{{DIRECTOR_NAME}}       Directeur de la publication
{{HOST_NAME}}           Nom hébergeur (ex: Vercel)
{{HOST_ADDRESS}}        Adresse hébergeur
{{HOST_CONTACT}}        Contact hébergeur
{{CONTACT_EMAIL}}       hello@femiglow.ma
{{CONTACT_PHONE}}       +212 6XX XX XX XX
{{SUPPORT_HOURS}}       Lun-Sam, 9h-18h
{{SITE_URL}}            https://femiglow.ma
{{DELIVERY_PARTNER}}    DHL Maroc / Amana / CTM Messagerie
{{DELIVERY_ZONES}}      Maroc + DROM-COM
{{PAYMENT_PROVIDERS}}   CMI, Stripe, …
{{CURRENCY}}            MAD (Dirham marocain)
{{LAST_UPDATED}}        Auto-substituée à publish
{{COOLING_OFF_DAYS}}    7 jours (loi 31-08)
{{DATA_RETENTION_YEARS}} 3 ans (CNDP)
{{CNDP_DECLARATION_REF}} Référence dossier CNDP (si applicable)
```

## Règles de fond

### À toujours faire

- **Citer les lois** précisément : « Conformément à l'article 36 de la loi 31-08… »
- **Donner un contact** clair pour réclamations : email + tél + horaires
- **Délais en jours ouvrables** explicitement
- **Devise** : Dirhams (MAD), avec mention « TTC »
- **Date de mise à jour** affichée en haut
- **Versionning** : la date de version doit apparaître

### À ne jamais faire

- Promettre un délai non tenable (ex: « livraison 24h » si moyenne 5j)
- Exclure un droit légal (ex: refuser le délai de rétractation)
- Utiliser des clauses abusives selon la loi 31-08
- Copier-coller depuis un site français sans adapter (RGPD ≠ Loi 09-08)
- Omettre la CNDP en politique de confidentialité

## Vocabulaire spécifique

| Préférer | Éviter |
|---|---|
| Données personnelles | Données privées |
| Délai de rétractation | Droit de retour |
| Remboursement intégral | Remboursement total |
| Commission Nationale (CNDP) | Autorité de contrôle |
| Litige | Conflit |
| Modes alternatifs de résolution | Médiation (trop générique) |
| Tribunaux compétents de Casablanca | Juridiction compétente |

## Cohérence inter-pages

Une information ne doit **JAMAIS être contradictoire** entre 2 pages.
Exemple : si politique retours dit 7 jours, CGV doit dire 7 jours.

Pour ça, on utilise les **variables** : `{{COOLING_OFF_DAYS}}` partagé.

## Format Markdown autorisé

- Headings : H1, H2, H3, H4
- Texte : `**gras**`, `*italique*`, `~~barré~~`
- Listes : `-`, `1.`
- Liens : `[texte](url)`
- Tableaux Markdown : OK
- Blockquotes : `>` pour les avertissements
- Code inline `code` : pour citer des termes techniques
- Images : INTERDIT dans le contenu légal (pas de SEO ni a11y)
- HTML brut : INTERDIT (filtré par DOMPurify)

## Workflow de relecture (★)

Avant publication d'une page légale :

1. ✅ Vérifier toutes les variables remplies
2. ✅ Vérifier cohérence avec autres pages publiées
3. ✅ Faire relire par un juriste (1 fois minimum)
4. ✅ Vérifier que tous les liens internes pointent vers des pages publiées
5. ✅ Faire un test de rendu sur mobile + desktop
6. ✅ Vérifier l'accessibilité (axe-core, lecteur d'écran)
7. ✅ Confirmation publication (texte "PUBLIER" + checklist)
8. ✅ Vérifier post-publication : URL accessible, sitemap, footer, etc.
