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
    from langchain_agent_service import AutonomousWorkspaceAgent, DEFAULT_MODEL_ID
except ModuleNotFoundError:  # pragma: no cover - import path differs when packaged
    from backend.langchain_agent_service import AutonomousWorkspaceAgent, DEFAULT_MODEL_ID


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
    workspace_root = _ensure_workspace_root(bridge_main)
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
