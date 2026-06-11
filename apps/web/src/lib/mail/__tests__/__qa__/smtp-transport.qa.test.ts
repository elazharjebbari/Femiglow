/**
 * CHANTIER H — Module 08 : configuration du transport SMTP (pool, TLS) via stub
 * nodemailer. Test UNIT (aucune vraie connexion ; on capture les options
 * passées à `nodemailer.createTransport`).
 *
 * Oracles :
 *  - pool borné (`pool:true`, `maxConnections:5`, timeouts posés) → protège
 *    Stalwart d'une rafale de connexions ;
 *  - `SmtpNotConfiguredError` levée quand SMTP_USER/PASSWORD manquent (pas de
 *    transport silencieusement cassé) ;
 *  - TLS : on DOCUMENTE l'état courant `rejectUnauthorized:false` (écart de
 *    sécurité connu, loopback-only — consigné dans bugsFound). L'oracle vérifie
 *    la valeur RÉELLE pour figer le comportement et faire échouer le test le
 *    jour où on durcit (ou régresse) ce réglage.
 *
 * IDs matrice : PIP-INT-114 (TLS, RED documenté), PIP-INT-116 (pool borné).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Capture des options passées à createTransport, et stub du transporter.
const createdConfigs: Record<string, unknown>[] = [];

vi.mock('nodemailer', () => ({
  default: {
    createTransport: (cfg: Record<string, unknown>) => {
      createdConfigs.push(cfg);
      return { sendMail: vi.fn(), verify: vi.fn() };
    },
  },
}));

// env stub : credentials présents pour que buildTransporter construise le
// transport (le cas « non configuré » est testé via override ci-dessous).
vi.mock('@/lib/env', () => ({
  env: {
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: 587,
    SMTP_USER: 'smtp-user',
    SMTP_PASSWORD: 'smtp-pass',
  },
}));

import { getTransporter, resetTransporterForTests, SmtpNotConfiguredError } from '../../client';
import { env } from '@/lib/env';

beforeEach(() => {
  createdConfigs.length = 0;
  resetTransporterForTests();
});

afterEach(() => {
  resetTransporterForTests();
  vi.clearAllMocks();
});

describe('SMTP transport — configuration (Module 08)', () => {
  // PIP-INT-116 — pool borné : pool activé, maxConnections=5, timeouts posés.
  it('PIP-INT-116 — pool borné (pool=true, maxConnections=5, timeouts posés)', () => {
    getTransporter();
    expect(createdConfigs).toHaveLength(1);
    const cfg = createdConfigs[0]!;
    expect(cfg.pool).toBe(true);
    expect(cfg.maxConnections).toBe(5);
    expect(cfg.maxMessages).toBe(100);
    // Timeouts bornés (pas d'attente infinie sur un Stalwart muet).
    expect(cfg.socketTimeout).toBeGreaterThan(0);
    expect(cfg.connectionTimeout).toBeGreaterThan(0);
  });

  // Le transporter est un SINGLETON : deux appels → une seule construction.
  it('getTransporter est un singleton (createTransport appelé une seule fois)', () => {
    getTransporter();
    getTransporter();
    expect(createdConfigs).toHaveLength(1);
  });

  // PIP-INT-114 — TLS : DOCUMENTE l'état courant `rejectUnauthorized:false`
  // (écart connu : accepte tout cert sur loopback). Le servername SNI est fixé
  // sur le vrai hôte. Cet oracle FIGE le comportement : il cassera si on durcit
  // (cible : true) ou si on régresse — forçant une revue consciente.
  it('PIP-INT-114 — TLS rejectUnauthorized=false (écart connu) + servername SNI fixé', () => {
    getTransporter();
    const tls = createdConfigs[0]!.tls as { rejectUnauthorized?: boolean; servername?: string };
    // État courant assumé (consigné comme écart sécurité dans bugsFound).
    expect(tls.rejectUnauthorized).toBe(false);
    // Le SNI est forcé sur l'hôte réel (le cert ne couvre pas 127.0.0.1).
    expect(typeof tls.servername).toBe('string');
    expect(tls.servername!.length).toBeGreaterThan(0);
  });

  // PIP-INT-114 (volet port) — port 465 ⇒ secure ; 587 ⇒ requireTLS (STARTTLS).
  it('port 587 → requireTLS true, secure false (STARTTLS)', () => {
    getTransporter();
    const cfg = createdConfigs[0]!;
    expect(cfg.secure).toBe(false); // 587 n'est pas implicit-TLS
    expect(cfg.requireTLS).toBe(true);
  });

  // Garde-fou config : sans credentials → SmtpNotConfiguredError typée (pas un
  // transport cassé silencieux). On mute temporairement l'env stub.
  it('SMTP non configuré (USER/PASSWORD absents) → SmtpNotConfiguredError', () => {
    const e = env as unknown as { SMTP_USER?: string; SMTP_PASSWORD?: string };
    const u = e.SMTP_USER;
    const p = e.SMTP_PASSWORD;
    try {
      e.SMTP_USER = undefined;
      e.SMTP_PASSWORD = undefined;
      resetTransporterForTests();
      expect(() => getTransporter()).toThrow(SmtpNotConfiguredError);
    } finally {
      e.SMTP_USER = u;
      e.SMTP_PASSWORD = p;
      resetTransporterForTests();
    }
  });
});
