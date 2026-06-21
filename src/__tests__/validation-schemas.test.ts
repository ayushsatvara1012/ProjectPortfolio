import { describe, it, expect } from 'vitest';
import {
  emailSchema,
  urlSchema,
  leadCaptureSchema,
  handoffSchema,
  trainUrlSchema,
  trainTextSchema,
  customPlanConfigSchema,
  firstIssue,
} from '@/src/lib/validation/schemas';

describe('emailSchema', () => {
  it('accepts valid email', () => {
    expect(emailSchema.safeParse('user@example.com').success).toBe(true);
  });
  it('rejects empty string', () => {
    const r = emailSchema.safeParse('');
    expect(r.success).toBe(false);
  });
  it('rejects invalid format', () => {
    expect(emailSchema.safeParse('not-an-email').success).toBe(false);
  });
  it('trims whitespace before validation', () => {
    expect(emailSchema.safeParse('  user@example.com  ').success).toBe(true);
  });
});

describe('urlSchema', () => {
  it('accepts valid https URL', () => {
    expect(urlSchema.safeParse('https://example.com').success).toBe(true);
  });
  it('accepts valid http URL', () => {
    expect(urlSchema.safeParse('http://example.com/path').success).toBe(true);
  });
  it('rejects plain string without protocol', () => {
    expect(urlSchema.safeParse('example.com').success).toBe(false);
  });
  it('rejects empty string', () => {
    expect(urlSchema.safeParse('').success).toBe(false);
  });
});

describe('leadCaptureSchema', () => {
  it('accepts email only', () => {
    expect(leadCaptureSchema.safeParse({ email: 'a@b.com' }).success).toBe(true);
  });
  it('accepts email + name', () => {
    expect(leadCaptureSchema.safeParse({ email: 'a@b.com', name: 'Alice' }).success).toBe(true);
  });
  it('rejects invalid email', () => {
    expect(leadCaptureSchema.safeParse({ email: 'bad' }).success).toBe(false);
  });
  it('rejects name over 100 chars', () => {
    const longName = 'a'.repeat(101);
    expect(leadCaptureSchema.safeParse({ email: 'a@b.com', name: longName }).success).toBe(false);
  });
});

describe('handoffSchema', () => {
  it('accepts email only', () => {
    expect(handoffSchema.safeParse({ email: 'a@b.com' }).success).toBe(true);
  });
  it('accepts email + message', () => {
    expect(handoffSchema.safeParse({ email: 'a@b.com', message: 'Help!' }).success).toBe(true);
  });
  it('rejects message over 2000 chars', () => {
    const longMsg = 'x'.repeat(2001);
    expect(handoffSchema.safeParse({ email: 'a@b.com', message: longMsg }).success).toBe(false);
  });
  it('rejects missing email', () => {
    expect(handoffSchema.safeParse({ message: 'Hi' }).success).toBe(false);
  });
});

describe('trainTextSchema', () => {
  it('accepts text of 10+ chars', () => {
    expect(trainTextSchema.safeParse('hello world!').success).toBe(true);
  });
  it('rejects text under 10 chars', () => {
    expect(trainTextSchema.safeParse('short').success).toBe(false);
  });
  it('rejects text over 50000 chars', () => {
    expect(trainTextSchema.safeParse('a'.repeat(50_001)).success).toBe(false);
  });
});

describe('customPlanConfigSchema', () => {
  const base = {
    plan_name: 'Enterprise',
    monthly_price_usd: 99,
    max_bots: 10,
    max_messages: 10000,
    max_chunks: 5000,
  };

  it('accepts valid plan config', () => {
    expect(customPlanConfigSchema.safeParse(base).success).toBe(true);
  });
  it('rejects empty plan name', () => {
    expect(customPlanConfigSchema.safeParse({ ...base, plan_name: '' }).success).toBe(false);
  });
  it('rejects negative price', () => {
    expect(customPlanConfigSchema.safeParse({ ...base, monthly_price_usd: -1 }).success).toBe(false);
  });
  it('coerces string numbers', () => {
    const r = customPlanConfigSchema.safeParse({ ...base, max_bots: '5', max_messages: '1000', max_chunks: '500' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.max_bots).toBe(5);
  });
  it('rejects plan_name over 60 chars', () => {
    expect(customPlanConfigSchema.safeParse({ ...base, plan_name: 'a'.repeat(61) }).success).toBe(false);
  });
  it('accepts byo_database boolean', () => {
    const r = customPlanConfigSchema.safeParse({ ...base, byo_database: true });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.byo_database).toBe(true);
  });
  it('byo_database defaults to undefined when omitted', () => {
    const r = customPlanConfigSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.byo_database).toBeUndefined();
  });
});

describe('firstIssue', () => {
  it('returns null on success', () => {
    const r = emailSchema.safeParse('a@b.com');
    expect(firstIssue(r)).toBeNull();
  });
  it('returns first error message on failure', () => {
    const r = emailSchema.safeParse('bad');
    expect(firstIssue(r)).toBeTruthy();
    expect(typeof firstIssue(r)).toBe('string');
  });
});
