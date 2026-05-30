import { env } from '@/lib/env';

export interface EngineConfig {
  enabled: boolean;

  providers: {
    text: {
      default: 'openai' | 'anthropic' | 'google' | 'ollama';
      model: string;
    };
    image: {
      default: 'openai' | 'google' | 'stability' | 'higgsfield' | 'mock';
      model: string;
    };
    video: {
      default: 'google' | 'runway' | 'higgsfield' | 'mock';
    };
    tts: {
      default: 'elevenlabs' | 'openai' | 'google' | 'mock';
    };
  };

  apiKeys: {
    openai: string | undefined;
    anthropic: string | undefined;
    google: string | undefined;
    elevenlabs: string | undefined;
    higgsfield: string | undefined;
    ollamaBaseUrl: string | undefined;
  };

  budget: {
    dailyCents: number;
    maxPerJobCents: number;
  };

  quality: {
    threshold: number;
    humanReviewRequired: boolean;
  };

  defaults: {
    tone: string;
    language: string;
    maxRetries: number;
  };
}

let _config: EngineConfig | null = null;

export function getEngineConfig(): EngineConfig {
  if (_config) return _config;

  _config = {
    enabled: env.AI_ENGINE_ENABLED === 'true',

    providers: {
      text: {
        default: env.AI_ENGINE_DEFAULT_TEXT_PROVIDER,
        model: env.AI_ENGINE_DEFAULT_TEXT_MODEL,
      },
      image: {
        default: env.AI_ENGINE_DEFAULT_IMAGE_PROVIDER,
        model: env.AI_ENGINE_DEFAULT_IMAGE_MODEL,
      },
      video: {
        default: env.AI_ENGINE_DEFAULT_VIDEO_PROVIDER,
      },
      tts: {
        default: env.AI_ENGINE_DEFAULT_TTS_PROVIDER,
      },
    },

    apiKeys: {
      openai: env.AI_ENGINE_OPENAI_API_KEY || env.CONTENT_STUDIO_OPENAI_API_KEY || env.CHAT_OPENAI_API_KEY || process.env.OPENAI_API_KEY || undefined,
      anthropic: env.AI_ENGINE_ANTHROPIC_API_KEY || env.CHAT_ANTHROPIC_API_KEY || undefined,
      google: env.AI_ENGINE_GOOGLE_API_KEY || env.CHAT_GEMINI_API_KEY || undefined,
      elevenlabs: env.AI_ENGINE_ELEVENLABS_API_KEY || undefined,
      higgsfield: env.AI_ENGINE_HIGGSFIELD_API_KEY || undefined,
      ollamaBaseUrl: env.AI_ENGINE_OLLAMA_BASE_URL || env.CHAT_OLLAMA_BASE_URL || undefined,
    },

    budget: {
      dailyCents: env.AI_ENGINE_DAILY_BUDGET_CENTS,
      maxPerJobCents: env.AI_ENGINE_MAX_BUDGET_PER_JOB_CENTS,
    },

    quality: {
      threshold: env.AI_ENGINE_QUALITY_THRESHOLD,
      humanReviewRequired: env.AI_ENGINE_HUMAN_REVIEW_REQUIRED === 'true',
    },

    defaults: {
      tone: 'professional',
      language: 'fr',
      maxRetries: 3,
    },
  };

  return _config;
}

export function resetEngineConfig(): void {
  _config = null;
}
