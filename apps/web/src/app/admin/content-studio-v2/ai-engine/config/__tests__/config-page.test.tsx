/**
 * Tests for the AI Engine Config page — tabs navigation, provider cards,
 * workflow/prompt display, loading, and error states.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock next/link
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    style: _style,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    style?: React.CSSProperties;
    [k: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import AIEngineConfigPage from '../../page';

function buildProvider(overrides?: Record<string, unknown>) {
  return {
    id: 'prov_openai',
    providerType: 'openai',
    name: 'OpenAI',
    apiKeyEnvVar: 'OPENAI_API_KEY',
    baseUrl: null,
    capabilities: ['text', 'image', 'vision'],
    models: [
      { name: 'gpt-4o', capability: 'text', costPer1MInput: 250, costPer1MOutput: 1000 },
    ],
    rateLimitRpm: 60,
    dailyBudgetCents: 500,
    circuitBreakerConfig: null,
    priority: 1,
    isFallback: false,
    isEnabled: true,
    healthStatus: 'healthy',
    lastHealthCheck: '2026-05-25T10:00:00Z',
    configured: true,
    ...overrides,
  };
}

function buildWorkflow(overrides?: Record<string, unknown>) {
  return {
    id: 'wf_default',
    name: 'Instagram Reel',
    description: 'Workflow standard pour reels Instagram',
    platform: 'instagram',
    format: 'reel',
    graphConfig: { nodes: ['brief_analysis', 'script_writer', 'quality_gate'] },
    defaultTone: 'empowering',
    defaultLanguage: 'fr',
    qualityThreshold: '0.7',
    maxRetries: 2,
    maxBudgetCents: 1000,
    humanReviewRequired: true,
    autoPublish: false,
    providerOverrides: null,
    version: 3,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-05-25T10:00:00Z',
    ...overrides,
  };
}

function buildPrompt(overrides?: Record<string, unknown>) {
  return {
    id: 'prompt_1',
    nodeName: 'script_writer',
    name: 'Script Writer v2',
    systemPrompt: 'Tu es un expert en creation de scripts video pour les reseaux sociaux...',
    userPromptTemplate: 'Cree un script pour {{platform}} au format {{format}}...',
    variables: ['platform', 'format', 'tone'],
    version: 2,
    isActive: true,
    parentId: null,
    avgQualityScore: '0.82',
    usageCount: 45,
    createdAt: '2026-03-15T00:00:00Z',
    ...overrides,
  };
}

function mockConfigResponses(opts?: {
  providers?: Record<string, unknown>[];
  workflows?: Record<string, unknown>[];
  prompts?: Record<string, unknown>[];
}) {
  return (url: string) => {
    if (url.includes('/config/providers')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ providers: opts?.providers ?? [buildProvider()] }),
      });
    }
    if (url.includes('/config/workflows')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ workflows: opts?.workflows ?? [buildWorkflow()] }),
      });
    }
    if (url.includes('/config/prompts')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ prompts: opts?.prompts ?? [buildPrompt()] }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  };
}

describe('AIEngineConfigPage', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows "Configuration" title', async () => {
    fetchSpy.mockImplementation(mockConfigResponses());
    render(<AIEngineConfigPage />);

    await waitFor(() => {
      expect(screen.getByText('Configuration')).toBeInTheDocument();
    });
  });

  it('shows 4 tabs: Fournisseurs, Workflows, Prompts, Base de connaissances', async () => {
    fetchSpy.mockImplementation(mockConfigResponses());
    render(<AIEngineConfigPage />);

    await waitFor(() => {
      expect(screen.getByText('Fournisseurs')).toBeInTheDocument();
    });
    expect(screen.getByText('Workflows')).toBeInTheDocument();
    expect(screen.getByText('Prompts')).toBeInTheDocument();
    expect(screen.getByText('Base de connaissances')).toBeInTheDocument();
  });

  it('default tab is Fournisseurs', async () => {
    fetchSpy.mockImplementation(mockConfigResponses());
    render(<AIEngineConfigPage />);

    await waitFor(() => {
      // Provider content visible by default
      expect(screen.getByText('Fournisseurs IA')).toBeInTheDocument();
    });
    expect(screen.getByText('OpenAI')).toBeInTheDocument();
  });

  it('clicking Workflows tab shows workflow content', async () => {
    fetchSpy.mockImplementation(mockConfigResponses());
    render(<AIEngineConfigPage />);

    await waitFor(() => {
      expect(screen.getByText('Workflows')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Workflows'));

    expect(screen.getByText('Workflows de generation')).toBeInTheDocument();
    expect(screen.getByText('Instagram Reel')).toBeInTheDocument();
  });

  it('clicking Prompts tab shows prompt content', async () => {
    fetchSpy.mockImplementation(mockConfigResponses());
    render(<AIEngineConfigPage />);

    await waitFor(() => {
      expect(screen.getByText('Prompts')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Prompts'));

    expect(screen.getByText('Templates de prompts')).toBeInTheDocument();
    expect(screen.getByText('Script Writer v2')).toBeInTheDocument();
  });

  it('provider cards show name and status', async () => {
    fetchSpy.mockImplementation(mockConfigResponses());
    render(<AIEngineConfigPage />);

    await waitFor(() => {
      expect(screen.getByText('OpenAI')).toBeInTheDocument();
    });
  });

  it('OpenAI shows as "Configure" when key present', async () => {
    fetchSpy.mockImplementation(mockConfigResponses());
    render(<AIEngineConfigPage />);

    await waitFor(() => {
      expect(screen.getByText('Configure')).toBeInTheDocument();
    });
  });

  it('provider capabilities are displayed as badges', async () => {
    fetchSpy.mockImplementation(mockConfigResponses());
    render(<AIEngineConfigPage />);

    await waitFor(() => {
      expect(screen.getByText('Texte')).toBeInTheDocument();
    });
    expect(screen.getByText('Image')).toBeInTheDocument();
    expect(screen.getByText('Vision')).toBeInTheDocument();
  });

  it('workflow shows quality threshold', async () => {
    fetchSpy.mockImplementation(mockConfigResponses());
    render(<AIEngineConfigPage />);

    await waitFor(() => {
      expect(screen.getByText('Workflows')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Workflows'));

    expect(screen.getByText(/Seuil qualite : 70%/)).toBeInTheDocument();
  });

  it('prompts show version number', async () => {
    fetchSpy.mockImplementation(mockConfigResponses());
    render(<AIEngineConfigPage />);

    await waitFor(() => {
      expect(screen.getByText('Prompts')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Prompts'));

    expect(screen.getByText('v2')).toBeInTheDocument();
  });

  it('loading state shows skeleton', () => {
    // fetch never resolves
    fetchSpy.mockReturnValue(new Promise(() => {}));
    const { container } = render(<AIEngineConfigPage />);

    // Loading state shows animated placeholder divs
    const shimmerDivs = container.querySelectorAll(
      'div[style*="cs-shimmer"]',
    );
    expect(shimmerDivs.length).toBeGreaterThanOrEqual(1);
  });

  it('error state shows message', async () => {
    fetchSpy.mockImplementation((url: string) => {
      if (url.includes('/config/providers')) {
        return Promise.resolve({ ok: false, status: 500 });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ workflows: [], prompts: [] }),
      });
    });

    render(<AIEngineConfigPage />);

    await waitFor(() => {
      expect(
        screen.getByText('Impossible de charger la configuration'),
      ).toBeInTheDocument();
    });
  });
});
