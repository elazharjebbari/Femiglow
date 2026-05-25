import { createLogger } from '../utils/logger';
import { seedDefaultCollections, getCollection } from './collections';
import { ingestText } from './ingestion';

const log = createLogger('knowledge:seed');

export async function seedKnowledgeBase(): Promise<{ collections: number; documents: number; errors: string[] }> {
  const startTime = Date.now();
  const errors: string[] = [];
  let documentCount = 0;

  log.info('Starting knowledge base seed');

  const collections = await seedDefaultCollections();

  for (const [slug, documents] of Object.entries(SEED_DOCUMENTS)) {
    const collection = collections.find((c) => c.slug === slug);
    if (!collection) {
      errors.push(`Collection ${slug} not found`);
      continue;
    }

    if (collection.documentCount > 0) {
      log.info('Collection already has documents, skipping', { slug, existingDocs: collection.documentCount });
      continue;
    }

    for (const doc of documents) {
      const result = await ingestText(collection.id, doc.title, doc.content, doc.metadata);
      if (result.success) {
        documentCount++;
      } else {
        errors.push(`Failed to ingest "${doc.title}" in ${slug}: ${result.error}`);
      }
    }
  }

  const durationMs = Date.now() - startTime;
  log.info('Knowledge base seed completed', {
    collections: collections.length,
    documents: documentCount,
    errors: errors.length,
    durationMs,
  });

  return { collections: collections.length, documents: documentCount, errors };
}

interface SeedDocument {
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
}

