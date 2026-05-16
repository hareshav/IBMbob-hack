import ast
import builtins
import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

import uvicorn
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv
load_dotenv()

app = FastAPI(title="IBM Bob API Architect Canvas Bridge")
logger = logging.getLogger(__name__)

# Allow local frontend apps to call this bridge server from any origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MCP_ROUTES_ATTACHED = False
LANGCHAIN_AGENT_READY = False
AutonomousWorkspaceAgent = None
LANGCHAIN_DEFAULT_MODEL_ID = "ibm/granite-8b-code-instruct"
LANGCHAIN_DEFAULT_MAX_ITERATIONS = 24
LANGCHAIN_DEFAULT_WATSONX_URL = "https://us-south.ml.cloud.ibm.com"

# Mount MCP routes into the same backend process.
try:
    try:
        from mcp_service import app as mcp_app
    except ModuleNotFoundError:
        from backend.mcp_service import app as mcp_app

    app.include_router(mcp_app.router)
    MCP_ROUTES_ATTACHED = True
except Exception as exc:  # noqa: BLE001
    logger.warning("MCP routes could not be attached to main backend app: %s", exc)

# Initialize LangChain agent service in this same process.
try:
    try:
        from langchain_agent_service import (
            AutonomousWorkspaceAgent as _AutonomousWorkspaceAgent,
            DEFAULT_MAX_ITERATIONS as _AGENT_DEFAULT_MAX_ITERATIONS,
            DEFAULT_MODEL_ID as _AGENT_DEFAULT_MODEL_ID,
            DEFAULT_WATSONX_URL as _AGENT_DEFAULT_WATSONX_URL,
        )
    except ModuleNotFoundError:
        from backend.langchain_agent_service import (
            AutonomousWorkspaceAgent as _AutonomousWorkspaceAgent,
            DEFAULT_MAX_ITERATIONS as _AGENT_DEFAULT_MAX_ITERATIONS,
            DEFAULT_MODEL_ID as _AGENT_DEFAULT_MODEL_ID,
            DEFAULT_WATSONX_URL as _AGENT_DEFAULT_WATSONX_URL,
        )

    AutonomousWorkspaceAgent = _AutonomousWorkspaceAgent
    LANGCHAIN_DEFAULT_MODEL_ID = _AGENT_DEFAULT_MODEL_ID
    LANGCHAIN_DEFAULT_MAX_ITERATIONS = _AGENT_DEFAULT_MAX_ITERATIONS
    LANGCHAIN_DEFAULT_WATSONX_URL = _AGENT_DEFAULT_WATSONX_URL
    LANGCHAIN_AGENT_READY = True
except Exception as exc:  # noqa: BLE001
    logger.warning("LangChain agent service could not be initialized: %s", exc)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
TESTING_WORKSPACE_PATH = PROJECT_ROOT / "testing"
HTTP_DECORATORS = {"get", "post", "put", "delete", "patch"}
EXCLUDED_PARTS = {".venv", "__pycache__", "node_modules", ".bob", ".git"}

# Global runtime state for currently loaded workspace/file.
CURRENT_WORKSPACE_PATH: str = ""
CURRENT_MAIN_FILE_PATH: str = ""
CURRENT_GRAPH_FILES: List[str] = []


class WorkspacePayload(BaseModel):
    path: str


class EndpointPayload(BaseModel):
    path: str
    method: str
    description: str


class MainFilePayload(BaseModel):
    path: str


class FileSavePayload(BaseModel):
    path: str
    content: str


class FunctionSavePayload(BaseModel):
    function_id: str
    content: str


class AgentExecutionPayload(BaseModel):
    target_file: str = Field(..., description="Primary file path to inspect first.")
    change_request: str = Field(..., description="Architecture/code change request.")
    workspace_root: Optional[str] = Field(
        default=None,
        description="Workspace root for tool access. Defaults to active workspace or project root.",
    )
    model_id: Optional[str] = Field(
        default=None,
        description=f"watsonx model ID (default: {LANGCHAIN_DEFAULT_MODEL_ID}).",
    )
    max_iterations: int = Field(
        default=LANGCHAIN_DEFAULT_MAX_ITERATIONS,
        ge=1,
        le=100,
        description="Maximum agent reasoning/tool iterations.",
    )
    verbose: bool = Field(default=False, description="Enable per-iteration logs.")


def _safe_relative(file_path: Path, root: Path) -> str:
    try:
        return str(file_path.resolve().relative_to(root.resolve())).replace("\\", "/")
    except ValueError:
        return str(file_path.resolve()).replace("\\", "/")


def _is_within(path: Path, root: Path) -> bool:
    try:
        path.resolve().relative_to(root.resolve())
        return True
    except ValueError:
        return False


