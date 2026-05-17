"""LangChain-based orchestration for IBM watsonx endpoint generation.

The service generates structured function artifacts, validates the updated source,
and returns data that the MCP layer can persist and reflect back into the graph.
"""

from __future__ import annotations

import ast
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

from pydantic import BaseModel, Field
from dotenv import load_dotenv

try:
    from langchain_ibm import ChatWatsonx
except ModuleNotFoundError as exc:  # pragma: no cover - validated at runtime
    raise RuntimeError("langchain-ibm is required for the Watsonx agent runtime.") from exc


DEFAULT_MODEL_ID = "ibm/granite-8b-code-instruct"
DEFAULT_MAX_ITERATIONS = 24
DEFAULT_WATSONX_URL = "https://us-south.ml.cloud.ibm.com"

PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")
load_dotenv(Path(__file__).with_name(".env"))


class FunctionArgumentSpec(BaseModel):
    name: str = Field(..., description="Argument name.")
    type: str = Field(default="Any", description="Python type annotation to use.")
    default: Optional[str] = Field(default=None, description="Default value as Python source.")
    description: Optional[str] = Field(default=None, description="What the argument represents.")


class GeneratedFunctionSpec(BaseModel):
    func_name: str = Field(..., description="Function name.")
    func_path: str = Field(..., description="HTTP route path or source location the function implements.")
    func_args: List[FunctionArgumentSpec] = Field(default_factory=list, description="Function arguments.")
    path_operation_decorator: Optional[str] = Field(default=None, description="Primary FastAPI path operation decorator for endpoint handlers.")
    decorators: List[str] = Field(default_factory=list, description="Function decorators, including FastAPI path operation decorators.")
    source_file: Optional[str] = Field(default=None, description="Relative or absolute file path where this function should be written.")
    func_code: str = Field(..., description="Complete top-level Python function code.")
    purpose: Optional[str] = Field(default=None, description="Short summary of the function's role.")


class EndpointGenerationPlan(BaseModel):
    explanation: str = Field(..., description="Why the generated functions fit the request.")
    functions: List[GeneratedFunctionSpec] = Field(default_factory=list, description="Structured generated functions.")
    warnings: List[str] = Field(default_factory=list, description="Warnings about assumptions or limitations.")
    suggestions: List[str] = Field(default_factory=list, description="Recommended follow-up actions.")


class FunctionRefactorPlan(BaseModel):
    explanation: str = Field(..., description="Why the refactor works.")
    generated_code: str = Field(..., description="Refactored function code.")
    warnings: List[str] = Field(default_factory=list, description="Warnings about assumptions or limitations.")
    suggestions: List[str] = Field(default_factory=list, description="Recommended follow-up actions.")


def _strip_code_fences(code: str) -> str:
    text = (code or "").strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1]
    if text.endswith("```"):
        text = text.rsplit("```", 1)[0]
    return text.strip()


def _ensure_trailing_newline(text: str) -> str:
    return text if text.endswith("\n") else f"{text}\n"


def _endpoint_decorator_lines(route_method: Optional[str], route_path: Optional[str]) -> List[str]:
    if not route_method or not route_path:
        return []

    method = route_method.strip().upper()
    path = route_path.strip()
    if not method or not path:
        return []

    if method == "GET":
        return [f'@app.get("{path}")']
    if method == "POST":
        return [f'@app.post("{path}")']
    if method == "PUT":
        return [f'@app.put("{path}")']
    if method == "DELETE":
        return [f'@app.delete("{path}")']
    if method == "PATCH":
        return [f'@app.patch("{path}")']
    return [f'@app.api_route("{path}", methods=["{method}"])']


def _inject_decorator(block: str, decorator_lines: List[str]) -> str:
    if not decorator_lines:
        return block

    lines = block.splitlines()
    if any(line.lstrip().startswith("@app.") or line.lstrip().startswith("@router.") for line in lines):
        return block

    insert_index = None
    for index, line in enumerate(lines):
        stripped = line.lstrip()
        if stripped.startswith("def ") or stripped.startswith("async def "):
            insert_index = index
            break

    if insert_index is None:
        return block

    return "\n".join([*lines[:insert_index], *decorator_lines, *lines[insert_index:]])


