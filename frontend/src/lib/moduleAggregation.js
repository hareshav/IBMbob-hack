/**
 * Two-tier graph view: aggregate every node into its source file (a "module")
 * for the default overview, then drill into a single module on click.
 *
 * - `aggregateByModule(rawNodes, rawEdges)` → one node per distinct file,
 *   with edges between modules collapsed and weighted.
 * - `extractModuleNodes(rawNodes, rawEdges, moduleId)` → just the nodes/edges
 *   that live inside one module (the "expanded" view).
 */

const MODULE_PREFIX = 'module:';
export const moduleNodeId = (file) => `${MODULE_PREFIX}${file}`;
export const isModuleNodeId = (id) => typeof id === 'string' && id.startsWith(MODULE_PREFIX);
export const fileFromModuleId = (id) => (id || '').slice(MODULE_PREFIX.length);

const UNKNOWN_MODULE = '<manual>';

/** Last 2 segments of a path, or the whole thing if shorter. */
function shortLabel(file) {
  if (!file || file === UNKNOWN_MODULE) return 'Manual';
  const parts = file.split('/');
  if (parts.length <= 2) return parts.join('/');
  return parts.slice(-2).join('/');
}

function fileOf(node) {
  return node?.data?.file || UNKNOWN_MODULE;
}

/**
 * Collapse the entire graph to one node per file. Internal edges are dropped,
 * cross-file edges are deduped per (src, tgt, edge_type) and counted as weight.
 */
export function aggregateByModule(rawNodes, rawEdges) {
  if (!rawNodes?.length) return { nodes: [], edges: [], modules: [] };

  /* Build per-module aggregates */
  const buckets = new Map(); // file → { counts, groups, total, hasRisk }
  for (const n of rawNodes) {
    const file = fileOf(n);
    let b = buckets.get(file);
    if (!b) {
      b = { counts: { input: 0, function: 0, router: 0, output: 0, default: 0 },
            groups: {}, total: 0, hasRisk: false };
      buckets.set(file, b);
    }
    const k = n.data?.kind || 'default';
    b.counts[k] = (b.counts[k] || 0) + 1;
    b.total += 1;
    if (n.data?.group) b.groups[n.data.group] = (b.groups[n.data.group] || 0) + 1;
    if (n.data?.state === 'risky') b.hasRisk = true;
  }

  /* Build module nodes */
  const nodes = [];
  for (const [file, b] of buckets.entries()) {
    const primaryGroup = Object.entries(b.groups)
      .sort((a, c) => c[1] - a[1])[0]?.[0] || null;

    nodes.push({
      id: moduleNodeId(file),
      type: 'api',
      style: { width: 260 },
      data: {
        kind: 'module',
        moduleId: file,
        file,
        label: shortLabel(file),
        title: shortLabel(file),
        count: b.total,
        counts: b.counts,
        primaryGroup,
        hasRisk: b.hasRisk,
      },
    });
  }

  /* Map node-id → module-id for edge rewriting */
  const nodeToModule = {};
  for (const n of rawNodes) nodeToModule[n.id] = moduleNodeId(fileOf(n));

  /* Aggregate edges: group by (srcMod, tgtMod, type), drop internal, weight by count */
  const edgeAgg = new Map(); // key → { source, target, edge_type, weight }
  for (const e of rawEdges || []) {
    const s = nodeToModule[e.source];
    const t = nodeToModule[e.target];
    if (!s || !t || s === t) continue;
    const eType = e.data?.edge_type || 'call';
    const key = `${s}|${t}|${eType}`;
    const cur = edgeAgg.get(key);
    if (cur) cur.weight += 1;
    else edgeAgg.set(key, { source: s, target: t, edge_type: eType, weight: 1 });
  }

  const edges = [];
  for (const [key, a] of edgeAgg.entries()) {
    edges.push({
      id: `mod:${key}`,
      source: a.source,
      target: a.target,
      type: 'flow',
      animated: false,
      data: { edge_type: a.edge_type, weight: a.weight },
    });
  }

  const modules = Array.from(buckets.entries())
    .map(([file, b]) => ({ file, count: b.total }))
    .sort((a, b) => b.count - a.count || a.file.localeCompare(b.file));

  return { nodes, edges, modules };
}

const EXTERNAL_PREFIX = 'ext:';
export const externalStubId = (file) => `${EXTERNAL_PREFIX}${file}`;
export const isExternalStubId = (id) => typeof id === 'string' && id.startsWith(EXTERNAL_PREFIX);
export const fileFromExternalStubId = (id) => (id || '').slice(EXTERNAL_PREFIX.length);