def _validate_workspace_path(path_value: str) -> Path:
    workspace = Path(path_value).resolve()
    if not workspace.exists():
        raise HTTPException(status_code=400, detail="Local directory path does not exist!")
    if not workspace.is_dir():
        raise HTTPException(status_code=400, detail="Provided workspace path is not a directory!")
    return workspace


def _validate_main_file_path(path_value: str) -> Path:
    main_file = Path(path_value).resolve()
    if not main_file.exists():
        raise HTTPException(status_code=400, detail="Main Python file path does not exist!")
    if not main_file.is_file():
        raise HTTPException(status_code=400, detail="Provided path is not a file!")
    if main_file.suffix.lower() != ".py":
        raise HTTPException(status_code=400, detail="Provided file must be a Python (.py) file!")
    return main_file


def _resolve_requested_file(path_value: str, workspace_root: Path, must_exist: bool = False) -> Path:
    incoming = Path(path_value)
    if incoming.is_absolute():
        resolved = incoming.resolve()
    else:
        resolved = (workspace_root / incoming).resolve()

    if not _is_within(resolved, workspace_root):
        raise HTTPException(status_code=400, detail="File path must stay inside the active workspace.")

    if must_exist and not resolved.exists():
        raise HTTPException(status_code=404, detail="Requested file does not exist.")

    return resolved


def _resolve_agent_workspace_root(workspace_root: Optional[str]) -> Path:
    if workspace_root and workspace_root.strip():
        candidate = Path(workspace_root.strip()).expanduser()
        resolved = candidate.resolve() if candidate.is_absolute() else (PROJECT_ROOT / candidate).resolve()
    elif CURRENT_WORKSPACE_PATH:
        resolved = Path(CURRENT_WORKSPACE_PATH).resolve()
    else:
        resolved = PROJECT_ROOT.resolve()

    if not resolved.exists() or not resolved.is_dir():
        raise HTTPException(status_code=400, detail=f"Invalid workspace root: {resolved}")
    if not _is_within(resolved, PROJECT_ROOT):
        raise HTTPException(status_code=400, detail="Workspace root must stay inside project root.")
    return resolved


def _load_langchain_runtime_config() -> Dict[str, str]:
    api_key = os.getenv("WATSONX_API_KEY") or os.getenv("WATSONX_APIKEY")
    project_id = os.getenv("WATSONX_PROJECT_ID")
    url = os.getenv("WATSONX_URL") or LANGCHAIN_DEFAULT_WATSONX_URL

    missing: List[str] = []
    if not api_key:
        missing.append("WATSONX_API_KEY")
    if not project_id:
        missing.append("WATSONX_PROJECT_ID")
    if missing:
        missing_display = ", ".join(missing)
        raise HTTPException(
            status_code=400,
            detail=f"Missing required environment variables for LangChain agent: {missing_display}",
        )

    return {
        "watsonx_api_key": api_key.strip(),
        "watsonx_project_id": project_id.strip(),
        "watsonx_url": url.strip(),
    }


def _should_skip(file_path: Path) -> bool:
    return any(part in EXCLUDED_PARTS for part in file_path.parts)


def _string_literal(node: ast.AST, default: str) -> str:
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    return default


def _extract_route_bindings(decorator: ast.AST) -> List[Tuple[str, str]]:
    if not isinstance(decorator, ast.Call):
        return []
    if not isinstance(decorator.func, ast.Attribute):
        return []

    attr_name = decorator.func.attr.lower()
    route_path = _string_literal(decorator.args[0], "/") if decorator.args else "/"

    if attr_name in HTTP_DECORATORS:
        return [(attr_name.upper(), route_path)]

    if attr_name == "api_route":
        methods: List[str] = []
        for keyword in decorator.keywords:
            if keyword.arg == "methods" and isinstance(keyword.value, (ast.List, ast.Tuple)):
                for method_node in keyword.value.elts:
                    methods.append(_string_literal(method_node, "").upper())
        methods = [method for method in methods if method]
        if not methods:
            methods = ["GET"]
        return [(method, route_path) for method in methods]

    return []


def _extract_source_segment(source_lines: List[str], node: ast.AST) -> str:
    if not hasattr(node, "lineno") or not hasattr(node, "end_lineno"):
        return ""
    start = max(getattr(node, "lineno", 1) - 1, 0)
    end = max(getattr(node, "end_lineno", start + 1), start + 1)
    return "\n".join(source_lines[start:end]).rstrip()