def _source_function_names(source: str) -> List[str]:
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return []

    names: List[str] = []
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            names.append(node.name)
    return names
def _default_service_target_path(target_path: Path) -> Path:
    return target_path.parent / "services" / "generated_service.py"

def _module_import_path(workspace_root: Path, file_path: Path) -> str:
    relative_path = file_path.resolve().relative_to(workspace_root.resolve())
    module_parts = list(relative_path.with_suffix("").parts)
    return ".".join(module_parts)

def _append_code_block(source_code: str, generated_code: str) -> str:
    cleaned_code = _ensure_trailing_newline(_strip_code_fences(generated_code))
    if not cleaned_code.strip():
        raise RuntimeError("Generated code is empty.")

    candidate = source_code.rstrip() + "\n\n" + cleaned_code if source_code.strip() else cleaned_code
    ast.parse(candidate)
    return candidate
    return names


def _load_watsonx_credentials(
    watsonx_url: Optional[str] = None,
    watsonx_project_id: Optional[str] = None,
    watsonx_api_key: Optional[str] = None,
) -> Dict[str, str]:
    url = (watsonx_url or os.getenv("WATSONX_URL") or DEFAULT_WATSONX_URL).strip()
    project_id = (watsonx_project_id or os.getenv("WATSONX_PROJECT_ID") or "").strip()
    api_key = (watsonx_api_key or os.getenv("WATSONX_API_KEY") or os.getenv("WATSONX_APIKEY") or "").strip()

    missing: List[str] = []
    if not project_id:
        missing.append("WATSONX_PROJECT_ID")
    if not api_key:
        missing.append("WATSONX_API_KEY")
    if missing:
        raise RuntimeError(f"Missing watsonx credentials: {', '.join(missing)}")

    return {
        "url": url,
        "project_id": project_id,
        "apikey": api_key,
    }


@dataclass
class GeneratedFileChange:
    file_path: str
    relative_path: str
    source_before: str
    source_after: str
    generated_code: str


