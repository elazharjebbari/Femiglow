# Matrice comparative des 3 prototypes — décision

Ce document compare les prototypes A, B, C selon 14 critères pondérés, puis propose une recommandation argumentée.

## 1. Présentation synthétique

| | A — Paroi narrative | B — Cartographie des rituels | C — Mur éditorial filtré |
| --- | --- | --- | --- |
| **Forme** | Drawer / bottom-sheet | Page dédiée + cartographie typo | Page dédiée + module compact |
| **Surface d'entrée** | `/kit` (lien texte) | Footer + lien `/kit` + lien `/rituel` | Module sur `/kit` + page dédiée + footer |
| **URL changeable** | Non | Oui | Oui |
| **Mécanique cœur** | Liste verticale chronologique | Cartographie typo cliquable | Sidebar filtres + grid |
| **CTA pack** | Sticky bas du drawer | Pied de page | Module et pied de page |
| **Effort dev** | ~19 j | ~25 j | ~32 j |

## 2. Matrice critères × prototypes

Chaque critère noté de 1 à 5. Poids exprimé sur 5.

| Critère | Poids | A | B | C | Notes |
| --- | --- | --- | --- | --- | --- |
| **Conversion attendue** | 5 | 4 | 2 | 5 | C couvre les deux moments (fiche + page) |
| **Préservation de la voix maison** | 5 | 4 | 5 | 3 | B est le plus identitaire, C le plus standard |
| **Charge cognitive utilisateur** | 4 | 5 | 2 | 3 | A est immédiat, B exige interprétation |
| **Mobile-first qualité** | 4 | 5 | 3 | 4 | A bottom-sheet idiomatique |
| **SEO long-tail** | 3 | 1 | 4 | 5 | C indexe filtres |
| **Partageabilité (URL)** | 3 | 1 | 4 | 5 | A pas d'URL |
| **Scalabilité (à 100+ témoignages)** | 4 | 2 | 4 | 5 | A devient long |
| **Effet halo marque (différenciation)** | 3 | 3 | 5 | 2 | B est le plus unique |
| **Effort initial de mise en œuvre** | 4 | 5 | 3 | 2 | A le plus rapide |
| **Maintenance et curation** | 3 | 5 | 4 | 3 | C demande discipline `featured` |
| **A/B testable** | 3 | 5 | 2 | 4 | A facile vs sans wall |
| **Volume initial requis pour publier** | 3 | 5 | 2 | 3 | A fonctionne à 5 témoignages |
| **Accessibilité a11y** | 4 | 5 | 3 | 4 | A drawer accessible standard, B cartographie complexe |
| **Risque éditorial (banalisation marque)** | 3 | 5 | 5 | 2 | C ressemble à Sephora |

### 2.1 Score brut (somme × poids)

| | A | B | C |
| --- | --- | --- | --- |
| Conversion (5) | 20 | 10 | 25 |
| Voix maison (5) | 20 | 25 | 15 |
| Charge cognitive (4) | 20 | 8 | 12 |
| Mobile (4) | 20 | 12 | 16 |
| SEO (3) | 3 | 12 | 15 |
| Partageabilité (3) | 3 | 12 | 15 |
| Scalabilité (4) | 8 | 16 | 20 |
| Halo marque (3) | 9 | 15 | 6 |
| Effort initial (4) | 20 | 12 | 8 |
| Maintenance (3) | 15 | 12 | 9 |
| A/B test (3) | 15 | 6 | 12 |
| Volume initial (3) | 15 | 6 | 9 |
| A11y (4) | 20 | 12 | 16 |
| Risque banalisation (3) | 15 | 15 | 6 |
| **Total** | **203** | **173** | **184** |

### 2.2 Lecture du score

- **A — Paroi narrative** mène : 203 / 250.
- **C — Mur éditorial filtré** second : 184 / 250. Pénalisé par l'effort initial, le risque de banalisation, et le volume requis.
- **B — Cartographie des rituels** dernier : 173 / 250. Excellent sur la voix et la différenciation, mais pénalise la conversion immédiate et l'accessibilité.

## 3. Forces et faiblesses qualitatives — relecture

### 3.1 Prototype A — Paroi narrative

**Forces décisives** :
- Conversion à proximité du moment d'achat.
- Charge cognitive minimale, mobile excellent.
- Implémentable en 3 semaines (le moins coûteux).
- Voix maison parfaitement portée par un drawer éditorial sobre.
- Fonctionne dès 5 témoignages.

