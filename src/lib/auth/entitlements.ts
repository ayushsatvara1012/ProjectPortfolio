export type Entitlements = {
  canUseCustomLogo: boolean;
  canWhiteLabel: boolean;
  canUseWebhooks: boolean;
  canUseHumanHandoff: boolean;
  canUseLeadCapture: boolean;
  canUseAnalytics: boolean;
  canUseAdvancedBot: boolean; // system prompt, tone, quick questions — STARTER+
};

type FeatureMap = Record<string, boolean>;

function parseCustomPlanFeatures(raw: unknown): FeatureMap | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as FeatureMap;
}

// Tier-default capability matrix. Checked after SUPER_ADMIN and custom plan.
const TIER_DEFAULTS: Record<string, Partial<Entitlements>> = {
  FREE: {},
  BASIC: {},
  STARTER: { canWhiteLabel: true, canUseAdvancedBot: true },
  PRO: {
    canUseCustomLogo: true,
    canWhiteLabel: true,
    canUseWebhooks: true,
    canUseHumanHandoff: true,
    canUseLeadCapture: true,
    canUseAnalytics: true,
    canUseAdvancedBot: true,
  },
  BUSINESS: {
    canUseCustomLogo: true,
    canWhiteLabel: true,
    canUseWebhooks: true,
    canUseHumanHandoff: true,
    canUseLeadCapture: true,
    canUseAnalytics: true,
    canUseAdvancedBot: true,
  },
  ENTERPRISE: {
    canUseCustomLogo: true,
    canWhiteLabel: true,
    canUseWebhooks: true,
    canUseHumanHandoff: true,
    canUseLeadCapture: true,
    canUseAnalytics: true,
    canUseAdvancedBot: true,
  },
};

const ALL_GRANTED: Entitlements = {
  canUseCustomLogo: true,
  canWhiteLabel: true,
  canUseWebhooks: true,
  canUseHumanHandoff: true,
  canUseLeadCapture: true,
  canUseAnalytics: true,
  canUseAdvancedBot: true,
};

const ALL_DENIED: Entitlements = {
  canUseCustomLogo: false,
  canWhiteLabel: false,
  canUseWebhooks: false,
  canUseHumanHandoff: false,
  canUseLeadCapture: false,
  canUseAnalytics: false,
  canUseAdvancedBot: false,
};

// Resolution order: SUPER_ADMIN → customPlanFeatures key → tier-default matrix.
// customPlanFeatures keys accepted: snake_case as persisted by admin editor.
export function resolveEntitlements(
  userRole: string | null,
  userTier: string | null,
  customPlanFeatures: unknown,
): Entitlements {
  if (userRole === 'SUPER_ADMIN') return ALL_GRANTED;

  const features = parseCustomPlanFeatures(customPlanFeatures);
  const normalizedTier =
    userTier && userTier !== 'null' ? userTier.toUpperCase() : 'FREE';
  const tierDefaults = TIER_DEFAULTS[normalizedTier] ?? {};

  const resolve = (
    tierKey: keyof Entitlements,
    featureKey: string,
  ): boolean => {
    if (features !== null && typeof features[featureKey] === 'boolean')
      return features[featureKey];
    return tierDefaults[tierKey] ?? false;
  };

  return {
    canUseCustomLogo: resolve('canUseCustomLogo', 'custom_logo'),
    canWhiteLabel: resolve('canWhiteLabel', 'white_label'),
    canUseWebhooks: resolve('canUseWebhooks', 'webhooks'),
    canUseHumanHandoff: resolve('canUseHumanHandoff', 'human_handoff'),
    canUseLeadCapture: resolve('canUseLeadCapture', 'lead_capture'),
    canUseAnalytics: resolve('canUseAnalytics', 'analytics'),
    canUseAdvancedBot: resolve('canUseAdvancedBot', 'advanced_bot'),
  };
}

export { ALL_DENIED };
