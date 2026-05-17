import { useState, useEffect } from 'react';
import {
  Zap, Sun, Moon, Globe, FolderOpen, ArrowRight, Network,
  MessageSquare, Sparkles, GitMerge, Check, X as XIcon,
  Lock, Unlock, Code2, Eye, ChevronDown,
} from 'lucide-react';
import Logo, { LogoLockup } from '../components/Logo';

/* ── palette shortcuts ── */
const C = {
  blue:   '#4F8EF7',
  indigo: '#7C7FF5',
  purple: '#B06EF7',
  cyan:   '#2ED8F0',
  green:  '#1AE0A0',
};

/* ────────────────────────────────────────────────────────────────
   HERO BACKGROUND : dot grid + scanline + orbs
   ──────────────────────────────────────────────────────────────── */
function HeroBg() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {/* dot grid */}
      <div className="hero-dot-grid" style={{ position: 'absolute', inset: 0 }} />
      {/* horizontal scanline */}
      <div style={{
        position: 'absolute', left: 0, right: 0, height: 1.5,
        background: `linear-gradient(90deg, transparent 0%, ${C.blue}55 20%, ${C.cyan}70 50%, ${C.blue}55 80%, transparent 100%)`,
        animation: 'scanline 7s linear infinite',
      }} />
      {/* orb 1 – blue */}
      <div style={{
        position: 'absolute', width: 1100, height: 1100, borderRadius: '50%',
        top: '-30%', left: '-20%',
        background: `radial-gradient(circle, ${C.blue}08 0%, transparent 62%)`,
        animation: 'orbFloat1 22s ease-in-out infinite',
      }} />
      {/* orb 2 – purple */}
      <div style={{
        position: 'absolute', width: 900, height: 900, borderRadius: '50%',
        bottom: '-20%', right: '-15%',
        background: `radial-gradient(circle, ${C.purple}0A 0%, transparent 62%)`,
        animation: 'orbFloat2 28s ease-in-out infinite',
      }} />
      {/* orb 3 – cyan */}
      <div style={{
        position: 'absolute', width: 600, height: 600, borderRadius: '50%',
        top: '35%', right: '25%',
        background: `radial-gradient(circle, ${C.cyan}06 0%, transparent 62%)`,
        animation: 'orbFloat1 18s ease-in-out infinite reverse',
      }} />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   FLOATING GHOST NODES : decorative background nodes
   ──────────────────────────────────────────────────────────────── */
const GHOST_NODES = [
  { left: '7%',  top: '22%', kind: 'router',   label: 'GET /api/users',   anim: 'nodeFloat0', delay: '0s'    },
  { left: '78%', top: '16%', kind: 'function',  label: 'authenticate()',   anim: 'nodeFloat1', delay: '0.8s'  },
  { left: '3%',  top: '60%', kind: 'input',     label: 'POST /auth',       anim: 'nodeFloat2', delay: '1.6s'  },
  { left: '81%', top: '58%', kind: 'output',    label: 'ResponseModel',    anim: 'nodeFloat0', delay: '2.4s'  },
  { left: '14%', top: '82%', kind: 'function',  label: 'parseRequest()',   anim: 'nodeFloat1', delay: '0.4s'  },
  { left: '74%', top: '80%', kind: 'router',    label: 'DELETE /item',     anim: 'nodeFloat2', delay: '1.2s'  },
];
const KIND_C = {
  router: C.blue, function: C.purple, input: C.cyan, output: C.green, default: '#7C7F9A',
};

