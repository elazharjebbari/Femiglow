# Catalogue des pages B2C

Ce document détaille les neuf pages B2C plus l'article dynamique : objectif, KPI, sections, voix, dépendances de données, tactiques UX appliquées. Toute itération sur une page existante ou ajout de nouvelle page B2C doit s'inscrire dans ce gabarit.

## Gabarit appliqué à chaque page

| Champ | Description |
| --- | --- |
| Objectif | Ce que la page doit produire dans le funnel |
| KPI | Indicateurs mesurables (bounce, scroll, conversion, durée) |
| Sections | Blocs principaux dans l'ordre d'apparition |
| Voix | Registre éditorial dominant |
| Dépendances data | Schémas Zod / tables BDD utilisés |
| Tactiques | Références Kolenda et académiques sollicitées |

## 1. `/` Accueil — landing éditorial TOFU

**Objectif** : convertir cliente curieuse en cliente initiée en 5 secondes ; dual path funnel.

**KPI** : bounce < 55 %, scroll > 60 %, CTR CTA primaire > 12 %, inscriptions newsletter > 3 %.

**Sections** (6) :

1. **Hero éditorial** — 92 vh, vagues pétale asymétrique + sauge superposées, wordmark Pinyon centré, titre Cormorant « Le rituel d'éclat. Quatre gestes. Une main qui retrouve sa lumière, sans vernis ni abrasion. ». Deux CTA : encre « Découvrir le rituel » (action) + texte « Lire le manifeste → » (scroll).
2. **Les 4 gestes** — 4 cartes côte à côte avec étiquettes circulaires (sauge / pétale / crème / ciel). Numéro Cormorant 24 pt, mot italique 14 pt, icône suggestive jamais photo. Hover révèle une phrase descriptive.
3. **Le manifeste** — bandeau sauge pâle pleine largeur, Cormorant Italic 28 pt centré, fleuron champagne avant la première ligne : *« Pas une marque. Une maison. Pas un produit. Un rituel. Pas une cliente. Une initiée. »* Aucun CTA.
4. **Avis clientes** (3) — citations ≤ 25 mots, photo de mains tenant pot (jamais de visage de face), pas d'étoiles, mention « Salma, Casablanca · Initiée depuis [mois année] ».
5. **Journal extraits** (3) — grille asymétrique 1 hero large + 2 petites. Photo lifestyle floutée + titre Cormorant + date discrète. Card entière cliquable.
6. **Newsletter** — bloc sauge pâle, champ email + bouton encre « S'abonner ». Microcopy : *« Le journal du rituel. Une lettre par mois. Lente, comme le rituel. »*

**Voix** : sensorielle, métaphorique, complice.

**Dépendances data** : hero (titre, tagline, CTAs), 4 gestes (4 items), manifeste (3 lignes), avis (3 items), journal extraits (3 items).

**Tactiques** : saillance unique, indirect claim, empty space (+23 % premium perçu — Sevilla & Townsend 2016), F-pattern break (asymétrie), content > discount (newsletter).

## 2. `/rituel` Page narrative MOFU

**Objectif** : transformer la curiosité en conviction lente vers `/kit`. Lecture 3–5 min.

**KPI** : temps > 2:30, scroll ≥ 75 % > 50 %, watch rate vidéo ≥ 50 % > 40 %, CTR pivot → `/kit` > 25 %, bounce < 35 %.

**Sections** (6) :

1. **Hero lifestyle** — 86 vh, photo mains + pots, surtitre champagne « LE RITUEL », titre Cormorant 64 pt.
2. **Origine japonaise** — 2 paragraphes Cormorant + photo sépia vintage. Vérité historique sobre, sans légende romancée.
3. **Les 4 gestes (vidéo)** — 90 s slow motion (300–400 ms perception). Mains anonymes. Voix off rare. Sous-titres FR + AR. Plein écran possible.
4. **Sciences du soin** — 3 paragraphes max + visuel SVG scientifique (ongle animé), sources académiques bas de page.
5. **Témoignage initiée** — interview Q/R format magazine. 5 questions max. Photo « implied » (mug, ongles posés, jamais visage).
6. **Pivot vers kit** — bandeau sauge clair, fleuron, *« Maintenant que vous savez. Recevoir le kit. »* CTA encre vers `/kit`.

Puis cross-link journal : 3 articles connexes.

**Voix** : narrative, éducative, sensorielle.

**Dépendances data** : hero, sections narratives, vidéo (src + captions FR/AR), sciences (essais, sources), interview, journal cross.

