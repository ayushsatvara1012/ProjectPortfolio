import { describe, it, expect } from 'vitest';
import { architectureRegistry, getFeature } from '@/src/content/architecture/registry';
import type { FeatureGroup, MermaidType, NodeKind } from '@/src/content/architecture/types';

// Structural invariants for the /architecture registry (the single source of
// truth). These fail CI if an entry is internally broken — a dangling edge, a
// duplicate/unsafe id, a diagram wired to a non-existent node — so registry
// drift is caught before it ships. See docs/archived/architecture-canvas-plan.md.

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const GROUPS: FeatureGroup[] = ['ingestion', 'core', 'delivery', 'platform'];
const KINDS: NodeKind[] = ['client', 'service', 'datastore', 'llm', 'queue', 'external'];
const MERMAID_TYPES: MermaidType[] = ['sequence', 'state', 'er', 'flowchart'];

// Mermaid header keyword expected for each declared diagram type. Guards against
// a `type` that disagrees with the authored code.
const MERMAID_HEADER: Record<MermaidType, RegExp> = {
  sequence: /\bsequenceDiagram\b/,
  state: /\bstateDiagram(-v2)?\b/,
  er: /\berDiagram\b/,
  flowchart: /\b(flowchart|graph)\b/,
};

describe('architecture registry — identity', () => {
  it('has at least one feature', () => {
    expect(architectureRegistry.length).toBeGreaterThan(0);
  });

  it('every id is unique', () => {
    const ids = architectureRegistry.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every id is URL-safe (kebab-case slug)', () => {
    for (const f of architectureRegistry) {
      expect(f.id, `id "${f.id}" must be a kebab-case slug`).toMatch(SLUG_RE);
    }
  });

  it('getFeature resolves a real id and rejects an unknown one', () => {
    expect(getFeature(architectureRegistry[0].id)?.id).toBe(architectureRegistry[0].id);
    expect(getFeature('does-not-exist')).toBeUndefined();
  });
});

describe('architecture registry — overview map', () => {
  it('every overview.group is a valid group', () => {
    for (const f of architectureRegistry) {
      expect(GROUPS, `group of "${f.id}"`).toContain(f.overview.group);
    }
  });

  it('every connectsTo target resolves to a real feature id', () => {
    const ids = new Set(architectureRegistry.map((f) => f.id));
    for (const f of architectureRegistry) {
      for (const target of f.overview.connectsTo) {
        expect(ids.has(target), `"${f.id}" connectsTo unknown id "${target}"`).toBe(true);
      }
    }
  });

  it('no feature connects to itself', () => {
    for (const f of architectureRegistry) {
      expect(f.overview.connectsTo, `"${f.id}" self-links`).not.toContain(f.id);
    }
  });

  it('every feature declares an overview icon', () => {
    for (const f of architectureRegistry) {
      expect(f.overview.icon.length, `"${f.id}" missing icon`).toBeGreaterThan(0);
    }
  });
});

describe('architecture registry — dataFlow integrity', () => {
  const withDataFlow = architectureRegistry.filter((f) => f.dataFlow);

  it('every dataFlow node kind is valid and node ids are unique', () => {
    for (const f of withDataFlow) {
      const nodeIds = f.dataFlow!.nodes.map((n) => n.id);
      expect(new Set(nodeIds).size, `"${f.id}" has duplicate node ids`).toBe(nodeIds.length);
      for (const n of f.dataFlow!.nodes) {
        expect(KINDS, `node "${n.id}" in "${f.id}"`).toContain(n.kind);
      }
    }
  });

  it('every dataFlow edge references existing node ids', () => {
    for (const f of withDataFlow) {
      const nodeIds = new Set(f.dataFlow!.nodes.map((n) => n.id));
      for (const e of f.dataFlow!.edges) {
        expect(nodeIds.has(e.source), `edge source "${e.source}" missing in "${f.id}"`).toBe(true);
        expect(nodeIds.has(e.target), `edge target "${e.target}" missing in "${f.id}"`).toBe(true);
      }
    }
  });
});

describe('architecture registry — mermaid integrity', () => {
  const withMermaid = architectureRegistry.filter((f) => f.mermaid);

  it('every mermaid block has a valid type, non-empty code, and a summary', () => {
    for (const f of withMermaid) {
      const m = f.mermaid!;
      expect(MERMAID_TYPES, `mermaid.type of "${f.id}"`).toContain(m.type);
      expect(m.code.trim().length, `"${f.id}" empty mermaid code`).toBeGreaterThan(0);
      expect(m.summary.trim().length, `"${f.id}" missing mermaid summary`).toBeGreaterThan(0);
    }
  });

  it('mermaid code header matches its declared type', () => {
    for (const f of withMermaid) {
      const m = f.mermaid!;
      expect(m.code, `"${f.id}" code does not start as a ${m.type} diagram`).toMatch(
        MERMAID_HEADER[m.type],
      );
    }
  });
});

describe('architecture registry — detail consistency', () => {
  it('any authored diagram belongs to a hasDetail feature', () => {
    for (const f of architectureRegistry) {
      if (f.dataFlow || f.mermaid) {
        expect(f.hasDetail, `"${f.id}" has diagrams but hasDetail:false`).toBe(true);
      }
    }
  });

  it('hasDetail:true implies BOTH a dataFlow and a mermaid diagram', () => {
    for (const f of architectureRegistry) {
      if (f.hasDetail) {
        expect(f.dataFlow, `"${f.id}" hasDetail:true but no dataFlow`).toBeDefined();
        expect(f.mermaid, `"${f.id}" hasDetail:true but no mermaid`).toBeDefined();
      }
    }
  });

  it('hasDetail:false features carry no diagrams (they render "coming soon")', () => {
    for (const f of architectureRegistry) {
      if (!f.hasDetail) {
        expect(f.dataFlow, `"${f.id}" hasDetail:false but has dataFlow`).toBeUndefined();
        expect(f.mermaid, `"${f.id}" hasDetail:false but has mermaid`).toBeUndefined();
      }
    }
  });
});

describe('architecture registry — guardrails strip', () => {
  const withGuardrails = architectureRegistry.filter((f) => f.guardrails);

  it('every guardrail is a non-empty string on a detailed feature', () => {
    for (const f of withGuardrails) {
      expect(f.hasDetail, `"${f.id}" has guardrails but hasDetail:false`).toBe(true);
      expect(f.guardrails!.length, `"${f.id}" empty guardrails array`).toBeGreaterThan(0);
      for (const g of f.guardrails!) {
        expect(g.trim().length, `"${f.id}" has an empty guardrail`).toBeGreaterThan(0);
      }
    }
  });
});
