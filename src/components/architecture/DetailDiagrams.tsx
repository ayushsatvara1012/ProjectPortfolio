'use client';

import { LazyDataFlowCanvas, LazyMermaidDiagram } from './LazyDetailDiagrams';
import DiagramErrorBoundary from './DiagramErrorBoundary';
import type { FeatureArchitecture } from '@/src/content/architecture/types';

const labelFor = (
  dataFlow: NonNullable<FeatureArchitecture['dataFlow']>,
  id: string,
) => dataFlow.nodes.find((n) => n.id === id)?.label ?? id;

// A flat sentence describing the whole map, rendered visually-hidden but in the
// static HTML: a screen-reader alternative for the canvas (which is unreadable
// to assistive tech) and crawlable content for SEO, present on first paint.
function dataFlowText(dataFlow: NonNullable<FeatureArchitecture['dataFlow']>): string {
  const components = dataFlow.nodes
    .map((n) => (n.sub ? `${n.label} (${n.sub})` : n.label))
    .join(', ');
  const connections = dataFlow.edges
    .map((e) => {
      const link = `${labelFor(dataFlow, e.source)} to ${labelFor(dataFlow, e.target)}`;
      return e.label ? `${link} for ${e.label}` : link;
    })
    .join('; ');
  return `Components: ${components}. Connections: ${connections}.`;
}

// Text fallback for the data-flow map: if React Flow fails to render, the
// node/edge list still describes the structure (resilience + a11y, see plan).
function DataFlowTextFallback({
  dataFlow,
}: {
  dataFlow: NonNullable<FeatureArchitecture['dataFlow']>;
}) {
  const labelOf = (id: string) => labelFor(dataFlow, id);
  return (
    <div className="h-full overflow-y-auto p-5 text-sm text-slate-600 dark:text-slate-300">
      <p className="font-semibold text-slate-800 dark:text-slate-200">Components</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {dataFlow.nodes.map((n) => (
          <li key={n.id}>
            <span className="font-medium text-slate-800 dark:text-slate-200">{n.label}</span>
            {n.sub ? ` — ${n.sub}` : ''}
          </li>
        ))}
      </ul>
      <p className="mt-4 font-semibold text-slate-800 dark:text-slate-200">Connections</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {dataFlow.edges.map((e, i) => (
          <li key={i}>
            {labelOf(e.source)} → {labelOf(e.target)}
            {e.label ? ` (${e.label})` : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Client wrapper co-locating the lazy diagrams with their error boundaries. The
// server detail page passes the (plain, serializable) registry blocks as props;
// React Flow and Mermaid stay out of the server shell and shared bundle.
export default function DetailDiagrams({
  dataFlow,
  mermaid,
}: {
  dataFlow?: FeatureArchitecture['dataFlow'];
  mermaid?: FeatureArchitecture['mermaid'];
}) {
  return (
    <div className="mt-10 flex flex-col gap-10">
      {dataFlow ? (
        <section aria-labelledby="arch-dataflow-heading">
          <h2
            id="arch-dataflow-heading"
            className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
          >
            Data flow
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            How the pieces connect and where data moves.
          </p>
          <p className="sr-only">{dataFlowText(dataFlow)}</p>
          <div className="mt-4 h-[460px] overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60">
            <DiagramErrorBoundary fallback={<DataFlowTextFallback dataFlow={dataFlow} />}>
              <LazyDataFlowCanvas dataFlow={dataFlow} />
            </DiagramErrorBoundary>
          </div>
        </section>
      ) : null}

      {mermaid ? (
        <section aria-labelledby="arch-behavior-heading">
          <h2
            id="arch-behavior-heading"
            className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
          >
            Behavior
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            How it behaves step by step over time.
          </p>
          <figure className="mt-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
              <DiagramErrorBoundary
                fallback={
                  <p className="text-sm text-slate-600 dark:text-slate-300">{mermaid.summary}</p>
                }
              >
                <LazyMermaidDiagram mermaid={mermaid} />
              </DiagramErrorBoundary>
            </div>
            <figcaption className="mt-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              {mermaid.summary}
            </figcaption>
          </figure>
        </section>
      ) : null}
    </div>
  );
}
