import { memo } from 'react';
import { getBezierPath } from '@xyflow/react';

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
  /* Fan-in vertical spread: keeps convergent edges from stacking on top of each other.
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

  const finalOpacity = selected ? 1 : densityOpacity;

  /* Module aggregate edges carry a `weight` (number of underlying calls). Thicker = more traffic. */
  const weight = data?.weight ?? 1;
  const weightBoost = weight > 1 ? Math.min(Math.log2(weight) * 0.9, 3.5) : 0;
  const strokeW = (selected ? cfg.width + 0.8 : cfg.width) + weightBoost;
  const glowW   = (selected ? cfg.glowW + 5 : cfg.glowW) + weightBoost * 0.6;

  return (
    <g style={{ pointerEvents: 'none' }}>
      {/* Blurred glow halo */}
      <path
        d={edgePath}
        fill="none"
        stroke={cfg.glow}
        strokeWidth={glowW}
        strokeLinecap="round"
        opacity={selected ? 0.75 : (fanIn > 8 ? 0.28 : 0.42)}
        style={{ filter: 'blur(4px)' }}
      />
      {/* Static base thread */}
      <path
        d={edgePath}
        fill="none"
        stroke={cfg.color}
        strokeWidth={cfg.width * 0.4}
        opacity={finalOpacity * 0.25}
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
        style={{ animation: `${cfg.anim} ${cfg.speed} linear infinite` }}
      />
      {/* Selected highlight pulse */}
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
