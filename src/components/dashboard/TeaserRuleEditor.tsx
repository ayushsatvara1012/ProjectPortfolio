'use client';

// Contextual teaser (Phase 3) — owner rule editor. Each rule targets a URL match
// and/or an explicit `SapybaseConfig.page` tag; the loader tries them in this
// array's order and shows the first match (services/teaser.py mirrors these caps
// and drop rules server-side — this is UI-side validation only, not the XSS gate).

import React, { useState } from 'react';
import type { TeaserRuleField } from '@/src/lib/context/BotSettingsContext';

export const TITLE_MAX = 80;
export const SUBTEXT_MAX = 140;
export const MATCH_MAX = 200;
export const PAGE_MAX = 40;
export const RULES_MAX = 40;

export interface TeaserRuleValidation {
  valid: boolean;
  missingTitleRows: number[];
  noTargetRows: number[]; // neither `match` nor `page` set — the rule can never fire
}

/** Pure validation mirrored from services/teaser.py's `_clean_rule` drop rules. */
export function validateTeaserRules(rules: TeaserRuleField[]): TeaserRuleValidation {
  const missingTitleRows: number[] = [];
  const noTargetRows: number[] = [];
  (Array.isArray(rules) ? rules : []).forEach((r, i) => {
    if (!r?.title?.trim()) missingTitleRows.push(i);
    if (!r?.match?.trim() && !r?.page?.trim()) noTargetRows.push(i);
  });
  return {
    valid: missingTitleRows.length === 0 && noTargetRows.length === 0,
    missingTitleRows,
    noTargetRows,
  };
}

const inputCls = 'w-full text-sm font-google px-3 py-2 bg-slate-100 dark:bg-slate-800 focus:bg-slate-200 dark:focus:bg-slate-700 focus:outline-none text-slate-900 dark:text-slate-200 transition-colors rounded-lg';
const targetInputCls = 'text-[11px] font-mono px-1.5 py-1 rounded bg-transparent border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 focus:outline-none w-full';

type AuthFetch = (url: string, init?: RequestInit) => Promise<any>;

interface SuggestButtonProps {
  botId?: string;
  authFetch?: AuthFetch;
  match?: string;
  page?: string;
  onApply: (suggestion: { title: string; subtext: string }) => void;
}

/** "Suggest copy" — an authoring-time AI assist (Gemini, dashboard-only). The
 * owner reviews/edits the result before it's saved; it never runs on the
 * visitor's page. Reused for both rule rows and the default teaser copy. */
export const TeaserSuggestButton = ({ botId, authFetch, match, page, onApply }: SuggestButtonProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!authFetch) return null;

  const handleClick = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/api/company/teaser/suggest-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: botId || null,
          match: match?.trim() || null,
          page: page?.trim() || null,
        }),
      });
      if (res?.suggestion?.title) {
        onApply({ title: res.suggestion.title, subtext: res.suggestion.subtext || '' });
      } else {
        setError('No suggestion returned.');
      }
    } catch (e: any) {
      setError(e?.message || 'Could not generate a suggestion.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inline-flex items-center gap-1.5 shrink-0">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-1 text-[11.5px] font-google font-medium text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 disabled:no-underline whitespace-nowrap"
      >
        <span className="material-symbols-outlined text-[13px]">{loading ? 'progress_activity' : 'auto_awesome'}</span>
        {loading ? 'Thinking…' : 'Suggest copy'}
      </button>
      {error && <span className="text-[11px] font-google text-red-500 dark:text-red-400">{error}</span>}
    </div>
  );
};

interface Props {
  rules: TeaserRuleField[];
  onChange: (rules: TeaserRuleField[]) => void;
  botId?: string;
  authFetch?: AuthFetch;
}

