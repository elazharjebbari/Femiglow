import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const revalidate = 3600;

const DEFAULT_POLICY = `Comment ces rituels partagés sont vérifiés.

Chaque rituel publié sur cette page vient d'une initiée qui a reçu le pack FemiGlow et l'a pratiqué chez elle.

Nous le lisons à la main, dans nos heures de calme, sous 48 heures. Nous ne réécrivons pas. Nous corrigeons parfois une apostrophe, jamais une intention.

Pour préserver l'intimité de notre maison, nous publions des mains, des gestes, des tables de soin — jamais de visage de face. Les émoticônes n'entrent pas non plus dans notre grammaire ; nous les retirons à la lecture.

Si vous souhaitez retirer votre voix, écrivez-nous à info@femiglow-maroc.com. Nous l'archiverons sous trois jours.

Avec soin,
L'équipe FemiGlow`;

export function GET() {
  return NextResponse.json(
    { data: { text: DEFAULT_POLICY, version: 1 } },
    {
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    },
  );
}
