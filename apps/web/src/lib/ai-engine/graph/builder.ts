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
import { qualityCheckNode } from '../nodes/quality-check';
import { moderateNode } from '../nodes/moderate';

const log = createLogger('graph-builder');

type NodeFn = (
  state: ContentGenerationStateType,
) => Promise<Partial<ContentGenerationUpdateType>>;

function placeholder(name: string): NodeFn {
  return async (state) => {
    log.info(`[placeholder] executing node "${name}"`, {
      jobId: state.jobId,
      node: name,
    });
    return { currentStep: name };
  };
}

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

const generateVideo: NodeFn = placeholder('generateVideo');
const generateVoiceover: NodeFn = placeholder('generateVoiceover');
const generateMusic: NodeFn = placeholder('generateMusic');
const generateSubtitles: NodeFn = placeholder('generateSubtitles');

const compose: NodeFn = async (state) => {
  log.info('Composing final output', { jobId: state.jobId, node: 'compose' });
  return { currentStep: 'compose' };
};

const transcodeExport: NodeFn = async (state) => {
  log.info('Transcoding and exporting', {
    jobId: state.jobId,
    node: 'transcodeExport',
  });
  return { currentStep: 'transcodeExport' };
};

const qualityCheck: NodeFn = async (state) => {
  return qualityCheckNode(state as unknown as Record<string, unknown>) as Promise<Partial<ContentGenerationUpdateType>>;
};

const moderate: NodeFn = async (state) => {
  return moderateNode(state as unknown as Record<string, unknown>) as Promise<Partial<ContentGenerationUpdateType>>;
};

const humanReview: NodeFn = async (state) => {
  log.info('Awaiting human review', { jobId: state.jobId, node: 'humanReview' });
  return {
    currentStep: 'humanReview',
    humanReview: state.humanReview ?? {
      decision: 'approved' as const,
      feedback: undefined,
    },
  };
};

const generateVariants: NodeFn = async (state) => {
  log.info('Generating variants', {
    jobId: state.jobId,
    node: 'generateVariants',
  });
  return {
    currentStep: 'generateVariants',
    variants: [
      {
        variantIndex: 0,
        script: state.script,
        caption: state.caption,
        hashtags: state.hashtags,
        qualityScores: state.qualityScores,
      },
    ],
    selectedVariant: 0,
  };
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
    .addNode('humanReview', humanReview)
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
      safe: 'humanReview',
      flagged: 'generateScript',
      blocked: END,
    })

    // ── Human review gate ──
    .addConditionalEdges('humanReview', routeAfterHumanReview, {
      approved: 'generateVariants',
      approved_direct: END,
      rejected: 'generateScript',
      edit_requested: 'generateScript',
    })

    // ── Terminal ──
    .addEdge('generateVariants', END);

  return graph;
}
