import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background, MiniMap, ReactFlow,
  addEdge, useEdgesState, useNodesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw } from 'lucide-react';

import WorkspaceNavbar from './components/WorkspaceNavbar';
import LeftSidebar from './components/LeftSidebar';
import CodeSidebar from './components/CodeSidebar';
import NodeChat from './components/NodeChat';
import { ApiNode } from './components/ApiNode';
import AIChatbot from './components/AIChatbot';
import AIGenerateEndpoint from './components/AIGenerateEndpoint';
import AIRefactorFunction from './components/AIRefactorFunction';
import { fetchModelCatalog, loadMainFileGraph, saveFunctionContent } from './lib/apiClient';
import { GraphCtx } from './lib/graphContext';

/* ── Model list ── */
const FALLBACK_MODELS = [
  'ibm/granite-3-8b-instruct', 'ibm/granite-4-h-small',
  'ibm/granite-8b-code-instruct', 'meta-llama/llama-3-3-70b-instruct',
  'meta-llama/llama-4-maverick-17b-128e-instruct-fp8',
  'mistralai/mistral-medium-2505', 'openai/gpt-oss-120b',
];

/* ── Custom node type registration (useMemo inside component) ── */
const NODE_TYPES = { api: ApiNode };

/* ── Atmospheric canvas background — vivid colored orbs ── */
function AtmosphericBg({ theme }) {
  const dark = theme !== 'light';
  return (
    <div className="atm-bg" style={{ zIndex: 0 }}>
      {/* Orb 1 — blue, top-left */}
      <div style={{
        position: 'absolute',
        width: 900, height: 900, borderRadius: '50%',
        background: dark
          ? 'radial-gradient(circle, rgba(79,142,247,0.40) 0%, rgba(79,142,247,0.10) 45%, transparent 70%)'
          : 'radial-gradient(circle, rgba(79,142,247,0.38) 0%, rgba(79,142,247,0.10) 45%, transparent 70%)',
        top: -260, left: -200,
        filter: 'blur(18px)',
        animation: 'orbFloat1 18s ease-in-out infinite',
        pointerEvents: 'none',
      }} />
      {/* Orb 2 — purple, bottom-right */}
      <div style={{
        position: 'absolute',
        width: 800, height: 800, borderRadius: '50%',
        background: dark
          ? 'radial-gradient(circle, rgba(176,110,247,0.38) 0%, rgba(176,110,247,0.08) 45%, transparent 70%)'
          : 'radial-gradient(circle, rgba(176,110,247,0.34) 0%, rgba(176,110,247,0.08) 45%, transparent 70%)',
        bottom: -180, right: -140,
        filter: 'blur(22px)',
        animation: 'orbFloat2 22s ease-in-out infinite 3s',
        pointerEvents: 'none',
      }} />
      {/* Orb 3 — cyan, center */}
      <div style={{
        position: 'absolute',
        width: 600, height: 600, borderRadius: '50%',
        background: dark
          ? 'radial-gradient(circle, rgba(46,216,240,0.26) 0%, rgba(46,216,240,0.06) 45%, transparent 70%)'
          : 'radial-gradient(circle, rgba(46,216,240,0.20) 0%, rgba(46,216,240,0.05) 45%, transparent 70%)',
        top: '32%', left: '42%',
        filter: 'blur(28px)',
        animation: 'orbFloat1 28s ease-in-out infinite 8s',
        pointerEvents: 'none',
      }} />
      {/* Orb 4 — green, middle-left */}
      <div style={{
        position: 'absolute',
        width: 500, height: 500, borderRadius: '50%',
        background: dark
          ? 'radial-gradient(circle, rgba(26,224,160,0.22) 0%, rgba(26,224,160,0.05) 50%, transparent 70%)'
          : 'radial-gradient(circle, rgba(26,224,160,0.20) 0%, rgba(26,224,160,0.05) 50%, transparent 70%)',
        top: '52%', left: '8%',
        filter: 'blur(32px)',
        animation: 'orbFloat2 32s ease-in-out infinite 12s',
        pointerEvents: 'none',
      }} />
      {/* Orb 5 — indigo, top-right */}
      <div style={{
        position: 'absolute',
        width: 500, height: 500, borderRadius: '50%',
        background: dark
          ? 'radial-gradient(circle, rgba(124,127,245,0.30) 0%, rgba(124,127,245,0.06) 45%, transparent 70%)'
          : 'radial-gradient(circle, rgba(124,127,245,0.28) 0%, rgba(124,127,245,0.06) 45%, transparent 70%)',
        top: -80, right: 60,
        filter: 'blur(24px)',
        animation: 'orbFloat1 25s ease-in-out infinite 5s',
        pointerEvents: 'none',
      }} />
    </div>
  );
}

