import { useState } from 'react';
import { Search, GitBranch, Code2, LogIn, LogOut, Box, Plus, Trash2, X as XIcon } from 'lucide-react';

const KIND_CONFIG = {
  router:   { color: '#4F8EF7', icon: GitBranch, label: 'Router'   },
  function: { color: '#B06EF7', icon: Code2,     label: 'Function' },
  input:    { color: '#2ED8F0', icon: LogIn,     label: 'Input'    },
  output:   { color: '#1AE0A0', icon: LogOut,    label: 'Output'   },
  default:  { color: '#7C7F9A', icon: Box,       label: 'Node'     },
};

const KIND_FILTERS = [
  { value: 'all',      label: 'All'       },
  { value: 'input',    label: 'Inputs'    },
  { value: 'function', label: 'Functions' },
  { value: 'output',   label: 'Outputs'   },
  { value: 'router',   label: 'Routers'   },
];

const GROUP_FILTERS = [
  { value: 'all',           label: 'All groups',    color: 'var(--accent-blue)' },
  { value: 'api',           label: 'API',           color: '#7C7FF5' },
  { value: 'auth',          label: 'Auth',          color: '#F7B955' },
  { value: 'payments',      label: 'Payments',      color: '#1AE0A0' },
  { value: 'database',      label: 'Database',      color: '#4F8EF7' },
  { value: 'notifications', label: 'Notifs',        color: '#2ED8F0' },
  { value: 'analytics',     label: 'Analytics',     color: '#B06EF7' },
  { value: 'profile',       label: 'Profile',       color: '#2ED8F0' },
  { value: 'content',       label: 'Content',       color: '#B06EF7' },
  { value: 'moderation',    label: 'Moderation',    color: '#F56565' },
  { value: 'governance',    label: 'Governance',    color: '#F56565' },
  { value: 'learning',      label: 'Learning',      color: '#1AE0A0' },
  { value: 'utils',         label: 'Utils',         color: '#7C7F9A' },
];

