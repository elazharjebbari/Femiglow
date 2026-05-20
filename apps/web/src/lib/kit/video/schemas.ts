/**
 * Schemas Zod pour les mutations admin de l'override vidéo `/kit`.
 *
 *  - `kitVideoOverrideUpsertSchema` : payload accepté par `PATCH /api/admin/kit/video`.
 *  - Tous les champs sont **optionnels** (patch partiel). `null` = explicite reset
 *    du champ vers le mock (différent de `undefined` = absent).
 *  - `chapters` validé strict (2-6, trié) côté `rituelVideoSchema`.
 *  - `youtubeUrl` validée parsable via `parseYouTubeUrl`.
 */
import { z } from 'zod';

import { parseYouTubeUrl } from '@/lib/video/youtube-url';
import { imageSchema } from '@/lib/schemas/common';
import { subProductAccentColorSchema } from '@/lib/schemas/product';
import { videoChapterSchema } from '@/lib/schemas/page-content';

const youtubeUrlSchema = z
  .string()
  .min(1)
  .max(300)
  .refine((url) => parseYouTubeUrl(url) !== null, {
    message: 'URL YouTube invalide (formats acceptés : youtu.be, /shorts/, ?v=, /embed/)',
  });

const provenanceSchema = z
  .string()
  .min(1)
  .max(120)
  .refine((s) => /[.!?»]$/.test(s.trim()), {
    message: 'La provenance doit se terminer par . ! ? ou »',
  });

const durationDisplaySchema = z.string().min(1).max(8);

/** Patch partiel — chaque clé peut être absente, présente avec valeur, ou présente avec `null`. */
export const kitVideoOverrideUpsertSchema = z.object({
  youtubeUrl: youtubeUrlSchema.nullable().optional(),
  provenance: provenanceSchema.nullable().optional(),
  durationDisplay: durationDisplaySchema.nullable().optional(),
  accentColor: subProductAccentColorSchema.nullable().optional(),
  posterCustom: imageSchema.nullable().optional(),
  chapters: z
    .array(videoChapterSchema)
    .min(2)
    .max(6)
    .refine(
      (arr) => {
        for (let i = 1; i < arr.length; i += 1) {
          if (arr[i]!.startSeconds <= arr[i - 1]!.startSeconds) return false;
        }
        return true;
      },
      { message: 'Les chapitres doivent être triés par startSeconds croissants et distincts' },
    )
    .nullable()
    .optional(),
});

export type KitVideoOverrideUpsertInput = z.infer<typeof kitVideoOverrideUpsertSchema>;