/* ── Floating camera controls ── */
function FloatingControls({ onFitView, onZoomIn, onZoomOut, onResetView }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 2,
      background: 'var(--bg-glass-panel)',
      backdropFilter: 'blur(32px)',
      WebkitBackdropFilter: 'blur(32px)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 12,
      padding: 4,
      boxShadow: 'var(--shadow-float)',
    }}>
      {[
        { icon: ZoomIn,    tip: 'Zoom in',   fn: onZoomIn    },
        { icon: ZoomOut,   tip: 'Zoom out',  fn: onZoomOut   },
        null, // separator
        { icon: Maximize2, tip: 'Fit view',  fn: onFitView   },
        { icon: RotateCcw, tip: 'Reset view',fn: onResetView },
      ].map((item, i) => {
        if (!item) return (
          <div key={i} style={{ height: 1, background: 'var(--border-subtle)', margin: '2px 4px' }} />
        );
        const Icon = item.icon;
        return (
          <button
            key={i}
            onClick={item.fn}
            data-tooltip={item.tip}
            style={{
              width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent',
              border: '1px solid transparent',
              borderRadius: 8,
              color: 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all var(--t-fast)',
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
            <Icon size={14} strokeWidth={1.8} />
          </button>
        );
      })}
    </div>
  );
}

