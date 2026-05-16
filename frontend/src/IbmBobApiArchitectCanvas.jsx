import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import CodeSidebar from './components/CodeSidebar';
import TopBar from './components/TopBar';
import AIChatbot from './components/AIChatbot';
import AIGenerateEndpoint from './components/AIGenerateEndpoint';
import AIRefactorFunction from './components/AIRefactorFunction';
import { fetchModelCatalog, loadMainFileGraph, saveFunctionContent } from './lib/apiClient';

const FALLBACK_MODEL_IDS = [
  'cross-encoder/ms-marco-minilm-l-12-v2',
  'ibm/granite-3-1-8b-base',
  'ibm/granite-3-8b-instruct',
  'ibm/granite-4-h-small',
  'ibm/granite-8b-code-instruct',
  'ibm/granite-embedding-278m-multilingual',
  'ibm/granite-guardian-3-8b',
  'ibm/granite-ttm-1024-96-r2',
  'ibm/granite-ttm-1536-96-r2',
  'ibm/granite-ttm-512-96-r2',
  'ibm/slate-125m-english-rtrvr-v2',
  'ibm/slate-30m-english-rtrvr-v2',
  'intfloat/multilingual-e5-large',
  'meta-llama/llama-3-1-70b-gptq',
  'meta-llama/llama-3-1-8b',
  'meta-llama/llama-3-2-11b-vision-instruct',
  'meta-llama/llama-3-2-90b-vision-instruct',
  'meta-llama/llama-3-3-70b-instruct',
  'meta-llama/llama-4-maverick-17b-128e-instruct-fp8',
  'meta-llama/llama-guard-3-11b-vision',
  'mistral-large-2512',
  'mistralai/mistral-medium-2505',
  'mistralai/mistral-small-3-1-24b-instruct-2503',
  'openai/gpt-oss-120b',
  'sentence-transformers/all-minilm-l6-v2',
];

