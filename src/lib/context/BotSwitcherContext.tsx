'use client';

import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';

// Minimal bot shape the breadcrumb switcher needs. The customize page owns the
// fetch (via /api/companies) and pushes the list here so the GLOBAL breadcrumb
// (TopNav, a shared component) can render a Vercel-style bot switcher without
// re-fetching or coupling to the page. Selection lives here too so both the
// breadcrumb and the page read/write a single source of truth.
export type SwitcherBot = { id: string; bot_name?: string; company_name?: string };

type BotSwitcherContextValue = {
  bots: SwitcherBot[];
  setBots: (bots: SwitcherBot[]) => void;
  selectedBotId: string;
  setSelectedBotId: (id: string) => void;
  showPreview: boolean;
  setShowPreview: (show: boolean) => void;
};

const BotSwitcherContext = createContext<BotSwitcherContextValue | null>(null);

export function BotSwitcherProvider({ children }: { children: React.ReactNode }) {
  const [bots, setBotsState] = useState<SwitcherBot[]>([]);
  const [selectedBotId, setSelectedBotId] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const setBots = useCallback((next: SwitcherBot[]) => setBotsState(next), []);

  const value = useMemo(
    () => ({ bots, setBots, selectedBotId, setSelectedBotId, showPreview, setShowPreview }),
    [bots, setBots, selectedBotId, showPreview]
  );

  return <BotSwitcherContext.Provider value={value}>{children}</BotSwitcherContext.Provider>;
}

export function useBotSwitcher() {
  const ctx = useContext(BotSwitcherContext);
  if (!ctx) throw new Error('useBotSwitcher must be used within a BotSwitcherProvider');
  return ctx;
}
