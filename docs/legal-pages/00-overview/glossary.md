# 00.2 — Glossaire

## Termes métier

**Page légale** — Page web dont le contenu remplit une obligation légale
ou contractuelle (mentions légales, CGV, politique de confidentialité,
etc.). Distincte des pages marketing ou éditoriales.

**Mentions légales** — Page d'identification de l'éditeur du site. Obligatoire
au Maroc (Loi 53-05 sur les échanges électroniques) : nom, adresse, RC, ICE,
directeur de publication, hébergeur.

**CGV (Conditions Générales de Vente)** — Contrat entre le vendeur et
l'acheteur, opposable. Obligatoire pour les sites e-commerce (Loi 31-08
protection consommateur).

**CGU (Conditions Générales d'Utilisation)** — Règles régissant l'usage du
site (compte utilisateur, comportements interdits, propriété intellectuelle).
Recommandé mais pas strictement obligatoire.

**Politique de confidentialité** — Document décrivant le traitement des
données personnelles. Obligatoire au Maroc (Loi 09-08).

**Politique cookies** — Sous-ensemble de la politique de confidentialité,
listant les cookies utilisés et leurs finalités.

**Politique de retour** — Modalités de retour des produits. Obligatoire
pour e-commerce (Loi 31-08 : droit de rétractation 14 jours).

## Termes juridiques Maroc

**RC (Registre du Commerce)** — Identifiant légal d'une entreprise marocaine.
Numéro attribué par le tribunal de commerce de la ville où est domiciliée
l'entreprise.

**ICE (Identifiant Commun de l'Entreprise)** — Identifiant unique national
créé en 2016, obligatoire pour toute entreprise marocaine. 15 chiffres.

**CNDP (Commission Nationale de protection des Données Personnelles)** —
Autorité marocaine équivalente à la CNIL française. Exige déclaration ou
autorisation pour le traitement des données personnelles selon la catégorie.

**Loi 31-08** — Loi marocaine de protection du consommateur. Définit le
droit de rétractation (14 jours), la garantie légale, les obligations
d'information.

**Loi 09-08** — Loi marocaine de protection des données personnelles.
Équivalent (allégé) du RGPD européen.

**Loi 24-99** — Loi sur les produits cosmétiques. Régulation par la
Direction du Médicament et de la Pharmacie (DMP). Exige déclaration des
produits, étiquetage INCI, garantie sécurité.

**Loi 53-05** — Loi sur les échanges électroniques de données juridiques.
Régule signature électronique, contrat à distance, factures électroniques.

**TVA** — Taxe sur la Valeur Ajoutée. Au Maroc : taux standard 20%, certains
produits à 7%/10%/14%. Mentionnée si l'entreprise est assujettie.

**DMP (Direction du Médicament et de la Pharmacie)** — Autorité marocaine
de régulation des cosmétiques. Exige une déclaration produit avant
commercialisation.

## Termes techniques système

**Slug** — Identifiant URL d'une page (`mentions-legales`, `cgv`, …).
Unique par page. Lowercase, kebab-case, ASCII.

**Status** — État d'une page légale : `draft` (brouillon, non visible),
`review` (en revue par autre admin), `published` (visible publiquement),
`archived` (retirée mais conservée).

**Placement** — Affectation d'une page à une zone du site (footer, banner
cookies, checkout, etc.). Une page peut avoir plusieurs placements.

**Zone** — Emplacement nommé du site où peut apparaître un lien légal :
- `footer-main` : colonne légale du footer
- `footer-bottom-bar` : ligne du bas (© FemiGlow · Mentions légales)
- `cookie-banner-links` : liens dans la bannière de consentement cookies
- `checkout-consent` : "J'accepte les CGV" au checkout
- `signup-consent` : "J'accepte la politique de conf." au signup
- `mobile-menu` : menu burger mobile
- `chat-disclaimer` : footer du chat widget

**Version** — Snapshot immutable d'une page légale à un instant T. Toute
modification crée une nouvelle version. L'historique permet l'audit.

**Branch `legal-versions`** — Branche git auto-générée où chaque publication
écrit `content/legal/<slug>.<version>.md`. Source de vérité hors-DB pour
recovery.

**`include_in_search`** — Flag boolean par page indiquant si elle doit être
indexée par les moteurs (default `false` = noindex). Override possible
pour FAQ ou cas particulier.

**Link health snapshot** — Résultat d'une vérification automatique :
pour chaque (page × zone) visible, vérifie que la page existe en DB et
répond 200 sur sa route publique. Stocké dans `legal_link_health_snapshot`.

## Templating contenu

**Variable de template** — Placeholder dans le contenu MD remplacé à la
publication. Syntaxe `{{VAR_NAME}}`. Exemples :
- `{{COMPANY_NAME}}` → "FemiGlow"
- `{{COMPANY_ADDRESS}}` → "25 bis avenue Patrice Lumumba, Rabat"
- `{{ICE}}` → "001234567890123"
- `{{RC}}` → "12345/Rabat"
- `{{DPO_EMAIL}}` → "privacy@femiglow-maroc.com"
- `{{LAST_UPDATED}}` → "13 mai 2026"

Stockées dans `legal_template_vars` (table) ou env.

**Front-matter MD** — Métadonnées YAML en tête du contenu MD :
```yaml
---
title: "Mentions légales"
description: "Informations légales obligatoires"
last_updated: "2026-05-13"
require_legal_review: true
---
```

## Termes UX

**Preview live** — Rendu côté éditeur qui se met à jour à chaque keystroke
de l'éditeur MD. Pas de re-fetch serveur.

**Split-pane** — Layout 2 colonnes (éditeur à gauche, preview à droite).

**Workflow Draft → Review → Publish** — 3 statuts. L'admin sauvegarde en
draft, soumet en revue, et un admin (peut-être le même) publie.

**Audit trail** — Journal de toutes les modifications avec timestamp et
auteur. Crucial pour la légalité (preuve en cas de litige).