class AutonomousWorkspaceAgent:
    """LangChain orchestration for endpoint and function transformations."""

    def __init__(
        self,
        workspace_root: Path,
        model_id: str = DEFAULT_MODEL_ID,
        watsonx_url: Optional[str] = None,
        watsonx_project_id: Optional[str] = None,
        watsonx_api_key: Optional[str] = None,
        max_iterations: int = DEFAULT_MAX_ITERATIONS,
        verbose: bool = False,
    ) -> None:
        self.workspace_root = Path(workspace_root).resolve()
        self.model_id = model_id or DEFAULT_MODEL_ID
        self.credentials = _load_watsonx_credentials(watsonx_url, watsonx_project_id, watsonx_api_key)
        self.max_iterations = max_iterations
        self.verbose = verbose

    def _build_chat_model(self) -> ChatWatsonx:
        return ChatWatsonx(
            model_id=self.model_id,
            project_id=self.credentials["project_id"],
            url=self.credentials["url"],
            apikey=self.credentials["apikey"],
            temperature=0.2,
            max_tokens=2500,
            disable_streaming=True,
        )

    def _generate_plan(
        self,
        source_code: str,
        change_request: str,
        target_file: str,
        route_method: Optional[str] = None,
        route_path: Optional[str] = None,
    ) -> EndpointGenerationPlan:
        existing_function_names = _source_function_names(source_code)
        schema = self._build_chat_model().with_structured_output(EndpointGenerationPlan)
        prompt = (
            "You are generating code for an existing Python API file.\n"
            "Return a structured JSON plan that the app can write into the file immediately.\n"
            "Rules:\n"
            "1. The first function must be the FastAPI endpoint handler for the requested route.\n"
            "2. The endpoint handler must include the correct FastAPI decorator for the requested method and path.\n"
            "3. The endpoint handler JSON must include the decorator text in a decorators array, for example [\"@app.get(\\\"/path\\\")\"].\n"
            "4. The endpoint handler JSON must also include path_operation_decorator with the primary decorator string.\n"
            "5. If the endpoint needs supporting logic, put those helper functions in a services module and set their source_file to that services file.\n"
            "6. Each function must include func_name, func_path, func_args, path_operation_decorator, decorators, source_file, and func_code.\n"
            "7. func_code must be valid Python source and must not be wrapped in markdown fences.\n"
            "8. Reuse existing imports and helpers from the file when possible.\n"
            "9. Do not invent unrelated changes, and do not return plain utility functions unless they are helpers for the endpoint.\n"
            "10. If the target file already defines a function with the same name, choose a new name unless the request is explicitly a replacement.\n\n"
            f"Target file: {target_file}\n"
            f"Requested HTTP method: {route_method or 'N/A'}\n"
            f"Requested route path: {route_path or 'N/A'}\n"
            f"Existing top-level function names: {', '.join(existing_function_names) if existing_function_names else 'none'}\n\n"
            "Current source code:\n"
            f"{source_code}\n\n"
            "Task:\n"
            f"{change_request}\n"
        )
        return schema.invoke(prompt)

    def _generate_refactor_plan(
        self,
        source_code: str,
        function_name: str,
        refactor_goal: str,
        preserve_signature: bool,
    ) -> FunctionRefactorPlan:
        schema = self._build_chat_model().with_structured_output(FunctionRefactorPlan)
        prompt = (
            "You are a LangChain code refactoring agent.\n"
            "Return a JSON object that contains a refactored function body in generated_code.\n"
            f"Function name: {function_name}\n"
            f"Preserve signature: {preserve_signature}\n"
            "Current source:\n"
            f"{source_code}\n\n"
            "Refactor goal:\n"
            f"{refactor_goal}\n"
        )
        return schema.invoke(prompt)

    def _apply_generated_code(self, source_code: str, generated_code: str) -> str:
        cleaned_code = _ensure_trailing_newline(_strip_code_fences(generated_code))
        if not cleaned_code.strip():
            raise RuntimeError("Generated code is empty.")

        candidate = source_code.rstrip() + "\n\n" + cleaned_code
        ast.parse(candidate)
        return candidate

    def generate_endpoint_artifacts(
        self,
        target_file: Path,
        change_request: str,
        route_method: Optional[str] = None,
        route_path: Optional[str] = None,
    ) -> Dict[str, Any]:
        target_path = Path(target_file).resolve()
        plan = self._generate_plan(
            source_code=target_path.read_text(encoding="utf-8"),
            change_request=change_request,
            target_file=str(target_path),
            route_method=route_method,
            route_path=route_path,
        )

        if not plan.functions:
            raise RuntimeError("The model did not return any generated functions.")

        generated_blocks = [_strip_code_fences(function.func_code) for function in plan.functions]
        decorator_lines = _endpoint_decorator_lines(route_method, route_path)
        if generated_blocks:
            generated_blocks[0] = _inject_decorator(generated_blocks[0], decorator_lines)
            plan.functions[0].path_operation_decorator = decorator_lines[0] if decorator_lines else None
            if plan.functions[0].decorators == []:
                plan.functions[0].decorators = decorator_lines
            elif decorator_lines and decorator_lines[0] not in plan.functions[0].decorators:
                plan.functions[0].decorators = [*plan.functions[0].decorators, *decorator_lines]
        service_target_path = _default_service_target_path(target_path)
        helper_functions = plan.functions[1:]
        helper_names = [function.func_name for function in helper_functions if function.func_name]

        file_blocks: Dict[str, List[str]] = {}
        for index, function in enumerate(plan.functions):
            if index == 0:
                function.source_file = str(target_path)
            elif helper_functions:
                function.source_file = str(service_target_path)
            else:
                function.source_file = str(target_path)

            generated_block = _strip_code_fences(function.func_code)
            if index == 0:
                generated_block = _inject_decorator(generated_block, decorator_lines)
                function.path_operation_decorator = decorator_lines[0] if decorator_lines else None
                if function.decorators == []:
                    function.decorators = decorator_lines
                elif decorator_lines and decorator_lines[0] not in function.decorators:
                    function.decorators = [*function.decorators, *decorator_lines]

                if helper_names:
                    import_line = f"from services.generated_service import {', '.join(helper_names)}"
                    if import_line not in generated_block:
                        generated_block = f"{import_line}\n{generated_block}"

            file_blocks.setdefault(function.source_file or str(target_path), []).append(generated_block)

        file_changes: List[Dict[str, Any]] = []
        primary_change: Optional[Dict[str, Any]] = None
        for file_name, blocks in file_blocks.items():
            file_path = Path(file_name)
            existing_source = file_path.read_text(encoding="utf-8") if file_path.exists() else ""
            combined_code = "\n\n".join(block.strip() for block in blocks if block.strip())
            if not combined_code.strip():
                continue
            updated_source = _append_code_block(existing_source, combined_code)
            file_change = {
                "file_path": str(file_path),
                "relative_path": str(file_path.relative_to(self.workspace_root)).replace("\\", "/"),
                "source_before": existing_source,
                "source_after": updated_source,
                "generated_code": _ensure_trailing_newline(combined_code),
            }
            file_changes.append(file_change)
            if file_path.resolve() == target_path.resolve():
                primary_change = file_change

        if primary_change is None:
            raise RuntimeError("The model returned no primary endpoint code.")

        return {
            "explanation": plan.explanation,
            "warnings": plan.warnings,
            "suggestions": plan.suggestions,
            "functions": [function.model_dump() for function in plan.functions],
            "generated_code": primary_change["generated_code"],
            "source_before": primary_change["source_before"],
            "source_after": primary_change["source_after"],
            "file_path": primary_change["file_path"],
            "relative_path": primary_change["relative_path"],
            "file_changes": file_changes,
        }

    def apply_generated_code(
        self,
        target_file: Path,
        generated_code: str,
    ) -> GeneratedFileChange:
        target_path = Path(target_file).resolve()
        source_code = target_path.read_text(encoding="utf-8")
        updated_source = self._apply_generated_code(source_code, generated_code)
        return GeneratedFileChange(
            file_path=str(target_path),
            relative_path=str(target_path.relative_to(self.workspace_root)).replace("\\", "/"),
            source_before=source_code,
            source_after=updated_source,
            generated_code=_ensure_trailing_newline(_strip_code_fences(generated_code)),
        )

    def refactor_function(
        self,
        source_code: str,
        function_name: str,
        refactor_goal: str,
        preserve_signature: bool,
    ) -> Dict[str, Any]:
        plan = self._generate_refactor_plan(
            source_code=source_code,
            function_name=function_name,
            refactor_goal=refactor_goal,
            preserve_signature=preserve_signature,
        )

        cleaned_code = _ensure_trailing_newline(_strip_code_fences(plan.generated_code))
        if not cleaned_code.strip():
            raise RuntimeError("The model returned empty refactored code.")

        # Parse and extract only the top-level function definition the model returned.
        try:
            tree = ast.parse(cleaned_code)
        except SyntaxError:
            # If the returned code isn't valid Python, return it as-is so callers can inspect it.
            return {
                "explanation": plan.explanation,
                "generated_code": cleaned_code,
                "warnings": plan.warnings,
                "suggestions": plan.suggestions,
            }

        func_node = None
        for node in tree.body:
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                func_node = node
                break

        if func_node is None:
            # No function found; return cleaned_code as a fallback.
            result_code = cleaned_code
        else:
            lines = cleaned_code.splitlines(keepends=True)
            start = max(getattr(func_node, "lineno", 1) - 1, 0)
            end = max(getattr(func_node, "end_lineno", start + 1), start + 1)
            result_code = "".join(lines[start:end])

        # Remove any leftover code fence markers or stray triple quotes at end.
        result_code = result_code.rstrip()
        if result_code.endswith("'''") or result_code.endswith('\"\"\"'):
            result_code = result_code[:-3].rstrip()
        result_code = _ensure_trailing_newline(result_code)

        return {
            "explanation": plan.explanation,
            "generated_code": result_code,
            "warnings": plan.warnings,
            "suggestions": plan.suggestions,
        }

    def chat_completion(self, messages: Sequence[Dict[str, str]], context: Optional[Dict[str, Any]] = None) -> str:
        model = self._build_chat_model()
        prompt_parts = ["You are an IBM watsonx code assistant."]
        if context:
            prompt_parts.append("Context:")
            for key, value in context.items():
                prompt_parts.append(f"- {key}: {value}")
        prompt_parts.append("Messages:")
        for message in messages:
            role = message.get("role", "user")
            content = message.get("content", "")
            prompt_parts.append(f"{role}: {content}")
        response = model.invoke("\n".join(prompt_parts))
        return getattr(response, "content", str(response)).strip()

    def run(self, target_file: str, change_request: str) -> Dict[str, Any]:
        target_path = Path(target_file)
        if not target_path.is_absolute():
            target_path = (self.workspace_root / target_path).resolve()

        if not target_path.exists():
            raise FileNotFoundError(f"Target file does not exist: {target_path}")

        source_code = target_path.read_text(encoding="utf-8")
        artifact = self.generate_endpoint_artifacts(
            target_file=target_path,
            change_request=change_request,
        )
        for file_change in artifact.get("file_changes", []):
            file_path = Path(file_change["file_path"])
            file_path.parent.mkdir(parents=True, exist_ok=True)
            file_path.write_text(file_change["source_after"], encoding="utf-8")
        artifact["file_path"] = str(target_path)
        artifact["relative_path"] = str(target_path.relative_to(self.workspace_root)).replace("\\", "/")
        artifact["source_before"] = source_code
        return artifact

    def analyze_graph(self, code_map: str) -> Dict[str, Any]:
        """Ask watsonx to analyse a condensed code map and return a graph structure."""
        model = self._build_chat_model()

        # Concise prompt — Granite responds better to short, direct instructions
        prompt = (
            "You are a software architect. Analyse the codebase below and output ONLY "
            "a raw JSON object (no markdown, no explanation, no extra text).\n\n"
            "Required JSON shape:\n"
            '{"summary":"<one sentence>","nodes":[{"id":"<snake_id>","label":"<name>",'
            '"kind":"<input|function|module>","group":"<auth|payments|database|api|'
            'notifications|analytics|profile|content|moderation|governance|learning|utils>",'
            '"description":"<brief>","file":"<path>"}],'
            '"edges":[{"id":"<src>-><tgt>","source":"<src>","target":"<tgt>",'
            '"edge_type":"<api|call|dependency>"}]}\n\n'
            "kind=input → HTTP route/endpoint. kind=function → handler/service/util. "
            "kind=module → top-level class or standalone module.\n"
            "Add an edge for every call, import, or dependency.\n\n"
            f"CODEBASE:\n{code_map}\n\n"
            "Output the JSON object now:"
        )

        response = model.invoke(prompt)
        raw = getattr(response, "content", str(response)).strip()
        return _parse_ai_json(raw)


