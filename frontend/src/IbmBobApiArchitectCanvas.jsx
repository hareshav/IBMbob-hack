import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background, MiniMap, ReactFlow,
  addEdge, useEdgesState, useNodesState,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw, ArrowLeft, Layers } from 'lucide-react';

import WorkspaceNavbar from './components/WorkspaceNavbar';
import LeftSidebar from './components/LeftSidebar';
import CodeSidebar from './components/CodeSidebar';
import NodeChat from './components/NodeChat';
import { ApiNode } from './components/ApiNode';
import { FlowEdge } from './components/FlowEdge';
import AIChatbot from './components/AIChatbot';
import AIGenerateEndpoint from './components/AIGenerateEndpoint';
import AIRefactorFunction from './components/AIRefactorFunction';
import CanvasSearch from './components/CanvasSearch';
import CanvasLegend from './components/CanvasLegend';
import GroupsPanel from './components/GroupsPanel';
import { fetchModelCatalog, loadMainFileGraph, saveFunctionContent, requestAIGraph,
         deleteFunctionFromSource, createRouterFile } from './lib/apiClient';
import { GraphCtx } from './lib/graphContext';
import { applyDagreLayout } from './lib/dagreLayout';
import { collapseGroups, distinctGroups, isSupernodeId } from './lib/groupCollapse';
import { aggregateByModule, extractModuleNodes, isModuleNodeId } from './lib/moduleAggregation';

/* ── Model list ── */
const FALLBACK_MODELS = [
  'ibm/granite-3-8b-instruct', 'ibm/granite-4-h-small',
  'ibm/granite-8b-code-instruct', 'meta-llama/llama-3-3-70b-instruct',
  'meta-llama/llama-4-maverick-17b-128e-instruct-fp8',
  'mistralai/mistral-medium-2505', 'openai/gpt-oss-120b',
];

/* ── Custom node/edge types — defined outside component so refs are stable ── */
const NODE_TYPES = { api: ApiNode };
const EDGE_TYPES = { flow: FlowEdge };

