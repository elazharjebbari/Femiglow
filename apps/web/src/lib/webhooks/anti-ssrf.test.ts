import { describe, it, expect } from 'vitest';
import { isPrivateHostname } from './anti-ssrf';

describe('anti-SSRF: isPrivateHostname', () => {
  it.each([
    'localhost',
    '127.0.0.1',
    '10.0.0.5',
    '172.16.5.4',
    '192.168.1.1',
    '169.254.169.254',
    'host.local',
    'svc.internal',
    'metadata.google.internal',
    '::1',
  ])('détecte %s comme privé', (host) => {
    expect(isPrivateHostname(host)).toBe(true);
  });

  it.each(['api.partner.com', '8.8.8.8', '1.1.1.1', 'example.com'])(
    'laisse passer %s (public)',
    (host) => {
      expect(isPrivateHostname(host)).toBe(false);
    },
  );
});