/* ── Canvas empty / loading state ── */
function CanvasEmptyState({ isLoading }) {
  if (isLoading) {
    return (
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none', zIndex: 5,
      }}>
        <div style={{
          textAlign: 'center',
          animation: 'fadeIn 300ms ease',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, margin: '0 auto 18px',
            background: 'var(--bg-glass-panel)',
            backdropFilter: 'blur(24px)',
            border: '1px solid var(--border-default)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span className="animate-spin" style={{ fontSize: 26, display: 'inline-block' }}>⟳</span>
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 5px' }}>
            Analyzing codebase
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            Building your API graph…
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, width: 240, margin: '18px auto 0' }}>
            {[75, 55, 65].map((w, i) => (
              <div key={i} className="animate-shimmer" style={{
                height: 6, borderRadius: 100,
                width: `${w}%`, margin: '0 auto',
                background: 'var(--bg-elevated)',
              }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none', zIndex: 5,
    }}>
      <div className="animate-scale-in" style={{
        background: 'var(--bg-glass-panel)',
        backdropFilter: 'blur(32px) saturate(180%)',
        WebkitBackdropFilter: 'blur(32px) saturate(180%)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 18,
        padding: '36px 44px',
        textAlign: 'center',
        maxWidth: 380,
        boxShadow: 'var(--shadow-float)',
      }}>
        {/* Animated ghost nodes */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 10, marginBottom: 28,
        }}>
          {[
            { c: '#4F8EF7', d: '0s' },
            { c: '#B06EF7', d: '0.5s' },
            { c: '#1AE0A0', d: '1s' },
          ].map(({ c, d }, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 52, height: 30, borderRadius: 8,
                border: `1.5px solid ${c}50`,
                background: `${c}0A`,
                animation: `float ${3.5 + i * 0.8}s ease-in-out infinite`,
                animationDelay: d,
              }} />
              {i < 2 && (
                <div style={{ width: 16, height: 1, background: 'var(--border-default)' }} />
              )}
            </div>
          ))}
        </div>

        <h2 style={{
          fontSize: 18, fontWeight: 700, margin: '0 0 10px',
          color: 'var(--text-primary)', letterSpacing: '-0.02em',
        }}>
          No graph loaded
        </h2>
        <p style={{
          fontSize: 12.5, color: 'var(--text-secondary)',
          lineHeight: 1.7, margin: '0 0 18px',
        }}>
          Paste a local path or GitHub URL in the toolbar above,
          then click <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Load Graph</strong>.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, justifyContent: 'center' }}>
          {['Python', 'JS/TS', 'Java', 'Go', 'Rust', 'PHP'].map((l) => (
            <span key={l} style={{
              fontSize: 10.5, fontWeight: 500, padding: '3px 9px', borderRadius: 100,
              background: 'var(--accent-blue-soft)',
              border: '1px solid var(--border-accent)',
              color: 'var(--accent-blue)',
            }}>
              {l}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Right-panel camera button ── */
function CamBtn({ icon: Icon, tooltip, onClick }) {
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
        cursor: 'pointer',
        transition: 'all 120ms ease',
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
      <Icon size={14} strokeWidth={1.8} />
    </button>
  );
}

/* ══════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════ */
export default function IbmBobApiArchitectCanvas({
  mode = 'local', initialPath = '',
  onBack, theme = 'light', onToggleTheme,
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const nodeIdCounter = useRef(1);
  const rfInstanceRef = useRef(null);

  const [mainFilePath, setMainFilePath] = useState(initialPath);
  const [newNodeLabel, setNewNodeLabel] = useState('Router Node');
  const [newNodeKind,  setNewNodeKind]  = useState('router');
  const [loadedFilePath, setLoadedFilePath] = useState('');
  const [workspacePath,  setWorkspacePath]  = useState('');
  const [status, setStatus] = useState(
    initialPath ? 'Click Load Graph to visualize.' : 'Ready.',
  );

  const [selectedNode, setSelectedNode]       = useState(null);
  const [connectedNodeIds, setConnectedNodeIds] = useState(new Set());
  const [functionCode, setFunctionCode]       = useState('');
  const [activeFunctionId, setActiveFunctionId] = useState('');
  const [syntaxErrors, setSyntaxErrors]       = useState([]);
  const [isLoadingGraph, setIsLoadingGraph]   = useState(false);
  const [isSaving, setIsSaving]               = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isNodeChatOpen, setIsNodeChatOpen]   = useState(false);

  /* track when we need a post-render fitView */
  const pendingFitView  = useRef(false);
  const fitViewTimers   = useRef([]);

  const [isChatbotOpen,          setIsChatbotOpen]          = useState(false);
  const [isGenerateEndpointOpen, setIsGenerateEndpointOpen] = useState(false);
  const [isRefactorFunctionOpen, setIsRefactorFunctionOpen] = useState(false);

  const [availableModels, setAvailableModels] = useState([]);
  const [selectedModelId, setSelectedModelId] = useState('');
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelsSource,    setModelsSource]    = useState('fallback');
  const [modelsError,     setModelsError]     = useState('');

  const canEdit = mode === 'local';
  const showCodePanel = selectedNode?.data?.kind === 'function';
  const showNodeChat  = isNodeChatOpen && Boolean(selectedNode) && !showCodePanel;

  /* ── Sidebar width for navbar offset ── */
  const sidebarW = sidebarCollapsed ? 0 : 248;

  /* ── Load models ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoadingModels(true);
      try {
        const data = await fetchModelCatalog();
        const ids = (Array.isArray(data?.models) ? data.models : [])
          .map((m) => (typeof m === 'string' ? m : m?.id)).filter(Boolean);
        if (!ids.length) throw new Error('empty');
        if (!cancelled) {
          setAvailableModels(ids);
          setSelectedModelId((p) => ids.includes(p) ? p : (data?.default_model_id || ids[0]));
        }
      } catch {
        if (!cancelled) {
          setAvailableModels(FALLBACK_MODELS);
          setSelectedModelId((p) => FALLBACK_MODELS.includes(p) ? p : FALLBACK_MODELS[0]);
          setModelsError('Using fallback model list.');
        }
      } finally {
        if (!cancelled) setIsLoadingModels(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ── Normalize backend nodes → custom api type ── */
  const normalizeNodes = useCallback((rawNodes) => rawNodes.map((n) => ({
    ...n,
    type: 'api',
    style: { width: 220 },  // layout width only; visuals handled by ApiNode
  })), []);

  /* ── Create visual for manual nodes ── */
  const createManualNode = useCallback((kind, label) => {
    const needsSource = kind !== 'output';
    const needsTarget = kind !== 'input';
    return {
      type: 'api',
      style: { width: 220 },
      data: {
        label, kind, title: label, file: '', function_id: '',
        code: kind === 'function' ? `def ${label.replace(/\s+/g,'_').toLowerCase()}():\n    pass` : '',
      },
    };
  }, []);

  const getPosition = useCallback(() => {
    if (selectedNode?.position) return { x: selectedNode.position.x + 260, y: selectedNode.position.y + 40 };
    const idx = nodes.length;
    return { x: 100 + (idx % 4) * 260, y: 100 + Math.floor(idx / 4) * 140 };
  }, [nodes.length, selectedNode]);

  const onConnect = useCallback(
    (conn) => setEdges((cur) => addEdge({
      ...conn, animated: true, type: 'smoothstep',
      style: { stroke: '#7C7FF5', strokeWidth: 1.8, opacity: 0.85 },
    }, cur)),
    [setEdges],
  );

  /* ── Add node ── */
  const addManualNode = useCallback((reqKind, reqLabel) => {
    const kind  = reqKind ?? newNodeKind;
    const label = (reqLabel ?? newNodeLabel).trim() || (kind === 'router' ? 'Express Router' : 'New Node');
    const n     = createManualNode(kind, label);
    setNodes((cur) => [...cur, {
      id: `manual-${Date.now()}-${nodeIdCounter.current++}`,
      type: n.type, position: getPosition(), data: n.data, style: n.style,
    }]);
    setStatus(`Added ${kind} node: ${label}`);
  }, [createManualNode, getPosition, newNodeKind, newNodeLabel, setNodes]);

  const addQuickRouter = useCallback(() => addManualNode('router', 'Express Router'), [addManualNode]);

  /* ── Delete node ── */
  const deleteSelectedNode = useCallback(() => {
    if (!selectedNode?.id) return;
    const id = selectedNode.id;
    setNodes((cur) => cur.filter((n) => n.id !== id));
    setEdges((cur) => cur.filter((e) => e.source !== id && e.target !== id));
    setSelectedNode(null); setFunctionCode(''); setActiveFunctionId('');
    setStatus('Node deleted.');
  }, [selectedNode, setEdges, setNodes]);

  /* ── Apply graph payload ── */
  const applyGraphPayload = useCallback((payload, nextStatus) => {
    const gNodes = normalizeNodes(payload?.nodes || []);
    /* Color edges based on their index for visual variety */
    const EDGE_COLORS = ['#4F8EF7', '#7C7FF5', '#B06EF7', '#2ED8F0', '#1AE0A0'];
    const gEdges = (payload?.edges || []).map((e, i) => {
      const col = EDGE_COLORS[i % EDGE_COLORS.length];
      return {
        ...e, animated: true, type: 'smoothstep',
        style: { stroke: col, strokeWidth: 1.8, opacity: 0.75 },
      };
    });
    setNodes(gNodes); setEdges(gEdges);
    setSelectedNode((cur) => {
      if (cur?.id) { const retained = gNodes.find((n) => n.id === cur.id); if (retained) return retained; }
      return gNodes[0] || null;
    });
    if (nextStatus) setStatus(nextStatus);
  }, [normalizeNodes, setEdges, setNodes]);

  /* ── Load graph ── */
  const loadGraph = useCallback(async () => {
    const path = mainFilePath.trim();
    if (!path) { setStatus('Enter a path or GitHub URL.'); return; }
    setIsLoadingGraph(true); setStatus('Analyzing…');
    try {
      const payload = await loadMainFileGraph(path);
      const label = payload.source_label || payload.main_file_path || path;
      applyGraphPayload(payload, `Loaded ${payload.nodes?.length || 0} nodes`);
      setLoadedFilePath(label); setWorkspacePath(payload.workspace_path || '');
      setSyntaxErrors([]);
      /* signal that fitView should run after the next render cycle */
      pendingFitView.current = true;
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : 'Unexpected error'}`);
    } finally { setIsLoadingGraph(false); }
  }, [applyGraphPayload, mainFilePath]);

  /* ── Node click ── */
  const onNodeClick = useCallback((evt, node) => {
    /* Cancel any auto-fitView pending from graph load — user is interacting now */
    fitViewTimers.current.forEach(clearTimeout);
    fitViewTimers.current = [];
    pendingFitView.current = false;

    setSelectedNode(node);

    /* Compute IDs of nodes directly connected to the clicked node */
    if (node?.id) {
      const connected = new Set();
      edges.forEach((e) => {
        if (e.source === node.id) connected.add(e.target);
        if (e.target === node.id) connected.add(e.source);
      });
      setConnectedNodeIds(connected);
    }

    if (node?.data?.kind === 'function') {
      setFunctionCode(node.data.code || ''); setActiveFunctionId(node.data.function_id || '');
    } else { setFunctionCode(''); setActiveFunctionId(''); }

    setIsNodeChatOpen(true);

    /* If triggered from sidebar (no mouse event) pan canvas to show the node */
    if (evt === null && node?.position) {
      setTimeout(() => {
        const rf = rfInstanceRef.current;
        if (!rf) return;
        const zoom = Math.max(rf.getZoom(), 0.6);
        rf.setCenter(
          node.position.x + 110,
          node.position.y + 60,
          { duration: 420, zoom },
        );
      }, 40);
    }
  }, [edges]);

  const deselectNode = useCallback(() => {
    setSelectedNode(null); setFunctionCode(''); setActiveFunctionId('');
    setConnectedNodeIds(new Set()); setIsNodeChatOpen(false);
  }, []);

  /* ── Persist function ── */
  const persistFunction = useCallback(async (functionId, content, label) => {
    const payload = await saveFunctionContent(functionId, content);
    const errs = payload.syntax_errors || [];
    setSyntaxErrors(errs);
    if (payload.has_syntax_errors) { setStatus(`${label} — ${errs.length} syntax error(s)`); return payload; }
    if (payload.graph) {
      applyGraphPayload(payload.graph, `${label} — graph refreshed`);
      const refreshed = payload.graph.nodes?.find((n) => n?.data?.function_id === functionId);
      if (refreshed) { setSelectedNode(refreshed); setFunctionCode(refreshed.data?.code || ''); setActiveFunctionId(refreshed.data?.function_id || functionId); }
    } else { setStatus(label); }
    return payload;
  }, [applyGraphPayload]);

  const saveCurrentFunction = useCallback(async () => {
    if (!activeFunctionId) { setStatus('Select a function node first.'); return; }
    setIsSaving(true); setStatus('Saving…');
    try { await persistFunction(activeFunctionId, functionCode, 'Saved'); }
    catch (err) { setStatus(`Error: ${err instanceof Error ? err.message : 'Save failed'}`); }
    finally { setIsSaving(false); }
  }, [activeFunctionId, functionCode, persistFunction]);


  const handleGenerateEndpoint = useCallback((result) => {
    if (result.success) {
      setStatus(`✨ Generated endpoint: ${result.relative_path || result.file_path}`);
      if (result.syntax_errors?.length) {
        setSyntaxErrors(result.syntax_errors);
      }
      if (result.graph) {
        applyGraphPayload(result.graph, `Generated endpoint in ${result.relative_path || result.file_path} and refreshed graph.`);
        setLoadedFilePath(result.graph.main_file_path || result.file_path || loadedFilePath);
      } else if (loadedFilePath) {
        loadGraph();
      }
    }
  }, [applyGraphPayload, loadedFilePath, loadGraph]);

  const handleRefactorFunction = useCallback((result) => {
    if (result.success && result.generated_code) setFunctionCode(result.generated_code);
  }, []);

  const handleApplyRefactor = useCallback(async ({ functionId, generatedCode }) => {
    const id = functionId || activeFunctionId || selectedNode?.data?.function_id || '';
    if (!id) throw new Error('No function_id.'); if (!generatedCode?.trim()) throw new Error('Empty code.');
    setIsSaving(true); setStatus('Applying refactor…');
    try { await persistFunction(id, generatedCode, 'Refactor applied'); }
    finally { setIsSaving(false); }
  }, [activeFunctionId, persistFunction, selectedNode]);

  /* ── fitView after nodes are rendered (initial load only) ── */
  useEffect(() => {
    if (!pendingFitView.current || nodes.length === 0) return;
    pendingFitView.current = false;
    const t1 = setTimeout(() => rfInstanceRef.current?.fitView({ padding: 0.18, duration: 500 }), 250);
    const t2 = setTimeout(() => rfInstanceRef.current?.fitView({ padding: 0.18, duration: 400 }), 700);
    fitViewTimers.current = [t1, t2];
    return () => { clearTimeout(t1); clearTimeout(t2); fitViewTimers.current = []; };
  }, [nodes]);

  /* ── Camera controls ── */
  const handleFitView  = useCallback(() => rfInstanceRef.current?.fitView({ padding: 0.18, duration: 500 }), []);
  const handleZoomIn   = useCallback(() => rfInstanceRef.current?.zoomIn({ duration: 300 }), []);
  const handleZoomOut  = useCallback(() => rfInstanceRef.current?.zoomOut({ duration: 300 }), []);
  const handleReset    = useCallback(() => rfInstanceRef.current?.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 400 }), []);

  /* ── Zoom slider ── */
  const [currentZoom, setCurrentZoom] = useState(1);
  const handleViewportChange = useCallback((vp) => setCurrentZoom(vp.zoom), []);
  const LOG_MIN = Math.log(0.05);
  const LOG_MAX = Math.log(4);

  /* ─────────────── RENDER ─────────────── */
  return (
    <div
      data-theme={theme}
      style={{
        position: 'relative',
        height: '100vh', width: '100vw',
        overflow: 'hidden',
        background: 'var(--bg-base)',
        transition: 'background-color 0.4s',
      }}
    >
      {/* ── Layer 0: Atmospheric background ── */}
      <AtmosphericBg theme={theme} />

      {/* ── Layer 1: Full-viewport canvas ── */}
      <div
        className="canvas-workspace"
        style={{ position: 'absolute', inset: 0, zIndex: 1 }}
      >
        {nodes.length === 0 && <CanvasEmptyState isLoading={isLoadingGraph} />}

        <GraphCtx.Provider value={{ connectedNodeIds }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={deselectNode}
          onInit={(instance) => { rfInstanceRef.current = instance; }}
          onViewportChange={handleViewportChange}
          connectionLineStyle={{ stroke: 'rgba(79,142,247,0.6)', strokeWidth: 1.5 }}
          defaultEdgeOptions={{
            animated: true, type: 'smoothstep',
            style: { stroke: '#7C7FF5', strokeWidth: 1.8, opacity: 0.8 },
          }}
          /* Navigation */
          panOnDrag={true}
          panOnScroll={true}
          zoomOnScroll={false}
          zoomOnPinch={true}
          zoomOnDoubleClick={false}
          selectNodesOnDrag={false}
          /* snapToGrid intentionally OFF — causes position jump on click */
          minZoom={0.05}
          maxZoom={4}
          /* fitView prop removed — handled programmatically after nodes render */
          style={{ background: 'transparent', height: '100%', width: '100%' }}
          proOptions={{ hideAttribution: false }}
        >
          <MiniMap
            pannable zoomable
            nodeColor={(n) => {
              const k = n.data?.kind;
              if (k === 'input')    return '#2ED8F0';
              if (k === 'output')   return '#1AE0A0';
              if (k === 'router')   return '#4F8EF7';
              if (k === 'function') return '#B06EF7';
              return '#7C7F9A';
            }}
            maskColor={theme === 'light'
              ? 'rgba(238,237,248,0.72)'
              : 'rgba(7,7,9,0.72)'}
            style={{
              background: 'var(--bg-glass-panel)',
              backdropFilter: 'blur(20px)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 12,
              bottom: 16, right: 16,
            }}
          />
          <Background
            variant="dots"
            gap={24} size={1.2}
            color={theme === 'light' ? 'rgba(79,142,247,0.22)' : 'rgba(124,127,245,0.30)'}
          />
        </ReactFlow>
        </GraphCtx.Provider>

        {/* ── Zoom slider ── */}
        <div style={{
          position: 'absolute',
          bottom: 20,
          left: `calc(${sidebarW}px + 50%)`,
          transform: 'translateX(-50%)',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          background: 'var(--bg-glass-panel)',
          backdropFilter: 'blur(24px) saturate(160%)',
          WebkitBackdropFilter: 'blur(24px) saturate(160%)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 100,
          padding: '5px 10px 5px 8px',
          boxShadow: 'var(--shadow-float)',
          transition: 'left 0.28s cubic-bezier(0.4,0,0.2,1)',
          pointerEvents: 'auto',
          userSelect: 'none',
        }}>
          {/* Minus */}
          <button
            onClick={handleZoomOut}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 5, fontSize: 16, lineHeight: 1, fontFamily: 'inherit', flexShrink: 0 }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
          >−</button>

          {/* Track */}
          <input
            type="range"
            min={LOG_MIN}
            max={LOG_MAX}
            step={0.01}
            value={Math.log(Math.max(0.05, Math.min(4, currentZoom)))}
            onChange={(e) => {
              const zoom = Math.exp(parseFloat(e.target.value));
              rfInstanceRef.current?.zoomTo(zoom, { duration: 0 });
            }}
            className="zoom-slider"
            style={{ width: 110, cursor: 'pointer' }}
          />

          {/* Plus */}
          <button
            onClick={handleZoomIn}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 5, fontSize: 16, lineHeight: 1, fontFamily: 'inherit', flexShrink: 0 }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
          >+</button>

          {/* Label */}
          <span style={{
            fontSize: 9.5, fontWeight: 600,
            fontFamily: "'JetBrains Mono', monospace",
            color: 'var(--text-muted)',
            minWidth: 30, textAlign: 'right',
            letterSpacing: '0.03em',
          }}>
            {Math.round(currentZoom * 100)}%
          </span>
        </div>
      </div>

      {/* ── Layer 2: Left sidebar (floating glass) ── */}
      <div style={{
        position: 'absolute',
        left: 0, top: 0, bottom: 0,
        width: sidebarW,
        zIndex: 20,
        overflow: 'hidden',
        transition: 'width 0.28s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: sidebarCollapsed ? 'none' : '4px 0 24px rgba(0,0,0,0.45)',
      }}>
        <LeftSidebar
          collapsed={sidebarCollapsed}
          nodes={nodes}
          selectedNode={selectedNode}
          onSelectNode={onNodeClick.bind(null, null)}
          newNodeLabel={newNodeLabel}
          onNewNodeLabelChange={setNewNodeLabel}
          newNodeKind={newNodeKind}
          onNewNodeKindChange={setNewNodeKind}
          onAddNode={() => addManualNode()}
          onQuickAddRouter={addQuickRouter}
          onDeleteSelectedNode={deleteSelectedNode}
          canEdit={canEdit}
        />
      </div>

      {/* ── Layer 3: Floating command bar ── */}
      <div style={{
        position: 'absolute',
        top: 12,
        left: sidebarW + (sidebarCollapsed ? 12 : 16),
        right: 12,
        zIndex: 30,
        transition: 'left 0.28s cubic-bezier(0.4,0,0.2,1)',
      }}>
        <WorkspaceNavbar
          onBack={onBack}
          mode={mode}
          theme={theme}
          onToggleTheme={onToggleTheme}
          mainFilePath={mainFilePath}
          onMainFilePathChange={setMainFilePath}
          onLoadGraph={loadGraph}
          isLoading={isLoadingGraph}
          loadedFilePath={loadedFilePath}
          status={status}
          availableModels={availableModels}
          selectedModelId={selectedModelId}
          onSelectedModelIdChange={setSelectedModelId}
          isLoadingModels={isLoadingModels}
          modelsError={modelsError}
          onOpenChatbot={() => setIsChatbotOpen(true)}
          onOpenGenerateEndpoint={() => setIsGenerateEndpointOpen(true)}
          onOpenRefactorFunction={() => setIsRefactorFunctionOpen(true)}
          hasSelectedNode={Boolean(selectedNode?.id)}
          canEdit={canEdit}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
          onFitView={handleFitView}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
        />
      </div>

      {/* ── Layer 4: Right camera panel ── */}
      <div style={{
        position: 'absolute',
        right: 12,
        top: 72,
        zIndex: 25,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        background: 'var(--bg-glass-panel)',
        backdropFilter: 'blur(28px) saturate(170%)',
        WebkitBackdropFilter: 'blur(28px) saturate(170%)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 12,
        padding: 4,
        boxShadow: 'var(--shadow-float)',
      }}>
        {[
          { icon: ZoomIn,    tip: 'Zoom in',  fn: handleZoomIn  },
          { icon: ZoomOut,   tip: 'Zoom out', fn: handleZoomOut },
          null,
          { icon: Maximize2, tip: 'Fit view', fn: handleFitView },
          { icon: RotateCcw, tip: 'Reset',    fn: handleReset   },
        ].map((item, i) =>
          item === null ? (
            <div key={i} style={{ width: 20, height: 1, background: 'var(--border-subtle)', margin: '2px 0' }} />
          ) : (
            <CamBtn key={i} icon={item.icon} tooltip={item.tip} onClick={item.fn} />
          )
        )}
      </div>

      {/* ── Layer 5: Node chat panel ── */}
      {showNodeChat && (
        <div style={{
          position: 'absolute',
          right: 60,
          top: 72,
          zIndex: 24,
          animation: 'fadeInUp 220ms cubic-bezier(0.34,1.56,0.64,1) forwards',
        }}>
          <NodeChat
            node={selectedNode}
            selectedModelId={selectedModelId}
            onClose={deselectNode}
          />
        </div>
      )}

      {/* ── Layer 6: Slide-in code drawer ── */}
      <div style={{
        position: 'absolute',
        top: 72, right: 0, bottom: 0,
        width: 440,
        transform: showCodePanel ? 'translateX(0)' : 'translateX(440px)',
        transition: 'transform 0.32s cubic-bezier(0.4, 0, 0.2, 1)',
        zIndex: 22,
        boxShadow: showCodePanel ? '-6px 0 48px rgba(0,0,0,0.55)' : 'none',
        willChange: 'transform',
      }}>
        <CodeSidebar
          selectedTitle={selectedNode?.data?.title}
          filePath={selectedNode?.data?.file || ''}
          functionCode={functionCode}
          onFunctionCodeChange={setFunctionCode}
          onSaveFunction={saveCurrentFunction}
          onClose={deselectNode}
          isSaving={isSaving}
          isFunctionNode={showCodePanel}
          syntaxErrors={syntaxErrors}
          canEdit={canEdit}
        />
      </div>

      {/* ── Modals ── */}
      <AIChatbot
        isOpen={isChatbotOpen}
        onClose={() => setIsChatbotOpen(false)}
        selectedModelId={selectedModelId}
        context={{ selectedNode: selectedNode?.data?.title, selectedFile: selectedNode?.data?.file, workspacePath: loadedFilePath }}
      />
      <AIGenerateEndpoint
        isOpen={isGenerateEndpointOpen}
        onClose={() => setIsGenerateEndpointOpen(false)}
        onGenerated={handleGenerateEndpoint}
        defaultTargetFile={loadedFilePath || 'backend/main.py'}
        selectedModelId={selectedModelId}
      />
      <AIRefactorFunction
        isOpen={isRefactorFunctionOpen}
        onClose={() => setIsRefactorFunctionOpen(false)}
        selectedNode={selectedNode}
        workspacePath={workspacePath}
        onRefactored={handleRefactorFunction}
        onApplyRefactor={handleApplyRefactor}
        selectedModelId={selectedModelId}
        availableModels={availableModels}
        isLoadingModels={isLoadingModels}
        modelsSource={modelsSource}
        modelsError={modelsError}
      />
    </div>
  );
}
