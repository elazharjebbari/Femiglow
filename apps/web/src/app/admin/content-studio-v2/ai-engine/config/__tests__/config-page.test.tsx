/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/components/admin/content-studio-v2/primitives', async () => {
  const R = await import('react');
  return {
    Button: (props: Record<string, unknown>) => R.createElement('button', props, props.leftIcon as string, props.children as string),
    Badge: (props: Record<string, unknown>) => R.createElement('span', props, props.children as string),
    Input: (props: Record<string, unknown>) => R.createElement('input', props),
  };
});

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

import AIEngineConfigPage from '../page';

function buildProvider(overrides?: Record<string, unknown>) {
  return {
    id: 'prov_openai',
    providerType: 'openai',
    name: 'OpenAI',
    apiKeyEnvVar: 'OPENAI_API_KEY',
    baseUrl: null,
    capabilities: ['text', 'image'],
    models: [{ name: 'gpt-4o-mini', capability: 'text', costPer1MInput: 15 }],
    rateLimitRpm: 500,
    dailyBudgetCents: 500,
    circuitBreakerConfig: null,
    priority: 10,
    isFallback: false,
    isEnabled: true,
    healthStatus: 'healthy',
    lastHealthCheck: null,
    configured: true,
    ...overrides,
  };
}

function buildWorkflow(overrides?: Record<string, unknown>) {
  return {
    id: 'wf_1',
    name: 'Instagram Reel',
    description: 'Workflow pour reels',
    platform: 'instagram',
    format: 'reel',
    graphConfig: { nodes: ['brief_analysis', 'script_writer', 'image_gen'] },
    defaultTone: 'professional',
    defaultLanguage: 'fr',
    qualityThreshold: '0.7',
    maxRetries: 3,
    maxBudgetCents: 100,
    humanReviewRequired: true,
    autoPublish: false,
    providerOverrides: null,
    version: 1,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function buildPrompt(overrides?: Record<string, unknown>) {
  return {
    id: 'pt_1',
    nodeName: 'generate_script',
    name: 'Script Writer',
    systemPrompt: 'Tu es un créateur de contenu expert...',
    userPromptTemplate: 'Crée un script pour {platform}',
    variables: ['platform', 'format'],
    version: 2,
    isActive: true,
    parentId: null,
    avgQualityScore: '0.85',
    usageCount: 42,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

let fetchResponses: Record<string, unknown> = {};

beforeEach(() => {
  fetchResponses = {
    providers: { providers: [buildProvider()] },
    workflows: { workflows: [buildWorkflow()] },
    prompts: { prompts: [buildPrompt()] },
  };
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const u = String(url);
    if (u.includes('/config/providers')) return new Response(JSON.stringify(fetchResponses.providers));
    if (u.includes('/config/workflows')) return new Response(JSON.stringify(fetchResponses.workflows));
    if (u.includes('/config/prompts')) return new Response(JSON.stringify(fetchResponses.prompts));
    if (u.includes('/health')) return new Response(JSON.stringify({ enabled: true }));
    return new Response('{}');
  });
});

afterEach(() => { vi.restoreAllMocks(); });

describe('AIEngineConfigPage', () => {
  it('shows "Configuration" title', async () => {
    render(<AIEngineConfigPage />);
    await waitFor(() => expect(screen.getByText('Configuration')).toBeInTheDocument());
  });

  it('shows page description subtitle', async () => {
    render(<AIEngineConfigPage />);
    await waitFor(() => expect(screen.getByText(/Gérez les fournisseurs/)).toBeInTheDocument());
  });

  it('shows 4 stat cards', async () => {
    render(<AIEngineConfigPage />);
    await waitFor(() => {
      expect(screen.getByText('Fournisseurs actifs')).toBeInTheDocument();
      expect(screen.getByText('Workflows actifs')).toBeInTheDocument();
      expect(screen.getByText('Prompts versionnés')).toBeInTheDocument();
      expect(screen.getByText('Budget quotidien total')).toBeInTheDocument();
    });
  });

  it('shows 3 tabs (no Base de connaissances)', async () => {
    render(<AIEngineConfigPage />);
    await waitFor(() => {
      expect(screen.getByText('Fournisseurs')).toBeInTheDocument();
      expect(screen.getByText('Workflows')).toBeInTheDocument();
      expect(screen.getByText('Prompts')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /Base de connaissances/ })).not.toBeInTheDocument();
  });

  it('default tab is Fournisseurs with provider cards', async () => {
    render(<AIEngineConfigPage />);
    await waitFor(() => expect(screen.getByText('OpenAI')).toBeInTheDocument());
    expect(screen.getByText('gpt-4o-mini')).toBeInTheDocument();
  });

  it('provider shows Actif status when configured', async () => {
    render(<AIEngineConfigPage />);
    await waitFor(() => expect(screen.getByText('Actif')).toBeInTheDocument());
  });

  it('provider shows Inactif when not configured', async () => {
    fetchResponses.providers = { providers: [buildProvider({ configured: false, isEnabled: false })] };
    render(<AIEngineConfigPage />);
    await waitFor(() => expect(screen.getByText('Inactif')).toBeInTheDocument());
  });

  it('provider capabilities badges displayed', async () => {
    render(<AIEngineConfigPage />);
    await waitFor(() => {
      expect(screen.getByText('Texte')).toBeInTheDocument();
      expect(screen.getByText('Image')).toBeInTheDocument();
    });
  });

  it('clicking Workflows tab shows workflow content', async () => {
    render(<AIEngineConfigPage />);
    await waitFor(() => expect(screen.getByText('Fournisseurs')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Workflows'));
    await waitFor(() => expect(screen.getByText('Instagram Reel')).toBeInTheDocument());
  });

  it('clicking Prompts tab shows prompt content', async () => {
    render(<AIEngineConfigPage />);
    await waitFor(() => expect(screen.getByText('Fournisseurs')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Prompts'));
    await waitFor(() => expect(screen.getByText('Script Writer')).toBeInTheDocument());
  });

  it('workflow shows quality threshold', async () => {
    render(<AIEngineConfigPage />);
    await waitFor(() => expect(screen.getByText('Fournisseurs')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Workflows'));
    await waitFor(() => expect(screen.getByText(/Qualité ≥ 70%/)).toBeInTheDocument());
  });

  it('prompt shows version and quality', async () => {
    render(<AIEngineConfigPage />);
    await waitFor(() => expect(screen.getByText('Fournisseurs')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Prompts'));
    await waitFor(() => {
      expect(screen.getByText('v2')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();
    });
  });

  it('error state shows message and retry', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network fail'));
    render(<AIEngineConfigPage />);
    await waitFor(() => expect(screen.getByText(/Impossible de charger/)).toBeInTheDocument());
    expect(screen.getByText('Réessayer')).toBeInTheDocument();
  });
});