**Faiblesses décisives** :
- Pas d'URL partageable → un témoignage marquant ne peut pas être pointé sur WhatsApp ou Instagram.
- SEO marginal — le contenu n'enrichit pas l'index Google.
- Scalabilité limitée à ~50 témoignages avant que la liste devienne longue.

### 3.2 Prototype B — Cartographie des rituels

**Forces décisives** :
- Différenciation marque la plus marquée — le wall devient un objet éditorial citable.
- Signal marketing fort sur les motifs d'achat (tag → conversion).
- SEO long-tail par tag.

**Faiblesses décisives** :
- Friction d'entrée trop élevée pour les personas en hésitation.
- Distance au CTA pack rompt la conversion immédiate.
- A11y plus complexe (cartographie typographique).
- Demande un volume minimal de témoignages (≥ 15) avant publication crédible.

### 3.3 Prototype C — Mur éditorial filtré

**Forces décisives** :
- Double couverture (module compact + page dédiée) couvre les deux moments.
- SEO actif, URL avec params, OG images dédiées.
- Scalabilité indéfinie (jusqu'à des milliers de témoignages).

**Faiblesses décisives** :
- Le plus long à implémenter (~32 j).
- Risque de banalisation marque — un mur avec sidebar et filtres ressemble à Sephora.
- Demande une discipline éditoriale (curation `featured`) qui n'est pas garantie au lancement.

## 4. Recommandation

### 4.1 Décision retenue : **Prototype A — Paroi narrative**, enrichi de **deux emprunts au Prototype C**

Le score brut (A : 203 > C : 184 > B : 173) confirme l'intuition : pour FemiGlow au stade actuel (lancement, < 30 témoignages), la **paroi narrative** est l'option dominante. Mais deux mécaniques du prototype C sont précieuses et peuvent être intégrées sans alourdir A :

1. **Module compact `/kit` (3 cartes curées)** — emprunt à C, en plus du drawer. Le module compact donne la **proof immédiate** au-dessus du pli sur la fiche, sans demander de clic. Le drawer A reste accessible pour qui veut lire en profondeur.
2. **URL d'état du drawer** (`/kit?wall=open` ou `?wall=card-{id}`) — emprunt à C. Permet de pointer une carte précise depuis Instagram ou WhatsApp. Implémentation : push history state à l'ouverture, lire le param au mount.

### 4.2 Ce que ce choix sacrifie

- **SEO long-tail** : un mur drawer n'enrichit pas l'index Google. À accepter au stade actuel ; les articles du journal (`/journal/*`) portent l'effort SEO.
- **Cartographie typographique** : sacrifiée. Élément à reprendre, peut-être, dans le journal — un article « Les voix de la maison » avec cartographie pourrait être un livrable B2B / presse séparé.
- **Page dédiée `/rituels-partages`** : aucun lancement immédiat. À envisager **Phase 2**, quand le volume atteint ~50 témoignages.

### 4.3 Comment réagir si l'A/B test échoue

Si après 4 semaines de prod, le drawer A ne montre pas d'effet positif sur l'add-to-cart, basculer sur C (page dédiée + module compact étendu). Le schéma BDD et l'admin sont communs aux trois prototypes — la bascule est essentiellement front.

## 5. Décision finale et engagement

**Le prototype retenu est A enrichi de deux mécaniques de C.** Le détail complet de la proposition figure dans `07-proposition-finale.md`. Les documents 08 à 18 spécifient l'implémentation.

| Élément | Origine |
| --- | --- |
| Drawer / bottom-sheet | Prototype A |
| Synthèse en tête (volume + signal + insights tagués) | Prototype A |
| Filtres minimaux (Tous / Avec photos / Halal / Récents) | Prototype A |
| Liste verticale + pagination explicite | Prototype A |
| CTA sticky bas | Prototype A |
| **Module compact 3 cartes sur `/kit`** | **Prototype C** |
| **URL d'état (push history)** | **Prototype C** |
| Wizard de soumission 3 étapes | Commun |
| Admin queue + détail + actions + featured | Commun |
| E-mail J+45 | Commun |

Le wizard, l'admin et la BDD sont **identiques aux trois prototypes** — c'est l'UI publique qui change. Ce qui rend la décision **réversible à faible coût** : seul le front du wall change si on bascule plus tard sur C.
