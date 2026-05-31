# 15 — Templates d'import et formats supportés

Spécification exhaustive des formats acceptés par le système d'import, avec exemples concrets, règles de validation par colonne, et templates téléchargeables depuis l'admin.

## 1. Modèle canonique

Le modèle canonique est l'**ordre et la dénomination** des colonnes attendues. Si le fichier source respecte ce modèle, l'étape 3 (mapping) est sautée automatiquement.

### 1.1 Liste des champs canoniques

| Ordre | Champ | Type | Obligatoire | Description |
| --- | --- | --- | --- | --- |
| 1 | `body` | text | **Oui** | Texte du témoignage, 50 à 600 caractères |
| 2 | `wouldRecommend` | enum | **Oui** | `oui` / `hesite` / `non` |
| 3 | `ritualTags` | string list | Non | Tags du catalogue, séparés par `,` ou `;` |
| 4 | `authorFirstName` | text | Non | Prénom, 1 à 30 caractères |
| 5 | `authorCity` | enum | Non | Ville Maroc (cf. catalogue) ou « Autre » |
| 6 | `initiatedSince` | date | Non | Format `YYYY-MM` |
| 7 | `isAnonymous` | boolean | Non | `true` / `false` / `0` / `1` |
| 8 | `language` | enum | Non | `fr` / `ar` |
| 9 | `productKey` | text | Non | Défaut : `pack-femiglow` |
| 10 | `photos` | string list | Non | Filenames (dans ZIP) ou URLs HTTPS, séparés par `,` ou `;` |
| 11 | `note_internal` | text | Non | Note interne, ignorée à la publication |

### 1.2 Champs auto-générés (ne pas inclure dans le fichier)

- `id`, `publicSlug`, `status`, `source`, `customerHash`, `orderId`, `verifiedPurchase`, `featured`, `autoFlags`, `createdAt`, `publishedAt`.

Ces champs sont systématiquement calculés ou laissés à leur valeur par défaut.

## 2. Template CSV (séparateur point-virgule)

### 2.1 Format

```csv
body;wouldRecommend;ritualTags;authorFirstName;authorCity;initiatedSince;isAnonymous;language;productKey;photos;note_internal
"Trois mois et l'ongle a retrouvé sa nervure. J'ai cessé de le forcer. Je remarque que les cuticules ont apaisé doucement.";oui;ongles-plus-lisses,plus-de-casse;Amal;Rabat;2026-02;false;fr;pack-femiglow;amal-001.jpg;
"Cinq minutes le soir, devenu un rituel. Je le fais avec ma tisane après le travail.";oui;rituel-devenu-habitude,mains-detendues;Yasmine;Rabat;2024-03;false;fr;pack-femiglow;;
"La paste donne un fini qui me ressemble. Naturel, sans vernis.";oui;eclat-naturel;Inès;Marrakech;2023-10;false;fr;pack-femiglow;;Témoignage récolté en boutique
"J'hésite encore. Les ongles sont plus lisses mais je voudrais essayer plus longtemps.";hesite;;;Casablanca;;true;fr;pack-femiglow;;
```

### 2.2 Règles CSV

- **Encodage** : UTF-8 obligatoire. BOM toléré.
- **Fin de ligne** : LF (`\n`) ou CRLF (`\r\n`).
- **Séparateur** : `;` (point-virgule) par défaut. `,` (virgule) supporté avec choix explicite.
- **Quoting** : double-quote `"` pour les champs contenant le séparateur, des sauts de ligne ou des `"` (doublés en `""`).
- **En-tête** : présente par défaut (case-insensitive matching).
- **Lignes vides** : ignorées.
- **Commentaires** : non supportés. Une ligne commençant par `#` est traitée comme donnée.

### 2.3 Cas particuliers CSV

| Cas | Traitement |
| --- | --- |
| Cellule contenant `;` | Mettre entre `"…"` |
| Cellule contenant `"` | Doubler : `""` à l'intérieur des `"…"` |
| Cellule contenant saut de ligne | Mettre entre `"…"` |
| `ritualTags` vide | Aucun tag |
| `photos` avec virgule séparatrice + autre séparateur dans valeur | Préférer le séparateur `;` interne : `"amal-1.jpg;amal-2.jpg"` |
| Champ booléen `isAnonymous` | Accepte : `true`, `false`, `True`, `False`, `1`, `0`, vide (= `false`) |
| Date `initiatedSince` invalide | Validation : `WARNING` (mappée à null) |

