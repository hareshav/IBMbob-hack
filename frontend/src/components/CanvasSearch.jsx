import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X as XIcon, ChevronUp, ChevronDown } from 'lucide-react';

/**
 * Floating on-canvas search bar. Toggled with the "/" key (handled by parent).
 * When a match is selected, calls `onPick(node)` so the parent can pan/zoom
 * and select that node.
 */
export default function CanvasSearch({ nodes, isOpen, onClose, onPick }) {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef(null);

  const matches = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    return (nodes || []).filter((n) => {
      const d = n.data || {};
      if (d.kind === 'group') return false; // don't try to jump into supernodes
      return (
        (d.title || '').toLowerCase().includes(query) ||
        (d.label || '').toLowerCase().includes(query) ||
        (d.file || '').toLowerCase().includes(query) ||
        (d.group || '').toLowerCase().includes(query)
      );
    });
  }, [q, nodes]);

  useEffect(() => { setIdx(0); }, [q]);

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  /* Auto-pick first match on every query change so the user sees navigation immediately */
  useEffect(() => {
    if (matches.length && q.trim()) onPick?.(matches[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const step = (dir) => {
    if (!matches.length) return;
    const next = (idx + dir + matches.length) % matches.length;
    setIdx(next);
    onPick?.(matches[next]);
  };

  const onKey = (e) => {
    if (e.key === 'Escape') { onClose?.(); return; }
    if (e.key === 'Enter')  { e.shiftKey ? step(-1) : step(1); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); step(1); return; }
    if (e.key === 'ArrowUp')   { e.preventDefault(); step(-1); return; }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      style={{
        position: 'absolute',
        top: 70,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 35,
        width: 380,
        background: 'var(--bg-glass-strong)',
        backdropFilter: 'blur(32px) saturate(180%)',
        WebkitBackdropFilter: 'blur(32px) saturate(180%)',
        border: '1px solid var(--border-default)',
        borderRadius: 12,
        boxShadow: 'var(--shadow-float)',
        animation: 'fadeInDown 220ms cubic-bezier(0.34,1.56,0.64,1) forwards',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '9px 12px',
      }}>
        <Search size={13} color="var(--accent-blue)" />
        <input
          ref={inputRef}
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKey}
          placeholder="Search nodes (Enter ↵ next, ⇧↵ prev, Esc to close)"
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--text-primary)', fontSize: 12.5,
            fontFamily: 'inherit',
          }}
        />
        {q && (
          <span style={{
            fontSize: 10, fontWeight: 600,
            fontFamily: "'JetBrains Mono', monospace",
            padding: '2px 7px', borderRadius: 100,
            background: matches.length ? 'var(--accent-blue-soft)' : 'var(--accent-red-soft)',
            border: '1px solid',
            borderColor: matches.length ? 'var(--border-accent)' : 'rgba(245,101,101,0.3)',
            color: matches.length ? 'var(--accent-blue)' : 'var(--accent-red)',
          }}>
            {matches.length ? `${idx + 1}/${matches.length}` : '0'}
          </span>
        )}
        <IconBtn icon={ChevronUp}   onClick={() => step(-1)} disabled={!matches.length} tooltip="Previous (⇧↵)" />
        <IconBtn icon={ChevronDown} onClick={() => step(1)}  disabled={!matches.length} tooltip="Next (↵)" />
        <IconBtn icon={XIcon}       onClick={onClose} tooltip="Close (Esc)" />
      </div>

      {q && matches.length > 0 && (
        <div style={{
          maxHeight: 220, overflowY: 'auto',
          borderTop: '1px solid var(--border-subtle)',
          padding: '4px 0',
        }}>
          {matches.slice(0, 10).map((n, i) => {
            const active = i === idx;
            const k = n.data?.kind;
            const col = k === 'router' ? '#4F8EF7' : k === 'function' ? '#B06EF7'
                     : k === 'input' ? '#2ED8F0' : k === 'output' ? '#1AE0A0' : '#7C7F9A';
            return (
              <button
                key={n.id}
                onClick={() => { setIdx(i); onPick?.(n); }}
                style={{
                  width: '100%', textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '7px 12px',
                  background: active ? 'var(--accent-blue-soft)' : 'transparent',
                  border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'background var(--t-fast)',
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: col, boxShadow: `0 0 6px ${col}88`, flexShrink: 0,
                }} />
                <span style={{
                  flex: 1, minWidth: 0,
                  fontSize: 11.5, fontWeight: active ? 600 : 500,
                  color: 'var(--text-primary)',
                  fontFamily: "'JetBrains Mono', monospace",
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {n.data?.title || n.data?.label || n.id}
                </span>
                {n.data?.file && (
                  <span style={{
                    fontSize: 9.5, color: 'var(--text-muted)',
                    fontFamily: "'JetBrains Mono', monospace",
                    flexShrink: 0, maxWidth: 130,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {n.data.file.split('/').slice(-1)[0]}
                  </span>
                )}
              </button>
            );
          })}
          {matches.length > 10 && (
            <div style={{
              padding: '6px 12px',
              fontSize: 10, color: 'var(--text-muted)',
              fontFamily: "'JetBrains Mono', monospace",
              borderTop: '1px solid var(--border-subtle)',
            }}>
              +{matches.length - 10} more — refine your query
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function IconBtn({ icon: Icon, onClick, disabled, tooltip }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      data-tooltip={tooltip}
      style={{
        width: 24, height: 24, borderRadius: 6,
        background: 'transparent', border: '1px solid transparent',
        color: disabled ? 'var(--text-muted)' : 'var(--text-secondary)',
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all var(--t-fast)',
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.background = 'var(--bg-elevated)';
        e.currentTarget.style.borderColor = 'var(--border-default)';
        e.currentTarget.style.color = 'var(--text-primary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.borderColor = 'transparent';
        e.currentTarget.style.color = disabled ? 'var(--text-muted)' : 'var(--text-secondary)';
      }}
    >
      <Icon size={13} strokeWidth={1.9} />
    </button>
  );
}
