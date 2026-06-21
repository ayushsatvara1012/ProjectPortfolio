import { describe, it, expect } from 'vitest';
import type { Tier, MeResponse, BotPlan } from '@/src/lib/types/api';
import { UpgradeError } from '@/src/lib/errors';

// Mirrors PLAN_LIMITS from config.py — single frontend source of truth for UI gating
const PLAN_LIMITS: Record<Tier, { max_bots: number; messages: number; chunks: number }> = {
  FREE:       { max_bots: 0,   messages: 0,      chunks: 0     },
  EXPLORE:    { max_bots: 1,   messages: 1000,   chunks: 200   },
  STARTER:    { max_bots: 1,   messages: 5000,   chunks: 1000  },
  PRO:        { max_bots: 3,   messages: 15000,  chunks: 4000  },
  BUSINESS:   { max_bots: 5,   messages: 50000,  chunks: 15000 },
  ENTERPRISE: { max_bots: 999, messages: 999999, chunks: 99999 },
  CUSTOM:     { max_bots: 999, messages: 999999, chunks: 99999 },
};

function canAddBot(plan: BotPlan): boolean {
  return plan.can_add_more && plan.current_bots < plan.max_bots;
}

function isOverMessageLimit(me: MeResponse): boolean {
  if (me.messages_used == null || me.message_limit == null) return false;
  return me.messages_used >= me.message_limit;
}

describe('Tier hierarchy', () => {
  it('FREE tier has 0 bots and 0 messages', () => {
    expect(PLAN_LIMITS.FREE.max_bots).toBe(0);
    expect(PLAN_LIMITS.FREE.messages).toBe(0);
  });

  it('PRO has more messages than STARTER', () => {
    expect(PLAN_LIMITS.PRO.messages).toBeGreaterThan(PLAN_LIMITS.STARTER.messages);
  });

  it('ENTERPRISE has more bots than PRO', () => {
    expect(PLAN_LIMITS.ENTERPRISE.max_bots).toBeGreaterThan(PLAN_LIMITS.PRO.max_bots);
  });

  it('STARTER is between FREE and PRO for messages', () => {
    expect(PLAN_LIMITS.STARTER.messages).toBeGreaterThan(PLAN_LIMITS.FREE.messages);
    expect(PLAN_LIMITS.STARTER.messages).toBeLessThan(PLAN_LIMITS.PRO.messages);
  });

  it('EXPLORE is between FREE and STARTER for messages', () => {
    expect(PLAN_LIMITS.EXPLORE.messages).toBeGreaterThan(PLAN_LIMITS.FREE.messages);
    expect(PLAN_LIMITS.EXPLORE.messages).toBeLessThan(PLAN_LIMITS.STARTER.messages);
  });

  it('BUSINESS (Scale) has more messages than PRO (Growth)', () => {
    expect(PLAN_LIMITS.BUSINESS.messages).toBeGreaterThan(PLAN_LIMITS.PRO.messages);
  });

  it('BUSINESS has more bots than PRO', () => {
    expect(PLAN_LIMITS.BUSINESS.max_bots).toBeGreaterThan(PLAN_LIMITS.PRO.max_bots);
  });

  it('full ladder: FREE < EXPLORE < STARTER < PRO < BUSINESS < ENTERPRISE', () => {
    const tiers: Tier[] = ['FREE', 'EXPLORE', 'STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE'];
    for (let i = 1; i < tiers.length; i++) {
      expect(PLAN_LIMITS[tiers[i]].messages).toBeGreaterThan(PLAN_LIMITS[tiers[i - 1]].messages);
    }
  });
});

describe('canAddBot', () => {
  it('returns false when can_add_more is false', () => {
    const plan: BotPlan = { tier: 'STARTER', can_add_more: false, speed_tier: 'standard', current_bots: 0, max_bots: 1, message_limit: 1500, chunk_limit: 300 };
    expect(canAddBot(plan)).toBe(false);
  });

  it('returns false when at max_bots', () => {
    const plan: BotPlan = { tier: 'STARTER', can_add_more: true, speed_tier: 'standard', current_bots: 1, max_bots: 1, message_limit: 1500, chunk_limit: 300 };
    expect(canAddBot(plan)).toBe(false);
  });

  it('returns true when under limit', () => {
    const plan: BotPlan = { tier: 'PRO', can_add_more: true, speed_tier: 'dedicated', current_bots: 2, max_bots: 5, message_limit: 5000, chunk_limit: 2000 };
    expect(canAddBot(plan)).toBe(true);
  });
});

describe('isOverMessageLimit', () => {
  it('returns true when messages_used >= message_limit', () => {
    const me: MeResponse = { role: 'USER', tier: 'STARTER', messages_used: 1500, message_limit: 1500 };
    expect(isOverMessageLimit(me)).toBe(true);
  });

  it('returns false when under limit', () => {
    const me: MeResponse = { role: 'USER', tier: 'PRO', messages_used: 100, message_limit: 5000 };
    expect(isOverMessageLimit(me)).toBe(false);
  });

  it('returns false when limit fields are absent', () => {
    const me: MeResponse = { role: 'USER', tier: 'ENTERPRISE' };
    expect(isOverMessageLimit(me)).toBe(false);
  });
});

describe('UpgradeError tier enforcement', () => {
  it('carries tier and limit from 402 response shape', () => {
    const err = new UpgradeError({ code: 'MSG_LIMIT', message: 'Limit hit', tier: 'STARTER', current: 1500, limit: 1500 });
    expect(err.tier).toBe('STARTER');
    expect(err.current).toBe(1500);
    expect(err.limit).toBe(1500);
  });

  it('is catchable as UpgradeError for UI branching', () => {
    const thrown = new UpgradeError({ code: 'BOT_LIMIT', tier: 'FREE' });
    expect(thrown instanceof UpgradeError).toBe(true);
    expect(thrown instanceof Error).toBe(true);
  });
});