## 3. Template JSON

### 3.1 Format objet racine

```json
{
  "version": 1,
  "productKey": "pack-femiglow",
  "rituals": [
    {
      "body": "Trois mois et l'ongle a retrouvé sa nervure. J'ai cessé de le forcer. Je remarque que les cuticules ont apaisé doucement.",
      "wouldRecommend": "oui",
      "ritualTags": ["ongles-plus-lisses", "plus-de-casse"],
      "authorFirstName": "Amal",
      "authorCity": "Rabat",
      "initiatedSince": "2026-02",
      "isAnonymous": false,
      "language": "fr",
      "photos": ["amal-001.jpg"],
      "note_internal": null
    },
    {
      "body": "Cinq minutes le soir, devenu un rituel.",
      "wouldRecommend": "oui",
      "ritualTags": ["rituel-devenu-habitude"],
      "authorFirstName": "Yasmine",
      "authorCity": "Rabat",
      "initiatedSince": "2024-03",
      "isAnonymous": false,
      "language": "fr",
      "photos": []
    }
  ]
}
```

### 3.2 Format array racine (raccourci)

```json
[
  { "body": "...", "wouldRecommend": "oui", ... },
  { "body": "...", "wouldRecommend": "oui", ... }
]
```

Si l'array est à la racine, les `defaults` sont demandés à l'étape de mapping (productKey, language).

### 3.3 Règles JSON

- **Encodage** : UTF-8 obligatoire.
- **Strict mode** : pas de trailing commas, pas de commentaires (utiliser JSON5 hors-périmètre).
- **Tableau d'objets** ou objet racine avec clé `rituals`.
- **Types** :
  - `ritualTags` : `string[]` (pas `string`).
  - `photos` : `string[]`.
  - `isAnonymous` : `boolean` (pas `"true"`).
  - `initiatedSince` : `string` au format `YYYY-MM`.

### 3.4 Avantages JSON vs CSV

- Plus permissif pour les caractères spéciaux (apostrophes, guillemets, sauts de ligne dans body).
- Tableaux natifs pour tags / photos.
- Plus simple à générer depuis un export de Google Forms, Typeform, etc.

### 3.5 Inconvénients JSON vs CSV

- Pas éditable directement dans Excel / Google Sheets.
- Plus susceptible aux erreurs de syntaxe.

## 4. Template JSONL

### 4.1 Format

Un objet JSON par ligne, **pas d'array enveloppant** :

```
{"body":"Trois mois...","wouldRecommend":"oui","ritualTags":["ongles-plus-lisses"],"authorFirstName":"Amal","authorCity":"Rabat","initiatedSince":"2026-02","language":"fr"}
{"body":"Cinq minutes...","wouldRecommend":"oui","ritualTags":["rituel-devenu-habitude"],"authorFirstName":"Yasmine","authorCity":"Rabat","language":"fr"}
{"body":"...","wouldRecommend":"hesite","authorCity":"Casablanca","isAnonymous":true}
```

### 4.2 Usage

- **Idéal pour gros volumes** (> 200 rows) : streaming naturel.
- Limite augmentée : 1000 rows max et 10 Mo.

### 4.3 Règles

- Un objet par ligne, exactement.
- Lignes vides → ignorées.
- Ligne mal formée → row en `ERROR`, continue.

## 5. Template TSV

Identique à CSV mais séparateur tabulation `\t`.

```
body	wouldRecommend	ritualTags	authorFirstName	authorCity	initiatedSince	isAnonymous	language	photos
Trois mois...	oui	ongles-plus-lisses,plus-de-casse	Amal	Rabat	2026-02	false	fr	amal-001.jpg
```

Pratique pour copier-coller directement depuis Excel / Google Sheets sans risque de séparateur ambigu.

## 6. Template ZIP avec médias

### 6.1 Structure

```
rituels-import.zip
├── rituels.csv            (ou rituels.json)
├── photos/
│   ├── amal-001.jpg
│   ├── amal-002.jpg
│   ├── yasmine-001.jpg
│   └── ...
└── README.txt             (optionnel, ignoré)
```

### 6.2 Contraintes ZIP

