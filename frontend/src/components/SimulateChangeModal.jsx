import { useEffect, useRef, useState } from 'react';
import { X as XIcon, Zap, RefreshCw } from 'lucide-react';
import Logo from './Logo';

/**
 * "What if I change X?" - opens a small modal targeting the currently selected
 * function. Sends the change description + 1-hop call neighbourhood to Bob,
 * who returns the blast radius. Caller handles the wave animation; this
 * component is responsible only for the form + showing Bob's narrative reply.
 *
 * Props:
 *   isOpen
 *   onClose()                  - tear down the modal (also clears any sim state)
 *   node                       - the selected function node
 *   isRunning                  - true while the request is in flight
 *   result                     - { affectedLabels, explanation, riskDelta } or null
 *   onRun(description)         - fire the request
 */
export default function SimulateChangeModal({ isOpen, onClose, node, isRunning, result, onRun }) {
  const [description, setDescription] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
    setDescription('');
  }, [isOpen, node?.id]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const fnName = node?.data?.title || node?.data?.label || node?.id || 'function';
  const fnFile = node?.data?.file || '';
  const canRun = description.trim().length > 4 && !isRunning;

  const handleRun = () => {
    if (!canRun) return;
    onRun?.(description.trim());
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        animation: 'fadeIn 180ms ease forwards',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div style={{
        width: 560, maxWidth: 'calc(100vw - 32px)',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-strong)',
        borderRadius: 16,
        boxShadow: 'var(--shadow-xl)',
        overflow: 'hidden',
        animation: 'scaleIn 260ms cubic-bezier(0.34,1.56,0.64,1) forwards',
      }}>
        {/* Gradient top stripe to tie this modal to the Chat with Bob CTA */}
        <div style={{
          height: 3,
          background: 'linear-gradient(90deg, #4F8EF7, #7C7FF5, #B06EF7, #F56565)',
        }} />

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '16px 20px 14px',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #4F8EF7 0%, #B06EF7 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', flexShrink: 0,
          }}>
            <Logo size={18} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 8.5, fontWeight: 700, color: 'var(--accent-blue)',
              textTransform: 'uppercase', letterSpacing: '0.14em',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              Simulate Change
            </div>
            <div style={{
              fontSize: 14, fontWeight: 700, color: 'var(--text-primary)',
              marginTop: 2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {fnName}
            </div>
            {fnFile && (
              <div style={{
                fontSize: 10, color: 'var(--text-muted)', marginTop: 1,
                fontFamily: "'JetBrains Mono', monospace",
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {fnFile}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 30, height: 30, borderRadius: 7,
              background: 'transparent',
              border: '1px solid var(--border-default)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-elevated)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            <XIcon size={14} />
          </button>
        </div>

        {/* Form */}
        <div style={{ padding: '16px 20px' }}>
          <label
            htmlFor="sim-change-input"
            style={{
              display: 'block',
              fontSize: 11.5, fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: 6,
            }}
          >
            What are you changing?
          </label>
          <textarea
            id="sim-change-input"
            ref={inputRef}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleRun();
            }}
            disabled={isRunning}
            rows={3}
            placeholder='e.g. "Skip invoice generation for amounts under $5" or "Add rate limiting to this endpoint"'
            style={{
              width: '100%',
              padding: '10px 12px',
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
              WebkitTextFillColor: 'var(--text-primary)',
              border: '1px solid var(--border-default)',
              borderRadius: 8,
              fontSize: 12.5,
              fontFamily: "'JetBrains Mono', monospace",
              outline: 'none',
              resize: 'vertical',
              lineHeight: 1.5,
              transition: 'border-color var(--t-fast), box-shadow var(--t-fast)',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-blue)';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(79,142,247,0.14)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-default)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginTop: 6,
          }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              Bob will trace the blast radius across the call graph.
            </span>
            <span style={{
              fontSize: 9.5, color: 'var(--text-muted)',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              ⌘↵ to run
            </span>
          </div>
        </div>

        {/* Result panel - appears below the form when Bob replies */}
        {result && (
          <div style={{
            margin: '0 20px 16px',
            padding: '12px 14px',
            background: 'linear-gradient(135deg, rgba(176,110,247,0.08) 0%, rgba(245,101,101,0.06) 100%)',
            border: '1px solid rgba(176,110,247,0.32)',
            borderRadius: 10,
            animation: 'fadeIn 220ms ease forwards',
          }}>
            <div style={{
              fontSize: 8.5, fontWeight: 700, color: '#B06EF7',
              textTransform: 'uppercase', letterSpacing: '0.14em',
              fontFamily: "'JetBrains Mono', monospace",
              marginBottom: 6,
            }}>
              Bob's blast-radius analysis
            </div>
            <div style={{
              fontSize: 12.5, color: 'var(--text-primary)',
              lineHeight: 1.55,
            }}>
              {result.explanation}
            </div>
            {Array.isArray(result.affectedLabels) && result.affectedLabels.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{
                  fontSize: 9, fontWeight: 700, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                  marginBottom: 5,
                }}>
                  {result.affectedLabels.length} affected
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {result.affectedLabels.slice(0, 10).map((label) => (
                    <span key={label} style={{
                      fontSize: 10, fontWeight: 600,
                      padding: '2px 7px', borderRadius: 100,
                      background: 'rgba(245,101,101,0.12)',
                      border: '1px solid rgba(245,101,101,0.35)',
                      color: '#F56565',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}>
                      {label}
                    </span>
                  ))}
                  {result.affectedLabels.length > 10 && (
                    <span style={{
                      fontSize: 10, color: 'var(--text-muted)',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}>
                      +{result.affectedLabels.length - 10} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer actions */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          padding: '12px 20px 16px',
          borderTop: '1px solid var(--border-subtle)',
        }}>
          <button
            onClick={onClose}
            disabled={isRunning}
            style={{
              height: 34, padding: '0 16px', borderRadius: 8,
              background: 'transparent',
              border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)',
              fontSize: 12, fontWeight: 600,
              cursor: isRunning ? 'not-allowed' : 'pointer',
              opacity: isRunning ? 0.5 : 1,
              fontFamily: 'inherit',
              transition: 'all var(--t-fast)',
            }}
            onMouseEnter={(e) => {
              if (isRunning) return;
              e.currentTarget.style.background = 'var(--bg-elevated)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              if (isRunning) return;
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            {result ? 'Close' : 'Cancel'}
          </button>
          <button
            onClick={handleRun}
            disabled={!canRun}
            style={{
              height: 34, padding: '0 18px', borderRadius: 8,
              background: canRun
                ? 'linear-gradient(135deg, #4F8EF7 0%, #B06EF7 100%)'
                : 'var(--bg-elevated)',
              color: canRun ? '#fff' : 'var(--text-muted)',
              border: 'none',
              fontSize: 12, fontWeight: 700,
              cursor: canRun ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', gap: 7,
              fontFamily: 'inherit',
              boxShadow: canRun
                ? '0 4px 18px rgba(124,127,245,0.45), inset 0 1px 0 rgba(255,255,255,0.12)'
                : 'none',
              transition: 'all var(--t-fast)',
            }}
          >
            {isRunning
              ? <><RefreshCw size={12} className="animate-spin" /> Bob analysing…</>
              : <><Zap size={12} strokeWidth={2.4} /> Run Simulation</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
