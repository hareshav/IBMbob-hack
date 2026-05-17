"""MCP-style routes backed by IBM watsonx and LangChain orchestration."""

from __future__ import annotations

import ast
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")
load_dotenv(Path(__file__).with_name(".env"))
try:
    from langchain_agent_service import AutonomousWorkspaceAgent, DEFAULT_MODEL_ID, build_code_map
except ModuleNotFoundError:  # pragma: no cover - import path differs when packaged
    from backend.langchain_agent_service import AutonomousWorkspaceAgent, DEFAULT_MODEL_ID, build_code_map


app = FastAPI(title="IBM Bob MCP Service")


class ChatCompletionPayload(BaseModel):
    messages: List[Dict[str, str]]
    context: Optional[Dict[str, Any]] = None
    model_id: Optional[str] = None


class EndpointPayload(BaseModel):
    path: str
    method: str
    description: str
    target_file: Optional[str] = None
    include_tests: bool = False
    model_id: Optional[str] = None


class RefactorPayload(BaseModel):
    function_id: str
    refactor_goal: str
    preserve_signature: bool = True
    model_id: Optional[str] = None
    workspace_path: Optional[str] = None


class RefactorPreviewPayload(BaseModel):
    """
    Pure-LLM refactor preview. The caller passes the source code directly so
    the backend doesn't need a connected workspace or filesystem access.
    Used by the diff-review flow in the code drawer - lets us show Bob's
    proposed code in both local AND github-URL workspaces without writing
    to disk. The separate /mcp/refactor-function endpoint still handles the
    legacy "apply immediately" path.
    """
    source_code: str
    function_name: str
    refactor_goal: str
    preserve_signature: bool = True
    model_id: Optional[str] = None


def _import_main_helpers() -> Any:
    try:
        import main as bridge_main
    except ModuleNotFoundError:
        from backend import main as bridge_main
    return bridge_main


def _ensure_workspace_root(bridge_main: Any, workspace_path: Optional[str] = None) -> Path:
    if workspace_path and workspace_path.strip():
        return Path(workspace_path.strip()).resolve()
    if bridge_main.CURRENT_WORKSPACE_PATH:
        return Path(bridge_main.CURRENT_WORKSPACE_PATH).resolve()
    raise HTTPException(status_code=400, detail="A workspace path must be connected first.")


def _load_runtime_config(bridge_main: Any) -> Dict[str, str]:
    loader = getattr(bridge_main, "_load_langchain_runtime_config", None)
    if callable(loader):
        return loader()

    from os import getenv

    api_key = getenv("WATSONX_API_KEY") or getenv("WATSONX_APIKEY")
    project_id = getenv("WATSONX_PROJECT_ID")
    url = getenv("WATSONX_URL") or getattr(bridge_main, "LANGCHAIN_DEFAULT_WATSONX_URL", "https://us-south.ml.cloud.ibm.com")
    if not api_key or not project_id:
        raise HTTPException(
            status_code=400,
            detail="Missing required environment variables for LangChain agent: WATSONX_API_KEY, WATSONX_PROJECT_ID",
        )
    return {
        "watsonx_api_key": api_key.strip(),
        "watsonx_project_id": project_id.strip(),
        "watsonx_url": url.strip(),
    }


def _resolve_target_file(bridge_main: Any, workspace_root: Optional[Path], target_file: Optional[str]) -> Path:
    candidate = target_file or bridge_main.CURRENT_MAIN_FILE_PATH or "backend/main.py"
    target_path = Path(candidate)
    if target_path.is_absolute():
        return target_path.resolve()

    if workspace_root is not None:
        return (workspace_root / target_path).resolve()

    return (Path.cwd() / target_path).resolve()


def _build_agent(
    bridge_main: Any,
    workspace_root: Path,
    model_id: Optional[str],
    runtime_config: Dict[str, str],
) -> AutonomousWorkspaceAgent:
    return AutonomousWorkspaceAgent(
        workspace_root=workspace_root,
        model_id=(model_id or DEFAULT_MODEL_ID),
        watsonx_url=runtime_config["watsonx_url"],
        watsonx_project_id=runtime_config["watsonx_project_id"],
        watsonx_api_key=runtime_config["watsonx_api_key"],
        max_iterations=bridge_main.LANGCHAIN_DEFAULT_MAX_ITERATIONS,
        verbose=False,
    )


def _parse_function_id(function_id: str) -> tuple[str, str]:
    if "::" not in function_id:
        raise HTTPException(status_code=400, detail="Invalid function_id format.")
    file_part, function_name = function_id.rsplit("::", 1)
    return file_part.strip(), function_name.strip()


