import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Save, AlertCircle, FileCode, Zap, Wand2, RefreshCw, Check } from 'lucide-react';
import { computeLineDiff, diffStats } from '../lib/lineDiff';

export default function CodeSidebar({
  selectedTitle,
  filePath,
  functionCode,
  onFunctionCodeChange,
  onSaveFunction,
  onSimulateChange,
  onRefactorRequest,   // async (goal) => { code, explanation } - calls Bob
  onApplyRefactor,     // (newCode) => void - swap into the editor + save
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

  /* Refactor flow state - all local to this drawer.
       phase: 'idle' | 'prompt' | 'running' | 'review'
       goal:           the user's refactor instruction
       proposed:       the code Bob proposed (kept separate from the live
                       editor value so the user can discard cleanly)
       explanation:    Bob's accompanying note about what changed
       error:          most recent failure message */
  const [phase, setPhase] = useState('idle');
  const [goal, setGoal] = useState('');
  const [proposed, setProposed] = useState('');
  const [explanation, setExplanation] = useState('');
  const [error, setError] = useState('');
  const goalInputRef = useRef(null);

  /* Reset every time the user switches function. Stops a stale refactor
     from one function bleeding visually into another. */
  useEffect(() => {
    setPhase('idle');
    setGoal('');
    setProposed('');
    setExplanation('');
    setError('');
  }, [filePath, selectedTitle]);

  useEffect(() => {
    if (phase === 'prompt') {
      const t = setTimeout(() => goalInputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [phase]);

  const diff = useMemo(() => {
    if (phase !== 'review') return null;
    return computeLineDiff(functionCode, proposed);
  }, [phase, functionCode, proposed]);
  const stats = diff ? diffStats(diff) : null;

  const handleRunRefactor = async () => {
    if (!goal.trim() || !onRefactorRequest) return;
    setPhase('running');
    setError('');
    try {
      const result = await onRefactorRequest(goal.trim());
      const code = result?.code || '';
      if (!code.trim()) {
        setError('Bob returned no code. Try a more specific goal.');
        setPhase('prompt');
        return;
      }
      setProposed(code);
      setExplanation(result?.explanation || '');
      setPhase('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refactor failed.');
      setPhase('prompt');
    }
  };

  const handleAcceptRefactor = () => {
    if (!proposed) return;
    if (onApplyRefactor) onApplyRefactor(proposed);
    else if (onFunctionCodeChange) onFunctionCodeChange(proposed);
    setPhase('idle');
    setGoal('');
    setProposed('');
    setExplanation('');
  };

  const handleDiscardRefactor = () => {
    setPhase('idle');
    setGoal('');
    setProposed('');
    setExplanation('');
    setError('');
  };

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
          {/* Refactor with Bob - opens an inline prompt above the editor.
              Available in BOTH local and github-URL modes - the refactor
              call is pure-LLM and never writes to disk by itself. Only the
              final "Apply changes" step is gated on canEdit (so on a github
              clone the user can preview Bob's suggestions but can't write
              them back). Disabled only while a previous proposal is in
              review or running. */}
          {isFunctionNode && onRefactorRequest && (
            <button
              type="button"
              onClick={() => setPhase((p) => p === 'idle' ? 'prompt' : p)}
              disabled={phase === 'review' || phase === 'running'}
              title={canEdit
                ? 'Ask IBM Bob to improve this function'
                : 'Preview Bob\'s suggested changes (read-only workspace)'}
              style={{
                height: 26, padding: '0 10px',
                borderRadius: 5,
                background: (phase === 'review' || phase === 'running')
                  ? 'var(--bg-elevated)'
                  : 'linear-gradient(135deg, #B06EF7 0%, #4F8EF7 100%)',
                border: 'none',
                color: (phase === 'review' || phase === 'running') ? 'var(--text-muted)' : '#fff',
                fontSize: 11, fontWeight: 700,
                cursor: (phase === 'review' || phase === 'running') ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
                transition: 'all var(--transition-fast)',
                fontFamily: 'inherit',
                boxShadow: (phase === 'review' || phase === 'running')
                  ? 'none'
                  : '0 2px 10px rgba(176,110,247,0.4), inset 0 1px 0 rgba(255,255,255,0.14)',
                letterSpacing: '0.01em',
              }}
            >
              <Wand2 size={10} strokeWidth={2.4} />
              Refactor
            </button>
          )}

          {/* Simulate Change - always available for function nodes. Best results
              after Ask Bob AI has enriched the graph (more context for Bob). */}
          {isFunctionNode && onSimulateChange && (
            <button
              type="button"
              onClick={onSimulateChange}
              title="Predict the blast radius of a planned change with IBM Bob"
              style={{
                height: 26, padding: '0 10px',
                borderRadius: 5,
                background: 'linear-gradient(135deg, #4F8EF7 0%, #2ED8F0 100%)',
                border: 'none',
                color: '#fff',
                fontSize: 11, fontWeight: 700,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
                transition: 'all var(--transition-fast)',
                fontFamily: 'inherit',
                boxShadow: '0 2px 10px rgba(79,142,247,0.4), inset 0 1px 0 rgba(255,255,255,0.14)',
                letterSpacing: '0.01em',
              }}
            >
              <Zap size={10} strokeWidth={2.4} />
              Simulate
            </button>
          )}

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

      {/* ── Refactor prompt strip (above the editor) ── */}
      {(phase === 'prompt' || phase === 'running') && (
        <div style={{
          padding: '10px 14px',
          background: 'linear-gradient(135deg, rgba(176,110,247,0.08) 0%, rgba(79,142,247,0.05) 100%)',
          borderBottom: '1px solid rgba(176,110,247,0.25)',
          flexShrink: 0,
          animation: 'fadeIn 180ms ease forwards',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6,
          }}>
            <Wand2 size={11} color="#B06EF7" strokeWidth={2.4} />
            <span style={{
              fontSize: 9, fontWeight: 700, color: '#B06EF7',
              textTransform: 'uppercase', letterSpacing: '0.12em',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              Refactor with Bob
            </span>
            <span style={{ flex: 1 }} />
            <button
              onClick={handleDiscardRefactor}
              disabled={phase === 'running'}
              style={{
                background: 'transparent', border: 'none',
                color: 'var(--text-muted)',
                fontSize: 10, cursor: phase === 'running' ? 'not-allowed' : 'pointer',
                opacity: phase === 'running' ? 0.4 : 1,
                padding: 0, fontFamily: 'inherit',
              }}
            >
              cancel
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              ref={goalInputRef}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && goal.trim()) handleRunRefactor(); }}
              disabled={phase === 'running'}
              placeholder='e.g. "Add input validation" or "Split into smaller functions"'
              style={{
                flex: 1, height: 30, padding: '0 10px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-default)',
                borderRadius: 6,
                color: 'var(--text-primary)',
                WebkitTextFillColor: 'var(--text-primary)',
                fontSize: 11.5,
                fontFamily: "'JetBrains Mono', monospace",
                outline: 'none',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#B06EF7'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
            />
            <button
              onClick={handleRunRefactor}
              disabled={!goal.trim() || phase === 'running'}
              style={{
                height: 30, padding: '0 14px',
                borderRadius: 6,
                background: (!goal.trim() || phase === 'running')
                  ? 'var(--bg-elevated)'
                  : 'linear-gradient(135deg, #B06EF7 0%, #4F8EF7 100%)',
                color: (!goal.trim() || phase === 'running') ? 'var(--text-muted)' : '#fff',
                border: 'none',
                fontSize: 11, fontWeight: 700,
                cursor: (!goal.trim() || phase === 'running') ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
              }}
            >
              {phase === 'running'
                ? <><RefreshCw size={11} className="animate-spin" /> Bob writing…</>
                : <><Wand2 size={11} strokeWidth={2.4} /> Run</>
              }
            </button>
          </div>
          {error && (
            <div style={{
              marginTop: 6, fontSize: 10.5, color: '#F56565',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {error}
            </div>
          )}
        </div>
      )}

      {/* ── Editor area ── */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {phase === 'review' && diff ? (
          /* PR-style line-by-line diff. Replaces the editor while a proposed
             change is under review. The user picks Apply or Discard below. */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-base)' }}>
            {explanation && (
              <div style={{
                padding: '10px 14px',
                background: 'linear-gradient(135deg, rgba(176,110,247,0.08) 0%, rgba(79,142,247,0.05) 100%)',
                borderBottom: '1px solid rgba(176,110,247,0.25)',
                fontSize: 11.5, color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}>
                <span style={{
                  display: 'inline-block',
                  fontSize: 8.5, fontWeight: 700, color: '#B06EF7',
                  textTransform: 'uppercase', letterSpacing: '0.12em',
                  fontFamily: "'JetBrains Mono', monospace",
                  marginRight: 8,
                }}>
                  Bob:
                </span>
                {explanation}
              </div>
            )}
            <DiffPane diff={diff} />
          </div>
        ) : isFunctionNode && hasCode ? (
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

      {/* ── Review footer (Apply / Discard) ──
           In github-URL (read-only) mode the diff is preview-only: Apply is
           disabled and we show an inline note explaining why. The user can
           still inspect the diff and use Discard to clear it. */}
      {phase === 'review' && diff && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px',
          background: 'var(--bg-card)',
          borderTop: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: 10.5, fontFamily: "'JetBrains Mono', monospace",
          }}>
            <span style={{ color: '#1AE0A0', fontWeight: 700 }}>+{stats.added}</span>
            {'  '}
            <span style={{ color: '#F56565', fontWeight: 700 }}>-{stats.removed}</span>
          </span>
          {!canEdit && (
            <span style={{
              fontSize: 10, color: 'var(--text-muted)',
              fontStyle: 'italic',
              fontFamily: 'inherit',
            }}>
              Preview only - this workspace is read-only.
            </span>
          )}
          <span style={{ flex: 1 }} />
          <button
            onClick={handleDiscardRefactor}
            style={{
              height: 28, padding: '0 12px',
              borderRadius: 6,
              background: 'transparent',
              border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)',
              fontSize: 11, fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            {canEdit ? 'Discard' : 'Close preview'}
          </button>
          <button
            onClick={handleAcceptRefactor}
            disabled={!canEdit}
            title={!canEdit ? 'Apply not available for GitHub URLs - load a local path to write changes' : 'Save the refactored code to disk'}
            style={{
              height: 28, padding: '0 14px',
              borderRadius: 6,
              background: canEdit
                ? 'linear-gradient(135deg, #1AE0A0 0%, #2ED8F0 100%)'
                : 'var(--bg-elevated)',
              border: canEdit ? 'none' : '1px solid var(--border-subtle)',
              color: canEdit ? '#0a0a12' : 'var(--text-muted)',
              fontSize: 11, fontWeight: 700,
              cursor: canEdit ? 'pointer' : 'not-allowed',
              opacity: canEdit ? 1 : 0.5,
              display: 'flex', alignItems: 'center', gap: 5,
              fontFamily: 'inherit',
              boxShadow: canEdit ? '0 2px 10px rgba(26,224,160,0.35), inset 0 1px 0 rgba(255,255,255,0.18)' : 'none',
            }}
          >
            <Check size={11} strokeWidth={2.6} />
            Apply changes
          </button>
        </div>
      )}

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

/* ── Diff renderer - GitHub-PR-style unified diff ── */
function DiffPane({ diff }) {
  /* Color palette tuned for both themes; rely on inline rgba so we don't have to
     add CSS variables. Background tints stay subtle so syntax stays readable. */
  const colorFor = (type) => {
    if (type === 'add')    return { bg: 'rgba(26,224,160,0.10)',  marker: '#1AE0A0', text: 'var(--text-primary)' };
    if (type === 'remove') return { bg: 'rgba(245,101,101,0.10)', marker: '#F56565', text: 'var(--text-primary)' };
    return                       { bg: 'transparent',             marker: 'var(--text-muted)', text: 'var(--text-secondary)' };
  };

  return (
    <div style={{
      flex: 1, overflowY: 'auto',
      fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
      fontSize: 12, lineHeight: '20px',
    }}>
      {diff.map((row, idx) => {
        const c = colorFor(row.type);
        const marker = row.type === 'add' ? '+' : row.type === 'remove' ? '-' : ' ';
        return (
          <div
            key={idx}
            style={{
              display: 'flex', alignItems: 'stretch',
              background: c.bg,
              minHeight: 20,
            }}
          >
            <div style={{
              width: 36, flexShrink: 0,
              textAlign: 'right',
              padding: '0 6px 0 0',
              color: 'var(--text-muted)',
              background: row.type === 'equal' ? 'var(--bg-card)' : 'transparent',
              borderRight: '1px solid var(--border-subtle)',
              userSelect: 'none',
              fontSize: 10.5,
            }}>
              {row.oldNo ?? ''}
            </div>
            <div style={{
              width: 36, flexShrink: 0,
              textAlign: 'right',
              padding: '0 6px 0 0',
              color: 'var(--text-muted)',
              background: row.type === 'equal' ? 'var(--bg-card)' : 'transparent',
              borderRight: '1px solid var(--border-subtle)',
              userSelect: 'none',
              fontSize: 10.5,
            }}>
              {row.newNo ?? ''}
            </div>
            <div style={{
              width: 18, flexShrink: 0,
              textAlign: 'center',
              color: c.marker,
              fontWeight: 700,
              userSelect: 'none',
            }}>
              {marker}
            </div>
            <pre style={{
              flex: 1, margin: 0,
              padding: '0 10px',
              color: c.text,
              whiteSpace: 'pre',
              overflowX: 'auto',
            }}>
              {row.text || ' '}
            </pre>
          </div>
        );
      })}
    </div>
  );
}
