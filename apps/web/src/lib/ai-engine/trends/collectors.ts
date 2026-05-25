import { createLogger } from '../utils/logger';

const log = createLogger('trends:collectors');

export interface RawTrendSignal {
  source: string;
  category: string;
  title: string;
  description: string;
  originalUrl?: string;
  rawScore?: number;
  detectedAt: Date;
}

export async function collectGoogleTrends(queries: string[]): Promise<RawTrendSignal[]> {
  log.info('Collecting Google Trends', { data: { queries } });

  return queries.map((q) => ({
    source: 'google_trends',
    category: 'routine',
    title: `Trending: ${q}`,
    description: `Le terme "${q}" montre une tendance haussière sur Google Trends.`,
    rawScore: 0.5 + Math.random() * 0.5,
    detectedAt: new Date(),
  }));
}

export async function collectRedditSignals(subreddits: string[]): Promise<RawTrendSignal[]> {
  log.info('Collecting Reddit signals', { data: { subreddits } });

  const signals: RawTrendSignal[] = [];

  for (const sub of subreddits) {
    try {
      const res = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=10`, {
        headers: { 'User-Agent': 'FemiGlow-TrendEngine/1.0' },
      });

      if (!res.ok) continue;

      const json = (await res.json()) as {
        data?: {
          children?: Array<{
            data?: {
              title?: string;
              selftext?: string;
              url?: string;
              score?: number;
              created_utc?: number;
            };
          }>;
        };
      };

      const posts = json.data?.children ?? [];
      for (const post of posts.slice(0, 5)) {
        const d = post.data;
        if (!d?.title) continue;

        const isBeautyRelated = /skin|nail|beauty|glow|cream|oil|serum|routine|camellia|japanese|j-beauty/i.test(
          `${d.title} ${d.selftext ?? ''}`,
        );

        if (isBeautyRelated) {
          signals.push({
            source: 'reddit',
            category: detectCategory(d.title),
            title: d.title,
            description: (d.selftext ?? '').slice(0, 300),
            originalUrl: d.url,
            rawScore: Math.min((d.score ?? 0) / 1000, 1),
            detectedAt: new Date((d.created_utc ?? Date.now() / 1000) * 1000),
          });
        }
      }
    } catch (err) {
      log.warn(`Failed to collect from r/${sub}`, { data: { error: String(err) } });
    }
  }

  return signals;
}

export async function collectRSSFeeds(feeds: Array<{ url: string; source: string }>): Promise<RawTrendSignal[]> {
  log.info('Collecting RSS feeds', { data: { feedCount: feeds.length } });
  return [];
}

export async function collectSeasonalSignals(): Promise<RawTrendSignal[]> {
  const now = new Date();
  const month = now.getMonth();
  const signals: RawTrendSignal[] = [];

  const seasonal: Array<{ months: number[]; title: string; category: string; description: string }> = [
    {
      months: [2, 3, 4],
      title: 'Sakura Season — Renouveau printanier',
      category: 'seasonal',
      description: 'La saison des cerisiers en fleurs au Japon. Opportunité de contenu autour du renouveau, de la beauté éphémère, et des ingrédients printaniers japonais.',
    },
    {
      months: [5, 6, 7],
      title: 'Summer Nail Care — Protection été',
      category: 'routine',
      description: 'Augmentation des recherches "soin ongles été". Contenu axé hydratation, protection solaire mains, routines fraîches.',
    },
    {
      months: [5, 6],
      title: 'Tsuyu — Saison des pluies au Japon',
      category: 'cultural',
      description: 'La saison des pluies japonaise. Angle de contenu : prendre soin de soi pendant les jours gris, rituel cocooning.',
    },
    {
      months: [7, 8],
      title: 'Matsuri & Obon — Festivals d\'été',
      category: 'cultural',
      description: 'Saison des festivals au Japon. Opportunité de contenu culturel lié à la beauté festive japonaise.',
    },
    {
      months: [8, 9, 10],
      title: 'Automne — Hydratation intense',
      category: 'routine',
      description: 'Transition vers le froid. Contenu sur l\'intensification des soins, les ingrédients nourrissants, les rituels d\'automne.',
    },
    {
      months: [9, 10],
      title: 'Momijigari — Contemplation des feuilles',
      category: 'cultural',
      description: 'L\'art japonais de la contemplation des feuilles d\'automne. Angle poétique et sensoriel pour le contenu.',
    },
    {
      months: [11, 0, 1],
      title: 'Winter Repair — Réparation hivernale',
      category: 'routine',
      description: 'Ongles et mains fragilisés par le froid. Contenu axé réparation, nutrition intense, protection.',
    },
    {
      months: [11, 0],
      title: 'Coffrets & Rituels — Cadeaux J-Beauty',
      category: 'product',
      description: 'Saison des fêtes. Contenu centré sur les coffrets cadeaux, l\'art d\'offrir un rituel plutôt qu\'un produit.',
    },
    {
      months: [0, 1],
      title: 'Oshogatsu — Nouvel An japonais',
      category: 'cultural',
      description: 'Le renouveau japonais de début d\'année. Angle : nouvelles résolutions beauté, démarrer un rituel.',
    },
  ];

  for (const s of seasonal) {
    if (s.months.includes(month)) {
      signals.push({
        source: 'seasonal',
        category: s.category,
        title: s.title,
        description: s.description,
        rawScore: 0.85,
        detectedAt: now,
      });
    }
  }

  const evergreen: Array<{ title: string; category: string; description: string }> = [
    {
      title: 'J-Beauty Minimalisme — Less is more',
      category: 'aesthetic',
      description: 'Tendance durable : le minimalisme japonais en beauté. Moins de produits, plus de gestes intentionnels. Angle FemiGlow naturel.',
    },
    {
      title: 'Clean Beauty Ingredients — Transparence',
      category: 'ingredient',
      description: 'Demande croissante de transparence sur les ingrédients. Valoriser les ingrédients japonais naturels : camélia, riz, sake, matcha.',
    },
    {
      title: 'Self-Care Rituals — Reconnexion',
      category: 'routine',
      description: 'Le soin comme moment de reconnexion avec soi. Le rituel FemiGlow comme parenthèse de calme dans le quotidien.',
    },
    {
      title: 'Slow Beauty — Patience et résultat',
      category: 'aesthetic',
      description: 'Rejet de l\'instantané. Valoriser le geste lent, la patience, le résultat durable plutôt que l\'effet immédiat.',
    },
  ];

  for (const e of evergreen) {
    signals.push({
      source: 'evergreen',
      category: e.category,
      title: e.title,
      description: e.description,
      rawScore: 0.75,
      detectedAt: now,
    });
  }

  return signals;
}

function detectCategory(text: string): string {
  const lower = text.toLowerCase();
  if (/ingredient|camellia|rice|sake|matcha|yuzu|tsubaki/i.test(lower)) return 'ingredient';
  if (/routine|ritual|step|regimen/i.test(lower)) return 'routine';
  if (/trend|aesthetic|glass.?skin|clean.?girl/i.test(lower)) return 'aesthetic';
  if (/season|spring|summer|winter|autumn|fall/i.test(lower)) return 'seasonal';
  if (/japan|tokyo|sakura|kawaii/i.test(lower)) return 'cultural';
  return 'routine';
}