| Contrainte | Valeur |
| --- | --- |
| Taille max archive | 50 Mo |
| Nombre max d'entries | 1 500 (rows + photos + autres fichiers) |
| Photos formats | JPEG, PNG, WebP, HEIC |
| Taille max par photo | 5 Mo |
| Dimensions min photo | 600 × 600 px |
| Dimensions max photo | 4000 × 4000 px |
| Profondeur d'archive | 1 niveau (pas de subdir > photos/) |
| Filenames photos | `^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp|heic)$` |
| Manifest | Doit s'appeler `rituels.csv`, `rituels.json`, ou `rituels.jsonl` |

### 6.3 Référencement des photos

Dans le CSV ou JSON, la colonne `photos` contient les **filenames sans chemin** :

```csv
photos
amal-001.jpg
amal-001.jpg;amal-002.jpg
yasmine-001.jpg
```

Le parseur cherche `photos/<filename>` dans le ZIP. Si introuvable → erreur sur la row.

### 6.4 Photos orphelines

Photos présentes dans `photos/` mais non référencées par aucune row → ignorées avec avertissement global. Pas d'erreur.

### 6.5 Avantages ZIP

- Tout dans un seul fichier.
- Pas besoin d'URLs publiques pour les médias.
- Permet un transport de batch complet par e-mail / cloud.

## 7. Stratégie URLs externes

Alternative au ZIP : les photos sont référencées par URL HTTPS. Le serveur les télécharge.

### 7.1 Format

```csv
body;...;photos
"Trois mois...";...;https://images.partner.com/amal-001.jpg
"Cinq minutes...";...;https://drive.google.com/uc?id=xyz&export=download
```

### 7.2 Contraintes

| Contrainte | Valeur |
| --- | --- |
| Protocole | HTTPS uniquement |
| Domaines whitelist | Configurable dans `app_config.import_allowed_domains` |
| Taille max par photo | 5 Mo |
| Timeout download | 10 sec par photo |
| Concurrence download | 5 photos simultanées max |

### 7.3 Avantages

- Pas de gros ZIP à uploader.
- Photos déjà stockées (Drive, CDN partenaire) restent leur source de vérité.

### 7.4 Inconvénients

- Réseau dépendant.
- Risque que l'URL expire après import.
- SSRF potentiel — d'où la whitelist obligatoire.

## 8. Catalogue de valeurs autorisées

### 8.1 `wouldRecommend`

| Valeur | Synonymes acceptés à l'import (mappés automatiquement) |
| --- | --- |
| `oui` | `yes`, `recommanderait`, `would_recommend`, `1`, `true` |
| `hesite` | `hesitant`, `unsure`, `maybe` |
| `non` | `no`, `pas pour moi`, `0`, `false` |

Insensible casse et accents. Synonymes appliqués au parsing, signalés par un avertissement « valeur normalisée ».

### 8.2 `ritualTags`

Tags du catalogue (cf. `↗ 12-microcopy-voix.md § 13`) :

```
ongles-plus-lisses
plaque-souple
cuticules-apaisees
plus-de-casse
eclat-naturel
rituel-devenu-habitude
mains-detendues
fini-brillant
halal
```

Tags inconnus → avertissement, ignorés (la row reste valide mais sans ce tag).

Synonymes acceptés (mappés) :

| Tag canonique | Synonymes |
| --- | --- |
| `ongles-plus-lisses` | « ongles lisses », « lisse » |
| `plaque-souple` | « ongles souples », « souplesse » |
| `eclat-naturel` | « brillance naturelle », « éclat » |
| `halal` | « certifié halal », « halal cosmétique » |

### 8.3 `authorCity`

Villes du Maroc reconnues :

```
Rabat, Casablanca, Salé, Tanger, Marrakech, Fès, Agadir, Oujda, Tétouan, Meknès, Kénitra
```

Toute autre valeur → mappée sur `Autre` avec avertissement.

### 8.4 `language`

`fr` (défaut) ou `ar`.

### 8.5 `initiatedSince`

Format `YYYY-MM`. Range valide : `2023-01` à mois courant.

Formats alternatifs acceptés (avec avertissement de normalisation) :

| Input | Normalisé |
| --- | --- |
| `02/2026` | `2026-02` |
| `Feb 2026` | `2026-02` |
| `February 2026` | `2026-02` |
| `2026-02-15` | `2026-02` (jour ignoré) |
| `2026` | `2026-01` avec avertissement |