function FloatingNodes() {
  return (
    <>
      {GHOST_NODES.map((n, i) => {
        const c = KIND_C[n.kind] || '#7C7F9A';
        return (
          <div
            key={i}
            style={{
              position: 'absolute', left: n.left, top: n.top,
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '7px 13px',
              background: 'var(--bg-glass-strong)',
              border: `1px solid ${c}28`,
              borderRadius: 9,
              backdropFilter: 'blur(14px)',
              opacity: 0.45,
              zIndex: 1,
              pointerEvents: 'none',
              animation: `${n.anim} ${5 + i * 0.6}s ease-in-out infinite`,
              animationDelay: n.delay,
            }}
          >
            {/* Left bar */}
            <div style={{ width: 2, height: 20, borderRadius: 2, background: c, opacity: 0.8 }} />
            <div>
              <div style={{ fontSize: 8, fontWeight: 700, color: c, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>
                {n.kind}
              </div>
              <div style={{ fontSize: 10.5, fontFamily: "'JetBrains Mono', monospace", color: 'rgba(241,241,245,0.7)', marginTop: 2, lineHeight: 1 }}>
                {n.label}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

/* ────────────────────────────────────────────────────────────────
   HERO SECTION
   ──────────────────────────────────────────────────────────────── */
function HeroSection({ onLaunch }) {
  const [tab, setTab]       = useState('local'); // 'github' | 'local'
  const [val, setVal]       = useState('');
  const [err, setErr]       = useState('');
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  const handleLaunch = () => {
    const v = val.trim();
    if (!v) { setErr(tab === 'github' ? 'Paste a GitHub URL' : 'Enter your project path'); return; }
    if (tab === 'github' && !v.includes('github.com')) { setErr('Must be a github.com URL'); return; }
    setErr('');
    onLaunch(tab, v);
  };

  const accentColor = tab === 'github' ? C.cyan : C.indigo;
  const gradient    = tab === 'github'
    ? `linear-gradient(135deg, ${C.blue} 0%, ${C.cyan} 100%)`
    : `linear-gradient(135deg, ${C.indigo} 0%, ${C.purple} 100%)`;

  return (
    <section style={{
      minHeight: '100vh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '100px 24px 80px',
      position: 'relative', zIndex: 2,
    }}>
      {/* Ghost nodes (desktop) */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <FloatingNodes />
      </div>

      {/* ── Top badge ── */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '6px 16px', borderRadius: 100,
        background: 'rgba(79,142,247,0.08)',
        border: `1px solid ${C.blue}30`,
        marginBottom: 32,
        backdropFilter: 'blur(16px)',
        animation: visible ? 'fadeInDown 500ms ease forwards' : 'none',
        opacity: 0,
      }}>
        <span className="animate-status-pulse" style={{
          width: 6, height: 6, borderRadius: '50%',
          background: C.blue, display: 'inline-block', flexShrink: 0,
        }} />
        <span style={{
          fontSize: 11.5, fontWeight: 600, letterSpacing: '0.03em',
          color: 'var(--text-secondary)',
        }}>
          Built with&nbsp;
          <span style={{ color: C.blue }}>IBM Bob</span>
        </span>
      </div>

      {/* ── Headline ── */}
      <h1 style={{
        fontSize: 'clamp(48px, 9vw, 108px)',
        fontWeight: 900,
        letterSpacing: '-0.045em',
        lineHeight: 1.02,
        textAlign: 'center',
        margin: '0 auto 28px',
        maxWidth: 900,
        animation: visible ? 'heroReveal 700ms cubic-bezier(0.34,1.2,0.64,1) 120ms forwards' : 'none',
        opacity: 0,
      }}>
        <span style={{
          background: `linear-gradient(135deg, ${C.blue} 0%, ${C.indigo} 60%)`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          display: 'block',
        }}>
          See Your API
        </span>
        <span style={{ color: 'var(--text-primary)', display: 'block' }}>
          Architecture
        </span>
        <span style={{
          background: `linear-gradient(135deg, ${C.purple} 0%, ${C.cyan} 100%)`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          display: 'block',
        }}>
          Come Alive
        </span>
      </h1>

      {/* ── Subtitle ── */}
      <p style={{
        fontSize: 19, color: 'var(--text-secondary)', lineHeight: 1.72,
        maxWidth: 560, textAlign: 'center', margin: '0 auto 52px',
        animation: visible ? 'subReveal 600ms ease 260ms forwards' : 'none',
        opacity: 0,
      }}>
        Paste a repo or local path. Bobcat parses your codebase into an
        interactive graph, then lets IBM Bob answer questions, generate
        endpoints, and refactor functions in plain English.
      </p>

      {/* ── Inline launch card ── */}
      <div style={{
        width: '100%', maxWidth: 620,
        background: 'var(--bg-glass-panel)',
        backdropFilter: 'blur(32px) saturate(160%)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 18,
        padding: 6,
        boxShadow: 'var(--shadow-float)',
        animation: visible ? 'inputReveal 650ms cubic-bezier(0.34,1.2,0.64,1) 340ms forwards' : 'none',
        opacity: 0,
      }}>
        {/* Tab switcher */}
        <div style={{
          display: 'flex', gap: 4, padding: '6px 6px 0',
          marginBottom: 8,
        }}>
          {[
            { id: 'github', label: 'GitHub URL', icon: <Globe size={13} /> },
            { id: 'local',  label: 'Local Path', icon: <FolderOpen size={13} /> },
          ].map(({ id, label, icon }) => {
            const active = tab === id;
            const col = id === 'github' ? C.cyan : C.indigo;
            return (
              <button
                key={id}
                onClick={() => { setTab(id); setVal(''); setErr(''); }}
                style={{
                  flex: 1, height: 36, borderRadius: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  background: active ? col + '15' : 'transparent',
                  border: `1px solid ${active ? col + '40' : 'transparent'}`,
                  color: active ? col : 'var(--text-muted)',
                  fontSize: 12.5, fontWeight: active ? 600 : 400,
                  cursor: 'pointer', transition: 'all 150ms ease',
                  fontFamily: 'inherit',
                }}
              >
                {icon} {label}
              </button>
            );
          })}
        </div>

        {/* Input row */}
        <div style={{ display: 'flex', gap: 6, padding: '0 4px 4px' }}>
          <div style={{
            flex: 1, minWidth: 0,
            display: 'flex', alignItems: 'center',
            height: 46,
            background: 'var(--bg-input)',
            border: '1px solid',
            borderColor: focused ? accentColor : err ? '#F56565' : 'rgba(255,255,255,0.08)',
            borderRadius: 10, overflow: 'hidden',
            transition: 'border-color 150ms ease, box-shadow 150ms ease',
            boxShadow: focused ? `0 0 0 3px ${accentColor}18` : 'none',
          }}>
            <input
              type="text"
              value={val}
              onChange={(e) => { setVal(e.target.value); setErr(''); }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(e) => e.key === 'Enter' && handleLaunch()}
              placeholder={tab === 'github' ? 'https://github.com/owner/repository' : '/path/to/project/main.py'}
              style={{
                flex: 1, height: '100%',
                background: 'transparent', color: 'var(--text-primary)',
                border: 'none', outline: 'none',
                padding: '0 16px',
                fontSize: 13,
                fontFamily: "'JetBrains Mono', monospace",
              }}
            />
          </div>
          <button
            onClick={handleLaunch}
            style={{
              height: 46, padding: '0 24px',
              borderRadius: 10, border: 'none',
              background: gradient,
              color: '#fff', fontSize: 13.5, fontWeight: 700,
              cursor: 'pointer', flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: 8,
              letterSpacing: '0.01em', fontFamily: 'inherit',
              boxShadow: `0 4px 20px ${accentColor}30`,
              transition: 'all 150ms ease',
              position: 'relative', overflow: 'hidden',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = `0 8px 30px ${accentColor}42`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = `0 4px 20px ${accentColor}30`;
            }}
          >
            {/* beam sweep */}
            <span style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)',
              animation: 'beam 2.4s ease-in-out infinite',
              pointerEvents: 'none',
            }} />
            <span style={{ position: 'relative' }}>Analyze</span>
            <ArrowRight size={14} strokeWidth={2.5} style={{ position: 'relative' }} />
          </button>
        </div>

        {err && (
          <p style={{ fontSize: 11, color: '#F56565', padding: '4px 10px 4px', display: 'flex', alignItems: 'center', gap: 5, margin: 0 }}>
            <XIcon size={10} /> {err}
          </p>
        )}

        {/* Bottom capability hint */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.05)',
          padding: '10px 10px 8px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 8,
        }}>
          <div style={{ display: 'flex', gap: 16 }}>
            {[
              { icon: <Eye size={11} />,      label: 'Visualize' },
              { icon: <MessageSquare size={11} />, label: 'Chat AI' },
              { icon: <Sparkles size={11} />,  label: 'Generate' },
              { icon: <GitMerge size={11} />,  label: 'Refactor' },
            ].map(({ icon, label }) => (
              <span key={label} style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 10.5, color: 'var(--text-muted)',
              }}>
                {icon} {label}
              </span>
            ))}
          </div>
          <span style={{
            fontSize: 10, color: 'var(--text-muted)', flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            {tab === 'github' ? <Lock size={9} /> : <Unlock size={9} />}
            {tab === 'github' ? 'View only' : 'Full edit access'}
          </span>
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div style={{
        display: 'flex', gap: 40, marginTop: 52,
        animation: visible ? 'statReveal 600ms ease 480ms forwards' : 'none',
        opacity: 0,
      }}>
        {[
          { val: '10+',  label: 'Languages',   color: C.blue   },
          { val: 'Bob',  label: 'AI Partner',  color: C.cyan   },
          { val: '∞',    label: 'Graph Nodes', color: C.purple },
          { val: 'Live', label: 'Code Sync',   color: C.green  },
        ].map(({ val, label, color }) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: 28, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1,
              background: `linear-gradient(135deg, ${color} 0%, ${color}99 100%)`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              {val}
            </div>
            <div style={{
              fontSize: 10, color: 'var(--text-muted)', marginTop: 5,
              letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 600,
            }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* scroll hint */}
      <div style={{
        position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        color: 'var(--text-muted)', animation: 'float 2.8s ease-in-out infinite',
      }}>
        <span style={{ fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>Scroll</span>
        <ChevronDown size={14} />
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────
   CAPABILITIES SECTION : bold dark-neo feature cards
   ──────────────────────────────────────────────────────────────── */
const CAPS = [
  {
    icon: <Network size={22} />,
    color: C.blue,
    grad: `linear-gradient(135deg, ${C.blue} 0%, ${C.indigo} 100%)`,
    title: 'Live Graph Canvas',
    desc: 'Every router, endpoint, and function becomes a draggable node. Pan, zoom, and explore the full topology of your backend instantly.',
  },
  {
    icon: <MessageSquare size={22} />,
    color: C.cyan,
    grad: `linear-gradient(135deg, ${C.blue} 0%, ${C.cyan} 100%)`,
    title: 'Chat with Bob',
    desc: 'Ask IBM Bob anything about your codebase. Explain a function, find a bottleneck, or get architecture recommendations in plain English.',
  },
  {
    icon: <Sparkles size={22} />,
    color: C.purple,
    grad: `linear-gradient(135deg, ${C.indigo} 0%, ${C.purple} 100%)`,
    title: 'AI Endpoint Generator',
    desc: 'Describe what you need. IBM Bob writes the full endpoint code: route, handler, and schema, then adds it to your project graph.',
  },
  {
    icon: <GitMerge size={22} />,
    color: C.green,
    grad: `linear-gradient(135deg, ${C.cyan} 0%, ${C.green} 100%)`,
    title: 'Instant Refactor',
    desc: 'Select any function node. IBM Bob rewrites it cleaner, faster, or with a different pattern, then syncs the change back to disk.',
  },
];

function CapabilitiesSection() {
  return (
    <section style={{
      padding: '100px 40px 80px',
      position: 'relative', zIndex: 2,
      maxWidth: 1120, margin: '0 auto', width: '100%',
    }}>
      {/* Section label */}
      <div style={{ textAlign: 'center', marginBottom: 56 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '5px 14px', borderRadius: 100,
          background: `${C.blue}10`,
          border: `1px solid ${C.blue}28`,
          marginBottom: 18,
        }}>
          <Sparkles size={11} color={C.blue} />
          <span style={{ fontSize: 10.5, fontWeight: 700, color: C.blue, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Capabilities
          </span>
        </div>
        <h2 style={{
          fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800,
          letterSpacing: '-0.03em', color: 'var(--text-primary)',
          margin: '0 0 14px',
        }}>
          Everything in one canvas
        </h2>
        <p style={{ fontSize: 16, color: 'var(--text-secondary)', maxWidth: 460, margin: '0 auto', lineHeight: 1.7 }}>
          From first load to production-ready refactor: without leaving the graph.
        </p>
      </div>

      {/* Cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {CAPS.map(({ icon, color, grad, title, desc }) => (
          <CapCard key={title} icon={icon} color={color} grad={grad} title={title} desc={desc} />
        ))}
      </div>
    </section>
  );
}

function CapCard({ icon, color, grad, title, desc }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '28px 28px 26px',
        background: hov ? 'var(--bg-card)' : 'var(--bg-glass)',
        backdropFilter: 'blur(28px)',
        border: `1px solid ${hov ? color + '40' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: 16,
        transition: 'all 220ms ease',
        boxShadow: hov ? `0 0 0 1px ${color}22, 0 12px 48px rgba(0,0,0,0.55)` : '0 4px 16px rgba(0,0,0,0.4)',
        cursor: 'default',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top accent line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: grad, opacity: hov ? 1 : 0.25,
        transition: 'opacity 220ms ease',
      }} />

      {/* Icon */}
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: hov ? color + '18' : color + '0E',
        border: `1px solid ${color}${hov ? '45' : '22'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color, marginBottom: 18,
        transition: 'all 220ms ease',
        boxShadow: hov ? `0 4px 20px ${color}22` : 'none',
      }}>
        {icon}
      </div>

      <h3 style={{
        fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em',
        color: hov ? 'var(--text-primary)' : 'var(--text-secondary)',
        margin: '0 0 10px',
        transition: 'color 220ms ease',
      }}>
        {title}
      </h3>
      <p style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.72, margin: 0 }}>
        {desc}
      </p>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   HOW IT WORKS : vertical timeline
   ──────────────────────────────────────────────────────────────── */
const STEPS = [
  { icon: <FolderOpen size={18} />,    color: C.blue,   label: 'Load Your Codebase',     desc: 'Paste a GitHub URL or local file path. Bobcat scans your entire project structure in seconds, even large monorepos.' },
  { icon: <Network size={18} />,       color: C.indigo, label: 'Graph is Generated',     desc: 'Every router, middleware, function, and endpoint appears as a color-coded node. Edges show the exact call flow between them.' },
  { icon: <MessageSquare size={18} />, color: C.purple, label: 'Chat and Explore',       desc: 'Click any node to see its code. Ask IBM Bob to explain it, find dependencies, or suggest improvements.' },
  { icon: <Code2 size={18} />,         color: C.green,  label: 'Generate and Refactor',  desc: 'Create new endpoints from a description, or refactor existing ones. Changes write back to disk and the graph updates live.' },
];

function HowItWorksSection() {
  return (
    <section style={{
      padding: '80px 40px 100px',
      position: 'relative', zIndex: 2,
      borderTop: '1px solid rgba(255,255,255,0.04)',
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* Label */}
        <div style={{ textAlign: 'center', marginBottom: 60 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '5px 14px', borderRadius: 100,
            background: `${C.purple}10`,
            border: `1px solid ${C.purple}28`,
            marginBottom: 18,
          }}>
            <Zap size={11} color={C.purple} />
            <span style={{ fontSize: 10.5, fontWeight: 700, color: C.purple, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              How It Works
            </span>
          </div>
          <h2 style={{
            fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800,
            letterSpacing: '-0.03em', color: 'var(--text-primary)', margin: 0,
          }}>
            From codebase to&nbsp;
            <span style={{
              background: `linear-gradient(135deg, ${C.purple} 0%, ${C.cyan} 100%)`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              AI canvas
            </span>
            &nbsp;in seconds
          </h2>
        </div>

        {/* Timeline */}
        <div style={{ position: 'relative' }}>
          {/* vertical line */}
          <div style={{
            position: 'absolute', left: 22, top: 24, bottom: 24, width: 1,
            background: 'linear-gradient(180deg, rgba(79,142,247,0.5), rgba(176,110,247,0.3), rgba(26,224,160,0.5))',
          }} />

          {STEPS.map(({ icon, color, label, desc }, i) => (
            <StepRow key={label} icon={icon} color={color} label={label} desc={desc} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function StepRow({ icon, color, label, desc, index }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', gap: 20,
        marginBottom: index < STEPS.length - 1 ? 36 : 0,
        cursor: 'default',
      }}
    >
      {/* Step circle */}
      <div style={{
        width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
        background: hov ? color + '20' : 'var(--bg-card)',
        border: `2px solid ${hov ? color : 'rgba(255,255,255,0.08)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: hov ? color : 'var(--text-muted)',
        transition: 'all 200ms ease',
        boxShadow: hov ? `0 0 20px ${color}25` : 'none',
        position: 'relative', zIndex: 1,
      }}>
        {icon}
      </div>

      {/* Text */}
      <div style={{ paddingTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 100,
            background: color + '15', border: `1px solid ${color}30`, color,
            fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em',
          }}>
            0{index + 1}
          </span>
          <h3 style={{
            fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em',
            color: hov ? 'var(--text-primary)' : 'var(--text-secondary)',
            margin: 0, transition: 'color 200ms ease',
          }}>
            {label}
          </h3>
        </div>
        <p style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.72, margin: 0 }}>
          {desc}
        </p>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   MAIN PAGE
   ──────────────────────────────────────────────────────────────── */
export default function HomePage({ onLaunch, theme, onToggleTheme }) {
  return (
    <div
      data-theme={theme}
      style={{
        minHeight: '100vh',
        background: 'var(--bg-base)',
        color: 'var(--text-primary)',
        fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
        overflowX: 'hidden',
        position: 'relative',
        transition: 'background-color 0.4s, color 0.4s',
      }}
    >
      <HeroBg />

      {/* ════ NAV ════ */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 40px',
        background: 'var(--bg-glass)',
        backdropFilter: 'blur(28px) saturate(180%)',
        WebkitBackdropFilter: 'blur(28px) saturate(180%)',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        {/* gradient top stripe */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg, #4F8EF7, #7C7FF5, #B06EF7, #2ED8F0, #4F8EF7)',
          backgroundSize: '300% 100%',
          animation: 'gradientShift 7s ease infinite',
          opacity: 0.5,
        }} />

        {/* Logo: Bobcat (powered by IBM Bob) */}
        <LogoLockup size={32} />

        {/* Right controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 12px', borderRadius: 100,
            background: 'rgba(79,142,247,0.1)',
            border: '1px solid rgba(79,142,247,0.25)',
          }}>
            <span className="animate-status-pulse" style={{
              width: 5, height: 5, borderRadius: '50%',
              background: C.blue, display: 'inline-block', flexShrink: 0,
            }} />
            <span style={{ fontSize: 10.5, fontWeight: 600, color: C.blue, letterSpacing: '0.02em' }}>
              IBM Bob
            </span>
          </div>
          <button
            onClick={onToggleTheme}
            style={{
              width: 34, height: 34, borderRadius: 8,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all var(--t-fast)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </nav>

      {/* ════ PAGE SECTIONS ════ */}
      <div style={{ position: 'relative', zIndex: 2 }}>
        <HeroSection onLaunch={onLaunch} />

        {/* Separator */}
        <div style={{
          height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(79,142,247,0.25), rgba(176,110,247,0.2), transparent)',
          margin: '0 5%',
        }} />

        <CapabilitiesSection />

        <div style={{
          height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(176,110,247,0.2), rgba(46,216,240,0.2), transparent)',
          margin: '0 5%',
        }} />

        <HowItWorksSection />
      </div>

      {/* ════ FOOTER ════ */}
      <footer style={{
        padding: '22px 40px',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12,
        position: 'relative', zIndex: 2,
        background: 'var(--bg-glass)',
        backdropFilter: 'blur(20px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7,
            background: 'linear-gradient(135deg, #4F8EF7 0%, #7C7FF5 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff',
          }}>
            <Logo size={15} color="#fff" />
          </div>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
            Bobcat
          </span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Built with IBM Bob for the IBM Bob Hackathon 2026
        </span>
      </footer>
    </div>
  );
}