# ── Robust JSON extractor for model responses ────────────────────────────────

def _parse_ai_json(text: str) -> Dict[str, Any]:
    """
    Extract and parse a JSON object from a model response.
    Handles: markdown fences, leading explanation, trailing text, trailing commas.
    """
    import json as _json, re as _re  # noqa: PLC0415

    # 1. Strip all markdown code fences (```json ... ``` or ``` ... ```)
    text = _re.sub(r'```(?:json)?\s*', '', text)
    text = _re.sub(r'```', '', text).strip()

    # 2. Try direct parse (model obeyed instructions perfectly)
    try:
        return _json.loads(text)
    except _json.JSONDecodeError:
        pass

    # 3. Brace-counting extraction of first complete {...} block
    extracted = _brace_extract(text)
    if extracted:
        # 3a. Try raw extracted block
        try:
            return _json.loads(extracted)
        except _json.JSONDecodeError:
            pass
        # 3b. Repair trailing commas (common model mistake)
        repaired = _re.sub(r',\s*([}\]])', r'\1', extracted)
        try:
            return _json.loads(repaired)
        except _json.JSONDecodeError:
            pass

    raise ValueError(
        f"IBM Bob AI returned a response that could not be parsed as JSON.\n"
        f"Raw (first 400 chars): {text[:400]}"
    )