## 9. Validation détaillée par champ

### 9.1 `body`

| Règle | Niveau |
| --- | --- |
| Présent | Error si vide |
| ≥ 50 caractères (post-sanitization) | Error si trop court |
| ≤ 600 caractères | Error si trop long |
| Sanitization automatique (emoji, espaces, apostrophes) | Toujours |
| Auto-flags appliqués (link_external, all_caps, etc.) | Warning si flags critiques |

### 9.2 `wouldRecommend`

| Règle | Niveau |
| --- | --- |
| Présent | Error si vide |
| Valeur valide après synonymes | Error si non reconnu |

### 9.3 `ritualTags`

| Règle | Niveau |
| --- | --- |
| Max 3 tags | Warning si > 3 (tronqué aux 3 premiers) |
| Tags du catalogue | Warning si inconnu (ignoré) |

### 9.4 `authorFirstName`

| Règle | Niveau |
| --- | --- |
| 1 à 30 caractères | Warning si > 30 (tronqué) |
| Caractères valides : lettres, espaces, apostrophes, traits d'union | Warning sinon (nettoyé) |
| Vide → anonymat par défaut | OK |

### 9.5 `authorCity`

| Règle | Niveau |
| --- | --- |
| Ville du catalogue | OK |
| Vide | OK (signature « Une initiée ») |
| Ville inconnue | Warning, mappée sur « Autre » |

### 9.6 `photos`

| Règle | Niveau |
| --- | --- |
| Filename valide (ZIP) | Error si introuvable dans archive |
| URL HTTPS whitelist (URLs externes) | Error si protocole / domaine invalide |
| Mime image | Error si autre type |
| Taille ≤ 5 Mo | Error si dépassement |
| Dimensions ≥ 600 px | Error si trop petite |
| Vision ML faces | Error si `REJECTED_FACE`, Warning si `MANUAL_REVIEW` |

## 10. Téléchargement des templates depuis l'UI

### 10.1 Boutons disponibles

Sur `/admin/rituals/import` étape 1 :

```
[Télécharger un modèle CSV →]      ← format=csv, separator=semicolon
[Télécharger un modèle CSV (virgule) →]  ← format=csv-comma
[Télécharger un modèle TSV →]      ← format=tsv
[Télécharger un modèle JSON →]     ← format=json
[Télécharger un modèle JSONL →]    ← format=jsonl
[Télécharger un exemple ZIP →]     ← format=zip (avec 2-3 photos exemples)
```

### 10.2 Endpoint

`GET /api/admin/rituals/import/template?format={format}`.

Réponse :

```
200 OK
Content-Type: text/csv; charset=utf-8 (ou autre selon format)
Content-Disposition: attachment; filename="rituels-modele-2026-05-11.csv"

<contenu>
```

### 10.3 Contenu de chaque template

- **CSV / TSV** : en-têtes + 4 lignes d'exemple représentant les 4 cas (valide complet, valide minimal, anonyme, hesite).
- **JSON / JSONL** : 3 objets d'exemple.
- **ZIP** : `rituels.csv` + dossier `photos/` avec 2 images placeholders (mains-cream-1.jpg, mains-cream-2.jpg). Les images sont fournies par la maison (~ 100 ko chacune pour ne pas alourdir).

### 10.4 Versioning des templates

Chaque template inclut un commentaire d'en-tête (header) :

```
# FemiGlow — Rituels partagés — Modèle d'import CSV
# Version : 1
# Date : 2026-05-11
# Documentation : https://femiglow-maroc.com/admin/rituals/import/help
```

