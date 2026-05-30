import { createLogger } from '../utils/logger';
import { searchByCollections, type SearchResult } from '../knowledge';

const log = createLogger('node:enrich-knowledge');

const BRAND_GUIDELINES = `FemiGlow — Maison de soin japonaise pour les ongles et les mains.

Valeurs fondamentales :
- Le geste avant le resultat : precision, patience, rituel
- Beaute japonaise authentique (J-Beauty) : minimalisme, ingredients naturels
- Eclat naturel sans vernis ni abrasion
- Transmission et attention discrete

Ton editorial :
- Francais elegant, sobre, sensoriel
- Jamais d'emoji, jamais de point d'exclamation
- Aucune urgence commerciale, aucune promesse medicale
- Vocabulaire : geste, rituel, eclat, lumiere, precision, patience, soin

Identite visuelle :
- Palette : creme, sauge, blanc chaud, rose poudre
- Lumiere naturelle, tons chauds
- Mains, produits, textures en gros plan
- Style minimal japonais, compositions centrees ou rule-of-thirds

Produits cles :
- Kit de soin FemiGlow (produit phare)
- Huiles et cremes pour ongles et cuticules
- Accessoires de soin (polissoir, repoussoir)

Ingredients japonais hero :
- Huile de camellia (Tsubaki)
- Extrait de riz (Komenuka)
- Matcha, Yuzu, Sakura
- Huile de Sake (Nihonshu)`;

const COLLECTION_MAP: Record<string, string[]> = {
  instagram: ['platform-algorithms', 'viral-content'],
  facebook: ['platform-algorithms', 'viral-content'],
  tiktok: ['platform-algorithms', 'viral-content'],
  pinterest: ['platform-algorithms'],
  youtube: ['platform-algorithms', 'viral-content'],
  linkedin: ['platform-algorithms'],
  twitter: ['platform-algorithms', 'viral-content'],
  threads: ['platform-algorithms', 'viral-content'],
};

const OBJECTIVE_COLLECTIONS: Record<string, string[]> = {
  conversion: ['neuromarketing', 'copywriting'],
  engagement: ['neuromarketing', 'viral-content'],
  awareness: ['viral-content', 'emerging-trends'],
  education: ['neuromarketing', 'jbeauty-strategy'],
  entertainment: ['viral-content'],
};

const CONTENT_TYPE_COLLECTIONS: Record<string, string[]> = {
  produit: ['products-ingredients', 'brand-femiglow'],
  rituel: ['brand-femiglow', 'jbeauty-strategy'],
  education: ['neuromarketing', 'jbeauty-strategy'],
  temoignage: ['brand-femiglow'],
  tendance: ['emerging-trends', 'viral-content'],
};