export default function IbmBobApiArchitectCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const nodeIdCounterRef = useRef(1);

  const [mainFilePath, setMainFilePath] = useState('');
  const [newNodeLabel, setNewNodeLabel] = useState('Router Node');
  const [newNodeKind, setNewNodeKind] = useState('router');
  const [loadedFilePath, setLoadedFilePath] = useState('');
  const [workspacePath, setWorkspacePath] = useState('');
  const [status, setStatus] = useState('Enter a main Python file path and click Load Graph.');
  const [selectedNode, setSelectedNode] = useState(null);
  const [functionCode, setFunctionCode] = useState('');
  const [activeFunctionId, setActiveFunctionId] = useState('');
  const [syntaxErrors, setSyntaxErrors] = useState([]);

  const [isLoadingGraph, setIsLoadingGraph] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // AI Feature States
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const [isGenerateEndpointOpen, setIsGenerateEndpointOpen] = useState(false);
  const [isRefactorFunctionOpen, setIsRefactorFunctionOpen] = useState(false);
  const [availableModels, setAvailableModels] = useState([]);
  const [selectedModelId, setSelectedModelId] = useState('');
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelsSource, setModelsSource] = useState('fallback');
  const [modelsError, setModelsError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadModels = async () => {
      setIsLoadingModels(true);
      setModelsError('');
      try {
        const data = await fetchModelCatalog();
        const models = Array.isArray(data?.models) ? data.models : [];
        const modelIds = models
          .map((item) => (typeof item === 'string' ? item : item?.id))
          .filter(Boolean);

        if (!modelIds.length) {
          throw new Error('No models returned by server');
        }

        if (!cancelled) {
          setAvailableModels(modelIds);
          setSelectedModelId((prev) => (modelIds.includes(prev) ? prev : (data?.default_model_id || modelIds[0])));
          setModelsSource(data?.source || 'live');
        }
      } catch (error) {
        if (!cancelled) {
          setAvailableModels(FALLBACK_MODEL_IDS);
          setSelectedModelId((prev) => (FALLBACK_MODEL_IDS.includes(prev) ? prev : FALLBACK_MODEL_IDS[0]));
          setModelsSource('fallback');
          setModelsError('Could not load model catalog from backend. Using fallback list.');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingModels(false);
        }
      }
    };

    loadModels();

    return () => {
      cancelled = true;
    };
  }, []);

  const createNodeVisual = useCallback((kind, label) => {
    if (kind === 'input') {
      return {
        type: 'input',
        style: {
          background: '#1f2433',
          color: '#f4f4f4',
          border: '1px solid #0f62fe',
          borderRadius: 10,
          padding: 10,
          width: 240,
        },
      };
    }
    if (kind === 'output') {
      return {
        type: 'output',
        style: {
          background: '#1f2433',
          color: '#f4f4f4',
          border: '1px solid #0f62fe',
          borderRadius: 10,
          padding: 10,
          width: 240,
        },
      };
    }
    if (kind === 'router') {
      return {
        type: 'default',
        style: {
          background: '#1f2433',
          color: '#f4f4f4',
          border: '1px solid #0f62fe',
          borderRadius: 10,
          padding: 10,
          width: 240,
        },
        defaultLabel: label || 'Express Router',
      };
    }
    if (kind === 'function') {
      return {
        type: 'default',
        style: {
          background: '#20202f',
          color: '#f4f4f4',
          border: '1px solid #39394c',
          borderRadius: 10,
          padding: 10,
          width: 240,
        },
      };
    }
    return {
      type: 'default',
      style: {
        background: '#20202f',
        color: '#f4f4f4',
        border: '1px solid #39394c',
        borderRadius: 10,
        padding: 10,
        width: 240,
      },
    };
  }, []);

  const getNodePosition = useCallback(() => {
    if (selectedNode?.position) {
      return {
        x: selectedNode.position.x + 260,
        y: selectedNode.position.y + 40,
      };
    }

    const index = nodes.length;
    const col = index % 5;
    const row = Math.floor(index / 5);
    return {
      x: 80 + col * 250,
      y: 90 + row * 140,
    };
  }, [nodes.length, selectedNode]);

  const onConnect = useCallback(
    (connection) => {
      setEdges((currentEdges) =>
        addEdge(
          {
            ...connection,
            animated: true,
            style: { stroke: '#0f62fe' },
          },
          currentEdges,
        ),
      );
    },
    [setEdges],
  );

  const addManualNode = useCallback(
    (requestedKind, requestedLabel) => {
      const kind = requestedKind || newNodeKind;
      const rawLabel = (requestedLabel ?? newNodeLabel).trim();
      const visual = createNodeVisual(kind, rawLabel);
      const label = visual.defaultLabel || rawLabel || 'New Node';
      const nodeId = `manual-${Date.now()}-${nodeIdCounterRef.current++}`;
      const position = getNodePosition();

      const newNode = {
        id: nodeId,
        type: visual.type,
        position,
        data: {
          label,
          kind,
          title: label,
          file: '',
          function_id: '',
          code: kind === 'function' ? `def ${label.replace(/\s+/g, '_').toLowerCase()}():\n    pass` : '',
        },
        style: visual.style,
      };

      setNodes((currentNodes) => [...currentNodes, newNode]);
      setStatus(`Added ${kind} node: ${label}`);
    },
    [createNodeVisual, getNodePosition, newNodeKind, newNodeLabel, setNodes],
  );

  const addQuickRouter = useCallback(() => {
    addManualNode('router', 'Express Router');
  }, [addManualNode]);

  const deleteSelectedNode = useCallback(() => {
    if (!selectedNode?.id) {
      return;
    }
    const selectedId = selectedNode.id;
    setNodes((currentNodes) => currentNodes.filter((node) => node.id !== selectedId));
    setEdges((currentEdges) =>
      currentEdges.filter((edge) => edge.source !== selectedId && edge.target !== selectedId),
    );
    setSelectedNode(null);
    setFunctionCode('');
    setActiveFunctionId('');
    setStatus('Deleted selected node.');
  }, [selectedNode, setEdges, setNodes]);

  const applyGraphPayload = useCallback(
    (graphPayload, nextStatus) => {
      const graphNodes = graphPayload?.nodes || [];
      const graphEdges = graphPayload?.edges || [];

      setNodes(graphNodes);
      setEdges(graphEdges);
      setSelectedNode((currentNode) => {
        if (currentNode?.id) {
          const retainedNode = graphNodes.find((node) => node.id === currentNode.id);
          if (retainedNode) {
            return retainedNode;
          }
        }
        return graphNodes[0] || null;
      });

      if (nextStatus) {
        setStatus(nextStatus);
      }
    },
    [setEdges, setNodes],
  );

  const loadGraph = useCallback(async () => {
    const trimmedPath = mainFilePath.trim();
    if (!trimmedPath) {
      setStatus('Error: Main Python file path is required.');
      return;
    }

    setIsLoadingGraph(true);
    setStatus('Loading graph from backend...');

    try {
      const payload = await loadMainFileGraph(trimmedPath);
      applyGraphPayload(payload, `Loaded ${payload.nodes?.length || 0} nodes from ${payload.main_file_path || trimmedPath}`);
      setLoadedFilePath(payload.main_file_path || trimmedPath);
      setWorkspacePath(payload.workspace_path || '');
      setSyntaxErrors([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected loading error';
      setStatus(`Error: ${message}`);
    } finally {
      setIsLoadingGraph(false);
    }
  }, [applyGraphPayload, mainFilePath]);

  const onNodeClick = useCallback((_, node) => {
    setSelectedNode(node);
    if (node?.data?.kind === 'function') {
      setFunctionCode(node?.data?.code || '');
      setActiveFunctionId(node?.data?.function_id || '');
    } else {
      setFunctionCode('');
      setActiveFunctionId('');
    }
  }, []);

  const persistFunctionContent = useCallback(
    async (functionId, content, successStatus) => {
      const payload = await saveFunctionContent(functionId, content);
      const returnedErrors = payload.syntax_errors || [];
      setSyntaxErrors(returnedErrors);

      if (payload.has_syntax_errors) {
        setStatus(`${successStatus} with ${returnedErrors.length} syntax error(s).`);
        return payload;
      }

      if (payload.graph) {
        applyGraphPayload(payload.graph, `${successStatus} and graph refreshed.`);
        const refreshedNode = payload.graph.nodes?.find(
          (node) => node?.data?.function_id === functionId,
        );
        if (refreshedNode) {
          setSelectedNode(refreshedNode);
          setFunctionCode(refreshedNode?.data?.code || '');
          setActiveFunctionId(refreshedNode?.data?.function_id || functionId);
        }
      } else {
        setStatus(successStatus);
      }

      return payload;
    },
    [applyGraphPayload],
  );

  const saveCurrentFunction = useCallback(async () => {
    if (!activeFunctionId) {
      setStatus('Error: Select a function node before saving.');
      return;
    }

    setIsSaving(true);
    setStatus('Saving function content...');

    try {
      await persistFunctionContent(activeFunctionId, functionCode, 'Function saved');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected save error';
      setStatus(`Error: ${message}`);
    } finally {
      setIsSaving(false);
    }
  }, [activeFunctionId, functionCode, persistFunctionContent]);

  const isFunctionNode = selectedNode?.data?.kind === 'function';
  const canSaveFunction = isFunctionNode && Boolean(selectedNode?.data?.function_id);

  // AI Feature Handlers
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
    if (result.success) {
      setStatus('Refactored function generated successfully.');
      if (result.generated_code) {
        setFunctionCode(result.generated_code);
      }
    }
  }, []);

  const handleApplyRefactor = useCallback(
    async ({ functionId, generatedCode }) => {
      const resolvedFunctionId = functionId || activeFunctionId || selectedNode?.data?.function_id || '';
      if (!resolvedFunctionId) {
        throw new Error('No function_id available to apply refactoring.');
      }
      if (!generatedCode?.trim()) {
        throw new Error('Generated refactored code is empty.');
      }

      setIsSaving(true);
      setStatus('Applying refactored function to source file...');
      try {
        await persistFunctionContent(resolvedFunctionId, generatedCode, 'Refactored function applied');
      } finally {
        setIsSaving(false);
      }
    },
    [activeFunctionId, persistFunctionContent, selectedNode],
  );

  return (
    <div className="flex h-screen w-screen flex-col bg-[#161616] text-slate-100">
      <TopBar
        mainFilePath={mainFilePath}
        onMainFilePathChange={setMainFilePath}
        onLoadGraph={loadGraph}
        newNodeLabel={newNodeLabel}
        onNewNodeLabelChange={setNewNodeLabel}
        newNodeKind={newNodeKind}
        onNewNodeKindChange={setNewNodeKind}
        onAddNode={() => addManualNode()}
        onQuickAddRouter={addQuickRouter}
        onDeleteSelectedNode={deleteSelectedNode}
        hasSelectedNode={Boolean(selectedNode?.id)}
        isLoading={isLoadingGraph}
        status={status}
        loadedFilePath={loadedFilePath}
        onOpenChatbot={() => setIsChatbotOpen(true)}
        onOpenGenerateEndpoint={() => setIsGenerateEndpointOpen(true)}
        onOpenRefactorFunction={() => setIsRefactorFunctionOpen(true)}
        availableModels={availableModels}
        selectedModelId={selectedModelId}
        onSelectedModelIdChange={setSelectedModelId}
        isLoadingModels={isLoadingModels}
        modelsSource={modelsSource}
        modelsError={modelsError}
      />

      <main className="flex min-h-0 flex-1">
        <section className="min-h-0 flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            connectionLineStyle={{ stroke: '#0f62fe' }}
            defaultEdgeOptions={{ animated: true, style: { stroke: '#0f62fe' } }}
            snapToGrid
            snapGrid={[20, 20]}
            fitView
            className="bg-[#161616]"
          >
            <MiniMap
              pannable
              zoomable
              nodeColor={(node) => {
                if (
                  node.data?.kind === 'input' ||
                  node.data?.kind === 'output' ||
                  node.data?.kind === 'router'
                ) {
                  return '#0f62fe';
                }
                return '#697077';
              }}
              maskColor="rgba(12, 12, 16, 0.65)"
              className="!bg-[#1a1d2b]"
            />
            <Controls className="!border-[#3a3a4a] !bg-[#1a1d2b] !text-slate-200" />
            <Background variant="dots" gap={12} size={1} color="#2d3f66" />
          </ReactFlow>
        </section>

        <CodeSidebar
          selectedTitle={selectedNode?.data?.title}
          filePath={selectedNode?.data?.file || ''}
          functionCode={functionCode}
          onFunctionCodeChange={setFunctionCode}
          onSaveFunction={saveCurrentFunction}
          isSaving={isSaving}
          isFunctionNode={canSaveFunction}
          syntaxErrors={syntaxErrors}
        />
      </main>

      {/* AI Feature Modals */}
      <AIChatbot
        isOpen={isChatbotOpen}
        onClose={() => setIsChatbotOpen(false)}
        selectedModelId={selectedModelId}
        context={{
          selectedNode: selectedNode?.data?.title,
          selectedFile: selectedNode?.data?.file,
          workspacePath: loadedFilePath,
        }}
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
