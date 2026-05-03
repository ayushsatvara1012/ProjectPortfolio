import { describe, it, expect, beforeEach } from 'vitest';
import {
  getBotConfig,
  saveBotConfig,
  getKnowledge,
  saveKnowledge,
  clearKnowledge,
  isTrained,
  resetDemo,
} from '@/src/lib/demo/demoStorage';

beforeEach(() => {
  sessionStorage.clear();
});

describe('getBotConfig', () => {
  it('returns defaults when sessionStorage is empty', () => {
    const config = getBotConfig();
    expect(config.name).toBe('Demo Bot');
    expect(config.primaryColor).toBe('#5730F5');
  });

  it('merges saved values over defaults', () => {
    saveBotConfig({ name: 'My Bot' });
    const config = getBotConfig();
    expect(config.name).toBe('My Bot');
    expect(config.primaryColor).toBe('#5730F5');
  });
});

describe('saveBotConfig', () => {
  it('persists partial config', () => {
    saveBotConfig({ companyName: 'Acme Corp' });
    expect(getBotConfig().companyName).toBe('Acme Corp');
  });

  it('does not overwrite unrelated fields', () => {
    saveBotConfig({ name: 'Bot A' });
    saveBotConfig({ companyName: 'Acme' });
    expect(getBotConfig().name).toBe('Bot A');
    expect(getBotConfig().companyName).toBe('Acme');
  });
});

describe('knowledge CRUD', () => {
  it('returns empty array when no knowledge saved', () => {
    expect(getKnowledge()).toEqual([]);
  });

  it('saves and retrieves chunks', () => {
    saveKnowledge(['chunk one', 'chunk two']);
    expect(getKnowledge()).toEqual(['chunk one', 'chunk two']);
  });

  it('clearKnowledge empties storage', () => {
    saveKnowledge(['data']);
    clearKnowledge();
    expect(getKnowledge()).toEqual([]);
  });

  it('isTrained returns false before save', () => {
    expect(isTrained()).toBe(false);
  });

  it('isTrained returns true after saving chunks', () => {
    saveKnowledge(['some chunk']);
    expect(isTrained()).toBe(true);
  });
});

describe('resetDemo', () => {
  it('clears all demo state', () => {
    saveBotConfig({ name: 'Custom' });
    saveKnowledge(['chunk']);
    resetDemo();
    expect(getBotConfig().name).toBe('Demo Bot');
    expect(getKnowledge()).toEqual([]);
    expect(isTrained()).toBe(false);
  });
});
