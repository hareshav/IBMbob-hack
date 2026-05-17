import dagre from '@dagrejs/dagre';

const NODE_W = 240;
const NODE_H = 110;

/**
 * Applies dagre LR layout to a React Flow node/edge list.
 * Input nodes may already have positions (from backend) — they are replaced.
 * Returns a new nodes array with updated `position` fields.
 */
export function applyDagreLayout(nodes, edges) {
  if (!nodes.length) return nodes;

  const g = new dagre.graphlib.Graph({ multigraph: false });
  g.setGraph({
    rankdir: 'LR',
    nodesep: 55,
    ranksep: 130,
    marginx: 60,
    marginy: 60,
    edgesep: 20,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of nodes) {
    // Give input nodes a smaller height so they don't stretch the rank
    const isInput = node.data?.kind === 'input';
    g.setNode(node.id, { width: NODE_W, height: isInput ? 80 : NODE_H });
  }

  for (const edge of edges) {
    // dagre needs source/target; skip if either end is not in the graph
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    if (!pos) return node;
    return {
      ...node,
      position: {
        x: pos.x - NODE_W / 2,
        y: pos.y - (node.data?.kind === 'input' ? 40 : NODE_H / 2),
      },
    };
  });
}
