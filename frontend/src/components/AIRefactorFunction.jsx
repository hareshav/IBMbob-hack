import { useState } from 'react';
import { requestFunctionRefactor } from '../lib/apiClient';

const REFACTOR_GOALS = [
  { value: 'optimize performance', label: 'Optimize Performance', icon: '⚡', color: '#f59e0b', description: 'Improve execution speed and reduce overhead' },
  { value: 'add error handling',   label: 'Add Error Handling',   icon: '🛡', color: '#ef4444', description: 'Enhance validation and exception handling' },
  { value: 'improve readability',  label: 'Improve Readability',  icon: '📖', color: '#22d3ee', description: 'Make code clearer and more maintainable' },
  { value: 'add type safety',      label: 'Add Type Safety',      icon: '🔷', color: '#0f62fe', description: 'Add comprehensive type annotations' },
  { value: 'enhance documentation',label: 'Enhance Docs',         icon: '📝', color: '#22c55e', description: 'Add docstrings and inline comments' },
];

export default function AIRefactorFunction({
  isOpen,
  onClose,
  selectedNode,
  onRefactored,
  onApplyRefactor,
  workspacePath,
  selectedModelId,
  availableModels,
  isLoadingModels,
  modelsSource,
  modelsError,
}) {
  const [refactorGoal, setRefactorGoal] = useState('');
  const [preserveSignature, setPreserveSignature] = useState(true);
  const [isRefactoring, setIsRefactoring] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [result, setResult] = useState(null);

  const functionId = selectedNode?.data?.function_id;
  const functionName = functionId?.split('::')[1] || 'Unknown';
  const currentCode = selectedNode?.data?.code || '';
  const modelReady = Boolean(selectedModelId);

  const refactorFunction = async () => {
    if (!functionId || !refactorGoal.trim() || !modelReady) return;
    setIsRefactoring(true);
    setResult(null);
    try {
      const data = await requestFunctionRefactor({
        function_id: functionId,
        refactor_goal: refactorGoal.trim(),
        preserve_signature: preserveSignature,
        model_id: selectedModelId || undefined,
        workspace_path: workspacePath || undefined,
      });
      setResult(data);
      if (onRefactored) await onRefactored(data);
    } catch (error) {
      const msg = error?.message || 'Refactoring failed';
      const hint = msg.includes('Failed to fetch') ? ' Make sure the backend is running on port 5000.' : '';
      setResult({ success: false, explanation: `Error: ${msg}.${hint}` });
    } finally {
      setIsRefactoring(false);
    }
  };

  const applyRefactoredChanges = async () => {
    if (!result?.generated_code || !onApplyRefactor) return;
    setIsApplying(true);
    try {
      await onApplyRefactor({ functionId, generatedCode: result.generated_code, modelId: selectedModelId, rawResult: result });
      onClose?.();
    } catch (error) {
      alert(`Failed to apply: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsApplying(false);
    }
  };

  if (!isOpen) return null;

  if (!functionId) {
    return (
      <div className="modal-overlay">
        <div className="modal-panel animate-scale-bounce" style={{ width: 420, padding: 32 }}>
          <div style={{ textAlign: 'center' }}>
            <div className="animate-float" style={{ fontSize: 52, marginBottom: 14 }}>🔧</div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>
              No Function Selected
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 22, lineHeight: 1.65 }}>
              Click a <strong style={{ color: 'var(--accent-indigo)' }}>function node</strong> on the canvas, then open Refactor Function.
            </p>
            <button onClick={onClose} className="btn-primary" style={{ width: '100%', height: 42 }}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-panel" style={{ width: 1000, height: 700, display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{
          padding: '15px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-card)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(168,85,247,0.06) 100%)',
            pointerEvents: 'none',
          }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
            <div style={{
              width: 42, height: 42, borderRadius: 14,
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, boxShadow: 'var(--shadow-glow-purple)', flexShrink: 0,
            }}>
              🔧
            </div>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: 1.2 }}>
                AI Function Refactoring
              </h2>
              <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                Refactoring:{' '}
                <span style={{ color: 'var(--accent-indigo)', fontWeight: 600 }}>{functionName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
              transition: 'all var(--transition-fast)', position: 'relative',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-red-soft)'; e.currentTarget.style.color = 'var(--accent-red)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Left panel: controls */}
          <div style={{
            width: 286,
            padding: '14px 14px',
            overflowY: 'auto',
            borderRight: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            flexShrink: 0,
          }}>

            {/* Function info card */}
            <div style={{
              padding: '10px 12px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                Selected Function
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{functionName}</div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'monospace', wordBreak: 'break-all', lineHeight: 1.4 }}>
                {functionId}
              </div>
            </div>

            {/* Model info card */}
            <div style={{
              padding: '10px 12px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                AI Model
              </div>
              <div style={{ fontSize: 11, color: selectedModelId ? 'var(--text-primary)' : 'var(--accent-amber)', wordBreak: 'break-all' }}>
                {selectedModelId || '⚠ No model selected'}
              </div>
              {modelsError && (
                <div style={{ fontSize: 9, color: 'var(--accent-amber)', marginTop: 3 }}>{modelsError}</div>
              )}
            </div>

            {/* Goal cards */}
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>
                Refactoring Goal
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {REFACTOR_GOALS.map((goal) => {
                  const active = refactorGoal === goal.value;
                  return (
                    <button
                      key={goal.value}
                      onClick={() => setRefactorGoal(goal.value)}
                      style={{
                        padding: '9px 11px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid',
                        borderColor: active ? goal.color : 'var(--border-subtle)',
                        background: active ? `${goal.color}18` : 'var(--bg-elevated)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all var(--transition-fast)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                        transform: active ? 'translateX(3px)' : 'none',
                      }}
                    >
                      <span style={{ fontSize: 15, flexShrink: 0, lineHeight: 1.3 }}>{goal.icon}</span>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: active ? goal.color : 'var(--text-primary)', lineHeight: 1.2 }}>
                          {goal.label}
                        </div>
                        <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>
                          {goal.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom goal */}
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
                Custom Goal
              </div>
              <textarea
                value={refactorGoal}
                onChange={(e) => setRefactorGoal(e.target.value)}
                placeholder="Describe what you want to improve…"
                rows={3}
                style={{
                  width: '100%', resize: 'none',
                  background: 'var(--bg-input)', color: 'var(--text-primary)',
                  border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
                  padding: '8px 10px', fontSize: 12, lineHeight: 1.55, outline: 'none',
                  fontFamily: 'inherit', transition: 'border-color var(--transition-fast)',
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--accent-blue)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border-default)'}
              />
            </div>

            {/* Preserve signature */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={preserveSignature}
                onChange={(e) => setPreserveSignature(e.target.checked)}
                style={{ width: 14, height: 14, accentColor: 'var(--accent-blue)' }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Preserve function signature</span>
            </label>

            {/* Refactor button */}
            <button
              onClick={refactorFunction}
              disabled={isRefactoring || !refactorGoal.trim() || !modelReady}
              className="btn-primary"
              style={{
                width: '100%', height: 40, fontSize: 13,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: (!refactorGoal.trim() || !modelReady) ? undefined
                  : 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              }}
            >
              {isRefactoring
                ? <><span className="animate-spin" style={{ fontSize: 14 }}>⟳</span> Refactoring…</>
                : <><span>🔧</span> Refactor Function</>
              }
            </button>
          </div>

          {/* Right panel: diff view */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
            {result ? (
              <div className="animate-fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                {/* Result bar */}
                <div style={{
                  padding: '9px 16px',
                  borderBottom: '1px solid var(--border-subtle)',
                  background: result.success ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexShrink: 0,
                }}>
                  <div>
                    <h3 style={{
                      fontSize: 13, fontWeight: 700, margin: 0,
                      color: result.success ? '#22c55e' : '#ef4444',
                    }}>
                      {result.success ? '✅ Refactored Successfully' : '❌ Refactoring Failed'}
                    </h3>
                    {result.explanation && (
                      <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '2px 0 0', lineHeight: 1.4 }}>
                        {result.explanation}
                      </p>
                    )}
                  </div>
                  {result.success && (
                    <button
                      onClick={() => navigator.clipboard.writeText(result.generated_code || '')}
                      className="btn-ghost"
                      style={{ height: 26, fontSize: 11 }}
                    >
                      📋 Copy
                    </button>
                  )}
                </div>

                {/* Side-by-side diff */}
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden' }}>

                  {/* Original */}
                  <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid var(--border-subtle)' }}>
                    <div style={{
                      padding: '7px 14px', fontSize: 9.5, fontWeight: 700,
                      color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em',
                      background: 'var(--bg-card)', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
                    }}>
                      ← Original
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', background: 'var(--bg-base)' }}>
                      <pre style={{ margin: 0, fontSize: 11, lineHeight: 1.65, color: 'var(--text-primary)', fontFamily: "'IBM Plex Mono','JetBrains Mono',monospace", whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        <code>{currentCode}</code>
                      </pre>
                    </div>
                  </div>

                  {/* Refactored */}
                  <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{
                      padding: '7px 14px', fontSize: 9.5, fontWeight: 700,
                      color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.06em',
                      background: 'var(--bg-card)', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
                    }}>
                      → Refactored
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', background: 'rgba(34,197,94,0.025)' }}>
                      <pre style={{ margin: 0, fontSize: 11, lineHeight: 1.65, color: 'var(--text-primary)', fontFamily: "'IBM Plex Mono','JetBrains Mono',monospace", whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        <code>{result.generated_code || ''}</code>
                      </pre>
                    </div>
                  </div>
                </div>

                {/* Action bar */}
                {result.success && (
                  <div style={{
                    padding: '10px 16px',
                    borderTop: '1px solid var(--border-subtle)',
                    display: 'flex', gap: 8, justifyContent: 'flex-end',
                    background: 'var(--bg-card)', flexShrink: 0,
                  }}>
                    <button onClick={() => setResult(null)} className="btn-ghost" style={{ height: 34, fontSize: 12 }}>
                      Try Different Goal
                    </button>
                    <button
                      onClick={applyRefactoredChanges}
                      disabled={isApplying}
                      className="btn-primary"
                      style={{
                        height: 34, fontSize: 12, display: 'flex', alignItems: 'center', gap: 5,
                        background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                      }}
                    >
                      {isApplying
                        ? <><span className="animate-spin" style={{ fontSize: 12 }}>⟳</span> Applying…</>
                        : '✓ Apply Changes'
                      }
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center' }}>
                <div className="animate-float" style={{ fontSize: 58, marginBottom: 18 }}>🔧</div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>
                  Ready to Refactor
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.65 }}>
                  Select a refactoring goal and click<br />
                  <strong style={{ color: 'var(--accent-indigo)' }}>Refactor Function</strong> to improve your code
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
