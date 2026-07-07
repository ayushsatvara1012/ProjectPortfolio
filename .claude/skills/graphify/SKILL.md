---
name: graphify
description: Query pre-generated knowledge graph (scan-only, zero API cost)
trigger:
  - /graphify query
  - /graphify analyze
  - /graphify impact
tags: [architecture, codebase, knowledge-graph]
---

# Graphify: Scan-Only Query Skill

Cost-free architecture queries on pre-generated graphs.

## Philosophy

- ❌ **No generation** — User runs `graphify update .` manually (saves API cost)
- ✅ **Read-only** — Claude queries cached `graphify-out/` (instant, free)
- ✅ **Smart queries** — Natural language + CLI syntax for architecture questions

## Setup (One-Time)

### Step 1: Generate the Graph (Manual, One-Time)

User runs in terminal (outside Claude):

```bash
# Install graphify CLI if not present
pip install graphify  # or npm install -g graphify

# Generate initial graph
graphify update .

# Or on-demand refresh (e.g., after big merge)
graphify update . --force
```

Output: `graphify-out/GRAPH_REPORT.md`, `graphify-out/wiki/`, `graphify-out/graph.json`

**Cost:** ~$0.01-0.05 per run (user controls frequency)

### Step 2: Claude Uses Cached Graph (Every Session)

Claude automatically:
1. Detects `graphify-out/` directory
2. Loads `GRAPH_REPORT.md` (for overview)
3. Parses `graph.json` (for queries)
4. Answers architecture questions from cache

**Cost:** $0.00 (reading files, no API calls)

## Query Modes

### Mode 1: Query Architecture Questions

```bash
/graphify query "what modules use pgvector?"
/graphify query "dependency path from ChatWidget to FastAPI"
/graphify query "who calls the run_agent_loop function?"
```

**Smart query types:**
- **"What uses X?"** → Reverse dependency (inbound)
- **"What does X use?"** → Forward dependency (outbound)
- **"Path from A to B?"** → Shortest route in dependency graph
- **"Who calls X?"** → Function-level reverse lookup
- **"List all services"** → Community detection from graph

**Process:**
1. Parse query (NLP → intent detection)
2. Load `graph.json` into memory
3. Execute graph traversal (BFS/DFS on cached AST)
4. Return annotated results with code locations

**Response example:**
```
Query: "What modules depend on services/agent.py?"

Results (3 dependents):
✓ main.py:45          → from services.agent import run_agent_loop
✓ services/catalog_import.py:102  → calls agent.request_sample()
✓ tests/test_agent.py:8           → imports for testing

Impact: Changing agent.py affects 3 files directly.
```

### Mode 2: Analyze Cached Graph

```bash
/graphify analyze                    # Whole codebase
/graphify analyze --scope services/  # Specific directory
/graphify analyze --depth deep       # Detailed insights
```

**Analysis Types:**
1. **Hotspots** — Modules with high complexity or many dependents
2. **Dead Code** — Isolated modules (no inbound/outbound)
3. **Cycles** — Circular imports (potential bugs)
4. **Layer Violations** — E.g., frontend calling backend directly
5. **Complexity Distribution** — Uneven load across files

**Process:**
1. Read `graph.json` metrics
2. Run analysis algorithms (no API calls)
3. Generate report from cached data

### Mode 3: Impact Analysis

```bash
/graphify impact "src/components/ChatWidget.tsx"
/graphify impact "sapybase_ai_engine/services/agent.py"
```

**Shows:**
- Who depends on this file?
- What breaks if you change it?
- How critical is this module?

**Process:**
1. Parse filename
2. Reverse lookup in `graph.json`
3. Trace dependent chain
4. Report impact radius

## Examples

### Example 1: Query Mode

**You ask:**
```
What's the dependency chain from ChatWidget.tsx to the backend?
```

**Claude does:**
1. Read `graphify-out/GRAPH_REPORT.md` (god nodes section)
2. Parse `graph.json` for call paths
3. Trace: ChatWidget → /api/chat → main.py → services/agent.py

**Response:**
```
Dependency chain (4 hops):
ChatWidget.tsx:42 
  ↓ (fetch /api/chat)
main.py:105 
  ↓ (import services.agent)
services/agent.py:20 
  ↓ (call run_agent_loop)
services/agent_loop.py

Cost: $0.00 (cached query)
```

### Example 2: Impact Analysis

**You ask:**
```
/graphify impact "services/agent.py"
```

**Claude does:**
1. Reverse lookup in `graph.json`
2. Find all files importing agent.py
3. Count dependents + depth

**Response:**
```
📊 Impact Analysis: services/agent.py

Dependents (7 files):
  • main.py (critical path)
  • services/catalog_import.py
  • services/request_handler.py
  • tests/test_agent.py (3 test files)

Risk: HIGH — core service, 7 direct dependents
Recommendation: Add integration tests if changing this file

Cost: $0.00 (cached lookup)
```

## When to Regenerate

Run `graphify update .` when:
- ✅ After merging large features
- ✅ Major refactor (>50 files changed)
- ✅ Before architecture review
- ✅ Monthly sync (keep graph fresh)

**Don't need to regenerate for:**
- ❌ Small bug fixes (1-3 files)
- ❌ Comment-only changes
- ❌ Tests (unless new test patterns matter)

## Integration with Other Skills

- **`pre-commit-check`** — Warns if graph is stale (> 7 days old)
- **`code-review`** — Uses graphify context for architecture feedback
- **`verify`** — Checks graph consistency before major changes

## Limitations (Know These)

| Issue | Why | Workaround |
|-------|-----|-----------|
| Graph is stale | User didn't run `graphify update` recently | Remind user to refresh |
| New feature not in graph | Generated before feature was coded | User runs `graphify update .` |
| False negatives | If dynamic code/reflection | Manual clarification needed |

## Quick Reference

| Task | Command | Cost |
|------|---------|------|
| Query architecture | `/graphify query "..."` | $0.00 |
| Analyze codebase | `/graphify analyze` | $0.00 |
| Impact check | `/graphify impact "file"` | $0.00 |
| Regenerate graph | `graphify update .` (manual, CLI) | $0.01-0.05 |

**Summary:** Unlimited queries (free) + user-controlled generation (minimal cost) = 98% cost reduction.
