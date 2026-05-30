/**
 * Seed du rapport strategique FemiGlow (mai 2026) decoupe en knowledge documents
 * optimises pour le pipeline RAG (LangGraph).
 *
 * Source verbatim : docs/ai-content-studio/210-strategie-rapport/rapport-strategique-femiglow.md
 * Plan d'ingestion : docs/ai-content-studio/210-strategie-rapport/plan-ingestion-pipeline.md
 *
 * Regles de mise en forme appliquees (pour maximiser la qualite de recuperation) :
 *  - Aucun marqueur de citation brut (cite...turn...) : strippe.
 *  - Style ASCII sans accents ni emoji, aligne sur seed-data.ts.
 *  - Chunks courts (chaque bloc thematique < 900 caracteres) ouverts par une
 *    phrase-these contenant les mots-cles de requete probables.
 *  - Format directif (regles imperatives) plutot que prose narrative.
 *  - Exemples concrets conserves et localises a l'univers FemiGlow (soin des
 *    ongles et des mains, J-Beauty) plutot que skincare visage generique.
 *
 * Idempotent : un document n'est insere que si aucun document de meme titre
 * n'existe deja dans la collection cible.
 */
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { aiEngineKnowledgeDocuments } from '@/lib/db/schema-ai-engine';
import { createLogger } from '../utils/logger';
import { seedDefaultCollections } from './collections';
import { ingestText } from './ingestion';

const log = createLogger('knowledge:seed-strategic-brief');

interface SeedDocument {
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
}

const SOURCE = 'rapport-strategique-2026-05';