def _extract_called_names(function_node: ast.AST) -> List[str]:
    class OrderedCallCollector(ast.NodeVisitor):
        def __init__(self) -> None:
            self.called_names: List[str] = []
            self.seen: Set[str] = set()

        def visit_Call(self, node: ast.Call) -> Any:
            call_name = ""
            if isinstance(node.func, ast.Name):
                call_name = node.func.id
            elif isinstance(node.func, ast.Attribute):
                call_name = node.func.attr

            if call_name and call_name not in self.seen:
                self.seen.add(call_name)
                self.called_names.append(call_name)

            self.generic_visit(node)

    collector = OrderedCallCollector()
    collector.visit(function_node)
    return collector.called_names


def _syntax_error_payload(error: SyntaxError, file_path: Path, workspace_root: Path) -> Dict[str, Any]:
    return {
        "file": _safe_relative(file_path, workspace_root),
        "line": error.lineno or 0,
        "column": error.offset or 0,
        "message": error.msg,
        "text": (error.text or "").rstrip(),
    }


def _syntax_http_exception(error: SyntaxError, file_path: Path, workspace_root: Path) -> HTTPException:
    rel_file = _safe_relative(file_path, workspace_root)
    detail = f"Syntax error in {rel_file} at line {error.lineno or 0}: {error.msg}"
    return HTTPException(status_code=400, detail=detail)


def _parse_function_id(function_id: str) -> Tuple[str, str]:
    if "::" not in function_id:
        raise HTTPException(status_code=400, detail="Invalid function_id format.")
    file_part, function_name = function_id.rsplit("::", 1)
    file_part = file_part.strip()
    function_name = function_name.strip()
    if not file_part or not function_name:
        raise HTTPException(status_code=400, detail="Invalid function_id format.")
    return file_part, function_name


def _locate_function_range_by_text(source: str, function_name: str) -> Optional[Tuple[int, int]]:
    lines = source.splitlines(keepends=True)
    def_index: Optional[int] = None

    for index, line in enumerate(lines):
        stripped = line.lstrip()
        if line != stripped:
            continue
        if stripped.startswith(f"def {function_name}(") or stripped.startswith(f"async def {function_name}("):
            def_index = index
            break

    if def_index is None:
        return None

    start_index = def_index
    for index in range(def_index - 1, -1, -1):
        stripped = lines[index].lstrip()
        if lines[index] != stripped:
            break
        if stripped.startswith("@"):
            start_index = index
            continue
        if stripped.strip() == "":
            continue
        break

    end_index = len(lines)
    for index in range(def_index + 1, len(lines)):
        stripped = lines[index].lstrip()
        if lines[index] != stripped:
            continue
        if stripped.startswith(("def ", "async def ", "class ", "@")):
            end_index = index
            break

    return start_index, end_index


def _module_candidates(base_dir: Path, dotted_module: str) -> List[Path]:
    if not dotted_module:
        return []
    module_base = base_dir / Path(*dotted_module.split("."))
    return [module_base.with_suffix(".py"), module_base / "__init__.py"]


def _extract_local_import_files(tree: ast.AST, current_file: Path, workspace_root: Path) -> List[Path]:
    discovered: Set[Path] = set()

    for node in ast.walk(tree):
        candidate_paths: List[Path] = []

        if isinstance(node, ast.Import):
            for alias in node.names:
                candidate_paths.extend(_module_candidates(workspace_root, alias.name))

        elif isinstance(node, ast.ImportFrom):
            level = node.level or 0
            if level > 0:
                anchor = current_file.parent
                for _ in range(level - 1):
                    anchor = anchor.parent
            else:
                anchor = workspace_root

            module_name = node.module or ""
            module_base = anchor / Path(*module_name.split(".")) if module_name else anchor
            if module_name:
                candidate_paths.extend(_module_candidates(anchor, module_name))

            for alias in node.names:
                if alias.name == "*":
                    continue
                alias_module_name = f"{module_name}.{alias.name}" if module_name else alias.name
                candidate_paths.extend(_module_candidates(anchor, alias_module_name))
                alias_base = module_base / alias.name
                candidate_paths.append(alias_base.with_suffix(".py"))
                candidate_paths.append(alias_base / "__init__.py")

        for candidate in candidate_paths:
            try:
                resolved = candidate.resolve()
            except OSError:
                continue

            if not resolved.exists():
                continue
            if not resolved.is_file():
                continue
            if resolved.suffix.lower() != ".py":
                continue
            if _should_skip(resolved):
                continue
            if not _is_within(resolved, workspace_root):
                continue
            discovered.add(resolved)

    return sorted(discovered)


def _collect_workspace_python_files(workspace_root: Path) -> List[Path]:
    return sorted(
        file_path.resolve()
        for file_path in workspace_root.rglob("*.py")
        if file_path.is_file() and not _should_skip(file_path.resolve())
    )


