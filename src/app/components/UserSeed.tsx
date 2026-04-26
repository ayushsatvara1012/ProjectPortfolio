'use client';

import { useEffect } from 'react';
import { useUserRole } from '@/src/lib/context/UserContext';

// Hydrates UserContext with server-resolved role/tier on the first paint of a
// protected layout. Avoids the empty-then-populated flicker that happens when
// /api/me is fetched only client-side after mount.
export default function UserSeed({
  role,
  tier,
}: {
  role: string | null;
  tier: string | null;
}) {
  const { hydrateFromServer } = useUserRole();
  useEffect(() => {
    hydrateFromServer({ role, tier });
  }, [role, tier, hydrateFromServer]);
  return null;
}
