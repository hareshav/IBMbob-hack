import { useEffect, useRef, useState } from 'react';
import { requestChatCompletion } from '../lib/apiClient';

export default function AIChatbot({ isOpen, onClose, context, selectedModelId }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hi! Ask me anything about your workspace — API architecture, refactoring, endpoint design, and more.',
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const data = await requestChatCompletion({
        messages: [
          ...messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content: userMessage },
        ],
        context: context || {},
        model_id: selectedModelId || undefined,
      });
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.content || data.message || 'No response.',
          code_snippets: data.code_snippets || [],
          actions: data.actions || [],
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${error.message}. Make sure the backend is running on port 5000.`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div
        className="modal-panel"
        style={{ width: 680, height: 640, display: 'flex', flexDirection: 'column' }}
      >
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
          {/* Subtle gradient background */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(135deg, rgba(15,98,254,0.06) 0%, rgba(168,85,247,0.06) 100%)',
            pointerEvents: 'none',
          }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
            <div
              className="animate-float"
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                background: 'linear-gradient(135deg, #0f62fe 0%, #a855f7 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                boxShadow: 'var(--shadow-glow-blue)',
                flexShrink: 0,
              }}
            >
              🤖
            </div>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: 1.2 }}>
                Api-Architect Assistant
              </h2>
              <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '2px 0 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                AI-powered · IBM Granite
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              transition: 'all var(--transition-fast)',
              position: 'relative',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-red-soft)'; e.currentTarget.style.color = 'var(--accent-red)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}>
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className="animate-message-in"
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                gap: 8,
                alignItems: 'flex-start',
              }}
            >
              {msg.role === 'assistant' && (
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, #0f62fe, #a855f7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  flexShrink: 0,
                  marginTop: 2,
                }}>
                  🤖
                </div>
              )}

              <div style={{
                maxWidth: '76%',
                padding: '10px 14px',
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
                background: msg.role === 'user'
                  ? 'linear-gradient(135deg, #0f62fe 0%, #6366f1 100%)'
                  : 'var(--bg-elevated)',
                color: msg.role === 'user' ? '#ffffff' : 'var(--text-primary)',
                fontSize: 13,
                lineHeight: 1.65,
                border: msg.role === 'user' ? 'none' : '1px solid var(--border-subtle)',
                boxShadow: msg.role === 'user'
                  ? '0 4px 16px rgba(15,98,254,0.32)'
                  : 'var(--shadow-sm)',
              }}>
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.content}</div>

                {msg.code_snippets?.map((snippet, i) => (
                  <div key={i} className="code-block" style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 10, color: 'var(--accent-cyan)', marginBottom: 4, fontWeight: 600 }}>
                      {snippet.language}
                    </div>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      <code>{snippet.code}</code>
                    </pre>
                  </div>
                ))}

                {msg.actions?.length > 0 && (
                  <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {msg.actions.map((action, i) => (
                      <button
                        key={i}
                        className="btn-primary"
                        style={{ height: 26, fontSize: 11 }}
                        title={action.description}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {msg.role === 'user' && (
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  flexShrink: 0,
                  marginTop: 2,
                }}>
                  👤
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {isLoading && (
            <div className="animate-message-in" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'linear-gradient(135deg, #0f62fe, #a855f7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, flexShrink: 0,
              }}>
                🤖
              </div>
              <div style={{
                padding: '12px 16px',
                borderRadius: '4px 16px 16px 16px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                gap: 5,
                alignItems: 'center',
              }}>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="animate-dot-bounce"
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: 'var(--accent-blue)',
                      animationDelay: `${i * 0.14}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-card)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about API architecture, refactoring, endpoints…"
              rows={2}
              disabled={isLoading}
              style={{
                flex: 1,
                resize: 'none',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                padding: '9px 12px',
                fontSize: 13,
                lineHeight: 1.55,
                outline: 'none',
                transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
                fontFamily: 'inherit',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--accent-blue)';
                e.target.style.boxShadow = '0 0 0 3px rgba(15,98,254,0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--border-default)';
                e.target.style.boxShadow = 'none';
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className="btn-primary"
              style={{ height: 44, padding: '0 20px', alignSelf: 'flex-end', fontSize: 12 }}
            >
              Send ↑
            </button>
          </div>
          <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '6px 0 0' }}>
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
