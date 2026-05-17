import dagre from '@dagrejs/dagre';

const NODE_W = 240;
const NODE_H = 110;
const MODULE_W = 290;
const MODULE_H = 170;

/**
 * Applies dagre LR layout to a React Flow node/edge list.
 * Per-node dimensions reflect what each `kind` actually renders at, so the
 * solver doesn't pack module cards on top of each other.
 */
export function applyDagreLayout(nodes, edges) {
  if (!nodes.length) return nodes;

  /* Bias spacing based on whether this is the module-overview view: bigger
     cards + fewer of them benefit from more air. */
  const hasModules = nodes.some((n) => n.data?.kind === 'module');

  const g = new dagre.graphlib.Graph({ multigraph: false });
  g.setGraph({
    rankdir: 'LR',
    nodesep: hasModules ? 90 : 55,
    ranksep: hasModules ? 200 : 130,
    marginx: 60,
    marginy: 60,
    edgesep: hasModules ? 30 : 20,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of nodes) {
    const kind = node.data?.kind;
    let w = NODE_W;
    let h = NODE_H;
    if (kind === 'module')        { w = MODULE_W; h = MODULE_H; }
    else if (kind === 'external') { w = 210;      h = 60;       }
    else if (kind === 'group')    { w = 230;      h = 110;      }
    else if (kind === 'input')    { h = 80;                     }
    g.setNode(node.id, { width: w, height: h });
  }

  for (const edge of edges) {
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    if (!pos) return node;
    const kind = node.data?.kind;
    const w = kind === 'module' ? MODULE_W
            : kind === 'external' ? 210
            : kind === 'group' ? 230
            : NODE_W;
    const h = kind === 'module' ? MODULE_H
            : kind === 'external' ? 60
            : kind === 'group' ? 110
            : kind === 'input' ? 80
            : NODE_H;
    return {
      ...node,
      position: {
        x: pos.x - w / 2,
        y: pos.y - h / 2,
      },
    };
  });
}
