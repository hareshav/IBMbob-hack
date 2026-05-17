import { memo, useContext } from 'react';
import { getBezierPath } from '@xyflow/react';
import { GraphCtx } from '../lib/graphContext';

const EDGE_CFG = {
  api: {
    color: '#2ED8F0',
    glow: 'rgba(46,216,240,0.50)',
    dashArray: '7 14',
    width: 2,
    glowW: 9,
    opacity: 0.85,
    anim: 'flowDashFast',
    speed: '1.1s',
  },
  call: {
    color: '#7C7FF5',
    glow: 'rgba(124,127,245,0.38)',
    dashArray: '5 12',
    width: 1.5,
    glowW: 6,
    opacity: 0.68,
    anim: 'flowDashMid',
    speed: '1.6s',
  },
  default: {
    color: '#4F8EF7',
    glow: 'rgba(79,142,247,0.35)',
    dashArray: '5 12',
    width: 1.5,
    glowW: 6,
    opacity: 0.60,
    anim: 'flowDashSlow',
    speed: '1.9s',
  },
};

export const FlowEdge = memo(function FlowEdge({
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}) {
  /* Neighbourhood awareness: edges touching the selected OR hovered node
     brighten; the rest fade. The hover path is only live in Bob mode so a
     normal Parse view stays calm. */
  const {
    selectedNodeId, hasSelection,
    hoveredNodeId, bobModeActive,
  } = useContext(GraphCtx);

  const touchesSelection = hasSelection && (source === selectedNodeId || target === selectedNodeId);
  const touchesHover     = bobModeActive && hoveredNodeId && (source === hoveredNodeId || target === hoveredNodeId);
  const isInNeighbourhood = touchesSelection || touchesHover;

  /* Anything bright on the canvas (selection OR Bob hover) means everything
     else dims. Otherwise edges render at their default density-aware look. */
  const hasFocus = hasSelection || (bobModeActive && Boolean(hoveredNodeId));
  const isOutsideNeighbourhood = hasFocus && !isInNeighbourhood && !selected;

  /* Fan-in vertical spread - keeps convergent edges from stacking on top of each other.
     targetYOffset is pre-computed per-edge in applyGraphPayload based on fan-in count. */
  const tYOff = data?.targetYOffset ?? 0;

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY: targetY + tYOff,
    targetPosition,
    curvature: 0.3,
  });

  const eType = data?.edge_type;
  const cfg = EDGE_CFG[eType === 'api' ? 'api' : eType === 'call' ? 'call' : 'default'];

  /* High fan-in: reduce opacity of individual edges so the bundle is less overwhelming */
  const fanIn = data?.fanInCount ?? 1;
  const densityOpacity = fanIn > 8 ? Math.max(0.3, cfg.opacity - (fanIn - 8) * 0.03) : cfg.opacity;

  /* Module aggregate edges carry a `weight` (number of underlying calls). Thicker = more traffic. */
  const weight = data?.weight ?? 1;
  const weightBoost = weight > 1 ? Math.min(Math.log2(weight) * 0.9, 3.5) : 0;

  /* Resolve final opacity / stroke given neighbourhood state.
     Priority: explicitly selected edge > in selected neighbourhood > dimmed > default. */
  let finalOpacity, strokeW, glowW, glowOpacity;
  if (selected) {
    finalOpacity = 1;
    strokeW = cfg.width + 0.8 + weightBoost;
    glowW = cfg.glowW + 5 + weightBoost * 0.6;
    glowOpacity = 0.75;
  } else if (isInNeighbourhood) {
    finalOpacity = 1;
    strokeW = cfg.width + 1.2 + weightBoost;          // a touch thicker than baseline
    glowW = cfg.glowW + 6 + weightBoost * 0.6;        // and a brighter halo
    glowOpacity = 0.85;
  } else if (isOutsideNeighbourhood) {
    finalOpacity = 0.10;                              // fade out unrelated edges
    strokeW = Math.max(0.8, cfg.width - 0.4);
    glowW = 0;                                        // kill the halo entirely
    glowOpacity = 0;
  } else {
    finalOpacity = densityOpacity;
    strokeW = cfg.width + weightBoost;
    glowW = cfg.glowW + weightBoost * 0.6;
    glowOpacity = fanIn > 8 ? 0.28 : 0.42;
  }

  /* Pause the flowing-dash animation on dimmed edges so they don't
     visually compete with the highlighted neighbourhood. */
  const animation = isOutsideNeighbourhood ? 'none' : `${cfg.anim} ${cfg.speed} linear infinite`;

  return (
    <g style={{ pointerEvents: 'none' }}>
      {/* Blurred glow halo (skipped entirely when dimmed) */}
      {glowW > 0 && (
        <path
          d={edgePath}
          fill="none"
          stroke={cfg.glow}
          strokeWidth={glowW}
          strokeLinecap="round"
          opacity={glowOpacity}
          style={{ filter: 'blur(4px)', transition: 'opacity 220ms ease' }}
        />
      )}
      {/* Static base thread */}
      <path
        d={edgePath}
        fill="none"
        stroke={cfg.color}
        strokeWidth={cfg.width * 0.4}
        opacity={finalOpacity * 0.25}
        style={{ transition: 'opacity 220ms ease' }}
      />
      {/* Animated flowing dash */}
      <path
        d={edgePath}
        fill="none"
        stroke={cfg.color}
        strokeWidth={strokeW}
        opacity={finalOpacity}
        strokeDasharray={cfg.dashArray}
        markerEnd={markerEnd}
        style={{
          animation,
          transition: 'opacity 220ms ease, stroke-width 220ms ease',
        }}
      />
      {/* Selected highlight pulse (explicit edge selection) */}
      {selected && (
        <path
          d={edgePath}
          fill="none"
          stroke={cfg.color}
          strokeWidth={cfg.width + 2}
          opacity={0.35}
          strokeDasharray="3 24"
          style={{ animation: `${cfg.anim} 0.55s linear infinite` }}
        />
      )}
    </g>
  );
});