def _brace_extract(text: str) -> Optional[str]:
    """Return the first syntactically complete {...} JSON object in text."""
    start = text.find('{')
    if start == -1:
        return None
    depth = 0
    in_string = False
    escape = False
    for i, ch in enumerate(text[start:], start):
        if escape:
            escape = False
            continue
        if ch == '\\' and in_string:
            escape = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    return None


# ── Standalone code-map builder ───────────────────────────────────────────────

_SKIP_DIRS = {
    "node_modules", ".git", "__pycache__", ".next", "dist", "build",
    ".venv", "venv", "env", ".env", "coverage", ".pytest_cache",
}
_SOURCE_EXTS = {
    ".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".go",
    ".rb", ".php", ".rs", ".cs", ".mjs", ".cjs", ".sol",
}
_MAX_FILES = 50
_MAX_MAP_CHARS = 9_000   # ~2 250 tokens — leaves room for prompt + JSON output


def build_code_map(workspace_root: Path) -> str:
    """
    Walk workspace_root and produce a condensed text summary suitable for an LLM prompt.
    Extracts: file path, HTTP routes, class/function signatures, imports.
    Does NOT include full function bodies.
    """
    import re as _re  # noqa: PLC0415

    lines: List[str] = [f"WORKSPACE: {workspace_root.name}\n"]
    files_seen = 0

    for path in sorted(workspace_root.rglob("*")):
        if files_seen >= _MAX_FILES:
            break
        if not path.is_file():
            continue
        if any(part in _SKIP_DIRS for part in path.parts):
            continue
        if path.suffix not in _SOURCE_EXTS:
            continue

        rel = path.relative_to(workspace_root)
        try:
            src = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue

        file_lines: List[str] = [f"\nFILE: {rel}"]

        if path.suffix == ".py":
            # Routes / decorators
            for m in _re.finditer(r'@\w+\.(?:get|post|put|delete|patch)\(["\']([^"\']+)', src, _re.I):
                file_lines.append(f"  ROUTE: {m.group(1)}")
            # Class and function signatures only
            try:
                tree = ast.parse(src)
                for node in ast.walk(tree):
                    if isinstance(node, ast.ClassDef):
                        bases = ", ".join(ast.unparse(b) for b in node.bases) if node.bases else ""
                        file_lines.append(f"  CLASS: {node.name}({bases})")
                    elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                        args = ast.unparse(node.args)
                        deco = " ".join(f"@{ast.unparse(d)}" for d in node.decorator_list)
                        sig = f"{'async ' if isinstance(node, ast.AsyncFunctionDef) else ''}def {node.name}({args})"
                        file_lines.append(f"  {'  ' if deco else ''}FN: {sig}{(' [' + deco + ']') if deco else ''}")
            except SyntaxError:
                pass
            # Top-level imports
            for m in _re.finditer(r'^(?:import|from)\s+\S+', src, _re.M):
                file_lines.append(f"  IMPORT: {m.group().strip()}")

        elif path.suffix == ".sol":
            # Solidity — contracts, functions, events
            for m in _re.finditer(r'\bcontract\s+(\w+)', src):
                file_lines.append(f"  CONTRACT: {m.group(1)}")
            for m in _re.finditer(r'\bfunction\s+(\w+)\s*\(([^)]*)\)', src):
                file_lines.append(f"  FN: {m.group(1)}({m.group(2).strip()})")
            for m in _re.finditer(r'\bevent\s+(\w+)\s*\(', src):
                file_lines.append(f"  EVENT: {m.group(1)}")

        else:
            # JS/TS/Java/Go etc. — lightweight regex extraction
            for m in _re.finditer(
                r'(?:export\s+)?(?:async\s+)?(?:function|class|const|def|func)\s+(\w+)',
                src, _re.M
            ):
                file_lines.append(f"  SYMBOL: {m.group(1)}")
            for m in _re.finditer(r'(?:import|require)\s*[("\']([^"\'()]+)', src, _re.M):
                file_lines.append(f"  IMPORT: {m.group(1)}")
            # Express/FastAPI style routes
            for m in _re.finditer(r'\.(get|post|put|delete|patch)\(["\']([^"\']+)', src, _re.I):
                file_lines.append(f"  ROUTE: {m.group(1).upper()} {m.group(2)}")

        if len(file_lines) > 1:
            # Stop adding files once we approach the char cap
            candidate = "\n".join(lines + file_lines)
            if len(candidate) > _MAX_MAP_CHARS:
                lines.append(f"\n[... {_MAX_FILES - files_seen} more files omitted ...]")
                break
            lines.extend(file_lines)
            files_seen += 1

    return "\n".join(lines)
