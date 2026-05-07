export const routes = {
  home: '/',
  rituel: '/rituel',
  kit: '/kit',
  journal: '/journal',
  article: (slug: string) => `/journal/${slug}`,
  maison: '/maison',
  panier: '/panier',
  commander: '/commander',
  merci: (orderId: string) => `/merci?order=${orderId}`,
  contact: '/contact',
} as const;

export type AppRoute = keyof typeof routes;