export default function LeftSidebar({
  collapsed,
  nodes,
  selectedNode,
  onSelectNode,
  newNodeLabel,
  onNewNodeLabelChange,
  newNodeKind,
  onNewNodeKindChange,
  onAddNode,
  onQuickAddRouter,
  onDeleteSelectedNode,
  canEdit,
}) {
  const [search, setSearch]       = useState('');
  const [kindFilter, setKindFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');

  const filtered = (nodes || []).filter((n) => {
    const matchKind  = kindFilter  === 'all' || n.data?.kind  === kindFilter;
    const matchGroup = groupFilter === 'all' || n.data?.group === groupFilter;
    const q = search.toLowerCase();
    const matchSearch = !q
      || (n.data?.label || '').toLowerCase().includes(q)
      || (n.data?.title || '').toLowerCase().includes(q)
      || (n.data?.file  || '').toLowerCase().includes(q);
    return matchKind && matchGroup && matchSearch;
  });

  return (
    <aside style={{
      width: collapsed ? 0 : 252,
      minWidth: collapsed ? 0 : 252,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-glass-panel)',
      backdropFilter: 'blur(28px) saturate(170%)',
      WebkitBackdropFilter: 'blur(28px) saturate(170%)',
      borderRight: '1px solid var(--border-subtle)',
      overflow: 'hidden',
      flexShrink: 0,
      transition: 'width 0.28s cubic-bezier(0.4,0,0.2,1), min-width 0.28s cubic-bezier(0.4,0,0.2,1)',
      position: 'relative',
    }}>
      {/* Gradient top accent strip */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2, zIndex: 10,
        background: 'linear-gradient(90deg, #4F8EF7, #7C7FF5, #B06EF7, #2ED8F0)',
        backgroundSize: '200% 100%',
        animation: 'gradientShift 5s ease infinite',
      }} />

      {/* Header */}
      <div style={{
        padding: '14px 14px 0',
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 10,
        }}>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: 'var(--text-muted)',
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            Nodes
          </span>
          {nodes?.length > 0 && (
            <span style={{
              fontSize: 9.5, fontWeight: 600,
              padding: '2px 7px', borderRadius: 100,
              background: 'var(--accent-blue-soft)',
              border: '1px solid var(--border-accent)',
              color: 'var(--accent-blue)',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {nodes.length}
            </span>
          )}
        </div>

        {/* Graph Controls — at top */}
        {canEdit && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 5, marginBottom: 5 }}>
              <input
                type="text"
                value={newNodeLabel}
                onChange={(e) => onNewNodeLabelChange(e.target.value)}
                placeholder="Label"
                style={{
                  flex: 1, height: 26,
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 5, padding: '0 8px',
                  fontSize: 11, outline: 'none',
                  fontFamily: 'inherit',
                  minWidth: 0,
                  transition: 'border-color var(--t-fast)',
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--accent-blue)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border-default)'}
              />
              <select
                value={newNodeKind}
                onChange={(e) => onNewNodeKindChange(e.target.value)}
                style={{
                  height: 26, width: 78,
                  background: 'var(--bg-input)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 5, padding: '0 4px',
                  fontSize: 10.5, outline: 'none', cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <option value="router">Router</option>
                <option value="function">Function</option>
                <option value="input">Input</option>
                <option value="output">Output</option>
                <option value="default">Default</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <SidebarBtn onClick={onAddNode} color="#4F8EF7" flex icon={<Plus size={11} />}>
                Node
              </SidebarBtn>
              <SidebarBtn onClick={onQuickAddRouter} color="#7C7FF5" flex icon={<GitBranch size={11} />}>
                Router
              </SidebarBtn>
              <SidebarBtn
                onClick={onDeleteSelectedNode}
                color="#F56565"
                disabled={!selectedNode?.id}
                icon={<Trash2 size={11} />}
              />
            </div>
          </div>
        )}

        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7,
          height: 30,
          background: 'var(--bg-input)',
          border: '1px solid var(--border-default)',
          borderRadius: 7,
          padding: '0 10px',
          marginBottom: 8,
          transition: 'border-color var(--t-fast)',
        }}
          onFocusCapture={(e) => e.currentTarget.style.borderColor = 'var(--accent-blue)'}
          onBlurCapture={(e) => e.currentTarget.style.borderColor = 'var(--border-default)'}
        >
          <Search size={11} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search nodes…"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none', outline: 'none',
              color: 'var(--text-primary)',
              fontSize: 11.5,
              fontFamily: 'inherit',
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex', lineHeight: 1 }}
            >
              <XIcon size={10} />
            </button>
          )}
        </div>

        {/* Kind filter chips */}
        <div style={{ display: 'flex', gap: 3, paddingBottom: 5, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {KIND_FILTERS.map(({ value, label }) => {
            const active = kindFilter === value;
            const cfg = KIND_CONFIG[value] || KIND_CONFIG.default;
            const col = value === 'all' ? 'var(--accent-blue)' : cfg.color;
            return (
              <button key={value} onClick={() => setKindFilter(value)} style={{
                height: 20, padding: '0 7px', borderRadius: 100,
                background: active ? col + '18' : 'transparent',
                border: '1px solid', borderColor: active ? col + '50' : 'var(--border-subtle)',
                color: active ? col : 'var(--text-muted)',
                fontSize: 9.5, fontWeight: active ? 600 : 400,
                cursor: 'pointer', transition: 'all var(--t-fast)',
                whiteSpace: 'nowrap', fontFamily: 'inherit', flexShrink: 0,
              }}>
                {label}
              </button>
            );
          })}
        </div>

        {/* Group filter chips */}
        <div style={{ display: 'flex', gap: 3, paddingBottom: 10, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {GROUP_FILTERS.map(({ value, label, color }) => {
            const active = groupFilter === value;
            return (
              <button key={value} onClick={() => setGroupFilter(value)} style={{
                height: 18, padding: '0 6px', borderRadius: 100,
                background: active ? color + '18' : 'transparent',
                border: '1px solid', borderColor: active ? color + '50' : 'var(--border-subtle)',
                color: active ? color : 'var(--text-muted)',
                fontSize: 8.5, fontWeight: active ? 600 : 400,
                cursor: 'pointer', transition: 'all var(--t-fast)',
                whiteSpace: 'nowrap', fontFamily: 'inherit', flexShrink: 0,
              }}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border-subtle)', flexShrink: 0 }} />

      {/* Node list */}
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '6px 8px',
      }}>
        {filtered.length === 0 ? (
          <div style={{
            padding: '36px 16px',
            textAlign: 'center',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 9,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 10px',
              color: 'var(--text-muted)',
            }}>
              <Box size={15} />
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              {(nodes || []).length === 0 ? 'Load a graph to see nodes' : 'No nodes match'}
            </div>
          </div>
        ) : (
          filtered.map((node) => {
            const kind = node.data?.kind || 'default';
            const cfg = KIND_CONFIG[kind] || KIND_CONFIG.default;
            const Icon = cfg.icon;
            const isSelected = selectedNode?.id === node.id;
            const label    = node.data?.title || node.data?.label || node.id;
            const file     = node.data?.file || '';
            const group    = node.data?.group;
            const isRisky  = node.data?.state === 'risky';
            const risk     = node.data?.risk ?? null;

            return (
              <button
                key={node.id}
                onClick={() => onSelectNode(node)}
                style={{
                  width: '100%',
                  display: 'flex', alignItems: 'flex-start', gap: 9,
                  padding: '8px 9px',
                  borderRadius: 8,
                  background: isSelected ? cfg.color + '10' : 'transparent',
                  border: '1px solid',
                  borderColor: isSelected ? cfg.color + '30' : 'transparent',
                  cursor: 'pointer',
                  marginBottom: 2,
                  textAlign: 'left',
                  transition: 'all var(--t-fast)',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'var(--bg-elevated)';
                    e.currentTarget.style.borderColor = 'var(--border-default)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = 'transparent';
                  }
                }}
              >
                {/* Kind icon */}
                <div style={{
                  width: 27, height: 27, borderRadius: 7, flexShrink: 0,
                  background: cfg.color + '12',
                  border: `1px solid ${cfg.color}28`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginTop: 1,
                }}>
                  <Icon size={12} color={cfg.color} strokeWidth={2} />
                </div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                    <span style={{
                      flex: 1, minWidth: 0,
                      fontSize: 11.5, fontWeight: isSelected ? 600 : 500,
                      color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      lineHeight: 1.4,
                      fontFamily: "'JetBrains Mono', monospace",
                      transition: 'color var(--t-fast)',
                    }}>
                      {label}
                    </span>
                    {isRisky && (
                      <span style={{ fontSize: 7, fontWeight: 700, color: '#F56565', flexShrink: 0,
                        padding: '1px 4px', borderRadius: 100,
                        background: 'rgba(245,101,101,0.12)', border: '1px solid rgba(245,101,101,0.3)',
                        textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        ⚠
                      </span>
                    )}
                  </div>
                  {(file || group) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      {file && (
                        <span style={{
                          fontSize: 9.5, color: 'var(--text-muted)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.4,
                          flex: 1, minWidth: 0,
                        }}>
                          {file.split('/').slice(-2).join('/')}
                        </span>
                      )}
                      {group && group !== 'utils' && (
                        <span style={{
                          fontSize: 8, fontWeight: 600, flexShrink: 0,
                          color: GROUP_FILTERS.find(g => g.value === group)?.color || 'var(--text-muted)',
                        }}>
                          {group}
                        </span>
                      )}
                    </div>
                  )}
                  {risk !== null && risk > 0 && (
                    <div style={{ marginTop: 3, height: 2, background: 'var(--border-subtle)', borderRadius: 100, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${Math.round(risk * 100)}%`, borderRadius: 100,
                        background: risk > 0.6 ? '#F56565' : risk > 0.25 ? '#F7B955' : '#1AE0A0',
                      }} />
                    </div>
                  )}
                </div>

                {/* Selected indicator */}
                {isSelected && (
                  <div style={{
                    width: 4, height: 4, borderRadius: '50%', flexShrink: 0,
                    background: cfg.color, alignSelf: 'center',
                    boxShadow: `0 0 6px ${cfg.color}`,
                  }} />
                )}
              </button>
            );
          })
        )}
      </div>

    </aside>
  );
}

function SidebarBtn({ children, onClick, color, disabled, flex, icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 26,
        flex: flex ? 1 : undefined,
        padding: '0 8px',
        borderRadius: 5,
        background: disabled ? 'transparent' : color + '10',
        border: '1px solid',
        borderColor: disabled ? 'var(--border-subtle)' : color + '30',
        color: disabled ? 'var(--text-muted)' : color,
        fontSize: 10.5, fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.35 : 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        transition: 'all var(--t-fast)',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = color + '20'; }}
      onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.background = color + '10'; }}
    >
      {icon}
      {children}
    </button>
  );
}