def _collect_imported_python_files(
    main_file: Path,
    workspace_root: Path,
    strict: bool = True,
) -> List[Path]:
    queue: List[Path] = [main_file.resolve()]
    visited: Set[str] = set()
    collected: List[Path] = []

    while queue:
        current_file = queue.pop(0).resolve()
        key = str(current_file)
        if key in visited:
            continue
        visited.add(key)

        if not current_file.exists() or not current_file.is_file():
            continue
        if current_file.suffix.lower() != ".py":
            continue
        if _should_skip(current_file):
            continue
        if not _is_within(current_file, workspace_root):
            continue

        collected.append(current_file)

        try:
            source = current_file.read_text(encoding="utf-8")
            tree = ast.parse(source, filename=str(current_file))
        except SyntaxError as error:
            if strict:
                raise _syntax_http_exception(error, current_file, workspace_root) from error
            continue
        except OSError as error:
            if strict:
                raise HTTPException(status_code=500, detail=f"Failed to read file {current_file}: {error}") from error
            continue

        imports = _extract_local_import_files(tree, current_file, workspace_root)
        for imported_file in imports:
            imported_key = str(imported_file.resolve())
            if imported_key not in visited:
                queue.append(imported_file.resolve())

    return sorted(collected)


def _resolve_graph_context(workspace_path: str, main_file_path: Optional[str]) -> Tuple[Path, List[Path]]:
    if main_file_path:
        main_file = _validate_main_file_path(main_file_path)
        workspace_root = main_file.parent.resolve()
        python_files = _collect_imported_python_files(main_file, workspace_root, strict=True)
    else:
        workspace_root = _validate_workspace_path(workspace_path)
        python_files = _collect_workspace_python_files(workspace_root)

    if not python_files:
        raise HTTPException(status_code=404, detail="No Python files found in workspace.")

    return workspace_root, python_files


def _collect_syntax_errors(files: List[Path], workspace_root: Path) -> List[Dict[str, Any]]:
    syntax_errors: List[Dict[str, Any]] = []

    for file_path in sorted({path.resolve() for path in files}):
        try:
            source = file_path.read_text(encoding="utf-8")
            ast.parse(source, filename=str(file_path))
        except SyntaxError as error:
            syntax_errors.append(_syntax_error_payload(error, file_path, workspace_root))
        except OSError as error:
            syntax_errors.append(
                {
                    "file": _safe_relative(file_path, workspace_root),
                    "line": 0,
                    "column": 0,
                    "message": f"Unable to read file: {error}",
                    "text": "",
                }
            )

    return syntax_errors


def _current_graph_files_for_validation(workspace_root: Path) -> List[Path]:
    if CURRENT_MAIN_FILE_PATH:
        main_file = _validate_main_file_path(CURRENT_MAIN_FILE_PATH)
        return _collect_imported_python_files(main_file, workspace_root, strict=False)
    return _collect_workspace_python_files(workspace_root)


def _build_call_tree(
    endpoint_id: str,
    root_function_id: str,
    function_calls: Dict[str, List[str]],
) -> Dict[str, Any]:
    def walk(function_id: str, path_tokens: List[str], recursion_stack: Set[str]) -> Dict[str, Any]:
        path_key = "root" if not path_tokens else ".".join(path_tokens)
        node = {
            "id": f"{endpoint_id}::fn::{path_key}::{function_id}",
            "function_id": function_id,
            "children": [],
        }

        for child_index, called_function_id in enumerate(function_calls.get(function_id, [])):
            if called_function_id in recursion_stack:
                continue

            child_tokens = [*path_tokens, str(child_index)]
            child_node = walk(
                called_function_id,
                child_tokens,
                recursion_stack | {called_function_id},
            )
            node["children"].append(child_node)

        return node

    return walk(root_function_id, [], {root_function_id})


def _tree_leaf_count(tree_node: Dict[str, Any]) -> int:
    children = tree_node["children"]
    if not children:
        return 1
    return sum(_tree_leaf_count(child) for child in children)


def _tree_max_depth(tree_node: Dict[str, Any]) -> int:
    children = tree_node["children"]
    if not children:
        return 0
    return 1 + max(_tree_max_depth(child) for child in children)


def _assign_tree_positions(
    tree_node: Dict[str, Any],
    depth: int,
    start_x: float,
    step_x: float,
    row_gap_y: float,
    cursor_y: float,
    positions: Dict[str, Dict[str, float]],
) -> float:
    children = tree_node["children"]
    node_id = tree_node["id"]

    if not children:
        positions[node_id] = {"x": start_x + depth * step_x, "y": cursor_y}
        return cursor_y + row_gap_y

    next_cursor = cursor_y
    child_ys: List[float] = []
    for child in children:
        next_cursor = _assign_tree_positions(
            tree_node=child,
            depth=depth + 1,
            start_x=start_x,
            step_x=step_x,
            row_gap_y=row_gap_y,
            cursor_y=next_cursor,
            positions=positions,
        )
        child_ys.append(positions[child["id"]]["y"])

    positions[node_id] = {
        "x": start_x + depth * step_x,
        "y": sum(child_ys) / len(child_ys),
    }
    return next_cursor


