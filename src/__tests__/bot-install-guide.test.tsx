import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BotInstallGuide from '@/src/components/features/BotInstallGuide';

// jsdom sets window.location.origin to http://localhost:3000 by default.
const ORIGIN = 'http://localhost:3000';
const KEY = 'bot_test_123';

describe('BotInstallGuide (stack-aware embed picker)', () => {
  beforeEach(() => {
    // Deterministic clipboard so we can assert what gets copied.
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn(() => Promise.resolve()) },
    });
  });

  it('defaults to the HTML stack and interpolates origin + bot id', () => {
    render(<BotInstallGuide apiKey={KEY} />);
    const pre = document.querySelector('pre');
    expect(pre?.textContent).toContain(`${ORIGIN}/sapybase-loader.js`);
    expect(pre?.textContent).toContain(`data-bot-id="${KEY}"`);
    // Canonical loader — never the legacy widget.js / data-api-key form.
    expect(pre?.textContent).not.toContain('widget.js');
    expect(pre?.textContent).not.toContain('data-api-key');
  });

  it('swaps the snippet + steps when a different stack is picked', () => {
    render(<BotInstallGuide apiKey={KEY} />);
    // HTML default has no next/script import.
    expect(document.querySelector('pre')?.textContent).not.toContain("next/script");

    fireEvent.click(screen.getByRole('button', { name: 'Next.js' }));

    const pre = document.querySelector('pre');
    expect(pre?.textContent).toContain("import Script from 'next/script'");
    expect(pre?.textContent).toContain('strategy="lazyOnload"');
    expect(pre?.textContent).toContain(`data-bot-id="${KEY}"`);
    // The per-stack "How to install" heading reflects the active stack.
    expect(screen.getByText('How to install (Next.js)')).toBeTruthy();
  });

  it('offers no-code / CMS stacks with the plain script tag', () => {
    render(<BotInstallGuide apiKey={KEY} />);
    fireEvent.click(screen.getByRole('button', { name: 'WordPress' }));
    const pre = document.querySelector('pre');
    expect(pre?.textContent).toContain(`${ORIGIN}/sapybase-loader.js`);
    expect(pre?.textContent).toContain(`data-bot-id="${KEY}"`);
    expect(screen.getByText('How to install (WordPress)')).toBeTruthy();
  });

  it('copies the tailored snippet for the active stack', () => {
    render(<BotInstallGuide apiKey={KEY} />);
    fireEvent.click(screen.getByRole('button', { name: 'React' }));
    fireEvent.click(screen.getByRole('button', { name: /copy/i }));

    const written = (navigator.clipboard.writeText as any).mock.calls[0][0] as string;
    expect(written).toContain("import { useEffect } from 'react'");
    expect(written).toContain(`s.dataset.botId = '${KEY}'`);
    expect(written).toContain(`${ORIGIN}/sapybase-loader.js`);
  });
});
