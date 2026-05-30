/**
 * ACT-BE-035 (BUG-057) — SOURCE UNIQUE du coût image, EN CENTS, par modèle
 * (+ quality pour OpenAI). Consommée à la fois par le pré-check budget
 * (service.generateVisualForDraft) ET par le coût enregistré sur le
 * generation_run (image-generation), pour qu'ils ne divergent plus (avant :
 * 3 barèmes incohérents — service 8/4/2, image-gen 22/6/1, registry perCall).
 *
 * Unité : centimes (cents). Les modèles mock sont gratuits.
 */
export type ImageQuality = 'low' | 'medium' | 'high';

const HIGGSFIELD_IMAGE_CENTS: Record<string, number> = {
  'hf-flux-schnell': 30,
  'hf-flux-1': 250,
  'hf-flux-pro': 550,
};

export function imageCostCents(
  modelId: string | undefined,
  quality: ImageQuality,
): number {
  if (!modelId || /^mock-/i.test(modelId)) return 0;
  const hf = HIGGSFIELD_IMAGE_CENTS[modelId];
  if (hf !== undefined) return hf;
  if (modelId === 'gpt-image-1-mini') {
    return quality === 'high' ? 4 : quality === 'medium' ? 2 : 1;
  }
  // gpt-image-1, dall-e-3 et autres modèles OpenAI premium.
  return quality === 'high' ? 22 : quality === 'medium' ? 6 : 1;
}