def _build_workspace_graph(workspace_path: str, main_file_path: Optional[str] = None) -> Dict[str, Any]:
    workspace_root, python_files = _resolve_graph_context(workspace_path, main_file_path)
    builtin_names: Set[str] = set(dir(builtins))

    functions: Dict[str, Dict[str, Any]] = {}
    name_index: Dict[str, List[str]] = {}
    file_function_index: Dict[str, Dict[str, str]] = {}
    endpoints: List[Dict[str, Any]] = []

    for file_path in python_files:
        source = file_path.read_text(encoding="utf-8")
        source_lines = source.splitlines()
        tree = ast.parse(source, filename=str(file_path))
        rel_file = _safe_relative(file_path, workspace_root)

        function_nodes = [
            node
            for node in tree.body
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        ]

        file_function_index.setdefault(rel_file, {})

        for node in function_nodes:
            function_id = f"{rel_file}::{node.name}"
            functions[function_id] = {
                "id": function_id,
                "name": node.name,
                "file": rel_file,
                "code": _extract_source_segment(source_lines, node),
                "direct_calls": _extract_called_names(node),
            }
            file_function_index[rel_file][node.name] = function_id
            name_index.setdefault(node.name, []).append(function_id)

        for node in function_nodes:
            route_bindings: List[Tuple[str, str]] = []
            for decorator in node.decorator_list:
                route_bindings.extend(_extract_route_bindings(decorator))
            if not route_bindings:
                continue

            root_function_id = file_function_index[rel_file][node.name]
            for method, route_path in route_bindings:
                endpoint_id = f"endpoint::{root_function_id}::{method}::{route_path}"
                endpoints.append(
                    {
                        "id": endpoint_id,
                        "root_function_id": root_function_id,
                        "function_name": node.name,
                        "method": method,
                        "route_path": route_path,
                        "file": rel_file,
                        "code": _extract_source_segment(source_lines, node),
                    }
                )

    if not endpoints:
        if main_file_path:
            raise HTTPException(status_code=404, detail="No REST endpoints found in provided main file/import graph.")
        raise HTTPException(status_code=404, detail="No REST endpoints found in workspace.")

    function_calls: Dict[str, List[str]] = {}
    for function_id, function_meta in functions.items():
        filtered_calls: List[str] = []
        seen_targets: Set[str] = set()
        caller_file = function_meta["file"]

        for called_name in function_meta["direct_calls"]:
            if called_name in builtin_names:
                continue

            target_id: Optional[str] = None
            same_file_match = file_function_index.get(caller_file, {}).get(called_name)
            if same_file_match:
                target_id = same_file_match
            else:
                global_matches = name_index.get(called_name, [])
                if len(global_matches) == 1:
                    target_id = global_matches[0]

            if not target_id:
                continue
            if target_id == function_id:
                continue
            if target_id in seen_targets:
                continue

            seen_targets.add(target_id)
            filtered_calls.append(target_id)

        function_calls[function_id] = filtered_calls

    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []

    start_x = 70
    step_x = 260
    row_gap_y = 110
    endpoint_gap_y = 150
    top_cursor_y = 90.0

    for endpoint in endpoints:
        call_tree = _build_call_tree(
            endpoint_id=endpoint["id"],
            root_function_id=endpoint["root_function_id"],
            function_calls=function_calls,
        )
        positions: Dict[str, Dict[str, float]] = {}
        _assign_tree_positions(
            tree_node=call_tree,
            depth=1,
            start_x=start_x,
            step_x=step_x,
            row_gap_y=row_gap_y,
            cursor_y=top_cursor_y,
            positions=positions,
        )

        root_node_id = call_tree["id"]
        root_position = positions[root_node_id]
        input_node_id = f'{endpoint["id"]}::input'
        output_node_id = f'{endpoint["id"]}::output'

        nodes.append(
            {
                "id": input_node_id,
                "type": "input",
                "position": {"x": start_x, "y": root_position["y"]},
                "data": {
                    "label": f'{endpoint["method"]} {endpoint["route_path"]}\nInput',
                    "kind": "input",
                    "title": f'{endpoint["method"]} {endpoint["route_path"]}',
                    "file": endpoint["file"],
                    "code": endpoint["code"] or "# Endpoint handler source not found.",
                },
                "style": {
                    "background": "#1f2433",
                    "color": "#f4f4f4",
                    "border": "1px solid #0f62fe",
                    "borderRadius": 10,
                    "padding": 10,
                    "width": 240,
                },
            }
        )

        def append_tree_nodes(tree_node: Dict[str, Any]) -> None:
            function_id = tree_node["function_id"]
            fn_meta = functions.get(function_id)
            if not fn_meta:
                return

            fn_node_id = tree_node["id"]
            node_position = positions[fn_node_id]

            nodes.append(
                {
                    "id": fn_node_id,
                    "type": "default",
                    "position": {"x": node_position["x"], "y": node_position["y"]},
                    "data": {
                        "label": fn_meta["name"],
                        "kind": "function",
                        "title": fn_meta["name"],
                        "file": fn_meta["file"],
                        "function_id": fn_meta["id"],
                        "code": fn_meta["code"] or "# Function source not found.",
                    },
                    "style": {
                        "background": "#20202f",
                        "color": "#f4f4f4",
                        "border": "1px solid #39394c",
                        "borderRadius": 10,
                        "padding": 10,
                        "width": 240,
                    },
                }
            )

            for child_node in tree_node["children"]:
                child_id = child_node["id"]
                edges.append(
                    {
                        "id": f"{fn_node_id}->{child_id}",
                        "source": fn_node_id,
                        "target": child_id,
                        "animated": True,
                        "style": {"stroke": "#0f62fe"},
                    }
                )
                append_tree_nodes(child_node)

        append_tree_nodes(call_tree)

        edges.append(
            {
                "id": f"{input_node_id}->{root_node_id}",
                "source": input_node_id,
                "target": root_node_id,
                "animated": True,
                "style": {"stroke": "#0f62fe"},
            }
        )

        max_depth = _tree_max_depth(call_tree)
        output_x = start_x + (max_depth + 2) * step_x
        output_y = root_position["y"]

        nodes.append(
            {
                "id": output_node_id,
                "type": "output",
                "position": {"x": output_x, "y": output_y},
                "data": {
                    "label": "Output",
                    "kind": "output",
                    "title": "Output",
                    "file": endpoint["file"],
                    "code": "# Output node for response flow.",
                },
                "style": {
                    "background": "#1f2433",
                    "color": "#f4f4f4",
                    "border": "1px solid #0f62fe",
                    "borderRadius": 10,
                    "padding": 10,
                    "width": 220,
                },
            }
        )

        edges.append(
            {
                "id": f"{root_node_id}->{output_node_id}",
                "source": root_node_id,
                "target": output_node_id,
                "animated": True,
                "style": {"stroke": "#0f62fe"},
            }
        )

        leaf_count = _tree_leaf_count(call_tree)
        tree_visual_height = max(1, leaf_count - 1) * row_gap_y
        top_cursor_y += tree_visual_height + endpoint_gap_y

    return {
        "workspace_path": str(workspace_root),
        "source_files": [_safe_relative(path, workspace_root) for path in python_files],
        "nodes": nodes,
        "edges": edges,
    }


