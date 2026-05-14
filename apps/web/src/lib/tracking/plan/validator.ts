import type {
  EnvProfile,
  TrackingPlan,
  TrackingPlanInput,
  ValidationIssue,
  ValidationResult,
} from './types';

const PLACEHOLDER_PATTERNS = [
  /G-PROD0+$/i,
  /G-STAGING0+$/i,
  /G-LOCAL0+$/i,
  /^AW-(REPLACE|PLACEHOLDER|DEMO)/i,
  /^GTM-(PLACEHOLDER|DEMO|REPLACE)/i,
  /^1234567890/,
  /^XXXX/i,
];

const ID_FORMATS: Array<{ key: string; format: RegExp; label: string }> = [
  { key: 'ga4MeasurementId', format: /^G-[A-Z0-9]{8,12}$/, label: 'GA4 Measurement ID' },
  { key: 'googleAdsConversionId', format: /^AW-\d{6,12}$/, label: 'Google Ads Conversion ID' },
  { key: 'gtmContainerId', format: /^GTM-[A-Z0-9]{6,10}$/, label: 'GTM Container ID' },
  { key: 'metaPixelId', format: /^\d{10,17}$/, label: 'Meta Pixel ID' },
  { key: 'tiktokPixelId', format: /^[A-Z0-9]{15,25}$/i, label: 'TikTok Pixel ID' },
];

function isPlaceholder(value: string): boolean {
  return PLACEHOLDER_PATTERNS.some((p) => p.test(value));
}

function err(code: string, message: string, path?: string): ValidationIssue {
  return { code, message, path, severity: 'error' };
}

function warn(code: string, message: string, path?: string): ValidationIssue {
  return { code, message, path, severity: 'warning' };
}

export function validatePlan(plan: TrackingPlan | TrackingPlanInput): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const activeProviders = plan.providers.filter((p) => p.active);
  if (activeProviders.length === 0) {
    errors.push(err('R-002', 'Au moins un outil doit être activé.', 'providers'));
  }

  const prodProfile = plan.envProfiles.find((e) => e.env === 'production');
  if (!prodProfile) {
    errors.push(err('R-004', 'Le profil "production" est obligatoire.', 'envProfiles'));
  }

  for (let i = 0; i < plan.envProfiles.length; i++) {
    const profile = plan.envProfiles[i]!;
    validateEnvProfile(profile, activeProviders, i, errors, warnings);
  }

  const seenKeys = new Set<string>();
  for (let i = 0; i < plan.events.length; i++) {
    const event = plan.events[i]!;
    if (seenKeys.has(event.key)) {
      errors.push(err('R-005', `Clé d'événement dupliquée: ${event.key}`, `events[${i}].key`));
    }
    seenKeys.add(event.key);

    const activeOn = Object.entries(event.providers).filter(([, on]) => on).map(([id]) => id);
    if (activeOn.length === 0) {
      warnings.push(
        warn('W-003', `L'événement "${event.key}" n'est mappé à aucun outil.`, `events[${i}].providers`),
      );
    }
  }

  return {
    errors,
    warnings,
    ok: errors.length === 0,
  };
}

function validateEnvProfile(
  profile: EnvProfile,
  activeProviders: TrackingPlanInput['providers'],
  idx: number,
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
) {
  const isProd = profile.env === 'production';
  const cfg = profile.config as Record<string, string | undefined>;

  for (const provider of activeProviders) {
    const required = providerRequiredKeys(provider.id);
    for (const key of required) {
      const value = cfg[key];
      if (!value || value.trim() === '') {
        errors.push(
          err(
            'R-003',
            `${idLabel(key)} requis pour l'outil ${provider.id} (env ${profile.env}).`,
            `envProfiles[${idx}].config.${key}`,
          ),
        );
      }
    }
  }

  for (const [key, value] of Object.entries(cfg)) {
    if (!value) continue;
    if (isPlaceholder(value)) {
      const issue = {
        code: isProd ? 'R-001' : 'W-001',
        message: `La valeur "${value}" ressemble à un placeholder de démo.`,
        path: `envProfiles[${idx}].config.${key}`,
      };
      if (isProd) errors.push({ ...issue, severity: 'error' });
      else warnings.push({ ...issue, severity: 'warning' });
    }
    const format = ID_FORMATS.find((f) => f.key === key);
    if (format && !format.format.test(value)) {
      warnings.push(
        warn(
          'W-004',
          `${format.label} ne respecte pas le format attendu.`,
          `envProfiles[${idx}].config.${key}`,
        ),
      );
    }
  }
}

function providerRequiredKeys(providerId: string): string[] {
  switch (providerId) {
    case 'ga4':
      return ['ga4MeasurementId'];
    case 'googleAds':
      return ['googleAdsConversionId'];
    case 'meta':
      return ['metaPixelId'];
    case 'tiktok':
      return ['tiktokPixelId'];
    case 'gtm':
      return ['gtmContainerId'];
    default:
      return [];
  }
}

function idLabel(key: string): string {
  const fmt = ID_FORMATS.find((f) => f.key === key);
  return fmt?.label ?? key;
}

export const __test__ = { isPlaceholder, providerRequiredKeys, ID_FORMATS };