export const STRATEGIC_BRIEF_DOCUMENTS: Record<string, SeedDocument[]> = {
  // === D1 ============================================================
  neuromarketing: [
    {
      title: 'Psychologie et charge cognitive — declencheurs d achat beaute',
      metadata: { category: 'cognitive-biases', priority: 'high', source: SOURCE, pillar: 'psychologie' },
      content: `Psychologie du consommateur beaute : capter l attention, alleger la charge cognitive, declencher l achat. Reference operationnelle pour scripts et captions FemiGlow.

GUIDAGE DU REGARD. L attention ne se gagne pas avec "de belles images" mais en guidant l oeil. Regle : dans les premieres fractions de seconde, l ecran doit offrir UN objet prioritaire (texture, main, geste, flacon, contraste avant/apres). Ne pas traiter l ecran comme une affiche pleine. La lecture mobile suit souvent un schema en F sur le texte dense, et un schema en Z sur les compositions simples pilotees par un visuel fort et un seul CTA.

DIRECTION DU REGARD. La presence d un visage et la direction du regard augmentent attention, memorisation et evaluation. Regle : quand un modele regarde le produit ou la zone d interet (l ongle, la texture, le geste de polissage), l attention du spectateur s y deplace. Un regard dirige est un outil de guidage cognitif, pas un detail esthetique.

CHARGE COGNITIVE. La memoire de travail est tres limitee (Cowan, Sweller). Regle : un contenu "complet" est presque toujours trop dense. Une creation = une idee + une preuve + une action. Ne jamais vendre dans un seul asset : la marque, trois actifs, l histoire japonaise, une promo, cinq benefices et deux CTA. C est du bruit.

BIAIS DE DECISION. Quatre leviers structurent la persuasion beaute :
- Simple exposition (Zajonc) : la familiarite repetee d actifs distinctifs ameliore l attitude. Repeter des codes (flacon, geste, lumiere, palette), pas la meme creation en boucle.
- Framing (Tversky & Kahneman) : la formulation modifie la decision. Formuler le benefice, pas la caracteristique.
- Surcharge de choix (Iyengar & Lepper) : trop d options decourage l action. Limiter le choix presente.
- Effet halo : une impression globale positive se propage. La coherence visuelle cree une impression de maitrise.

PREUVE SOCIALE. Les avis en ligne influencent fortement l intention d achat (la valence des avis surtout) ; l efficacite des createurs passe par credibilite, expertise perçue, attractivite et congruence produit. Regle : un contenu premium n est pas seulement plus beau, il semble vrai, maitrise, specifique et socialement valide. Signaux utiles : demonstrations realistes, routines filmees en contexte, commentaires qualifies, temoignages d usage, comparatifs honnetes.

PREMIUM vs CHEAP. Premium = sobriete, gros plans matiere, lisibilite, regularite visuelle, coherence de palette, gestes lents, micro-preuves, retenue textuelle. Cheap = surcharge : trop d overlays, trop d effets, trop d all-caps, trop de promesses, codes empruntes sans unite.

REGLE SYSTEME. Un ecran = une idee. Une creation = une preuve. Un post = un seul comportement attendu. Si un contenu a besoin de trop d explications pour etre compris, il est deja trop charge.

EXEMPLE FEMIGLOW. Au lieu de "5 bienfaits du soin + -20% + ingredients + rituel + avis", preferer un Reel de 12 a 18 s : ouverture sur une goutte d huile de tsubaki qui s etire, texte "Pourquoi vos ongles cassent apres l hiver ?", cut sur le geste de polissage, micro-texte "rituel japonais de nutrition", plan main lumineuse, CTA "Sauvegardez pour votre rituel du soir".

ERREURS A EVITER : empiler les arguments dans un asset ; visages sans point focal ; saturer de texte "pour etre clair" ; croire qu une image polish suffit a creer du desir ; confondre familiarite et redondance creuse.`,
    },
  ],

  // === D2 ============================================================
  'viral-content': [
    {
      title: 'Viralite, hooks et storytelling — grille STEPPS',
      metadata: { category: 'virality', priority: 'high', source: SOURCE, pillar: 'viralite' },
      content: `Viralite et storytelling beaute : rendre un contenu partageable ET convertissant. Reference pour hooks, angles et structure narrative FemiGlow.

LA VIRALITE N EST PAS ALEATOIRE. Berger & Milkman : les contenus les plus partages sont lies a des emotions a forte activation (admiration, surprise, colere, anxiete) plutot qu a des emotions faibles ; l utilite pratique compte aussi. Grille STEPPS (Berger) : Social currency, Triggers, Emotion, Public, Practical value, Stories. Regle : un contenu est partageable s il rend la personne informee, la relie a un rituel/tendance, suscite une emotion claire, donne une utilite concrete et raconte quelque chose de transmissible.

VIRALITE DE DIFFUSION vs DE CONSIDERATION. Un contenu tres vu ne convertit pas mecaniquement. Distinguer la viralite de diffusion (partage large) de la viralite de consideration (partage par des acheteurs potentiels). Sur Instagram, les "sends" a des amis proches sont un signal fort : le contenu doit etre assez memorable pour etre envoye, ET assez pertinent pour etre envoye a la bonne personne.

HOOKS DE TENSION LEGERE. En beaute, les meilleurs hooks ne sont pas publicitaires mais des hooks de curiosite/tension douce. Exemples adaptes FemiGlow :
- "Vous prenez peut-etre soin de vos ongles dans le mauvais ordre."
- "Pourquoi votre durcisseur rend vos ongles plus cassants."
- "Le geste japonais qui change la sensation d un rituel des mains."
- "Trois signes que vos ongles ont besoin de moins de produits, pas plus."
Regle : activer curiosite, menace legere ou utilite immediate, sans agressivite ni promesse impossible. Toujours offrir un payoff au hook.

FORMATS NATIFS. Sur TikTok et Reels, les formats beaute recurrents : tutorials, GRWM, transformations, reviews, routines, contenus creator-led. Regle : s inscrire dans les formats existants de la culture plateforme pour parler la langue native du scroll, sans copier des gimmicks sans coherence de marque.

SON ET TENDANCE : utiles mais pas souverains. Surveiller hashtags, sons, createurs montants (Creative Center). Distinguer les moments a cycle court (jours/semaines) des signaux durables. Un Short peut performer sans son tendance si l idee est originale. Regle : utiliser les tendances pour amplifier, jamais comme fondation de la strategie de marque.

EDUQUER OU DIVERTIR. Reponse FemiGlow : divertir par l education sensible. La meilleure zone n est ni le cours ni le show pur, mais l apprentissage emballe dans une experience visuelle agreable a regarder et a sauvegarder. Une texture satisfaisante, un geste precis, une erreur corrigee tiennent mieux en memoire qu une slide theorique.

FORMAT LONG = DENSIFICATION DE CONFIANCE. Le long format n est pas un outil de trend-chasing mais d expertise et de nuance. Peu de longs, mais utiles, relies aux Shorts : "Routine de nutrition des ongles inspiree du rituel japonais", "Les erreurs de soin qui rendent les ongles ternes".

REGLE SYSTEME. Le court format attrape et fait circuler. Le moyen format explique. Le long format credibilise. La page produit convertit. Aucun post ne fait tout a la fois.

ERREURS A EVITER : sacrifier la clarte au trend ; son tendance sans rapport produit ; hook anxiogene sans payoff ; viralite au detriment de la credibilite. Un contenu envoye a une amie doit donner envie de tester, pas seulement de rire.`,
    },
  ],

  // === D3 ============================================================
  'platform-algorithms': [
    {
      title: 'Roles et signaux par plateforme — guide editorial strategique',
      metadata: { category: 'platform-strategy', priority: 'high', source: SOURCE, pillar: 'plateformes' },
      content: `Roles et signaux par plateforme : piloter FemiGlow par ROLE de plateforme, jamais par recyclage uniforme du meme contenu. Chaque surface cherche un comportement different.

INSTAGRAM — desirabilite, partage, relation, shopping leger. Le Feed ordonne par valeur predite ; la recherche s appuie sur handle, nom de profil, bio, legendes, hashtags ; les "sends" a des amis proches sont un signal cle pour les Reels. Regles : creer du contenu partageable, sauvegardable et semantiquement clair. Reels en tete d affiche ; carrousels pour pedagogie et saves ; Stories/Broadcast pour la proximite. KPI : sends/reach, saves/reach, vues profil, clics lien. Cadence de travail : 4-6 Reels/sem, 2 carrousels/sem, Stories quasi quotidiennes.

TIKTOK — decouverte acceleree et commerce culturel. Recommandation pilotee par interactions utilisateur, informations video, sons, signaux de satisfaction (taux de visionnage, retention, partages). Formats forts : UGC natif, GRWM, reviews, transformations, tutorials. Regle : traiter la video comme une micro-preuve vivante, pas un spot. Sous-titres systematiques, ton natif. KPI : taux de visionnage, retention, partages, clic bio. Cadence : 5-7 videos/sem.

FACEBOOK — reassurance, communaute, repetition. Organique reduit mais utile pour communaute, audiences plus agees/familiales, groupes. Regle : ce n est plus le coeur d acquisition froide ; en faire un espace de relation et de reassurance autour des routines et retours clients. KPI : commentaires, clics, vues engagees, activite groupe. Cadence : 3-5 posts/sem + animation communautaire.

PINTEREST — intention, evergreen, trafic qualifie. Classement par sujets et signaux d engagement (pas chronologique) ; les saves sont des signaux actifs forts ; titres, descriptions, mots-cles et metadonnees contextualisent. Regle : capter l intention douce mais reelle (routine, inspiration, soins japonais, guide, idees cadeaux). C est l endroit ou l esthetique FemiGlow reste visible longtemps. KPI : saves, outbound CTR, clics produit. Cadence : 5-10 Pins/sem avec SEO visuel et semantique. Lancer les campagnes saisonnieres plusieurs mois en avance (les gens y planifient tot).

YOUTUBE SHORTS — education courte, confiance, passerelle vers le long format. Home, Up Next et Shorts player personnalises ; signaux : historique de visionnage/recherche, abonnements, likes, satisfaction. Systemes de recommandation Shorts et long format DISTINCTS. Titres et miniatures importants ; tags a role limite. Regle : ne pas cloner TikTok ; faire de YouTube une colonne vertebrale de credibilite (short educatif + quelques videos longues de reference). KPI : vus vs swipes, watch time, abonnes, clics description. Cadence : 3-5 Shorts/sem + 2 videos longues/mois.

THREADS — conversation, fondateur, proximite. Plateforme text-first temps reel. Utile pour narration fondatrice, Q/R, behind the routine, journaux de lancement. Pas une surface de conversion directe. Cadence : 3-5 posts/sem, intensifier au lancement.

X — reactivite, actualite, annonces, presse. For You combine suivis et recommandations, tres temps reel. Usage opportuniste, pas un socle e-commerce.

LINKEDIN — autorite, B2B, retail, recrutement. Feed professionnel personnalise qui reduit le contenu de faible qualite. Role : credibilite fondateur, expertise ingredient-led, partenariats, retail/wholesale, signal premium. Faible priorite pour la vente directe DTC. Cadence : 2-3 posts/sem tres editorialises.

IMPORTANT : aucune plateforme ne publie de frequence "ideale" universelle. Les cadences ci-dessus sont des recommandations de travail a recaler sur les analytics maison apres 4-6 semaines.

REGLE SYSTEME. Ne publiez jamais le meme contenu partout. Publiez la meme idee, traduite dans la logique comportementale de chaque surface.`,
    },
  ],

  // === D4 ============================================================
  'jbeauty-strategy': [
    {
      title: 'Strategie J-Beauty traduite — 5 piliers et saisonnalite',
      metadata: { category: 'jbeauty-strategy', priority: 'high', source: SOURCE, pillar: 'jbeauty' },
      content: `Strategie J-Beauty pour FemiGlow : vendre une maniere de prendre soin (douce, rigoureuse, elegante, reproductible), pas un "pays". La culture japonaise enrichit la preuve, ne la remplace jamais.

POSITIONNEMENT. Le territoire le plus fort n est pas la "beaute japonaise" decorative mais la discipline du soin japonais rendue intuitive pour une audience occidentale. La J-Beauty est minimaliste, technologiquement avancee et nourrie par les traditions ; les routines japonaises valorisent douceur, prevention, hydratation, rituel, elegance discrete. Territoire credible FemiGlow : rituels precis, textures elegantes, respect de la barriere cutanee des mains, prevention, saisonnalite, sophistication discrete.

GRAMMAIRE VISUELLE. Preferer blancs casses, ivoire, argiles claires, bleu indigo, vert the, beiges pierre ; accents rares de rouge camelia ou de dore pour les temps forts. Reference culturelle : le rouge evoque vitalite et protection, le blanc la purete, l indigo l artisanat textile. Regle : grammaire de ton, pas symbolisme rigide.

TRADUCTION OCCIDENTALE. En Occident, le contenu convertit mieux quand il articule probleme + preuve + benefice. Toujours relier l esthetique japonaise a une promesse d usage quotidienne :
- "rituel doux, ongles moins cassants"
- "nutrition profonde, mains plus confortables"
- "texture legere, barriere respectee"
- "rituel court mais constant"
- "preuve sensorielle + coherence de routine"

INGREDIENTS HEROS. Puissants si credibles et jamais survendus. Riz fermente (hydratation, antioxydant), huile de camelia/tsubaki (benefices barriere), the vert/matcha (antioxydant, photoprotection nuancee), yuzu (narration sensorielle forte). Regle : presenter ces ingredients comme vecteurs de routine et de sensorialite, avec des preuves mesurees, jamais comme miracles "orientaux".

LES 5 PILIERS EDITORIAUX.
- Pilier rituel : montrer le geste, l ordre, la sensation, le temps juste.
- Pilier texture : macro visuels, glisse, absorption, glow discret de l ongle.
- Pilier pedagogie : expliquer simplement la barriere cutanee, le layering, les erreurs de surexposition aux actifs.
- Pilier preuve sociale : temoignages, createurs pertinents, commentaires, avant/apres prudent sans surpromesse.
- Pilier culture traduite : storytelling saisonnier, ingredients, artisanat, esthetique sobre, sans exotisation.

CALENDRIER SAISONNIER.
- Ete : matsuri, legerete, indigo, textures non grasses. "Rituel d ete leger inspire du Japon".
- Fin d ete : Obon, retour a soi, soin doux, contenus intimes du soir.
- Automne : momiji, reparation, reconfort, tons chauds. Routines barriere, "reset" mains, Pins evergreen.
- Hiver : camelia, cadeaux, rouge/dore maitrises. Coffrets, textures cocon, rituel enveloppant.
- Printemps : sakura, renouvellement, eclat doux, purification. Visuels clairs et aeres.
Lancer chaque saison plusieurs mois en avance sur Pinterest et le SEO social.

FUNNEL FEMIGLOW. Reels/TikTok (decouverte) -> saves/partages -> Pinterest/recherche -> page produit ou guide -> Short YouTube de reassurance -> achat -> UGC et routine client -> retour a la decouverte. Ne pas attendre qu un seul canal fasse tout.

REGLE SYSTEME. Garder l esthetique japonaise, mais toujours la relier a une promesse d usage. Erreurs : sur-decorer de cliches, promettre des effets "magiques", faire du J-Beauty uniquement par le packaging, oublier la traduction fonctionnelle.`,
    },
  ],

  // === D5 ============================================================
  'ai-content-rules': [
    {
      title: 'Doctrine IA assistee, preuve humaine et transparence',
      metadata: { category: 'ai-production-rules', priority: 'critical', source: SOURCE, pillar: 'ia' },
      content: `Doctrine IA pour le contenu FemiGlow : "IA assistee, preuve humaine". L IA est un accelerateur de production, pas une identite creative de substitution. Garde-fous a appliquer a toute generation.

OU L IA EST FORTE. Vitesse, variation et system design : generation d angles, storyboards, scripts, sous-titres, declinaisons multi-plateformes, tests de hooks, moodboards, doublages, localisation, calendrier editorial, previsualisation de concepts.

OU L IA EST FAIBLE. Des qu il s agit de peau, de texture, de credibilite produit et d authenticite perçue. La confiance et la perception de verite restent des mediateurs cles de l intention d achat ; les contenus generes par IA risquent une authenticite perçue plus faible.

REGLE DE TRANSPARENCE (enjeu reglementaire, pas seulement marketing). Meta labellise le contenu genere par IA et ajoute une info AI a certaines creations generees ou fortement modifiees. L AI Act europeen impose une trajectoire de transparence croissante pour images, audios et videos artificiels. Pour une marque operant vers l Europe, cacher une part substantielle de generation IA dans des demonstrations "human-like" est strategiquement risque.

DOCTRINE A APPLIQUER :
- OUI a l IA pour accelerer le systeme editorial.
- OUI a l IA pour variations de scripts, plans, hooks, voix off auxiliaires, fonds, maquettes.
- PRUDENCE FORTE sur les peaux/mains entierement synthetiques, les demonstrations produit photorealistes non reelles, les avatars "experts", les avant/apres artificiels.
- TRANSPARENCE des qu un contenu est substantiellement genere ou modifie.
- PRIORITE AU REEL sur les textures, mains, gestes, application, resultats, UGC, temoignages.

REGLE SYSTEME. Scripts, declinaisons et localisation par IA ; mais demonstration produit, texture, geste, voix et validation restent ancres dans le reel. Quand un contenu semble trop synthetique ou trop "parfait", il fragilise la confiance.`,
    },
  ],

  // === D6 ============================================================
  'emerging-trends': [
    {
      title: 'Tendances beaute et skincare 2025-2026',
      metadata: { category: 'trends', priority: 'medium', source: SOURCE, pillar: 'tendances' },
      content: `Tendances beaute et skincare 2025-2026 exploitables par FemiGlow. Utiliser comme angles editoriaux, pas comme verites figees : recaler sur les analytics.

SIMPLIFICATION PREMIUM. Le soin "plus simple mais plus precis" colle a la J-Beauty et a la fatigue face a la surenchere d actifs. Pinterest Forecast 2026 evoque des esthetiques plus naturelles et des rapports plus personnels au style ; bien-etre, personnalisation, securite des ingredients et routines plus intelligentes montent. Angle FemiGlow : un rituel court, precis et reproductible plutot qu une accumulation de produits.

BARRIERE CUTANEE ET DOUCEUR. Territoire credible, educatif, repetable et moins soumis a l obsolescence rapide que les micro-trends maquillage. Angle FemiGlow : protection et nutrition des ongles et des mains, respect de la barriere, prevention.

SOCIAL COMMERCE PAR LA ROUTINE. TikTok reste un pole majeur de decouverte beaute (createurs, routines, swatches, GRWM, BeautyTok), avec une articulation forte entre culture, recommandation et commerce ; Pinterest convertit l inspiration en recherche et clics. Angle : transformer la routine en contenu shoppable.

REALNESS PREMIUM. Les contenus trop synthetiques ou trop "ads-looking" fatiguent ; les formats qui ressemblent a une vraie routine bien filmee gagnent en confiance. Tension 2026 : sophistication technologique vs desir de reel. Les marques qui gardent de la chaleur humaine gagnent. Angle FemiGlow : montrer de vraies mains, de vrais gestes, de vraies textures.

FEUILLE DE ROUTE 90 JOURS.
- Mois 1 : installer la grammaire de marque (palette, decors, gestes, plans textures, ton, 5 piliers, bibliotheque de hooks).
- Mois 2 : creer la boucle decouverte -> intention (rythme TikTok/Instagram, socle Pinterest evergreen, 1 serie Shorts educative).
- Mois 3 : optimiser par signaux de qualite (garder les formats a meilleurs saves/sends/CTR, recycler les meilleurs posts en Pins, emails, PDP, UGC).
Discipline analytique : ce qui est vu n est pas encore utile ; ce qui est sauvegarde, envoye, recherche et re-clique devient une brique business.`,
    },
  ],

  // === D7 ============================================================
  'brand-femiglow': [
    {
      title: 'Positionnement et grammaire de marque — synthese strategique',
      metadata: { category: 'brand-strategy', priority: 'critical', source: SOURCE, pillar: 'marque' },
      content: `Synthese strategique FemiGlow : construire une machine de desir memorisable et credible, pas du "viral" spectaculaire. A appliquer a chaque generation, toutes plateformes.

LES 5 INGREDIENTS DU CONTENU QUI PERFORME DURABLEMENT EN BEAUTE :
1. Un hook emotionnel ou sensoriel tres rapide.
2. Une preuve immediatement visible.
3. Une utilite pratique claire.
4. Une grammaire visuelle coherente.
5. Un niveau de confiance suffisant pour transformer l attention en intention d achat.
Regle : un contenu doit etre vu, retenu, partage, cru, puis clique. Ne jamais dissocier algorithme, creativite et achat.

MIX ORGANIQUE RATIONNEL. TikTok et Instagram Reels pour la decouverte et la desirabilite ; Pinterest pour l intention et l evergreen ; YouTube Shorts pour l education et la confiance ; Facebook pour la communaute et la reassurance ; Threads/X pour la conversation et le contexte ; LinkedIn pour la narration fondatrice, le retail, le B2B et la credibilite (pas la vente DTC directe).

GRAMMAIRE DE MARQUE A DOCUMENTER comme actifs distinctifs : flacon, matiere, geste, lumiere, phrase-signature, couleur d accent. La repetition coherente de ces actifs cree de la fluence (effet de simple exposition).

METRIQUES PAR ETAGE DE FUNNEL :
- Decouverte/consideration : partages et sauvegardes.
- Intention : clics sortants et vues page produit.
- Business : ajouts au panier, conversion, repetition.
Ne pas se contenter des vues : ce qui est envoye, sauvegarde et re-clique commence a etre une brique business.

CHECK-LIST OPERATIONNELLE (a passer avant publication) :
- La promesse est-elle un rituel de soin precis plutot qu un imaginaire flou ?
- Chaque creation a-t-elle une seule idee maitresse ?
- Le hook est-il visible/audible dans les deux premieres secondes ?
- Y a-t-il une preuve concrete (texture, geste, ongle, ordre, sensation, retour client) ?
- La legende et le profil utilisent-ils des mots-cles comprehensibles pour la recherche sociale ?
- Le contenu est-il conçu pour etre envoye ou sauvegarde, pas seulement like ?
- Le concept existe-t-il en version TikTok/Reel, Pin et Short YouTube ?
- Le storytelling J-Beauty est-il traduit en benefice d usage, pas reduit a un decor ?
- L IA accelere-t-elle la production sans fragiliser la confiance sur la matiere et le geste ?
- Les contenus generes/modifies par IA sont-ils evalues sous l angle transparence ?

REGLE SYSTEME. FemiGlow vend une maniere de prendre soin : douce, rigoureuse, elegante, reproductible. Moins de bruit, plus de precision ; moins de promesses agressives, plus de gestes, textures, preuves et discipline de routine.`,
    },
  ],

  // === D8 ============================================================
  copywriting: [
    {
      title: 'Hooks de tension et CTA prets a l emploi — beaute',
      metadata: { category: 'copywriting-frameworks', priority: 'high', source: SOURCE, pillar: 'copywriting' },
      content: `Bibliotheque de hooks et de CTA pour le contenu beaute FemiGlow. Reutiliser et adapter ; ne jamais empiler plusieurs CTA dans un meme asset.

PRINCIPE DU HOOK. Les meilleurs hooks beaute sont des hooks de tension legere (curiosite, menace douce, utilite immediate) et non des hooks publicitaires. Chaque hook DOIT avoir un payoff dans le contenu. Visible/audible dans les deux premieres secondes.

HOOKS DE TENSION (modeles a decliner) :
- "Vous prenez peut-etre soin de vos ongles dans le mauvais ordre."
- "Pourquoi votre durcisseur rend vos ongles plus cassants."
- "Le geste japonais qui change la sensation d un rituel des mains."
- "Trois signes que vos ongles ont besoin de moins de produits, pas plus."
- "Vous n avez peut-etre pas besoin d un soin de plus, mais d une meilleure nutrition."

HOOKS PAR FORMAT :
- TikTok : ton conversationnel, curiosite en moins d une seconde. "Personne ne vous a dit ça sur vos cuticules."
- Instagram Reel : hook sensoriel des 1,5 s, sur la texture ou le geste.
- Carrousel : hook-probleme en slide 1 ("3 signes qu un rituel trop agressif fatigue vos ongles").
- Pinterest : hook-intention avec mots-cles ("Rituel japonais minimaliste pour ongles cassants").
- YouTube Short : hook-clarification ("Huile, baume, polissage : enfin la difference en 40 secondes").

CTA PAR OBJECTIF (un seul par asset) :
- Conversion : "Decouvrir le rituel" / "Voir le kit".
- Engagement : poser une question ("Quel est votre geste du soir ?") ou inviter au partage.
- Awareness / sauvegarde : "Sauvegardez pour votre rituel du soir" / "En savoir plus".

FRAMEWORKS DE CAPTION :
- PAS (Probleme - Agitation - Solution) : nommer le probleme (ongles cassants), agiter la sensation (l inconfort, la honte), proposer le rituel.
- AIDA (Attention - Interet - Desir - Action) : hook -> benefice -> preuve sensorielle -> CTA unique.
- BAB (Before - After - Bridge) : avant (ongles ternes), apres (eclat naturel), pont (le rituel FemiGlow).

REGLES DE STYLE (alignees marque) : francais sobre, aucun emoji, aucun point d exclamation, aucune urgence artificielle, aucune promesse medicale. Un benefice formule en usage quotidien, pas en caracteristique. Hashtags : 3 niche + 3 moyens + 3 larges, 8 a 12 au total pour Instagram.`,
    },
  ],
};

