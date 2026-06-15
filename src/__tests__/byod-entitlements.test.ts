import { describe, it, expect } from 'vitest';
import { resolveEntitlements } from '@/src/lib/auth/entitlements';

// RFC docs/rfc-byod.md Phase 1.1 — "Entitlement resolution returns all-features+BYOD".
// Mirrors sapybase_ai_engine/config.py › PLAN_LIMITS["BYOD"] (Rule R18). The Python
// side (test_byod_config_ts_mirror.py) guards that the two files stay in sync.

const ALL_CAPABILITIES = [
  'canUseCustomLogo',
  'canWhiteLabel',
  'canUseWebhooks',
  'canUseHumanHandoff',
  'canUseLeadCapture',
  'canUseAnalytics',
  'canUseAdvancedBot',
  'canUseByoDatabase',
] as const;

describe('BYOD entitlements (Phase 1.1)', () => {
  it('BYOD tier defaults grant every feature including byo_database', () => {
    const ent = resolveEntitlements('USER', 'BYOD', null);
    for (const cap of ALL_CAPABILITIES) {
      expect(ent[cap], cap).toBe(true);
    }
  });

  it('a custom plan seeded from the BYOD template (all-on) grants everything', () => {
    const byodSeedFeatures = {
      advanced_bot: true,
      human_handoff: true,
      lead_capture: true,
      white_label: true,
      webhook: true,
      custom_logo: true,
      analytics: true,
      byo_database: true,
    };
    const ent = resolveEntitlements('USER', 'CUSTOM', byodSeedFeatures);
    for (const cap of ALL_CAPABILITIES) {
      expect(ent[cap], cap).toBe(true);
    }
  });

  it('byo_database resolves independently from other flags', () => {
    // Granting ONLY byo_database must not switch on unrelated capabilities.
    const ent = resolveEntitlements('USER', 'CUSTOM', { byo_database: true });
    expect(ent.canUseByoDatabase).toBe(true);
    expect(ent.canWhiteLabel).toBe(false);
    expect(ent.canUseAnalytics).toBe(false);
    expect(ent.canUseLeadCapture).toBe(false);
  });

  it('byo_database is OFF for every standard (non-BYOD) tier', () => {
    for (const tier of ['FREE', 'STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE']) {
      expect(resolveEntitlements('USER', tier, null).canUseByoDatabase, tier).toBe(false);
    }
  });

  it('SUPER_ADMIN always has byo_database', () => {
    expect(
      resolveEntitlements('SUPER_ADMIN', 'FREE', null).canUseByoDatabase,
    ).toBe(true);
  });
});
