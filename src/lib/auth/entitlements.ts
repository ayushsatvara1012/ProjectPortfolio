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
// MUST mirror sapybase_ai_engine/config.py › PLAN_LIMITS (backend is the source
// of truth; this only drives UI gating — every capability is ALSO enforced
// server-side via has_entitlement()). Commercial mapping:
//   Starter = STARTER ($19) · Growth = PRO ($49) · Scale = BUSINESS ($99).
const TIER_DEFAULTS: Record<string, Partial<Entitlements>> = {
  FREE: {},
  // Starter: RAG bot + UI customization only. No conversion engine.
  BASIC: { canUseAdvancedBot: true }, // legacy alias of Starter
  STARTER: { canUseAdvancedBot: true },
  // Growth: + lead capture / scoring / alerts / booking / Action Center / digest.
  PRO: {
    canUseLeadCapture: true,
    canUseAdvancedBot: true,
  },
  // Scale: everything — deep BI, integrations, white-label.
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
    canUseWebhooks: resolve('canUseWebhooks', 'webhook'),
    canUseHumanHandoff: resolve('canUseHumanHandoff', 'human_handoff'),
    canUseLeadCapture: resolve('canUseLeadCapture', 'lead_capture'),
    canUseAnalytics: resolve('canUseAnalytics', 'analytics'),
    canUseAdvancedBot: resolve('canUseAdvancedBot', 'advanced_bot'),
  };
}

export { ALL_DENIED };
