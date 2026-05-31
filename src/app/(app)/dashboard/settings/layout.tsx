'use client';

import { usePathname } from 'next/navigation';

// Settings tab container.
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullHeightPane = pathname === '/dashboard/settings/customize';

  return (
    <div
      data-section="dashboard-settings"
      className={`flex-1 flex flex-col ${isFullHeightPane ? 'lg:min-h-0 lg:overflow-hidden' : ''}`}
    >
      {children}
    </div>
  );
}
