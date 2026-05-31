import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StepEnvProfiles } from './StepEnvProfiles';
import type { EnvProfile, Provider } from '@/lib/tracking/plan/types';

describe('StepEnvProfiles', () => {
  it('renders Snap Pixel ID and Snapchat mode controls when Snap is active', () => {
    const providers: Provider[] = [{ id: 'snap', active: true }];
    const profiles: EnvProfile[] = [
      {
        env: 'production',
        config: {
          snapPixelId: '6a4f1a2b-1111-4444-9999-abcdefabcdef',
          snapEventMode: 'hybrid',
        },
      },
    ];

    render(<StepEnvProfiles providers={providers} profiles={profiles} onChange={() => {}} />);

    expect(screen.getByLabelText(/Snap Pixel ID/i)).toBeInTheDocument();
    expect(screen.getByText(/Snapchat Pixel & CAPI/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Mode d'envoi/i })).toHaveValue('hybrid');
  });
});
