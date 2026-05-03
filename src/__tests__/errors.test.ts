import { describe, it, expect } from 'vitest';
import { UpgradeError } from '@/src/lib/errors';

describe('UpgradeError', () => {
  it('is instance of Error', () => {
    const err = new UpgradeError({ code: 'MSG_LIMIT', message: 'Limit reached', tier: 'FREE' });
    expect(err).toBeInstanceOf(Error);
  });

  it('sets name to UpgradeError', () => {
    const err = new UpgradeError({});
    expect(err.name).toBe('UpgradeError');
  });

  it('defaults message when not provided', () => {
    const err = new UpgradeError({});
    expect(err.message).toBe('Plan limit reached.');
  });

  it('uses provided message', () => {
    const err = new UpgradeError({ message: 'Custom message' });
    expect(err.message).toBe('Custom message');
  });

  it('sets code to DEFAULT when not provided', () => {
    const err = new UpgradeError({});
    expect(err.code).toBe('DEFAULT');
  });

  it('sets code correctly', () => {
    const err = new UpgradeError({ code: 'BOT_LIMIT' });
    expect(err.code).toBe('BOT_LIMIT');
  });

  it('sets tier correctly', () => {
    const err = new UpgradeError({ tier: 'PRO' });
    expect(err.tier).toBe('PRO');
  });

  it('defaults tier to empty string', () => {
    const err = new UpgradeError({});
    expect(err.tier).toBe('');
  });

  it('sets current and limit', () => {
    const err = new UpgradeError({ current: 5, limit: 3 });
    expect(err.current).toBe(5);
    expect(err.limit).toBe(3);
  });

  it('defaults current and limit to null', () => {
    const err = new UpgradeError({});
    expect(err.current).toBeNull();
    expect(err.limit).toBeNull();
  });

  it('can be caught as an Error', () => {
    expect(() => { throw new UpgradeError({ code: 'CHUNK_LIMIT' }); }).toThrow(Error);
  });
});
