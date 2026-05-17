import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Sparkles } from 'lucide-react';

/**
 * Hover popover that explains WHY a function node is risky.
 *
 * Rendered via portal so it escapes React Flow's transform / clipping
 * regions and always lands on top of the canvas. Anchors itself to the
 * provided `anchorRect` (the node's DOM bounding rect in screen coords)
 * and prefers to sit above the node, flipping below if there isn't room.
 *
 * Props:
 *   anchorRect   - DOMRect of the trigger node, or null to hide
 *   data         - the node's data blob (label, file, group, risk, fan_in,
 *                  fan_out, risk_description, severity-color from caller)
 */
export default function RiskHoverDialog({ anchorRect, data }) {
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!anchorRect) { setPos(null); return; }

    const W = 320;
    const margin = 12;
    const offset = 14; // gap between node and popover
    const estHeight = 200; // pre-render guess - good enough for flip decision

    // Horizontally centre on the node, clamp to viewport
    let left = anchorRect.left + anchorRect.width / 2 - W / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - W - margin));

    // Prefer above. Flip below if the top wouldn't fit.
    const topAbove = anchorRect.top - estHeight - offset;
    const placeAbove = topAbove >= margin;
    const top = placeAbove
      ? anchorRect.top - estHeight - offset
      : anchorRect.bottom + offset;

    setPos({ top, left, width: W, flip: !placeAbove });
  }, [anchorRect]);

  if (!anchorRect || !pos || !data) return null;

  const risk = data.risk ?? 0;
  const severity =
    risk > 0.75 ? { label: 'Critical', color: '#F56565', tint: 'rgba(245,101,101,0.12)', border: 'rgba(245,101,101,0.45)' } :
    risk > 0.55 ? { label: 'High',     color: '#F56565', tint: 'rgba(245,101,101,0.10)', border: 'rgba(245,101,101,0.38)' } :
    risk > 0.30 ? { label: 'Moderate', color: '#F7B955', tint: 'rgba(247,185,85,0.10)',  border: 'rgba(247,185,85,0.38)' } :
                  { label: 'Low',      color: '#1AE0A0', tint: 'rgba(26,224,160,0.10)',  border: 'rgba(26,224,160,0.38)' };

  const description = (data.risk_description || '').trim();
  const hasBobAnalysis = description.length > 0;
  const name = data.title || data.label || 'Function';
  const file = data.file || '';
  const group = data.group || 'utils';
  const fanIn = Number(data.fan_in) || 0;
  const fanOut = Number(data.fan_out) || 0;

  return createPortal(
    <div
      role="tooltip"
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: pos.width,
        zIndex: 9999,
        pointerEvents: 'none',
        background: 'var(--bg-glass-strong)',
        backdropFilter: 'blur(28px) saturate(180%)',
        WebkitBackdropFilter: 'blur(28px) saturate(180%)',
        border: '1px solid var(--border-default)',
        borderRadius: 12,
        boxShadow: 'var(--shadow-float)',
        overflow: 'hidden',
        animation: 'fadeInDown 160ms cubic-bezier(0.4,0,0.2,1) forwards',
        fontFamily: 'inherit',
      }}
    >
      {/* Severity stripe across the top */}
      <div style={{
        height: 3,
        background: `linear-gradient(90deg, ${severity.color}, transparent)`,
      }} />

      {/* Header: severity badge + score */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '12px 14px 6px',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '3px 8px',
          background: severity.tint,
          border: `1px solid ${severity.border}`,
          borderRadius: 100,
          color: severity.color,
          fontSize: 9.5, fontWeight: 700,
          fontFamily: "'JetBrains Mono', monospace",
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}>
          <AlertTriangle size={10} strokeWidth={2.4} />
          {severity.label}
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700,
          color: severity.color,
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {Math.round(risk * 100)}%
        </span>
        <span style={{ flex: 1 }} />
        <span style={{
          fontSize: 9, fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {group}
        </span>
      </div>

      {/* Function name + file */}
      <div style={{ padding: '0 14px 10px' }}>
        <div style={{
          fontSize: 14, fontWeight: 700,
          color: 'var(--text-primary)',
          fontFamily: "'JetBrains Mono', monospace",
          lineHeight: 1.3,
          wordBreak: 'break-word',
        }}>
          {name}
        </div>
        {file && (
          <div style={{
            fontSize: 10, color: 'var(--text-muted)',
            fontFamily: "'JetBrains Mono', monospace",
            marginTop: 3,
            wordBreak: 'break-all',
          }}>
            {file}
          </div>
        )}
      </div>

      {/* Bob's explanation - this is the headline of the popover */}
      <div style={{
        borderTop: '1px solid var(--border-subtle)',
        padding: '11px 14px 12px',
        background: hasBobAnalysis ? `linear-gradient(135deg, rgba(124,127,245,0.08) 0%, ${severity.tint} 100%)` : 'transparent',
      }}>
        {hasBobAnalysis ? (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              marginBottom: 6,
            }}>
              <Sparkles size={10} color="#7C7FF5" strokeWidth={2.4} />
              <span style={{
                fontSize: 8.5, fontWeight: 700, color: '#7C7FF5',
                textTransform: 'uppercase', letterSpacing: '0.12em',
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                Why Bob flagged it
              </span>
            </div>
            <div style={{
              fontSize: 12, color: 'var(--text-primary)',
              lineHeight: 1.5,
            }}>
              {description}
            </div>
          </>
        ) : (
          <div style={{
            fontSize: 11, color: 'var(--text-muted)',
            lineHeight: 1.5, fontStyle: 'italic',
          }}>
            Static risk from connectivity + name patterns. Click{' '}
            <span style={{ color: 'var(--accent-blue)', fontWeight: 600, fontStyle: 'normal' }}>Ask Bob AI</span>{' '}
            for a semantic explanation.
          </div>
        )}
      </div>

      {/* Footer stats */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '8px 14px 10px',
        borderTop: '1px solid var(--border-subtle)',
        fontSize: 10,
        color: 'var(--text-muted)',
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        <span>
          <span style={{ color: '#2ED8F0' }}>↓{fanIn}</span> called by
        </span>
        <span style={{ color: 'var(--border-default)' }}>·</span>
        <span>
          <span style={{ color: '#B06EF7' }}>↑{fanOut}</span> calls
        </span>
      </div>
    </div>,
    document.body,
  );
}
