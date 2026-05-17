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