Si le schéma change (ajout d'un champ), incrémenter la version. Les anciens templates restent compatibles (champs manquants → valeurs par défaut).

## 11. Page d'aide

`/admin/rituals/import/help` (route admin protégée par `requireAdmin()`) :

- Tableau des champs canoniques avec types, contraintes, exemples.
- Section « Formats acceptés » avec un exemple par format.
- Section « Catalogues de valeurs » (signal, tags, villes).
- Section « Médias et ZIP » avec structure attendue.
- Liens de téléchargement des templates.
- Lien vers `/admin/rituals/import` pour démarrer.

Contenu en Markdown stocké dans `app_config.rituals_import_help_md`, éditable.

## 12. Exemples concrets de cas d'usage

### 12.1 Cas A — Import minimal sans photos

CSV avec uniquement `body` et `wouldRecommend` :

```csv
body;wouldRecommend
"Trois mois et l'ongle a retrouvé sa nervure. J'ai cessé de le forcer.";oui
"Cinq minutes le soir, devenu un rituel agréable.";oui
```

Tous les autres champs → défauts (anonymat, language fr, productKey pack-femiglow).

### 12.2 Cas B — Import depuis Google Forms

Google Forms export en CSV avec en-têtes français. Mapping nécessaire à l'étape 3 :

```csv
Horodateur;Votre prénom;Votre ville;Que diriez-vous de votre rituel ?;Recommanderiez-vous ?;Photo (optionnelle)
"2026-04-12 14:32:00";Amal;Rabat;"Trois mois et l'ongle...";Oui, sans hésiter;https://drive.google.com/...
```

Mapping :

```
Horodateur → (ignorer)
Votre prénom → authorFirstName
Votre ville → authorCity
Que diriez-vous... → body
Recommanderiez-vous ? → wouldRecommend  (synonyme "Oui, sans hésiter" → "oui")
Photo (optionnelle) → photos[0]  (URL externe)
```

### 12.3 Cas C — Import ZIP avec photos en boutique

Souheila a fait un shoot en boutique avec 50 initiées. Elle exporte un CSV depuis sa note Numbers et zippe les photos correspondantes :

```
import-mai-2026.zip
├── rituels.csv         (50 rows)
└── photos/             (75 photos, certaines initiées ont 2 photos)
```

Import → étape 2 upload → vision ML sur 75 photos en arrière-plan (~ 90 sec) → étape 4 preview avec photos liées → commit.

### 12.4 Cas D — Migration depuis ancien outil

Export JSON depuis une plateforme tierce. Format différent du canonique :

```json
[
  {
    "id": "old-001",
    "review_text": "Trois mois et l'ongle...",
    "stars": 5,
    "user": { "name": "Amal", "location": "Rabat-Hassan" },
    "tags": ["nail-care", "long-lasting"],
    "date_initial": "2026-02-15"
  }
]
```

Souheila uploade et mappe :

```
review_text → body
stars (5) → wouldRecommend (5 = oui ; 4-3 = hesite ; 2-1 = non)  (transformation par règle)
user.name → authorFirstName
user.location → authorCity (« Rabat-Hassan » → mappé à « Rabat »)
tags → ritualTags (tags inconnus ignorés avec avertissement)
date_initial → initiatedSince
```

Ce cas est plus complexe et peut nécessiter un **script de pré-transformation** côté Souheila avant import (à recommander dans la doc).

## 13. Anti-patterns à éviter

| Anti-pattern | Pourquoi |
| --- | --- |
| Importer des centaines de rows en `APPROVED` directement | Bypasse la modération, casse la voix maison |
| Mélanger images de visages et de mains | Vision ML les sépare, mais c'est mieux de filtrer à la source |
| Réutiliser un même filename de photo pour 2 rows | Une photo = un rituel ; sinon, dupliquer la photo dans le ZIP |
| Importer sans avoir téléchargé le modèle | Risque élevé d'erreur de format ; le wizard refuse de bypass étape 1 |
| Importer le même fichier deux fois | Le dedup `row_hash` détecte ; warning sur la 2e tentative |
| Embarquer des secrets dans `note_internal` | Cette colonne est admin-only mais auditée |

## 14. Synthèse — règles d'or formats

1. **6 formats supportés** : CSV (`;`), CSV (`,`), TSV, JSON, JSONL, ZIP.
2. **Modèle canonique unique** ; mapping optionnel si les en-têtes diffèrent.
3. **UTF-8 obligatoire**, BOM toléré.
4. **Limites strictes** : 500 rows / 5 Mo CSV / 50 Mo ZIP.
5. **Synonymes intelligents** sur `wouldRecommend`, `ritualTags`, dates.
6. **Photos par filename (ZIP) ou URL HTTPS** (whitelist).
7. **Templates téléchargeables** depuis l'UI dans tous les formats.
8. **Versioning des templates** dans l'en-tête fichier.
9. **Vision ML systématique** sur toute photo importée.
10. **Page d'aide intégrée** `/admin/rituals/import/help` éditable.
