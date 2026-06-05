// Central re-export barrel for all shared library modules.
// Importing from '@/src/lib' gives access to every shared utility in one place
// and ensures the knowledge graph registers all cross-module dependencies.

export { BRAND, COMPANY, PRODUCT, VAAYU_ACCENT } from './brand';
export { UpgradeError } from './errors';
export type { Tier, Role, MeResponse, BotSummary, CompanyDetails } from './types/api';
export { useAuthenticatedFetch, useIsAuthReady } from './hooks/useAuthenticatedFetch';
export { default as useInactivityTimeout } from './hooks/useInactivityTimeout';
export { default as useSessionManager } from './hooks/useSessionManager';
export { BotSettingsProvider, useBotSettings } from './context/BotSettingsContext';
export { ToastProvider, useToast } from './context/ToastContext';
export { UserProvider, useUserRole } from './context/UserContext';