@app.get("/mcp/models")
async def list_models() -> Dict[str, Any]:
    model_ids = [
        "ibm/granite-3-8b-instruct",
        "ibm/granite-8b-code-instruct",
        "ibm/granite-3-1-8b-base",
        "mistralai/mistral-medium-2505",
    ]
    return {"source": "local-catalog", "default_model_id": DEFAULT_MODEL_ID, "models": model_ids}


@app.post("/mcp/chat-completion")
async def chat_completion(payload: ChatCompletionPayload) -> Dict[str, Any]:
    bridge_main = _import_main_helpers()
    # Chat doesn't need an active workspace — fall back to cwd so the agent can be built.
    workspace_root = (
        Path(bridge_main.CURRENT_WORKSPACE_PATH).resolve()
        if bridge_main.CURRENT_WORKSPACE_PATH
        else Path.cwd()
    )
    runtime_config = _load_runtime_config(bridge_main)
    agent = _build_agent(bridge_main, workspace_root, payload.model_id, runtime_config)
    try:
        content = agent.chat_completion(payload.messages, payload.context)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Chat completion failed: {exc}") from exc
    return {"status": "success", "content": content}


@app.post("/mcp/generate-endpoint")
async def generate_endpoint(payload: EndpointPayload) -> Dict[str, Any]:
    bridge_main = _import_main_helpers()
    workspace_root: Optional[Path] = None
    if bridge_main.CURRENT_WORKSPACE_PATH:
        workspace_root = Path(bridge_main.CURRENT_WORKSPACE_PATH).resolve()

    target_path = _resolve_target_file(bridge_main, workspace_root, payload.target_file)

    if workspace_root is None:
        if not target_path.exists():
            raise HTTPException(status_code=404, detail=f"Target file does not exist: {target_path}")
        workspace_root = target_path.parent.resolve()
    else:
        if not target_path.is_relative_to(workspace_root):
            raise HTTPException(status_code=400, detail="Target file must stay inside the connected workspace.")

    if not target_path.exists():
        raise HTTPException(status_code=404, detail=f"Target file does not exist: {target_path}")

    if target_path.suffix.lower() != ".py":
        raise HTTPException(status_code=400, detail="Target file must be a Python file.")

    runtime_config = _load_runtime_config(bridge_main)
    agent = _build_agent(bridge_main, workspace_root, payload.model_id, runtime_config)
    change_request = (
        f"Create a new {payload.method.upper()} endpoint at {payload.path}. "
        f"Business description: {payload.description}. "
        "The output must be a structured JSON plan containing function artifacts with func_name, func_path, func_args, path_operation_decorator, decorators, source_file, and func_code. "
        "Write code that can be appended directly to the target file."
    )

    try:
        artifact = agent.generate_endpoint_artifacts(
            target_file=target_path,
            change_request=change_request,
            route_method=payload.method.upper(),
            route_path=payload.path,
        )

        file_changes = artifact.get("file_changes") or [
            {
                "file_path": artifact["file_path"],
                "source_after": artifact["source_after"],
            }
        ]

        changed_paths: List[Path] = []
        for file_change in file_changes:
            file_path = Path(file_change["file_path"]).resolve()
            file_path.parent.mkdir(parents=True, exist_ok=True)
            file_path.write_text(file_change["source_after"], encoding="utf-8")
            changed_paths.append(file_path)

        bridge_main.CURRENT_WORKSPACE_PATH = str(workspace_root)
        bridge_main.CURRENT_MAIN_FILE_PATH = str(target_path)
        graph_payload = bridge_main._build_workspace_graph(
            workspace_path=str(workspace_root),
            main_file_path=str(target_path),
        )
        bridge_main.CURRENT_GRAPH_FILES = graph_payload.get("source_files", [])

        syntax_errors = bridge_main._collect_syntax_errors(changed_paths, workspace_root)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Endpoint generation failed: {exc}") from exc

    return {
        "success": not bool(syntax_errors),
        "explanation": artifact["explanation"],
        "warnings": artifact["warnings"],
        "suggestions": artifact["suggestions"],
        "generated_functions": artifact["functions"],
        "generated_code": artifact["generated_code"],
        "file_path": artifact["file_path"],
        "relative_path": artifact["relative_path"],
        "graph": graph_payload,
        "syntax_errors": syntax_errors,
    }