**Tactiques** : storytelling, slow motion = luxury (Kolenda), credibility, mirror effect, P.A.S. framework (Problem-Agitate-Solve).

## 3. `/kit` Fiche produit pivot BOFU — la page de plus haute valeur

**Objectif** : conversion add-to-cart. Traite 9 risques perçus (Lantos 2011).

**KPI** : add-to-cart > 12 %, temps > 1:30, scroll ≥ 80 % > 45 %, bounce < 25 %.

**Sections au-dessus du pli** :

1. **Hero produit** — photo composition kit (4 pots sur marbre, café, main). Contextuelle, jamais fond blanc. Titre Cormorant 32 pt « Kit Rituel d'Éclat », sous-titre italique « Le rituel complet — 4 étapes. ». Prix rond **320 dh** sans barré, sans countdown (Wadhwa & Zhang 2015). CTA « Recevoir le rituel » encre sur crème. 3 réassurances filets : livraison 48 h Casa, retour 14 j, paiement 3× sans frais.
2. **Composition slow reveal** — zoom successifs sur 4 pots (paste, powder, shine, polish), packshot slow motion révélé au scroll, jamais cliquable.

**Sous le pli** :

3. **Vidéo 4 gestes** (réutilisée) — 90 s slow motion, déclenchement par intersection observer 50 %, autoplay muet.
4. **Composition détaillée** — tableau ingrédients par pot : nom, concentration, fonction. Aucun mot scientifique sans traduction sensorielle.
5. **Comparatif vernis vs rituel** — tableau 3 colonnes : vernis classique / vernis semi / rituel FemiGlow. Critères : durée, abrasion, tenue, éclat, coût annuel.
6. **FAQ contextuelle** — 8 à 10 accordéons.
7. **Témoignages photos-mains** — 3 avis longs (60–100 mots). Mention « Initiée depuis avril 2026 ».
8. **CTA final dupliqué** — « Recevoir le rituel » réapparu en bas de page.

CTA sticky visible sur scroll (desktop). Cross-link journal en pied.

**Voix** : descriptive, rassurante, factuelle. Pas de superlatif.

**Dépendances data** : produit complet (4 sous-produits, prix, ingrédients, certifications), vidéo, FAQ, témoignages, réassurances.

**Tactiques** : round pricing = émotionnel luxe, effort reduction, objection handling, decision fatigue, CTA repetition, imply human.

## 4. `/journal` Hub éditorial + SEO long-tail

**Objectif** : autorité éditoriale, capture email, preuve sociale en phase considération.

**KPI** : CTR articles > 35 %, newsletter > 28 %, durée 3–15 min selon profondeur.

**Sections** (6) :

1. **Hero journal** — titre Cormorant Italic « Le carnet de la maison. », fleuron, intro éditoriale.
2. **Article featured** — layout 60/40, badge « À LA UNE » champagne. Large photo + titre + extrait.
3. **Filtre catégories** — 6 pills : Toutes + 5 (Rituel, Histoire, Conseils, Maison, Matières). Max 4 visibles (Gallivan).
4. **Grille articles** — 3 colonnes desktop / 2 tablet / 1 mobile, 12 cards initiales, load-more progressif.
5. **Newsletter** — bandeau sauge pâle dédié.
6. **Cross-link** — bandeau image + texte → `/maison` ou `/rituel`.

Pas de pub, pas de pop-up, pas de related intrusif.

**Voix** : narrative, contemplative.

**Dépendances data** : featured article (fallback dernière), articles array (12 initiaux), catégories (5 + all).

**Tactiques** : load-more progressif > infinite scroll (Baymard 2022), empty space, no social friction.

## 5. `/journal/[slug]` Article détail — lecture profonde

**Objectif** : SEO long-tail, engagement profond, rétention.

**KPI** : scroll ≥ 90 % > 60 %, CTR articles liés > 15 %, newsletter signup depuis page > 5 %.

**Sections** :

1. **Hero article** — featured image, titre Cormorant Light, date + reading time, surtitre catégorie.
2. **Contenu markdown** — largeur lecture 65–75 caractères. Cormorant Light 22 pt titres, Inter 17 pt corps, line-height 1.6. Pas de pub côté.
3. **Engagement subtil** — 3 articles connexes (jamais 6+, jamais aléatoires). Newsletter CTA. Pas de like, pas de commentaire.

**Voix** : narrative.

**Dépendances data** : Article (slug, title, category, content markdown, featuredImage, publishedAt, readingTimeMinutes, seo), 3 articles connexes.

## 6. `/maison` Récit fondateur, institutionnel MOFU / trust

