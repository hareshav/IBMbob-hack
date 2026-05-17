/**
 * Group collapse: replaces all function nodes belonging to a collapsed group
 * with a single "supernode" representing the whole group. Edges that crossed
 * the group boundary are rewritten to point at the supernode; edges entirely
 * internal to a collapsed group are dropped (or kept as a self-loop count).
 *
 * Inputs are the *raw* nodes/edges (pre-layout, post-normalize). Output is a
 * brand-new pair ready to be fed through dagre layout again.
 */

const SUPERNODE_PREFIX = 'group:';

export const supernodeId = (group) => `${SUPERNODE_PREFIX}${group}`;
export const isSupernodeId = (id) => typeof id === 'string' && id.startsWith(SUPERNODE_PREFIX);

/**
 * @param {Array} rawNodes - normalised nodes (with type:'api', data.kind, data.group)
 * @param {Array} rawEdges - normalised edges (with data.edge_type)
 * @param {Set<string>} collapsedGroups - group names currently collapsed
 * @returns {{ nodes: Array, edges: Array, groupCounts: Object }}
 */
export function collapseGroups(rawNodes, rawEdges, collapsedGroups) {
  if (!collapsedGroups || collapsedGroups.size === 0) {
    return { nodes: rawNodes, edges: rawEdges, groupCounts: countGroups(rawNodes) };
  }

  const groupCounts = countGroups(rawNodes);

  /* Build a map of node-id → its collapsing group (or null) */
  const nodeGroup = {};
  for (const n of rawNodes) {
    const g = n.data?.group;
    if (n.data?.kind === 'function' && g && collapsedGroups.has(g)) {
      nodeGroup[n.id] = g;
    } else {
      nodeGroup[n.id] = null;
    }
  }

  /* Filter out collapsed function nodes, then append one supernode per collapsed group */
  const survivingNodes = rawNodes.filter((n) => nodeGroup[n.id] === null);

  const presentGroups = new Set();
  for (const n of rawNodes) {
    if (nodeGroup[n.id]) presentGroups.add(nodeGroup[n.id]);
  }

  for (const g of presentGroups) {
    survivingNodes.push({
      id: supernodeId(g),
      type: 'api',
      style: { width: 220 },
      data: {
        kind: 'group',
        group: g,
        label: g,
        title: g.charAt(0).toUpperCase() + g.slice(1),
        count: groupCounts[g] || 0,
        collapsed: true,
      },
    });
  }

  /* Rewrite each edge: replace endpoints that fell into a collapsed group with the supernode id.
     Drop edges that are entirely internal to one collapsed group (s and t same supernode). */
  const remap = (id) => (nodeGroup[id] ? supernodeId(nodeGroup[id]) : id);

  const seen = new Set();
  const newEdges = [];
  for (const e of rawEdges) {
    const s = remap(e.source);
    const t = remap(e.target);
    if (s === t) continue; // collapsed self-loop
    const key = `${s}->${t}|${e.data?.edge_type || 'default'}`;
    if (seen.has(key)) continue;
    seen.add(key);
    newEdges.push({
      ...e,
      id: e.id && s === e.source && t === e.target ? e.id : `${key}`,
      source: s,
      target: t,
    });
  }

  return { nodes: survivingNodes, edges: newEdges, groupCounts };
}

function countGroups(rawNodes) {
  const out = {};
  for (const n of rawNodes) {
    const g = n.data?.group;
    if (n.data?.kind === 'function' && g) out[g] = (out[g] || 0) + 1;
  }
  return out;
}

/** List of distinct groups present in the raw graph, sorted by count desc. */
export function distinctGroups(rawNodes) {
  const counts = countGroups(rawNodes);
  return Object.keys(counts)
    .sort((a, b) => counts[b] - counts[a] || a.localeCompare(b))
    .map((g) => ({ group: g, count: counts[g] }));
}
