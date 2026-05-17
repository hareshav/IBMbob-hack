import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft, Play, RefreshCw,
  Sparkles,
  Sun, Moon, PanelLeftClose, PanelLeftOpen, Cpu,
  Plus, ChevronDown, MousePointerClick,
} from 'lucide-react';
import Logo from './Logo';

export default function WorkspaceNavbar({
  onBack, mode, theme, onToggleTheme,
  mainFilePath, onMainFilePathChange,
  onLoadGraph, onLoadAIGraph, isLoading, loadingSource, hasGraph, bobModeActive, loadedFilePath,
  availableModels, selectedModelId, onSelectedModelIdChange,
  isLoadingModels,
  onOpenChatbot, onOpenGenerateEndpoint,
  canEdit,
  sidebarCollapsed, onToggleSidebar,
  onFitView, onZoomIn, onZoomOut,
  onAddManually,
}) {
  const [inputFocused, setInputFocused] = useState(false);
  const trimmed = (mainFilePath || '').trim();
  const hasPath = Boolean(trimmed);

  /* Per-mode input validation. The HomePage decides which mode the user
     opened the workspace in; the toolbar enforces that choice so they can't
     accidentally paste a GitHub URL into a local-path workflow (or vice
     versa) and then wonder why it errored. */
  const looksLikeUrl    = /^(https?:\/\/|git@|ssh:\/\/)/i.test(trimmed);
  const looksLikeGithub = /github\.com[\/:]/i.test(trimmed);
  let pathError = null;
  if (hasPath) {
    if (mode === 'github' && !looksLikeGithub) {
      pathError = 'Enter a github.com URL (this workspace was opened in GitHub mode).';
    } else if (mode === 'local' && looksLikeUrl) {
      pathError = 'This is a local-path workspace. Use a file path like /Users/.../main.py';
    }
  }

  const parseDisabled = isLoading || !hasPath || Boolean(pathError);
  /* Ask Bob AI now enriches the EXISTING graph (no separate load). Requires
     a parsed graph to be present. Always disabled while any load is running. */
  const askBobDisabled = isLoading || !hasGraph;
  /* Per-button spinner state: only the button that was clicked shows its loader.
     The other one is greyed-disabled but keeps its idle label. */
  const isParseLoading = loadingSource === 'parse';
  const isAILoading    = loadingSource === 'ai';

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
        maxWidth: 720, margin: '0 auto',
        position: 'relative',
      }}>
        <div style={{
          flex: 1, minWidth: 0,
          display: 'flex', alignItems: 'center',
          height: 34,
          background: 'var(--bg-input)',
          border: '1px solid',
          borderColor: pathError
            ? 'rgba(245,101,101,0.55)'
            : inputFocused
              ? '#4F8EF7'
              : loadedFilePath
                ? 'rgba(26,224,160,0.45)'
                : 'var(--border-default)',
          borderRadius: 8,
          overflow: 'hidden',
          transition: 'border-color 150ms ease, box-shadow 150ms ease',
          boxShadow: pathError
            ? '0 0 0 3px rgba(245,101,101,0.14)'
            : inputFocused
              ? '0 0 0 3px rgba(79,142,247,0.14)'
              : 'none',
        }}>
          {/* Mode pill: tells the user at a glance which input they're filling */}
          <span style={{
            margin: '0 2px 0 8px',
            padding: '3px 7px',
            borderRadius: 6,
            fontSize: 9.5, fontWeight: 700,
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            flexShrink: 0,
            background: mode === 'github' ? 'rgba(46,216,240,0.14)' : 'rgba(176,110,247,0.14)',
            color:      mode === 'github' ? '#2ED8F0' : '#B06EF7',
            border:     mode === 'github' ? '1px solid rgba(46,216,240,0.32)' : '1px solid rgba(176,110,247,0.32)',
          }}>
            {mode === 'github' ? 'GitHub' : 'Local'}
          </span>
          {loadedFilePath && !inputFocused && !pathError && (
            <span style={{ paddingLeft: 6, color: '#1AE0A0', flexShrink: 0, display: 'flex', alignItems: 'center', fontSize: 12 }}>✓</span>
          )}
          <input
            type="text"
            value={mainFilePath}
            onChange={(e) => onMainFilePathChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !parseDisabled && onLoadGraph()}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            placeholder={mode === 'github' ? 'https://github.com/owner/repository' : '/path/to/project/main.py'}
            style={{
              flex: 1, height: '100%',
              background: 'transparent',
              /* Explicit fallback so the text is always readable even if the
                 theme CSS variable fails to resolve. */
              color: 'var(--text-primary, #12101E)',
              WebkitTextFillColor: 'var(--text-primary, #12101E)',
              border: 'none', outline: 'none',
              padding: '0 12px',
              fontSize: 12.5,
              fontFamily: "'JetBrains Mono', monospace",
              minWidth: 0,
              caretColor: 'var(--accent-blue, #4F8EF7)',
            }}
          />
        </div>

        {/* Load Graph button (AST parser) */}
        <button
          onClick={onLoadGraph}
          disabled={parseDisabled}
          title={!hasPath ? 'Type a local file path or GitHub URL first' : 'Parse the workspace (AST)'}
          style={{
            height: 34, padding: '0 16px',
            borderRadius: 8,
            background: parseDisabled ? 'var(--bg-elevated)' : 'linear-gradient(135deg, #4F8EF7 0%, #7C7FF5 100%)',
            color: parseDisabled ? 'var(--text-muted)' : '#fff', border: 'none',
            fontSize: 12.5, fontWeight: 700,
            cursor: parseDisabled ? 'not-allowed' : 'pointer',
            flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: 6,
            transition: 'all 150ms ease',
            opacity: parseDisabled ? 0.5 : 1,
            whiteSpace: 'nowrap',
            letterSpacing: '0.01em',
            fontFamily: 'inherit',
            boxShadow: parseDisabled ? 'none' : '0 2px 14px rgba(79,142,247,0.4), inset 0 1px 0 rgba(255,255,255,0.12)',
          }}
          onMouseEnter={(e) => {
            if (!parseDisabled) {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 5px 22px rgba(79,142,247,0.5), inset 0 1px 0 rgba(255,255,255,0.14)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = parseDisabled ? 'none' : '0 2px 14px rgba(79,142,247,0.4), inset 0 1px 0 rgba(255,255,255,0.12)';
          }}
        >
          {isParseLoading
            ? <><RefreshCw size={12} className="animate-spin" /> Analyzing</>
            : <><Play size={12} strokeWidth={2.5} /> Parse</>
          }
        </button>

        {/* Ask Bob AI button - enriches the EXISTING parsed graph with IBM Bob
            (semantic risk scoring + hover glow + Simulate Change). Disabled
            until Parse has loaded a graph. Visually upgrades to "Bob Active"
            once the enrichment has completed. */}
        <button
          onClick={onLoadAIGraph}
          disabled={askBobDisabled}
          title={
            askBobDisabled && !hasGraph ? 'Run Parse first - Bob enriches an already-loaded graph'
            : bobModeActive ? 'Re-run Bob analysis on the current graph'
            : 'Activate IBM Bob: semantic risk, hover glow, and Simulate Change'
          }
          style={{
            height: 34, padding: '0 16px',
            borderRadius: 8,
            background: askBobDisabled
              ? 'var(--bg-elevated)'
              : bobModeActive
                ? 'linear-gradient(135deg, #4F8EF7 0%, #B06EF7 100%)'
                : 'linear-gradient(135deg, #1AE0A0 0%, #2ED8F0 100%)',
            color: askBobDisabled ? 'var(--text-muted)' : bobModeActive ? '#fff' : '#0a0a12',
            border: 'none',
            fontSize: 12.5, fontWeight: 700,
            cursor: askBobDisabled ? 'not-allowed' : 'pointer',
            flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: 6,
            transition: 'all 150ms ease',
            opacity: askBobDisabled ? 0.45 : 1,
            whiteSpace: 'nowrap',
            letterSpacing: '0.01em',
            fontFamily: "'JetBrains Mono', monospace",
            boxShadow: askBobDisabled
              ? 'none'
              : bobModeActive
                ? '0 2px 14px rgba(124,127,245,0.45), inset 0 1px 0 rgba(255,255,255,0.18)'
                : '0 2px 14px rgba(26,224,160,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
          }}
          onMouseEnter={(e) => {
            if (askBobDisabled) return;
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = bobModeActive
              ? '0 5px 22px rgba(124,127,245,0.6), inset 0 1px 0 rgba(255,255,255,0.22)'
              : '0 5px 22px rgba(26,224,160,0.55), inset 0 1px 0 rgba(255,255,255,0.22)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = askBobDisabled
              ? 'none'
              : bobModeActive
                ? '0 2px 14px rgba(124,127,245,0.45), inset 0 1px 0 rgba(255,255,255,0.18)'
                : '0 2px 14px rgba(26,224,160,0.4), inset 0 1px 0 rgba(255,255,255,0.2)';
          }}
        >
          {isAILoading
            ? <><RefreshCw size={12} className="animate-spin" /> Bob thinking…</>
            : <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                </svg>
                {bobModeActive ? 'Bob Active' : 'Ask Bob AI'}
              </>
          }
        </button>

        {/* Inline validation toast: floats below the input row when the user
            types a path that doesn't match the current workspace mode. */}
        {pathError && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 12, right: 12,
            zIndex: 5,
            padding: '6px 10px',
            borderRadius: 7,
            background: 'rgba(245,101,101,0.10)',
            border: '1px solid rgba(245,101,101,0.32)',
            color: '#F56565',
            fontSize: 11, fontWeight: 500,
            fontFamily: "'JetBrains Mono', monospace",
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
            animation: 'fadeInDown 180ms ease forwards',
          }}>
            {pathError}
          </div>
        )}
      </div>

      <VSep />

      {/* ── Right ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '0 6px 0 8px', flexShrink: 0 }}>

        {/* Model selector: styled as IBM-blue chip */}
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

        {/* Add Endpoint dropdown: primary "create" entry point. Delete lives in
            the side panel + on the selected node's own context (it's contextual). */}
        <AddEndpointMenu
          onAddManually={onAddManually}
          onGenerate={onOpenGenerateEndpoint}
        />

        <VSep />

        {/* Chat with Bob - hero CTA. This is the IBM Bob entry point, the thing
            the hackathon is judged on, so it must read as the primary action in
            the toolbar (not just another pill). */}
        <ChatWithBobButton onClick={onOpenChatbot} />

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