@app.on_event("startup")
async def log_runtime_components() -> None:
    logger.info("Unified backend startup complete.")
    logger.info("Main API bridge active: True")
    logger.info("MCP routes attached: %s", MCP_ROUTES_ATTACHED)
    logger.info("LangChain agent ready: %s", LANGCHAIN_AGENT_READY)


@app.get("/api/runtime-status")
async def runtime_status() -> Dict[str, Any]:
    return {
        "backend_active": True,
        "mcp_routes_attached": MCP_ROUTES_ATTACHED,
        "langchain_agent_ready": LANGCHAIN_AGENT_READY,
        "entrypoint": "backend/main.py",
    }


@app.post("/api/agent/execute")
async def execute_langchain_agent(payload: AgentExecutionPayload) -> Dict[str, Any]:
    if not LANGCHAIN_AGENT_READY or AutonomousWorkspaceAgent is None:
        raise HTTPException(
            status_code=503,
            detail="LangChain agent service is not available in this runtime.",
        )

    workspace_root = _resolve_agent_workspace_root(payload.workspace_root)
    runtime_config = _load_langchain_runtime_config()

    model_id = payload.model_id.strip() if payload.model_id and payload.model_id.strip() else LANGCHAIN_DEFAULT_MODEL_ID

    try:
        agent = AutonomousWorkspaceAgent(
            workspace_root=workspace_root,
            model_id=model_id,
            watsonx_url=runtime_config["watsonx_url"],
            watsonx_project_id=runtime_config["watsonx_project_id"],
            watsonx_api_key=runtime_config["watsonx_api_key"],
            max_iterations=payload.max_iterations,
            verbose=payload.verbose,
        )
        result = agent.run(
            target_file=payload.target_file,
            change_request=payload.change_request,
        )
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"LangChain agent execution failed: {exc}") from exc

    return {
        "status": "success",
        "workspace_root": str(workspace_root),
        "result": result,
    }


