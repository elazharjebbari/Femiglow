# 00.5 — Références légales — Maroc

> Recherche détaillée des lois marocaines applicables à un site e-commerce
> de produits cosmétiques. Sert de base de rédaction pour les 9 pages.

---

## A. Mentions légales obligatoires

### Cadre

**Loi 53-05** sur l'échange électronique de données juridiques (article 5)
+ pratique e-commerce Maroc standard.

### Informations obligatoires

| Information | Pour qui | Source |
|---|---|---|
| Nom complet / Dénomination sociale | Tous | Loi 53-05 art. 5 |
| Forme juridique (SARL, SARL AU, EI…) | Sociétés | Code commerce |
| Capital social | Sociétés capitaux | Code commerce |
| Adresse du siège social | Tous | Loi 53-05 art. 5 |
| Numéro de Registre du Commerce (RC) | Tous | Code commerce |
| **ICE** (Identifiant Commun de l'Entreprise) | Tous (obligatoire 2016) | Loi de finances 2016 |
| Patente (taxe professionnelle) | Sociétés assujetties | Loi fiscale |
| **TVA** (numéro) si assujetti | Si CA > seuil | Loi de finances |
| Adresse email de contact | Tous | Loi 53-05 |
| Téléphone | Recommandé | Bonnes pratiques |
| **Directeur de publication** | Tous | Code presse + Loi 53-05 |
| **Hébergeur** : nom, adresse, téléphone | Tous | Loi 53-05 art. 5 |

### Pour FemiGlow (à valider)

- Forme : à définir (SARL AU probable pour mono-propriétaire)
- RC : à fournir
- ICE : 15 chiffres à fournir
- TVA : à vérifier selon CA
- Hébergeur : à documenter (Hostinger / OVH / autre selon serveur prod)
- Directeur de publication : Sara Jebbari

---

## B. Conditions Générales de Vente (CGV)

### Cadre

**Loi 31-08** édictant des mesures de protection du consommateur.

### Obligations CGV

| Élément | Article | Détail |
|---|---|---|
| Identité du vendeur | Art. 11 | Nom, adresse, RC, ICE |
| Caractéristiques essentielles du produit | Art. 11 | Description précise |
| Prix TTC en MAD | Art. 11 | Inclus toutes taxes |
| Frais de livraison | Art. 11 | Précisés avant validation |
| Mode de paiement | Art. 11 | COD / virement / carte autorisé |
| Modalités de livraison | Art. 11 | Délais, transporteur |
| **Droit de rétractation 14 jours** | Art. 36-37 | À mentionner explicitement |
| Conditions de garantie | Art. 65-66 | Garantie légale conformité 2 ans |
| Loi applicable et juridiction | Bonnes pratiques | Droit marocain, tribunaux Rabat |
| Service après-vente | Art. 11 | Email + tel contact |

### Spécificités à intégrer

- **Paiement COD (Cash On Delivery)** : très répandu au Maroc, à
  expliciter dans la liste des moyens
- **Livraison via Sendit** : nommer le partenaire de livraison
- **Devise unique** : tout en MAD (Dirham Marocain)
- **Délais** : 24h Rabat, 48-72h Maroc, hors-Maroc à définir

### Droit de rétractation — spécificités cosmétiques

**Loi 31-08 art. 38** liste les exceptions au droit de rétractation. Pour
les **produits cosmétiques**, l'usage prévoit que si le produit est
**descellé / ouvert**, le droit de rétractation **peut ne pas s'appliquer**
pour des raisons d'hygiène et de protection de la santé.

Précision recommandée dans les CGV :
> "Conformément à l'article 38 de la Loi 31-08, le droit de rétractation
> ne peut s'exercer sur les produits cosmétiques **descellés ou ouverts**.
> Les produits doivent être retournés dans leur emballage d'origine,
> intact et non utilisé."

---

## C. Politique de confidentialité (Loi 09-08)

### Cadre

**Loi 09-08** relative à la protection des personnes physiques à l'égard
du traitement des données à caractère personnel.

Promulguée 2009, amendements 2017. Plus légère que le RGPD mais cadre
similaire.

### Autorité : CNDP

**Commission Nationale de protection des Données Personnelles** (CNDP)
créée par Loi 09-08. Site : cndp.ma. Responsable :
- Délivrance des **autorisations** (traitements sensibles)
- Réception des **déclarations** (traitements ordinaires)
- Contrôle conformité
- Sanctions

### Obligations de l'éditeur

1. **Déclaration préalable** à la CNDP avant tout traitement
2. **Information de la personne concernée** :
   - Identité du responsable
   - Finalités du traitement
   - Données collectées
   - Destinataires
   - Existence du droit d'accès, rectification, opposition
3. **Consentement** pour finalités marketing/profilage
4. **Sécurité** des données (mesures techniques + organisationnelles)
5. **Durée de conservation** limitée
6. **Transferts internationaux** : autorisation CNDP si hors Maroc

### Droits des personnes

- **Droit d'accès** (art. 7)
- **Droit de rectification** (art. 8)
- **Droit d'opposition** (art. 9)
- **Droit de suppression** ("oubli") — non explicite mais pratique
- **Droit de portabilité** — non explicite

### À mentionner dans la page

```
- Identité du responsable de traitement : FemiGlow / Sara Jebbari
- Coordonnées DPO si désigné (recommandé si > 250 employés ; sinon, contact admin)
- Catégories de données collectées : identité, contact, commande, navigation
- Finalités : exécution contrat, livraison, marketing (si consentement)
- Base légale : exécution contractuelle (CGV) + consentement (marketing)
- Durée de conservation : à préciser (souvent 3 ans après dernière interaction)
- Destinataires : transporteur (Sendit), prestataire de paiement
- Droits utilisateurs : énumération + contact pour exercer
- Mention CNDP : déclaration n° XXX si fait, sinon "déclaration en cours"
- Cookies : renvoi vers politique cookies dédiée
```

---

## D. Politique cookies

### Cadre

Pas de loi cookies spécifique au Maroc (au contraire de la directive
ePrivacy européenne). MAIS :
- Si l'audience inclut des visiteurs européens (potentiellement) → conformité
  RGPD/ePrivacy recommandée (Consent Mode v2)
- La Loi 09-08 considère certains cookies comme traitement de données →
  consentement requis

### Bonnes pratiques

- **Bannière de consentement** : opt-in clair pour cookies non-essentiels
- **Catégorisation** :
  - **Essentiels / Fonctionnels** : pas de consentement requis (session, panier)
  - **Analytics** : consentement (GA4, Plausible)
  - **Marketing / Publicité** : consentement (Meta Pixel, Google Ads,
    TikTok Pixel, etc.)
  - **Préférences** : consentement
- **Liste précise** des cookies utilisés (nom, finalité, durée)
- **Comment refuser** : explication claire
- **Réversibilité** : possibilité de retirer le consentement

### Cookies FemiGlow connus

| Catégorie | Cookie | Finalité | Durée |
|---|---|---|---|
| Fonctionnel | `femiglow_cart` | Panier | 7 jours |
| Fonctionnel | `femiglow_admin_session` | Session admin | 8 heures |
| Fonctionnel | `femiglow_consent` | Stockage consentement | 12 mois |
| Analytics | `_ga` (GA4) | Analytics anonyme | 13 mois |
| Marketing | `_fbp` (Meta Pixel) | Tracking conversion | 90 jours |
| Marketing | `_gclid` (Google Ads) | Attribution clic Ads | 90 jours |
| Marketing | `_ttp` (TikTok Pixel) | Tracking TikTok | 30 jours |

(Liste à actualiser au moment de la rédaction de la page.)

---

## E. Loi 24-99 — Produits cosmétiques

### Cadre

**Loi 24-99** + **arrêté DMP** sur les produits cosmétiques au Maroc.

### Obligations producteur / vendeur

1. **Déclaration produit** auprès de la DMP avant commercialisation
2. **Étiquetage** :
   - Nom du fabricant + adresse
   - Lot
   - Date de péremption (DLU = Date Limite d'Utilisation)
   - **Composition INCI** (International Nomenclature of Cosmetic
     Ingredients) — obligatoire
   - Mode d'emploi
   - Précautions d'usage
   - Volume / poids net
3. **Sécurité** : évaluation de la sécurité du produit (dossier d'évaluation)
4. **Allergènes** : déclaration des allergènes courants
5. **Traçabilité** : lots, dates de production

### Mentions site web (e-commerce)

À intégrer dans la page **Avertissements sécurité produits** :
- Mention "Produits conformes à la Loi 24-99"
- Composition INCI accessible (lien vers fiche produit ou texte)
- Précautions :
  - "Usage externe uniquement"
  - "Tester sur une petite zone 24h avant première utilisation"
  - "Tenir hors de portée des enfants"
  - "En cas de contact avec les yeux, rincer abondamment"
  - "Cesser l'utilisation en cas de réaction allergique"
- Conservation : "Conserver à l'abri de la lumière et de la chaleur,
  température < 25°C"
- DLU : "Date limite d'utilisation après ouverture (PAO) : 12 mois"

### Spécificité halal (FemiGlow positionnement)

Si certification halal : mentionner l'organisme certificateur. Sinon,
mention "Composition compatible halal" basée sur les ingrédients INCI.

---

## F. Loi 03-03 — Cybersécurité

### Cadre

**Loi 03-03** réprime les infractions informatiques (accès frauduleux,
sabotage, etc.). Pas d'obligation publication mais impacte CGU.

### Mentions CGU

- Interdiction d'accéder frauduleusement au site
- Interdiction de tentative de vulnérabilité
- Coordonnées pour signaler une faille (`security@femiglow-maroc.com`)
- Loi applicable en cas d'infraction

---

## G. Tableaux récapitulatifs

### Pages × Lois applicables

| Page | Loi 53-05 | Loi 31-08 | Loi 09-08 | Loi 24-99 | Loi 03-03 |
|---|---|---|---|---|---|
| Mentions légales | ✅ Mandatory | | | | |
| CGV | ✅ Renvoi | ✅ Mandatory | | | |
| CGU | | | | | ✅ Renvoi |
| Politique de confidentialité | | | ✅ Mandatory | | |
| Politique cookies | | | ✅ Sous-ens. | | |
| Retours & remboursements | | ✅ Art. 36-37 | | | |
| Livraison | | ✅ Art. 11 | | | |
| Sécurité produits | | | | ✅ Mandatory | |
| FAQ | | (info pratique) | | | |

### Variables nécessaires (à fournir par admin)

| Variable | Description | Format |
|---|---|---|
| `{{COMPANY_NAME}}` | Nom légal de l'entité | string |
| `{{COMPANY_FORM}}` | Forme juridique (SARL AU, SA, EI, …) | string |
| `{{COMPANY_CAPITAL}}` | Capital social (sociétés) | string MAD |
| `{{COMPANY_ADDRESS}}` | Adresse complète du siège | string |
| `{{COMPANY_RC}}` | Numéro registre commerce | "12345/Rabat" |
| `{{ICE}}` | Identifiant Commun Entreprise | 15 chiffres |
| `{{COMPANY_PATENTE}}` | Numéro patente | string |
| `{{COMPANY_TVA}}` | Numéro TVA si assujetti | string OR vide |
| `{{COMPANY_EMAIL}}` | Email contact | email |
| `{{COMPANY_PHONE}}` | Téléphone | string |
| `{{DIRECTOR_NAME}}` | Directeur de publication | string |
| `{{HOSTING_NAME}}` | Nom hébergeur | string |
| `{{HOSTING_ADDRESS}}` | Adresse hébergeur | string |
| `{{HOSTING_PHONE}}` | Téléphone hébergeur | string |
| `{{DPO_EMAIL}}` | Email contact données perso | email |
| `{{CNDP_DECLARATION}}` | Numéro déclaration CNDP | string |
| `{{LAST_UPDATED}}` | Date de mise à jour | date FR |

---

## H. Sources et lectures complémentaires

- [Loi 53-05](https://www.cours-suprema.ma) — Code commerce électronique
- [Loi 31-08](https://www.cours-suprema.ma) — Protection consommateur
- [Loi 09-08 + CNDP](https://www.cndp.ma) — Données personnelles
- [Loi 24-99 + DMP](https://www.dmp.gov.ma) — Cosmétiques
- [Loi 03-03](https://www.cours-suprema.ma) — Cybersécurité

**Disclaimer** : ce document est une synthèse pédagogique. Pour la
publication réelle, **consulter un juriste**. La législation marocaine
évolue et certains points (ex : équivalent RGPD post-2022) sont en cours
d'actualisation.
