import { createLogger } from '../utils/logger';

const log = createLogger('node:enrich-knowledge');

const BRAND_GUIDELINES = `FemiGlow — Maison de soin japonaise pour les ongles et les mains.

Valeurs fondamentales :
- Le geste avant le résultat : précision, patience, rituel
- Beauté japonaise authentique (J-Beauty) : minimalisme, ingrédients naturels
- Éclat naturel sans vernis ni abrasion
- Transmission et attention discrète

Ton éditorial :
- Français élégant, sobre, sensoriel
- Jamais d'emoji, jamais de point d'exclamation
- Aucune urgence commerciale, aucune promesse médicale
- Vocabulaire : geste, rituel, éclat, lumière, précision, patience, soin

Identité visuelle :
- Palette : crème, sauge, blanc chaud, rose poudré
- Lumière naturelle, tons chauds
- Mains, produits, textures en gros plan
- Style minimal japonais, compositions centrées ou rule-of-thirds

Produits clés :
- Kit de soin FemiGlow (produit phare)
- Huiles et crèmes pour ongles et cuticules
- Accessoires de soin (polissoir, repoussoir)

Ingrédients japonais hero :
- Huile de camélia (Tsubaki)
- Extrait de riz (Komenuka)
- Matcha, Yuzu, Sakura
- Huile de Sake (Nihonshu)`;

export async function enrichKnowledgeNode(state: Record<string, unknown>): Promise<Record<string, unknown>> {
  const jobId = state.jobId as string;
  log.info('Enriching with knowledge context', { jobId, node: 'enrich_knowledge' });

  const startTime = Date.now();

  // MVP: static brand guidelines + basic knowledge context
  // V1: RAG from pgvector knowledge base
  const knowledgeContext = buildKnowledgeContext(state);

  const durationMs = Date.now() - startTime;
  log.info('Knowledge enriched', { jobId, node: 'enrich_knowledge', durationMs });

  return {
    knowledgeContext,
    brandGuidelines: BRAND_GUIDELINES,
    currentStep: 'enrich_knowledge',
  };
}

function buildKnowledgeContext(state: Record<string, unknown>): string {
  const brief = state.briefInput as Record<string, unknown>;
  const platform = state.platform as string;
  const format = state.format as string;
  const contentType = state.contentType as string;
  const objective = brief.objective as string;

  const chunks: string[] = [];

  // Platform-specific best practices
  if (platform === 'instagram') {
    chunks.push(`Instagram Best Practices (${format}):
- Les Reels de 15-30s ont le meilleur engagement
- Le hook visuel doit capter en 1.5 secondes
- Les saves et partages DM sont les signaux #1 de l'algorithme
- Hashtags : mix 3 niche + 3 mid + 3 broad
- Les carrousels éducatifs ont 3x plus de saves que les posts simples
- SEO caption : mots-clés dans les 2 premières lignes`);
  } else if (platform === 'facebook') {
    chunks.push(`Facebook Best Practices (${format}):
- Les Reels sont prioritaires dans l'algorithme 2025-2026
- Le contenu original est boosté vs. recyclé
- Les vidéos courtes (<30s) performent mieux
- Les groupes amplifient la portée organique`);
  }

  // Objective-specific knowledge
  if (objective === 'conversion') {
    chunks.push(`Psychologie de conversion (beauté):
- Le parcours skincare : éducation → confiance → essai → fidélité
- Framing gain : "Retrouvez l'éclat" > "Évitez les ongles ternes"
- La preuve sociale renforce la confiance (UGC-style)
- CTA doux : "Découvrir", "En savoir plus" > "Acheter maintenant"`);
  } else if (objective === 'engagement') {
    chunks.push(`Engagement maximal (contenu beauté):
- Questions ouvertes en caption → commentaires
- Before/after → saves
- Routines et rituels → partages DM
- Carrousels "X étapes" → saves + partages`);
  } else if (objective === 'awareness') {
    chunks.push(`Notoriété (contenu beauté):
- Tendances et trends surfing → portée Explore/FYP
- Storytelling culturel japonais → différenciation
- Contenu éducatif sur les ingrédients → autorité
- Collaborations et UGC → reach organique`);
  }

  // Content pillar specific
  if (contentType === 'produit') {
    chunks.push(`Pilier Produit:
- Hero shot centré, lumière naturelle
- Texture visible, geste d'application
- Bénéfice sensoriel plutôt que technique
- Mise en scène lifestyle (pas de fond blanc nu)`);
  } else if (contentType === 'rituel') {
    chunks.push(`Pilier Rituel:
- Séquence de gestes, progression narrative
- Ambiance calme, lumière chaude
- Focus sur les mains et le mouvement
- Temps de pause, contemplation`);
  }

  // Neuromarketing applicable
  chunks.push(`Neuromarketing applicable:
- Mere exposure effect : cohérence visuelle entre les posts renforce la familiarité
- Biais de halo : la qualité perçue du contenu s'étend au produit
- Preuve sociale implicite : montrer le rituel "en usage" vs. le produit seul
- Arousal émotionnel modéré (calme, satisfaction) → partage
- Les visages et les mains captent l'attention pré-attentive en <500ms`);

  return chunks.join('\n\n---\n\n');
}