@app.post("/mcp/refactor-function")
async def refactor_function(payload: RefactorPayload) -> Dict[str, Any]:
    bridge_main = _import_main_helpers()
    workspace_root = _ensure_workspace_root(bridge_main, payload.workspace_path)
    relative_file, function_name = _parse_function_id(payload.function_id)
    target_path = bridge_main._resolve_requested_file(relative_file, workspace_root, must_exist=True)

    try:
        source = target_path.read_text(encoding="utf-8")
        runtime_config = _load_runtime_config(bridge_main)
        agent = _build_agent(bridge_main, workspace_root, payload.model_id, runtime_config)
        result = agent.refactor_function(
            source_code=source,
            function_name=function_name,
            refactor_goal=payload.refactor_goal,
            preserve_signature=payload.preserve_signature,
        )
        text_range = bridge_main._locate_function_range_by_text(source, function_name)
        if text_range is None:
            raise HTTPException(status_code=404, detail=f"Function '{function_name}' was not found in {relative_file}.")
        start_index, end_index = text_range
        original_lines = source.splitlines(keepends=True)
        replacement = result["generated_code"]
        if replacement and not replacement.endswith("\n"):
            replacement += "\n"
        updated_source = "".join([*original_lines[:start_index], *replacement.splitlines(keepends=True), *original_lines[end_index:]])
        ast.parse(updated_source)
        target_path.write_text(updated_source, encoding="utf-8")

        graph_payload = bridge_main._build_workspace_graph(
            workspace_path=str(workspace_root),
            main_file_path=bridge_main.CURRENT_MAIN_FILE_PATH or None,
        )
        bridge_main.CURRENT_GRAPH_FILES = graph_payload.get("source_files", [])
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Refactor failed: {exc}") from exc

    return {
        "success": True,
        "explanation": result["explanation"],
        "generated_code": result["generated_code"],
        "warnings": result["warnings"],
        "suggestions": result["suggestions"],
        "file_path": str(target_path),
        "relative_path": str(target_path.relative_to(workspace_root)).replace("\\", "/"),
        "graph": graph_payload,
    }