/**
 * Filter the raw graph to one module's "logical" contents: its own functions,
 * PLUS input nodes whose handler lives inside the module (often declared in a
 * sibling router file), PLUS compact external-module stubs for every cross-file
 * edge so the boundary stays visible.
 *
 * Without the input lift, handlers look like floating orphans because their
 * triggers live in `routers/foo.py` while the work lives in `services/foo.py`.
 * Without the external stubs, you can't tell the module talks to web3_utils etc.
 */
export function extractModuleNodes(rawNodes, rawEdges, moduleId) {
  if (!moduleId) return { nodes: [], edges: [] };

  const allEdges = rawEdges || [];
  const nodeById = new Map();
  for (const n of rawNodes || []) nodeById.set(n.id, n);

  /* Step 1: nodes whose declared file IS this module */
  const inside = new Set();
  const nodes = [];
  for (const n of rawNodes || []) {
    if (fileOf(n) === moduleId) {
      inside.add(n.id);
      nodes.push(n);
    }
  }

  /* Step 2: lift in input nodes whose handler target sits inside this module.
     Inputs are typically declared in a router file, but conceptually belong to
     whichever service owns the handler: so they should appear here too. */
  for (const e of allEdges) {
    if (!inside.has(e.target)) continue;
    const src = nodeById.get(e.source);
    if (!src || src.data?.kind !== 'input') continue;
    if (inside.has(src.id)) continue;
    inside.add(src.id);
    nodes.push(src);
  }

  /* Step 3: collect external boundaries. For every edge that crosses the module
     boundary, emit a compact stub representing the OTHER side's file, and route
     the edge to/from that stub instead. Stubs are deduped per (peer-file, dir). */
  const externalNodes = new Map(); // id → node
  const innerEdges = [];
  const boundaryEdges = [];

  const peerFileFor = (n) => (n && fileOf(n)) || UNKNOWN_MODULE;

  for (const e of allEdges) {
    const sIn = inside.has(e.source);
    const tIn = inside.has(e.target);

    if (sIn && tIn) {
      innerEdges.push(e);
      continue;
    }
    if (!sIn && !tIn) continue; // unrelated to this module

    if (sIn && !tIn) {
      const tNode = nodeById.get(e.target);
      const peer = peerFileFor(tNode);
      if (peer === moduleId) continue;
      const stubId = externalStubId(peer);
      if (!externalNodes.has(stubId)) {
        externalNodes.set(stubId, {
          id: stubId,
          type: 'api',
          style: { width: 200 },
          data: {
            kind: 'external',
            moduleId: peer,
            label: shortLabel(peer),
            title: shortLabel(peer),
            file: peer,
            outgoingCount: 0,
            incomingCount: 0,
          },
        });
      }
      externalNodes.get(stubId).data.outgoingCount += 1;
      boundaryEdges.push({ ...e, target: stubId, id: `${e.id || 'e'}::ext` });
    } else if (!sIn && tIn) {
      const sNode = nodeById.get(e.source);
      const peer = peerFileFor(sNode);
      if (peer === moduleId) continue;
      const stubId = externalStubId(peer);
      if (!externalNodes.has(stubId)) {
        externalNodes.set(stubId, {
          id: stubId,
          type: 'api',
          style: { width: 200 },
          data: {
            kind: 'external',
            moduleId: peer,
            label: shortLabel(peer),
            title: shortLabel(peer),
            file: peer,
            outgoingCount: 0,
            incomingCount: 0,
          },
        });
      }
      externalNodes.get(stubId).data.incomingCount += 1;
      boundaryEdges.push({ ...e, source: stubId, id: `${e.id || 'e'}::ext` });
    }
  }

  for (const stub of externalNodes.values()) nodes.push(stub);

  return { nodes, edges: [...innerEdges, ...boundaryEdges] };
}

/** List of distinct modules in the raw graph, sorted by node count desc. */
export function distinctModules(rawNodes) {
  const counts = {};
  for (const n of rawNodes || []) {
    const f = fileOf(n);
    counts[f] = (counts[f] || 0) + 1;
  }
  return Object.keys(counts)
    .sort((a, b) => counts[b] - counts[a] || a.localeCompare(b))
    .map((f) => ({ file: f, count: counts[f], label: shortLabel(f) }));
}
