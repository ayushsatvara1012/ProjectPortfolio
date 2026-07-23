export type NodeKind = 'client' | 'service' | 'datastore' | 'llm' | 'queue' | 'external';

export type MermaidType = 'sequence' | 'state' | 'er' | 'flowchart';

export type FeatureGroup = 'ingestion' | 'core' | 'delivery' | 'platform';

export interface DataFlowNode {
  id: string;
  kind: NodeKind;
  label: string;
  sub?: string;
}

export interface DataFlowEdge {
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
}

export interface FeatureArchitecture {
  id: string;
  name: string;
  tagline: string;
  status: 'live' | 'planned';
  hasDetail: boolean;
  overview: {
    icon: string;
    group: FeatureGroup;
    connectsTo: string[];
    position?: { x: number; y: number };
  };
  dataFlow?: {
    nodes: DataFlowNode[];
    edges: DataFlowEdge[];
  };
  mermaid?: {
    type: MermaidType;
    code: string;
    summary: string;
  };
  narrative?: string;
  // Category-level trust signals shown as a strip on the detail view (agent
  // only). Must describe guardrails that actually exist in code, never bypass
  // thresholds or secrets. See docs/architecture-canvas-plan.md ("AI agent").
  guardrails?: string[];
}
