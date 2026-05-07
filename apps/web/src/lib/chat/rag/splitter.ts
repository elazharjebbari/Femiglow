/**
 * CHA-091 — Splitter (recursive char + heuristique sémantique).
 *
 * Wrap autour de `RecursiveCharacterTextSplitter` de langchain
 * textsplitters, avec une étape post-traitement qui :
 * - regroupe les chunks ultra-courts (< 200 tokens) avec leur voisin,
 * - préserve le contexte de section (heading H2/H3 inclus dans chaque
 *   chunk en préfixe).
 *
 * cf. docs/chat-assistant/09-knowledge-base-rag.md §3
 */
// Implémentation locale du splitter récursif — équivalent fonctionnel
// minimal de `@langchain/textsplitters`. Évite la dépendance lourde et
// permet à l'app de compiler tant que LangChain n'est pas installé.
class RecursiveCharacterTextSplitter {
  private chunkSize: number;
  private chunkOverlap: number;
  private separators: string[];

  constructor(opts: { chunkSize: number; chunkOverlap: number; separators: string[] }) {
    this.chunkSize = opts.chunkSize;
    this.chunkOverlap = opts.chunkOverlap;
    this.separators = opts.separators.length > 0 ? opts.separators : [''];
  }

  async createDocuments(texts: string[]): Promise<Array<{ pageContent: string }>> {
    const out: Array<{ pageContent: string }> = [];
    for (const t of texts) {
      for (const piece of this.splitText(t)) {
        if (piece.length > 0) out.push({ pageContent: piece });
      }
    }
    return out;
  }

  private splitText(text: string, sepIndex = 0): string[] {
    if (text.length <= this.chunkSize) return [text];
    const sep = this.separators[sepIndex] ?? '';
    const parts = sep ? text.split(sep) : Array.from(text);
    const merged: string[] = [];
    let buf = '';
    for (const p of parts) {
      const next = buf ? buf + sep + p : p;
      if (next.length > this.chunkSize) {
        if (buf) merged.push(buf);
        if (p.length > this.chunkSize && sepIndex < this.separators.length - 1) {
          merged.push(...this.splitText(p, sepIndex + 1));
          buf = '';
        } else {
          buf = p;
        }
      } else {
        buf = next;
      }
    }
    if (buf) merged.push(buf);
    // Overlap : on réintroduit la queue du précédent au début du suivant.
    if (this.chunkOverlap > 0 && merged.length > 1) {
      for (let i = 1; i < merged.length; i++) {
        const prev = merged[i - 1]!;
        const tail = prev.slice(Math.max(0, prev.length - this.chunkOverlap));
        merged[i] = tail + (sep || '') + merged[i]!;
      }
    }
    return merged;
  }
}

export interface SplitChunk {
  ordinal: number;
  content: string;
  tokens: number;
  metadata: {
    heading?: string;
    page?: number;
  };
}

export interface SplitOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  separators?: string[];
}

const DEFAULT: Required<SplitOptions> = {
  chunkSize: 1200,
  chunkOverlap: 180,
  separators: ['\n\n', '\n', '. ', '? ', '! ', '; ', ', ', ' '],
};

export async function splitMarkdown(
  text: string,
  opts: SplitOptions = {},
): Promise<SplitChunk[]> {
  const cfg = { ...DEFAULT, ...opts };
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: cfg.chunkSize,
    chunkOverlap: cfg.chunkOverlap,
    separators: cfg.separators,
  });

  // Découpe par section H2/H3 d'abord pour conserver le contexte.
  const sections = splitBySections(text);

  const chunks: SplitChunk[] = [];
  let ordinal = 0;
  for (const sec of sections) {
    const docs = await splitter.createDocuments([sec.body]);
    for (const doc of docs) {
      const content = sec.heading
        ? `[${sec.heading}]\n${doc.pageContent.trim()}`
        : doc.pageContent.trim();
      if (!content) continue;
      chunks.push({
        ordinal: ordinal++,
        content,
        tokens: estimateTokens(content),
        metadata: { heading: sec.heading },
      });
    }
  }
  return mergeShortChunks(chunks);
}

function splitBySections(text: string): Array<{ heading?: string; body: string }> {
  const lines = text.split(/\r?\n/);
  const sections: Array<{ heading?: string; body: string }> = [];
  let current: { heading?: string; lines: string[] } = { lines: [] };
  for (const line of lines) {
    const m = /^#{1,3}\s+(.+)$/.exec(line);
    if (m) {
      if (current.lines.length) {
        sections.push({ heading: current.heading, body: current.lines.join('\n').trim() });
      }
      current = { heading: m[1]?.trim(), lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  if (current.lines.length) {
    sections.push({ heading: current.heading, body: current.lines.join('\n').trim() });
  }
  return sections.filter((s) => s.body.length > 0);
}

function mergeShortChunks(chunks: SplitChunk[]): SplitChunk[] {
  const MIN = 200;
  const out: SplitChunk[] = [];
  for (const c of chunks) {
    const last = out[out.length - 1];
    if (last && last.tokens < MIN && last.metadata.heading === c.metadata.heading) {
      last.content = `${last.content}\n\n${c.content}`;
      last.tokens += c.tokens;
    } else {
      out.push({ ...c, ordinal: out.length });
    }
  }
  return out;
}

/**
 * Approximation tokens (≈ 4 chars / token pour latin, 2 pour CJK/AR).
 * On n'a pas besoin d'être exact — c'est un signal pour le splitter.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  let arabic = 0;
  for (const ch of text) {
    if (/[\u0600-\u06FF]/.test(ch)) arabic++;
  }
  const nonArabic = text.length - arabic;
  return Math.ceil(nonArabic / 4 + arabic / 2);
}
