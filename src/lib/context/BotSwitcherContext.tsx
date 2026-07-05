'use client';

import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';

// The GLOBAL bot switcher: AppLayout fetches the bot list once and publishes it
// here so every dashboard page (Pipeline, Customize, Conversations, ...) reads
// and writes the SAME selected bot — no more per-page selection that resets on
// navigation. Persisted to localStorage so a returning user lands back on the
// bot they were last working on instead of re-picking every time.
export type SwitcherBot = { id: string; bot_name?: string; company_name?: string; vertical?: string | null };

const STORAGE_KEY = 'sapybase:selectedBotId';

function readStoredBotId(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

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
  const [selectedBotId, setSelectedBotIdState] = useState(readStoredBotId);
  const [showPreview, setShowPreview] = useState(false);

  const setBots = useCallback((next: SwitcherBot[]) => setBotsState(next), []);

  const setSelectedBotId = useCallback((id: string) => {
    setSelectedBotIdState(id);
    if (typeof window !== 'undefined') {
      try {
        if (id) window.localStorage.setItem(STORAGE_KEY, id);
        else window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // localStorage unavailable (private mode, etc.) — selection just won't persist.
      }
    }
  }, []);

  const value = useMemo(
    () => ({ bots, setBots, selectedBotId, setSelectedBotId, showPreview, setShowPreview }),
    [bots, setBots, selectedBotId, setSelectedBotId, showPreview]
  );

  return <BotSwitcherContext.Provider value={value}>{children}</BotSwitcherContext.Provider>;
}

export function useBotSwitcher() {
  const ctx = useContext(BotSwitcherContext);
  if (!ctx) throw new Error('useBotSwitcher must be used within a BotSwitcherProvider');
  return ctx;
}