export async function enrichKnowledgeNode(state: Record<string, unknown>): Promise<Record<string, unknown>> {
  const jobId = state.jobId as string;
  log.info('Enriching with knowledge context', { jobId, node: 'enrich_knowledge' });

  const startTime = Date.now();

  let knowledgeContext: string;
  let ragUsed = false;

  try {
    const ragContext = await retrieveRagContext(state);
    if (ragContext) {
      knowledgeContext = ragContext;
      ragUsed = true;
    } else {
      knowledgeContext = buildStaticKnowledgeContext(state);
    }
  } catch (err) {
    log.warn('RAG retrieval failed, falling back to static knowledge', {
      jobId,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
    knowledgeContext = buildStaticKnowledgeContext(state);
  }

  const durationMs = Date.now() - startTime;
  log.info('Knowledge enriched', { jobId, node: 'enrich_knowledge', durationMs, ragUsed });

  return {
    knowledgeContext,
    brandGuidelines: BRAND_GUIDELINES,
    currentStep: 'enrich_knowledge',
  };
}

async function retrieveRagContext(state: Record<string, unknown>): Promise<string | null> {
  const brief = (state.brief ?? state.briefInput) as Record<string, unknown> | undefined;
  const platform = state.platform as string | undefined;
  const contentType = state.contentType as string | undefined;
  const objective = ((brief as Record<string, unknown> | undefined)?.objective as string) ?? '';

  const targetCollections = new Set<string>();
  targetCollections.add('brand-femiglow');

  if (platform && COLLECTION_MAP[platform]) {
    for (const slug of COLLECTION_MAP[platform]) targetCollections.add(slug);
  }
  if (objective && OBJECTIVE_COLLECTIONS[objective]) {
    for (const slug of OBJECTIVE_COLLECTIONS[objective]) targetCollections.add(slug);
  }
  if (contentType && CONTENT_TYPE_COLLECTIONS[contentType]) {
    for (const slug of CONTENT_TYPE_COLLECTIONS[contentType]) targetCollections.add(slug);
  }

  const slugs = Array.from(targetCollections);
  const keyMessage = (brief?.keyMessage as string) ?? '';
  const query = [
    `${platform ?? ''} ${contentType ?? ''} content`,
    objective,
    keyMessage,
    brief?.productFocus as string ?? '',
  ].filter(Boolean).join(' ');

  if (!query.trim()) return null;

  const results = await searchByCollections(query, slugs, 8);
  if (results.length === 0) return null;

  return formatRagResults(results);
}

function formatRagResults(results: SearchResult[]): string {
  const grouped = new Map<string, SearchResult[]>();
  for (const r of results) {
    const key = r.documentTitle;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(r);
  }

  const sections: string[] = [];
  for (const [title, chunks] of grouped) {
    const content = chunks
      .sort((a, b) => b.similarity - a.similarity)
      .map((c) => c.content)
      .join('\n\n');
    sections.push(`[${title}]\n${content}`);
  }

  return sections.join('\n\n---\n\n');
}

function buildStaticKnowledgeContext(state: Record<string, unknown>): string {
  const brief = (state.brief ?? state.briefInput) as Record<string, unknown>;
  const platform = state.platform as string;
  const format = state.format as string;
  const contentType = state.contentType as string;
  const objective = brief.objective as string;

  const chunks: string[] = [];

  if (platform === 'instagram') {
    chunks.push(`Instagram Best Practices (${format}):
- Les Reels de 15-30s ont le meilleur engagement
- Le hook visuel doit capter en 1.5 secondes
- Les saves et partages DM sont les signaux #1 de l'algorithme
- Hashtags : mix 3 niche + 3 mid + 3 broad
- Les carrousels educatifs ont 3x plus de saves que les posts simples
- SEO caption : mots-cles dans les 2 premieres lignes`);
  } else if (platform === 'facebook') {
    chunks.push(`Facebook Best Practices (${format}):
- Les Reels sont prioritaires dans l'algorithme 2025-2026
- Le contenu original est booste vs. recycle
- Les videos courtes (<30s) performent mieux
- Les groupes amplifient la portee organique`);
  }

  if (objective === 'conversion') {
    chunks.push(`Psychologie de conversion (beaute):
- Le parcours skincare : education -> confiance -> essai -> fidelite
- Framing gain : "Retrouvez l'eclat" > "Evitez les ongles ternes"
- La preuve sociale renforce la confiance (UGC-style)
- CTA doux : "Decouvrir", "En savoir plus" > "Acheter maintenant"`);
  } else if (objective === 'engagement') {
    chunks.push(`Engagement maximal (contenu beaute):
- Questions ouvertes en caption -> commentaires
- Before/after -> saves
- Routines et rituels -> partages DM
- Carrousels "X etapes" -> saves + partages`);
  } else if (objective === 'awareness') {
    chunks.push(`Notoriete (contenu beaute):
- Tendances et trends surfing -> portee Explore/FYP
- Storytelling culturel japonais -> differenciation
- Contenu educatif sur les ingredients -> autorite
- Collaborations et UGC -> reach organique`);
  }

  if (contentType === 'produit') {
    chunks.push(`Pilier Produit:
- Hero shot centre, lumiere naturelle
- Texture visible, geste d'application
- Benefice sensoriel plutot que technique
- Mise en scene lifestyle (pas de fond blanc nu)`);
  } else if (contentType === 'rituel') {
    chunks.push(`Pilier Rituel:
- Sequence de gestes, progression narrative
- Ambiance calme, lumiere chaude
- Focus sur les mains et le mouvement
- Temps de pause, contemplation`);
  }

  chunks.push(`Neuromarketing applicable:
- Mere exposure effect : coherence visuelle entre les posts renforce la familiarite
- Biais de halo : la qualite perçue du contenu s'etend au produit
- Preuve sociale implicite : montrer le rituel "en usage" vs. le produit seul
- Arousal emotionnel modere (calme, satisfaction) -> partage
- Les visages et les mains captent l'attention pre-attentive en <500ms`);

  return chunks.join('\n\n---\n\n');
}
