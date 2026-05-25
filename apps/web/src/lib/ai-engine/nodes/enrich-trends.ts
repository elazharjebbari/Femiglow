import { createLogger } from '../utils/logger';

const log = createLogger('node:enrich-trends');

interface TrendSignal {
  title: string;
  category: string;
  relevance: number;
  suggestedAngle: string;
}

function getStaticTrends(): TrendSignal[] {
  const now = new Date();
  const month = now.getMonth();

  const yearRound: TrendSignal[] = [
    {
      title: 'Self-care rituals',
      category: 'routine',
      relevance: 0.85,
      suggestedAngle: 'Le rituel comme moment de reconnexion avec soi',
    },
    {
      title: 'J-Beauty minimalisme',
      category: 'aesthetic',
      relevance: 0.9,
      suggestedAngle: 'Moins de produits, plus de gestes intentionnels',
    },
    {
      title: 'Clean beauty ingredients',
      category: 'ingredient',
      relevance: 0.8,
      suggestedAngle: 'La transparence des ingrédients japonais',
    },
  ];

  const seasonal: TrendSignal[] = [];

  // Spring (March-May)
  if (month >= 2 && month <= 4) {
    seasonal.push({
      title: 'Sakura season',
      category: 'seasonal',
      relevance: 0.95,
      suggestedAngle: 'La beauté éphémère et le renouveau printanier',
    });
    seasonal.push({
      title: 'Spring skincare refresh',
      category: 'routine',
      relevance: 0.8,
      suggestedAngle: 'Adapter son rituel au changement de saison',
    });
  }

  // Summer (June-August)
  if (month >= 5 && month <= 7) {
    seasonal.push({
      title: 'Summer nail care',
      category: 'routine',
      relevance: 0.85,
      suggestedAngle: 'Protéger et nourrir les ongles en été',
    });
    seasonal.push({
      title: 'Matsuri & Obon',
      category: 'cultural',
      relevance: 0.75,
      suggestedAngle: 'Les festivités japonaises d\'été et la beauté',
    });
  }

  // Fall (September-November)
  if (month >= 8 && month <= 10) {
    seasonal.push({
      title: 'Autumn hydration',
      category: 'routine',
      relevance: 0.85,
      suggestedAngle: 'Intensifier l\'hydratation à l\'approche du froid',
    });
    seasonal.push({
      title: 'Momijigari (contemplation des feuilles)',
      category: 'cultural',
      relevance: 0.7,
      suggestedAngle: 'L\'art japonais de la contemplation saisonnière',
    });
  }

  // Winter (December-February)
  if (month >= 11 || month <= 1) {
    seasonal.push({
      title: 'Winter nail repair',
      category: 'routine',
      relevance: 0.9,
      suggestedAngle: 'Réparer et protéger les ongles du froid',
    });
    seasonal.push({
      title: 'Setsubun & Oshogatsu',
      category: 'cultural',
      relevance: 0.75,
      suggestedAngle: 'Le renouveau japonais de début d\'année',
    });
    seasonal.push({
      title: 'Gift sets & rituals',
      category: 'product',
      relevance: 0.85,
      suggestedAngle: 'Offrir un rituel plutôt qu\'un simple produit',
    });
  }

  return [...yearRound, ...seasonal]
    .sort((a, b) => b.relevance - a.relevance);
}

export async function enrichTrendsNode(state: Record<string, unknown>): Promise<Record<string, unknown>> {
  const jobId = state.jobId as string;
  log.info('Enriching with trend context', { jobId, node: 'enrich_trends' });

  const startTime = Date.now();

  // MVP: static seasonal trends
  // V2: real-time trend signals from Google Trends, TikTok, Instagram, etc.
  const trends = getStaticTrends();
  const brief = (state.brief ?? state.briefInput) as Record<string, unknown>;
  const trendRef = brief.trendReference as string | undefined;

  const relevantTrends = trends
    .filter((t) => t.relevance >= 0.7)
    .slice(0, 5);

  if (trendRef) {
    relevantTrends.unshift({
      title: trendRef,
      category: 'manual',
      relevance: 1.0,
      suggestedAngle: `Exploiter la tendance "${trendRef}" avec l'angle FemiGlow`,
    });
  }

  const trendContext = relevantTrends
    .map((t) => `[${t.category}] ${t.title} (pertinence: ${t.relevance})\nAngle: ${t.suggestedAngle}`)
    .join('\n\n');

  const durationMs = Date.now() - startTime;
  log.info('Trends enriched', { jobId, node: 'enrich_trends', durationMs, data: { trendsCount: relevantTrends.length } });

  return {
    trendContext,
    currentStep: 'enrich_trends',
  };
}