const SEED_DOCUMENTS: Record<string, SeedDocument[]> = {
  'brand-femiglow': [
    {
      title: 'Identite de marque FemiGlow',
      metadata: { category: 'brand-identity', priority: 'critical' },
      content: `FemiGlow — Maison de soin japonaise pour les ongles et les mains.

Mission : Reveler l'eclat naturel des ongles et des mains a travers des rituels de soin inspires de la tradition japonaise. Nous croyons que la beaute des mains est un geste de soin envers soi-meme, pas une performance cosmetique.

Valeurs fondamentales :
1. Le geste avant le resultat : Chaque application est un rituel, pas une corvee. La precision et la patience sont au coeur de notre philosophie. Le processus de soin est aussi important que le resultat visible.
2. Beaute japonaise authentique (J-Beauty) : Minimalisme, ingredients naturels, respect de la peau. Nous puisons dans des siecles de savoir-faire japonais en matiere de soin. La simplicite est une force, pas un compromis.
3. Eclat naturel sans vernis ni abrasion : Nos soins revelent la beaute qui existe deja. Pas de couche de couleur, pas de ponçage agressif. L'ongle sain brille de lui-meme.
4. Transmission et attention discrete : Le soin des mains est un acte intime qui se transmet. Nous valorisons le partage discret, le bouche-a-oreille, la recommandation sincere.

Ton editorial :
- Francais elegant, sobre, sensoriel. Chaque mot est choisi pour sa precision et sa musicalite.
- Jamais d'emoji dans les communications officielles.
- Jamais de point d'exclamation. L'enthousiasme se traduit par la qualite du propos, pas par la ponctuation.
- Aucune urgence commerciale : pas de "Vite !", pas de "Derniere chance", pas de compte a rebours. La beaute japonaise ne se presse pas.
- Aucune promesse medicale ou dermatologique non prouvee.
- Vocabulaire cle : geste, rituel, eclat, lumiere, precision, patience, soin, douceur, naturel, reveler, camellia, tsubaki.
- Vocabulaire interdit : revolutionnaire, miracle, anti-age, rajeunir, detox, scientifiquement prouve (sauf si etude citee), magique, incroyable, extraordinaire, secret, exclusif.

Positionnement prix : Premium accessible. Le kit est un investissement dans un rituel, pas un achat impulsif. Le prix se justifie par la qualite des ingredients japonais et la durabilite du rituel.

Audience primaire : Femmes 28-45 ans, sensibles au bien-etre, a la beaute clean, curieuses de la culture japonaise. Elles preferent la qualite a la quantite, recherchent de l'authenticite et rejettent le marketing agressif.

Audience secondaire : Offre cadeau. Les mains sont un cadeau universel et delicat. Le packaging et l'experience d'unboxing sont penses comme un present.

Concurrents a ne jamais mentionner : Aucune reference directe a un concurrent. Nous ne nous definissons pas en opposition, mais en affirmation de notre propre identite.`,
    },
    {
      title: 'Catalogue produits FemiGlow',
      metadata: { category: 'products', priority: 'critical' },
      content: `Catalogue produits FemiGlow — Reference complete.

PRODUIT PHARE : Kit de Soin FemiGlow
Le kit complet pour un rituel de soin des ongles et des mains a la japonaise. Il comprend :
- Huile de camellia (Tsubaki Oil) 15ml : Huile de premiere pression a froid issue des graines de camellia japonica. Nourrit la cuticule et l'ongle en profondeur. Texture seche non grasse, absorption rapide. Parfum delicat de fleur de camellia.
- Creme mains au riz (Komenuka Hand Cream) 50ml : Formulee avec de l'extrait de son de riz japonais, riche en gamma-oryzanol et ceramides vegetales. Hydrate sans effet gras, laisse un film protecteur soyeux. Convient aux mains sensibles.
- Polissoir en cuir de chamois : Outil traditionnel japonais pour le lustre naturel de l'ongle. Quatre faces de grain decroissant pour un polissage progressif. Donne un eclat miroir sans vernis en 3-4 minutes par ongle. Dure 12 a 18 mois avec un entretien minimal.
- Repoussoir a cuticules en buis : Bois de buis japonais, plus doux que le metal pour ne pas agresser la cuticule. Forme ergonomique pour un geste precis. Se desinfecte simplement a l'eau savonneuse.
- Guide du rituel illustre : Livret de 16 pages expliquant le rituel en 5 etapes. Illustre a la main dans un style wabi-sabi. Inclut des conseils d'entretien et un calendrier de soin mensuel.

INGREDIENTS JAPONAIS HERO :
1. Huile de Camellia (Tsubaki) : Ingredient phare de la beaute japonaise depuis le 8e siecle. Riche en acide oleique (85%), vitamine E et squalane naturel. Utilisee par les geishas pour les cheveux, la peau et les ongles. Proprietes emollientes et protectrices exceptionnelles.
2. Extrait de Riz (Komenuka) : Le son de riz est un tresor de la beaute japonaise. Les femmes des campagnes japonaises utilisaient l'eau de rinçage du riz pour leur peau. Riche en gamma-oryzanol, ferulic acid, et ceramides vegetales. Action hydratante, eclaircissante et anti-oxydante.
3. Matcha : Catechines et EGCG a forte concentration. Action antioxydante 137 fois superieure au the vert classique. Protege les cellules de la matrice de l'ongle contre le stress oxydatif.
4. Yuzu : Agrume japonais au parfum unique. Riche en vitamine C (3 fois plus que le citron). Action eclaircissante et tonifiante sur la peau des mains.
5. Sakura (Fleur de cerisier) : Extrait riche en cafeoylglucose et quercetine. Proprietes anti-glycation qui maintiennent la souplesse de la peau. Symbole du renouveau et de la beaute ephemere.
6. Huile de Sake (Nihonshu) : Sous-produit de la fermentation du riz a saké. Contient des kojic acid et arbutin naturels. Action unifiante sur le teint des mains. Texture legere et penetration rapide.

RITUELS RECOMMANDES :
- Rituel quotidien (5 min) : Application de l'huile de tsubaki sur chaque ongle et cuticule. Massage doux circulaire pendant 30 secondes par doigt.
- Rituel hebdomadaire (15 min) : Bain de mains tiede (pas chaud) 5 minutes. Repoussage delicat des cuticules. Polissage 4 faces. Application huile + creme.
- Rituel mensuel (30 min) : Rituel hebdomadaire complet + masque mains au komenuka. Temps de pose 10 minutes sous gants coton.`,
    },
    {
      title: 'Philosophie J-Beauty et storytelling',
      metadata: { category: 'storytelling', priority: 'high' },
      content: `Philosophie J-Beauty appliquee a FemiGlow — Angles de storytelling.

La J-Beauty (Japanese Beauty) est fondee sur des principes distincts de la K-Beauty (Korean Beauty) ou de la beaute occidentale. Comprendre ces differences est essentiel pour notre storytelling.

PRINCIPES J-BEAUTY :
1. Mottainai (ne rien gaspiller) : Chaque ingredient est utilise a son plein potentiel. Le son de riz, sous-produit de la production de riz blanc, devient un tresor cosmetique. L'huile de sake, residue de la fermentation, nourrit la peau. Nos produits incarnent ce respect de la matiere.
2. Wabi-Sabi (beaute de l'imperfection) : La perfection n'est pas l'objectif. Des ongles sains et brillants, avec leurs petites variations naturelles, sont plus beaux que des ongles artificiellement uniformes. Nos visuels montrent des mains reelles, avec du caractere.
3. Ichigo Ichie (chaque moment est unique) : Le rituel de soin est un moment de presence a soi. On ne "fait ses ongles" pas par obligation mais par attention a soi. Chaque session est differente, chaque jour les mains ont des besoins differents.
4. Kanso (simplicite) : Peu de produits, bien choisis, utilises correctement. La routine J-Beauty des ongles n'a pas 12 etapes. Elle en a 3 a 5, maitrisees parfaitement.
5. Ma (espace negatif) : Le temps de pause fait partie du soin. Laisser l'huile penetrer, laisser les mains au repos, ne pas enchainer les gestes. Dans notre contenu, le silence visuel (espaces blancs, compositions aerees) traduit ce principe.

ANGLES DE STORYTELLING PAR PILIER DE CONTENU :
Pilier "Rituel" : Montrer le geste, pas le resultat. Filmer les mains en mouvement, le versement de l'huile, le polissage lent. Le son ASMR du polissoir sur l'ongle. La lumiere qui change sur l'ongle au fil du polissage. Angle narratif : "C'est dans le geste que la beaute se revele."
Pilier "Produit" : Mettre en scene les ingredients dans leur contexte culturel. Un champ de camellias a Izu, une riziere au lever du soleil, un atelier de sake a Fushimi. Montrer la texture, la couleur, la consistance. Angle narratif : "Chaque ingredient porte des siecles de sagesse."
Pilier "Education" : Expliquer pourquoi les ongles ternissent, pourquoi les cuticules se dessechent, comment fonctionne la keratine. Vulgarisation elegante, jamais condescendante. Angle narratif : "Comprendre ses ongles, c'est deja en prendre soin."
Pilier "Temoignage" : Laisser parler les mains. Photos UGC de mains apres 4 semaines de rituel. Pas de before/after agressif, mais une progression douce. Angle narratif : "Chaque paire de mains raconte une histoire."

DIFFERENCIATEURS CLE POUR LE CONTENU :
- FemiGlow vs. Vernis : Nous ne cachons pas l'ongle, nous le revelons. Pas de couche, pas de chimie, pas de lampe UV.
- FemiGlow vs. Manucure salon : Le soin des mains a domicile est un acte d'autonomie et de connaissance de soi. Pas besoin d'un rendez-vous pour prendre soin de ses mains.
- FemiGlow vs. Beaute occidentale : Moins de produits, plus de geste. Moins de promesses, plus de patience. Moins de performance, plus de presence.
- FemiGlow vs. K-Beauty : La J-Beauty est plus minimaliste, moins orientee "glass skin" et performance visible. L'eclat japonais est subtil, interne, lumineux sans etre brillant.`,
    },
    {
      title: 'Identite visuelle et direction artistique',
      metadata: { category: 'visual-identity', priority: 'high' },
      content: `Direction artistique FemiGlow — Guidelines visuelles pour le contenu.

PALETTE DE COULEURS :
- Creme chaud (#F5F0E8) : Couleur de fond principale. Evoque le washi (papier japonais), la douceur, le naturel.
- Sauge (#B2BDA0) : Couleur d'accent secondaire. Evoque les jardins japonais, le matcha, la serenite.
- Blanc chaud (#FEFCF7) : Pour les espaces de respiration. Jamais de blanc pur (#FFFFFF) qui est trop clinique.
- Rose poudre (#E8D5CE) : Accent delicat pour les elements feminins. Evoque la fleur de cerisier sans etre enfantin.
- Terracotta doux (#C4A882) : Pour les elements de terre, d'ancrage. Evoque le kintsugi, la ceramique japonaise.
- Encre sumi (#2C2C2C) : Pour le texte principal. Jamais du noir pur (#000000). L'encre sumi a une chaleur.

TYPOGRAPHIE :
- Titres : Serif elegant a empattements fins. Style editorial japonais modernise.
- Corps : Sans-serif humaniste, lisible, aeree. Interlignage genereux (1.6 a 1.8).
- Pas de majuscules stylisees. Le texte respire en minuscules.

PHOTOGRAPHIE :
- Lumiere naturelle exclusivement. Lumiere du matin ou du soir (golden hour). Jamais de flash, jamais d'eclairage studio dur.
- Tons chauds : balance des blancs legerement chaude (5800-6200K).
- Sujets principaux : mains, produits, textures, ingredients. Gros plans et plans serres privilegies.
- Compositions : centrees ou regle des tiers. Espaces negatifs genereux (principe du Ma).
- Style minimal japonais : peu d'elements dans le cadre, chaque objet a sa place.
- Arriere-plans : surfaces naturelles (bois clair, pierre, lin, ceramique). Jamais de fond clinique blanc.
- Profondeur de champ : faible (f/1.8-2.8) pour isoler le sujet avec un bokeh doux.

VIDEO / REELS :
- Mouvements lents et deliberes. Pas de transitions brutales.
- Musique : ambient japonaise, piano minimal, sons naturels (eau, bois, tissu). Jamais de beats agressifs.
- Rythme : plus lent que la moyenne des Reels beaute. Notre differentiation est dans la lenteur deliberee.
- Texte a l'ecran : minimal, en creme sur fond sombre ou en sumi sur fond clair. Typographie coherente.
- Duree ideale : 15-30 secondes pour les Reels, 45-60 secondes pour les tutoriels.

INTERDITS VISUELS :
- Filtres Instagram/TikTok sur les mains ou les produits (les filtres trahissent notre promesse de naturel).
- Neon, couleurs saturees, contrastes agressifs.
- Stock photos generiques de mains.
- Emojis dans les visuels.
- Logos ou watermarks visibles (sauf mention legale obligatoire).
- Esthetique "clinique" ou "laboratoire".
- Before/after avec des angles differents ou des lumieres differentes (manipulation visuelle).`,
    },
  ],

  neuromarketing: [
    {
      title: 'Biais cognitifs pour le contenu beaute',
      metadata: { category: 'cognitive-biases', priority: 'high' },
      content: `Biais cognitifs applicables a la creation de contenu beaute — Reference operationnelle.

1. PREUVE SOCIALE (Social Proof) — Robert Cialdini
Principe : Les individus imitent les comportements observes chez les autres, surtout en situation d'incertitude. En beaute, le choix d'un produit est souvent guide par ce que font "les autres femmes comme moi".
Application contenu FemiGlow :
- UGC (User Generated Content) : Montrer des clientes reelles utilisant le rituel. Pas des influenceuses parfaites, mais des mains ordinaires qui brillent.
- Chiffres de communaute : "3 200 femmes pratiquent deja le rituel FemiGlow" est plus persuasif que "le meilleur soin pour les ongles".
- Temoignages specifiques : "Apres 3 semaines, mes ongles cassants sont devenus souples" est plus credible que "resultats incroyables".
- En caption Instagram : commencer par une observation sociale ("Vous avez remarque que les Japonaises ont des ongles naturellement lumineux ?").

2. RARETE (Scarcity) — Kahneman & Tversky
Principe : La valeur perçue augmente quand la disponibilite diminue. Attention : chez FemiGlow, nous n'utilisons PAS la rarete artificielle (pas de "Plus que 3 en stock !"). Nous utilisons la rarete authentique.
Application contenu FemiGlow :
- Rarete d'ingredient : "L'huile de tsubaki de premiere pression est recoltee une seule fois par an, en automne, dans la region d'Izu."
- Rarete culturelle : "Ce geste de polissage se transmet de mere en fille au Japon depuis des generations."
- Rarete temporelle naturelle : edition saisonniere sakura au printemps, yuzu en hiver. Pas d'urgence artificielle, mais un calendrier naturel.

3. ANCRAGE (Anchoring) — Tversky & Kahneman
Principe : La premiere information reçue sert de reference pour toutes les evaluations suivantes.
Application contenu FemiGlow :
- Ancrer sur le cout d'un soin en salon (40-60 euros/seance) avant de presenter le kit (prix unique pour des mois de rituel).
- Ancrer sur la duree de vie du polissoir (12-18 mois) pour relativiser l'investissement initial.
- Dans les Reels educatifs : commencer par une statistique surprenante ("80% des femmes ne prennent jamais soin de leurs cuticules") pour ancrer le besoin.

4. EFFET DE HALO (Halo Effect) — Edward Thorndike
Principe : L'impression positive d'un attribut se transfere aux autres attributs. Un packaging elegant fait percevoir le produit comme plus efficace.
Application contenu FemiGlow :
- La qualite du contenu (photo, video, copy) transfere directement sur la perception du produit. Un Reel mal eclaire fait douter de la qualite de l'huile.
- Le storytelling culturel japonais (artisanat, tradition, nature) cree un halo de qualite et d'authenticite.
- L'experience d'unboxing soignee (papier de soie, guide illustre, parfum delicat) cree un halo qui influence l'efficacite perçue du soin.

5. EFFET IKEA (IKEA Effect) — Norton, Mochon & Ariely
Principe : Les individus valorisent davantage ce qu'ils ont contribue a creer ou realiser eux-memes.
Application contenu FemiGlow :
- Le rituel est un "faire soi-meme" : la cliente est l'artisane de ses propres ongles. Ce n'est pas un produit qu'on applique passivement, c'est un geste qu'on maitrise.
- Contenu tutoriel interactif : "Essayez cette technique de polissage et partagez votre resultat" active l'effet IKEA.
- Encourager la personnalisation du rituel : "Certaines preferent l'huile avant le polissage, d'autres apres. Trouvez votre propre sequence."

6. BIAIS DE FAMILIARITE (Mere Exposure Effect) — Robert Zajonc
Principe : La repetition d'un stimulus augmente la preference. Plus on voit quelque chose, plus on l'apprecie.
Application contenu FemiGlow :
- Coherence visuelle absolue entre tous les posts. Meme palette, meme style photo, meme typographie. La grille Instagram est un tout.
- Repetition des gestes cles dans differents formats : le versement de l'huile de tsubaki, le mouvement de polissage, le gros plan sur l'ongle brillant.
- Frequence de publication reguliere : la disparition du feed est plus dommageable que un post imparfait.`,
    },
    {
      title: 'Triggers emotionnels pour le partage',
      metadata: { category: 'emotional-triggers', priority: 'high' },
      content: `Triggers emotionnels pour le partage de contenu — Modele de Berger & Milkman (2012).

Jonah Berger et Katherine Milkman ont identifie que le contenu le plus partage active des emotions a forte activation (high arousal). Leur recherche sur 7 000 articles du New York Times a revele que le partage est correle a l'intensite emotionnelle, pas a la valence (positive/negative).

EMOTIONS A FORTE ACTIVATION (declenchent le partage) :
1. Emerveillement (Awe) : L'emotion la plus correlée au partage. Le sentiment d'etre face a quelque chose de plus grand que soi, qui elargit notre vision du monde.
Application FemiGlow : La beaute d'un ingredient japonais dans son contexte naturel. Un champ de camellias au lever du soleil. La transformation lente d'un ongle terne en ongle lumineux filmee en timelapse sur 4 semaines. Le savoir-faire ancestral des artisans japonais.
2. Anxiete / Surprise : L'anxiete moderee (pas la peur) motive le partage comme mecanisme social ("prevenir les autres").
Application FemiGlow : "Saviez-vous que le vernis a ongles classique contient du formaldehyde ?" (anxiete utile, pas alarmiste). "Les 3 gestes quotidiens qui abiment vos ongles sans que vous le sachiez" (surprise revelante).
3. Amusement : Le contenu divertissant se partage par mecanisme social (offrir du plaisir a son reseau).
Application FemiGlow : Decalage culturel amusant (comparaison respectueuse des rituels manucure France vs. Japon). Moments de satisfaction visuelle (ASMR de polissage, texture d'huile versee au ralenti).
4. Colere / Indignation : A utiliser avec extreme prudence pour FemiGlow. Uniquement sous forme d'indignation douce envers les pratiques industrielles.
Application FemiGlow : "Pourquoi l'industrie du vernis ne vous parle jamais de la sante de vos ongles" (indignation constructive). Jamais d'attaque directe contre un concurrent ou un ingredient specifique.

EMOTIONS A FAIBLE ACTIVATION (ne declenchent PAS le partage) :
- Tristesse : Ralentit, intériorise. Le contenu triste est lu mais pas partage.
- Contentement : L'etat de satisfaction passive ne pousse pas a l'action.
- Relaxation : Apprecie mais rarement partage (sauf ASMR qui active la surprise/fascination).

FRAMEWORK OPERATIONNEL POUR FEMIGLOW :
Pour chaque piece de contenu, identifier l'emotion cible :
- Reels "ingredient spotlight" → Emerveillement (beaute naturelle, histoire culturelle)
- Carrousels educatifs → Surprise (revelations, mythes demystifies)
- UGC et resultats → Inspiration (preuve sociale + emerveillement)
- Contenu "vs." ou "mythes" → Surprise + Anxiete moderee
- Tutoriels ASMR → Fascination (sous-categorie de l'emerveillement)

AMPLIFICATEURS DE PARTAGE :
- La monnaie sociale (Social Currency) : Partager du contenu FemiGlow doit faire paraitre la personne cultivee, raffinee, informee. Le contenu educatif sur la J-Beauty offre cette monnaie.
- La valeur pratique (Practical Value) : Les tutoriels concrets ("Comment polir vos ongles en 5 minutes") se partagent par altruisme ("ça peut aider ma copine").
- Les histoires (Stories) : Le storytelling culturel japonais (le voyage de l'huile de tsubaki de la graine a la bouteille) est un vehicule narratif naturel pour le partage.
- Les declencheurs (Triggers) : Associer le rituel a un moment quotidien existant (le the du matin, le dimanche soir) cree un trigger de rappel qui genere du contenu organique.`,
    },
    {
      title: 'Neuroscience de l\'attention et hooks visuels',
      metadata: { category: 'attention-science', priority: 'high' },
      content: `Neuroscience de l'attention appliquee au contenu social — Reference operationnelle.

LA REGLE DES 3 SECONDES :
Les recherches en neuroscience de l'attention (Itti & Koch, 2001; Wolfe, 2007) montrent que le systeme attentionnel humain fonctionne en deux phases :
1. Attention pre-attentive (0-500ms) : Traitement automatique, inconscient. Le cerveau scanne l'image pour detecter les saillances : contraste, mouvement, visages, couleurs inhabituelles.
2. Attention dirigee (500ms-3s) : Si un element pre-attentif capte l'oeil, le cerveau engage l'attention consciente. C'est dans cette fenetre de 3 secondes que le contenu doit "promettre" une valeur pour justifier la poursuite du scroll.

IMPLICATIONS POUR LE CONTENU FEMIGLOW :
Phase pre-attentive (le hook visuel) :
- Contraste lumineux : Un objet clair sur fond sombre (ou inverse) capte l'oeil. L'huile doree de tsubaki versee sur une ceramique sombre est un hook visuel naturel.
- Mouvement dans un flux statique : Dans un feed d'images fixes, une video avec un mouvement lent (versement d'huile, mouvement de polissage) capte immediatement.
- Visages et mains : Le cerveau humain detecte les visages en moins de 100ms (Farah, 1996). Les mains activent un circuit similaire. Un gros plan de mains est un hook pre-attentif puissant.
- Couleur inhabituelle : Dans un feed sature de couleurs vives, la palette douce de FemiGlow (creme, sauge) est paradoxalement plus saillante par contraste de saturation.

Phase attentive (la promesse) :
- Les 2 premieres lignes de caption doivent contenir la promesse de valeur. Instagram tronque apres 2 lignes ; ces lignes sont le "headline" du contenu.
- Pour les Reels : la premiere seconde doit montrer soit le resultat (ongle brillant en gros plan) soit une action intrigante (geste inhabituel).
- Pour les carrousels : la premiere slide est un titre-hook, pas une image decorative.

LE F-PATTERN (Jakob Nielsen, 2006) :
Les etudes d'eye-tracking montrent que les utilisateurs scannent le contenu en forme de F :
1. Barre horizontale haute (le titre/premier element)
2. Barre horizontale milieu (le sous-titre/deuxieme element)
3. Barre verticale gauche (scan rapide du reste)

Pour les carrousels FemiGlow :
- Slide 1 : Titre-hook en haut (barre horizontale haute)
- Slide 2 : Sous-titre/promesse au milieu (barre horizontale milieu)
- Slides suivantes : Information clé alignee a gauche

CONTRASTE ET MOUVEMENT — LES DEUX REINES DE L'ATTENTION :
Le systeme visuel humain est cible sur la detection de changements (evolutionnairement lie a la detection de predateurs/proies).
- Contraste statique : Luminosite, couleur, taille, orientation. Dans un carrousel, alterner fond clair et fond sombre entre les slides maintient l'attention par le renouvellement du contraste.
- Contraste temporel : Le mouvement. Meme un mouvement subtil (vapeur qui s'eleve d'un bol de the, huile qui coule lentement) capte l'attention pre-attentive.
- Contraste semantique : L'inattendu. Un ongle naturellement brillant sans vernis dans un feed de nail art colore est un contraste semantique puissant.

CHARGE COGNITIVE ET SIMPLICITE :
La theorie de la charge cognitive (Sweller, 1988) montre que le cerveau a une capacite de traitement limitee. Quand le contenu est trop complexe, l'utilisateur decroche.
- Maximum 3 informations par slide de carrousel.
- Une seule idee par Reel.
- Caption : une idee principale + un CTA. Pas de paragraphe dense.
- Visuellement : fond epure, un sujet principal, pas de surcharge decorative.
- La simplicite visuelle de la J-Beauty est un avantage cognitif : moins de charge = plus de temps passe = meilleur signal algorithmique.

EFFET DE SUPERIORITE DE L'IMAGE (Picture Superiority Effect) :
Le cerveau retient 65% d'une information presentee visuellement apres 3 jours, contre 10% d'une information textuelle seule (Medina, 2008).
- Les tutoriels video sont superieurs aux tutoriels texte pour la retention.
- Les infographies sont superieures aux listes a puces.
- Les photos de texture (gros plan sur l'huile, la creme, la surface de l'ongle) sont des vehicules d'information sensorielle qui activent la memoire episodique.`,
    },
  ],

  'platform-algorithms': [
    {
      title: 'Algorithme Instagram 2025-2026',
      metadata: { category: 'instagram', priority: 'critical', lastUpdated: '2025-12' },
      content: `Algorithme Instagram 2025-2026 — Signaux de classement et strategies operationnelles.

CHANGEMENT MAJEUR 2025 : Instagram est devenu un moteur de decouverte, pas seulement un reseau social. Le shift vers les Reels et l'onglet Explore favorise le contenu de comptes inconnus. Le reach organique pour les petits comptes est meilleur qu'en 2023-2024 si le contenu est optimise.

SIGNAUX DE CLASSEMENT PAR FORMAT :

1. REELS (format prioritaire) :
Signal #1 — Sends (partages DM) : Le signal le plus puissant en 2025. Un Reel partage en DM indique au systeme que le contenu a une valeur relationnelle forte. Instagram veut etre la plateforme ou "vous partagez des choses avec vos proches".
Strategies FemiGlow : Creer du contenu "share-worthy" — tutoriels que les gens envoient a leurs amies, revelations surprenantes sur les ingredients, moments de satisfaction visuelle.
Signal #2 — Saves : Indique que le contenu a une valeur future. Les carrousels educatifs et les tutoriels etape par etape generent le plus de saves.
Strategies FemiGlow : Carrousels "5 etapes du rituel FemiGlow", infographies ingredients, recaps de routines.
Signal #3 — Watch Time & Completion Rate : Le pourcentage de visionnage complet. Un Reel de 15 secondes vu entierement est mieux classe qu'un Reel de 60 secondes vu a 30%.
Strategies FemiGlow : Reels courts (15-30s) avec une boucle narrative (le debut et la fin se repondent). Hook visuel immediat.
Signal #4 — Rewatches : Un Reel regarde plusieurs fois signale un contenu a haute valeur. Les Reels ASMR, les transformations subtiles et les gestes repetitifs generent des rewatches.
Signal #5 — Comments & Replies : Les commentaires longs et les conversations sont plus valorises que les emojis uniques. Poser des questions ouvertes en caption.

2. CARROUSELS :
Les carrousels ont un avantage unique : Instagram les re-affiche dans le feed quand l'utilisateur n'a pas vu toutes les slides. Cela donne 2-3 opportunites d'impression.
Signal cle : Swipe-through rate (% de slides vues). Un carrousel dont 80% des slides sont vues performe significativement mieux.
Strategies FemiGlow : Slide 1 = hook fort. Dernieres slides = CTA de save/share. Contenu educatif en 5-8 slides. Alterner image et texte pour maintenir l'interet.

3. FEED POSTS (images statiques) :
Moins prioritaires dans l'algorithme 2025, mais toujours importants pour la coherence de la grille et la preuve sociale.
Signal cle : Temps passe sur le post (dwell time). Une image qui fait s'arreter et regarder est mieux classee.
Strategies FemiGlow : Photos haute qualite en gros plan. Captions longues et engageantes qui gardent le lecteur sur le post.

SEO INSTAGRAM (nouveaute majeure 2025) :
Instagram integre desormais la recherche par mots-cles, pas seulement les hashtags. Le texte de la caption, le texte a l'ecran dans les Reels, et le texte alt sont indexes.
Strategies FemiGlow :
- Inclure des mots-cles naturellement dans les captions : "soin ongles naturel", "rituel beaute japonaise", "huile camellia ongles".
- Texte a l'ecran dans les Reels avec des mots-cles pertinents.
- Alt text descriptif sur chaque image.
- Bio optimisee avec mots-cles cibles.

HASHTAGS 2025 :
Le pouvoir des hashtags a diminue en faveur du SEO caption, mais ils restent utiles pour la categorisation.
Strategie recommandee : 5-10 hashtags maximum (pas 30). Mix de 3 types :
- 3 hashtags de niche (<50K posts) : #rituelbeaute #soinonglesnaturels #jbeautyfrance
- 3 hashtags de milieu (50K-500K) : #beautejapoanaise #nailcare #soindesmains
- 3 hashtags larges (>500K) : #beautenaturelle #skincare #selfcare

TIMING DE PUBLICATION :
L'algorithme 2025 est moins sensible au timing exact qu'avant (le contenu peut performer 48-72h apres publication). Neanmoins, publier quand l'audience est active donne un boost initial.
Pour une audience francaise beaute (28-45 ans) : 7h-9h (trajet matin), 12h-13h (pause dejeuner), 20h-22h (soiree). Dimanche soir est historiquement le meilleur creneau pour le contenu beaute/bien-etre.`,
    },
    {
      title: 'Algorithme TikTok FYP 2025-2026',
      metadata: { category: 'tiktok', priority: 'high', lastUpdated: '2025-11' },
      content: `Algorithme TikTok For You Page — Signaux de classement et strategies.

FONCTIONNEMENT DU FYP :
TikTok utilise un systeme de recommandation base sur le graph d'interet (interest graph), pas le graph social. Cela signifie que meme un compte avec 0 followers peut atteindre des millions de vues si le contenu est pertinent.

Chaque video est d'abord montree a un petit groupe test (300-500 personnes). Si les metriques sont bonnes, elle est propagee a des groupes de plus en plus larges (1K → 10K → 100K → 1M+). Ce systeme en "vagues" fait que la qualite du contenu compte plus que la taille du compte.

SIGNAUX DE CLASSEMENT (par ordre d'importance) :

1. Completion Rate (Taux de visionnage complet) :
Le signal #1 absolu. Un video vue a 100% (ou plus, en boucle) est le plus fort indicateur de qualite pour TikTok.
Implications FemiGlow : Videos courtes (15-30s max pour le debut). Chaque seconde doit justifier la suivante. Le hook visuel dans la premiere seconde. La resolution/payoff dans les dernieres 2 secondes. Creer une boucle narrative ou le debut et la fin se connectent pour encourager le rewatch.

2. Rewatch Rate (Taux de re-visionnage) :
Quand un utilisateur regarde une video plusieurs fois, c'est un signal extremement fort. Les videos ASMR, les transformations et les "details que vous avez manques" generent des rewatches.
Implications FemiGlow : Reels ASMR de polissage, versement d'huile au ralenti. Gros plans de texture. Sequences hypnotiques repetitives. Ajouter un petit detail subtil que les viewers voudront revoir.

3. Shares (Partages) :
Les partages (en DM, sur d'autres plateformes) signalent une valeur sociale ou pratique.
Implications FemiGlow : Contenu "share-worthy" — tutoriels utiles, faits surprenants sur les ingredients, comparaisons culturelles amusantes.

4. Comments (Commentaires) :
Les commentaires signalent l'engagement cognitif. TikTok valorise les commentaires longs et les threads de conversation.
Implications FemiGlow : Poser des questions ouvertes en fin de video. "Vous connaissiez l'huile de tsubaki ?" Creer du debat doux : "Et vous, plutot rituel matin ou rituel soir ?"

5. Saves (Sauvegardes) :
Les saves signalent une valeur future. Les tutoriels, les recettes et les listes sont les plus sauvegardes.
Implications FemiGlow : Contenu educatif concis, listes d'ingredients, etapes de rituel.

TRENDING AUDIO :
L'utilisation d'un audio tendance augmente significativement la distribution initiale (le petit groupe test est plus favorable). TikTok favorise les createurs qui adoptent rapidement les tendances audio.
Strategie FemiGlow : Utiliser les audios tendance quand ils sont compatibles avec l'esthetique de la marque. Preferer les audios calmes, ambient, ou instrumentaux. Eviter les audios humoristiques ou agressifs sauf si le decalage est strategique.

FACTEURS TECHNIQUES :
- Qualite video : TikTok penalise les videos basse resolution, floues ou avec des watermarks d'autres plateformes (surtout le logo Reels).
- Texte a l'ecran : Les sous-titres et le texte a l'ecran augmentent le watch time (les utilisateurs lisent + regardent).
- Verticalite : Format 9:16 obligatoire. Les videos horizontales ou carrees sont penalisees.
- Longueur optimale : 15-30 secondes pour la decouverte, 60-90 secondes pour l'education, >3 minutes pour le storytelling profond (format long pousse en 2025).`,
    },
    {
      title: 'Signaux Facebook, Pinterest et LinkedIn',
      metadata: { category: 'multi-platform', priority: 'medium', lastUpdated: '2025-10' },
      content: `Signaux algorithmiques Facebook, Pinterest et LinkedIn — Strategies multi-plateforme.

FACEBOOK 2025-2026 :
Facebook a pivote vers les Reels et le contenu video court en 2024-2025. L'algorithme privilegié desormais le contenu original (non recycle d'Instagram) et les Reels natifs.

Signaux de classement :
1. Contenu original : Facebook detecte et penalise les reposts d'Instagram (watermarks, memes recycles). Le contenu cree specifiquement pour Facebook est booste.
2. Reels natifs Facebook : Priorite algorithmique significative. Les Reels Facebook touchent une audience plus agee (35-55 ans) que sur Instagram ou TikTok.
3. Interactions significatives : Les commentaires longs, les partages avec commentaire personnel, et les reactions autres que "like" (love, wow) sont plus valorises.
4. Groupes : Le contenu partage dans des groupes pertinents a une portee organique significativement plus elevee. Les groupes de beaute, de bien-etre, de J-Beauty sont des amplificateurs naturels.
5. Facebook Watch : Les videos de plus de 3 minutes qui maintiennent l'attention au-dela de 1 minute sont significativement boostees.
Strategie FemiGlow : Reels courts (15-30s) + videos longues educatives (3-5 min) pour Facebook Watch. Contenu adapte a une audience legerement plus agee et plus axee bien-etre que beaute performance.

PINTEREST 2025-2026 :
Pinterest est un moteur de recherche visuel, pas un reseau social. Le contenu a une duree de vie de 3-6 mois (vs. 24-48h sur Instagram). C'est une plateforme de decouverte d'achat.

Signaux de classement :
1. Fraicheur du Pin : Les nouveaux Pins sont boosted pendant les 30 premiers jours. Publier du contenu frais regulierement est plus efficace que re-pinner du contenu ancien.
2. Qualite de l'image : Format vertical 2:3 (1000x1500px). Images haute resolution, texte lisible, couleurs vives mais pas sursaturees.
3. SEO du Pin : Le titre du Pin, la description, le texte sur l'image et les tags sont indexes. Les mots-cles long-tail performent bien ("routine soin ongles japonaise naturelle" > "soin ongles").
4. Click-through Rate : Pinterest valorise les Pins qui generent des clics vers le site. L'image doit donner envie d'en savoir plus sans tout reveler.
5. Saves (re-pins) : Le signal d'engagement principal. Un Pin sauvegarde est redistribue aux abonnes de la personne qui l'a sauvegarde.
6. Idea Pins (multi-slides) : Format natif prioritaire similaire aux Stories mais permanent. Ideal pour les tutoriels etape par etape.
Strategie FemiGlow : Pinterest est ideal pour le contenu evergreen (rituels, ingredients, tutoriels). Creer des Pins pour chaque etape du rituel, chaque ingredient, chaque benefice. SEO agressif avec des mots-cles beaute japonaise. Lier chaque Pin au site FemiGlow.

LINKEDIN 2025-2026 :
LinkedIn evolue vers le contenu "professionnel mais personnel". La beaute et le bien-etre ont une place limitee mais reelle dans l'angle entrepreneuriat, marque, et culture japonaise.

Signaux de classement :
1. Dwell Time : Le temps passe sur un post est le signal #1. Les posts longs et narratifs performent mieux que les posts courts.
2. Commentaires : Les commentaires de plus de 10 mots sont 5x plus valorises que les likes. Les conversations dans les commentaires boostent la visibilite.
3. Contenu natif : Les liens externes sont penalises. Publier le contenu directement sur LinkedIn (texte, carrousel PDF, video native).
4. Carrousels PDF : Format tres performant sur LinkedIn. Slides educatives au format PDF televerse comme document.
5. Creator Mode : Active les outils de creation et l'onglet "Recent" sur le profil.
Strategie FemiGlow (angle B2B/fondatrice) : Storytelling entrepreneurial (creation d'une marque J-Beauty en France). Coulisses de la formulation. Reflexions sur le marketing authentique vs. le marketing performance. Le contenu LinkedIn n'est pas pour vendre le produit mais pour construire l'autorite de la marque et de la fondatrice.

REGLES TRANSVERSALES MULTI-PLATEFORME :
- Ne jamais cross-poster le meme contenu tel quel. Adapter le format, le ton et la longueur a chaque plateforme.
- Chaque plateforme a sa propre "personnalite" FemiGlow : Instagram = esthetique et rituel, TikTok = decouverte et satisfaction, Facebook = communaute et bien-etre, Pinterest = inspiration et tutoriel, LinkedIn = vision et business.
- Repurposer le contenu core (une video de rituel) en 5 formats adaptes est plus efficace que creer 5 contenus distincts.`,
    },
  ],
};
