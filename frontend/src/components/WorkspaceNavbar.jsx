import { useState } from 'react';
import {
  ArrowLeft, Play, RefreshCw,
  Bot, Sparkles, GitMerge,
  Sun, Moon, PanelLeftClose, PanelLeftOpen, Cpu,
} from 'lucide-react';

export default function WorkspaceNavbar({
  onBack, mode, theme, onToggleTheme,
  mainFilePath, onMainFilePathChange,
  onLoadGraph, onLoadAIGraph, isLoading, loadedFilePath,
  availableModels, selectedModelId, onSelectedModelIdChange,
  isLoadingModels,
  onOpenChatbot, onOpenGenerateEndpoint, onOpenRefactorFunction,
  hasSelectedNode, canEdit,
  sidebarCollapsed, onToggleSidebar,
  onFitView, onZoomIn, onZoomOut,
}) {
  const [inputFocused, setInputFocused] = useState(false);

  return (
    <nav style={{
      height: 52,
      display: 'flex',
      alignItems: 'center',
      padding: '0 6px',
      gap: 0,
      background: 'var(--bg-glass-panel)',
      backdropFilter: 'blur(32px) saturate(180%)',
      WebkitBackdropFilter: 'blur(32px) saturate(180%)',
      borderRadius: 14,
      border: '1px solid var(--border-subtle)',
      boxShadow: 'var(--shadow-float)',
      position: 'relative',
      overflow: 'hidden',
      animation: 'fadeInDown 280ms ease forwards',
    }}>

      {/* Animated gradient top line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: 'linear-gradient(90deg, #4F8EF7, #7C7FF5, #B06EF7, #2ED8F0, #1AE0A0, #4F8EF7)',
        backgroundSize: '300% 100%',
        animation: 'gradientShift 5s ease infinite',
      }} />

      {/* ── Left ── */}
      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <NBtn onClick={onToggleSidebar} tooltip={sidebarCollapsed ? 'Show panel' : 'Hide panel'}>
          {sidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </NBtn>

        <VSep />

        {/* Back button */}
        <div style={{ padding: '0 8px', flexShrink: 0 }}>
          <button
            onClick={onBack}
            style={ghostBtnStyle}
            onMouseEnter={ghHoverOn}
            onMouseLeave={ghHoverOff}
          >
            <ArrowLeft size={12} strokeWidth={2.5} />
            <span>Back</span>
          </button>
        </div>
      </div>

      <VSep />

      {/* ── Center: path input ── */}
      <div style={{
        flex: 1, minWidth: 0,
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '0 12px',
        maxWidth: 640, margin: '0 auto',
      }}>
        <div style={{
          flex: 1, minWidth: 0,
          display: 'flex', alignItems: 'center',
          height: 34,
          background: 'var(--bg-input)',
          border: '1px solid',
          borderColor: inputFocused
            ? '#4F8EF7'
            : loadedFilePath
              ? 'rgba(26,224,160,0.45)'
              : 'var(--border-default)',
          borderRadius: 8,
          overflow: 'hidden',
          transition: 'border-color 150ms ease, box-shadow 150ms ease',
          boxShadow: inputFocused ? '0 0 0 3px rgba(79,142,247,0.14)' : 'none',
        }}>
          {loadedFilePath && !inputFocused && (
            <span style={{ paddingLeft: 10, color: '#1AE0A0', flexShrink: 0, display: 'flex', alignItems: 'center', fontSize: 12 }}>✓</span>
          )}
          <input
            type="text"
            value={mainFilePath}
            onChange={(e) => onMainFilePathChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onLoadGraph()}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            placeholder={mode === 'github' ? 'https://github.com/owner/repository' : '/path/to/project/main.py'}
            style={{
              flex: 1, height: '100%',
              background: 'transparent',
              color: 'var(--text-primary)',
              border: 'none', outline: 'none',
              padding: '0 12px',
              fontSize: 12.5,
              fontFamily: "'JetBrains Mono', monospace",
              minWidth: 0,
            }}
          />
        </div>

        {/* Load Graph button (AST parser) */}
        <button
          onClick={onLoadGraph}
          disabled={isLoading}
          style={{
            height: 34, padding: '0 16px',
            borderRadius: 8,
            background: isLoading ? 'var(--bg-elevated)' : 'linear-gradient(135deg, #4F8EF7 0%, #7C7FF5 100%)',
            color: '#fff', border: 'none',
            fontSize: 12.5, fontWeight: 700,
            cursor: isLoading ? 'not-allowed' : 'pointer',
            flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: 6,
            transition: 'all 150ms ease',
            opacity: isLoading ? 0.6 : 1,
            whiteSpace: 'nowrap',
            letterSpacing: '0.01em',
            fontFamily: 'inherit',
            boxShadow: isLoading ? 'none' : '0 2px 14px rgba(79,142,247,0.4), inset 0 1px 0 rgba(255,255,255,0.12)',
          }}
          onMouseEnter={(e) => {
            if (!isLoading) {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 5px 22px rgba(79,142,247,0.5), inset 0 1px 0 rgba(255,255,255,0.14)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = isLoading ? 'none' : '0 2px 14px rgba(79,142,247,0.4), inset 0 1px 0 rgba(255,255,255,0.12)';
          }}
        >
          {isLoading
            ? <><RefreshCw size={12} className="animate-spin" /> Analyzing</>
            : <><Play size={12} strokeWidth={2.5} /> Parse</>
          }
        </button>

        {/* Ask Bob AI button */}
        <button
          onClick={onLoadAIGraph}
          disabled={isLoading}
          title="Let IBM Bob AI analyse the codebase and build the graph semantically"
          style={{
            height: 34, padding: '0 16px',
            borderRadius: 8,
            background: isLoading
              ? 'var(--bg-elevated)'
              : 'linear-gradient(135deg, #1AE0A0 0%, #2ED8F0 100%)',
            color: isLoading ? 'var(--text-muted)' : '#0a0a12',
            border: 'none',
            fontSize: 12.5, fontWeight: 700,
            cursor: isLoading ? 'not-allowed' : 'pointer',
            flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: 6,
            transition: 'all 150ms ease',
            opacity: isLoading ? 0.5 : 1,
            whiteSpace: 'nowrap',
            letterSpacing: '0.01em',
            fontFamily: "'JetBrains Mono', monospace",
            boxShadow: isLoading ? 'none' : '0 2px 14px rgba(26,224,160,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
          }}
          onMouseEnter={(e) => {
            if (!isLoading) {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 5px 22px rgba(26,224,160,0.55), inset 0 1px 0 rgba(255,255,255,0.22)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = isLoading ? 'none' : '0 2px 14px rgba(26,224,160,0.4), inset 0 1px 0 rgba(255,255,255,0.2)';
          }}
        >
          {isLoading
            ? <><RefreshCw size={12} className="animate-spin" /> Bob thinking…</>
            : <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                </svg>
                Ask Bob AI
              </>
          }
        </button>
      </div>

      <VSep />

      {/* ── Right ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '0 6px 0 8px', flexShrink: 0 }}>

        {/* Model selector — styled as IBM-blue chip */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '4px 8px 4px 8px',
          background: 'rgba(79,142,247,0.10)',
          border: '1px solid rgba(79,142,247,0.28)',
          borderRadius: 8,
          cursor: 'pointer',
          maxWidth: 160,
        }}>
          <Cpu size={11} color="#4F8EF7" style={{ flexShrink: 0 }} />
          <select
            value={selectedModelId}
            onChange={(e) => onSelectedModelIdChange?.(e.target.value)}
            disabled={isLoadingModels || !(availableModels || []).length}
            style={{
              background: 'transparent',
              color: '#4F8EF7',
              border: 'none', outline: 'none',
              fontSize: 10.5, fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              maxWidth: 120,
            }}
          >
            {(availableModels || []).map((id) => (
              <option key={id} value={id} style={{ background: '#13131A', color: '#F1F1F5' }}>
                {id.split('/').pop()}
              </option>
            ))}
          </select>
        </div>

        <VSep />

        {/* AI tool buttons — always colored */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <ColorBtn icon={<Bot size={13} />}     label="Chat"     color="#4F8EF7" onClick={onOpenChatbot} />
          <ColorBtn icon={<Sparkles size={13} />} label="Generate" color="#2ED8F0" onClick={onOpenGenerateEndpoint} />
          <ColorBtn
            icon={<GitMerge size={13} />}
            label="Refactor"
            color="#B06EF7"
            onClick={onOpenRefactorFunction}
            disabled={!hasSelectedNode || !canEdit}
          />
        </div>

        <VSep />

        {/* Theme toggle */}
        <NBtn onClick={onToggleTheme} tooltip={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </NBtn>
      </div>
    </nav>
  );
}

/* ── Separator ── */
function VSep() {
  return (
    <div style={{ width: 1, height: 20, flexShrink: 0, margin: '0 3px', background: 'var(--border-subtle)' }} />
  );
}

/* ── Icon button ── */
function NBtn({ children, onClick, tooltip }) {
  return (
    <button
      onClick={onClick}
      data-tooltip={tooltip}
      style={{
        width: 30, height: 30,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent',
        border: '1px solid transparent',
        borderRadius: 7,
        color: 'var(--text-muted)',
        cursor: 'pointer', flexShrink: 0,
        transition: 'all 120ms ease',
        fontFamily: 'inherit',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--bg-elevated)';
        e.currentTarget.style.borderColor = 'var(--border-default)';
        e.currentTarget.style.color = 'var(--text-primary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.borderColor = 'transparent';
        e.currentTarget.style.color = 'var(--text-muted)';
      }}
    >
      {children}
    </button>
  );
}

/* ── Colored AI/action button — always-on color ── */
function ColorBtn({ icon, label, color, onClick, disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 30, padding: '0 10px',
        borderRadius: 7,
        background: `${color}14`,
        border: `1px solid ${color}38`,
        color: disabled ? 'var(--text-muted)' : color,
        fontSize: 11.5, fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.35 : 1,
        display: 'flex', alignItems: 'center', gap: 5,
        transition: 'all 120ms ease',
        whiteSpace: 'nowrap',
        fontFamily: 'inherit',
        letterSpacing: '0.01em',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = `${color}24`;
          e.currentTarget.style.borderColor = `${color}55`;
          e.currentTarget.style.boxShadow = `0 0 14px ${color}22`;
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = `${color}14`;
          e.currentTarget.style.borderColor = `${color}38`;
          e.currentTarget.style.boxShadow = 'none';
        }
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

const ghostBtnStyle = {
  height: 27, padding: '0 9px',
  display: 'flex', alignItems: 'center', gap: 5,
  background: 'transparent',
  border: '1px solid var(--border-default)',
  borderRadius: 6,
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  fontSize: 11.5, fontWeight: 500,
  transition: 'all 120ms ease',
  fontFamily: 'inherit', whiteSpace: 'nowrap',
};
function ghHoverOn(e) {
  e.currentTarget.style.background = 'var(--bg-elevated)';
  e.currentTarget.style.color = 'var(--text-primary)';
  e.currentTarget.style.borderColor = 'var(--border-strong)';
}
function ghHoverOff(e) {
  e.currentTarget.style.background = 'transparent';
  e.currentTarget.style.color = 'var(--text-secondary)';
  e.currentTarget.style.borderColor = 'var(--border-default)';
}
