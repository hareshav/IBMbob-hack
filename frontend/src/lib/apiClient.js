export const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

async function parseResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.detail || payload?.message || `HTTP ${response.status}`;
    throw new Error(detail);
  }
  return payload;
}

export async function loadMainFileGraph(path) {
  const response = await fetch(`${BACKEND_BASE_URL}/api/load-main-file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  return parseResponse(response);
}

export async function fetchFileContent(path) {
  const url = new URL(`${BACKEND_BASE_URL}/api/file-content`);
  url.searchParams.set('path', path);
  const response = await fetch(url.toString());
  return parseResponse(response);
}

export async function saveFileContent(path, content) {
  const response = await fetch(`${BACKEND_BASE_URL}/api/save-file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content }),
  });
  return parseResponse(response);
}

export async function saveFunctionContent(functionId, content) {
  const response = await fetch(`${BACKEND_BASE_URL}/api/save-function-content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ function_id: functionId, content }),
  });
  return parseResponse(response);
}

export async function fetchModelCatalog() {
  const response = await fetch(`${BACKEND_BASE_URL}/mcp/models`);
  return parseResponse(response);
}

export async function requestEndpointGeneration(payload) {
  const response = await fetch(`${BACKEND_BASE_URL}/mcp/generate-endpoint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseResponse(response);
}

export async function requestFunctionRefactor(payload) {
  const response = await fetch(`${BACKEND_BASE_URL}/mcp/refactor-function`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseResponse(response);
}

/**
 * Preview-only refactor: ship the source code in the payload, Bob returns the
 * proposed rewrite without touching the filesystem. Works in github-URL mode
 * (no workspace connection needed) and lets us show the diff before any save.
 */
export async function requestFunctionRefactorPreview({
  sourceCode, functionName, refactorGoal, preserveSignature = true, modelId,
}) {
  const response = await fetch(`${BACKEND_BASE_URL}/mcp/refactor-preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source_code: sourceCode,
      function_name: functionName,
      refactor_goal: refactorGoal,
      preserve_signature: preserveSignature,
      model_id: modelId || undefined,
    }),
  });
  return parseResponse(response);
}

export async function requestChatCompletion(payload) {
  const response = await fetch(`${BACKEND_BASE_URL}/mcp/chat-completion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseResponse(response);
}

export async function requestAIGraph(path, modelId) {
  const response = await fetch(`${BACKEND_BASE_URL}/mcp/ai-graph`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, model_id: modelId || undefined }),
  });
  return parseResponse(response);
}

/* ── Router/function source-file CRUD (local-mode only on the UI side) ── */

export async function deleteFunctionFromSource(functionId) {
  const response = await fetch(`${BACKEND_BASE_URL}/api/function/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ function_id: functionId }),
  });
  return parseResponse(response);
}

export async function createRouterFile({ relativePath, routerName, prefix, tag }) {
  const response = await fetch(`${BACKEND_BASE_URL}/api/router/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      relative_path: relativePath,
      router_name: routerName || undefined,
      prefix: prefix || '',
      tag: tag || undefined,
    }),
  });
  return parseResponse(response);
}

/**
 * Re-score a batch of function nodes with IBM Bob (watsonx).
 * Each node entry needs at least { idx, label, file, group, fan_in, fan_out, risk }.
 * Bob returns [{ idx, risk, description }] for as many as it managed to score;
 * caller merges back into the full node list, leaving the rest on static risk.
 */
export async function scoreRiskWithBob(nodes, modelId) {
  const response = await fetch(`${BACKEND_BASE_URL}/mcp/score-risk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nodes, model_id: modelId || undefined }),
  });
  return parseResponse(response);
}

/**
 * Ask IBM Bob to predict the blast radius of a planned change.
 * Returns { affectedLabels, explanation, riskDelta }.
 */
export async function simulateChangeWithBob({ nodeLabel, file, description, connectedNodes, modelId }) {
  const response = await fetch(`${BACKEND_BASE_URL}/mcp/simulate-change`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      node_label: nodeLabel,
      file: file || '',
      description,
      connected_nodes: (connectedNodes || []).map((n) => ({
        label: n.label,
        group: n.group || 'utils',
        file: n.file || '',
      })),
      model_id: modelId || undefined,
    }),
  });
  return parseResponse(response);
}
