'use client';

import { useEffect, useState } from 'react';
import type { ContentCampaign } from '@/lib/content-studio/types';
import { getJson } from './api';

interface CampaignSelectProps {
  value: string | null;
  onChange: (campaignId: string | null) => void;
}

export function CampaignSelect({ value, onChange }: CampaignSelectProps) {
  const [campaigns, setCampaigns] = useState<ContentCampaign[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void getJson<{ campaigns: ContentCampaign[] }>('/api/admin/content-studio/campaigns?status=active')
      .then((data) => {
        setCampaigns(data.campaigns);
        setLoaded(true);
      })
      .catch(() => {
        setCampaigns([]);
        setLoaded(true);
      });
  }, []);

  if (!loaded) {
    return (
      <div className="text-xs text-stone-400">Chargement des campagnes…</div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="text-xs text-stone-500">Aucune campagne active</div>
    );
  }

  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
    >
      <option value="">— Aucune campagne —</option>
      {campaigns.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}