import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TeaserRuleEditor, { RULES_MAX } from '@/src/components/dashboard/TeaserRuleEditor';
import type { TeaserRuleField } from '@/src/lib/context/BotSettingsContext';

// Contextual teaser (Phase 3) — row add/remove/reorder + the "Suggest copy" AI
// assist. Mirrors sample-form-editor-sink.test.tsx's render-test convention.

const rule = (over: Partial<TeaserRuleField> = {}): TeaserRuleField => ({
  match: '', page: '', title: '', subtext: '', ...over,
});

describe('TeaserRuleEditor rows', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows an empty state with no rules', () => {
    render(<TeaserRuleEditor rules={[]} onChange={vi.fn()} />);
    expect(screen.getByText(/No custom rules yet/)).toBeInTheDocument();
  });

  it('adds a blank rule row', () => {
    const onChange = vi.fn();
    render(<TeaserRuleEditor rules={[]} onChange={onChange} />);
    fireEvent.click(screen.getByText('Add rule'));
    expect(onChange).toHaveBeenCalledWith([rule()]);
  });

  it('disables Add rule at the cap', () => {
    const many = Array.from({ length: RULES_MAX }, (_, i) => rule({ match: `/p${i}`, title: 't' }));
    render(<TeaserRuleEditor rules={many} onChange={vi.fn()} />);
    expect(screen.getByText(/Limit reached/)).toBeDisabled();
  });

  it('swaps two rows on move down / up', () => {
    const onChange = vi.fn();
    const rules = [rule({ match: '/a', title: 'A' }), rule({ match: '/b', title: 'B' })];
    render(<TeaserRuleEditor rules={rules} onChange={onChange} />);
    fireEvent.click(screen.getAllByLabelText('Move rule down')[0]);
    expect(onChange).toHaveBeenCalledWith([rules[1], rules[0]]);
  });

  it('does not move the first row up or the last row down', () => {
    const onChange = vi.fn();
    const rules = [rule({ match: '/a', title: 'A' }), rule({ match: '/b', title: 'B' })];
    render(<TeaserRuleEditor rules={rules} onChange={onChange} />);
    const upButtons = screen.getAllByLabelText('Move rule up');
    const downButtons = screen.getAllByLabelText('Move rule down');
    expect(upButtons[0]).toBeDisabled();
    expect(downButtons[1]).toBeDisabled();
  });

  it('removes a row', () => {
    const onChange = vi.fn();
    const rules = [rule({ match: '/a', title: 'A' }), rule({ match: '/b', title: 'B' })];
    render(<TeaserRuleEditor rules={rules} onChange={onChange} />);
    fireEvent.click(screen.getAllByLabelText('Remove rule')[0]);
    expect(onChange).toHaveBeenCalledWith([rules[1]]);
  });

  it('updates a row field in place', () => {
    const onChange = vi.fn();
    const rules = [rule({ match: '/a', title: 'A' })];
    render(<TeaserRuleEditor rules={rules} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Rule 1 title'), { target: { value: 'New title' } });
    expect(onChange).toHaveBeenCalledWith([{ ...rules[0], title: 'New title' }]);
  });

  it('flags a row with no title and a row with no target', () => {
    const rules = [rule({ match: '/a' }), rule({ title: 'Orphan' })];
    render(<TeaserRuleEditor rules={rules} onChange={vi.fn()} />);
    expect(screen.getByText('Needs a title')).toBeInTheDocument();
    expect(screen.getByText('Needs a URL path or page tag to fire')).toBeInTheDocument();
  });
});

describe('TeaserRuleEditor "Suggest copy" assist', () => {
  beforeEach(() => vi.clearAllMocks());

  it('hides the button when authFetch is absent', () => {
    render(<TeaserRuleEditor rules={[rule({ match: '/a', title: 'A' })]} onChange={vi.fn()} />);
    expect(screen.queryByText('Suggest copy')).not.toBeInTheDocument();
  });

  it('POSTs page context and applies the suggestion to that row', async () => {
    const onChange = vi.fn();
    const authFetch = vi.fn(() =>
      Promise.resolve({ suggestion: { title: 'Want a quote?', subtext: 'Ask away' } })
    );
    const rules = [rule({ match: '/pricing', page: 'pricing', title: 'Old' })];
    render(<TeaserRuleEditor rules={rules} onChange={onChange} botId="bot-1" authFetch={authFetch} />);
    fireEvent.click(screen.getByText('Suggest copy'));
    await waitFor(() =>
      expect(authFetch).toHaveBeenCalledWith('/api/company/teaser/suggest-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: 'bot-1', match: '/pricing', page: 'pricing' }),
      })
    );
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith([{ ...rules[0], title: 'Want a quote?', subtext: 'Ask away' }])
    );
  });

  it('shows an error message when the request fails', async () => {
    const authFetch = vi.fn(() => Promise.reject(new Error("Couldn't generate a suggestion - try again.")));
    render(
      <TeaserRuleEditor
        rules={[rule({ match: '/a', title: 'A' })]}
        onChange={vi.fn()}
        botId="bot-1"
        authFetch={authFetch}
      />
    );
    fireEvent.click(screen.getByText('Suggest copy'));
    await waitFor(() => expect(screen.getByText(/try again/)).toBeInTheDocument());
  });
});
