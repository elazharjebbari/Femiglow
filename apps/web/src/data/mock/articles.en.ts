/**
 * Mock articles EN — versions anglais (international sobre) de `mockArticles` (FR).
 *
 * Phase 3 T3.7 — Articles du journal traduits. Bodies issus des seeds
 * `docs/i18n-content-2026-05/03-seed-data/mock-data-en.json`. Méta
 * (slugs FR canonical, dates, images, catégories, isFeatured, wordCount)
 * copiées depuis le mock FR canonical pour garantir parité (ADR-002 —
 * pathnames identiques entre locales).
 *
 * Stratégie : on redéfinit explicitement chaque champ plutôt que spread
 * pour éviter les type errors `optional fields` sur sous-objets imbriqués
 * (`featuredImage`, `author`) — cf. PHASE-3-PROGRESS.md §Gotchas.
 *
 * Voix EN : docs/i18n-content-2026-05/00-style-reference.md §5.
 *
 * @see docs/i18n-content-2026-05/03-seed-data/component-bindings-en.csv
 */
import type { Article } from '@/lib/schemas';

export const mockArticlesEn: Article[] = [
  {
    slug: 'hiver-ongles-patience',
    title: 'Winter, nails, patience',
    kicker: 'Season',
    excerpt: 'The dry cold of Rabat parches all that resists. Nails bend, but do not break — provided one slows down.',
    category: 'saison',
    readingTimeMinutes: 4,
    publishedAt: new Date('2026-01-12'),
    updatedAt: new Date('2026-01-12'),
    featuredImage: {
      src: '/journal/hiver-ongles-patience.svg',
      alt: 'Hands at rest on a pale wooden table, soft winter light',
      width: 1600,
      height: 1067,
    },
    author: {
      name: 'The FemiGlow team',
      bio: 'Founder of Maison FemiGlow. Biologist and formulator, she writes from Rabat on slow care and the materials of the Maghreb.',
    },
    body: `When the dry air settles over Rabat in January, we stop expecting nails to shine. We ask them to hold. A change of register, almost imperceptible, that makes all the difference.

## A truly dry season

Rabat's winter is not a winter of snow. It is a winter of wind. The air comes from the north-east, crosses the Mediterranean, lands on the coast with a deceptive humidity. The skin is not fooled. The cuticles even less.

We first notice a new roughness at the edge of the nail. Then a white drawing on the surface, like a chalk trace. That is the sign keratin is thirsty.

## The slow ritual

In winter, the ritual narrows. We keep the oil, we keep the base. We remove the rest. Three gestures are enough:

- Place a drop of oil on the cuticle, in the evening, before bed.
- Massage gently, from the middle of the nail toward the base, for thirty seconds.
- Do nothing else.

## What winter teaches

At the end of January, we observe something curious: the nail has not grown faster, but it has grown straighter. The curve is purer, the wave softer. That is the effect of an entire season without excessive manipulation.

Winter passes. The nails will have listened; it is for us, simply, to have listened with them.`,
    isFeatured: false,
    wordCount: 820,
    seo: { noIndex: false },
  },
  {
    slug: 'matieres-d-ailleurs',
    title: 'Materials from elsewhere',
    excerpt: 'Sourcing speaks of honesty. Here is what really makes up our care, and where the materials come from.',
    category: 'matieres',
    readingTimeMinutes: 5,
    publishedAt: new Date('2026-02-03'),
    updatedAt: new Date('2026-02-03'),
    featuredImage: {
      src: '/journal/matieres-d-ailleurs.svg',
      alt: 'Close-up on raw ingredients — oil, powder',
      width: 1600,
      height: 1067,
    },
    author: {
      name: 'The FemiGlow team',
      bio: 'Founder of Maison FemiGlow. Biologist and formulator, she writes from Rabat on slow care and the materials of the Maghreb.',
    },
    body: `When we formulate, we begin with a map. Where the beeswax is born, where the jojoba is pressed, where the kaolin is ground. Sourcing is not a technical detail — it is what we pass on in every jar.

## Four materials, four paths

We buy the beeswax from a cooperative in the Middle Atlas. Melted at low heat, filtered through linen. It never reaches the atelier without passing through three hands.

The jojoba comes from Souss-Massa, a Moroccan organic supply chain. Cold-pressed, gravity-filtered. No heat, no solvent.

The kaolin is mineral, extracted from a quarry near Marrakech. Washed seven times before drying. Polishing, free of heavy metals.

The rice powder, finally, comes from traced organic Asian crops. A small grain, a fine starch, no residue.

## What we do not buy

Longer than the list of what we choose, the list of what we refuse. No parabens, no phthalates, no toluene. No volatile solvents, no industrial hardeners. No untraced animal gelatine.

The halal certification comes from the Halal Cosmetics Council. The audit is annual, all materials are traced from source.

## The real cost

Honesty has a price. Direct buying costs more than going through a broker. Forming a cooperative takes time. All of this is in the price of the kit — the maison hides nothing.

The materials that go into a Paste jar cost more than the off-the-shelf list. But what enters the nail does not need a distributor — it needs trust.`,
    isFeatured: false,
    wordCount: 1100,
    seo: { noIndex: false },
  },
  {
    slug: 'paste-et-powder-deux-gestes',
    title: 'Paste and powder — two gestures',
    excerpt: 'Two gestures, a quiet glow. A detailed sensory tutorial — paste, powder, Step 4 buffer.',
    category: 'pratique',
    readingTimeMinutes: 5,
    publishedAt: new Date('2026-02-18'),
    updatedAt: new Date('2026-02-18'),
    featuredImage: {
      src: '/journal/cinq-minutes-le-soir.svg',
      alt: 'Paste jar, powder jar and buffer aligned, soft light',
      width: 1600,
      height: 1067,
    },
    author: {
      name: 'The FemiGlow team',
      bio: 'Founder of Maison FemiGlow. Biologist and formulator, she writes from Rabat on slow care and the materials of the Maghreb.',
    },
    body: `Before practising the gesture, live it by proxy. Paste in one hand, powder in the other, the buffer beside. Three pieces, a fixed order.

## Paste — the first gesture

A hazelnut-sized amount. No more. You touch the paste with your thumb, then trace it across the nail from base to tip. The beeswax is warm, the jojoba glides. The pace is slow, the pressure light.

The nail absorbs what it needs. The excess stays on the surface — not a problem. The powder will take care of it.

## Powder — the second gesture

A small pinch. You dust it over the plate with a dry finger. The cosmetic talc absorbs the excess, the rice powder softens, the silica reveals the glide.

The touch changes. Matte, then satin. That is the cue for the third gesture.

## Step 4 buffer — the final touch

Three sides, from rough to smooth. You begin with the first, a slow stroke from base to tip. Then the second side, the same motion. Then the third — that is the one that reveals the shine.

Do not press. The plate responds to the gesture, not to force. Five minutes, stop.

## After

The hand breathes. No polish, no solvent, no forced drying. The glow is there, simple, natural. You will come back tomorrow, or another day. The ritual does not demand insistence.`,
    isFeatured: false,
    wordCount: 700,
    seo: { noIndex: false },
  },
  {
    slug: 'la-maison-au-printemps',
    title: 'The maison, in spring',
    excerpt: 'The Rabat atelier changes its breath when the orange tree blossoms. A visit during a month when the light returns.',
    category: 'maison',
    readingTimeMinutes: 6,
    publishedAt: new Date('2026-03-10'),
    updatedAt: new Date('2026-03-10'),
    featuredImage: {
      src: '/journal/la-maison-au-printemps.svg',
      alt: 'Rabat atelier, morning light on a wooden table',
      width: 1600,
      height: 1067,
    },
    author: {
      name: 'The FemiGlow team',
      bio: 'Founder of Maison FemiGlow. Biologist and formulator, she writes from Rabat on slow care and the materials of the Maghreb.',
    },
    body: `In Rabat, spring begins in the courtyard. The orange tree blossoms before the walls. The windows open, the atelier finds its scent again.

## A different light

The Rabat winter warmed itself with lamps. Spring restores natural light. The table that holds the samples receives indirect sunlight, in the morning and at the end of the afternoon. The shine changes — each material looks slightly different.

We rearrange the bottles. The beeswax stays in the shade, the kaolin is set out in the light. Not a superstition — heat changes texture, light changes perception. The maison adapts.

## A different rhythm

Orders multiply. Voices of women whose hands prepare for Ramadan, for weddings, for celebrations. Preparing the kits takes longer. Our founder mentors two apprentices, young women from Rabat learning to formulate.

We receive by appointment, on Tuesdays and Thursdays. These visitors sometimes come in silence, they look, ask a question, leave with a small book of samples.

## What stays

Spring is an active season, but not a rush. We tidy the supplies, reread the labels, refresh a few formulas — only what deserves it.

The ritual does not change. Five minutes in the evening, paste, powder, Step 4 buffer. The season renews the material, not the gesture.`,
    isFeatured: false,
    wordCount: 1200,
    seo: { noIndex: false },
  },
  {
    slug: 'voix-d-amal',
    title: 'The voice of Amal',
    excerpt: 'Three months of ritual, told by the one who held them. No promises, no cliché before-and-after.',
    category: 'voix',
    readingTimeMinutes: 7,
    publishedAt: new Date('2026-03-18'),
    updatedAt: new Date('2026-03-18'),
    featuredImage: {
      src: '/journal/voix-d-amal.svg',
      alt: 'Amal\'s hands resting on an open book',
      width: 1600,
      height: 1067,
    },
    author: {
      name: 'The FemiGlow team',
      bio: 'Founder of Maison FemiGlow. Biologist and formulator, she writes from Rabat on slow care and the materials of the Maghreb.',
    },
    body: `Amal lives in Rabat. She teaches French in a secondary school in Hassan. She wrote to us in February. She had started the ritual in November. Three months on, she asked to tell.

## The beginning

"My nails were breaking. Not all of them — my right hand more. I was making excuses: the cold, the chalk, all the writing. But the truth was I was ignoring them."

She continues: "When the kit arrived, I opened it on the kitchen table. Small jars, a blue buffer. No complicated instructions. I read the card, then I began."

The first week, doubts. "I felt nothing was happening. I pressed harder the next days, thinking it would speed things up."

Our founder, when she read the letter, smiled. "That is the most common gesture. The ritual does not accelerate, it accumulates."

## After a month

"A month in, I saw something. Not a shine — a clarity. The plate was no longer white at the edges. The cuticle had softened, I could move it back with a fingernail without breaking it."

Amal does not speak of a "result". She speaks of "something happening". The difference matters — it does not announce, it does not promise. It observes, it records.

## Three months

"Today, I do not break. The last break was early December. Since then, nothing."

She said a colleague noticed. Asked what she used. "I answered honestly: five minutes in the evening. She did not believe me."

## What she expects

"I am waiting for summer. I want to see what happens when the dryness returns. And I want to know — if I stop for a month, do I come back? Do I break again?"

These are not anxious questions. They are research questions. The maison is glad to have Amal. The ritual will answer through the next season.`,
    isFeatured: false,
    wordCount: 1450,
    seo: { noIndex: false },
  },
  {
    slug: 'pluie-de-mars',
    title: 'March rain',
    excerpt: 'Humidity returns to the coast. Cuticles breathe, gestures can be spaced out.',
    category: 'saison',
    readingTimeMinutes: 3,
    publishedAt: new Date('2026-03-25'),
    updatedAt: new Date('2026-03-25'),
    featuredImage: {
      src: '/journal/pluie-de-mars.svg',
      alt: 'Raindrops on a window, plant in the background',
      width: 1600,
      height: 1067,
    },
    author: {
      name: 'The FemiGlow team',
      bio: 'Founder of Maison FemiGlow. Biologist and formulator, she writes from Rabat on slow care and the materials of the Maghreb.',
    },
    body: `In March, the sky drops on the coast what was withheld all of January and February. The air changes, the skin recovers its suppleness, the nail breathes.

## The transition

January was dry. We applied paste daily. In March, the gestures can space out — two or three times a week is enough. The plate is no longer thirsty.

This is a subtle but important change. The ritual does not impose a single tempo — it follows the season. Insistence under humidity does not serve, it weighs down.

## Cuticles in spring

The friction of winter is left behind. The skin around the plate recovers elasticity. We no longer need oil every evening. Jojoba oil once a week, a slow circular motion, is enough.

The touch after the ritual is soft, light. Not greasy, not forcibly shiny. That is what the hand asks for in March.

## Listening, not applying

The most common spring mistake: continuing the winter rhythm. Too much paste leads to a shiny but closed plate. A sign that we have gone beyond what the skin asked.

The ritual listens. It asks: do you need this today? If the nail says no, we leave it. Tomorrow, we ask again.`,
    isFeatured: false,
    wordCount: 680,
    seo: { noIndex: false },
  },
  {
    slug: 'la-poudre-de-kaolin',
    title: 'Kaolin powder',
    excerpt: 'White clay, soft, neutral. How it enters the base and why it stays.',
    category: 'matieres',
    readingTimeMinutes: 4,
    publishedAt: new Date('2026-04-02'),
    updatedAt: new Date('2026-04-02'),
    featuredImage: {
      src: '/journal/la-poudre-de-kaolin.svg',
      alt: 'White kaolin powder in a ceramic bowl',
      width: 1600,
      height: 1067,
    },
    author: {
      name: 'The FemiGlow team',
      bio: 'Founder of Maison FemiGlow. Biologist and formulator, she writes from Rabat on slow care and the materials of the Maghreb.',
    },
    body: `Kaolin is a white clay, soft, almost translucent when applied to the skin. It is not a showy material — it is a quiet one, working precisely without announcing itself.

## Origin of the material

We buy our kaolin from a small quarry near Marrakech. The clay is extracted, washed seven times, cold-dried, ground to a fine grain. It does not reach the atelier until it has passed a heavy metal screening.

That screening matters — industrial kaolin can carry traces of cadmium, lead or chromium. Cosmetic-grade kaolin must be pure.

## What it does

In the kit, kaolin lives in one face of the Step 4 buffer — the last face, the smoothest. When you pass it over the plate, it does not carve, does not scratch. It polishes the way silk polishes metal.

The motion is slow. Passed two or three times, no more. The shine that emerges is not forced — it is what the kaolin reveals from the nail itself.

## Why it stays

We tried alternatives: silica alone, perlite, starch. Each has merits. But kaolin has something else: it respects the plate. It does not polish by hiding, it polishes by uncovering.

That distinction matters in the FemiGlow ritual. We do not cover, we reveal. Kaolin embodies that principle. That is why it stays.`,
    isFeatured: false,
    wordCount: 950,
    seo: { noIndex: false },
  },
  {
    slug: 'la-table-comme-atelier',
    title: 'The table as atelier',
    excerpt: 'Prepare your space before you begin. The cloth, the light, the glass of water.',
    category: 'pratique',
    readingTimeMinutes: 4,
    publishedAt: new Date('2026-04-10'),
    updatedAt: new Date('2026-04-10'),
    featuredImage: {
      src: '/journal/la-table-comme-atelier.svg',
      alt: 'Pale wooden table, linen cloth, ritual accessories',
      width: 1600,
      height: 1067,
    },
    author: {
      name: 'The FemiGlow team',
      bio: 'Founder of Maison FemiGlow. Biologist and formulator, she writes from Rabat on slow care and the materials of the Maghreb.',
    },
    body: `Before the kit, there is the table. You do not need a workshop to practise the ritual — you need a space, simple and quiet.

## What you need

A linen or cotton cloth, pale-toned. Laid on the table, it sets the place. The light, if natural, is better. A desk lamp will do. The glass of water, on the side, is not a flourish — it is a sign of pause.

Put the phone away. You will not need it for five minutes. If you must, set it to silent, face down.

## Preparation

Take out the kit. Place the jars on the cloth, one beside the other, in order: paste, powder, buffer. The visual rhythm calms, it guides the gesture.

Sit down. Breathe twice. The hand that will practise the ritual, place it on the table, palm up. The other hand holds the kit.

## During the ritual

Do not answer calls. Do not look at the clock. Five minutes is not long — but it deserves to be whole.

If someone passes by, do not explain. The ritual is personal. It happens in your presence, not in the presence of others.

## After

Return the kit to its case. Fold the cloth. The glass, you drink. The table recovers its role — reading, writing, coffee. The ritual is over, but its trace continues through the day.`,
    isFeatured: false,
    wordCount: 760,
    seo: { noIndex: false },
  },
  {
    slug: 'visiter-l-atelier',
    title: 'Visit the atelier',
    excerpt: '25 bis avenue Patrice Lumumba, Rabat. How we ended up here, and what we make.',
    category: 'maison',
    readingTimeMinutes: 8,
    publishedAt: new Date('2026-04-15'),
    updatedAt: new Date('2026-04-15'),
    featuredImage: {
      src: '/journal/visiter-l-atelier.svg',
      alt: 'Facade of the FemiGlow atelier in the Habous district',
      width: 1600,
      height: 1067,
    },
    author: {
      name: 'The FemiGlow team',
      bio: 'Founder of Maison FemiGlow. Biologist and formulator, she writes from Rabat on slow care and the materials of the Maghreb.',
    },
    body: `The address is simple: 25 bis avenue Patrice Lumumba, Rabat. A white door, a brass number, a jasmine tree in front of the window. From the street, nothing announces an atelier of care.

## Getting there

The neighbourhood is quiet. Low 1970s buildings, trees, a café on the corner. The atelier is on the ground floor, occupying two adjoining rooms opening onto a small courtyard.

The door opens onto a reception room — a wooden table, four chairs, a cabinet of technical books. This is where our founder receives, on Tuesdays and Thursdays by appointment.

## The first room

A large work table, covered with glass panes. On it, samples, sorted by category: waxes, oils, clays, powders. Each jar carries a handwritten label — the material code, the test date, the reference.

Precision scales, graduated cups, test tubes. Simple equipment, but enough. The atelier is not an industrial laboratory — it is a place of manual formulation.

## The second room

This is where assembly happens. The kits are packed by hand. Paste jars are sealed one by one, powder is weighed precisely, buffers are wrapped. No automatic machines — each kit passes through a hand.

On the wall, a map of Morocco. Red dots mark it — sources of supply. Souss, the Middle Atlas, Tiznit, Marrakech. Each dot has a story.

## The courtyard

Small, but important. An orange tree, aromatic plants in pots, an iron table. This is where training takes place — two apprentices come every Tuesday, learning to formulate from our founder.

The courtyard lights both rooms. Natural light matters — more than neon. A material that looks shiny under neon can fall flat under sunlight.

## What we make here

The kit, first. But also: formulations for other natural care labels. Our team also runs training — for nail technicians, for young formulators, for technical schools.

The maison is small. It will not grow much — that is a choice. The atelier, as it is, is enough.`,
    isFeatured: false,
    wordCount: 1600,
    seo: { noIndex: false },
  },
  {
    slug: 'voix-de-lina',
    title: 'The voice of Lina',
    excerpt: 'Two months in, she writes to us. What has changed, what has not, and what she expects next.',
    category: 'voix',
    readingTimeMinutes: 5,
    publishedAt: new Date('2026-04-18'),
    updatedAt: new Date('2026-04-18'),
    featuredImage: {
      src: '/journal/voix-de-lina.svg',
      alt: 'Lina\'s hands, cared-for nails, on an open notebook',
      width: 1600,
      height: 1067,
    },
    author: {
      name: 'The FemiGlow team',
      bio: 'Founder of Maison FemiGlow. Biologist and formulator, she writes from Rabat on slow care and the materials of the Maghreb.',
    },
    body: `Lina lives in Casablanca. A software engineer, early thirties, mother of two. She wrote to us at the end of April. She had started the ritual in February.

## What changed

"Before, I ignored my nails. I cut them very short, I rubbed if they broke, I did not bother. The kit changed something — not in my nails, in my time."

She continues: "Five minutes in the evening, after the children sleep, before my husband comes home. Those minutes became mine. It is not nail care — it is care for something I was missing."

That is what most women tell us after two months. The first benefit is not aesthetic — it is temporal. The ritual creates a personal space that was not there.

## What did not change

"My nails are still short. I do not try to grow them — my work asks for a short plate. But they are stronger now, healthier. The cuticle is not inflamed. That is what changed."

The ritual does not promise long nails. It promises healthy nails. The distinction matters — a short healthy plate is better than a long fragile one.

## What she expects

"I am waiting for summer. I work a lot in summer, my hands are on the keyboard more, a lot of typing. I want to know whether the ritual will protect what it built in winter."

A fair question. We will follow Lina. The next season will answer.`,
    isFeatured: false,
    wordCount: 1080,
    seo: { noIndex: false },
  },
  {
    slug: 'avril-soleil-bas',
    title: 'April, low sun',
    excerpt: 'The Casablanca sun rises higher again. Hands come out, the ritual lightens.',
    category: 'saison',
    readingTimeMinutes: 4,
    publishedAt: new Date('2026-04-22'),
    updatedAt: new Date('2026-04-22'),
    featuredImage: {
      src: '/journal/avril-soleil-bas.svg',
      alt: 'Hands under oblique sunlight, golden light',
      width: 1600,
      height: 1067,
    },
    author: {
      name: 'The FemiGlow team',
      bio: 'Founder of Maison FemiGlow. Biologist and formulator, she writes from Rabat on slow care and the materials of the Maghreb.',
    },
    body: `In Casablanca, April is a season of transition. The sun is no longer low, but not yet overhead. An oblique light, warm, revealing what was hidden through winter.

## The hand reveals itself

Through the winter months, the hand hides. Gloves, long sleeves, pockets. In April, it comes out. It meets the sun, the air, the glances.

That unveiling also reveals its state. The plate that held through January deserves to be shown quietly. The ritual has earned this — not for display, for personal acknowledgement.

## The pace lightens

April is not the season of daily paste. The plate is strong, the cuticle is supple, the buffer alone twice a week is enough.

This is a silent victory for the slow ritual. What was built in winter protects in spring. The seasonal investment pays — not as a promise, as tangible fact.

## What comes next

Summer is near. The sun will grow stronger, the heat will change the skin's composition, much water and salt and sand. The ritual will adapt.

But before that, April. The month of gentleness. The hand reveals itself, feels the light, recovers its natural pace. The ritual is here to accompany that transition, not to impose it.`,
    isFeatured: false,
    wordCount: 740,
    seo: { noIndex: false },
  },
  {
    slug: 'huile-d-argan-vraie',
    title: 'Argan oil, true',
    excerpt: 'Tiznit, cooperatives, first pressing. Why we buy direct, and what it really costs.',
    category: 'matieres',
    readingTimeMinutes: 6,
    publishedAt: new Date('2026-04-25'),
    updatedAt: new Date('2026-04-25'),
    featuredImage: {
      src: '/journal/huile-d-argan-vraie.svg',
      alt: 'Amber argan oil bottle on a cream background',
      width: 1600,
      height: 1067,
    },
    author: {
      name: 'The FemiGlow team',
      bio: 'Founder of Maison FemiGlow. Biologist and formulator, she writes from Rabat on slow care and the materials of the Maghreb.',
    },
    body: `Argan oil has become an overused word. There are dozens of oils carrying the name — most are adulterated, diluted, heat-treated, or simply not argan oil.

## The real oil

Real argan oil comes from the argan tree, which grows only in south-west Morocco. Tiznit, Taroudant, Agadir. Women's cooperatives gather the fruit, crack the stone with a rock, extract the kernel.

The process is manual. No machine can crack the stone without breaking the kernel. This is what makes the oil expensive — the human labour behind it. An hour of work for 100 ml.

## How we buy

We buy directly from a cooperative in Tiznit. Three faces we know. An annual visit, payment in cash, a transparent invoice.

The cooperative cold-presses the kernel on the same day. The oil reaches the atelier a week later, in dark glass bottles. It is not blended, not diluted, not treated with any solvent.

## The real cost

Real argan oil costs between 250 and 400 MAD per litre, depending on the season. In the market, you can find "argan oil" at 50 MAD. The difference is not in the packaging — it is in the content.

The FemiGlow kit uses jojoba, not argan, because jojoba is better suited to the human nail. But our founder uses argan in other formulations, and each material has its standards.

## The larger lesson

Direct sourcing costs time, costs trust, costs travel. But it is the only way to know what enters a product. Every material in the atelier follows this path. No shortcut, no unknown middleman.`,
    isFeatured: false,
    wordCount: 1380,
    seo: { noIndex: false },
  },
  {
    slug: 'ranger-son-rituel',
    title: 'Storing your ritual',
    excerpt: 'The cupboard, the drawer, the pouch. How to keep the bottles in good condition from one season to the next.',
    category: 'pratique',
    readingTimeMinutes: 3,
    publishedAt: new Date('2026-04-28'),
    updatedAt: new Date('2026-04-28'),
    featuredImage: {
      src: '/journal/ranger-son-rituel.svg',
      alt: 'Open bathroom drawer, bottles tidied',
      width: 1600,
      height: 1067,
    },
    author: {
      name: 'The FemiGlow team',
      bio: 'Founder of Maison FemiGlow. Biologist and formulator, she writes from Rabat on slow care and the materials of the Maghreb.',
    },
    body: `The kit lasts four to five months. But proper storage extends that period and preserves the quality of the materials.

## Three rules

First: cool and dry. Beeswax softens in heat, jojoba oxidises in light. Do not leave the kit near a window, or in a humid bathroom.

Second: tightly closed. Each jar has a screw lid. Make sure it is secure after each use. A little air speeds up oxidation.

Third: upright, where possible. There is no need to flip the bottles. Set them on their base, in a cupboard, a drawer, a covered box.

## Where to place the kit

Best: a cupboard in a quiet room, between 18 and 22 °C. A bedside drawer is excellent.

The bathroom: possible, if it is ventilated. Not above the heater, not next to the shower. Condensed humidity alters the composition of the materials.

The kitchen: no. Oil in the air, steam, heat. The materials absorb what surrounds them.

## Travel

If you travel, take the kit in a cotton pouch. Do not leave it in the car under the sun. In a plane, in the cabin bag, it is safe.

If the buffer gets wet, dry it with a cotton towel, then leave it two hours in the air before use. Do not heat it, do not wring it.

## Between seasons

If you pause for a month, no worry. The kit holds. On return, check the jars: paste texture, powder scent, buffer suppleness. If all is well, you resume.

The ritual welcomes the pause as it welcomes the return. Faithfulness is not measured by daily presence — it is measured by intention.`,
    isFeatured: false,
    wordCount: 620,
    seo: { noIndex: false },
  },
  {
    slug: 'la-cuisine-comme-laboratoire',
    title: 'The kitchen as laboratory',
    excerpt: 'Before the atelier, there was the kitchen. The story of a domestic beginning.',
    category: 'maison',
    readingTimeMinutes: 7,
    publishedAt: new Date('2026-04-29'),
    updatedAt: new Date('2026-04-29'),
    featuredImage: {
      src: '/journal/la-cuisine-comme-laboratoire.svg',
      alt: 'A repurposed home kitchen, scales and jars',
      width: 1600,
      height: 1067,
    },
    author: {
      name: 'The FemiGlow team',
      bio: 'Founder of Maison FemiGlow. Biologist and formulator, she writes from Rabat on slow care and the materials of the Maghreb.',
    },
    body: `Before 25 bis avenue Patrice Lumumba, there was a kitchen. A simple kitchen, in a small Rabat flat, where our founder prepared the first FemiGlow formulas.

## The kitchen scale

The first precision instrument was a kitchen scale. Accurate to the gram, no finer. It was enough for the first trials. Beeswax from the Rabat medina market, jojoba from a beauty pharmacy, talc from a chemical shop in Hassan.

Nothing was traced. Each material had an unknown story. But the experiment began with these materials, in this kitchen.

## The oven, the hob, the water

The oven was the incubator. 40 degrees, door slightly open. The hob was where beeswax melted, at very low heat, under constant watch. Water was what cooled, fixed the formula.

All the tools were dual-use: a wooden spoon for soup in the morning, for a paste formula in the evening. A measuring cup for milk became a measure for oils. Everything was cleaned carefully between uses — but the objects were the same.

## The first successful formula

After forty attempts, the first paste formula. Wax 12%, jojoba 60%, tocopherol 0.5%. Our founder wrote it in a small notebook, formula number 41.

The current formula, the one in the kit, is number 287. Six years of refinements, adjustments, reversals. But the base — wax, jojoba, tocopherol — was already in formula 41.

## What remains

The Patrice Lumumba atelier has professional equipment. But in a corner, the old kitchen scale is still there. It is no longer used, but it reminds. The maison began in a kitchen. Perhaps that is what keeps it from forgetting how something is made with care.`,
    isFeatured: false,
    wordCount: 1320,
    seo: { noIndex: false },
  },
  {
    slug: 'voix-de-sara',
    title: 'The voice of Sara',
    excerpt: 'Four full months. Sara tells of her nails, her tiredness, her doubts, and the gesture that settled in.',
    category: 'voix',
    readingTimeMinutes: 6,
    publishedAt: new Date('2026-04-30'),
    updatedAt: new Date('2026-04-30'),
    featuredImage: {
      src: '/journal/voix-de-sara.svg',
      alt: 'Sara\'s hands, longer nails, on a linen napkin',
      width: 1600,
      height: 1067,
    },
    author: {
      name: 'The FemiGlow team',
      bio: 'Founder of Maison FemiGlow. Biologist and formulator, she writes from Rabat on slow care and the materials of the Maghreb.',
    },
    body: `Sara lives in Marrakech. A nurse in a public hospital, in her forties. She wrote to us at the end of April, after four months of ritual. Her story is the longest we have — and the most honest.

## The tiredness

"My work wears my hands out. So much washing, detergents, gloves. When I started the ritual in January, I was tired. Not only from work — from everything asked of me."

She continues: "When I opened the kit, I was not convinced. I thought five minutes would not be enough. Five wasted minutes in a day that could not afford waste."

That doubt is common. The ritual asks for patience in a time that does not afford patience. Sara understood that late.

## The shift

"A month in, I wanted to stop. My nails had not improved, my hands were still tired, time was scarce. I wrote to the maison: 'I think the kit is not for me.'"

Our founder replied the same day: "Do not stop out of tiredness. Stop if you decide to, not if you give up. Give the ritual a season."

Sara did not stop. "I do not know why. Perhaps because the reply was personal, not commercial. Perhaps because something in the way it was written reminded me of my mother."

## Three months

"Three months in, something happened. Not in my nails — in my pace. The five minutes had become a signal. When I sat down and opened the kit, my body understood the day was over."

Sara uses the word "signal". It is not a poetic phrase — it is a physiological description. Repeated rituals become markers of time, of state, of transition.

Her nails also improved. "The plate is stronger, I notice. No breaks since March. But that is not the main thing."

## The gesture that settled

"What matters most is that something settled. A gesture at the end of the day that I do not negotiate. My work is long, but those minutes are reserved. I have learned to defend them."

This is the season's testimony. Not about the product, not about the result. About the habit. About the personal space. About the permission to pause.

The maison keeps Sara's letter. She will write again, in October, telling what remains after the summer.`,
    isFeatured: true,
    wordCount: 1240,
    seo: { noIndex: false },
  },
];