@app.post("/mcp/refactor-preview")
async def refactor_preview(payload: RefactorPreviewPayload) -> Dict[str, Any]:
    """
    Pure-LLM refactor: returns Bob's proposed code without touching the
    filesystem. The frontend uses this to populate the diff view in the
    code drawer; a separate save call writes the accepted code to disk.

    Works in github-URL mode because nothing on disk is needed - the source
    is shipped in the payload. Also avoids the double-write problem the
    original /mcp/refactor-function had when combined with save-function-content.
    """
    if not payload.source_code.strip():
        raise HTTPException(status_code=400, detail="source_code is required.")
    if not payload.refactor_goal.strip():
        raise HTTPException(status_code=400, detail="refactor_goal is required.")

    bridge_main = _import_main_helpers()
    runtime_config = _load_runtime_config(bridge_main)
    workspace_root = _workspace_root_or_cwd(bridge_main)
    agent = _build_agent(bridge_main, workspace_root, payload.model_id, runtime_config)

    try:
        result = agent.refactor_function(
            source_code=payload.source_code,
            function_name=payload.function_name,
            refactor_goal=payload.refactor_goal.strip(),
            preserve_signature=payload.preserve_signature,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Refactor preview failed: {exc}") from exc

    return {
        "success": True,
        "generated_code": result.get("generated_code", ""),
        "explanation":    result.get("explanation", ""),
        "warnings":       result.get("warnings", []),
        "suggestions":    result.get("suggestions", []),
    }


# ── AI Graph ─────────────────────────────────────────────────────────────────

class AIGraphPayload(BaseModel):
    path: str
    model_id: Optional[str] = None


@app.post("/mcp/ai-graph")
async def ai_graph(payload: AIGraphPayload) -> Dict[str, Any]:
    """
    Ask IBM Bob AI to analyse a workspace and return a semantic graph.
    The workspace can be a local path or a GitHub URL (cloned first).
    """
    bridge_main = _import_main_helpers()
    runtime_config = _load_runtime_config(bridge_main)

    # Resolve workspace root — local path or GitHub clone
    raw_path = payload.path.strip()
    workspace_root: Path

    if raw_path.startswith(("http://", "https://", "git@")):
        # GitHub URL — delegate to main.py's clone helper if available
        clone_fn = getattr(bridge_main, "_clone_github_repo", None)
        if not callable(clone_fn):
            raise HTTPException(
                status_code=400,
                detail="GitHub URL cloning is not available in this runtime.",
            )
        try:
            workspace_root = Path(clone_fn(raw_path)).resolve()
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Failed to clone repo: {exc}") from exc
    else:
        workspace_root = Path(raw_path).resolve()
        if not workspace_root.exists():
            raise HTTPException(status_code=404, detail=f"Path not found: {workspace_root}")

    # Build condensed code map
    try:
        code_map = build_code_map(workspace_root)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to build code map: {exc}") from exc

    # Ask watsonx to analyse and return graph JSON
    agent = _build_agent(bridge_main, workspace_root, payload.model_id, runtime_config)
    try:
        raw_graph = agent.analyze_graph(code_map)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {exc}") from exc

    # Normalise to React Flow node/edge format
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []

    for n in raw_graph.get("nodes", []):
        nodes.append({
            "id": n["id"],
            "type": "default",
            "position": {"x": 0, "y": 0},  # dagre handles this on the frontend
            "data": {
                "label":       n.get("label", n["id"]),
                "title":       n.get("label", n["id"]),
                "kind":        n.get("kind", "function"),
                "group":       n.get("group", "utils"),
                "description": n.get("description", ""),
                "file":        n.get("file", ""),
                "risk":        0.0,
                "fan_in":      0,
                "fan_out":     0,
                "state":       "calm",
            },
        })

    for e in raw_graph.get("edges", []):
        edge_type = e.get("edge_type", "call")
        edges.append({
            "id":     e.get("id", f"{e['source']}->{e['target']}"),
            "source": e["source"],
            "target": e["target"],
            "animated": True,
            "data": {"edge_type": edge_type},
        })

    return {
        "nodes":          nodes,
        "edges":          edges,
        "summary":        raw_graph.get("summary", ""),
        "workspace_path": str(workspace_root),
        "source":         "ai",
    }


class ScoreRiskNode(BaseModel):
    idx: int
    label: str
    file: Optional[str] = ""
    group: Optional[str] = "utils"
    fan_in: Optional[int] = 0
    fan_out: Optional[int] = 0
    risk: Optional[float] = 0.0


class ScoreRiskPayload(BaseModel):
    nodes: List[ScoreRiskNode]
    model_id: Optional[str] = None


class ConnectedNodeSummary(BaseModel):
    label: str
    group: Optional[str] = "utils"
    file: Optional[str] = ""


class SimulateChangePayload(BaseModel):
    node_label: str
    file: Optional[str] = ""
    description: str
    connected_nodes: List[ConnectedNodeSummary] = []
    model_id: Optional[str] = None


def _workspace_root_or_cwd(bridge_main: Any) -> Path:
    """
    Loose workspace resolver for LLM-only endpoints.
    Prefers the connected workspace if there is one, but falls back to a
    safe placeholder path because score-risk and simulate-change never
    touch the filesystem - they just construct a watsonx agent which
    requires *some* workspace_root in its constructor.
    """
    if bridge_main.CURRENT_WORKSPACE_PATH:
        try:
            return Path(bridge_main.CURRENT_WORKSPACE_PATH).resolve()
        except Exception:  # noqa: BLE001
            pass
    return Path.cwd().resolve()


@app.post("/mcp/score-risk")
async def score_risk(payload: ScoreRiskPayload) -> Dict[str, Any]:
    """
    Re-score a list of function nodes with IBM Bob (watsonx) and attach a
    short semantic risk description to each. Used by the frontend to enrich
    the graph after the "Ask Bob AI" button - turns each opaque risk bar
    into an explainable signal a judge can read at a glance.

    Returns: { scores: [{ idx, risk, description }, ...] }
    Only nodes the model successfully scored are returned; the caller
    leaves the rest on their static risk.

    NOTE: this is a pure LLM call - it does not need a connected workspace.
    """
    if not payload.nodes:
        return {"scores": []}

    bridge_main = _import_main_helpers()
    runtime_config = _load_runtime_config(bridge_main)
    workspace_root = _workspace_root_or_cwd(bridge_main)
    agent = _build_agent(bridge_main, workspace_root, payload.model_id, runtime_config)

    nodes_summary = [n.dict() for n in payload.nodes]
    try:
        scores = agent.score_risk(nodes_summary)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Risk scoring failed: {exc}") from exc

    return {"scores": scores}


@app.post("/mcp/simulate-change")
async def simulate_change(payload: SimulateChangePayload) -> Dict[str, Any]:
    """
    Ask IBM Bob to predict the blast radius of a planned change to a function.
    Returns { affectedLabels, explanation, riskDelta } so the frontend can
    animate the wave of impact across the graph.
    """
    if not payload.description.strip():
        raise HTTPException(status_code=400, detail="A change description is required.")

    bridge_main = _import_main_helpers()
    runtime_config = _load_runtime_config(bridge_main)
    workspace_root = _workspace_root_or_cwd(bridge_main)
    agent = _build_agent(bridge_main, workspace_root, payload.model_id, runtime_config)

    connected = [n.dict() for n in payload.connected_nodes]
    try:
        result = agent.simulate_change(
            node_label=payload.node_label,
            file_path=payload.file or "",
            description=payload.description.strip(),
            connected_nodes=connected,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Simulation failed: {exc}") from exc

    return result
