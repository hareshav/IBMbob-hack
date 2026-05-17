import { useState, useEffect, memo, useContext } from 'react';
import { Handle, Position } from '@xyflow/react';
import { GraphCtx } from '../lib/graphContext';

const KIND = {
  router: {
    color: '#4F8EF7',
    label: 'ROUTER',
    grad: 'linear-gradient(145deg, rgba(79,142,247,0.13) 0%, rgba(79,142,247,0.03) 100%)',
    handleColor: '#4F8EF7',
  },
  function: {
    color: '#B06EF7',
    label: 'FN',
    grad: 'linear-gradient(145deg, rgba(176,110,247,0.13) 0%, rgba(176,110,247,0.03) 100%)',
    handleColor: '#B06EF7',
  },
  input: {
    color: '#2ED8F0',
    label: 'INPUT',
    grad: 'linear-gradient(145deg, rgba(46,216,240,0.13) 0%, rgba(46,216,240,0.03) 100%)',
    handleColor: '#2ED8F0',
  },
  output: {
    color: '#1AE0A0',
    label: 'OUTPUT',
    grad: 'linear-gradient(145deg, rgba(26,224,160,0.13) 0%, rgba(26,224,160,0.03) 100%)',
    handleColor: '#1AE0A0',
  },
  default: {
    color: '#7C7F9A',
    label: 'NODE',
    grad: 'linear-gradient(145deg, rgba(124,127,154,0.10) 0%, rgba(124,127,154,0.03) 100%)',
    handleColor: '#7C7F9A',
  },
};

const GROUP_COLORS = {
  api:           '#7C7FF5',
  auth:          '#F7B955',
  payments:      '#1AE0A0',
  notifications: '#2ED8F0',
  analytics:     '#B06EF7',
  database:      '#4F8EF7',
  governance:    '#F56565',
  profile:       '#2ED8F0',
  content:       '#B06EF7',
  moderation:    '#F56565',
  learning:      '#1AE0A0',
  utils:         '#7C7F9A',
};

/* Stable shadow values — set via JS, never via CSS class transforms */
const shadow = {
  base:    '0 2px 10px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
  hovered: '0 4px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
  selected:'0 0 0 3px rgba(79,142,247,0.22), 0 6px 24px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.07)',
  risky:   '0 2px 10px rgba(0,0,0,0.4), 0 0 16px rgba(245,101,101,0.18), inset 0 1px 0 rgba(255,255,255,0.04)',
};

