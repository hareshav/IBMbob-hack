import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Send, MessageSquare } from 'lucide-react';
import { requestChatCompletion } from '../lib/apiClient';

const KIND_COLORS = {
  router:   '#4F8EF7',
  function: '#B06EF7',
  input:    '#2ED8F0',
  output:   '#1AE0A0',
  default:  '#7C7F9A',
};

const KIND_PROMPTS = {
  router: [
    'What routes does this handle?',
    'What middleware should I add?',
    'What if I add rate limiting?',
    'How can I improve routing?',
  ],
  function: [
    'What does this function do?',
    'How can I optimize it?',
    'What if I add error handling?',
    'Are there security issues?',
  ],
  input: [
    'How is this input validated?',
    'What format does it accept?',
    'What if the input is malformed?',
    'What security checks are needed?',
  ],
  output: [
    'What is the output format?',
    'How can I improve the response?',
    'What HTTP status codes apply?',
    'How do I handle errors in output?',
  ],
  default: [
    'What does this node do?',
    'How can I improve it?',
    'What are the dependencies?',
    'What could go wrong?',
  ],
};

export default function NodeChat({ node, selectedModelId, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const prevNodeId     = useRef(null);

  const kind   = node?.data?.kind  || 'default';
  const color  = KIND_COLORS[kind] || KIND_COLORS.default;
  const prompts = KIND_PROMPTS[kind] || KIND_PROMPTS.default;
  const title  = node?.data?.title || node?.data?.label || 'Unnamed';

  /* clear conversation when node changes */
  useEffect(() => {
    if (node?.id !== prevNodeId.current) {
      prevNodeId.current = node?.id;
      setMessages([]);
      setInput('');
    }
  }, [node?.id]);

  /* auto-scroll */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const buildContext = useCallback(() => {
    const ctx = { node: title, kind };
    if (node?.data?.file) ctx.file = node.data.file;
    if (node?.data?.code) ctx.code = node.data.code;
    return ctx;
  }, [title, kind, node]);

  const sendMessage = useCallback(async (text) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
    setInput('');
    setIsLoading(true);
    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const result  = await requestChatCompletion({
        messages: [...history, { role: 'user', content: trimmed }],
        context: buildContext(),
        model_id: selectedModelId,
      });
      const reply = result.content || result.response || result.message || 'No response.';
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, messages, buildContext, selectedModelId]);

  const empty = messages.length === 0;

  return (
    <div style={{
      width: 280,
      maxHeight: 440,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-glass-panel)',
      backdropFilter: 'blur(32px) saturate(180%)',
      WebkitBackdropFilter: 'blur(32px) saturate(180%)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 14,
      boxShadow: 'var(--shadow-float)',
      overflow: 'hidden',
      animation: 'fadeInUp 220ms cubic-bezier(0.34,1.56,0.64,1) forwards',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '9px 12px',
        borderBottom: '1px solid var(--border-subtle)',
        background: `${color}0C`,
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${color}, ${color}44)` }} />
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 8px ${color}` }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </div>
          <div style={{ fontSize: 9, color, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginTop: 1 }}>
            {kind} · IBM Bob AI
          </div>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex', alignItems: 'center', borderRadius: 4, transition: 'color 120ms' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          <X size={13} />
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 7, minHeight: 60 }}>
        {empty ? (
          <div style={{ padding: '12px 0', textAlign: 'center' }}>
            <MessageSquare size={20} color={color} style={{ margin: '0 auto 7px', display: 'block', opacity: 0.6 }} />
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Ask IBM Bob AI about this {kind} node
            </div>
          </div>
        ) : messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '88%',
              padding: '7px 10px',
              borderRadius: msg.role === 'user' ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
              background: msg.role === 'user' ? `${color}1E` : 'var(--bg-elevated)',
              border: `1px solid ${msg.role === 'user' ? color + '3A' : 'var(--border-subtle)'}`,
              fontSize: 11,
              color: 'var(--text-primary)',
              lineHeight: 1.55,
              fontFamily: 'inherit',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ padding: '8px 12px', borderRadius: '10px 10px 10px 2px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', display: 'flex', gap: 4, alignItems: 'center' }}>
              {[0, 150, 300].map((delay, i) => (
                <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: color, animation: `dotBounce 1.4s ease-in-out ${delay}ms infinite` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick prompts — only when empty */}
      {empty && (
        <div style={{ padding: '0 10px 8px', display: 'flex', flexWrap: 'wrap', gap: 4, flexShrink: 0 }}>
          {prompts.map((p, i) => (
            <button
              key={i}
              onClick={() => sendMessage(p)}
              style={{ fontSize: 9.5, padding: '4px 8px', borderRadius: 100, background: `${color}0E`, border: `1px solid ${color}28`, color, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 120ms', textAlign: 'left' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = `${color}20`; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = `${color}0E`; }}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, padding: '8px 10px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
          }}
          placeholder="Ask about this node…"
          rows={1}
          style={{
            flex: 1,
            background: 'var(--bg-input)',
            border: '1px solid var(--border-default)',
            borderRadius: 8,
            padding: '6px 9px',
            fontSize: 11,
            color: 'var(--text-primary)',
            fontFamily: 'inherit',
            outline: 'none',
            resize: 'none',
            lineHeight: 1.4,
            maxHeight: 72,
            overflow: 'auto',
            transition: 'border-color 120ms',
          }}
          onFocus={(e) => { e.target.style.borderColor = color; }}
          onBlur={(e)  => { e.target.style.borderColor = 'var(--border-default)'; }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || isLoading}
          style={{
            width: 30, height: 30,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: (!input.trim() || isLoading) ? 'transparent' : `${color}1E`,
            border: `1px solid ${(!input.trim() || isLoading) ? 'var(--border-subtle)' : color + '3A'}`,
            borderRadius: 8,
            color: (!input.trim() || isLoading) ? 'var(--text-muted)' : color,
            cursor: (!input.trim() || isLoading) ? 'not-allowed' : 'pointer',
            opacity: (!input.trim() || isLoading) ? 0.38 : 1,
            flexShrink: 0,
            transition: 'all 120ms',
          }}
          onMouseEnter={(e) => { if (input.trim() && !isLoading) e.currentTarget.style.background = `${color}2C`; }}
          onMouseLeave={(e) => { if (input.trim() && !isLoading) e.currentTarget.style.background = `${color}1E`; }}
        >
          <Send size={12} />
        </button>
      </div>
    </div>
  );
}