const TeaserRuleEditor = ({ rules, onChange, botId, authFetch }: Props) => {
  const validation = validateTeaserRules(rules);

  const update = (idx: number, patch: Partial<TeaserRuleField>) => {
    onChange(rules.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };
  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= rules.length) return;
    const next = [...rules];
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  };
  const remove = (idx: number) => onChange(rules.filter((_, i) => i !== idx));
  const add = () => {
    if (rules.length >= RULES_MAX) return;
    onChange([...rules, { match: '', page: '', title: '', subtext: '' }]);
  };

  return (
    <div className="space-y-3">
      {rules.length === 0 && (
        <p className="text-xs font-google text-slate-400 dark:text-slate-500 italic">
          No custom rules yet — the default teaser above shows everywhere until you add one.
        </p>
      )}
      <p className="text-[11.5px] font-google text-slate-400 dark:text-slate-500 leading-relaxed">
        First matching rule wins, so order matters. A rule needs a URL path, a page tag, or both to fire.
      </p>

      <div className="space-y-2">
        {rules.map((r, idx) => {
          const missingTitle = validation.missingTitleRows.includes(idx);
          const noTarget = validation.noTargetRows.includes(idx);
          return (
            <div key={idx} className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 space-y-2.5">
              <div className="flex items-start gap-2">
                {/* Reorder */}
                <div className="flex flex-col gap-0.5 pt-1.5 shrink-0">
                  <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0}
                    aria-label="Move rule up"
                    className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-25 disabled:cursor-not-allowed">
                    <span className="material-symbols-outlined text-[16px] leading-none">keyboard_arrow_up</span>
                  </button>
                  <button type="button" onClick={() => move(idx, 1)} disabled={idx === rules.length - 1}
                    aria-label="Move rule down"
                    className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-25 disabled:cursor-not-allowed">
                    <span className="material-symbols-outlined text-[16px] leading-none">keyboard_arrow_down</span>
                  </button>
                </div>

                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={r.title}
                      onChange={(e) => update(idx, { title: e.target.value.slice(0, TITLE_MAX) })}
                      placeholder="Title (e.g. Want the best price?)"
                      className={inputCls + (missingTitle ? ' ring-1 ring-red-400 dark:ring-red-500' : '')}
                      aria-label={`Rule ${idx + 1} title`}
                    />
                    <TeaserSuggestButton
                      botId={botId}
                      authFetch={authFetch}
                      match={r.match}
                      page={r.page}
                      onApply={({ title, subtext }) => update(idx, { title, subtext })}
                    />
                  </div>
                  <input
                    type="text"
                    value={r.subtext}
                    onChange={(e) => update(idx, { subtext: e.target.value.slice(0, SUBTEXT_MAX) })}
                    placeholder="Subtext (e.g. Tell me your quantity — I'll check for you.)"
                    className={inputCls}
                    aria-label={`Rule ${idx + 1} subtext`}
                  />
                  <div className="flex items-center gap-1.5 pl-0.5">
                    <span className="text-[10.5px] font-google text-slate-400 dark:text-slate-500 shrink-0">path</span>
                    <input
                      type="text"
                      value={r.match}
                      onChange={(e) => update(idx, { match: e.target.value.slice(0, MATCH_MAX) })}
                      placeholder="/pricing"
                      className={targetInputCls + (noTarget ? ' border-red-400 text-red-600 dark:text-red-400' : '')}
                      aria-label={`Rule ${idx + 1} URL match`}
                      spellCheck={false}
                    />
                    <span className="text-[10.5px] font-google text-slate-400 dark:text-slate-500 shrink-0">page</span>
                    <input
                      type="text"
                      value={r.page}
                      onChange={(e) => update(idx, { page: e.target.value.slice(0, PAGE_MAX) })}
                      placeholder="pricing"
                      className={targetInputCls + (noTarget ? ' border-red-400 text-red-600 dark:text-red-400' : '')}
                      aria-label={`Rule ${idx + 1} page tag`}
                      spellCheck={false}
                    />
                  </div>
                  {missingTitle && <p className="text-[10.5px] text-red-500 dark:text-red-400 pl-0.5">Needs a title</p>}
                  {noTarget && <p className="text-[10.5px] text-red-500 dark:text-red-400 pl-0.5">Needs a URL path or page tag to fire</p>}
                </div>

                <button type="button" onClick={() => remove(idx)} aria-label="Remove rule"
                  className="p-1.5 text-slate-400 hover:text-red-500 transition-colors shrink-0 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10">
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={add}
        disabled={rules.length >= RULES_MAX}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium font-google bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
      >
        <span className="material-symbols-outlined text-[14px]">add</span>
        {rules.length >= RULES_MAX ? `Limit reached (${RULES_MAX})` : 'Add rule'}
      </button>
    </div>
  );
};

export default TeaserRuleEditor;