export const ApiNode = memo(function ApiNode({ id, data, selected, isConnectable }) {
  const [hovered, setHovered] = useState(false);
  const [burstKey, setBurstKey] = useState(0);
  const [showBurst, setShowBurst] = useState(false);
  const { connectedNodeIds, hasSelection } = useContext(GraphCtx);
  const isConnected = !selected && connectedNodeIds.has(id);

  /* Trigger ripple burst whenever this node becomes selected */
  useEffect(() => {
    if (!selected) { setShowBurst(false); return; }
    setBurstKey((k) => k + 1);
    setShowBurst(true);
    const t = setTimeout(() => setShowBurst(false), 850);
    return () => clearTimeout(t);
  }, [selected]);

  const kind      = data?.kind  || 'default';
  const cfg       = KIND[kind]  || KIND.default;
  const group     = data?.group || null;
  const groupColor = group ? (GROUP_COLORS[group] || '#7C7F9A') : null;
  const risk      = data?.risk  ?? null;
  const fanIn     = data?.fan_in  ?? null;
  const fanOut    = data?.fan_out ?? null;
  const isRisky   = data?.state === 'risky';

  const hasTarget = kind !== 'input';
  const hasSource = kind !== 'output';

  const borderColor = isConnected && !selected
    ? 'rgba(79,142,247,0.55)'
    : selected
      ? `${cfg.color}BB`
      : hovered
        ? `${cfg.color}55`
        : isRisky
          ? 'rgba(245,101,101,0.28)'
          : 'rgba(255,255,255,0.07)';

  /* when connected (not selected), let CSS @keyframes handle box-shadow */
  const boxShadow = (isConnected && !selected)
    ? undefined
    : selected
      ? shadow.selected
      : isRisky && !hovered
        ? shadow.risky
        : hovered ? shadow.hovered : shadow.base;

  const label    = data.title || data.label || 'Unnamed';
  const fileLabel = data.file ? data.file.split('/').slice(-1)[0] : null;
  const isDimmed  = hasSelection && !selected && !isConnected;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={isConnected ? 'node-connected-glow' : undefined}
      style={{
        position: 'relative',
        minWidth: 200,
        maxWidth: 240,
        background: isRisky
          ? 'linear-gradient(145deg, rgba(245,101,101,0.06) 0%, var(--bg-card) 40%)'
          : 'var(--bg-card)',
        backgroundImage: isRisky ? undefined : cfg.grad,
        border: `1.5px solid ${borderColor}`,
        borderRadius: 12,
        padding: '10px 14px 10px 18px',
        boxShadow,
        borderColor,
        opacity: isDimmed ? 0.22 : 1,
        transition: 'box-shadow 160ms ease, border-color 160ms ease, opacity 320ms ease',
      }}
    >
      {/* Burst ripple rings — fire outward on selection */}
      {showBurst && (
        <>
          <div key={burstKey} style={{
            position: 'absolute', inset: -4, borderRadius: 16,
            border: `2px solid ${cfg.color}`,
            pointerEvents: 'none', zIndex: 50,
            animation: 'focusBurst 620ms cubic-bezier(0.15,0,0.75,1) forwards',
          }} />
          <div key={`${burstKey}-2`} style={{
            position: 'absolute', inset: -10, borderRadius: 22,
            border: `1px solid ${cfg.color}77`,
            pointerEvents: 'none', zIndex: 49,
            animation: 'focusBurst2 900ms cubic-bezier(0.15,0,0.75,1) 60ms forwards',
          }} />
        </>
      )}
      {/* Left accent bar — kind color */}
      <div style={{
        position: 'absolute',
        left: 0, top: 7, bottom: 7,
        width: 3,
        borderRadius: '0 3px 3px 0',
        background: `linear-gradient(180deg, ${cfg.color} 0%, ${cfg.color}44 100%)`,
        opacity: selected || hovered ? 1 : 0.6,
        transition: 'opacity 160ms ease',
      }} />

      {/* Kind badge row + group chip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
        {/* Kind dot + label */}
        <span style={{
          width: 5, height: 5, borderRadius: '50%',
          background: cfg.color, flexShrink: 0,
          boxShadow: `0 0 6px ${cfg.color}88`,
        }} />
        <span style={{
          fontSize: 8.5, fontWeight: 700, color: cfg.color,
          textTransform: 'uppercase', letterSpacing: '0.12em',
          fontFamily: "'JetBrains Mono', monospace",
          lineHeight: 1,
        }}>
          {cfg.label}
        </span>

        {/* Group badge — only for function nodes with a known group */}
        {group && group !== 'utils' && kind === 'function' && (
          <span style={{
            fontSize: 7.5, fontWeight: 600,
            padding: '1px 5px',
            borderRadius: 100,
            background: `${groupColor}18`,
            border: `1px solid ${groupColor}35`,
            color: groupColor,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontFamily: "'JetBrains Mono', monospace",
            lineHeight: 1.2,
            flexShrink: 0,
          }}>
            {group}
          </span>
        )}

        {/* Risky badge */}
        {isRisky && (
          <span style={{
            fontSize: 7.5, fontWeight: 700,
            padding: '1px 5px',
            borderRadius: 100,
            background: 'rgba(245,101,101,0.14)',
            border: '1px solid rgba(245,101,101,0.35)',
            color: '#F56565',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontFamily: "'JetBrains Mono', monospace",
            lineHeight: 1.2,
            flexShrink: 0,
          }}>
            risky
          </span>
        )}
      </div>

      {/* Main label */}
      <div style={{
        fontSize: 12.5, fontWeight: 600,
        color: selected ? 'var(--text-primary)' : hovered ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontFamily: "'JetBrains Mono', monospace",
        lineHeight: 1.4,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        transition: 'color 160ms ease',
      }}>
        {label}
      </div>

      {/* File info */}
      {fileLabel && (
        <div style={{
          fontSize: 9.5, color: 'var(--text-muted)',
          fontFamily: "'JetBrains Mono', monospace",
          marginTop: 3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          lineHeight: 1.4,
        }}>
          {fileLabel}
        </div>
      )}

      {/* Fan-in / fan-out + risk bar — only for function nodes with data */}
      {kind === 'function' && (fanIn !== null || risk !== null) && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          marginTop: 6, paddingTop: 5,
          borderTop: '1px solid var(--border-subtle)',
        }}>
          {fanIn !== null && (
            <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
              <span style={{ color: '#2ED8F0' }}>↓{fanIn}</span>
              {' '}
              <span style={{ color: '#B06EF7' }}>↑{fanOut ?? 0}</span>
            </span>
          )}
          {risk !== null && (
            <div style={{ flex: 1, height: 3, background: 'var(--border-subtle)', borderRadius: 100, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.round(risk * 100)}%`,
                borderRadius: 100,
                background: risk > 0.6
                  ? '#F56565'
                  : risk > 0.25
                    ? '#F7B955'
                    : '#1AE0A0',
                transition: 'width 400ms ease',
              }} />
            </div>
          )}
        </div>
      )}

      {/* Handles */}
      {hasTarget && (
        <Handle type="target" position={Position.Left} isConnectable={isConnectable}
          style={{ width: 8, height: 8, background: cfg.handleColor,
                   border: '2px solid var(--bg-card)', borderRadius: '50%', left: -4 }} />
      )}
      {hasSource && (
        <Handle type="source" position={Position.Right} isConnectable={isConnectable}
          style={{ width: 8, height: 8, background: cfg.handleColor,
                   border: '2px solid var(--bg-card)', borderRadius: '50%', right: -4 }} />
      )}
    </div>
  );
});