@app.get("/api/testing-workspace")
async def get_testing_workspace() -> Dict[str, str]:
    if not TESTING_WORKSPACE_PATH.exists():
        raise HTTPException(status_code=404, detail="Testing workspace not found.")
    return {"path": str(TESTING_WORKSPACE_PATH.resolve())}


@app.post("/api/set-workspace")
async def set_workspace(payload: WorkspacePayload) -> Dict[str, Any]:
    global CURRENT_WORKSPACE_PATH, CURRENT_MAIN_FILE_PATH, CURRENT_GRAPH_FILES

    workspace = _validate_workspace_path(payload.path.strip())
    CURRENT_WORKSPACE_PATH = str(workspace)
    CURRENT_MAIN_FILE_PATH = ""
    CURRENT_GRAPH_FILES = []

    return {
        "status": "success",
        "message": "Workspace path connected successfully.",
        "workspace_path": CURRENT_WORKSPACE_PATH,
    }


@app.post("/api/load-main-file")
async def load_main_file(payload: MainFilePayload) -> Dict[str, Any]:
    global CURRENT_WORKSPACE_PATH, CURRENT_MAIN_FILE_PATH, CURRENT_GRAPH_FILES

    main_file = _validate_main_file_path(payload.path.strip())
    CURRENT_MAIN_FILE_PATH = str(main_file.resolve())
    CURRENT_WORKSPACE_PATH = str(main_file.parent.resolve())

    graph_payload = _build_workspace_graph(
        workspace_path=CURRENT_WORKSPACE_PATH,
        main_file_path=CURRENT_MAIN_FILE_PATH,
    )
    CURRENT_GRAPH_FILES = graph_payload.get("source_files", [])

    return {
        "status": "success",
        "message": "Main Python file loaded successfully.",
        "main_file_path": CURRENT_MAIN_FILE_PATH,
        "workspace_path": CURRENT_WORKSPACE_PATH,
        **graph_payload,
    }


@app.get("/api/workspace-graph")
async def workspace_graph() -> Dict[str, Any]:
    global CURRENT_GRAPH_FILES

    if CURRENT_MAIN_FILE_PATH:
        graph_payload = _build_workspace_graph(
            workspace_path=CURRENT_WORKSPACE_PATH,
            main_file_path=CURRENT_MAIN_FILE_PATH,
        )
        CURRENT_GRAPH_FILES = graph_payload.get("source_files", [])
        return graph_payload

    if not CURRENT_WORKSPACE_PATH:
        raise HTTPException(
            status_code=400,
            detail="A workspace path must be connected first.",
        )

    graph_payload = _build_workspace_graph(CURRENT_WORKSPACE_PATH)
    CURRENT_GRAPH_FILES = graph_payload.get("source_files", [])
    return graph_payload


@app.get("/api/file-content")
async def get_file_content(path: str = Query(..., description="Relative or absolute file path")) -> Dict[str, Any]:
    if not CURRENT_WORKSPACE_PATH:
        raise HTTPException(status_code=400, detail="A workspace path must be connected first.")

    workspace_root = Path(CURRENT_WORKSPACE_PATH).resolve()
    target = _resolve_requested_file(path, workspace_root, must_exist=True)

    try:
        content = target.read_text(encoding="utf-8")
    except OSError as error:
        raise HTTPException(status_code=500, detail=f"Failed to read file: {error}") from error

    return {
        "status": "success",
        "path": str(target),
        "relative_path": _safe_relative(target, workspace_root),
        "content": content,
    }


@app.post("/api/save-file")
async def save_file(payload: FileSavePayload) -> Dict[str, Any]:
    if not CURRENT_WORKSPACE_PATH:
        raise HTTPException(status_code=400, detail="A workspace path must be connected first.")

    workspace_root = Path(CURRENT_WORKSPACE_PATH).resolve()
    target = _resolve_requested_file(payload.path, workspace_root, must_exist=False)

    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(payload.content, encoding="utf-8")
    except OSError as error:
        raise HTTPException(status_code=500, detail=f"Failed to write file: {error}") from error

    files_for_validation = _current_graph_files_for_validation(workspace_root)
    if target.suffix.lower() == ".py" and target.resolve() not in {path.resolve() for path in files_for_validation}:
        files_for_validation.append(target.resolve())

    syntax_errors = _collect_syntax_errors(files_for_validation, workspace_root)
    response: Dict[str, Any] = {
        "status": "saved",
        "path": str(target),
        "relative_path": _safe_relative(target, workspace_root),
        "has_syntax_errors": bool(syntax_errors),
        "syntax_errors": syntax_errors,
    }

    if not syntax_errors:
        try:
            graph_payload = _build_workspace_graph(
                workspace_path=CURRENT_WORKSPACE_PATH,
                main_file_path=CURRENT_MAIN_FILE_PATH or None,
            )
            response["graph"] = graph_payload
        except HTTPException as error:
            response["graph_error"] = error.detail

    return response