**Objectif** : construire la confiance par l'histoire. La cliente qui connaît qui fait, achète différemment. Aussi consultée par futurs partenaires B2B — doit servir deux audiences sans changer de ton.

**KPI** : bounce < 50 %, scroll ≥ 90 % > 40 %, temps > 2:30, CTR cross > 5 %.

**Sections** (7) :

1. **Hero** — 92 vh, titre « La maison d'éclat. », tagline, CTA scroll « Découvrir l'atelier → ».
2. **L'histoire** — 3 paragraphes Cormorant. Pas de « Tout a commencé en… ». Détail concret (grand-mère, voyage, pot trouvé).
3. **Photo fondatrice** — **jamais** de portrait de face. Photo de profil au travail, mains visibles. Format 3:4, fond marbre crème.
4. **Manifeste développé** — 3 lignes manifeste, chacune accompagnée d'un paragraphe d'explication. Cormorant Italic 28 pt + Inter 11 pt.
5. **Engagements** (5) — concrets : sans paraben, sans test animal, packaging recyclé, livraison locale, partenariat instituts marocains. Pas de greenwashing.
6. **Pivot subtil B2B** — *« Vous représentez un institut ? Découvrir notre programme partenaires. »* Lien fin, pas bouton.
7. **CTA — pas de vente** — un seul lien : *« Le journal — pour rester en contact. »* **Jamais** « Acheter le kit ». La page est un don, pas un push.

**Voix** : narrative, humanisée.

**Dépendances data** : hero, sections narratives, photo fondatrice, manifeste (3 lignes), engagements (5 items), cross-links.

**Tactiques** : indirect claim, storytelling, transparency, imply presence, zoom-out, dual-path (B2C + B2B sans bascule de ton).

## 7. `/panier` Pre-checkout

**Objectif** : vérification, ajustement quantité, engagement frictionless vers `/commander`.

**KPI** : conversion panier → checkout > 75 %, temps < 45 s.

**Sections** (6) :

1. **Hero** — titre « Votre panier. », sous-titre count + total.
2. **Carte articles** — photo + nom + quantity selector (−1 / +1 interactif) + prix + « retirer » (jamais icône poubelle violente).
3. **Récap** — sous-total / livraison estimée / total. Total Cormorant 22 pt, rond sans cents. CTA « Commander → » encre sticky desktop.
4. **Up-sell discret** — 1 item complémentaire (recharge powder) avec narrative : *« Pour prolonger le rituel : la recharge. »*
5. **Code partenaire** — replié par défaut, révélé au clic.
6. **États** — panier vide : message sobre « Votre panier est vide. » + lien `/kit`.

Trust signals pied : livraison 48 h Casa · retour 14 j · paiement sécurisé.

**Voix** : fonctionnelle, rassurante.

**Dépendances data** : `Cart` Zod (items, subtotal, shipping estimate, total).

**Tactiques** : gentle removal, soft up-sell, code partenaire caché par défaut (pas de tentation chez ceux sans code).

## 8. `/commander` Tunnel checkout 3 étapes — page de plus haute valeur

**Objectif** : minimiser l'abandon. Trois étapes max.

**KPI** : conversion > 65 %, complétion 1 → 2 > 90 %, 2 → 3 > 85 %, 3 → succès > 80 %, time-to-complete < 3 min, erreurs paiement < 3 %.

**Structure** :

```
[01. Livraison] → [02. Paiement] → [03. Validation]
```

**Étape 1 — Informations** : email + opt-in newsletter + opt-in compte. Pas de mot de passe. Auto-complétion ville Maroc.

**Étape 2 — Livraison** : nom, prénom, adresse (line1 + line2 optionnel), quartier, ville, téléphone (validation format Maroc `^(\+212|0)[5-7][0-9]{8}$`), sélecteur mode (standard / express).

**Étape 3 — Paiement** : choix carte / COD. Stripe Elements (jamais champ custom). Code promo. Acceptation CGU checkbox.

**Récapitulatif** : sticky desktop / accordéon mobile, toujours visible.

**Progress bar** : 3 étapes, couleur sauge.

**Validation champs** : temps réel, aucun champ optionnel demandé, autosave chaque field.

**États chargement** : overlay spinner, message « Un instant… ».

**Erreurs** : bandeau rouge feutré discret, pas alarmiste.

**Voix** : minimaliste, rassurante, fonctionnelle.

**Dépendances data** : `Cart`, `User` (optionnel), shipping options, payment methods, Stripe public key.

**Tactiques** : guest checkout par défaut, min 3 étapes (Baymard), progress visible, no hidden fields, mobile first, single payment gateway, autosave.

