import { useState } from 'react';
import { Layers, ChevronUp, ChevronDown, Eye, EyeOff } from 'lucide-react';

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

/**
 * Floating panel listing groups present in the graph. Each row toggles
 * the collapsed state of that group (showing every function inline vs.
 * a single supernode).
 */
export default function GroupsPanel({ groups, collapsedGroups, onToggleGroup, onCollapseAll, onExpandAll }) {
  const [open, setOpen] = useState(true);

  if (!groups || groups.length === 0) return null;

  const someCollapsed = groups.some((g) => collapsedGroups.has(g.group));
  const allCollapsed  = groups.every((g) => collapsedGroups.has(g.group));

  return (
    <div
      style={{
        position: 'absolute',
        right: 16,
        bottom: 180,
        zIndex: 18,
        width: open ? 230 : 'auto',
        background: 'var(--bg-glass-panel)',
        backdropFilter: 'blur(28px) saturate(170%)',
        WebkitBackdropFilter: 'blur(28px) saturate(170%)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 12,
        boxShadow: 'var(--shadow-float)',
        overflow: 'hidden',
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
        <Layers size={12} color="var(--accent-purple)" strokeWidth={2} />
        <span style={{
          fontSize: 10, fontWeight: 700, color: 'var(--text-primary)',
          textTransform: 'uppercase', letterSpacing: '0.12em',
          fontFamily: "'JetBrains Mono', monospace",
          flex: 1, textAlign: 'left',
        }}>
          Groups
        </span>
        <span style={{
          fontSize: 9.5, fontWeight: 600,
          padding: '1px 6px', borderRadius: 100,
          background: 'var(--accent-purple-soft)',
          border: '1px solid rgba(176,110,247,0.3)',
          color: 'var(--accent-purple)',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {groups.length}
        </span>
        {open
          ? <ChevronDown size={12} color="var(--text-muted)" />
          : <ChevronUp   size={12} color="var(--text-muted)" />}
      </button>

      {open && (
        <>
          <div style={{
            display: 'flex', gap: 6,
            padding: '6px 10px 8px',
            borderTop: '1px solid var(--border-subtle)',
          }}>
            <ActionBtn onClick={onCollapseAll} disabled={allCollapsed}>
              <EyeOff size={10} /> Collapse all
            </ActionBtn>
            <ActionBtn onClick={onExpandAll} disabled={!someCollapsed}>
              <Eye size={10} /> Expand all
            </ActionBtn>
          </div>

          <div style={{
            maxHeight: 280, overflowY: 'auto',
            padding: '4px 6px 8px',
            borderTop: '1px solid var(--border-subtle)',
            animation: 'fadeIn 200ms ease forwards',
          }}>
            {groups.map(({ group, count }) => {
              const collapsed = collapsedGroups.has(group);
              const color = GROUP_COLORS[group] || '#7C7F9A';
              return (
                <button
                  key={group}
                  onClick={() => onToggleGroup(group)}
                  style={{
                    width: '100%',
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 8px',
                    background: collapsed ? `${color}12` : 'transparent',
                    border: '1px solid',
                    borderColor: collapsed ? `${color}30` : 'transparent',
                    borderRadius: 7,
                    cursor: 'pointer',
                    marginBottom: 2,
                    transition: 'all var(--t-fast)',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={(e) => {
                    if (collapsed) return;
                    e.currentTarget.style.background = 'var(--bg-elevated)';
                    e.currentTarget.style.borderColor = 'var(--border-default)';
                  }}
                  onMouseLeave={(e) => {
                    if (collapsed) return;
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = 'transparent';
                  }}
                >
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: color,
                    boxShadow: `0 0 6px ${color}99`,
                    flexShrink: 0,
                  }} />
                  <span style={{
                    flex: 1, textAlign: 'left',
                    fontSize: 11, fontWeight: collapsed ? 600 : 500,
                    color: collapsed ? color : 'var(--text-secondary)',
                    fontFamily: "'JetBrains Mono', monospace",
                    textTransform: 'capitalize',
                  }}>
                    {group}
                  </span>
                  <span style={{
                    fontSize: 9, fontWeight: 600,
                    color: 'var(--text-muted)',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    {count}
                  </span>
                  {collapsed
                    ? <EyeOff size={11} color={color} />
                    : <Eye    size={11} color="var(--text-muted)" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function ActionBtn({ children, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        height: 22, padding: '0 7px',
        borderRadius: 6,
        background: disabled ? 'transparent' : 'var(--bg-elevated)',
        border: '1px solid',
        borderColor: disabled ? 'var(--border-subtle)' : 'var(--border-default)',
        color: disabled ? 'var(--text-muted)' : 'var(--text-secondary)',
        fontSize: 9.5, fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        fontFamily: 'inherit',
        transition: 'all var(--t-fast)',
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.background = 'var(--bg-card)';
        e.currentTarget.style.color = 'var(--text-primary)';
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        e.currentTarget.style.background = 'var(--bg-elevated)';
        e.currentTarget.style.color = 'var(--text-secondary)';
      }}
    >
      {children}
    </button>
  );
}
