import { useState } from 'react';
import { ChevronUp, ChevronDown, Info } from 'lucide-react';

const KINDS = [
  { color: '#4F8EF7', label: 'Router'   },
  { color: '#B06EF7', label: 'Function' },
  { color: '#2ED8F0', label: 'Input'    },
  { color: '#1AE0A0', label: 'Output'   },
];

const GROUPS = [
  { color: '#7C7FF5', label: 'API'           },
  { color: '#F7B955', label: 'Auth'          },
  { color: '#1AE0A0', label: 'Payments'      },
  { color: '#4F8EF7', label: 'Database'      },
  { color: '#2ED8F0', label: 'Notifications' },
  { color: '#B06EF7', label: 'Analytics'     },
  { color: '#F56565', label: 'Governance'    },
  { color: '#7C7F9A', label: 'Utils'         },
];

const EDGES = [
  { color: '#2ED8F0', label: 'API call' },
  { color: '#7C7FF5', label: 'Function call' },
  { color: '#4F8EF7', label: 'Other' },
];

/**
 * Floating bottom-left legend explaining what node colors mean.
 * Starts collapsed; click the header to expand.
 */
export default function CanvasLegend() {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        left: 16,
        zIndex: 18,
        background: 'var(--bg-glass-panel)',
        backdropFilter: 'blur(28px) saturate(170%)',
        WebkitBackdropFilter: 'blur(28px) saturate(170%)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 12,
        boxShadow: 'var(--shadow-float)',
        overflow: 'hidden',
        width: open ? 230 : 'auto',
        transition: 'width 240ms cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', gap: 7,
          padding: open ? '8px 10px' : '7px 11px',
          background: 'transparent', border: 'none',
          cursor: 'pointer', color: 'var(--text-secondary)',
          fontFamily: 'inherit',
          transition: 'background var(--t-fast)',
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <Info size={12} color="var(--accent-blue)" strokeWidth={2} />
        <span style={{
          fontSize: 10, fontWeight: 700, color: 'var(--text-primary)',
          textTransform: 'uppercase', letterSpacing: '0.12em',
          fontFamily: "'JetBrains Mono', monospace",
          flex: 1, textAlign: 'left',
        }}>
          Legend
        </span>
        {open
          ? <ChevronDown size={12} color="var(--text-muted)" />
          : <ChevronUp   size={12} color="var(--text-muted)" />}
      </button>

      {open && (
        <div style={{
          padding: '4px 12px 11px',
          borderTop: '1px solid var(--border-subtle)',
          animation: 'fadeIn 200ms ease forwards',
        }}>
          <Section title="Node kinds" items={KINDS} swatch="dot" />
          <Section title="Function groups" items={GROUPS} swatch="dot" />
          <Section title="Edges" items={EDGES} swatch="line" />
        </div>
      )}
    </div>
  );
}

function Section({ title, items, swatch }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{
        fontSize: 8.5, fontWeight: 700, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.12em',
        fontFamily: "'JetBrains Mono', monospace",
        marginBottom: 5,
      }}>
        {title}
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: '3px 10px',
      }}>
        {items.map((it) => (
          <div key={it.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {swatch === 'line' ? (
              <span style={{
                width: 14, height: 2, borderRadius: 1,
                background: it.color, flexShrink: 0,
                boxShadow: `0 0 4px ${it.color}88`,
              }} />
            ) : (
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: it.color, flexShrink: 0,
                boxShadow: `0 0 5px ${it.color}88`,
              }} />
            )}
            <span style={{
              fontSize: 10, color: 'var(--text-secondary)',
              fontFamily: "'JetBrains Mono', monospace",
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {it.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