## 9. `/merci` Post-achat — bascule transaction → relation

**Objectif** : désamorcer le buyer's remorse, transformer un achat en initiation.

**KPI** : scroll > 70 %, CTR journal > 15 %, retour site J+7 > 30 %, buyer's remorse < 1.5 %.

**Sections** (8) :

1. **Header standard**.
2. **Hero remerciement** — fleuron champagne + titre personnalisé « Merci, [Prénom]. » + sous-titre « Votre commande est en bonnes mains. » + numéro **FG-2026-XXXXX** + filet pointillé sauge + « Livraison estimée [date] ». Pas de répétition prix (la cliente vient payer ; rappel = effet négatif).
3. **Récap commande** — image produit + détails + adresse + mode paiement. Mini, sobre.
4. **Timeline étapes** — 3 étapes visuelles (Préparation → Expédition → Livraison).
5. **Lettre éditoriale** — signée Salma, Cormorant Light 15 pt, max 640 px, contenu CMS-pilotable. Exemple : *« Vos ongles découvrent le rituel en ce moment. Cinq minutes. Patience. Éclat qui revient doucement. »*
6. **Préparation au geste** — photo lifestyle + texte court.
7. **Cross-links** (2) — cards `/journal`, `/maison`.
8. **Footer standard**.

**Sécurité** : `/merci?order=FG-XXXXX` requiert session valide. `Cache-Control: no-store`. Redirection `/` si pas de token.

**Triggers au chargement** :

- Vider panier.
- Envoyer email de confirmation.
- Planifier emails J+5 (« Premiers gestes ») + J+15 (« Une saison passe »).
- GA4 event `purchase`.

**Voix** : narrative, chaleureuse, rituelle. Pas transactionnelle.

**Dépendances data** : `Order` complète, customer (firstName, email), estimatedDelivery (min/max dates), letter (contenu CMS), recommended articles (1–2).

**Tactiques** : language of ritual, emotional high, momentum protection, anticipation.

## 10. `/contact` Pont conversationnel transverse

**Objectif** : accès conversationnel B2C avant/après achat + B2B.

**KPI** : complétion form > 65 %, 25–35 % de clics email direct, délai réponse < 24 h, NPS > 8 / 10.

**Sections** (6) :

1. **Hero** — titre « Contact. », sous-titre interrogatif. Email cliquable `contact@femiglow.ma`.
2. **Coordonnées directes** — email + adresse atelier Casablanca + filet sauge.
3. **Formulaire** — sélecteur type (3 options : question / order / professional) + champs adaptatifs. Requis selon type : phone + companyName + role si professional, orderNumber si order.
4. **FAQ courte** — 4 accordéons max (contextuels selon type).
5. **Cross-links** — 2 à 3 liens vers `/journal`, `/maison`, `/rituel`.
6. **États** — succès : modal ou page `/contact?sent=1` avec message « Votre message est arrivé. Nous écrirons sous trois jours. » Erreur : bandeau informatif.

Validation : reCAPTCHA, consentement RGPD obligatoire.

**Voix** : hospitalière, mesurée, accessible.

**Dépendances data** : FAQs (4 items), defaultType (optionnel depuis query).

## Synthèse — invariants des pages B2C

1. **Au-dessus du pli** : titre Cormorant, sous-titre, un seul CTA primaire encre, vague décorative en SVG. Aucune exception.
2. **Manifeste** : présent sur `/`, développé sur `/maison`, jamais traité comme un simple visuel.
3. **Témoignages** : mains uniquement, max 25 mots si court, 60–100 si long. Mention « Initiée depuis [mois année] ».
4. **CTA** : verbe + objet. « Recevoir », « Composer », « Découvrir », « Lire ». Jamais « Acheter », jamais « En savoir plus ».
5. **Photographie** : pots, mains, marbre, table. Jamais de visage de face, jamais de banque d'images générique.
6. **Vidéos** : slow motion, mute par défaut, autoplay sur scroll (intersection observer 50 %), captions FR + AR.
7. **Newsletter** : un seul point d'entrée fort (`/journal`), bandeau secondaire sur `/`. Jamais en footer global, jamais en pop-up.
8. **Cross-links** : 2 à 5 par page, contextuels, pas de carrousel de produits liés.
9. **Erreurs et états vides** : sobres, sans drame. Toujours une issue (lien retour ou action alternative).
10. **Tunnel checkout** : 3 étapes. Aucune négociation. Tout ajout de champ doit être justifié par un KPI mesurable.
