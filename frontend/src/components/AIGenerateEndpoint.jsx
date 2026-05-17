import { useEffect, useState, useRef } from 'react';
import { requestEndpointGeneration } from '../lib/apiClient';

const HTTP_METHODS = {
  GET:    { color: '#1AE0A0', soft: 'rgba(26,224,160,0.12)',  border: 'rgba(26,224,160,0.28)', glow: 'rgba(26,224,160,0.35)'  },
  POST:   { color: '#4F8EF7', soft: 'rgba(79,142,247,0.12)',  border: 'rgba(79,142,247,0.28)', glow: 'rgba(79,142,247,0.35)'  },
  PUT:    { color: '#F7B955', soft: 'rgba(247,185,85,0.12)',  border: 'rgba(247,185,85,0.28)',  glow: 'rgba(247,185,85,0.35)'  },
  DELETE: { color: '#F56565', soft: 'rgba(245,101,101,0.12)', border: 'rgba(245,101,101,0.28)', glow: 'rgba(245,101,101,0.35)' },
  PATCH:  { color: '#B06EF7', soft: 'rgba(176,110,247,0.12)', border: 'rgba(176,110,247,0.28)', glow: 'rgba(176,110,247,0.35)' },
};

export default function AIGenerateEndpoint({ isOpen, onClose, onGenerated, defaultTargetFile, selectedModelId }) {
  const [method, setMethod] = useState('GET');
  const [path, setPath] = useState('/api/v1/');
  const [description, setDescription] = useState('');
  const [targetFile, setTargetFile] = useState(defaultTargetFile || 'backend/main.py');
  const [includeTests, setIncludeTests] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const descRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setTargetFile(defaultTargetFile || 'backend/main.py');
  }, [isOpen, defaultTargetFile]);

  const generateEndpoint = async () => {
    if (!path.trim() || !description.trim()) return;
    setIsGenerating(true);
    setResult(null);
    try {
      const data = await requestEndpointGeneration({
        method,
        path: path.trim(),
        description: description.trim(),
        target_file: targetFile.trim() || null,
        include_tests: includeTests,
        model_id: selectedModelId || undefined,
      });
      setResult(data);
      if (onGenerated) onGenerated(data);
    } catch (error) {
      setResult({ success: false, explanation: `Error: ${error.message}. Make sure the backend is running on port 5000.` });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    const text = result?.generated_functions?.length
      ? JSON.stringify(result.generated_functions, null, 2)
      : (result?.generated_code || '');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const resetForm = () => { setPath('/api/v1/'); setDescription(''); setResult(null); };

  if (!isOpen) return null;

  const ms = HTTP_METHODS[method];
  const canGenerate = !isGenerating && path.trim() && description.trim();

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="modal-panel"
        style={{ width: 920, maxWidth: '96vw', height: 680, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Animated gradient top strip */}
        <div style={{
          height: 3,
          background: `linear-gradient(90deg, ${ms.color} 0%, #4F8EF7 40%, #B06EF7 70%, ${ms.color} 100%)`,
          backgroundSize: '200% 100%',
          animation: 'gradientShift 3s ease-in-out infinite',
          flexShrink: 0,
        }} />

        {/* Header */}
        <div style={{
          padding: '14px 22px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: `radial-gradient(ellipse 60% 100% at 0% 50%, ${ms.soft} 0%, transparent 70%)`,
            pointerEvents: 'none',
            transition: 'background 400ms ease',
          }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 13, position: 'relative' }}>
            {/* Icon mark */}
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: `linear-gradient(135deg, ${ms.color}22 0%, ${ms.color}0a 100%)`,
              border: `1px solid ${ms.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              boxShadow: `0 0 18px ${ms.glow}`,
              transition: 'all 400ms ease',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ms.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
              </svg>
            </div>

            <div>
              <div style={{
                fontSize: 15, fontWeight: 700, color: 'var(--text-primary)',
                fontFamily: "'JetBrains Mono', monospace", letterSpacing: '-0.01em',
              }}>
                AI Endpoint Generator
              </div>
              <div style={{
                fontSize: 10, color: 'var(--text-muted)', marginTop: 2,
                textTransform: 'uppercase', letterSpacing: '0.1em',
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                Natural language → REST API
              </div>
            </div>
          </div>

          {/* Method pill in header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
            <div style={{
              padding: '4px 12px',
              borderRadius: 100,
              background: ms.soft,
              border: `1px solid ${ms.border}`,
              color: ms.color,
              fontSize: 11, fontWeight: 700,
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: '0.08em',
              boxShadow: `0 0 10px ${ms.glow}`,
              transition: 'all 400ms ease',
            }}>
              {method}
            </div>

            <button
              onClick={onClose}
              style={{
                width: 30, height: 30, borderRadius: 8,
                background: 'transparent', border: '1px solid var(--border-default)',
                color: 'var(--text-muted)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 160ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(245,101,101,0.1)';
                e.currentTarget.style.borderColor = 'rgba(245,101,101,0.4)';
                e.currentTarget.style.color = '#F56565';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = 'var(--border-default)';
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Left panel — form */}
          <div style={{
            width: '42%',
            padding: '20px 22px',
            overflowY: 'auto',
            borderRight: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}>

            {/* HTTP Method picker */}
            <div>
              <FieldLabel>HTTP Method</FieldLabel>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {Object.entries(HTTP_METHODS).map(([m, s]) => {
                  const active = method === m;
                  return (
                    <button
                      key={m}
                      onClick={() => setMethod(m)}
                      style={{
                        padding: '6px 13px',
                        borderRadius: 100,
                        border: `1px solid ${active ? s.color : s.border}`,
                        background: active ? `linear-gradient(135deg, ${s.color}22 0%, ${s.color}0f 100%)` : 'transparent',
                        color: active ? s.color : 'var(--text-muted)',
                        fontSize: 10.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 200ms ease',
                        fontFamily: "'JetBrains Mono', monospace",
                        letterSpacing: '0.08em',
                        boxShadow: active ? `0 0 14px ${s.glow}, inset 0 1px 0 rgba(255,255,255,0.06)` : 'none',
                      }}
                      onMouseEnter={(e) => {
                        if (!active) {
                          e.currentTarget.style.background = s.soft;
                          e.currentTarget.style.color = s.color;
                          e.currentTarget.style.borderColor = s.border;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!active) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = 'var(--text-muted)';
                          e.currentTarget.style.borderColor = s.border;
                        }
                      }}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Path */}
            <div>
              <FieldLabel>Endpoint Path</FieldLabel>
              <div style={{
                display: 'flex', alignItems: 'stretch',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                transition: 'border-color 160ms ease, box-shadow 160ms ease',
              }}
                onFocus={() => {}}
                ref={(el) => {
                  if (el) {
                    el._focus = () => { el.style.borderColor = ms.color; el.style.boxShadow = `0 0 0 3px ${ms.glow}`; };
                    el._blur = () => { el.style.borderColor = 'var(--border-default)'; el.style.boxShadow = 'none'; };
                  }
                }}
              >
                <div style={{
                  padding: '0 12px',
                  display: 'flex', alignItems: 'center',
                  background: ms.soft,
                  borderRight: `1px solid ${ms.border}`,
                  color: ms.color,
                  fontSize: 10, fontWeight: 700,
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: '0.08em',
                  flexShrink: 0,
                  transition: 'all 400ms ease',
                }}>
                  {method}
                </div>
                <input
                  type="text"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder="/api/v1/users"
                  style={{
                    flex: 1, height: 38,
                    background: 'transparent',
                    border: 'none', outline: 'none',
                    color: 'var(--text-primary)',
                    fontSize: 13, padding: '0 12px',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                  onFocus={(e) => {
                    const p = e.target.closest('[ref]') || e.target.parentElement;
                    p.style.borderColor = ms.color;
                    p.style.boxShadow = `0 0 0 3px ${ms.glow}`;
                  }}
                  onBlur={(e) => {
                    const p = e.target.parentElement;
                    p.style.borderColor = 'var(--border-default)';
                    p.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <FieldLabel>
                Description
                <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>natural language</span>
              </FieldLabel>
              <div style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                transition: 'border-color 160ms ease, box-shadow 160ms ease',
              }}
                ref={descRef}
              >
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this endpoint should do — inputs, outputs, validation, error cases, business logic…"
                  rows={6}
                  style={{
                    width: '100%', resize: 'none',
                    background: 'transparent', color: 'var(--text-primary)',
                    border: 'none', outline: 'none',
                    padding: '10px 12px', fontSize: 13, lineHeight: 1.6,
                    fontFamily: 'inherit', boxSizing: 'border-box',
                  }}
                  onFocus={(e) => {
                    descRef.current.style.borderColor = '#4F8EF7';
                    descRef.current.style.boxShadow = '0 0 0 3px rgba(79,142,247,0.18)';
                  }}
                  onBlur={() => {
                    descRef.current.style.borderColor = 'var(--border-default)';
                    descRef.current.style.boxShadow = 'none';
                  }}
                />
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 5, fontFamily: "'JetBrains Mono', monospace" }}>
                Be specific about inputs, outputs, and error cases
              </div>
            </div>

            {/* Target file */}
            <div>
              <FieldLabel>Target File</FieldLabel>
              <GlowInput
                value={targetFile}
                onChange={(e) => setTargetFile(e.target.value)}
                placeholder="backend/main.py"
                mono
              />
            </div>

            {/* Options */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 13px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
            }}
              onClick={() => setIncludeTests((v) => !v)}
            >
              <div style={{
                width: 17, height: 17, borderRadius: 5,
                border: `1.5px solid ${includeTests ? '#4F8EF7' : 'var(--border-strong)'}`,
                background: includeTests ? 'rgba(79,142,247,0.18)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                transition: 'all 160ms ease',
                boxShadow: includeTests ? '0 0 8px rgba(79,142,247,0.3)' : 'none',
              }}>
                {includeTests && (
                  <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="#4F8EF7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="2,6 5,9 10,3"/>
                  </svg>
                )}
              </div>
              <div>
                <div style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 500 }}>Generate unit tests</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>Scaffold test suite alongside endpoint</div>
              </div>
            </div>

            {/* Generate button */}
            <button
              onClick={generateEndpoint}
              disabled={!canGenerate}
              style={{
                width: '100%', height: 44,
                borderRadius: 'var(--radius-md)',
                background: canGenerate
                  ? `linear-gradient(135deg, ${ms.color} 0%, ${ms.color}cc 100%)`
                  : 'var(--bg-elevated)',
                border: canGenerate ? `1px solid ${ms.color}88` : '1px solid var(--border-subtle)',
                color: canGenerate ? '#0a0a12' : 'var(--text-muted)',
                fontSize: 13, fontWeight: 700,
                cursor: canGenerate ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: '0.04em',
                boxShadow: canGenerate ? `0 4px 20px ${ms.glow}, inset 0 1px 0 rgba(255,255,255,0.2)` : 'none',
                transition: 'all 200ms ease',
              }}
              onMouseEnter={(e) => {
                if (canGenerate) {
                  e.currentTarget.style.boxShadow = `0 6px 28px ${ms.glow}, inset 0 1px 0 rgba(255,255,255,0.25)`;
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (canGenerate) {
                  e.currentTarget.style.boxShadow = `0 4px 20px ${ms.glow}, inset 0 1px 0 rgba(255,255,255,0.2)`;
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
            >
              {isGenerating ? (
                <>
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M21 12a9 9 0 11-6.219-8.56"/>
                  </svg>
                  Generating…
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2"/>
                  </svg>
                  Generate Endpoint
                </>
              )}
            </button>
          </div>

          {/* Right panel — result / empty state */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
            {result ? (
              <ResultPanel result={result} onCopy={handleCopy} copied={copied} onReset={resetForm} onClose={onClose} />
            ) : (
              <EmptyState isGenerating={isGenerating} method={method} ms={ms} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Empty / Loading state ── */
function EmptyState({ isGenerating, method, ms }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 40, textAlign: 'center',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Subtle background radial */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse 70% 60% at 50% 55%, ${ms.soft} 0%, transparent 70%)`,
        pointerEvents: 'none',
        transition: 'background 500ms ease',
      }} />

      {/* Icon ring */}
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        border: `1.5px solid ${ms.border}`,
        background: `radial-gradient(circle, ${ms.soft} 0%, transparent 70%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 20, position: 'relative',
        boxShadow: `0 0 30px ${ms.glow}`,
        animation: 'float 4s ease-in-out infinite',
        transition: 'all 500ms ease',
      }}>
        {isGenerating ? (
          <svg className="animate-spin" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={ms.color} strokeWidth="1.8" strokeLinecap="round">
            <path d="M21 12a9 9 0 11-6.219-8.56"/>
          </svg>
        ) : (
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={ms.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2"/>
          </svg>
        )}

        {/* Orbit dot */}
        <div style={{
          position: 'absolute', width: 8, height: 8, borderRadius: '50%',
          background: ms.color, top: -4, right: 12,
          boxShadow: `0 0 8px ${ms.glow}`,
          animation: 'float 3s ease-in-out infinite reverse',
        }} />
      </div>

      <div style={{
        fontSize: 14.5, fontWeight: 700,
        color: 'var(--text-primary)',
        fontFamily: "'JetBrains Mono', monospace",
        marginBottom: 8,
        letterSpacing: '-0.01em',
      }}>
        {isGenerating ? 'Generating endpoint…' : 'Ready to generate'}
      </div>
      <div style={{
        fontSize: 12, color: 'var(--text-muted)',
        lineHeight: 1.7, maxWidth: 220,
      }}>
        {isGenerating
          ? 'IBM Bob is crafting your endpoint. This usually takes a few seconds.'
          : <>Fill in the form and click{' '}<span style={{ color: ms.color, fontWeight: 600 }}>Generate Endpoint</span>{' '}to create your API.</>
        }
      </div>

      {/* Method indicator row */}
      <div style={{
        display: 'flex', gap: 6, marginTop: 28,
        opacity: 0.45,
      }}>
        {Object.entries(HTTP_METHODS).map(([m, s]) => (
          <div key={m} style={{
            width: 6, height: 6, borderRadius: '50%',
            background: m === 'GET' ? '#1AE0A0' : m === 'POST' ? '#4F8EF7' : m === 'PUT' ? '#F7B955' : m === 'DELETE' ? '#F56565' : '#B06EF7',
            opacity: method === m ? 1 : 0.3,
            transition: 'opacity 300ms ease',
          }} />
        ))}
      </div>
    </div>
  );
}

/* ── Result panel ── */
function ResultPanel({ result, onCopy, copied, onReset, onClose }) {
  const successColor = '#1AE0A0';
  const errorColor = '#F56565';
  const accent = result.success ? successColor : errorColor;

  return (
    <div className="animate-fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Result header */}
      <div style={{
        padding: '12px 20px',
        borderBottom: '1px solid var(--border-subtle)',
        background: result.success ? 'rgba(26,224,160,0.05)' : 'rgba(245,101,101,0.05)',
        flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: result.success ? 'rgba(26,224,160,0.12)' : 'rgba(245,101,101,0.12)',
            border: `1px solid ${accent}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {result.success ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20,6 9,17 4,12"/>
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            )}
          </div>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: accent, fontFamily: "'JetBrains Mono', monospace" }}>
              {result.success ? 'Generated Successfully' : 'Generation Failed'}
            </div>
            {result.file_path && (
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                {result.file_path}
              </div>
            )}
          </div>
        </div>

        {result.success && (
          <button
            onClick={onCopy}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 11px', borderRadius: 'var(--radius-sm)',
              background: copied ? 'rgba(26,224,160,0.12)' : 'var(--bg-elevated)',
              border: `1px solid ${copied ? 'rgba(26,224,160,0.3)' : 'var(--border-default)'}`,
              color: copied ? '#1AE0A0' : 'var(--text-secondary)',
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
              transition: 'all 200ms ease',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {copied ? (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20,6 9,17 4,12"/>
              </svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
              </svg>
            )}
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>

      {/* Result body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {result.explanation && (
          <div style={{
            padding: '11px 14px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
          }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, fontFamily: "'JetBrains Mono', monospace" }}>
              Explanation
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.65 }}>
              {result.explanation}
            </p>
          </div>
        )}

        {result.generated_code && (
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7, fontFamily: "'JetBrains Mono', monospace" }}>
              Generated Code
            </div>
            <div className="code-block" style={{
              maxHeight: 240, overflowY: 'auto', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}>
              <pre style={{ margin: 0 }}><code>{result.generated_code}</code></pre>
            </div>
          </div>
        )}

        {result.generated_functions?.length > 0 && (
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: '#B06EF7', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7, fontFamily: "'JetBrains Mono', monospace" }}>
              Structured Functions
            </div>
            <div className="code-block" style={{
              maxHeight: 200, overflowY: 'auto', borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(176,110,247,0.2)',
              background: 'rgba(176,110,247,0.04)',
            }}>
              <pre style={{ margin: 0 }}><code>{JSON.stringify(result.generated_functions, null, 2)}</code></pre>
            </div>
          </div>
        )}

        {result.suggestions?.length > 0 && (
          <div style={{
            padding: '11px 14px',
            background: 'rgba(46,216,240,0.05)',
            border: '1px solid rgba(46,216,240,0.15)',
            borderRadius: 'var(--radius-md)',
          }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: '#2ED8F0', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7, fontFamily: "'JetBrains Mono', monospace" }}>
              Suggestions
            </div>
            {result.suggestions.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                <span style={{ color: '#2ED8F0', flexShrink: 0 }}>›</span>
                <span>{s}</span>
              </div>
            ))}
          </div>
        )}

        {result.warnings?.length > 0 && (
          <div style={{
            padding: '11px 14px',
            background: 'rgba(247,185,85,0.06)',
            border: '1px solid rgba(247,185,85,0.18)',
            borderRadius: 'var(--radius-md)',
          }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: '#F7B955', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7, fontFamily: "'JetBrains Mono', monospace" }}>
              Warnings
            </div>
            {result.warnings.map((w, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#fbbf24', marginBottom: 4 }}>
                <span style={{ flexShrink: 0 }}>⚠</span>
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        {result.success && (
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              onClick={onReset}
              style={{
                flex: 1, height: 36, borderRadius: 'var(--radius-sm)',
                background: 'transparent', border: '1px solid var(--border-default)',
                color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace',",
                transition: 'all 160ms ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              Generate Another
            </button>
            <button
              onClick={onClose}
              style={{
                flex: 1, height: 36, borderRadius: 'var(--radius-sm)',
                background: 'linear-gradient(135deg, #1AE0A0 0%, #1AE0A0cc 100%)',
                border: '1px solid rgba(26,224,160,0.4)',
                color: '#0a0a12', fontSize: 12, fontWeight: 700,
                cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace",
                boxShadow: '0 4px 16px rgba(26,224,160,0.3)',
                transition: 'all 160ms ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 6px 22px rgba(26,224,160,0.42)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(26,224,160,0.3)'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Small helpers ── */
function FieldLabel({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700,
      color: 'var(--text-muted)',
      textTransform: 'uppercase', letterSpacing: '0.09em',
      marginBottom: 8,
      fontFamily: "'JetBrains Mono', monospace",
      display: 'flex', alignItems: 'center', gap: 0,
    }}>
      {children}
    </div>
  );
}

function GlowInput({ value, onChange, placeholder, mono }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type="text"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: '100%', height: 38,
        background: 'var(--bg-input)',
        border: `1px solid ${focused ? '#4F8EF7' : 'var(--border-default)'}`,
        borderRadius: 'var(--radius-md)',
        color: 'var(--text-primary)',
        fontSize: 12.5, padding: '0 12px', outline: 'none',
        fontFamily: mono ? "'JetBrains Mono', monospace" : 'inherit',
        boxShadow: focused ? '0 0 0 3px rgba(79,142,247,0.18)' : 'none',
        transition: 'border-color 160ms ease, box-shadow 160ms ease',
        boxSizing: 'border-box',
      }}
    />
  );
}