export interface StrategicBriefSeedResult {
  documents: number;
  skipped: number;
  errors: string[];
}

/**
 * Ingere les documents du rapport strategique dans leurs collections.
 * Idempotent : ne reinsere pas un document dont le titre existe deja.
 */
export async function seedStrategicBrief(): Promise<StrategicBriefSeedResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let documents = 0;
  let skipped = 0;

  log.info('Starting strategic brief seed');

  const collections = await seedDefaultCollections();
  const drizzle = db();

  for (const [slug, docs] of Object.entries(STRATEGIC_BRIEF_DOCUMENTS)) {
    const collection = collections.find((c) => c.slug === slug);
    if (!collection) {
      errors.push(`Collection ${slug} not found`);
      continue;
    }

    for (const doc of docs) {
      // Idempotence : sauter si un document de meme titre existe deja.
      if (drizzle) {
        const existing = await drizzle
          .select({ id: aiEngineKnowledgeDocuments.id })
          .from(aiEngineKnowledgeDocuments)
          .where(
            and(
              eq(aiEngineKnowledgeDocuments.collectionId, collection.id),
              eq(aiEngineKnowledgeDocuments.title, doc.title),
            ),
          )
          .limit(1);
        if (existing.length > 0) {
          skipped++;
          continue;
        }
      }

      const result = await ingestText(collection.id, doc.title, doc.content, doc.metadata);
      if (result.success) {
        documents++;
      } else {
        errors.push(`Failed to ingest "${doc.title}" in ${slug}: ${result.error}`);
      }
    }
  }

  log.info('Strategic brief seed completed', {
    documents,
    skipped,
    errors: errors.length,
    durationMs: Date.now() - startTime,
  });

  return { documents, skipped, errors };
}
