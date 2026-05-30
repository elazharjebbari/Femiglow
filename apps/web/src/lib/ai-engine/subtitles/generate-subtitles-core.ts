import {
  parseScriptToCues,
  serializeSrt,
  sortAndReindex,
  SUBTITLE_LIMITS,
  type Cue,
} from './srt';

/**
 * MP-SU-02 (BUG-004) — per-draft subtitles generation core. The default path is
 * pure (rule-based, zero network). `refine` performs ONE OpenAI call that tidies
 * cue *text only* (never timecodes); it falls back to the rule-based lines if the
 * response is unusable, and throws on a hard provider failure when
 * onProviderError='throw' (the per-draft service maps that to 502).
 */
export interface GenerateSubtitlesCoreInput {
  script: { hook?: string; scenes?: unknown[] } | null;
  rawText?: string;
  refine: boolean;
  apiKey?: string;
  onProviderError: 'throw' | 'passthrough';
}

export interface GenerateSubtitlesCoreOutput {
  cues: Cue[];
  srt: string;
  provider: 'rule-based' | 'openai:gpt-4o-mini';
  costCents: number;
  refined: boolean;
}

export async function generateSubtitlesForDraftCore(
  input: GenerateSubtitlesCoreInput,
): Promise<GenerateSubtitlesCoreOutput> {
  const baseCues = sortAndReindex(
    parseScriptToCues({
      hook: (input.script?.hook as string | undefined) ?? undefined,
      scenes: (input.script?.scenes as Parameters<typeof parseScriptToCues>[0]['scenes']) ?? undefined,
      rawText: input.rawText,
    }),
  );

  if (!input.refine || !input.apiKey || baseCues.length === 0) {
    return {
      cues: baseCues,
      srt: serializeSrt(baseCues),
      provider: 'rule-based',
      costCents: 0,
      refined: false,
    };
  }

  // Honest refine: tidy each cue's text. Defensive — never corrupt timing, fall
  // back to the rule-based lines on any unusable response.
  try {
    const prompt =
      'Réécris chaque sous-titre pour la lisibilité (max 2 lignes, ~42 caractères/ligne, ' +
      'sans changer le sens, en français). Réponds en JSON: {"cues":["texte 1", ...]} ' +
      'dans le MÊME ordre. Sous-titres:\n' +
      baseCues.map((c, i) => `${i + 1}. ${c.lines.join(' ')}`).join('\n');

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${input.apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => `${res.status}`);
      throw new Error(`OpenAI subtitle refine failed: ${errText}`);
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { total_tokens?: number };
    };
    const content = json.choices?.[0]?.message?.content;
    const parsed = content ? (JSON.parse(content) as { cues?: unknown }) : null;
    const refinedTexts = Array.isArray(parsed?.cues) ? (parsed!.cues as unknown[]) : null;

    if (refinedTexts && refinedTexts.length === baseCues.length) {
      const cues = baseCues.map((c, i) => {
        const t = refinedTexts[i];
        if (typeof t !== 'string' || !t.trim()) return c;
        const lines = t
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
          .slice(0, SUBTITLE_LIMITS.MAX_LINES_PER_CUE);
        return lines.length > 0 ? { ...c, lines } : c;
      });
      const tokens = json.usage?.total_tokens ?? 0;
      return {
        cues,
        srt: serializeSrt(cues),
        provider: 'openai:gpt-4o-mini',
        costCents: (tokens / 1_000_000) * 60,
        refined: true,
      };
    }
    // Unusable shape → safe fallback to rule-based (no corruption).
    return { cues: baseCues, srt: serializeSrt(baseCues), provider: 'rule-based', costCents: 0, refined: false };
  } catch (err) {
    if (input.onProviderError === 'throw') throw err;
    return { cues: baseCues, srt: serializeSrt(baseCues), provider: 'rule-based', costCents: 0, refined: false };
  }
}
