import { X, Save, AlertCircle, FileCode } from 'lucide-react';

export default function CodeSidebar({
  selectedTitle,
  filePath,
  functionCode,
  onFunctionCodeChange,
  onSaveFunction,
  onClose,
  isSaving,
  isFunctionNode,
  syntaxErrors,
  canEdit = true,
}) {
  const hasCode   = Boolean(functionCode);
  const lineCount = hasCode ? functionCode.split('\n').length : 0;
  const lineNums  = Array.from({ length: lineCount }, (_, i) => i + 1);
  const saveDisabled = !isFunctionNode || isSaving || !canEdit;

  const displayName = filePath
    ? filePath.split('/').pop()
    : selectedTitle || 'function';

  return (
    <aside style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg-surface)',
      borderLeft: '1px solid var(--border-subtle)',
      overflow: 'hidden',
    }}>

      {/* ── Header ── */}
      <div style={{
        height: 44,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 14px 0 16px',
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border-subtle)',
        flexShrink: 0,
        gap: 8,
      }}>
        {/* File tab */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <FileCode size={13} color={isFunctionNode ? 'var(--accent-blue)' : 'var(--text-muted)'} />
          <span style={{
            fontSize: 12, fontWeight: 500,
            fontFamily: "'JetBrains Mono', monospace",
            color: isFunctionNode ? 'var(--text-primary)' : 'var(--text-muted)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {displayName}
          </span>
          {hasCode && isFunctionNode && canEdit && (
            <span style={{
              width: 5, height: 5, borderRadius: '50%',
              background: 'var(--accent-amber)',
              flexShrink: 0,
            }} />
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button
            type="button"
            onClick={onSaveFunction}
            disabled={saveDisabled}
            style={{
              height: 26, padding: '0 10px',
              borderRadius: 5,
              background: saveDisabled ? 'transparent' : 'var(--accent-blue)',
              border: '1px solid',
              borderColor: saveDisabled ? 'var(--border-subtle)' : 'var(--accent-blue)',
              color: saveDisabled ? 'var(--text-muted)' : '#fff',
              fontSize: 11, fontWeight: 600,
              cursor: saveDisabled ? 'not-allowed' : 'pointer',
              opacity: saveDisabled ? 0.4 : 1,
              display: 'flex', alignItems: 'center', gap: 5,
              transition: 'all var(--transition-fast)',
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => { if (!saveDisabled) e.currentTarget.style.background = 'var(--accent-blue-hover)'; }}
            onMouseLeave={(e) => { if (!saveDisabled) e.currentTarget.style.background = 'var(--accent-blue)'; }}
          >
            <Save size={10} />
            {isSaving ? 'Saving…' : 'Save'}
          </button>

          {onClose && (
            <button
              onClick={onClose}
              style={{
                width: 26, height: 26,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'transparent',
                border: '1px solid transparent',
                borderRadius: 5,
                color: 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* ── Path breadcrumb ── */}
      {filePath && (
        <div style={{
          padding: '5px 16px',
          background: 'var(--bg-base)',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: 10, color: 'var(--text-muted)',
            fontFamily: "'JetBrains Mono', monospace",
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            display: 'block',
          }}>
            {filePath}
          </span>
        </div>
      )}

      {/* ── Editor area ── */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {isFunctionNode && hasCode ? (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* Line numbers gutter */}
            <div style={{
              width: 44, flexShrink: 0,
              background: 'var(--bg-card)',
              borderRight: '1px solid var(--border-subtle)',
              paddingTop: 14, paddingBottom: 14,
              userSelect: 'none',
              overflowY: 'hidden',
            }}>
              {lineNums.map((n) => (
                <div key={n} style={{
                  height: 21,
                  display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                  paddingRight: 10,
                  fontSize: 11, color: 'var(--text-muted)',
                  fontFamily: "'JetBrains Mono', monospace",
                  lineHeight: 1,
                }}>
                  {n}
                </div>
              ))}
            </div>

            {/* Textarea */}
            <textarea
              value={functionCode}
              onChange={(e) => onFunctionCodeChange(e.target.value)}
              readOnly={!isFunctionNode || !canEdit}
              spellCheck={false}
              style={{
                flex: 1, resize: 'none',
                background: 'var(--bg-base)',
                color: 'var(--text-primary)',
                border: 'none', outline: 'none',
                padding: '14px 16px',
                fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                fontSize: 12.5, lineHeight: '21px',
                tabSize: 4,
                overflowY: 'auto',
                caretColor: 'var(--accent-blue)',
              }}
            />
          </div>
        ) : (
          /* Empty state */
          <div style={{
            flex: 1,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: 32, textAlign: 'center',
            background: 'var(--bg-base)',
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 11,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 14,
            }}>
              <FileCode size={20} color="var(--text-muted)" />
            </div>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 6px' }}>
              No function selected
            </p>
            <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: 0, lineHeight: 1.65, maxWidth: 200 }}>
              Click a <span style={{ color: 'var(--accent-blue)', fontWeight: 500 }}>function node</span> to view
              {canEdit ? ' and edit' : ''} its code
            </p>
          </div>
        )}
      </div>

      {/* ── Status bar ── */}
      <div style={{
        height: 26,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 14px',
        background: isFunctionNode ? 'var(--accent-blue)' : 'var(--bg-card)',
        borderTop: '1px solid var(--border-subtle)',
        flexShrink: 0,
        transition: 'background var(--transition-base)',
      }}>
        <span style={{
          fontSize: 10.5,
          fontFamily: "'JetBrains Mono', monospace",
          color: isFunctionNode ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)',
        }}>
          {!canEdit ? 'View Only' : isFunctionNode ? selectedTitle : 'Ready'}
        </span>
        <div style={{ display: 'flex', gap: 12 }}>
          {lineCount > 0 && (
            <span style={{
              fontSize: 10.5, fontFamily: "'JetBrains Mono', monospace",
              color: isFunctionNode ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)',
            }}>
              {lineCount}L
            </span>
          )}
          <span style={{
            fontSize: 10.5, fontFamily: "'JetBrains Mono', monospace",
            color: isFunctionNode ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)',
          }}>
            Python
          </span>
        </div>
      </div>

      {/* ── Syntax errors ── */}
      {syntaxErrors?.length > 0 && (
        <div className="animate-fade-in" style={{
          borderTop: '1px solid rgba(239,68,68,0.2)',
          background: 'rgba(239,68,68,0.06)',
          padding: '8px 14px', flexShrink: 0,
          maxHeight: 88, overflowY: 'auto',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 10.5, fontWeight: 600, color: '#EF4444', marginBottom: 4,
          }}>
            <AlertCircle size={11} />
            {syntaxErrors.length} syntax error{syntaxErrors.length > 1 ? 's' : ''}
          </div>
          {syntaxErrors.map((e, i) => (
            <div key={`${e.file}-${e.line}-${i}`} style={{
              fontSize: 10.5, color: '#FCA5A5',
              fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.55,
            }}>
              {e.file}:{e.line}:{e.column}: {e.message}
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
