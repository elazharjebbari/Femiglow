import { StateGraph, START, END } from '@langchain/langgraph';

import { ContentGenerationState } from './state';
import type { ContentGenerationStateType, ContentGenerationUpdateType } from './state';
import {
  routeAfterScript,
  routeAfterQuality,
  routeAfterModeration,
  routeAfterHumanReview,
} from './routing';
import { createLogger } from '../utils';

import { parseBriefNode } from '../nodes/parse-brief';
import { enrichKnowledgeNode } from '../nodes/enrich-knowledge';
import { enrichTrendsNode } from '../nodes/enrich-trends';
import { generateScriptNode } from '../nodes/generate-script';
import { generateCaptionNode } from '../nodes/generate-caption';
import { generateImagesNode } from '../nodes/generate-images';
import { generateVideoNode } from '../nodes/generate-video';
import { generateVoiceoverNode } from '../nodes/generate-voiceover';
import { generateMusicNode } from '../nodes/generate-music';
import { generateSubtitlesNode } from '../nodes/generate-subtitles';
import { composeNode } from '../nodes/compose';
import { transcodeExportNode } from '../nodes/transcode-export';
import { qualityCheckNode } from '../nodes/quality-check';
import { moderateNode } from '../nodes/moderate';
import { humanReviewNode } from '../nodes/human-review';
import { generateVariantsNode } from '../nodes/generate-variants';

const log = createLogger('graph-builder');

type NodeFn = (
  state: ContentGenerationStateType,
) => Promise<Partial<ContentGenerationUpdateType>>;

const parseBrief: NodeFn = async (state) => {
  return parseBriefNode(state as unknown as Record<string, unknown>) as Promise<Partial<ContentGenerationUpdateType>>;
};

const enrichKnowledge: NodeFn = async (state) => {
  return enrichKnowledgeNode(state as unknown as Record<string, unknown>) as Promise<Partial<ContentGenerationUpdateType>>;
};

const enrichTrends: NodeFn = async (state) => {
  return enrichTrendsNode(state as unknown as Record<string, unknown>) as Promise<Partial<ContentGenerationUpdateType>>;
};

const generateScript: NodeFn = async (state) => {
  return generateScriptNode(state as unknown as Record<string, unknown>) as Promise<Partial<ContentGenerationUpdateType>>;
};

const generateCaption: NodeFn = async (state) => {
  return generateCaptionNode(state as unknown as Record<string, unknown>) as Promise<Partial<ContentGenerationUpdateType>>;
};

const generateImages: NodeFn = async (state) => {
  return generateImagesNode(state as unknown as Record<string, unknown>) as Promise<Partial<ContentGenerationUpdateType>>;
};

const generateVideo: NodeFn = async (state) => {
  return generateVideoNode(state as unknown as Record<string, unknown>) as Promise<Partial<ContentGenerationUpdateType>>;
};

const generateVoiceover: NodeFn = async (state) => {
  return generateVoiceoverNode(state as unknown as Record<string, unknown>) as Promise<Partial<ContentGenerationUpdateType>>;
};

const generateMusic: NodeFn = async (state) => {
  return generateMusicNode(state as unknown as Record<string, unknown>) as Promise<Partial<ContentGenerationUpdateType>>;
};

const generateSubtitles: NodeFn = async (state) => {
  return generateSubtitlesNode(state as unknown as Record<string, unknown>) as Promise<Partial<ContentGenerationUpdateType>>;
};

const compose: NodeFn = async (state) => {
  return composeNode(state as unknown as Record<string, unknown>) as Promise<Partial<ContentGenerationUpdateType>>;
};

const transcodeExport: NodeFn = async (state) => {
  return transcodeExportNode(state as unknown as Record<string, unknown>) as Promise<Partial<ContentGenerationUpdateType>>;
};

const qualityCheck: NodeFn = async (state) => {
  return qualityCheckNode(state as unknown as Record<string, unknown>) as Promise<Partial<ContentGenerationUpdateType>>;
};

const moderate: NodeFn = async (state) => {
  return moderateNode(state as unknown as Record<string, unknown>) as Promise<Partial<ContentGenerationUpdateType>>;
};

const humanReview: NodeFn = async (state) => {
  return humanReviewNode(state as unknown as Record<string, unknown>) as Promise<Partial<ContentGenerationUpdateType>>;
};

const generateVariants: NodeFn = async (state) => {
  return generateVariantsNode(state as unknown as Record<string, unknown>) as Promise<Partial<ContentGenerationUpdateType>>;
};

// ---------------------------------------------------------------------------
// Graph builder
// ---------------------------------------------------------------------------

export function buildContentGraph() {
  const graph = new StateGraph(ContentGenerationState)
    // ── Register all nodes ──
    .addNode('parseBrief', parseBrief)
    .addNode('enrichKnowledge', enrichKnowledge)
    .addNode('enrichTrends', enrichTrends)
    .addNode('generateScript', generateScript)
    .addNode('generateCaption', generateCaption)
    .addNode('generateImages', generateImages)
    .addNode('generateVideo', generateVideo)
    .addNode('generateVoiceover', generateVoiceover)
    .addNode('generateMusic', generateMusic)
    .addNode('generateSubtitles', generateSubtitles)
    .addNode('compose', compose)
    .addNode('transcodeExport', transcodeExport)
    .addNode('qualityCheck', qualityCheck)
    .addNode('moderate', moderate)
    .addNode('reviewGate', humanReview)
    .addNode('generateVariants', generateVariants)

    // ── Linear opening sequence ──
    .addEdge(START, 'parseBrief')
    .addEdge('parseBrief', 'enrichKnowledge')
    .addEdge('enrichKnowledge', 'enrichTrends')
    .addEdge('enrichTrends', 'generateScript')

    // ── After script: branch by content format ──
    .addConditionalEdges('generateScript', routeAfterScript, {
      video_flow: 'generateVideo',
      carousel_flow: 'generateImages',
      image_flow: 'generateImages',
      caption_only: 'generateCaption',
    })

    // ── Video flow: video -> voiceover -> music -> subtitles -> compose ──
    .addEdge('generateVideo', 'generateVoiceover')
    .addEdge('generateVoiceover', 'generateMusic')
    .addEdge('generateMusic', 'generateSubtitles')
    .addEdge('generateSubtitles', 'compose')

    // ── Image flows: images -> caption -> compose ──
    .addEdge('generateImages', 'generateCaption')
    .addEdge('generateCaption', 'compose')

    // ── Post-composition pipeline ──
    .addEdge('compose', 'transcodeExport')
    .addEdge('transcodeExport', 'qualityCheck')

    // ── Quality gate ──
    .addConditionalEdges('qualityCheck', routeAfterQuality, {
      pass: 'moderate',
      retry: 'generateScript',
      fail: END,
    })

    // ── Moderation gate ──
    .addConditionalEdges('moderate', routeAfterModeration, {
      safe: 'reviewGate',
      flagged: 'generateScript',
      blocked: END,
    })

    // ── Human review gate ──
    .addConditionalEdges('reviewGate', routeAfterHumanReview, {
      approved: 'generateVariants',
      approved_direct: END,
      rejected: 'generateScript',
      edit_requested: 'generateScript',
    })

    // ── Terminal ──
    .addEdge('generateVariants', END);

  return graph;
}
