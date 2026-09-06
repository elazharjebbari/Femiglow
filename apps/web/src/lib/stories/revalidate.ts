import 'server-only';

import { revalidatePath } from 'next/cache';

/** Rafraîchit les pages `/kit` (legacy + localisées) après une mutation admin. */
export function revalidateStories(): void {
  for (const p of ['/kit', '/fr/kit', '/ar/kit', '/en/kit']) revalidatePath(p);
}
