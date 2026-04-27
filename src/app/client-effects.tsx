'use client';

import { useEffect, useState } from 'react';
import { Analytics } from '@vercel/analytics/next';
import UpgradePrompt from './components/UpgradePrompt';
import type { UpgradePromptProps } from './components/UpgradePrompt';

type UpgradeDetail = Pick<UpgradePromptProps, 'code' | 'tier' | 'current' | 'limit'>;

/**
 * App-wide client effects (runs inside every (site) page):
 *   - Listens for 'Sapybase:upgrade-required' custom events dispatched by the
 *     fetch interceptor in providers.tsx on HTTP 402 responses and renders the
 *     real UpgradePrompt modal.
 *   - Vercel Analytics beacon.
 */
export default function ClientEffects() {
  const [upgradeError, setUpgradeError] = useState<UpgradeDetail | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<UpgradeDetail>).detail;
      setUpgradeError(detail ?? { code: 'DEFAULT' });
    };
    window.addEventListener('Sapybase:upgrade-required', handler);
    return () => window.removeEventListener('Sapybase:upgrade-required', handler);
  }, []);

  return (
    <>
      <Analytics />
      {upgradeError && (
        <UpgradePrompt
          mode="modal"
          code={upgradeError.code}
          tier={upgradeError.tier}
          current={upgradeError.current}
          limit={upgradeError.limit}
          onDismiss={() => setUpgradeError(null)}
        />
      )}
    </>
  );
}