@app.post("/api/save-function-content")
async def save_function_content(payload: FunctionSavePayload) -> Dict[str, Any]:
    global CURRENT_GRAPH_FILES

    if not CURRENT_WORKSPACE_PATH:
        raise HTTPException(status_code=400, detail="A workspace path must be connected first.")

    workspace_root = Path(CURRENT_WORKSPACE_PATH).resolve()
    relative_file, function_name = _parse_function_id(payload.function_id)
    target = _resolve_requested_file(relative_file, workspace_root, must_exist=True)

    try:
        source = target.read_text(encoding="utf-8")
    except OSError as error:
        raise HTTPException(status_code=500, detail=f"Failed to read file: {error}") from error

    start_index: Optional[int] = None
    end_index: Optional[int] = None

    try:
        tree = ast.parse(source, filename=str(target))
        function_node: Optional[ast.AST] = None
        for node in tree.body:
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == function_name:
                function_node = node
                break

        if function_node is not None:
            start_index = max(getattr(function_node, "lineno", 1) - 1, 0)
            end_index = max(getattr(function_node, "end_lineno", start_index + 1), start_index + 1)
    except SyntaxError:
        function_node = None

    if start_index is None or end_index is None:
        text_range = _locate_function_range_by_text(source, function_name)
        if text_range is None:
            raise HTTPException(
                status_code=404,
                detail=f"Function '{function_name}' was not found in {relative_file}.",
            )
        start_index, end_index = text_range

    replacement = payload.content
    if replacement and not replacement.endswith("\n"):
        replacement += "\n"

    original_lines = source.splitlines(keepends=True)
    replacement_lines = replacement.splitlines(keepends=True)
    updated_source = "".join(
        [*original_lines[:start_index], *replacement_lines, *original_lines[end_index:]]
    )

    try:
        target.write_text(updated_source, encoding="utf-8")
    except OSError as error:
        raise HTTPException(status_code=500, detail=f"Failed to write file: {error}") from error

    files_for_validation = _current_graph_files_for_validation(workspace_root)
    if target.resolve() not in {path.resolve() for path in files_for_validation}:
        files_for_validation.append(target.resolve())

    syntax_errors = _collect_syntax_errors(files_for_validation, workspace_root)
    response: Dict[str, Any] = {
        "status": "saved",
        "function_id": payload.function_id,
        "relative_path": _safe_relative(target, workspace_root),
        "has_syntax_errors": bool(syntax_errors),
        "syntax_errors": syntax_errors,
    }

    if not syntax_errors:
        try:
            graph_payload = _build_workspace_graph(
                workspace_path=CURRENT_WORKSPACE_PATH,
                main_file_path=CURRENT_MAIN_FILE_PATH or None,
            )
            CURRENT_GRAPH_FILES = graph_payload.get("source_files", [])
            response["graph"] = graph_payload
        except HTTPException as error:
            response["graph_error"] = error.detail

    return response


@app.post("/api/endpoint")
async def drop_endpoint_intent(payload: EndpointPayload) -> Dict[str, Any]:
    if not CURRENT_WORKSPACE_PATH:
        raise HTTPException(
            status_code=400,
            detail="A workspace path must be connected first.",
        )

    bob_dir = os.path.join(CURRENT_WORKSPACE_PATH, ".bob")
    intent_file_path = os.path.join(bob_dir, "mcp_intent.json")

    intent_payload = {
        "task": "Add a new REST API endpoint node",
        "method": payload.method,
        "route_path": payload.path,
        "logic_intent": payload.description,
        "rule_reference": "Follow rules in .bob/rules-api-architect/01-generation-standards.md",
    }

    try:
        os.makedirs(bob_dir, exist_ok=True)
        with open(intent_file_path, "w", encoding="utf-8") as intent_file:
            intent_file.write(json.dumps(intent_payload, indent=4))
    except OSError as error:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to write IBM Bob intent file: {error}",
        ) from error
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected filesystem error: {error}",
        ) from error

    return {
        "status": "success",
        "message": "Intent payload dropped into workspace for IBM Bob.",
        "intent_file": intent_file_path,
    }


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=5000, reload=False)
