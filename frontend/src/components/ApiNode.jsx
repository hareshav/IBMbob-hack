import { useState, useEffect, memo, useContext } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ChevronDown, Layers, FileCode2, ArrowRight, AlertTriangle } from 'lucide-react';
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

  /* ── External-module stub (boundary marker in expanded view) ── */
  if (data?.kind === 'external') {
    const color = '#7C7FF5';
    const isDimmed = hasSelection && !selected && !connectedNodeIds.has(id);
    return (
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'relative',
          minWidth: 170, maxWidth: 210,
          background: `linear-gradient(135deg, ${color}0F 0%, var(--bg-card) 70%)`,
          border: `1.5px dashed ${selected ? color : hovered ? `${color}AA` : `${color}55`}`,
          borderRadius: 12,
          padding: '8px 12px',
          boxShadow: selected
            ? `0 0 0 3px ${color}33, 0 6px 22px rgba(0,0,0,0.55)`
            : hovered
              ? `0 5px 18px rgba(0,0,0,0.45), 0 0 12px ${color}33`
              : '0 2px 10px rgba(0,0,0,0.4)',
          opacity: isDimmed ? 0.32 : 1,
          cursor: 'pointer',
          transition: 'box-shadow 160ms ease, border-color 160ms ease, opacity 320ms ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{
            width: 22, height: 22, borderRadius: 6,
            background: `${color}1F`,
            border: `1px solid ${color}55`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <FileCode2 size={11} color={color} strokeWidth={2.1} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 7, fontWeight: 700, color,
              textTransform: 'uppercase', letterSpacing: '0.14em',
              fontFamily: "'JetBrains Mono', monospace", lineHeight: 1, marginBottom: 2,
            }}>
              EXTERNAL
            </div>
            <div style={{
              fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)',
              fontFamily: "'JetBrains Mono', monospace",
              lineHeight: 1.3,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {data.label || 'external'}
            </div>
          </div>
          <ArrowRight size={11} color={color} strokeWidth={2.2} style={{ flexShrink: 0 }} />
        </div>
        <Handle type="target" position={Position.Left} isConnectable={isConnectable}
          style={{ width: 8, height: 8, background: color,
                   border: '2px solid var(--bg-card)', borderRadius: '50%', left: -4 }} />
        <Handle type="source" position={Position.Right} isConnectable={isConnectable}
          style={{ width: 8, height: 8, background: color,
                   border: '2px solid var(--bg-card)', borderRadius: '50%', right: -4 }} />
      </div>
    );
  }

  /* ── Module node (file-level aggregate) — large card showing per-file summary ── */
  if (data?.kind === 'module') {
    const primary = data.primaryGroup ? (GROUP_COLORS[data.primaryGroup] || '#4F8EF7') : '#4F8EF7';
    const c = data.counts || {};
    const isDimmed = hasSelection && !selected && !connectedNodeIds.has(id);
    return (
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'relative',
          minWidth: 240, maxWidth: 280,
          background: `linear-gradient(135deg, ${primary}1A 0%, var(--bg-card) 60%)`,
          border: `1.5px solid ${selected ? primary : hovered ? `${primary}88` : `${primary}44`}`,
          borderRadius: 14,
          padding: '12px 14px 11px',
          boxShadow: selected
            ? `0 0 0 3px ${primary}33, 0 10px 32px rgba(0,0,0,0.6)`
            : hovered
              ? `0 8px 26px rgba(0,0,0,0.55), 0 0 18px ${primary}33`
              : '0 3px 14px rgba(0,0,0,0.45)',
          opacity: isDimmed ? 0.32 : 1,
          transition: 'box-shadow 180ms ease, border-color 180ms ease, opacity 320ms ease, transform 180ms ease',
          transform: hovered && !selected ? 'translateY(-1px)' : 'translateY(0)',
          cursor: 'pointer',
        }}
      >
        {/* Top accent ribbon */}
        <div style={{
          position: 'absolute', top: 0, left: 12, right: 12, height: 2,
          borderRadius: '0 0 2px 2px',
          background: `linear-gradient(90deg, ${primary}, ${primary}66 70%, transparent)`,
          opacity: selected || hovered ? 1 : 0.7,
        }} />

        {/* Header: icon + file path */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: 9 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: `${primary}1F`,
            border: `1px solid ${primary}55`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <FileCode2 size={14} color={primary} strokeWidth={2.1} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 7.5, fontWeight: 700, color: primary,
              textTransform: 'uppercase', letterSpacing: '0.14em',
              fontFamily: "'JetBrains Mono', monospace", lineHeight: 1, marginBottom: 3,
            }}>
              MODULE
            </div>
            <div style={{
              fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)',
              fontFamily: "'JetBrains Mono', monospace",
              lineHeight: 1.3,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {data.label || 'unknown'}
            </div>
          </div>
          {data.hasRisk && (
            <AlertTriangle size={12} color="#F56565" strokeWidth={2.2} style={{ flexShrink: 0, marginTop: 2 }} />
          )}
        </div>

        {/* Kind breakdown chips */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 4,
          paddingTop: 8,
          borderTop: `1px solid ${primary}25`,
        }}>
          {c.input > 0 && <KindChip color="#2ED8F0" label="route" n={c.input} />}
          {c.function > 0 && <KindChip color="#B06EF7" label="fn" n={c.function} />}
          {c.router > 0 && <KindChip color="#4F8EF7" label="rtr" n={c.router} />}
          {c.output > 0 && <KindChip color="#1AE0A0" label="out" n={c.output} />}
        </div>

        {/* Footer hint */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: 8, paddingTop: 7,
          borderTop: '1px dashed var(--border-subtle)',
        }}>
          <span style={{
            fontSize: 9, color: 'var(--text-muted)',
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            {data.count} item{data.count === 1 ? '' : 's'}
          </span>
          <span style={{
            display: 'flex', alignItems: 'center', gap: 3,
            fontSize: 9, fontWeight: 600, color: primary,
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            open <ArrowRight size={9} strokeWidth={2.4} />
          </span>
        </div>

        <Handle type="target" position={Position.Left} isConnectable={isConnectable}
          style={{ width: 10, height: 10, background: primary,
                   border: '2px solid var(--bg-card)', borderRadius: '50%', left: -5 }} />
        <Handle type="source" position={Position.Right} isConnectable={isConnectable}
          style={{ width: 10, height: 10, background: primary,
                   border: '2px solid var(--bg-card)', borderRadius: '50%', right: -5 }} />
      </div>
    );
  }

  /* ── Group supernode (collapsed group) — distinct compact render ── */
  if (data?.kind === 'group') {
    const groupColor = GROUP_COLORS[data.group] || '#7C7F9A';
    const title = data.title || data.group || 'Group';
    return (
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'relative',
          minWidth: 180,
          maxWidth: 220,
          background: `linear-gradient(145deg, ${groupColor}22 0%, ${groupColor}08 100%), var(--bg-card)`,
          border: `1.5px dashed ${selected ? groupColor : hovered ? `${groupColor}99` : `${groupColor}55`}`,
          borderRadius: 14,
          padding: '11px 14px',
          boxShadow: selected
            ? `0 0 0 3px ${groupColor}33, 0 8px 26px rgba(0,0,0,0.55)`
            : hovered
              ? `0 6px 22px rgba(0,0,0,0.5), 0 0 12px ${groupColor}44`
              : '0 2px 10px rgba(0,0,0,0.4)',
          opacity: hasSelection && !selected && !connectedNodeIds.has(id) ? 0.32 : 1,
          transition: 'box-shadow 160ms ease, border-color 160ms ease, opacity 320ms ease',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{
            width: 22, height: 22, borderRadius: 6,
            background: `${groupColor}22`,
            border: `1px solid ${groupColor}55`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Layers size={11} color={groupColor} strokeWidth={2.2} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 7.5, fontWeight: 700, color: groupColor,
              textTransform: 'uppercase', letterSpacing: '0.14em',
              fontFamily: "'JetBrains Mono', monospace", lineHeight: 1,
            }}>
              GROUP
            </div>
            <div style={{
              fontSize: 13, fontWeight: 700, color: 'var(--text-primary)',
              fontFamily: "'JetBrains Mono', monospace",
              lineHeight: 1.3, marginTop: 2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {title}
            </div>
          </div>
          <ChevronDown size={13} color={groupColor} strokeWidth={2.2} style={{ flexShrink: 0 }} />
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          paddingTop: 6,
          borderTop: `1px dashed ${groupColor}30`,
        }}>
          <span style={{
            fontSize: 10, fontWeight: 600, color: groupColor,
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            {data.count} fn
          </span>
          <span style={{ flex: 1 }} />
          <span style={{
            fontSize: 9, color: 'var(--text-muted)',
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            click to expand
          </span>
        </div>

        <Handle type="target" position={Position.Left} isConnectable={isConnectable}
          style={{ width: 9, height: 9, background: groupColor,
                   border: '2px solid var(--bg-card)', borderRadius: '50%', left: -5 }} />
        <Handle type="source" position={Position.Right} isConnectable={isConnectable}
          style={{ width: 9, height: 9, background: groupColor,
                   border: '2px solid var(--bg-card)', borderRadius: '50%', right: -5 }} />
      </div>
    );
  }

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

function KindChip({ color, label, n }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 7px', borderRadius: 100,
      background: `${color}15`,
      border: `1px solid ${color}30`,
      fontSize: 9, fontWeight: 600, color,
      fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.2,
    }}>
      <span style={{ width: 4, height: 4, borderRadius: '50%', background: color, boxShadow: `0 0 4px ${color}` }} />
      {n} {label}
    </span>
  );
}