/* ── Chat with Bob: the hero CTA that anchors the right side of the toolbar.
       Gradient fill, the Bobcat eyes as the icon, a soft pulsing halo. Designed
       to be the most prominent interactive element in the navbar so a judge
       glancing at the screen immediately sees the IBM Bob integration. ── */
function ChatWithBobButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        position: 'relative',
        height: 34, padding: '0 14px 0 12px',
        borderRadius: 9,
        background: 'linear-gradient(135deg, #4F8EF7 0%, #7C7FF5 50%, #B06EF7 100%)',
        backgroundSize: '200% 100%',
        border: 'none',
        color: '#fff',
        fontSize: 12.5, fontWeight: 700,
        letterSpacing: '0.01em',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 8,
        whiteSpace: 'nowrap',
        fontFamily: 'inherit',
        boxShadow: '0 4px 18px rgba(124,127,245,0.45), 0 0 0 1px rgba(255,255,255,0.10) inset',
        transition: 'transform 150ms ease, box-shadow 150ms ease, background-position 600ms ease',
        animation: 'chatBobPulse 2.4s ease-in-out infinite',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = '0 8px 28px rgba(124,127,245,0.6), 0 0 0 1px rgba(255,255,255,0.16) inset';
        e.currentTarget.style.backgroundPosition = '100% 0';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.boxShadow = '0 4px 18px rgba(124,127,245,0.45), 0 0 0 1px rgba(255,255,255,0.10) inset';
        e.currentTarget.style.backgroundPosition = '0 0';
      }}
    >
      {/* Bobcat-eyes mark inside a tinted disc */}
      <span style={{
        width: 22, height: 22, borderRadius: 6,
        background: 'rgba(255,255,255,0.16)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Logo size={13} color="#fff" />
      </span>
      <span>Chat with Bob</span>
      <span style={{
        marginLeft: 2,
        fontSize: 9, fontWeight: 700,
        padding: '2px 6px',
        borderRadius: 100,
        background: 'rgba(255,255,255,0.18)',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
      }}>
        AI
      </span>
    </button>
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

/* ── Colored AI/action button: always-on color ── */
function ColorBtn({ icon, label, color, onClick, disabled = false, tooltip }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      data-tooltip={tooltip}
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

/* ── Add Endpoint dropdown: menu rendered via portal so it escapes the navbar's
       overflow:hidden + any parent stacking contexts. ── */
function AddEndpointMenu({ onAddManually, onGenerate }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const color = '#2ED8F0';

  /* Recompute menu position from the button's bounding rect every time it opens
     (and on scroll/resize while open). Uses position:fixed so we work in viewport
     coords and don't get clipped by any ancestor with overflow:hidden. */
  const recomputePos = () => {
    const b = btnRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    setPos({
      top: r.bottom + 6,
      right: Math.max(8, window.innerWidth - r.right),
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    recomputePos();
    const onScrollOrResize = () => recomputePos();
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [open]);

  /* Outside-click and Escape close the menu. The "outside" check must include
     the trigger button so clicking it again toggles instead of immediately
     re-opening from the document handler. */
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (btnRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        data-tooltip="Add an endpoint to the graph"
        style={{
          height: 30, padding: '0 9px 0 10px',
          borderRadius: 7,
          background: open ? `${color}24` : `${color}14`,
          border: `1px solid ${open ? `${color}55` : `${color}38`}`,
          color,
          fontSize: 11.5, fontWeight: 600,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 5,
          transition: 'all 120ms ease',
          whiteSpace: 'nowrap',
          fontFamily: 'inherit',
          letterSpacing: '0.01em',
          boxShadow: open ? `0 0 14px ${color}33` : 'none',
        }}
        onMouseEnter={(e) => {
          if (open) return;
          e.currentTarget.style.background = `${color}24`;
          e.currentTarget.style.borderColor = `${color}55`;
          e.currentTarget.style.boxShadow = `0 0 14px ${color}22`;
        }}
        onMouseLeave={(e) => {
          if (open) return;
          e.currentTarget.style.background = `${color}14`;
          e.currentTarget.style.borderColor = `${color}38`;
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <Plus size={13} strokeWidth={2.2} />
        <span>Add Endpoint</span>
        <ChevronDown
          size={11}
          strokeWidth={2.2}
          style={{
            transition: 'transform 160ms ease',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{
            position: 'fixed',
            top: pos.top,
            right: pos.right,
            zIndex: 9999,
            minWidth: 260,
            background: 'var(--bg-glass-strong)',
            backdropFilter: 'blur(32px) saturate(180%)',
            WebkitBackdropFilter: 'blur(32px) saturate(180%)',
            border: '1px solid var(--border-default)',
            borderRadius: 10,
            padding: 4,
            boxShadow: 'var(--shadow-float)',
            animation: 'fadeInDown 180ms cubic-bezier(0.34,1.56,0.64,1) forwards',
          }}
        >
          <MenuItem
            icon={<MousePointerClick size={14} />}
            color="#4F8EF7"
            label="Add Manually"
            hint="Open the side panel and place nodes by hand"
            onClick={() => { setOpen(false); onAddManually?.(); }}
          />
          <MenuItem
            icon={<Sparkles size={14} />}
            color="#2ED8F0"
            label="Generate Endpoint"
            hint="Let IBM Bob AI write a new route into your workspace"
            onClick={() => { setOpen(false); onGenerate?.(); }}
          />
        </div>,
        document.body,
      )}
    </>
  );
}

function MenuItem({ icon, color, label, hint, onClick }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px',
        background: 'transparent',
        border: '1px solid transparent',
        borderRadius: 7,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        transition: 'all var(--t-fast)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = `${color}14`;
        e.currentTarget.style.borderColor = `${color}33`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.borderColor = 'transparent';
      }}
    >
      <div style={{
        width: 28, height: 28, borderRadius: 7,
        background: `${color}18`,
        border: `1px solid ${color}38`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12, fontWeight: 600,
          color: 'var(--text-primary)',
          lineHeight: 1.3,
        }}>
          {label}
        </div>
        <div style={{
          fontSize: 10.5, color: 'var(--text-muted)',
          lineHeight: 1.4, marginTop: 1,
        }}>
          {hint}
        </div>
      </div>
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
