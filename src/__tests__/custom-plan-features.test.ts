import { describe, it, expect } from 'vitest';
import { resolveEntitlements, type Entitlements } from '@/src/lib/auth/entitlements';

describe('Custom Plan Features - Entitlements Resolution', () => {
  describe('Independent Feature Gates', () => {
    it('should resolve advanced_bot independently', () => {
      const customPlanFeatures = {
        advanced_bot: true,
        human_handoff: false,
        webhook: false,
        custom_logo: false,
        lead_capture: false,
        white_label: false,
        analytics: false,
      };

      const entitlements = resolveEntitlements('USER', 'CUSTOM', customPlanFeatures);

      expect(entitlements.canUseAdvancedBot).toBe(true);
      expect(entitlements.canUseHumanHandoff).toBe(false);
      expect(entitlements.canUseWebhooks).toBe(false);
      expect(entitlements.canUseCustomLogo).toBe(false);
    });

    it('should resolve webhook independently from custom_logo', () => {
      const customPlanFeatures = {
        advanced_bot: false,
        human_handoff: false,
        webhook: true,
        custom_logo: false,
        lead_capture: true,
        white_label: false,
        analytics: false,
      };

      const entitlements = resolveEntitlements('USER', 'CUSTOM', customPlanFeatures);

      expect(entitlements.canUseWebhooks).toBe(true);
      expect(entitlements.canUseLeadCapture).toBe(true);
      expect(entitlements.canUseCustomLogo).toBe(false);
    });

    it('should resolve human_handoff independently', () => {
      const customPlanFeatures = {
        advanced_bot: false,
        human_handoff: true,
        webhook: false,
        custom_logo: false,
        lead_capture: false,
        white_label: false,
        analytics: false,
      };

      const entitlements = resolveEntitlements('USER', 'CUSTOM', customPlanFeatures);

      expect(entitlements.canUseHumanHandoff).toBe(true);
      expect(entitlements.canUseWebhooks).toBe(false);
      expect(entitlements.canUseCustomLogo).toBe(false);
    });

    it('should allow all features together', () => {
      const customPlanFeatures = {
        advanced_bot: true,
        human_handoff: true,
        webhook: true,
        custom_logo: true,
        lead_capture: true,
        white_label: true,
        analytics: true,
      };

      const entitlements = resolveEntitlements('USER', 'CUSTOM', customPlanFeatures);

      expect(entitlements.canUseAdvancedBot).toBe(true);
      expect(entitlements.canUseHumanHandoff).toBe(true);
      expect(entitlements.canUseWebhooks).toBe(true);
      expect(entitlements.canUseCustomLogo).toBe(true);
      expect(entitlements.canUseLeadCapture).toBe(true);
      expect(entitlements.canWhiteLabel).toBe(true);
      expect(entitlements.canUseAnalytics).toBe(true);
    });

    it('should deny all features when none are enabled', () => {
      const customPlanFeatures = {
        advanced_bot: false,
        human_handoff: false,
        webhook: false,
        custom_logo: false,
        lead_capture: false,
        white_label: false,
        analytics: false,
      };

      const entitlements = resolveEntitlements('USER', 'CUSTOM', customPlanFeatures);

      expect(entitlements.canUseAdvancedBot).toBe(false);
      expect(entitlements.canUseHumanHandoff).toBe(false);
      expect(entitlements.canUseWebhooks).toBe(false);
      expect(entitlements.canUseCustomLogo).toBe(false);
      expect(entitlements.canUseLeadCapture).toBe(false);
      expect(entitlements.canWhiteLabel).toBe(false);
      expect(entitlements.canUseAnalytics).toBe(false);
    });
  });

  describe('Tier-Based Defaults Fallback', () => {
    it('should fall back to FREE tier defaults when custom plan has no features', () => {
      const customPlanFeatures = {};

      const entitlements = resolveEntitlements('USER', 'FREE', customPlanFeatures);

      expect(entitlements.canUseAdvancedBot).toBe(false);
      expect(entitlements.canUseCustomLogo).toBe(false);
      expect(entitlements.canUseWebhooks).toBe(false);
    });

    it('should fall back to STARTER tier defaults', () => {
      const entitlements = resolveEntitlements('USER', 'STARTER', null);

      expect(entitlements.canUseAdvancedBot).toBe(true);
      expect(entitlements.canWhiteLabel).toBe(true);
      expect(entitlements.canUseCustomLogo).toBe(false);
    });

    it('should fall back to PRO tier defaults', () => {
      const entitlements = resolveEntitlements('USER', 'PRO', null);

      expect(entitlements.canUseAdvancedBot).toBe(true);
      expect(entitlements.canUseCustomLogo).toBe(true);
      expect(entitlements.canUseWebhooks).toBe(true);
      expect(entitlements.canUseHumanHandoff).toBe(true);
      expect(entitlements.canWhiteLabel).toBe(true);
      expect(entitlements.canUseAnalytics).toBe(true);
    });
  });

  describe('Custom Plan Override Tier Defaults', () => {
    it('should override tier defaults with custom plan features', () => {
      // FREE user with custom plan granting advanced_bot
      const customPlanFeatures = {
        advanced_bot: true,
        human_handoff: false,
        webhook: false,
        custom_logo: false,
        lead_capture: false,
        white_label: false,
        analytics: false,
      };

      const entitlements = resolveEntitlements('USER', 'CUSTOM', customPlanFeatures);

      // Should have custom plan's advanced_bot, not tier default
      expect(entitlements.canUseAdvancedBot).toBe(true);
      // Should NOT have tier defaults for other features
      expect(entitlements.canUseCustomLogo).toBe(false);
      expect(entitlements.canUseWebhooks).toBe(false);
    });

    it('should allow selective feature grants to lower tiers', () => {
      // BASIC user with custom plan adding webhooks+lead_capture
      const customPlanFeatures = {
        advanced_bot: false,
        human_handoff: false,
        webhook: true,
        custom_logo: false,
        lead_capture: true,
        white_label: false,
        analytics: false,
      };

      const entitlements = resolveEntitlements('USER', 'CUSTOM', customPlanFeatures);

      expect(entitlements.canUseWebhooks).toBe(true);
      expect(entitlements.canUseLeadCapture).toBe(true);
      expect(entitlements.canUseCustomLogo).toBe(false);
      expect(entitlements.canUseAdvancedBot).toBe(false);
    });
  });

  describe('SUPER_ADMIN Role', () => {
    it('should grant all entitlements to SUPER_ADMIN regardless of custom plan', () => {
      const customPlanFeatures = {
        advanced_bot: false,
        human_handoff: false,
        webhook: false,
        custom_logo: false,
        lead_capture: false,
        white_label: false,
        analytics: false,
      };

      const entitlements = resolveEntitlements('SUPER_ADMIN', 'FREE', customPlanFeatures);

      expect(entitlements.canUseAdvancedBot).toBe(true);
      expect(entitlements.canUseCustomLogo).toBe(true);
      expect(entitlements.canUseWebhooks).toBe(true);
      expect(entitlements.canUseHumanHandoff).toBe(true);
      expect(entitlements.canUseLeadCapture).toBe(true);
      expect(entitlements.canWhiteLabel).toBe(true);
      expect(entitlements.canUseAnalytics).toBe(true);
    });
  });

  describe('Real-World Scenarios', () => {
    it('Scenario: User faltu109@gmail.com with webhooks & handoff, no logo', () => {
      const customPlanFeatures = {
        advanced_bot: false,
        human_handoff: true,
        webhook: true,
        custom_logo: false,
        lead_capture: true,
        white_label: false,
        analytics: false,
      };

      const entitlements = resolveEntitlements('USER', 'CUSTOM', customPlanFeatures);

      // Should be able to use webhooks and handoff
      expect(entitlements.canUseWebhooks).toBe(true);
      expect(entitlements.canUseLeadCapture).toBe(true);
      expect(entitlements.canUseHumanHandoff).toBe(true);

      // Should NOT have custom logo
      expect(entitlements.canUseCustomLogo).toBe(false);
    });

    it('Scenario: FREE tier user upgraded to custom plan with advanced behavior', () => {
      const customPlanFeatures = {
        advanced_bot: true,
        human_handoff: false,
        webhook: false,
        custom_logo: false,
        lead_capture: false,
        white_label: false,
        analytics: false,
      };

      const entitlements = resolveEntitlements('USER', 'CUSTOM', customPlanFeatures);

      // Should have advanced behavior even though they're on FREE tier
      expect(entitlements.canUseAdvancedBot).toBe(true);

      // Should NOT have other features (not in custom plan)
      expect(entitlements.canUseCustomLogo).toBe(false);
      expect(entitlements.canUseWebhooks).toBe(false);
    });

    it('Scenario: STARTER tier user with custom plan adding webhooks', () => {
      const customPlanFeatures = {
        advanced_bot: false, // Already has from STARTER
        human_handoff: false,
        webhook: true,
        custom_logo: false,
        lead_capture: true,
        white_label: false,
        analytics: false,
      };

      const entitlements = resolveEntitlements('USER', 'CUSTOM', customPlanFeatures);

      // Should have STARTER defaults + custom plan additions
      expect(entitlements.canUseAdvancedBot).toBe(false); // Not in custom plan, use tier default
      expect(entitlements.canWhiteLabel).toBe(false); // Not in custom plan, but STARTER has it by default
      expect(entitlements.canUseWebhooks).toBe(true);
      expect(entitlements.canUseLeadCapture).toBe(true);
    });

    it('Scenario: Enterprise tier with custom plan overrides', () => {
      // Enterprise has everything, custom plan disables some
      const customPlanFeatures = {
        advanced_bot: true,
        human_handoff: false, // Disabled in custom plan
        webhook: true,
        custom_logo: true,
        lead_capture: true,
        white_label: true,
        analytics: true,
      };

      const entitlements = resolveEntitlements('USER', 'CUSTOM', customPlanFeatures);

      // Custom plan settings override tier defaults
      expect(entitlements.canUseHumanHandoff).toBe(false);
      expect(entitlements.canUseWebhooks).toBe(true);
      expect(entitlements.canUseCustomLogo).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null custom plan features', () => {
      const entitlements = resolveEntitlements('USER', 'CUSTOM', null);

      // Should fall back to CUSTOM tier defaults (which are all false)
      expect(entitlements.canUseAdvancedBot).toBe(false);
      expect(entitlements.canUseCustomLogo).toBe(false);
    });

    it('should handle undefined custom plan features', () => {
      const entitlements = resolveEntitlements('USER', 'CUSTOM', undefined);

      expect(entitlements.canUseAdvancedBot).toBe(false);
    });

    it('should handle invalid tier string', () => {
      const customPlanFeatures = {
        advanced_bot: true,
        human_handoff: false,
        webhook: false,
        custom_logo: false,
        lead_capture: false,
        white_label: false,
        analytics: false,
      };

      const entitlements = resolveEntitlements('USER', 'INVALID_TIER', customPlanFeatures);

      // Should use custom plan features and fall back to FREE tier defaults
      expect(entitlements.canUseAdvancedBot).toBe(true);
      expect(entitlements.canUseCustomLogo).toBe(false);
    });

    it('should handle null tier', () => {
      const customPlanFeatures = {
        advanced_bot: true,
        human_handoff: false,
        webhook: false,
        custom_logo: false,
        lead_capture: false,
        white_label: false,
        analytics: false,
      };

      const entitlements = resolveEntitlements('USER', null, customPlanFeatures);

      // Should use custom plan features and fall back to FREE tier defaults
      expect(entitlements.canUseAdvancedBot).toBe(true);
    });

    it('should handle "null" string as tier', () => {
      const customPlanFeatures = {
        advanced_bot: true,
        human_handoff: false,
        webhook: false,
        custom_logo: false,
        lead_capture: false,
        white_label: false,
        analytics: false,
      };

      const entitlements = resolveEntitlements('USER', 'null', customPlanFeatures);

      expect(entitlements.canUseAdvancedBot).toBe(true);
    });

    it('should be case-insensitive for tier', () => {
      const entitlements1 = resolveEntitlements('USER', 'pro', null);
      const entitlements2 = resolveEntitlements('USER', 'PRO', null);
      const entitlements3 = resolveEntitlements('USER', 'Pro', null);

      expect(entitlements1.canUseCustomLogo).toBe(entitlements2.canUseCustomLogo);
      expect(entitlements2.canUseCustomLogo).toBe(entitlements3.canUseCustomLogo);
      expect(entitlements1.canUseCustomLogo).toBe(true);
    });
  });
});