/* ── Edge type → color (kept in sync with FlowEdge's EDGE_CFG) ── */
const EDGE_COLOR = { api: '#2ED8F0', call: '#7C7FF5', default: '#4F8EF7' };
const arrowFor = (eType) => ({
  type: MarkerType.ArrowClosed,
  color: EDGE_COLOR[eType] || EDGE_COLOR.default,
  width: 16,
  height: 16,
});

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

  /* Raw graph (pre-collapse, pre-layout). Manual nodes/edges are appended here too. */
  const rawNodesRef = useRef([]);
  const rawEdgesRef = useRef([]);

  /* Group collapse state */
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set());
  const [availableGroups, setAvailableGroups] = useState([]); // [{group, count}]
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  /* Two-tier view: 'modules' shows one node per file; 'expanded' drills into one module */
  const [viewMode, setViewMode] = useState('modules');         // 'modules' | 'expanded'
  const [expandedModuleId, setExpandedModuleId] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false); // for fade animation

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
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

  const onConnect = useCallback((conn) => {
    const newEdge = {
      ...conn, type: 'flow', animated: false,
      data: { edge_type: 'call' },
      markerEnd: arrowFor('call'),
    };
    rawEdgesRef.current = [...(rawEdgesRef.current || []), newEdge];
    setEdges((cur) => addEdge(newEdge, cur));
  }, [setEdges]);

  /* ── Add node — kept in both raw and display so collapse re-derivation preserves it ── */
  const addManualNode = useCallback((reqKind, reqLabel) => {
    const kind  = reqKind ?? newNodeKind;
    const label = (reqLabel ?? newNodeLabel).trim() || (kind === 'router' ? 'Express Router' : 'New Node');
    const n     = createManualNode(kind, label);
    const newNode = {
      id: `manual-${Date.now()}-${nodeIdCounter.current++}`,
      type: n.type, position: getPosition(), data: n.data, style: n.style,
    };
    rawNodesRef.current = [...(rawNodesRef.current || []), newNode];
    setNodes((cur) => [...cur, newNode]);
    setStatus(`Added ${kind} node: ${label}`);
  }, [createManualNode, getPosition, newNodeKind, newNodeLabel, setNodes]);

  const addQuickRouter = useCallback(() => addManualNode('router', 'Express Router'), [addManualNode]);

  /* ── Visual-only node removal (used as fallback or in github mode) ── */
  /* ── Recompute displayed nodes/edges from rawNodesRef + rawEdgesRef + view state.
       Pipeline: viewMode branch (module aggregate OR module extract) → optional group collapse
                 → fan-in/spread bookkeeping → dagre. ── */
  const recomputeDisplay = useCallback((opts = {}) => {
    const { keepSelectionId } = opts;
    const rawN = rawNodesRef.current || [];
    const rawE = rawEdgesRef.current || [];

    /* Step 1: viewMode-aware base graph */
    let cNodes, cEdges;
    if (viewMode === 'modules') {
      const agg = aggregateByModule(rawN, rawE);
      cNodes = agg.nodes; cEdges = agg.edges;
      /* Add markerEnd to aggregated edges (since we built them fresh, not via applyGraphPayload) */
      cEdges = cEdges.map((e) => ({ ...e, markerEnd: arrowFor(e.data?.edge_type) }));
    } else if (viewMode === 'expanded' && expandedModuleId) {
      const ext = extractModuleNodes(rawN, rawE, expandedModuleId);
      const collapsed = collapseGroups(ext.nodes, ext.edges, collapsedGroups);
      cNodes = collapsed.nodes; cEdges = collapsed.edges;
    } else {
      cNodes = rawN; cEdges = rawE;
    }

    /* Step 2: per-target fan-in count for opacity in dense bundles */
    const fanInCount = {};
    cEdges.forEach((e) => { fanInCount[e.target] = (fanInCount[e.target] || 0) + 1; });

    /* Step 3: per-edge vertical spread so convergent edges don't overlap */
    const targetBuckets = {};
    cEdges.forEach((e, i) => {
      if (!targetBuckets[e.target]) targetBuckets[e.target] = [];
      targetBuckets[e.target].push(i);
    });

    const gEdges = cEdges.map((e, i) => {
      const bucket = targetBuckets[e.target];
      const n = bucket ? bucket.length : 1;
      const pos = bucket ? bucket.indexOf(i) : 0;
      const spread = n > 1 ? Math.min((n - 1) * 16, 80) : 0;
      const tYOff = n > 1 ? -spread / 2 + pos * (spread / (n - 1)) : 0;
      return {
        ...e,
        data: {
          ...e.data,
          targetYOffset: Math.round(tYOff),
          fanInCount: fanInCount[e.target] || 1,
        },
      };
    });

    const gNodes = applyDagreLayout(cNodes, gEdges);
    setNodes(gNodes);
    setEdges(gEdges);

    /* Retain selection where possible; otherwise clear (don't auto-select an arbitrary node) */
    setSelectedNode((cur) => {
      const targetId = keepSelectionId ?? cur?.id;
      if (targetId) {
        const retained = gNodes.find((n) => n.id === targetId);
        if (retained) return retained;
      }
      return null;
    });
  }, [collapsedGroups, viewMode, expandedModuleId, setEdges, setNodes]);

  /* ── Apply graph payload: normalises into raw, then recomputes display ── */
  const applyGraphPayload = useCallback((payload, nextStatus) => {
    const rawNodes = normalizeNodes(payload?.nodes || []);

    /* Wrap each edge as a FlowEdge with markerEnd matching its type */
    const rawEdges = (payload?.edges || []).map((e) => {
      const eType = e.data?.edge_type || 'call';
      return {
        ...e,
        type: 'flow',
        animated: false,
        data: { ...(e.data || {}), edge_type: eType },
        markerEnd: arrowFor(eType),
      };
    });

    rawNodesRef.current = rawNodes;
    rawEdgesRef.current = rawEdges;
    setAvailableGroups(distinctGroups(rawNodes));

    /* Fresh load: reset to modules view + clear collapses. useEffect will recompute. */
    const needsReset = viewMode !== 'modules' || expandedModuleId !== null || collapsedGroups.size > 0;
    if (needsReset) {
      setCollapsedGroups(new Set());
      setExpandedModuleId(null);
      setViewMode('modules');
    } else {
      recomputeDisplay();
    }
    if (nextStatus) setStatus(nextStatus);
  }, [normalizeNodes, collapsedGroups, viewMode, expandedModuleId, recomputeDisplay]);

  /* When collapse set or view mode changes, re-derive display */
  useEffect(() => {
    if ((rawNodesRef.current || []).length === 0) return;
    recomputeDisplay();
  }, [collapsedGroups, viewMode, expandedModuleId, recomputeDisplay]);

  /* ── Visual-only node removal (used as fallback or in github mode) ── */
  const removeNodeVisualOnly = useCallback((id) => {
    rawNodesRef.current = (rawNodesRef.current || []).filter((n) => n.id !== id);
    rawEdgesRef.current = (rawEdgesRef.current || []).filter((e) => e.source !== id && e.target !== id);
    setNodes((cur) => cur.filter((n) => n.id !== id));
    setEdges((cur) => cur.filter((e) => e.source !== id && e.target !== id));
    setSelectedNode(null); setFunctionCode(''); setActiveFunctionId('');
  }, [setEdges, setNodes]);

  /* ── Delete node — in local mode + real node ⇒ actually delete from source ── */
  const deleteSelectedNode = useCallback(async () => {
    if (!selectedNode?.id) return;
    const id = selectedNode.id;
    if (isSupernodeId(id)) { setStatus('Cannot delete a collapsed group — expand it first.'); return; }

    const isManual = id.startsWith('manual-');
    const fnId = selectedNode.data?.function_id;
    const canDeleteFromSource = canEdit && !isManual && fnId;

    if (!canDeleteFromSource) {
      removeNodeVisualOnly(id);
      setStatus(isManual ? 'Node deleted (visual).' : 'Node hidden (view-only mode — source not modified).');
      return;
    }

    const label = selectedNode.data?.title || selectedNode.data?.label || fnId;
    if (!window.confirm(`Delete function "${label}" from ${selectedNode.data?.file}?\n\nThis will modify the source file.`)) {
      return;
    }

    setStatus(`Deleting ${label} from source…`);
    try {
      const result = await deleteFunctionFromSource(fnId);
      if (result.has_syntax_errors) {
        setSyntaxErrors(result.syntax_errors || []);
        setStatus(`Deleted, but file has ${result.syntax_errors?.length || 0} syntax error(s).`);
      }
      if (result.graph) {
        applyGraphPayload(result.graph, `Deleted ${label} from ${result.relative_path}`);
      } else {
        removeNodeVisualOnly(id);
        setStatus(`Deleted ${label} from ${result.relative_path}.`);
      }
    } catch (err) {
      setStatus(`Delete failed: ${err instanceof Error ? err.message : 'error'}`);
    }
  }, [selectedNode, canEdit, removeNodeVisualOnly, applyGraphPayload]);

  /* ── Create router — in local mode prompts for a path then writes a real scaffold;
       in github (view-only) mode falls back to a visual node ── */
  const createRouter = useCallback(async () => {
    if (!canEdit) {
      addManualNode('router', 'Express Router');
      setStatus('Added router node (visual only — connect a local workspace to write files).');
      return;
    }
    const input = window.prompt(
      'Create a new router file.\n\nEnter the relative path (e.g. "backend/app/routers/products.py"):',
      'backend/app/routers/new_router.py',
    );
    if (!input || !input.trim()) return;
    const relativePath = input.trim();

    setStatus(`Creating router ${relativePath}…`);
    try {
      const result = await createRouterFile({
        relativePath,
        routerName: relativePath.split('/').pop().replace(/\.py$/, ''),
      });
      if (result.graph) {
        applyGraphPayload(result.graph, `Created router file ${result.relative_path}`);
      } else {
        setStatus(`Created ${result.relative_path}`);
      }
    } catch (err) {
      setStatus(`Create router failed: ${err instanceof Error ? err.message : 'error'}`);
    }
  }, [canEdit, addManualNode, applyGraphPayload]);

  /* ── Load graph (AST parser) ── */
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
      pendingFitView.current = true;
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : 'Unexpected error'}`);
    } finally { setIsLoadingGraph(false); }
  }, [applyGraphPayload, mainFilePath]);

  /* ── Load graph (IBM Bob AI semantic analysis) ── */
  const loadAIGraph = useCallback(async () => {
    const path = mainFilePath.trim();
    if (!path) { setStatus('Enter a path or GitHub URL.'); return; }
    setIsLoadingGraph(true);
    setStatus('IBM Bob AI is reading your codebase…');
    try {
      const payload = await requestAIGraph(path, selectedModelId);
      applyGraphPayload(payload, `AI graph: ${payload.nodes?.length || 0} components`);
      setLoadedFilePath(payload.workspace_path || path);
      setWorkspacePath(payload.workspace_path || '');
      setSyntaxErrors([]);
      if (payload.summary) setStatus(`AI: ${payload.summary}`);
      pendingFitView.current = true;
    } catch (err) {
      setStatus(`AI Error: ${err instanceof Error ? err.message : 'Unexpected error'}`);
    } finally { setIsLoadingGraph(false); }
  }, [applyGraphPayload, mainFilePath, selectedModelId]);

  /* ── Group collapse handlers ── */
  const toggleGroup = useCallback((group) => {
    setCollapsedGroups((cur) => {
      const next = new Set(cur);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }, []);
  const collapseAll = useCallback(() => {
    setCollapsedGroups(new Set(availableGroups.map((g) => g.group)));
  }, [availableGroups]);
  const expandAll = useCallback(() => setCollapsedGroups(new Set()), []);

  /* ── Pan/zoom camera to a node — used by both onNodeClick and CanvasSearch ── */
  const flyToNode = useCallback((node, opts = {}) => {
    if (!node?.position) return;
    const { duration = 500, minZoom = 0.85 } = opts;
    setTimeout(() => {
      const rf = rfInstanceRef.current;
      if (!rf) return;
      rf.setCenter(
        node.position.x + 110,
        node.position.y + 55,
        { duration, zoom: Math.max(rf.getZoom(), minZoom) },
      );
    }, 40);
  }, []);

  /* ── Open a module: cinematic zoom toward the card, fade, then expand ── */
  const openModule = useCallback((node) => {
    if (!node?.data?.moduleId) return;
    fitViewTimers.current.forEach(clearTimeout);
    fitViewTimers.current = [];

    /* Phase 1: fly camera toward the module card */
    flyToNode(node, { duration: 520, minZoom: 1.55 });
    setIsTransitioning(true);

    /* Phase 2: after the fly completes, swap the view to "expanded" */
    setTimeout(() => {
      setExpandedModuleId(node.data.moduleId);
      setViewMode('expanded');
      setStatus(`Opened module: ${node.data.label || node.data.file}`);
      /* Phase 3: re-fit to the newly-laid-out subgraph */
      setTimeout(() => {
        rfInstanceRef.current?.fitView({ padding: 0.22, duration: 520 });
        setIsTransitioning(false);
      }, 260);
    }, 380);
  }, [flyToNode]);

  /* ── Close an expanded module: zoom-out fade, then back to overview ── */
  const closeModule = useCallback(() => {
    setIsTransitioning(true);
    /* Pull camera back slightly to telegraph the zoom-out */
    const rf = rfInstanceRef.current;
    if (rf) {
      const cur = rf.getZoom();
      rf.zoomTo(Math.max(0.6, cur * 0.7), { duration: 320 });
    }
    setTimeout(() => {
      setExpandedModuleId(null);
      setViewMode('modules');
      setCollapsedGroups(new Set());
      setSelectedNode(null);
      setStatus('Back to modules overview.');
      setTimeout(() => {
        rfInstanceRef.current?.fitView({ padding: 0.2, duration: 520 });
        setIsTransitioning(false);
      }, 260);
    }, 320);
  }, []);

  /* ── Node click ── */
  const onNodeClick = useCallback((evt, node) => {
    /* Cancel any auto-fitView pending from graph load — user is interacting now */
    fitViewTimers.current.forEach(clearTimeout);
    fitViewTimers.current = [];
    pendingFitView.current = false;

    /* Module card: cinematic drill-in */
    if (node?.data?.kind === 'module') {
      openModule(node);
      return;
    }

    /* External-module stub: navigate to that module (swap, don't double-zoom) */
    if (node?.data?.kind === 'external' && node?.data?.moduleId) {
      setIsTransitioning(true);
      setTimeout(() => {
        setExpandedModuleId(node.data.moduleId);
        setStatus(`Jumped to module: ${node.data.label || node.data.moduleId}`);
        setTimeout(() => {
          rfInstanceRef.current?.fitView({ padding: 0.22, duration: 520 });
          setIsTransitioning(false);
        }, 280);
      }, 180);
      return;
    }

    /* Clicking a collapsed-group supernode expands it instead of selecting */
    if (node?.data?.kind === 'group' && node?.data?.group) {
      toggleGroup(node.data.group);
      setStatus(`Expanded group: ${node.data.group}`);
      return;
    }

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

    /* Always fly camera to the clicked node — longer zoom for direct clicks */
    flyToNode(node, {
      duration: evt === null ? 420 : 650,
      minZoom:  evt === null ? 0.6  : 0.9,
    });
  }, [edges, toggleGroup, flyToNode, openModule]);

  /* ── Search → pan & gently highlight the matched node ── */
  const handlePickSearchResult = useCallback((node) => {
    if (!node) return;
    flyToNode(node, { duration: 480, minZoom: 0.9 });
    setSelectedNode(node);

    /* Sync code drawer / function context (same logic as onNodeClick) */
    if (node?.data?.kind === 'function') {
      setFunctionCode(node.data.code || '');
      setActiveFunctionId(node.data.function_id || '');
    } else {
      setFunctionCode('');
      setActiveFunctionId('');
    }

    /* Refresh connection halo */
    const connected = new Set();
    edges.forEach((e) => {
      if (e.source === node.id) connected.add(e.target);
      if (e.target === node.id) connected.add(e.source);
    });
    setConnectedNodeIds(connected);
  }, [edges, flyToNode]);

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

  /* ── Global hotkeys: "/" opens search, Esc closes search or returns to modules, "F" fits view ── */
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      const inEditable = tag === 'input' || tag === 'textarea' || e.target?.isContentEditable;
      if (e.key === '/' && !inEditable) {
        e.preventDefault();
        setIsSearchOpen(true);
        return;
      }
      if (e.key === 'Escape') {
        if (isSearchOpen) { setIsSearchOpen(false); return; }
        if (viewMode === 'expanded') { closeModule(); return; }
      }
      if ((e.key === 'f' || e.key === 'F') && !inEditable) {
        e.preventDefault();
        rfInstanceRef.current?.fitView({ padding: 0.18, duration: 500 });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isSearchOpen, viewMode, closeModule]);

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

        <GraphCtx.Provider value={{ connectedNodeIds, hasSelection: Boolean(selectedNode?.id) }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={deselectNode}
          onInit={(instance) => { rfInstanceRef.current = instance; }}
          onViewportChange={handleViewportChange}
          connectionLineStyle={{ stroke: 'rgba(79,142,247,0.6)', strokeWidth: 1.5 }}
          defaultEdgeOptions={{ type: 'flow', animated: false, data: { edge_type: 'call' }, markerEnd: arrowFor('call') }}
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
              const g = n.data?.group;
              if (k === 'input')  return '#2ED8F0';
              if (k === 'output') return '#1AE0A0';
              if (k === 'router') return '#4F8EF7';
              if (k === 'function') {
                const GC = { api:'#7C7FF5', auth:'#F7B955', payments:'#1AE0A0',
                  notifications:'#2ED8F0', analytics:'#B06EF7', database:'#4F8EF7',
                  governance:'#F56565', profile:'#2ED8F0', content:'#B06EF7',
                  moderation:'#F56565', learning:'#1AE0A0', utils:'#7C7F9A' };
                return GC[g] || '#B06EF7';
              }
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
          onAddNode={canEdit
            ? () => setIsGenerateEndpointOpen(true)
            : () => addManualNode()
          }
          onQuickAddRouter={createRouter}
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
          onLoadAIGraph={loadAIGraph}
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
          canEdit={canEdit}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
          onFitView={handleFitView}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onAddManually={() => setSidebarCollapsed(false)}
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
          animation: 'fadeInUp 320ms cubic-bezier(0.34,1.56,0.64,1) forwards',
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
        transition: 'transform 0.42s cubic-bezier(0.34, 1.25, 0.64, 1)',
        zIndex: 22,
        boxShadow: showCodePanel ? '-6px 0 60px rgba(0,0,0,0.65), -2px 0 0 rgba(79,142,247,0.15)' : 'none',
        willChange: 'transform',
        overflow: 'hidden',
      }}>
        {/* Animated left-edge glow when panel is open */}
        {showCodePanel && (
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: 2,
            background: 'linear-gradient(180deg, #4F8EF7 0%, #B06EF7 50%, #2ED8F0 100%)',
            backgroundSize: '100% 300%',
            animation: 'gradientShift 4s ease infinite, edgeGlow 2s ease-in-out infinite',
            pointerEvents: 'none', zIndex: 10,
          }} />
        )}
        {/* Scan-line sweep — replays each time a new function is focused */}
        {showCodePanel && (
          <div key={activeFunctionId} style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 3,
            background: 'linear-gradient(90deg, transparent 0%, #4F8EF7 30%, #B06EF7 60%, #2ED8F0 80%, transparent 100%)',
            pointerEvents: 'none', zIndex: 11,
            animation: 'panelScan 0.72s cubic-bezier(0.4, 0, 0.6, 1) forwards',
            boxShadow: '0 0 16px 4px rgba(79,142,247,0.45)',
          }} />
        )}
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

      {/* ── Layer 7: Canvas search overlay (toggled by "/" key or via search button) ── */}
      <CanvasSearch
        nodes={nodes}
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onPick={handlePickSearchResult}
      />

      {/* ── Layer 8: Color legend (bottom-left) ── */}
      {nodes.length > 0 && <CanvasLegend />}

      {/* ── Layer 9: Groups panel — only useful when drilled into a module ── */}
      {viewMode === 'expanded' && availableGroups.length > 0 && (
        <GroupsPanel
          groups={availableGroups}
          collapsedGroups={collapsedGroups}
          onToggleGroup={toggleGroup}
          onCollapseAll={collapseAll}
          onExpandAll={expandAll}
        />
      )}

      {/* ── Layer 10: Back-to-modules pill (only when expanded) ── */}
      {viewMode === 'expanded' && (
        <button
          onClick={closeModule}
          style={{
            position: 'absolute',
            top: 72,
            left: sidebarW + (sidebarCollapsed ? 12 : 16),
            zIndex: 26,
            display: 'flex', alignItems: 'center', gap: 8,
            height: 34, padding: '0 14px 0 10px',
            background: 'var(--bg-glass-strong)',
            backdropFilter: 'blur(28px) saturate(180%)',
            WebkitBackdropFilter: 'blur(28px) saturate(180%)',
            border: '1px solid var(--border-default)',
            borderRadius: 100,
            color: 'var(--text-primary)',
            fontSize: 12, fontWeight: 600,
            fontFamily: 'inherit',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-float)',
            transition: 'all var(--t-fast), left 0.28s cubic-bezier(0.4,0,0.2,1)',
            animation: 'fadeInDown 280ms cubic-bezier(0.34,1.56,0.64,1) forwards',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-elevated)';
            e.currentTarget.style.borderColor = 'var(--accent-blue)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--bg-glass-strong)';
            e.currentTarget.style.borderColor = 'var(--border-default)';
          }}
        >
          <ArrowLeft size={13} strokeWidth={2.2} />
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Layers size={12} color="var(--accent-blue)" strokeWidth={2} />
            Modules
          </span>
          <span style={{
            marginLeft: 4,
            fontSize: 10, fontWeight: 500, color: 'var(--text-muted)',
            fontFamily: "'JetBrains Mono', monospace",
            paddingLeft: 8,
            borderLeft: '1px solid var(--border-default)',
          }}>
            {(expandedModuleId || '').split('/').slice(-1)[0] || expandedModuleId}
          </span>
        </button>
      )}

      {/* ── Layer 11: Transition fade overlay (during module open/close) ── */}
      {isTransitioning && (
        <div
          style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(circle at center, rgba(79,142,247,0.10) 0%, rgba(7,6,28,0.30) 70%)',
            pointerEvents: 'none',
            zIndex: 19,
            animation: 'fadeIn 200ms ease forwards',
          }}
        />
      )}

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
