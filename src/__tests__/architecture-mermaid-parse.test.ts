import { describe, it, expect, beforeAll } from 'vitest';
import mermaid from 'mermaid';
import { architectureRegistry } from '@/src/content/architecture/registry';

// Every authored mermaid.code must parse without error, so a typo in a diagram
// string fails CI instead of shipping a broken (or summary-only fallback)
// diagram on the public page. mermaid.parse runs the grammar only (no DOM
// layout), which is the same string the browser component renders.
const withMermaid = architectureRegistry.filter((f) => f.mermaid);

beforeAll(() => {
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral' });
});

describe('architecture registry — mermaid diagrams parse', () => {
  if (withMermaid.length === 0) {
    it('has no mermaid diagrams to parse yet', () => {
      expect(withMermaid).toHaveLength(0);
    });
    return;
  }

  it.each(withMermaid.map((f) => [f.id, f.mermaid!.code] as const))(
    'parses %s',
    async (_id, code) => {
      await expect(mermaid.parse(code)).resolves.not.toThrow();
    },
  );
});
